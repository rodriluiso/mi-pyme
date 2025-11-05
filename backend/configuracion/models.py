from django.db import models
from django.core.exceptions import ValidationError
from encrypted_model_fields.fields import EncryptedCharField, EncryptedTextField


class ConfiguracionEmpresa(models.Model):
    """
    Configuración global de la empresa.
    Solo debe existir un registro de este modelo (Singleton).
    """

    # Datos básicos
    razon_social = models.CharField(
        max_length=200,
        verbose_name="Razón Social",
        help_text="Nombre legal completo de la empresa"
    )
    nombre_fantasia = models.CharField(
        max_length=200,
        blank=True,
        verbose_name="Nombre de Fantasía",
        help_text="Nombre comercial de la empresa"
    )

    # Identificación fiscal
    cuit = models.CharField(
        max_length=13,
        verbose_name="CUIT",
        help_text="XX-XXXXXXXX-X"
    )
    condicion_iva = models.CharField(
        max_length=50,
        choices=[
            ('responsable_inscripto', 'Responsable Inscripto'),
            ('monotributo', 'Monotributo'),
            ('exento', 'Exento'),
            ('consumidor_final', 'Consumidor Final'),
        ],
        default='responsable_inscripto',
        verbose_name="Condición ante IVA"
    )
    inicio_actividades = models.DateField(
        verbose_name="Inicio de Actividades",
        null=True,
        blank=True
    )

    # Domicilio fiscal
    domicilio_fiscal = models.CharField(
        max_length=200,
        verbose_name="Domicilio Fiscal"
    )
    localidad = models.CharField(
        max_length=100,
        verbose_name="Localidad"
    )
    provincia = models.CharField(
        max_length=100,
        verbose_name="Provincia"
    )
    codigo_postal = models.CharField(
        max_length=10,
        verbose_name="Código Postal"
    )

    # Contacto
    telefono = models.CharField(
        max_length=50,
        blank=True,
        verbose_name="Teléfono"
    )
    email = models.EmailField(
        blank=True,
        verbose_name="Email"
    )
    sitio_web = models.URLField(
        blank=True,
        verbose_name="Sitio Web"
    )

    # Datos para facturación electrónica (AFIP)
    punto_venta = models.IntegerField(
        default=1,
        verbose_name="Punto de Venta",
        help_text="Punto de venta para facturación electrónica"
    )
    ingresos_brutos = EncryptedCharField(
        max_length=50,
        blank=True,
        verbose_name="Ingresos Brutos",
        help_text="Número de Ingresos Brutos (encriptado)"
    )
    cai = EncryptedCharField(
        max_length=50,
        blank=True,
        verbose_name="CAI",
        help_text="Código de Autorización de Impresión (encriptado)"
    )
    cai_vencimiento = models.DateField(
        blank=True,
        null=True,
        verbose_name="Vencimiento CAI",
        help_text="Fecha de vencimiento del CAI"
    )
    certificado_afip = models.FileField(
        upload_to='certificados/',
        blank=True,
        null=True,
        verbose_name="Certificado AFIP",
        help_text="Archivo .crt del certificado digital"
    )
    clave_privada_afip = models.FileField(
        upload_to='certificados/',
        blank=True,
        null=True,
        verbose_name="Clave Privada AFIP",
        help_text="Archivo .key de la clave privada (proteger con permisos del sistema)"
    )

    # Logo
    logo = models.ImageField(
        upload_to='empresa/',
        blank=True,
        null=True,
        verbose_name="Logo de la Empresa",
        help_text="Logo para documentos y sistema"
    )

    # Configuración de documentos
    pie_remito = models.TextField(
        blank=True,
        verbose_name="Pie de Remito",
        help_text="Texto que aparece al pie de los remitos"
    )
    pie_factura = models.TextField(
        blank=True,
        verbose_name="Pie de Factura",
        help_text="Texto que aparece al pie de las facturas"
    )

    # Datos bancarios
    banco_nombre = models.CharField(
        max_length=100,
        blank=True,
        verbose_name="Banco"
    )
    banco_cbu = EncryptedCharField(
        max_length=22,
        blank=True,
        verbose_name="CBU",
        help_text="CBU bancario (encriptado)"
    )
    banco_alias = models.CharField(
        max_length=50,
        blank=True,
        verbose_name="Alias CBU"
    )

    # Metadata
    creado_en = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)
    actualizado_por = models.ForeignKey(
        'usuarios.Usuario',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='configuraciones_actualizadas'
    )

    class Meta:
        verbose_name = "Configuración de Empresa"
        verbose_name_plural = "Configuración de Empresa"

    def __str__(self):
        return self.razon_social

    def save(self, *args, **kwargs):
        """
        Asegurar que solo exista una configuración (Singleton pattern)
        """
        if not self.pk and ConfiguracionEmpresa.objects.exists():
            raise ValidationError(
                'Ya existe una configuración de empresa. '
                'Solo puede existir un registro de configuración.'
            )
        return super().save(*args, **kwargs)

    @classmethod
    def get_configuracion(cls):
        """
        Obtener la configuración de empresa (crea una por defecto si no existe)
        """
        configuracion, created = cls.objects.get_or_create(
            pk=1,
            defaults={
                'razon_social': 'Mi Empresa S.A.',
                'cuit': '00-00000000-0',
                'domicilio_fiscal': 'Calle 123',
                'localidad': 'Ciudad',
                'provincia': 'Provincia',
                'codigo_postal': '0000'
            }
        )
        return configuracion
