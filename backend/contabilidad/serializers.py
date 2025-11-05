from rest_framework import serializers
from decimal import Decimal
from .models import (
    PlanCuentas,
    AsientoContable,
    AsientoContableDetalle,
    BalanceGeneral,
    BalanceGeneralDetalle,
    EstadoResultados,
    EstadoResultadosDetalle
)


class PlanCuentasSerializer(serializers.ModelSerializer):
    """Serializer para el plan de cuentas"""

    codigo_completo = serializers.ReadOnlyField()
    saldo_actual = serializers.SerializerMethodField()
    tiene_subcuentas = serializers.SerializerMethodField()

    class Meta:
        model = PlanCuentas
        fields = [
            'id', 'codigo', 'nombre', 'descripcion', 'tipo_cuenta',
            'subtipo_cuenta', 'cuenta_padre', 'nivel', 'acepta_movimientos',
            'activa', 'codigo_completo', 'saldo_actual', 'tiene_subcuentas'
        ]

    def get_saldo_actual(self, obj):
        """Obtiene el saldo actual de la cuenta"""
        return float(obj.get_saldo_actual())

    def get_tiene_subcuentas(self, obj):
        """Verifica si la cuenta tiene subcuentas"""
        return obj.subcuentas.filter(activa=True).exists()


class AsientoContableDetalleSerializer(serializers.ModelSerializer):
    """Serializer para detalles de asientos contables"""

    cuenta_codigo = serializers.CharField(source='cuenta.codigo', read_only=True)
    cuenta_nombre = serializers.CharField(source='cuenta.nombre', read_only=True)

    class Meta:
        model = AsientoContableDetalle
        fields = [
            'id', 'cuenta', 'debe', 'haber', 'detalle',
            'cuenta_codigo', 'cuenta_nombre'
        ]

    def validate(self, data):
        """Validar que no tenga debe y haber simultáneamente"""
        debe = data.get('debe', Decimal('0'))
        haber = data.get('haber', Decimal('0'))

        if debe > 0 and haber > 0:
            raise serializers.ValidationError(
                "No puede tener debe y haber simultáneamente"
            )

        if debe == 0 and haber == 0:
            raise serializers.ValidationError(
                "Debe tener debe o haber"
            )

        return data


class AsientoContableSerializer(serializers.ModelSerializer):
    """Serializer para asientos contables"""

    detalles = AsientoContableDetalleSerializer(many=True, read_only=True)
    total_debe = serializers.ReadOnlyField()
    total_haber = serializers.ReadOnlyField()
    esta_balanceado = serializers.ReadOnlyField()
    usuario_nombre = serializers.CharField(source='usuario.get_full_name', read_only=True)

    class Meta:
        model = AsientoContable
        fields = [
            'id', 'numero', 'fecha', 'concepto', 'venta', 'compra',
            'movimiento_financiero', 'procesado', 'usuario', 'usuario_nombre',
            'detalles', 'total_debe', 'total_haber', 'esta_balanceado',
            'creado_en'
        ]
        read_only_fields = ['numero', 'procesado', 'creado_en']

    def create(self, validated_data):
        """Crear asiento con número automático"""
        import datetime
        hoy = datetime.date.today()
        numero = f"AST{hoy.strftime('%Y%m%d')}-{AsientoContable.objects.filter(fecha=hoy).count() + 1:04d}"

        validated_data['numero'] = numero

        # Obtener usuario del contexto
        request = self.context.get('request')
        if request and request.user:
            validated_data['usuario'] = request.user

        return super().create(validated_data)


class BalanceGeneralDetalleSerializer(serializers.ModelSerializer):
    """Serializer para detalles del balance general"""

    cuenta_codigo = serializers.CharField(source='cuenta.codigo', read_only=True)
    cuenta_nombre = serializers.CharField(source='cuenta.nombre', read_only=True)
    tipo_cuenta = serializers.CharField(source='cuenta.tipo_cuenta', read_only=True)
    subtipo_cuenta = serializers.CharField(source='cuenta.subtipo_cuenta', read_only=True)

    class Meta:
        model = BalanceGeneralDetalle
        fields = [
            'id', 'cuenta', 'saldo', 'cuenta_codigo', 'cuenta_nombre',
            'tipo_cuenta', 'subtipo_cuenta'
        ]


class BalanceGeneralSerializer(serializers.ModelSerializer):
    """Serializer para balance general"""

    detalles = BalanceGeneralDetalleSerializer(many=True, read_only=True)
    usuario_nombre = serializers.CharField(source='usuario.get_full_name', read_only=True)

    # Detalles agrupados para mejor presentación
    activos = serializers.SerializerMethodField()
    pasivos = serializers.SerializerMethodField()
    patrimonio = serializers.SerializerMethodField()

    class Meta:
        model = BalanceGeneral
        fields = [
            'id', 'fecha_corte', 'fecha_generacion', 'total_activo',
            'total_pasivo', 'total_patrimonio', 'usuario_nombre',
            'detalles', 'activos', 'pasivos', 'patrimonio'
        ]

    def get_activos(self, obj):
        """Obtiene solo los activos"""
        activos = obj.detalles.filter(cuenta__tipo_cuenta='ACTIVO')
        return BalanceGeneralDetalleSerializer(activos, many=True).data

    def get_pasivos(self, obj):
        """Obtiene solo los pasivos"""
        pasivos = obj.detalles.filter(cuenta__tipo_cuenta='PASIVO')
        return BalanceGeneralDetalleSerializer(pasivos, many=True).data

    def get_patrimonio(self, obj):
        """Obtiene solo el patrimonio"""
        patrimonio = obj.detalles.filter(cuenta__tipo_cuenta='PATRIMONIO')
        return BalanceGeneralDetalleSerializer(patrimonio, many=True).data


