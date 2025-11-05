from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    UsuarioViewSet,
    AuthViewSet,
    LogAccesoViewSet,
    ConfiguracionSistemaViewSet
)

router = DefaultRouter()
router.register(r'usuarios', UsuarioViewSet)
router.register(r'auth', AuthViewSet, basename='auth')
router.register(r'logs-acceso', LogAccesoViewSet)
router.register(r'configuracion-sistema', ConfiguracionSistemaViewSet)

urlpatterns = [
    path('', include(router.urls)),
]