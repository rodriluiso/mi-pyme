"""
Servicio central para el sistema de Undo (Deshacer).

Maneja el registro y ejecución de acciones deshacibles con soporte para:
- Validaciones robustas
- Locks para prevenir race conditions
- Tracking de errores parciales
- Expiración dinámica (15 minutos)
"""

from django.db import transaction
from django.utils import timezone
from datetime import timedelta

from usuarios.models import UndoAction


class UndoResult:
    """Resultado detallado de una operación de undo"""

    def __init__(self):
        self.success = False
        self.description = ""
        self.error_message = None
        self.steps_completed = []
        self.steps_failed = []

    def __str__(self):
        if self.success:
            return f"Success: {self.description}"
        return f"Failed: {self.error_message}"


class CannotUndoException(Exception):
    """Excepción cuando no se puede deshacer una acción por validaciones"""
    pass


class NoUndoableActionException(Exception):
    """Excepción cuando no hay acciones disponibles para deshacer"""
    pass


class UndoService:
    """
    Servicio central para gestión de undo/redo.

    Mantiene un registry de handlers para cada tipo de acción y coordina
    la ejecución segura de operaciones de undo con transacciones atómicas.
    """

    # Registry de handlers por action_type
    _handlers = {}

    @classmethod
    def register_handler(cls, action_type, handler_class):
        """
        Registra un handler para un tipo de acción.

        Args:
            action_type: String identificando el tipo de acción (ej: 'CREATE_VENTA')
            handler_class: Clase del handler (debe heredar de BaseUndoHandler)
        """
        cls._handlers[action_type] = handler_class

    @classmethod
    def get_handler(cls, action_type):
        """
        Obtiene una instancia del handler para un tipo de acción.

        Args:
            action_type: String identificando el tipo de acción

        Returns:
            Instancia del handler correspondiente

        Raises:
            ValueError: Si no hay handler registrado para el tipo de acción
        """
        if action_type not in cls._handlers:
            raise ValueError(
                f"No hay handler registrado para el tipo de acción: {action_type}"
            )
        return cls._handlers[action_type]()

    @staticmethod
    @transaction.atomic
    def undo_last(user):
        """
        Deshace la última acción del usuario.

        Busca la última acción no deshecha y no expirada del usuario,
        valida que se puede deshacer, ejecuta el handler correspondiente
        y marca la acción como deshecha.

        Args:
            user: Instancia de Usuario

        Returns:
            UndoResult con detalles de la operación

        Raises:
            NoUndoableActionException: Si no hay acciones para deshacer
            CannotUndoException: Si la acción no puede ser deshecha
        """
        result = UndoResult()

        # Buscar última acción deshacible (con lock para evitar race conditions)
        cutoff = timezone.now() - timedelta(minutes=15)

        undo_action = UndoAction.objects.select_for_update().filter(
            user=user,
            undone_at__isnull=True,
            created_at__gte=cutoff
        ).order_by('-created_at').first()

        if not undo_action:
            raise NoUndoableActionException("No hay acciones para deshacer")

        try:
            # Obtener handler
            handler = UndoService.get_handler(undo_action.action_type)

            # CRÍTICO: Validar que se puede deshacer
            if not handler.validate_can_undo(undo_action):
                raise CannotUndoException(
                    "No se puede deshacer: el objeto fue modificado"
                )

            # Ejecutar undo con tracking de pasos
            handler.undo(undo_action, result)

            if result.success:
                # Marcar como deshecha
                undo_action.undone_at = timezone.now()
                undo_action.save(update_fields=['undone_at'])
                result.description = undo_action.description

        except CannotUndoException:
            raise  # Re-raise para que el controlador lo maneje
        except Exception as e:
            # Log detallado del error
            undo_action.rollback_status = {
                'error': str(e),
                'error_type': type(e).__name__,
                'steps_completed': result.steps_completed,
                'steps_failed': result.steps_failed
            }
            undo_action.has_failed_rollback = True
            undo_action.save()

            result.error_message = f"Error al deshacer: {str(e)}"
            # La transacción se revierte automáticamente

        return result

    @staticmethod
    def get_availability(user):
        """
        Retorna si hay acción disponible para deshacer.

        Calcula expiración dinámicamente (sin cronjob).
        Solo considera acciones de los últimos 15 minutos.

        Args:
            user: Instancia de Usuario

        Returns:
            dict con:
                - available (bool): Si hay acción disponible
                - description (str): Descripción de la acción
                - action_type (str): Tipo de acción
                - created_at (str): Timestamp ISO de creación
        """
        cutoff = timezone.now() - timedelta(minutes=15)

        action = UndoAction.objects.filter(
            user=user,
            undone_at__isnull=True,
            created_at__gte=cutoff
        ).order_by('-created_at').first()

        if action:
            return {
                'available': True,
                'description': action.description,
                'action_type': action.action_type,
                'created_at': action.created_at.isoformat()
            }

        return {'available': False}

    @staticmethod
    def register_action(user, action_type, undo_payload, description,
                       content_object=None, object_state_hash=None,
                       group_id=None):
        """
        Registra una acción deshacible.

        Args:
            user: Instancia de Usuario
            action_type: String identificando el tipo de acción
            undo_payload: dict con datos necesarios para deshacer
            description: String descriptivo para mostrar en UI
            content_object: Objeto relacionado (opcional)
            object_state_hash: Hash SHA256 del estado del objeto (opcional)
            group_id: UUID para agrupar acciones relacionadas (opcional)

        Returns:
            Instancia de UndoAction creada
        """
        from django.contrib.contenttypes.models import ContentType

        # Obtener content_type si se pasó el objeto
        content_type = None
        object_id = None
        if content_object:
            content_type = ContentType.objects.get_for_model(content_object)
            object_id = str(content_object.pk)

        action = UndoAction.objects.create(
            user=user,
            action_type=action_type,
            content_type=content_type,
            object_id=object_id,
            object_state_hash=object_state_hash,
            undo_payload=undo_payload,
            description=description,
            group_id=group_id
        )

        return action
