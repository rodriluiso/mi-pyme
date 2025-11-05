from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    PlanCuentasViewSet,
    AsientoContableViewSet,
    ReportesFinancierosViewSet
)

router = DefaultRouter()
router.register(r'cuentas', PlanCuentasViewSet, basename='plancuentas')
router.register(r'asientos', AsientoContableViewSet, basename='asientocontable')
router.register(r'reportes', ReportesFinancierosViewSet, basename='reportesfinancieros')

urlpatterns = [
    path('', include(router.urls)),
]