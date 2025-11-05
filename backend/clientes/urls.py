from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ClienteViewSet, SucursalClienteViewSet

# Main cliente router
cliente_router = DefaultRouter()
cliente_router.register(r"", ClienteViewSet)

# Separate sucursal router
sucursal_router = DefaultRouter()
sucursal_router.register(r"", SucursalClienteViewSet, basename='sucursalcliente')

urlpatterns = [
    path('', include(cliente_router.urls)),  # /api/clientes/
    path('sucursales/', include(sucursal_router.urls)),  # /api/clientes/sucursales/
]
