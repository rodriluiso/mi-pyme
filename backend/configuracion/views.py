from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import ConfiguracionEmpresa
from .serializers import ConfiguracionEmpresaSerializer, ConfiguracionEmpresaBasicaSerializer


class ConfiguracionEmpresaViewSet(viewsets.ModelViewSet):
    """
    ViewSet para gestionar la configuración de la empresa.
    Solo permite una configuración (Singleton).
    """
    queryset = ConfiguracionEmpresa.objects.all()
    serializer_class = ConfiguracionEmpresaSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """
        Solo devolver la configuración si existe
        """
        return ConfiguracionEmpresa.objects.all()

    def perform_update(self, serializer):
        """
        Guardar quién actualizó la configuración
        """
        serializer.save(actualizado_por=self.request.user)

    def perform_create(self, serializer):
        """
        Guardar quién creó la configuración
        """
        serializer.save(actualizado_por=self.request.user)

    def list(self, request, *args, **kwargs):
        """
        Obtener la configuración (o crear una por defecto)
        """
        configuracion = ConfiguracionEmpresa.get_configuracion()
        serializer = self.get_serializer(configuracion)
        return Response(serializer.data)

    def create(self, request, *args, **kwargs):
        """
        Solo permitir crear si no existe configuración
        """
        if ConfiguracionEmpresa.objects.exists():
            return Response(
                {'detail': 'Ya existe una configuración. Use PUT para actualizar.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        return super().create(request, *args, **kwargs)

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def actual(self, request):
        """
        Endpoint para obtener la configuración actual
        GET /api/configuracion/actual/
        """
        configuracion = ConfiguracionEmpresa.get_configuracion()
        serializer = self.get_serializer(configuracion)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def basica(self, request):
        """
        Endpoint público para obtener datos básicos (sin información sensible)
        GET /api/configuracion/basica/
        """
        configuracion = ConfiguracionEmpresa.get_configuracion()
        serializer = ConfiguracionEmpresaBasicaSerializer(configuracion)
        return Response(serializer.data)
