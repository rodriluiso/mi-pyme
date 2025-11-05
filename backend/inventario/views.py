from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Q, Sum, Count, F, Avg
from django.contrib.contenttypes.models import ContentType
from datetime import date, datetime, timedelta
from decimal import Decimal

from .models import (
    MovimientoStock,
    ValorizacionInventario,
    AjusteInventario,
    AjusteInventarioDetalle,
    OrdenProduccion,
    ConsumoMateriaPrima
)
from .serializers import (
    MovimientoStockSerializer,
    MovimientoStockCreateSerializer,
    AjusteInventarioSerializer,
    AjusteInventarioDetalleSerializer,
    OrdenProduccionSerializer,
    ConsumoMateriaPrimaSerializer,
    ResumenInventarioSerializer,
    ValorizacionInventarioSerializer
)
from productos.models import Producto
from compras.models import MateriaPrima


class MovimientoStockViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    """ViewSet para gestión de movimientos de stock"""

    queryset = MovimientoStock.objects.select_related(
        'usuario', 'venta', 'compra', 'orden_produccion', 'ajuste_inventario'
    ).all()
    serializer_class = MovimientoStockSerializer

    def get_serializer_class(self):
        if self.action == 'create':
            return MovimientoStockCreateSerializer
        return MovimientoStockSerializer

    def get_queryset(self):
        queryset = super().get_queryset()

        # Filtros
        producto_id = self.request.query_params.get('producto_id')
        materia_prima_id = self.request.query_params.get('materia_prima_id')
        tipo_movimiento = self.request.query_params.get('tipo_movimiento')
        fecha_desde = self.request.query_params.get('fecha_desde')
        fecha_hasta = self.request.query_params.get('fecha_hasta')

        if producto_id:
            content_type = ContentType.objects.get_for_model(Producto)
            queryset = queryset.filter(content_type=content_type, object_id=producto_id)

        if materia_prima_id:
            content_type = ContentType.objects.get_for_model(MateriaPrima)
            queryset = queryset.filter(content_type=content_type, object_id=materia_prima_id)

        if tipo_movimiento:
            queryset = queryset.filter(tipo_movimiento=tipo_movimiento)

        if fecha_desde:
            queryset = queryset.filter(fecha__date__gte=fecha_desde)

        if fecha_hasta:
            queryset = queryset.filter(fecha__date__lte=fecha_hasta)

        return queryset

    @action(detail=False, methods=['get'])
    def resumen(self, request):
        """Resumen general de inventario y movimientos"""

        # Contadores básicos
        total_productos = Producto.objects.count()
        total_materias_primas = MateriaPrima.objects.count()

        # Movimientos del mes actual
        hoy = date.today()
        inicio_mes = hoy.replace(day=1)
        movimientos_mes = MovimientoStock.objects.filter(fecha__date__gte=inicio_mes).count()

        # Alertas de stock bajo
        productos_stock_bajo = Producto.productos_con_stock_bajo().count()
        materias_stock_bajo = MateriaPrima.materias_primas_con_stock_bajo().count()
        alertas_stock_bajo = productos_stock_bajo + materias_stock_bajo

        # Productos sin movimiento en los últimos 30 días
        fecha_limite = hoy - timedelta(days=30)
        productos_con_movimiento = MovimientoStock.objects.filter(
            fecha__date__gte=fecha_limite,
            content_type=ContentType.objects.get_for_model(Producto)
        ).values_list('object_id', flat=True).distinct()

        productos_sin_movimiento = Producto.objects.exclude(
            id__in=productos_con_movimiento
        ).count()

        # Valor total del inventario (aproximado)
        valor_productos = Producto.objects.aggregate(
            total=Sum(F('stock') * F('precio'))
        )['total'] or Decimal('0')

        # Top 10 productos por valor
        top_productos = Producto.objects.annotate(
            valor_stock=F('stock') * F('precio')
        ).filter(stock__gt=0).order_by('-valor_stock')[:10]

        top_productos_data = [
            {
                'id': p.id,
                'nombre': p.nombre,
                'sku': p.sku,
                'stock': float(p.stock),
                'precio': float(p.precio),
                'valor_total': float(p.valor_stock)
            }
            for p in top_productos
        ]

        # Movimientos recientes (últimos 20)
        movimientos_recientes = MovimientoStock.objects.select_related(
            'usuario'
        ).order_by('-fecha')[:20]

        data = {
            'total_productos': total_productos,
            'total_materias_primas': total_materias_primas,
            'valor_total_inventario': valor_productos,
            'movimientos_mes_actual': movimientos_mes,
            'alertas_stock_bajo': alertas_stock_bajo,
            'productos_sin_movimiento': productos_sin_movimiento,
            'top_productos_valor': top_productos_data,
            'movimientos_recientes': MovimientoStockSerializer(
                movimientos_recientes, many=True
            ).data
        }

        return Response(data)

    @action(detail=False, methods=['get'])
    def por_producto(self, request):
        """Movimientos agrupados por producto"""
        producto_id = request.query_params.get('producto_id')

        if not producto_id:
            return Response(
                {'error': 'Se requiere producto_id'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            producto = Producto.objects.get(id=producto_id)
        except Producto.DoesNotExist:
            return Response(
                {'error': 'Producto no encontrado'},
                status=status.HTTP_404_NOT_FOUND
            )

        content_type = ContentType.objects.get_for_model(Producto)
        movimientos = MovimientoStock.objects.filter(
            content_type=content_type,
            object_id=producto_id
        ).order_by('-fecha')

        # Estadísticas
        entradas = movimientos.filter(tipo_movimiento__startswith='ENTRADA')
        salidas = movimientos.filter(tipo_movimiento__startswith='SALIDA')

        total_entradas = entradas.aggregate(Sum('cantidad'))['cantidad__sum'] or 0
        total_salidas = salidas.aggregate(Sum('cantidad'))['cantidad__sum'] or 0

        stats = {
            'producto': {
                'id': producto.id,
                'nombre': producto.nombre,
                'sku': producto.sku,
                'stock_actual': float(producto.stock),
                'stock_minimo': float(producto.stock_minimo),
                'precio': float(producto.precio)
            },
            'estadisticas': {
                'total_movimientos': movimientos.count(),
                'total_entradas': float(total_entradas),
                'total_salidas': float(total_salidas),
                'primer_movimiento': movimientos.last().fecha if movimientos.exists() else None,
                'ultimo_movimiento': movimientos.first().fecha if movimientos.exists() else None
            },
            'movimientos': MovimientoStockSerializer(movimientos[:50], many=True).data
        }

        return Response(stats)

    @action(detail=False, methods=['post'])
    def ajuste_manual(self, request):
        """Crear ajuste manual de stock"""
        data = request.data

        # Validar datos requeridos
        required_fields = ['tipo_item', 'item_id', 'cantidad', 'motivo']
        for field in required_fields:
            if field not in data:
                return Response(
                    {'error': f'Campo requerido: {field}'},
                    status=status.HTTP_400_BAD_REQUEST
                )

        tipo_item = data['tipo_item']  # 'producto' o 'materia_prima'
        item_id = data['item_id']
        cantidad = Decimal(str(data['cantidad']))
        motivo = data['motivo']
        costo_unitario = data.get('costo_unitario')

        # Obtener el item
        if tipo_item == 'producto':
            try:
                item = Producto.objects.get(id=item_id)
                content_type = ContentType.objects.get_for_model(Producto)
                if not costo_unitario:
                    costo_unitario = item.precio
            except Producto.DoesNotExist:
                return Response(
                    {'error': 'Producto no encontrado'},
                    status=status.HTTP_404_NOT_FOUND
                )
        elif tipo_item == 'materia_prima':
            try:
                item = MateriaPrima.objects.get(id=item_id)
                content_type = ContentType.objects.get_for_model(MateriaPrima)
                if not costo_unitario:
                    # Usar último costo conocido o 0
                    ultimo_movimiento = MovimientoStock.objects.filter(
                        content_type=content_type,
                        object_id=item_id,
                        costo_unitario__isnull=False
                    ).order_by('-fecha').first()
                    costo_unitario = ultimo_movimiento.costo_unitario if ultimo_movimiento else 0
            except MateriaPrima.DoesNotExist:
                return Response(
                    {'error': 'Materia prima no encontrada'},
                    status=status.HTTP_404_NOT_FOUND
                )
        else:
            return Response(
                {'error': 'tipo_item debe ser "producto" o "materia_prima"'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Determinar tipo de movimiento
        if cantidad > 0:
            tipo_movimiento = MovimientoStock.TipoMovimiento.ENTRADA_AJUSTE
        else:
            tipo_movimiento = MovimientoStock.TipoMovimiento.SALIDA_AJUSTE
            cantidad = abs(cantidad)

        # Crear movimiento
        movimiento = MovimientoStock.objects.create(
            fecha=datetime.now(),
            tipo_movimiento=tipo_movimiento,
            content_type=content_type,
            object_id=item_id,
            cantidad=cantidad,
            cantidad_anterior=item.stock,
            costo_unitario=costo_unitario,
            motivo=motivo,
            usuario=request.user,
            numero_documento=f"AM-{datetime.now().strftime('%Y%m%d%H%M%S')}"
        )

        # Actualizar stock del item
        if tipo_movimiento == MovimientoStock.TipoMovimiento.ENTRADA_AJUSTE:
            item.stock += cantidad
        else:
            item.stock = max(0, item.stock - cantidad)
        item.save()

        return Response(
            MovimientoStockSerializer(movimiento).data,
            status=status.HTTP_201_CREATED
        )


class AjusteInventarioViewSet(viewsets.ModelViewSet):
    """ViewSet para ajustes de inventario"""
    permission_classes = [IsAuthenticated]
    queryset = AjusteInventario.objects.prefetch_related('detalles').all()
    serializer_class = AjusteInventarioSerializer

    @action(detail=True, methods=['post'])
    def procesar(self, request, pk=None):
        """Procesa un ajuste de inventario"""
        ajuste = self.get_object()

        if ajuste.procesado:
            return Response(
                {'error': 'El ajuste ya fue procesado'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            ajuste.procesar_ajuste()
            return Response({'message': 'Ajuste procesado exitosamente'})
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=True, methods=['post'])
    def agregar_detalle(self, request, pk=None):
        """Agregar detalle a un ajuste"""
        ajuste = self.get_object()

        if ajuste.procesado:
            return Response(
                {'error': 'No se pueden modificar ajustes procesados'},
                status=status.HTTP_400_BAD_REQUEST
            )

        data = request.data.copy()
        data['ajuste'] = ajuste.id

        serializer = AjusteInventarioDetalleSerializer(data=data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class OrdenProduccionViewSet(viewsets.ModelViewSet):
    """ViewSet para órdenes de producción"""
    permission_classes = [IsAuthenticated]
    queryset = OrdenProduccion.objects.select_related(
        'producto', 'responsable'
    ).prefetch_related('consumos_materia_prima__materia_prima').all()
    serializer_class = OrdenProduccionSerializer

    @action(detail=True, methods=['post'])
    def iniciar(self, request, pk=None):
        """Iniciar orden de producción"""
        orden = self.get_object()

        try:
            orden.iniciar_produccion()
            return Response({'message': 'Orden iniciada exitosamente'})
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=True, methods=['post'])
    def finalizar(self, request, pk=None):
        """Finalizar orden de producción"""
        orden = self.get_object()
        cantidad_producida = request.data.get('cantidad_producida')

        if cantidad_producida:
            orden.cantidad_producida = Decimal(str(cantidad_producida))
            orden.save()

        try:
            orden.finalizar_produccion()
            return Response({'message': 'Orden finalizada exitosamente'})
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=True, methods=['post'])
    def consumir_materias_primas(self, request, pk=None):
        """Consumir materias primas de la orden"""
        orden = self.get_object()

        if orden.estado != OrdenProduccion.Estado.EN_PROCESO:
            return Response(
                {'error': 'La orden debe estar en proceso'},
                status=status.HTTP_400_BAD_REQUEST
            )

        consumos_data = request.data.get('consumos', [])
        resultados = []
        errores = []

        for consumo_data in consumos_data:
            try:
                consumo_id = consumo_data.get('id')
                cantidad = Decimal(str(consumo_data.get('cantidad', 0)))

                consumo = orden.consumos_materia_prima.get(id=consumo_id)
                consumo.consumir_materia_prima(cantidad)

                resultados.append({
                    'consumo_id': consumo_id,
                    'status': 'success',
                    'cantidad_consumida': float(cantidad)
                })

            except Exception as e:
                errores.append({
                    'consumo_id': consumo_data.get('id'),
                    'error': str(e)
                })

        return Response({
            'resultados': resultados,
            'errores': errores
        })

    @action(detail=True, methods=['post'])
    def agregar_consumo(self, request, pk=None):
        """Agregar consumo de materia prima a la orden"""
        orden = self.get_object()

        if orden.procesado:
            return Response(
                {'error': 'No se pueden modificar órdenes procesadas'},
                status=status.HTTP_400_BAD_REQUEST
            )

        data = request.data.copy()
        data['orden_produccion'] = orden.id

        serializer = ConsumoMateriaPrimaSerializer(data=data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class ValorizacionInventarioViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet para consulta de valorización de inventario"""
    permission_classes = [IsAuthenticated]
    queryset = ValorizacionInventario.objects.filter(activo=True).all()
    serializer_class = ValorizacionInventarioSerializer

    def get_queryset(self):
        queryset = super().get_queryset()

        # Filtros
        producto_id = self.request.query_params.get('producto_id')
        materia_prima_id = self.request.query_params.get('materia_prima_id')

        if producto_id:
            content_type = ContentType.objects.get_for_model(Producto)
            queryset = queryset.filter(content_type=content_type, object_id=producto_id)

        if materia_prima_id:
            content_type = ContentType.objects.get_for_model(MateriaPrima)
            queryset = queryset.filter(content_type=content_type, object_id=materia_prima_id)

        return queryset

    @action(detail=False, methods=['get'])
    def reporte_valorizacion(self, request):
        """Reporte completo de valorización de inventario"""

        # Valorización por productos
        productos_data = []
        for producto in Producto.objects.filter(stock__gt=0):
            lotes = ValorizacionInventario.objects.filter(
                content_type=ContentType.objects.get_for_model(Producto),
                object_id=producto.id,
                activo=True,
                cantidad_actual__gt=0
            )

            valor_total = sum(lote.costo_total_actual for lote in lotes)
            costo_promedio = valor_total / producto.stock if producto.stock > 0 else 0

            productos_data.append({
                'id': producto.id,
                'nombre': producto.nombre,
                'sku': producto.sku,
                'stock': float(producto.stock),
                'costo_promedio': float(costo_promedio),
                'valor_total': float(valor_total),
                'cantidad_lotes': lotes.count()
            })

        # Valorización por materias primas
        materias_data = []
        for materia in MateriaPrima.objects.filter(stock__gt=0):
            lotes = ValorizacionInventario.objects.filter(
                content_type=ContentType.objects.get_for_model(MateriaPrima),
                object_id=materia.id,
                activo=True,
                cantidad_actual__gt=0
            )

            valor_total = sum(lote.costo_total_actual for lote in lotes)
            costo_promedio = valor_total / materia.stock if materia.stock > 0 else 0

            materias_data.append({
                'id': materia.id,
                'nombre': materia.nombre,
                'sku': materia.sku,
                'stock': float(materia.stock),
                'costo_promedio': float(costo_promedio),
                'valor_total': float(valor_total),
                'cantidad_lotes': lotes.count()
            })

        # Resumen general
        valor_total_productos = sum(item['valor_total'] for item in productos_data)
        valor_total_materias = sum(item['valor_total'] for item in materias_data)

        return Response({
            'resumen': {
                'valor_total_inventario': valor_total_productos + valor_total_materias,
                'valor_productos': valor_total_productos,
                'valor_materias_primas': valor_total_materias,
                'total_productos': len(productos_data),
                'total_materias_primas': len(materias_data)
            },
            'productos': productos_data,
            'materias_primas': materias_data
        })