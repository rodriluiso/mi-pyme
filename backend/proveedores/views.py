from django.db.models import DecimalField, ExpressionWrapper, F, Sum, Value
from django.db.models.functions import Coalesce
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, viewsets
from rest_framework.permissions import IsAuthenticated

from usuarios.mixins import ModulePermissionMixin
from .models import Proveedor
from .serializers import ProveedorSerializer


class ProveedorViewSet(ModulePermissionMixin, viewsets.ModelViewSet):
    modulo_requerido = 'proveedores'
    permission_classes = [IsAuthenticated]
    queryset = Proveedor.objects.all()
    serializer_class = ProveedorSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["activo"]
    search_fields = ["nombre", "identificacion", "contacto", "correo"]
    ordering_fields = ["nombre", "identificacion"]
    ordering = ["nombre"]

    def get_queryset(self):
        total_field = DecimalField(max_digits=18, decimal_places=2)
        zero = Value(0, output_field=total_field)
        base = super().get_queryset()
        base = base.annotate(
            total_compras=Coalesce(Sum("compras__total"), zero, output_field=total_field),
            total_pagado=Coalesce(Sum("pagos__monto"), zero, output_field=total_field),
        )
        return base.annotate(
            saldo=ExpressionWrapper(F("total_compras") - F("total_pagado"), output_field=total_field)
        )
