from rest_framework import serializers
from .models import Cliente, SucursalCliente


class SucursalClienteSerializer(serializers.ModelSerializer):
    nombre_completo = serializers.ReadOnlyField()
    direccion_completa = serializers.ReadOnlyField()

    class Meta:
        model = SucursalCliente
        fields = [
            'id', 'nombre_sucursal', 'codigo_sucursal', 'contacto_responsable',
            'telefono', 'correo', 'direccion', 'localidad', 'codigo_postal',
            'horario_entrega', 'observaciones', 'activo', 'nombre_completo',
            'direccion_completa', 'fecha_creacion'
        ]


class ClienteSerializer(serializers.ModelSerializer):
    saldo = serializers.ReadOnlyField()
    sucursales = SucursalClienteSerializer(many=True, read_only=True)
    total_sucursales = serializers.SerializerMethodField()
    nombre_para_factura = serializers.ReadOnlyField()

    # Campos de compatibilidad
    nombre = serializers.CharField(source='nombre_fantasia')
    direccion = serializers.CharField(source='direccion_fiscal', required=False, allow_blank=True)
    localidad = serializers.CharField(source='localidad_fiscal', required=False, allow_blank=True)
    telefono = serializers.CharField(source='telefono_principal', required=False, allow_blank=True)
    correo = serializers.EmailField(source='correo_principal', required=False, allow_blank=True)

    class Meta:
        model = Cliente
        fields = [
            'id', 'nombre_fantasia', 'razon_social', 'identificacion', 'telefono_principal',
            'correo_principal', 'direccion_fiscal', 'localidad_fiscal',
            'activo', 'fecha_creacion', 'saldo', 'sucursales', 'total_sucursales',
            'nombre_para_factura',
            # Campos de compatibilidad
            'nombre', 'direccion', 'localidad', 'telefono', 'correo'
        ]
        read_only_fields = ('saldo', 'total_sucursales', 'fecha_creacion', 'nombre_para_factura')

    def get_total_sucursales(self, obj):
        """Número total de sucursales activas"""
        return obj.sucursales.filter(activo=True).count()


class ClienteListSerializer(serializers.ModelSerializer):
    """Serializer simplificado para listados"""
    saldo = serializers.ReadOnlyField()
    total_sucursales = serializers.SerializerMethodField()
    nombre_para_factura = serializers.ReadOnlyField()

    # Compatibilidad
    nombre = serializers.CharField(source='nombre_fantasia')

    class Meta:
        model = Cliente
        fields = [
            'id', 'nombre_fantasia', 'razon_social', 'identificacion', 'activo',
            'saldo', 'total_sucursales', 'nombre', 'nombre_para_factura'
        ]

    def get_total_sucursales(self, obj):
        return obj.sucursales.filter(activo=True).count()
