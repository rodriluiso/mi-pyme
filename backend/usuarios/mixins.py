from rest_framework.permissions import IsAuthenticated
from .permissions import CanAccessModule


class ModulePermissionMixin:
    """
    Mixin para ViewSets que require verificar permisos de acceso a módulos.

    Uso:
        class MiViewSet(ModulePermissionMixin, viewsets.ModelViewSet):
            modulo_requerido = 'ventas'  # Nombre del módulo según Usuario.modulos_permitidos
    """
    modulo_requerido = None

    def get_permissions(self):
        """
        Agrega verificación de módulo a los permisos base
        """
        permissions = super().get_permissions() if hasattr(super(), 'get_permissions') else [IsAuthenticated()]

        # Si el viewset tiene módulo requerido, agregar el permiso
        if self.modulo_requerido:
            permissions.append(CanAccessModule())

        return permissions
