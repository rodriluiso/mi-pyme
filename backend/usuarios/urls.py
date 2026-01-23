from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    UsuarioViewSet,
    AuthViewSet,
    LogAccesoViewSet,
    ConfiguracionSistemaViewSet,
    undo_last,
    undo_availability
)

router = DefaultRouter()
router.register(r'usuarios', UsuarioViewSet)
router.register(r'auth', AuthViewSet, basename='auth')
router.register(r'logs-acceso', LogAccesoViewSet)
router.register(r'configuracion-sistema', ConfiguracionSistemaViewSet)

urlpatterns = [
    # Endpoints de Undo
    path('undo/last', undo_last, name='undo-last'),
    path('undo/availability', undo_availability, name='undo-availability'),

    # Router
    path('', include(router.urls)),
]