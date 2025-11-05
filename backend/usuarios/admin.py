from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import Usuario, LogAcceso, ConfiguracionSistema


@admin.register(Usuario)
class UsuarioAdmin(UserAdmin):
    """Admin para el modelo Usuario personalizado"""

    list_display = (
        'username', 'email', 'first_name', 'last_name',
        'nivel_acceso', 'cargo', 'activo', 'ultima_actividad'
    )

    list_filter = (
        'nivel_acceso', 'activo', 'is_active', 'is_staff',
        'date_joined', 'ultima_actividad'
    )

    search_fields = (
        'username', 'first_name', 'last_name', 'email', 'cargo'
    )

    ordering = ('-fecha_creacion',)

    # Campos a mostrar en el formulario de edición
    fieldsets = UserAdmin.fieldsets + (
        ('Información Adicional', {
            'fields': (
                'nivel_acceso', 'telefono', 'cargo', 'fecha_ingreso',
                'activo', 'ultima_actividad', 'creado_por'
            )
        }),
    )

    # Campos a mostrar en el formulario de creación
    add_fieldsets = UserAdmin.add_fieldsets + (
        ('Información Adicional', {
            'fields': (
                'nivel_acceso', 'telefono', 'cargo', 'fecha_ingreso',
                'activo'
            )
        }),
    )

    readonly_fields = ('fecha_creacion', 'fecha_modificacion', 'ultima_actividad')


@admin.register(LogAcceso)
class LogAccesoAdmin(admin.ModelAdmin):
    """Admin para logs de acceso"""

    list_display = (
        'usuario', 'fecha_acceso', 'accion', 'modulo',
        'ip_address', 'exitoso'
    )

    list_filter = (
        'exitoso', 'modulo', 'fecha_acceso'
    )

    search_fields = (
        'usuario__username', 'accion', 'ip_address'
    )

    ordering = ('-fecha_acceso',)

    readonly_fields = (
        'usuario', 'fecha_acceso', 'ip_address', 'user_agent',
        'accion', 'modulo', 'exitoso'
    )

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(ConfiguracionSistema)
class ConfiguracionSistemaAdmin(admin.ModelAdmin):
    """Admin para configuración del sistema"""

    list_display = (
        'nombre_empresa', 'max_usuarios', 'requiere_cambio_password',
        'fecha_modificacion'
    )

    fieldsets = (
        ('Información de la Empresa', {
            'fields': ('nombre_empresa', 'logo_empresa')
        }),
        ('Configuración de Usuarios', {
            'fields': (
                'max_usuarios', 'requiere_cambio_password',
                'dias_vigencia_password'
            )
        }),
        ('Seguridad', {
            'fields': (
                'intentos_login_max', 'session_timeout'
            )
        }),
    )

    readonly_fields = ('fecha_creacion', 'fecha_modificacion')

    def has_add_permission(self, request):
        # Solo permitir una configuración
        return not ConfiguracionSistema.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False
