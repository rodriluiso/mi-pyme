import uuid

from django.contrib.auth.models import AbstractUser, Group, Permission
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.db import models
from django.core.exceptions import ValidationError


class Usuario(AbstractUser):
    """
    Modelo de usuario extendido para PyME con sistema de 3 niveles
    """

    class NivelAcceso(models.TextChoices):
        ADMIN_TOTAL = 'ADMIN_TOTAL', 'Administrador Total'
        ADMIN_NIVEL_2 = 'ADMIN_NIVEL_2', 'Administrador Nivel 2'
        ADMIN_NIVEL_1 = 'ADMIN_NIVEL_1', 'Administrador Nivel 1'

    # Campos adicionales
    nivel_acceso = models.CharField(
        max_length=20,
        choices=NivelAcceso.choices,
        default=NivelAcceso.ADMIN_NIVEL_1,
        help_text="Nivel de acceso del usuario en el sistema"
    )

    telefono = models.CharField(
        max_length=20,
        blank=True,
        null=True,
        help_text="Número de teléfono del usuario"
    )

    cargo = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        help_text="Cargo o puesto del usuario en la empresa"
    )

    fecha_ingreso = models.DateField(
        blank=True,
        null=True,
        help_text="Fecha de ingreso del usuario a la empresa"
    )

    activo = models.BooleanField(
        default=True,
        help_text="Indica si el usuario está activo en el sistema"
    )

    ultima_actividad = models.DateTimeField(
        blank=True,
        null=True,
        help_text="Última vez que el usuario accedió al sistema"
    )

    # Campos de seguridad para reset de contraseña
    debe_cambiar_password = models.BooleanField(
        default=False,
        verbose_name="Debe cambiar contraseña",
        help_text="Forzar cambio de contraseña en próximo login"
    )

    password_reset_at = models.DateTimeField(
        blank=True,
        null=True,
        verbose_name="Fecha de reset de contraseña",
        help_text="Última vez que se reseteó la contraseña"
    )

    creado_por = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='usuarios_creados',
        help_text="Usuario que creó este registro"
    )

    fecha_creacion = models.DateTimeField(auto_now_add=True)
    fecha_modificacion = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Usuario"
        verbose_name_plural = "Usuarios"
        ordering = ['-fecha_creacion']

    def __str__(self):
        return f"{self.get_full_name() or self.username} ({self.get_nivel_acceso_display()})"

    def clean(self):
        """Validaciones personalizadas"""
        super().clean()

        # Solo Admin Total puede crear otros Admin Total
        if hasattr(self, '_current_user'):
            if (self.nivel_acceso == self.NivelAcceso.ADMIN_TOTAL and
                self._current_user.nivel_acceso != self.NivelAcceso.ADMIN_TOTAL):
                raise ValidationError(
                    "Solo un Administrador Total puede crear otro Administrador Total"
                )

    @property
    def modulos_permitidos(self):
        """Retorna los módulos a los que tiene acceso según su nivel"""
        permisos = {
            self.NivelAcceso.ADMIN_TOTAL: [
                'dashboard', 'ventas', 'compras', 'clientes', 'proveedores',
                'productos', 'finanzas', 'reportes', 'afip', 'bancos',
                'recursos_humanos', 'usuarios', 'configuracion'
            ],
            self.NivelAcceso.ADMIN_NIVEL_2: [
                'dashboard', 'ventas', 'compras', 'clientes', 'proveedores',
                'productos', 'finanzas', 'reportes', 'afip', 'bancos'
            ],
            self.NivelAcceso.ADMIN_NIVEL_1: [
                'dashboard', 'ventas', 'clientes', 'afip'
            ]
        }
        return permisos.get(self.nivel_acceso, [])

    def puede_acceder_modulo(self, modulo):
        """Verifica si el usuario puede acceder a un módulo específico"""
        return modulo in self.modulos_permitidos

    def puede_gestionar_usuarios(self):
        """Solo Admin Total puede gestionar usuarios"""
        return self.nivel_acceso == self.NivelAcceso.ADMIN_TOTAL

    def puede_crear_nivel(self, nivel_objetivo):
        """Verifica si puede crear un usuario de cierto nivel"""
        if self.nivel_acceso == self.NivelAcceso.ADMIN_TOTAL:
            return True  # Admin Total puede crear cualquier nivel

        # Otros niveles no pueden crear usuarios
        return False

    def get_nivel_numerico(self):
        """Retorna el nivel como número para comparaciones"""
        niveles = {
            self.NivelAcceso.ADMIN_TOTAL: 3,
            self.NivelAcceso.ADMIN_NIVEL_2: 2,
            self.NivelAcceso.ADMIN_NIVEL_1: 1
        }
        return niveles.get(self.nivel_acceso, 0)


class LogAcceso(models.Model):
    """Registro de accesos al sistema"""

    usuario = models.ForeignKey(
        Usuario,
        on_delete=models.CASCADE,
        related_name='logs_acceso',
        null=True,
        blank=True,
        help_text="Usuario que realizó la acción (puede ser null para intentos fallidos)"
    )

    fecha_acceso = models.DateTimeField(auto_now_add=True)
    ip_address = models.GenericIPAddressField(blank=True, null=True)
    user_agent = models.TextField(blank=True, null=True)
    accion = models.CharField(max_length=100, blank=True, null=True)
    modulo = models.CharField(max_length=50, blank=True, null=True)
    exitoso = models.BooleanField(default=True)

    class Meta:
        verbose_name = "Log de Acceso"
        verbose_name_plural = "Logs de Acceso"
        ordering = ['-fecha_acceso']

    def __str__(self):
        return f"{self.usuario.username} - {self.fecha_acceso.strftime('%Y-%m-%d %H:%M')}"


