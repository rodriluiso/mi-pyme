from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.authtoken.models import Token
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters
from django.contrib.auth import login, logout
from django.utils import timezone
from datetime import datetime, timedelta

from .models import Usuario, LogAcceso, ConfiguracionSistema
from .serializers import (
    UsuarioSerializer, UsuarioListSerializer, LoginSerializer,
    CambiarPasswordSerializer, LogAccesoSerializer,
    ConfiguracionSistemaSerializer, PerfilUsuarioSerializer
)
from .permissions import IsAdminTotal, CanManageUsers


class UsuarioViewSet(viewsets.ModelViewSet):
    """ViewSet para gestionar usuarios"""

    queryset = Usuario.objects.all()
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['nivel_acceso', 'activo', 'is_active']
    search_fields = ['username', 'first_name', 'last_name', 'email', 'cargo']
    ordering_fields = ['fecha_creacion', 'last_login', 'nivel_acceso']
    ordering = ['-fecha_creacion']

    def get_permissions(self):
        """Permisos personalizados según la acción"""
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            # Solo Admin Total puede crear/editar/eliminar usuarios
            return [IsAuthenticated(), CanManageUsers()]
        # Cualquier usuario autenticado puede ver la lista
        return [IsAuthenticated()]

    def get_serializer_class(self):
        """Retorna el serializer apropiado según la acción"""
        if self.action == 'list':
            return UsuarioListSerializer
        return UsuarioSerializer

    def get_queryset(self):
        """Filtrar usuarios según permisos del usuario actual"""
        queryset = super().get_queryset()
        return queryset.order_by('-fecha_creacion')

    def perform_create(self, serializer):
        """Crear usuario con auditoría"""
        usuario = serializer.save()

        # Registrar log
        LogAcceso.objects.create(
            usuario=self.request.user,
            accion=f"Creó usuario: {usuario.username}",
            modulo="usuarios",
            ip_address=self.get_client_ip(self.request)
        )

    def perform_update(self, serializer):
        """Actualizar usuario con auditoría"""
        usuario = serializer.save()

        # Registrar log
        LogAcceso.objects.create(
            usuario=self.request.user,
            accion=f"Actualizó usuario: {usuario.username}",
            modulo="usuarios",
            ip_address=self.get_client_ip(self.request)
        )

    def perform_destroy(self, instance):
        """Desactivar en lugar de eliminar"""
        instance.activo = False
        instance.is_active = False
        instance.save()

        # Registrar log
        LogAcceso.objects.create(
            usuario=self.request.user,
            accion=f"Desactivó usuario: {instance.username}",
            modulo="usuarios",
            ip_address=self.get_client_ip(self.request)
        )

    @action(detail=True, methods=['post'])
    def activar(self, request, pk=None):
        """Activar usuario"""
        usuario = self.get_object()
        usuario.activo = True
        usuario.is_active = True
        usuario.save()

        # Registrar log
        LogAcceso.objects.create(
            usuario=request.user,
            accion=f"Activó usuario: {usuario.username}",
            modulo="usuarios",
            ip_address=self.get_client_ip(request)
        )

        return Response({
            "mensaje": f"Usuario {usuario.username} activado correctamente"
        })

    @action(detail=True, methods=['post'])
    def resetear_password(self, request, pk=None):
        """Resetear contraseña de usuario de forma segura"""
        import secrets
        import string
        from django.core.mail import send_mail

        usuario = self.get_object()

        # 1. Generar contraseña aleatoria fuerte (16 caracteres)
        alphabet = string.ascii_letters + string.digits + string.punctuation
        nueva_password = ''.join(secrets.choice(alphabet) for _ in range(16))

        # 2. Establecer contraseña y marcar que debe cambiarla
        usuario.set_password(nueva_password)
        usuario.debe_cambiar_password = True
        usuario.password_reset_at = timezone.now()
        usuario.save()

        # 3. Intentar enviar email (si falla, mostrar en consola)
        try:
            send_mail(
                subject='Contraseña Reseteada - Mi PyME',
                message=f'''
Hola {usuario.get_full_name() or usuario.username},

Tu contraseña ha sido reseteada por un administrador ({request.user.username}).

Contraseña temporal: {nueva_password}

Por seguridad, deberás cambiarla al iniciar sesión.

Si no solicitaste este cambio, contacta al administrador inmediatamente.

---
Este es un mensaje automático, por favor no responder.
                ''',
                from_email='noreply@mipyme.com',
                recipient_list=[usuario.email] if usuario.email else [],
                fail_silently=True,
            )
            email_enviado = True
        except Exception as e:
            email_enviado = False
            print(f"[EMAIL] No se pudo enviar email a {usuario.email}: {e}")
            print(f"[EMAIL] Contraseña temporal para {usuario.username}: {nueva_password}")

        # 4. Registrar log de auditoría
        LogAcceso.objects.create(
            usuario=request.user,
            accion=f"Reseteó contraseña de: {usuario.username}",
            modulo="usuarios",
            ip_address=self.get_client_ip(request)
        )

        # 5. Respuesta SIN incluir la contraseña (se envía por email o consola)
        return Response({
            "mensaje": f"Contraseña reseteada para {usuario.username}",
            "email_enviado": email_enviado,
            "email": usuario.email if usuario.email else None,
            "nota": "La contraseña temporal fue enviada por email" if email_enviado
                   else "La contraseña temporal fue mostrada en la consola del servidor"
        })

    @action(detail=False, methods=['get'])
    def estadisticas(self, request):
        """Estadísticas de usuarios"""
        total_usuarios = Usuario.objects.filter(activo=True).count()
        usuarios_por_nivel = {}

        for nivel, nombre in Usuario.NivelAcceso.choices:
            count = Usuario.objects.filter(nivel_acceso=nivel, activo=True).count()
            usuarios_por_nivel[nivel] = {
                'nombre': nombre,
                'cantidad': count
            }

        # Últimos accesos
        ultimos_accesos = LogAcceso.objects.filter(
            accion__icontains='login'
        ).order_by('-fecha_acceso')[:10]

        return Response({
            'total_usuarios': total_usuarios,
            'usuarios_por_nivel': usuarios_por_nivel,
            'ultimos_accesos': LogAccesoSerializer(ultimos_accesos, many=True).data
        })

    def get_client_ip(self, request):
        """Obtener IP del cliente"""
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0]
        else:
            ip = request.META.get('REMOTE_ADDR')
        return ip


