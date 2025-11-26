from rest_framework import serializers
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth import authenticate
from django.core.exceptions import ValidationError
from .models import Usuario, LogAcceso, ConfiguracionSistema


class UsuarioSerializer(serializers.ModelSerializer):
    """Serializer para el modelo Usuario"""

    password = serializers.CharField(
        write_only=True,
        required=False,
        help_text="Contraseña del usuario"
    )

    password_confirm = serializers.CharField(
        write_only=True,
        required=False,
        help_text="Confirmación de contraseña"
    )

    nivel_acceso_display = serializers.CharField(
        source='get_nivel_acceso_display',
        read_only=True
    )

    modulos_permitidos = serializers.ListField(read_only=True)

    puede_gestionar_usuarios = serializers.BooleanField(read_only=True)

    class Meta:
        model = Usuario
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name',
            'nivel_acceso', 'nivel_acceso_display', 'telefono', 'cargo',
            'fecha_ingreso', 'activo', 'ultima_actividad', 'creado_por',
            'fecha_creacion', 'fecha_modificacion', 'password', 'password_confirm',
            'modulos_permitidos', 'puede_gestionar_usuarios', 'is_active',
            'date_joined', 'last_login'
        ]
        read_only_fields = [
            'id', 'fecha_creacion', 'fecha_modificacion', 'ultima_actividad',
            'date_joined', 'last_login'
        ]

    def validate_password(self, value):
        """Validar contraseña"""
        if value:
            validate_password(value)
        return value

    def validate(self, attrs):
        """Validaciones personalizadas"""
        password = attrs.get('password')
        password_confirm = attrs.get('password_confirm')

        # Validar confirmación de contraseña
        if password and password != password_confirm:
            raise serializers.ValidationError({
                'password_confirm': 'Las contraseñas no coinciden'
            })

        # Validar nivel de acceso (solo Admin Total puede crear otros Admin Total)
        request = self.context.get('request')
        if request and hasattr(request, 'user'):
            user = request.user
            nivel_acceso = attrs.get('nivel_acceso')

            if (nivel_acceso == Usuario.NivelAcceso.ADMIN_TOTAL and
                user.nivel_acceso != Usuario.NivelAcceso.ADMIN_TOTAL):
                raise serializers.ValidationError({
                    'nivel_acceso': 'Solo un Administrador Total puede crear otro Administrador Total'
                })

        return attrs

    def create(self, validated_data):
        """Crear usuario"""
        password = validated_data.pop('password', None)
        validated_data.pop('password_confirm', None)

        # Establecer creado_por
        request = self.context.get('request')
        if request and hasattr(request, 'user'):
            validated_data['creado_por'] = request.user

        # Crear usuario usando create_user para manejar correctamente el password
        if password:
            usuario = Usuario.objects.create_user(
                password=password,
                **validated_data
            )
        else:
            # Si no se proporciona contraseña, crear una temporal
            import secrets
            temp_password = secrets.token_urlsafe(12)
            usuario = Usuario.objects.create_user(
                password=temp_password,
                **validated_data
            )
            usuario.debe_cambiar_password = True
            usuario.save()

        return usuario

    def update(self, instance, validated_data):
        """Actualizar usuario"""
        password = validated_data.pop('password', None)
        validated_data.pop('password_confirm', None)

        # Actualizar campos
        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        if password:
            instance.set_password(password)

        instance.save()
        return instance


class UsuarioListSerializer(serializers.ModelSerializer):
    """Serializer simplificado para listado de usuarios"""

    nivel_acceso_display = serializers.CharField(
        source='get_nivel_acceso_display',
        read_only=True
    )

    class Meta:
        model = Usuario
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name',
            'nivel_acceso', 'nivel_acceso_display', 'cargo',
            'activo', 'ultima_actividad', 'fecha_creacion'
        ]


class LoginSerializer(serializers.Serializer):
    """Serializer para login"""

    username = serializers.CharField(required=True)
    password = serializers.CharField(required=True, write_only=True)

    def validate(self, attrs):
        """Validar credenciales"""
        username = attrs.get('username')
        password = attrs.get('password')

        if username and password:
            user = authenticate(
                request=self.context.get('request'),
                username=username,
                password=password
            )

            if not user:
                raise serializers.ValidationError(
                    'Credenciales inválidas'
                )

            if not user.is_active:
                raise serializers.ValidationError(
                    'La cuenta está desactivada'
                )

            if not user.activo:
                raise serializers.ValidationError(
                    'El usuario está inactivo en el sistema'
                )

            attrs['user'] = user
        else:
            raise serializers.ValidationError(
                'Debe proporcionar username y password'
            )

        return attrs


class CambiarPasswordSerializer(serializers.Serializer):
    """Serializer para cambio de contraseña"""

    password_actual = serializers.CharField(required=True, write_only=True)
    password_nueva = serializers.CharField(required=True, write_only=True)
    password_confirmar = serializers.CharField(required=True, write_only=True)

    def validate_password_nueva(self, value):
        """Validar nueva contraseña"""
        validate_password(value)
        return value

    def validate(self, attrs):
        """Validaciones personalizadas"""
        user = self.context['request'].user
        password_actual = attrs.get('password_actual')
        password_nueva = attrs.get('password_nueva')
        password_confirmar = attrs.get('password_confirmar')

        # Verificar contraseña actual
        if not user.check_password(password_actual):
            raise serializers.ValidationError({
                'password_actual': 'La contraseña actual es incorrecta'
            })

        # Verificar que las nuevas contraseñas coincidan
        if password_nueva != password_confirmar:
            raise serializers.ValidationError({
                'password_confirmar': 'Las contraseñas no coinciden'
            })

        return attrs


class LogAccesoSerializer(serializers.ModelSerializer):
    """Serializer para logs de acceso"""

    usuario_nombre = serializers.CharField(source='usuario.get_full_name', read_only=True)
    usuario_username = serializers.CharField(source='usuario.username', read_only=True)

    class Meta:
        model = LogAcceso
        fields = [
            'id', 'usuario', 'usuario_nombre', 'usuario_username',
            'fecha_acceso', 'ip_address', 'user_agent', 'accion',
            'modulo', 'exitoso'
        ]


class ConfiguracionSistemaSerializer(serializers.ModelSerializer):
    """Serializer para configuración del sistema"""

    class Meta:
        model = ConfiguracionSistema
        fields = [
            'id', 'nombre_empresa', 'logo_empresa', 'max_usuarios',
            'requiere_cambio_password', 'dias_vigencia_password',
            'intentos_login_max', 'session_timeout', 'fecha_creacion',
            'fecha_modificacion'
        ]


class PerfilUsuarioSerializer(serializers.ModelSerializer):
    """Serializer para el perfil del usuario actual"""

    nivel_acceso_display = serializers.CharField(
        source='get_nivel_acceso_display',
        read_only=True
    )

    modulos_permitidos = serializers.ListField(read_only=True)

    class Meta:
        model = Usuario
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name',
            'nivel_acceso', 'nivel_acceso_display', 'telefono', 'cargo',
            'fecha_ingreso', 'ultima_actividad', 'modulos_permitidos',
            'fecha_creacion'
        ]
        read_only_fields = [
            'id', 'username', 'nivel_acceso', 'fecha_creacion',
            'ultima_actividad'
        ]