class EstadoResultadosDetalleSerializer(serializers.ModelSerializer):
    """Serializer para detalles del estado de resultados"""

    cuenta_codigo = serializers.CharField(source='cuenta.codigo', read_only=True)
    cuenta_nombre = serializers.CharField(source='cuenta.nombre', read_only=True)
    tipo_cuenta = serializers.CharField(source='cuenta.tipo_cuenta', read_only=True)

    class Meta:
        model = EstadoResultadosDetalle
        fields = [
            'id', 'cuenta', 'importe', 'cuenta_codigo', 'cuenta_nombre', 'tipo_cuenta'
        ]


class EstadoResultadosSerializer(serializers.ModelSerializer):
    """Serializer para estado de resultados"""

    detalles = EstadoResultadosDetalleSerializer(many=True, read_only=True)
    usuario_nombre = serializers.CharField(source='usuario.get_full_name', read_only=True)

    # Detalles agrupados
    ingresos = serializers.SerializerMethodField()
    costos = serializers.SerializerMethodField()
    gastos = serializers.SerializerMethodField()

    # Indicadores calculados
    margen_bruto = serializers.SerializerMethodField()
    margen_neto = serializers.SerializerMethodField()

    class Meta:
        model = EstadoResultados
        fields = [
            'id', 'fecha_desde', 'fecha_hasta', 'fecha_generacion',
            'total_ingresos', 'total_costos', 'total_gastos',
            'utilidad_bruta', 'utilidad_neta', 'usuario_nombre',
            'detalles', 'ingresos', 'costos', 'gastos',
            'margen_bruto', 'margen_neto'
        ]

    def get_ingresos(self, obj):
        """Obtiene solo los ingresos"""
        ingresos = obj.detalles.filter(cuenta__tipo_cuenta='INGRESO')
        return EstadoResultadosDetalleSerializer(ingresos, many=True).data

    def get_costos(self, obj):
        """Obtiene solo los costos"""
        costos = obj.detalles.filter(cuenta__tipo_cuenta='COSTO')
        return EstadoResultadosDetalleSerializer(costos, many=True).data

    def get_gastos(self, obj):
        """Obtiene solo los gastos"""
        gastos = obj.detalles.filter(cuenta__tipo_cuenta='GASTO')
        return EstadoResultadosDetalleSerializer(gastos, many=True).data

    def get_margen_bruto(self, obj):
        """Calcula el margen bruto porcentual"""
        if obj.total_ingresos == 0:
            return 0
        return round((obj.utilidad_bruta / obj.total_ingresos) * 100, 2)

    def get_margen_neto(self, obj):
        """Calcula el margen neto porcentual"""
        if obj.total_ingresos == 0:
            return 0
        return round((obj.utilidad_neta / obj.total_ingresos) * 100, 2)


class ReporteFinancieroResumenSerializer(serializers.Serializer):
    """Serializer para resumen financiero general"""

    # Balance actual
    total_activos = serializers.DecimalField(max_digits=15, decimal_places=2)
    total_pasivos = serializers.DecimalField(max_digits=15, decimal_places=2)
    patrimonio_neto = serializers.DecimalField(max_digits=15, decimal_places=2)

    # Resultados del período
    ingresos_periodo = serializers.DecimalField(max_digits=15, decimal_places=2)
    gastos_periodo = serializers.DecimalField(max_digits=15, decimal_places=2)
    utilidad_periodo = serializers.DecimalField(max_digits=15, decimal_places=2)

    # Indicadores
    ratio_liquidez = serializers.DecimalField(max_digits=5, decimal_places=2)
    ratio_endeudamiento = serializers.DecimalField(max_digits=5, decimal_places=2)
    margen_utilidad = serializers.DecimalField(max_digits=5, decimal_places=2)

    # Evolución
    crecimiento_ingresos = serializers.DecimalField(max_digits=5, decimal_places=2)
    variacion_patrimonio = serializers.DecimalField(max_digits=5, decimal_places=2)


class GenerarReporteSerializer(serializers.Serializer):
    """Serializer para generar reportes"""

    tipo_reporte = serializers.ChoiceField(
        choices=[
            ('balance', 'Balance General'),
            ('resultados', 'Estado de Resultados'),
            ('resumen', 'Resumen Financiero')
        ]
    )
    fecha_desde = serializers.DateField(required=False)
    fecha_hasta = serializers.DateField(required=False)
    fecha_corte = serializers.DateField(required=False)

    def validate(self, data):
        """Validar fechas según tipo de reporte"""
        tipo_reporte = data.get('tipo_reporte')

        if tipo_reporte == 'balance':
            if not data.get('fecha_corte'):
                raise serializers.ValidationError(
                    "Balance General requiere fecha_corte"
                )
        elif tipo_reporte == 'resultados':
            if not data.get('fecha_desde') or not data.get('fecha_hasta'):
                raise serializers.ValidationError(
                    "Estado de Resultados requiere fecha_desde y fecha_hasta"
                )
            if data.get('fecha_desde') > data.get('fecha_hasta'):
                raise serializers.ValidationError(
                    "fecha_desde debe ser menor que fecha_hasta"
                )

        return data