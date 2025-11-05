from datetime import timedelta

from django.db.models import Count, Sum
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from .models import AjusteStockMateriaPrima, CategoriaCompra, Compra, MateriaPrima, StockPorProveedor
from .serializers import (
    AjustarStockSerializer,
    AjusteStockMateriaPrimaSerializer,
    CategoriaCompraSerializer,
    CompraSerializer,
    MateriaPrimaSerializer,
    StockPorProveedorSerializer,
    StockResumenPorProveedorSerializer,
)


class MateriaPrimaViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = MateriaPrima.objects.all()
    serializer_class = MateriaPrimaSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["nombre", "sku", "descripcion"]
    ordering_fields = ["nombre", "stock", "precio_promedio"]
    ordering = ["nombre"]

    @action(detail=False, methods=["get"], url_path="stock-bajo")
    def stock_bajo(self, request):
        """Materias primas con stock bajo (menos de 10 unidades)"""
        queryset = self.get_queryset().filter(stock__lt=10, activo=True)
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"], url_path="stock-detallado")
    def stock_detallado(self, request):
        """Stock de materias primas con detalle por proveedor"""
        from django.db.models import Sum, Count, Avg

        materias_primas = self.get_queryset().filter(activo=True)

        resultado = []
        for mp in materias_primas:
            # Obtener compras de esta materia prima agrupadas por proveedor
            compras_por_proveedor = (
                mp.compras.select_related('compra__proveedor')
                .values('compra__proveedor__id', 'compra__proveedor__nombre')
                .annotate(
                    total_comprado=Sum('cantidad'),
                    numero_compras=Count('id'),
                    precio_promedio=Avg('precio_unitario')
                )
                .order_by('compra__proveedor__nombre')
            )

            detalle_proveedores = []
            for compra in compras_por_proveedor:
                detalle_proveedores.append({
                    'proveedor_id': compra['compra__proveedor__id'],
                    'proveedor_nombre': compra['compra__proveedor__nombre'],
                    'cantidad_comprada': float(compra['total_comprado'] or 0),
                    'numero_compras': compra['numero_compras'],
                    'precio_promedio': float(compra['precio_promedio'] or 0)
                })

            resultado.append({
                'id': mp.id,
                'nombre': mp.nombre,
                'sku': mp.sku,
                'unidad_medida': mp.unidad_medida,
                'stock_actual': float(mp.stock),
                'precio_promedio_actual': float(mp.precio_promedio),
                'proveedores': detalle_proveedores
            })

        return Response(resultado)

    @action(detail=True, methods=["post"], url_path="ajustar-stock")
    def ajustar_stock(self, request, pk=None):
        """Ajustar stock de una materia prima con historial"""
        materia_prima = self.get_object()
        serializer = AjustarStockSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        datos = serializer.validated_data
        tipo_ajuste = datos['tipo_ajuste']
        cantidad = datos['cantidad']
        motivo = datos['motivo']
        usuario = datos.get('usuario', 'Sistema')
        proveedor_id = datos.get('proveedor_id')

        # Guardar stock anterior
        stock_anterior = materia_prima.stock

        # Importar el modelo Proveedor
        from proveedores.models import Proveedor

        try:
            proveedor = None
            if proveedor_id:
                try:
                    proveedor = Proveedor.objects.get(id=proveedor_id)
                except Proveedor.DoesNotExist:
                    return Response(
                        {'error': f'Proveedor con ID {proveedor_id} no encontrado'},
                        status=400
                    )

            # Aplicar el ajuste
            if cantidad > 0:
                # ENTRADA: agregar stock
                materia_prima.agregar_stock(cantidad)

                # Si se especifica proveedor, agregar a su stock también
                if proveedor:
                    stock_proveedor, created = StockPorProveedor.objects.get_or_create(
                        materia_prima=materia_prima,
                        proveedor=proveedor,
                        defaults={
                            'cantidad_stock': 0,
                            'precio_promedio': materia_prima.precio_promedio
                        }
                    )
                    stock_proveedor.agregar_cantidad(cantidad)
            else:
                # SALIDA: quitar stock
                cantidad_abs = abs(cantidad)

                # Si se especifica proveedor, verificar y quitar de su stock primero
                if proveedor:
                    try:
                        stock_proveedor = StockPorProveedor.objects.get(
                            materia_prima=materia_prima,
                            proveedor=proveedor
                        )

                        # Verificar que el proveedor tenga suficiente stock
                        if stock_proveedor.cantidad_stock < cantidad_abs:
                            return Response({
                                'error': f'Stock insuficiente del proveedor {proveedor.nombre}. '
                                        f'Disponible: {stock_proveedor.cantidad_stock}, '
                                        f'Solicitado: {cantidad_abs}'
                            }, status=400)

                        # Quitar del stock del proveedor
                        stock_proveedor.quitar_cantidad(cantidad_abs)

                    except StockPorProveedor.DoesNotExist:
                        return Response({
                            'error': f'No hay stock del proveedor {proveedor.nombre} para esta materia prima'
                        }, status=400)

                # Quitar del stock total
                materia_prima.quitar_stock(cantidad_abs)

            # Crear registro del ajuste
            ajuste = AjusteStockMateriaPrima.objects.create(
                materia_prima=materia_prima,
                proveedor=proveedor,
                tipo_ajuste=tipo_ajuste,
                cantidad=cantidad,
                stock_anterior=stock_anterior,
                stock_nuevo=materia_prima.stock,
                motivo=motivo,
                usuario=usuario
            )

            # Serializar la respuesta
            ajuste_serializer = AjusteStockMateriaPrimaSerializer(ajuste)
            return Response({
                'mensaje': 'Stock ajustado correctamente',
                'materia_prima': MateriaPrimaSerializer(materia_prima).data,
                'ajuste': ajuste_serializer.data
            })

        except ValueError as e:
            return Response(
                {'error': str(e)},
                status=400
            )

    @action(detail=True, methods=["get"], url_path="historial-ajustes")
    def historial_ajustes(self, request, pk=None):
        """Obtener historial de ajustes de una materia prima"""
        materia_prima = self.get_object()
        ajustes = materia_prima.ajustes_stock.all()[:20]  # Últimos 20 ajustes
        serializer = AjusteStockMateriaPrimaSerializer(ajustes, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"], url_path="stock-por-proveedor")
    def stock_por_proveedor(self, request):
        """Obtener stock de materias primas desglosado por proveedor"""
        # Solo materias primas activas
        materias_primas = self.get_queryset().filter(activo=True)

        resultado = []
        for mp in materias_primas:
            # Obtener stock por proveedor para esta materia prima
            stock_proveedores = mp.stock_por_proveedor.filter(cantidad_stock__gt=0).order_by('-cantidad_stock')

            if stock_proveedores.exists():
                resultado.append({
                    'materia_prima_id': mp.id,
                    'materia_prima_nombre': mp.nombre,
                    'sku': mp.sku or '',
                    'unidad_medida': mp.unidad_medida,
                    'stock_total': float(mp.stock),
                    'proveedores': StockPorProveedorSerializer(stock_proveedores, many=True).data
                })

        return Response(resultado)


class CategoriaCompraViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = CategoriaCompra.objects.all()
    serializer_class = CategoriaCompraSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["nombre"]
    ordering_fields = ["nombre"]
    ordering = ["nombre"]


class CompraViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = (
        Compra.objects.select_related("proveedor", "categoria")
        .prefetch_related("lineas__materia_prima")
    )
    serializer_class = CompraSerializer

    PERIODOS_RESUMEN = {
        'semanal': timedelta(days=7),
        'mensual': timedelta(days=30),
        'trimestral': timedelta(days=90),
        'anual': timedelta(days=365),
    }

    def _filtrar_por_periodo(self, queryset, request):
        periodo = request.query_params.get('periodo')
        if not periodo:
            return queryset
        periodo = periodo.lower()
        rango = self.PERIODOS_RESUMEN.get(periodo)
        if not rango:
            return queryset
        fecha_limite = timezone.now().date() - rango
        return queryset.filter(fecha__gte=fecha_limite)

    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = {"proveedor": ["exact"], "categoria": ["exact"], "fecha": ["gte", "lte"]}
    search_fields = ["numero", "proveedor__nombre", "notas"]
    ordering_fields = ["fecha", "total", "proveedor__nombre"]
    ordering = ["-fecha", "-id"]

    @action(detail=False, methods=["get"], url_path="resumen/proveedores")
    def resumen_por_proveedor(self, request):
        queryset = self.filter_queryset(self.get_queryset())
        queryset = self._filtrar_por_periodo(queryset, request)
        data = (
            queryset.values("proveedor__id", "proveedor__nombre")
            .annotate(total=Sum("total"), compras=Count("id"))
            .order_by("proveedor__nombre")
        )
        return Response(
            [
                {
                    "proveedor_id": item["proveedor__id"],
                    "proveedor": item["proveedor__nombre"],
                    "total": item["total"] or 0,
                    "compras": item["compras"],
                }
                for item in data
            ]
        )

    @action(detail=False, methods=["get"], url_path="resumen/categorias")
    def resumen_por_categoria(self, request):
        queryset = self.filter_queryset(self.get_queryset())
        queryset = self._filtrar_por_periodo(queryset, request)
        data = (
            queryset.values("categoria__id", "categoria__nombre")
            .annotate(total=Sum("total"), compras=Count("id"))
            .order_by("categoria__nombre")
        )
        return Response(
            [
                {
                    "categoria_id": item["categoria__id"],
                    "categoria": item["categoria__nombre"] or "Sin categoria",
                    "total": item["total"] or 0,
                    "compras": item["compras"],
                }
                for item in data
            ]
        )