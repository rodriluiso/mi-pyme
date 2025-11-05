from django.contrib import admin
from .models import ConfiguracionEmpresa


@admin.register(ConfiguracionEmpresa)
class ConfiguracionEmpresaAdmin(admin.ModelAdmin):
    """
    Administración de la configuración de empresa
    """
    list_display = [
        'razon_social',
        'cuit',
        'condicion_iva',
        'localidad',
        'actualizado_en'
    ]

    fieldsets = (
        ('Datos Básicos', {
            'fields': ('razon_social', 'nombre_fantasia', 'logo')
        }),
        ('Identificación Fiscal', {
            'fields': ('cuit', 'condicion_iva', 'inicio_actividades', 'ingresos_brutos')
        }),
        ('Domicilio', {
            'fields': (
                'domicilio_fiscal',
                'localidad',
                'provincia',
                'codigo_postal'
            )
        }),
        ('Contacto', {
            'fields': ('telefono', 'email', 'sitio_web')
        }),
        ('Facturación Electrónica (AFIP)', {
            'fields': (
                'punto_venta',
                'cai',
                'cai_vencimiento',
                'certificado_afip',
                'clave_privada_afip'
            ),
            'classes': ('collapse',)
        }),
        ('Configuración de Documentos', {
            'fields': ('pie_remito', 'pie_factura')
        }),
        ('Datos Bancarios', {
            'fields': ('banco_nombre', 'banco_cbu', 'banco_alias'),
            'classes': ('collapse',)
        }),
        ('Metadata', {
            'fields': ('actualizado_por', 'actualizado_en'),
            'classes': ('collapse',)
        }),
    )

    readonly_fields = ['actualizado_en', 'creado_en']

    def has_add_permission(self, request):
        """
        Solo permitir crear si no existe configuración
        """
        return not ConfiguracionEmpresa.objects.exists()

    def has_delete_permission(self, request, obj=None):
        """
        No permitir eliminar la configuración
        """
        return False

    def save_model(self, request, obj, form, change):
        """
        Guardar quién modificó la configuración
        """
        obj.actualizado_por = request.user
        super().save_model(request, obj, form, change)
