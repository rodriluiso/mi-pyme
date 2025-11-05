from rest_framework import serializers
from django.contrib.contenttypes.models import ContentType
from .models import (
    MovimientoStock,
    ValorizacionInventario,
    AjusteInventario,
    AjusteInventarioDetalle,
    OrdenProduccion,
    ConsumoMateriaPrima
)
from productos.models import Producto
from compras.models import MateriaPrima


class MovimientoStockSerializer(serializers.ModelSerializer):
    """Serializer para movimientos de stock"""

    nombre_item = serializers.ReadOnlyField()
    sku_item = serializers.ReadOnlyField()
    es_entrada = serializers.ReadOnlyField()
    es_salida = serializers.ReadOnlyField()
    tipo_item = serializers.SerializerMethodField()
    usuario_nombre = serializers.CharField(source='usuario.get_full_name', read_only=True)

    class Meta:
        model = MovimientoStock
        fields = [
            'id', 'fecha', 'tipo_movimiento', 'content_type', 'object_id',
            'cantidad', 'cantidad_anterior', 'cantidad_nueva',
            'costo_unitario', 'costo_total', 'motivo', 'numero_documento',
            'nombre_item', 'sku_item', 'es_entrada', 'es_salida', 'tipo_item',
            'usuario_nombre', 'venta', 'compra', 'orden_produccion', 'ajuste_inventario',
            'creado_en'
        ]
        read_only_fields = ['cantidad_nueva', 'costo_total', 'creado_en']

    def get_tipo_item(self, obj):
        """Determina si es producto o materia prima"""
        if obj.content_type.model == 'producto':
            return 'Producto'
        elif obj.content_type.model == 'materiaprima':
            return 'Materia Prima'
        return 'Desconocido'


class MovimientoStockCreateSerializer(serializers.ModelSerializer):
    """Serializer para crear movimientos de stock"""

    producto_id = serializers.IntegerField(required=False, allow_null=True)
    materia_prima_id = serializers.IntegerField(required=False, allow_null=True)

    class Meta:
        model = MovimientoStock
        fields = [
            'fecha', 'tipo_movimiento', 'cantidad', 'costo_unitario',
            'motivo', 'numero_documento', 'producto_id', 'materia_prima_id'
        ]

    def validate(self, data):
        """Validar que se especifique producto O materia prima"""
        producto_id = data.get('producto_id')
        materia_prima_id = data.get('materia_prima_id')

        if not producto_id and not materia_prima_id:
            raise serializers.ValidationError(
                "Debe especificar un producto o una materia prima"
            )

        if producto_id and materia_prima_id:
            raise serializers.ValidationError(
                "No puede especificar tanto producto como materia prima"
            )

        return data

    def create(self, validated_data):
        """Crear movimiento con el item correcto"""
        producto_id = validated_data.pop('producto_id', None)
        materia_prima_id = validated_data.pop('materia_prima_id', None)

        if producto_id:
            try:
                producto = Producto.objects.get(id=producto_id)
                validated_data['content_type'] = ContentType.objects.get_for_model(Producto)
                validated_data['object_id'] = producto_id
                validated_data['cantidad_anterior'] = producto.stock
            except Producto.DoesNotExist:
                raise serializers.ValidationError("Producto no encontrado")

        elif materia_prima_id:
            try:
                materia_prima = MateriaPrima.objects.get(id=materia_prima_id)
                validated_data['content_type'] = ContentType.objects.get_for_model(MateriaPrima)
                validated_data['object_id'] = materia_prima_id
                validated_data['cantidad_anterior'] = materia_prima.stock
            except MateriaPrima.DoesNotExist:
                raise serializers.ValidationError("Materia prima no encontrada")

        # Obtener usuario del contexto
        request = self.context.get('request')
        if request and request.user:
            validated_data['usuario'] = request.user

        return super().create(validated_data)


