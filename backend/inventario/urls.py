from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    MovimientoStockViewSet,
    AjusteInventarioViewSet,
    OrdenProduccionViewSet,
    ValorizacionInventarioViewSet
)

router = DefaultRouter()
router.register(r'movimientos', MovimientoStockViewSet, basename='movimientostock')
router.register(r'ajustes', AjusteInventarioViewSet, basename='ajusteinventario')
router.register(r'ordenes-produccion', OrdenProduccionViewSet, basename='ordenproduccion')
router.register(r'valorizacion', ValorizacionInventarioViewSet, basename='valorizacioninventario')

urlpatterns = [
    path('', include(router.urls)),
]