from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ConfiguracionEmpresaViewSet

router = DefaultRouter()
router.register(r'', ConfiguracionEmpresaViewSet, basename='configuracion')

urlpatterns = [
    path('', include(router.urls)),
]