class AjusteInventarioDetalleSerializer(serializers.ModelSerializer):
    """Serializer para detalles de ajuste de inventario"""

    nombre_item = serializers.SerializerMethodField()
    sku_item = serializers.SerializerMethodField()
    tipo_item = serializers.SerializerMethodField()

    class Meta:
        model = AjusteInventarioDetalle
        fields = [
            'id', 'content_type', 'object_id', 'cantidad_sistema',
            'cantidad_fisica', 'diferencia', 'costo_unitario',
            'costo_total_diferencia', 'observaciones',
            'nombre_item', 'sku_item', 'tipo_item'
        ]
        read_only_fields = ['diferencia', 'costo_total_diferencia']

    def get_nombre_item(self, obj):
        return obj.item.nombre if hasattr(obj.item, 'nombre') else str(obj.item)

    def get_sku_item(self, obj):
        return obj.item.sku if hasattr(obj.item, 'sku') else None

    def get_tipo_item(self, obj):
        if obj.content_type.model == 'producto':
            return 'Producto'
        elif obj.content_type.model == 'materiaprima':
            return 'Materia Prima'
        return 'Desconocido'


class AjusteInventarioSerializer(serializers.ModelSerializer):
    """Serializer para ajustes de inventario"""

    detalles = AjusteInventarioDetalleSerializer(many=True, read_only=True)
    usuario_nombre = serializers.CharField(source='usuario.get_full_name', read_only=True)
    total_diferencia_valor = serializers.SerializerMethodField()
    cantidad_items = serializers.SerializerMethodField()

    class Meta:
        model = AjusteInventario
        fields = [
            'id', 'numero', 'fecha', 'tipo_ajuste', 'descripcion',
            'observaciones', 'procesado', 'fecha_procesado',
            'usuario_nombre', 'detalles', 'total_diferencia_valor',
            'cantidad_items', 'creado_en'
        ]
        read_only_fields = ['numero', 'procesado', 'fecha_procesado', 'creado_en']

    def get_total_diferencia_valor(self, obj):
        """Calcula el valor total de las diferencias"""
        return sum(detalle.costo_total_diferencia for detalle in obj.detalles.all())

    def get_cantidad_items(self, obj):
        """Cuenta la cantidad de items en el ajuste"""
        return obj.detalles.count()

    def create(self, validated_data):
        """Crear ajuste con número automático"""
        import datetime
        hoy = datetime.date.today()
        numero = f"AJ{hoy.strftime('%Y%m%d')}-{AjusteInventario.objects.filter(fecha=hoy).count() + 1:03d}"

        validated_data['numero'] = numero

        # Obtener usuario del contexto
        request = self.context.get('request')
        if request and request.user:
            validated_data['usuario'] = request.user

        return super().create(validated_data)


class ConsumoMateriaPrimaSerializer(serializers.ModelSerializer):
    """Serializer para consumos de materia prima"""

    materia_prima_nombre = serializers.CharField(source='materia_prima.nombre', read_only=True)
    materia_prima_sku = serializers.CharField(source='materia_prima.sku', read_only=True)
    diferencia_planificado_real = serializers.SerializerMethodField()
    porcentaje_consumo = serializers.SerializerMethodField()

    class Meta:
        model = ConsumoMateriaPrima
        fields = [
            'id', 'materia_prima', 'cantidad_planificada', 'cantidad_consumida',
            'costo_unitario', 'costo_total_planificado', 'costo_total_real',
            'consumido', 'fecha_consumo', 'materia_prima_nombre', 'materia_prima_sku',
            'diferencia_planificado_real', 'porcentaje_consumo'
        ]
        read_only_fields = [
            'costo_total_planificado', 'costo_total_real', 'fecha_consumo'
        ]

    def get_diferencia_planificado_real(self, obj):
        """Diferencia entre lo planificado y lo real"""
        return obj.cantidad_consumida - obj.cantidad_planificada

    def get_porcentaje_consumo(self, obj):
        """Porcentaje de consumo vs planificado"""
        if obj.cantidad_planificada == 0:
            return 0
        return (obj.cantidad_consumida / obj.cantidad_planificada) * 100


