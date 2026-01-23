"""
Clase base para handlers de undo.

Todos los handlers específicos deben heredar de BaseUndoHandler
e implementar los métodos abstractos validate_can_undo() y undo().
"""

from django.db import transaction


class BaseUndoHandler:
    """
    Clase base abstracta para handlers de undo.

    Cada handler maneja un tipo específico de acción (ej: CREATE_VENTA)
    y conoce cómo revertir esa acción de manera segura.
    """

    def undo(self, undo_action, result):
        """
        Ejecuta el undo de la acción.

        Este método debe ser implementado por cada handler específico.
        Debe ser idempotente y usar select_for_update() para locks.

        Args:
            undo_action: Instancia de UndoAction con los datos de la acción
            result: Instancia de UndoResult para trackear pasos y errores

        El handler debe:
        1. Obtener objetos relacionados con select_for_update()
        2. Validar estado actual
        3. Revertir cambios (restaurar stock, marcar como anulado, etc.)
        4. Actualizar result.steps_completed
        5. Marcar result.success = True si todo fue exitoso

        En caso de error, el handler puede:
        - Lanzar una excepción (la transacción se revertirá automáticamente)
        - Actualizar result.steps_failed y no marcar success
        """
        raise NotImplementedError(
            f"{self.__class__.__name__} debe implementar el método undo()"
        )

    def validate_can_undo(self, undo_action):
        """
        Valida si la acción puede ser deshecha.

        Este método se ejecuta ANTES de undo() y debe verificar:
        - El objeto aún existe
        - No ha sido modificado desde la acción original
        - No hay operaciones dependientes posteriores
        - Cualquier otra condición de negocio

        Args:
            undo_action: Instancia de UndoAction con los datos de la acción

        Returns:
            bool: True si se puede deshacer, False si no

        Raises:
            CannotUndoException: Si no se puede deshacer con mensaje específico
        """
        raise NotImplementedError(
            f"{self.__class__.__name__} debe implementar el método validate_can_undo()"
        )
