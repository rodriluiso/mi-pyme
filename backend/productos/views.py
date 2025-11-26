from decimal import Decimal, InvalidOperation

from django.db.models import F
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from usuarios.mixins import ModulePermissionMixin
from .models import Producto
from .serializers import ProductoSerializer


class ProductoViewSet(ModulePermissionMixin, viewsets.ModelViewSet):
    modulo_requerido = 'productos'
    permission_classes = [IsAuthenticated]
    queryset = Producto.objects.all()
    serializer_class = ProductoSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["activo", "sku"]
    search_fields = ["nombre", "sku", "descripcion"]
    ordering_fields = ["nombre", "sku", "stock", "precio"]
    ordering = ["nombre"]

    @action(detail=True, methods=["post"], url_path="agregar-stock")
    def agregar_stock(self, request, pk=None):
        producto = self.get_object()
        cantidad = self._parse_cantidad(request.data.get("cantidad"))
        if isinstance(cantidad, Response):
            return cantidad

        cantidad_kg = self._parse_cantidad_kg(request.data.get("cantidad_kg"))
        if isinstance(cantidad_kg, Response):
            return cantidad_kg

        update_fields = {"stock": F("stock") + cantidad}
        if cantidad_kg is not None:
            update_fields["stock_kg"] = F("stock_kg") + cantidad_kg

        Producto.objects.filter(pk=producto.pk).update(**update_fields)
        producto.refresh_from_db(fields=["stock", "stock_kg"])
        return Response(self.get_serializer(producto).data)

    @action(detail=True, methods=["post"], url_path="quitar-stock")
    def quitar_stock(self, request, pk=None):
        producto = self.get_object()
        cantidad = self._parse_cantidad(request.data.get("cantidad"))
        if isinstance(cantidad, Response):
            return cantidad
        if cantidad > producto.stock:
            return Response(
                {"detail": "La cantidad supera el stock disponible"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        cantidad_kg = self._parse_cantidad_kg(request.data.get("cantidad_kg"))
        if isinstance(cantidad_kg, Response):
            return cantidad_kg

        if cantidad_kg is not None and cantidad_kg > producto.stock_kg:
            return Response(
                {"detail": "La cantidad en kg supera el stock disponible"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        update_fields = {"stock": F("stock") - cantidad}
        if cantidad_kg is not None:
            update_fields["stock_kg"] = F("stock_kg") - cantidad_kg

        Producto.objects.filter(pk=producto.pk).update(**update_fields)
        producto.refresh_from_db(fields=["stock", "stock_kg"])
        return Response(self.get_serializer(producto).data)

    def _parse_cantidad(self, raw_value):
        try:
            cantidad = Decimal(str(raw_value))
        except (TypeError, InvalidOperation):
            return Response(
                {"detail": "Debes enviar un número válido en el campo 'cantidad'"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if cantidad <= 0:
            return Response(
                {"detail": "La cantidad debe ser mayor a cero"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return cantidad

    def _parse_cantidad_kg(self, raw_value):
        """Parse optional cantidad_kg parameter"""
        if raw_value is None or raw_value == "":
            return None
        try:
            cantidad_kg = Decimal(str(raw_value))
        except (TypeError, InvalidOperation):
            return Response(
                {"detail": "Debes enviar un número válido en el campo 'cantidad_kg'"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if cantidad_kg < 0:
            return Response(
                {"detail": "La cantidad en kg no puede ser negativa"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return cantidad_kg