class OrdenProduccionSerializer(serializers.ModelSerializer):
    """Serializer para órdenes de producción"""

    producto_nombre = serializers.CharField(source='producto.nombre', read_only=True)
    producto_sku = serializers.CharField(source='producto.sku', read_only=True)
    responsable_nombre = serializers.CharField(source='responsable.get_full_name', read_only=True)
    consumos_materia_prima = ConsumoMateriaPrimaSerializer(many=True, read_only=True)

    porcentaje_avance = serializers.ReadOnlyField()
    costo_unitario_planificado = serializers.ReadOnlyField()
    costo_unitario_real = serializers.ReadOnlyField()

    dias_planificados = serializers.SerializerMethodField()
    dias_reales = serializers.SerializerMethodField()
    estado_color = serializers.SerializerMethodField()

    class Meta:
        model = OrdenProduccion
        fields = [
            'id', 'numero', 'fecha_creacion', 'fecha_inicio_planificada',
            'fecha_fin_planificada', 'fecha_inicio_real', 'fecha_fin_real',
            'producto', 'producto_nombre', 'producto_sku', 'cantidad_planificada',
            'cantidad_producida', 'estado', 'costo_materias_primas',
            'costo_mano_obra', 'costo_gastos_generales', 'costo_total',
            'descripcion', 'observaciones', 'responsable', 'responsable_nombre',
            'consumos_materia_prima', 'porcentaje_avance', 'costo_unitario_planificado',
            'costo_unitario_real', 'dias_planificados', 'dias_reales', 'estado_color',
            'creado_en'
        ]
        read_only_fields = ['numero', 'creado_en']

    def get_dias_planificados(self, obj):
        """Días planificados para la producción"""
        if obj.fecha_fin_planificada and obj.fecha_inicio_planificada:
            return (obj.fecha_fin_planificada - obj.fecha_inicio_planificada).days
        return 0

    def get_dias_reales(self, obj):
        """Días reales de producción"""
        if obj.fecha_fin_real and obj.fecha_inicio_real:
            return (obj.fecha_fin_real.date() - obj.fecha_inicio_real.date()).days
        elif obj.fecha_inicio_real and obj.estado == 'EN_PROCESO':
            from datetime import date
            return (date.today() - obj.fecha_inicio_real.date()).days
        return 0

    def get_estado_color(self, obj):
        """Color para mostrar el estado"""
        colores = {
            'PLANIFICADA': 'blue',
            'EN_PROCESO': 'yellow',
            'TERMINADA': 'green',
            'CANCELADA': 'red'
        }
        return colores.get(obj.estado, 'gray')

    def create(self, validated_data):
        """Crear orden con número automático"""
        import datetime
        hoy = datetime.date.today()
        numero = f"OP{hoy.strftime('%Y%m%d')}-{OrdenProduccion.objects.filter(fecha_creacion=hoy).count() + 1:03d}"

        validated_data['numero'] = numero

        # Obtener usuario del contexto
        request = self.context.get('request')
        if request and request.user:
            validated_data['responsable'] = request.user

        return super().create(validated_data)


class ResumenInventarioSerializer(serializers.Serializer):
    """Serializer para resumen de inventario"""

    total_productos = serializers.IntegerField()
    total_materias_primas = serializers.IntegerField()
    valor_total_inventario = serializers.DecimalField(max_digits=15, decimal_places=2)
    movimientos_mes_actual = serializers.IntegerField()
    alertas_stock_bajo = serializers.IntegerField()
    productos_sin_movimiento = serializers.IntegerField()

    # Top productos por valor
    top_productos_valor = serializers.ListField(child=serializers.DictField())

    # Movimientos recientes
    movimientos_recientes = MovimientoStockSerializer(many=True, read_only=True)


class ValorizacionInventarioSerializer(serializers.ModelSerializer):
    """Serializer para lotes de valorización"""

    nombre_item = serializers.SerializerMethodField()
    sku_item = serializers.SerializerMethodField()
    tipo_item = serializers.SerializerMethodField()
    porcentaje_consumido = serializers.SerializerMethodField()

    class Meta:
        model = ValorizacionInventario
        fields = [
            'id', 'lote_entrada', 'fecha_entrada', 'cantidad_inicial',
            'cantidad_actual', 'costo_unitario', 'costo_total_inicial',
            'costo_total_actual', 'activo', 'nombre_item', 'sku_item',
            'tipo_item', 'porcentaje_consumido', 'creado_en'
        ]

    def get_nombre_item(self, obj):
        return obj.item.nombre if hasattr(obj.item, 'nombre') else str(obj.item)

    def get_sku_item(self, obj):
        return obj.item.sku if hasattr(obj.item, 'sku') else None

    def get_tipo_item(self, obj):
        if obj.content_type.model == 'producto':
            return 'Producto'
        elif obj.content_type.model == 'materiaprima':
            return 'Materia Prima'
        return 'Desconocido'

    def get_porcentaje_consumido(self, obj):
        """Porcentaje consumido del lote"""
        if obj.cantidad_inicial == 0:
            return 0
        consumido = obj.cantidad_inicial - obj.cantidad_actual
        return (consumido / obj.cantidad_inicial) * 100