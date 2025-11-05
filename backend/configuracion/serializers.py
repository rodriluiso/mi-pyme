from rest_framework import serializers
from .models import ConfiguracionEmpresa


class ConfiguracionEmpresaSerializer(serializers.ModelSerializer):
    actualizado_por_nombre = serializers.CharField(
        source='actualizado_por.get_full_name',
        read_only=True
    )

    class Meta:
        model = ConfiguracionEmpresa
        fields = [
            'id',
            'razon_social',
            'nombre_fantasia',
            'cuit',
            'condicion_iva',
            'inicio_actividades',
            'domicilio_fiscal',
            'localidad',
            'provincia',
            'codigo_postal',
            'telefono',
            'email',
            'sitio_web',
            'punto_venta',
            'ingresos_brutos',
            'cai',
            'cai_vencimiento',
            'certificado_afip',
            'clave_privada_afip',
            'logo',
            'pie_remito',
            'pie_factura',
            'banco_nombre',
            'banco_cbu',
            'banco_alias',
            'creado_en',
            'actualizado_en',
            'actualizado_por',
            'actualizado_por_nombre',
        ]
        read_only_fields = ['id', 'creado_en', 'actualizado_en', 'actualizado_por']

    def create(self, validated_data):
        # Verificar que no exista ya una configuración
        if ConfiguracionEmpresa.objects.exists():
            raise serializers.ValidationError(
                'Ya existe una configuración de empresa. Use PUT/PATCH para actualizar.'
            )
        return super().create(validated_data)


class ConfiguracionEmpresaBasicaSerializer(serializers.ModelSerializer):
    """
    Serializer simplificado para obtener datos básicos sin información sensible
    """
    class Meta:
        model = ConfiguracionEmpresa
        fields = [
            'razon_social',
            'nombre_fantasia',
            'cuit',
            'condicion_iva',
            'domicilio_fiscal',
            'localidad',
            'provincia',
            'codigo_postal',
            'telefono',
            'email',
            'sitio_web',
            'logo',
        ]
