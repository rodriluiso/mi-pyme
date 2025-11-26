from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, viewsets
from rest_framework.permissions import IsAuthenticated

from usuarios.mixins import ModulePermissionMixin
from .models import Empleado, PagoEmpleado
from .serializers import EmpleadoSerializer, PagoEmpleadoSerializer


class EmpleadoViewSet(ModulePermissionMixin, viewsets.ModelViewSet):
    modulo_requerido = 'recursos_humanos'
    permission_classes = [IsAuthenticated]
    queryset = Empleado.objects.all()
    serializer_class = EmpleadoSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["activo"]
    search_fields = ["nombre", "apellidos", "identificacion", "cuil", "puesto"]
    ordering_fields = ["nombre", "apellidos", "identificacion", "fecha_ingreso"]
    ordering = ["apellidos", "nombre"]


class PagoEmpleadoViewSet(ModulePermissionMixin, viewsets.ModelViewSet):
    modulo_requerido = 'recursos_humanos'
    permission_classes = [IsAuthenticated]
    queryset = PagoEmpleado.objects.select_related("empleado").all()
    serializer_class = PagoEmpleadoSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["empleado", "fecha", "medio_pago", "generar_recibo"]
    search_fields = ["empleado__nombre", "empleado__apellidos", "concepto"]
    ordering_fields = ["fecha", "monto", "empleado__apellidos"]
    ordering = ["-fecha", "-id"]