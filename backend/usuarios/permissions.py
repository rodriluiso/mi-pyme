from rest_framework.permissions import BasePermission


class IsAdminTotal(BasePermission):
    """
    Permiso que solo permite acceso a Administradores Totales
    """

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        return (
            hasattr(request.user, 'nivel_acceso') and
            request.user.nivel_acceso == 'ADMIN_TOTAL'
        )

    def has_object_permission(self, request, view, obj):
        return self.has_permission(request, view)


class CanManageUsers(BasePermission):
    """
    Permiso para gestionar usuarios - solo Admin Total
    """

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        if hasattr(request.user, 'puede_gestionar_usuarios'):
            return request.user.puede_gestionar_usuarios()

        return False

    def has_object_permission(self, request, view, obj):
        return self.has_permission(request, view)


class CanAccessModule(BasePermission):
    """
    Permiso para acceder a módulos específicos
    """

    def __init__(self, modulo):
        self.modulo = modulo

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        if hasattr(request.user, 'puede_acceder_modulo'):
            return request.user.puede_acceder_modulo(self.modulo)

        return False


class IsAdminNivel2OrHigher(BasePermission):
    """
    Permiso para Admin Nivel 2 o superior
    """

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        if hasattr(request.user, 'get_nivel_numerico'):
            return request.user.get_nivel_numerico() >= 2

        return False


class IsActiveUser(BasePermission):
    """
    Permiso para usuarios activos
    """

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        return (
            request.user.is_active and
            getattr(request.user, 'activo', True)
        )