class AuthViewSet(viewsets.ViewSet):
    """ViewSet para autenticación"""
    permission_classes = [AllowAny]  # Permitir acceso sin autenticación

    @action(detail=False, methods=['get'])
    def csrf(self, request):
        """Obtener token CSRF"""
        from django.middleware.csrf import get_token
        csrf_token = get_token(request)

        response = Response({'csrfToken': csrf_token})

        # Establecer explícitamente la cookie CSRF para cross-domain
        response.set_cookie(
            key='csrftoken',
            value=csrf_token,
            max_age=31449600,  # 1 año
            secure=True,  # Solo HTTPS
            httponly=False,  # Debe ser accesible por JavaScript
            samesite='None'  # Requerido para cross-domain
        )

        return response

    @action(detail=False, methods=['post'])
    def login(self, request):
        """Login de usuario con protección contra fuerza bruta"""
        from django.middleware.csrf import get_token

        # Axes maneja automáticamente el rate limiting a través del middleware
        serializer = LoginSerializer(data=request.data, context={'request': request})

        if serializer.is_valid():
            user = serializer.validated_data['user']

            # ✅ VERIFICAR si debe cambiar contraseña antes de hacer login
            if user.debe_cambiar_password:
                # Registrar intento de login con contraseña temporal
                LogAcceso.objects.create(
                    usuario=user,
                    accion="Login con contraseña temporal - debe cambiar",
                    modulo="auth",
                    ip_address=self.get_client_ip(request),
                    user_agent=request.META.get('HTTP_USER_AGENT', ''),
                    exitoso=False
                )

                return Response({
                    'debe_cambiar_password': True,
                    'mensaje': 'Debes cambiar tu contraseña temporal',
                    'usuario_id': user.id,
                    'username': user.username
                }, status=status.HTTP_403_FORBIDDEN)

            login(request, user)

            # Actualizar última actividad
            user.ultima_actividad = timezone.now()
            user.save()

            # Registrar log de acceso
            LogAcceso.objects.create(
                usuario=user,
                accion="Login exitoso",
                modulo="auth",
                ip_address=self.get_client_ip(request),
                user_agent=request.META.get('HTTP_USER_AGENT', ''),
                exitoso=True
            )

            # Regenerar token en cada login para asegurar permisos actualizados
            Token.objects.filter(user=user).delete()
            token = Token.objects.create(user=user)

            # Asegurar que se envíe el token CSRF
            csrf_token = get_token(request)

            response = Response({
                'mensaje': 'Login exitoso',
                'usuario': PerfilUsuarioSerializer(user).data,
                'token': token.key  # Token para autenticación en mobile
            })

            # Establecer explícitamente la cookie CSRF para cross-domain
            response.set_cookie(
                key='csrftoken',
                value=csrf_token,
                max_age=31449600,  # 1 año
                secure=True,  # Solo HTTPS
                httponly=False,  # Debe ser accesible por JavaScript
                samesite='None'  # Requerido para cross-domain
            )

            return response

        # Registrar intento fallido
        LogAcceso.objects.create(
            usuario=None,
            accion=f"Intento de login fallido: {request.data.get('username', 'unknown')}",
            modulo="auth",
            ip_address=self.get_client_ip(request),
            user_agent=request.META.get('HTTP_USER_AGENT', ''),
            exitoso=False
        )

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'], permission_classes=[IsAuthenticated])
    def logout(self, request):
        """Logout de usuario"""
        # Registrar log
        LogAcceso.objects.create(
            usuario=request.user,
            accion="Logout",
            modulo="auth",
            ip_address=self.get_client_ip(request)
        )

        logout(request)
        return Response({'mensaje': 'Logout exitoso'})

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def perfil(self, request):
        """Obtener perfil del usuario actual"""
        return Response(PerfilUsuarioSerializer(request.user).data)

    @action(detail=False, methods=['put'], permission_classes=[IsAuthenticated])
    def actualizar_perfil(self, request):
        """Actualizar perfil del usuario actual"""
        serializer = PerfilUsuarioSerializer(
            request.user,
            data=request.data,
            partial=True
        )

        if serializer.is_valid():
            serializer.save()

            # Registrar log
            LogAcceso.objects.create(
                usuario=request.user,
                accion="Actualizó su perfil",
                modulo="auth",
                ip_address=self.get_client_ip(request)
            )

            return Response({
                'mensaje': 'Perfil actualizado correctamente',
                'usuario': serializer.data
            })

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'], permission_classes=[IsAuthenticated])
    def cambiar_password(self, request):
        """Cambiar contraseña del usuario actual"""
        serializer = CambiarPasswordSerializer(
            data=request.data,
            context={'request': request}
        )

        if serializer.is_valid():
            user = request.user
            nueva_password = serializer.validated_data['password_nueva']

            # Verificar que la nueva contraseña sea diferente a la actual
            if user.check_password(nueva_password):
                return Response({
                    'error': 'La nueva contraseña debe ser diferente a la actual'
                }, status=status.HTTP_400_BAD_REQUEST)

            # Establecer la nueva contraseña
            user.set_password(nueva_password)

            # ✅ LIMPIAR flag de cambio obligatorio
            if user.debe_cambiar_password:
                user.debe_cambiar_password = False
                accion_log = "Cambió su contraseña temporal"
            else:
                accion_log = "Cambió su contraseña"

            user.save()

            # Registrar log
            LogAcceso.objects.create(
                usuario=user,
                accion=accion_log,
                modulo="auth",
                ip_address=self.get_client_ip(request)
            )

            return Response({
                'mensaje': 'Contraseña cambiada correctamente',
                'debe_hacer_login': user.debe_cambiar_password  # Siempre False ahora
            })

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def get_client_ip(self, request):
        """Obtener IP del cliente"""
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0]
        else:
            ip = request.META.get('REMOTE_ADDR')
        return ip


class LogAccesoViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet para consultar logs de acceso"""

    queryset = LogAcceso.objects.all()
    serializer_class = LogAccesoSerializer
    permission_classes = [IsAuthenticated, IsAdminTotal]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['usuario', 'exitoso', 'modulo']
    search_fields = ['accion', 'ip_address', 'usuario__username']
    ordering_fields = ['fecha_acceso']
    ordering = ['-fecha_acceso']

    @action(detail=False, methods=['get'])
    def estadisticas(self, request):
        """Estadísticas de logs de acceso"""
        desde = request.query_params.get('desde')
        hasta = request.query_params.get('hasta')

        queryset = self.get_queryset()

        if desde:
            queryset = queryset.filter(fecha_acceso__gte=desde)
        if hasta:
            queryset = queryset.filter(fecha_acceso__lte=hasta)

        # Accesos por día
        from django.db.models import Count, Q
        from django.db.models.functions import TruncDate

        accesos_por_dia = queryset.annotate(
            dia=TruncDate('fecha_acceso')
        ).values('dia').annotate(
            total=Count('id'),
            exitosos=Count('id', filter=Q(exitoso=True)),
            fallidos=Count('id', filter=Q(exitoso=False))
        ).order_by('dia')

        return Response({
            'total_accesos': queryset.count(),
            'accesos_exitosos': queryset.filter(exitoso=True).count(),
            'accesos_fallidos': queryset.filter(exitoso=False).count(),
            'accesos_por_dia': list(accesos_por_dia)
        })


class ConfiguracionSistemaViewSet(viewsets.ModelViewSet):
    """ViewSet para configuración del sistema"""

    queryset = ConfiguracionSistema.objects.all()
    serializer_class = ConfiguracionSistemaSerializer
    permission_classes = [IsAuthenticated, IsAdminTotal]

    def get_object(self):
        """Obtener o crear la configuración única"""
        config, created = ConfiguracionSistema.objects.get_or_create(
            defaults={'nombre_empresa': 'Mi PyME'}
        )
        return config

    def list(self, request, *args, **kwargs):
        """Retornar la configuración única"""
        config = self.get_object()
        serializer = self.get_serializer(config)
        return Response(serializer.data)