class ConfiguracionSistema(models.Model):
    """Configuraciones generales del sistema"""

    nombre_empresa = models.CharField(
        max_length=200,
        default="Mi PyME",
        help_text="Nombre de la empresa"
    )

    logo_empresa = models.ImageField(
        upload_to='logos/',
        blank=True,
        null=True,
        help_text="Logo de la empresa"
    )

    max_usuarios = models.PositiveIntegerField(
        default=10,
        help_text="Máximo número de usuarios permitidos"
    )

    requiere_cambio_password = models.BooleanField(
        default=True,
        help_text="Requiere cambio de contraseña en primer acceso"
    )

    dias_vigencia_password = models.PositiveIntegerField(
        default=90,
        help_text="Días de vigencia de las contraseñas"
    )

    intentos_login_max = models.PositiveIntegerField(
        default=3,
        help_text="Máximo intentos de login antes de bloquear"
    )

    session_timeout = models.PositiveIntegerField(
        default=30,
        help_text="Tiempo de sesión en minutos"
    )

    fecha_creacion = models.DateTimeField(auto_now_add=True)
    fecha_modificacion = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Configuración del Sistema"
        verbose_name_plural = "Configuraciones del Sistema"

    def __str__(self):
        return f"Configuración - {self.nombre_empresa}"

    def save(self, *args, **kwargs):
        # Asegurar que solo haya una configuración
        if not self.pk and ConfiguracionSistema.objects.exists():
            raise ValidationError("Solo puede existir una configuración del sistema")
        super().save(*args, **kwargs)


# ============================================================================
# SISTEMA DE UNDO (DESHACER)
# ============================================================================

class UndoAction(models.Model):
    """
    Registro de acciones deshacibles del usuario.
    Permite implementar funcionalidad de "Deshacer" para operaciones críticas.
    """

    class ActionType(models.TextChoices):
        CREATE_VENTA = 'CREATE_VENTA', 'Crear Venta'
        EDIT_VENTA = 'EDIT_VENTA', 'Editar Venta'
        REGISTER_PAGO_CLIENTE = 'REGISTER_PAGO_CLIENTE', 'Registrar Pago'
        CREATE_COMPRA = 'CREATE_COMPRA', 'Crear Compra'
        # Más tipos se agregarán según necesidad

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        'usuarios.Usuario',
        on_delete=models.CASCADE,
        related_name='undo_actions',
        verbose_name='Usuario'
    )

    # Tipo de acción
    action_type = models.CharField(
        max_length=50,
        choices=ActionType.choices,
        verbose_name='Tipo de Acción'
    )

    # Referencia genérica al objeto afectado
    content_type = models.ForeignKey(
        ContentType,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        verbose_name='Tipo de Contenido'
    )
    object_id = models.CharField(max_length=100, null=True, blank=True)
    content_object = GenericForeignKey('content_type', 'object_id')

    # Hash para detectar modificaciones posteriores
    object_state_hash = models.CharField(
        max_length=64,
        null=True,
        blank=True,
        help_text="SHA256 de campos críticos para validar estado"
    )

    # Payload con datos para deshacer (JSONB)
    undo_payload = models.JSONField(
        verbose_name='Datos para Deshacer',
        help_text='Información necesaria para revertir la acción'
    )

    # Agrupación para acciones compuestas
    group_id = models.UUIDField(
        db_index=True,
        null=True,
        blank=True,
        verbose_name='ID de Grupo',
        help_text='Agrupa múltiples acciones relacionadas'
    )

    # Timestamps
    created_at = models.DateTimeField(
        auto_now_add=True,
        db_index=True,
        verbose_name='Fecha de Creación'
    )
    undone_at = models.DateTimeField(
        null=True,
        blank=True,
        db_index=True,
        verbose_name='Fecha de Deshacer'
    )

    # Tracking de rollback fallido
    rollback_status = models.JSONField(
        default=dict,
        blank=True,
        help_text="Estado del rollback: steps_completed, error, etc."
    )
    has_failed_rollback = models.BooleanField(
        default=False,
        db_index=True,
        verbose_name='Rollback Falló'
    )

    # Descripción amigable para UI
    description = models.CharField(
        max_length=255,
        verbose_name='Descripción',
        help_text='Descripción amigable para mostrar en la interfaz'
    )

    # Metadata adicional
    metadata = models.JSONField(
        default=dict,
        blank=True,
        verbose_name='Metadata'
    )

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'undone_at', 'created_at']),
            models.Index(fields=['group_id']),
        ]
        verbose_name = 'Acción Deshacible'
        verbose_name_plural = 'Acciones Deshacibles'

    @property
    def is_expired(self):
        """Calcula si la acción expiró (15 minutos)"""
        from django.utils import timezone
        from datetime import timedelta

        if not self.created_at:
            return False

        expiration_time = self.created_at + timedelta(minutes=15)
        return timezone.now() > expiration_time

    def __str__(self):
        return f"{self.description} - {self.user.username}"
