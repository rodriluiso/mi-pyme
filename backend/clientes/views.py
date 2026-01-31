from decimal import Decimal

from django.apps import apps
from django.db.models import Sum
from django.db.models.functions import Substr, Upper
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from usuarios.mixins import ModulePermissionMixin
from .models import Cliente, SucursalCliente
from .serializers import ClienteSerializer, ClienteListSerializer, SucursalClienteSerializer


class ClienteViewSet(ModulePermissionMixin, viewsets.ModelViewSet):
    modulo_requerido = 'clientes'
    permission_classes = [IsAuthenticated]
    queryset = Cliente.objects.prefetch_related('sucursales').all()
    serializer_class = ClienteSerializer

    # Filtros, búsqueda y orden
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["identificacion", "activo"]
    search_fields = ["razon_social", "identificacion", "correo_principal", "telefono_principal"]
    ordering_fields = ["razon_social", "identificacion", "fecha_creacion"]
    ordering = ["razon_social"]

    def get_serializer_class(self):
        """Usar serializer completo para que ventas pueda acceder a sucursales"""
        # Siempre usar ClienteSerializer para que incluya sucursales
        return ClienteSerializer

    # Acción personalizada para TreeView
    @action(detail=False, methods=["get"], url_path="tree")
    def tree(self, request):
        """Devuelve datos agrupados para armar un TreeView agrupado por inicial del nombre."""
        qs = self.get_queryset().annotate(inicial=Upper(Substr("nombre", 1, 1)))
        grupos = {}

        for cliente in qs.values("id", "nombre", "identificacion", "correo", "inicial"):
            key = cliente["inicial"] or "#"
            grupos.setdefault(key, []).append(
                {
                    "id": cliente["id"],
                    "label": cliente["nombre"],
                    "identificacion": cliente["identificacion"],
                    "correo": cliente["correo"] or "",
                }
            )

        tree = [
            {"label": initial, "children": sorted(children, key=lambda item: item["label"])}
            for initial, children in sorted(grupos.items(), key=lambda item: item[0])
        ]
        return Response(tree)

    @action(detail=True, methods=["get"], url_path="perfil")
    def perfil(self, request, pk=None):
        cliente = self.get_object()
        data = ClienteSerializer(cliente).data

        ventas = []
        compras = []
        pagos = []
        total_ventas = Decimal("0")
        total_compras = Decimal("0")
        total_pagos = Decimal("0")

        Venta = apps.get_model("ventas", "Venta")
        if Venta is not None:
            # CRÍTICO: Filtrar solo ventas activas (no anuladas)
            ventas_qs = Venta.objects.filter(cliente=cliente, anulada=False).order_by("-fecha", "-id")
            ventas = [
                {"id": venta.id, "fecha": venta.fecha, "total": str(venta.total)}
                for venta in ventas_qs[:200]
            ]
            aggregated = ventas_qs.aggregate(total=Sum("total"))
            total_ventas = aggregated["total"] or Decimal("0")

        Compra = apps.get_model("compras", "Compra")
        if Compra is not None and hasattr(Compra, 'cliente'):
            compras_qs = Compra.objects.filter(cliente=cliente).order_by("-fecha", "-id")
            compras = [
                {"id": compra.id, "fecha": compra.fecha, "total": str(getattr(compra, "total", Decimal("0")))}
                for compra in compras_qs[:200]
            ]
            if hasattr(Compra, "total"):
                total_compras_value = compras_qs.aggregate(total=Sum("total"))
                total_compras = total_compras_value["total"] or Decimal("0")

        PagoCliente = apps.get_model("finanzas_reportes", "PagoCliente")
        if PagoCliente is not None:
            # CRÍTICO: Filtrar solo pagos activos (no anulados)
            pagos_qs = PagoCliente.objects.filter(cliente=cliente, anulado=False).order_by("-fecha", "-id")
            pagos = [
                {
                    "id": pago.id,
                    "fecha": pago.fecha,
                    "monto": str(pago.monto),
                    "medio": pago.medio,
                }
                for pago in pagos_qs[:200]
            ]
            total_pagos_value = pagos_qs.aggregate(total=Sum("monto"))
            total_pagos = total_pagos_value["total"] or Decimal("0")

        saldo = (total_ventas - total_pagos) if (total_ventas or total_pagos) else Decimal("0")

        return Response(
            {
                "cliente": data,
                "historial_ventas": ventas,
                "historial_compras": compras,
                "pagos": pagos,
                "saldo": str(saldo.quantize(Decimal("0.01")) if isinstance(saldo, Decimal) else saldo),
                "total_ventas": str(total_ventas),
                "total_compras": str(total_compras),
                "total_pagos": str(total_pagos),
            }
        )

    @action(detail=True, methods=["get"], url_path="sucursales")
    def sucursales(self, request, pk=None):
        """Obtener todas las sucursales de un cliente"""
        cliente = self.get_object()
        sucursales = cliente.sucursales.filter(activo=True)
        serializer = SucursalClienteSerializer(sucursales, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="sucursales/crear")
    def crear_sucursal(self, request, pk=None):
        """Crear una nueva sucursal para el cliente"""
        cliente = self.get_object()
        data = request.data.copy()
        data['cliente'] = cliente.id

        serializer = SucursalClienteSerializer(data=data)
        if serializer.is_valid():
            serializer.save(cliente=cliente)
            return Response(serializer.data, status=201)
        return Response(serializer.errors, status=400)


class SucursalClienteViewSet(ModulePermissionMixin, viewsets.ModelViewSet):
    """ViewSet para gestionar sucursales de clientes"""
    modulo_requerido = 'clientes'
    permission_classes = [IsAuthenticated]
    queryset = SucursalCliente.objects.select_related('cliente').all()
    serializer_class = SucursalClienteSerializer

    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["cliente", "activo", "localidad"]
    search_fields = ["nombre_sucursal", "codigo_sucursal", "direccion", "contacto_responsable"]
    ordering_fields = ["nombre_sucursal", "fecha_creacion"]
    ordering = ["cliente__razon_social", "nombre_sucursal"]