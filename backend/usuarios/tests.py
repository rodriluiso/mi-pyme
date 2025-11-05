from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase
from rest_framework import status
from .models import Usuario, LogAcceso, ConfiguracionSistema

User = get_user_model()


class UsuarioModelTest(TestCase):
    """Pruebas para el modelo Usuario"""

    def setUp(self):
        self.admin_total = Usuario.objects.create_user(
            username='admin',
            email='admin@test.com',
            password='testpass123',
            first_name='Admin',
            last_name='Total',
            nivel_acceso=Usuario.NivelAcceso.ADMIN_TOTAL
        )

        self.admin_nivel2 = Usuario.objects.create_user(
            username='gerente',
            email='gerente@test.com',
            password='testpass123',
            first_name='Gerente',
            last_name='General',
            nivel_acceso=Usuario.NivelAcceso.ADMIN_NIVEL_2,
            creado_por=self.admin_total
        )

    def test_modulos_permitidos_admin_total(self):
        """Test módulos permitidos para Admin Total"""
        modulos = self.admin_total.modulos_permitidos
        expected_modules = [
            'dashboard', 'ventas', 'compras', 'clientes', 'proveedores',
            'productos', 'finanzas', 'reportes', 'afip', 'bancos',
            'recursos_humanos', 'usuarios', 'configuracion'
        ]

        for modulo in expected_modules:
            self.assertIn(modulo, modulos)

    def test_modulos_permitidos_admin_nivel2(self):
        """Test módulos permitidos para Admin Nivel 2"""
        modulos = self.admin_nivel2.modulos_permitidos
        expected_modules = [
            'dashboard', 'ventas', 'compras', 'clientes', 'proveedores',
            'productos', 'finanzas', 'reportes', 'afip', 'bancos'
        ]

        for modulo in expected_modules:
            self.assertIn(modulo, modulos)

        # No debe tener acceso a usuarios
        self.assertNotIn('usuarios', modulos)

    def test_puede_gestionar_usuarios(self):
        """Test permisos de gestión de usuarios"""
        self.assertTrue(self.admin_total.puede_gestionar_usuarios())
        self.assertFalse(self.admin_nivel2.puede_gestionar_usuarios())

    def test_puede_acceder_modulo(self):
        """Test acceso a módulos específicos"""
        # Admin Total puede acceder a todos
        self.assertTrue(self.admin_total.puede_acceder_modulo('usuarios'))
        self.assertTrue(self.admin_total.puede_acceder_modulo('ventas'))

        # Admin Nivel 2 no puede acceder a usuarios
        self.assertFalse(self.admin_nivel2.puede_acceder_modulo('usuarios'))
        self.assertTrue(self.admin_nivel2.puede_acceder_modulo('ventas'))

    def test_get_nivel_numerico(self):
        """Test conversión de nivel a número"""
        self.assertEqual(self.admin_total.get_nivel_numerico(), 3)
        self.assertEqual(self.admin_nivel2.get_nivel_numerico(), 2)


class AuthAPITest(APITestCase):
    """Pruebas para la API de autenticación"""

    def setUp(self):
        self.user = Usuario.objects.create_user(
            username='testuser',
            email='test@test.com',
            password='testpass123',
            first_name='Test',
            last_name='User',
            nivel_acceso=Usuario.NivelAcceso.ADMIN_NIVEL_2
        )

    def test_login_exitoso(self):
        """Test login con credenciales correctas"""
        url = '/api/usuarios/auth/login/'
        data = {
            'username': 'testuser',
            'password': 'testpass123'
        }

        response = self.client.post(url, data, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('mensaje', response.data)
        self.assertIn('usuario', response.data)
        self.assertEqual(response.data['usuario']['username'], 'testuser')

    def test_login_credenciales_incorrectas(self):
        """Test login con credenciales incorrectas"""
        url = '/api/usuarios/auth/login/'
        data = {
            'username': 'testuser',
            'password': 'wrongpassword'
        }

        response = self.client.post(url, data, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_perfil_autenticado(self):
        """Test obtener perfil de usuario autenticado"""
        self.client.force_authenticate(user=self.user)

        url = '/api/usuarios/auth/perfil/'
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['username'], 'testuser')
        self.assertEqual(response.data['nivel_acceso'], 'ADMIN_NIVEL_2')

    def test_perfil_no_autenticado(self):
        """Test acceso al perfil sin autenticación"""
        url = '/api/usuarios/auth/perfil/'
        response = self.client.get(url)

        # DRF puede devolver 401 o 403 dependiendo de la configuración
        self.assertIn(response.status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN])

    def test_logout(self):
        """Test logout de usuario"""
        self.client.force_authenticate(user=self.user)

        url = '/api/usuarios/auth/logout/'
        response = self.client.post(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('mensaje', response.data)

    def test_cambiar_password(self):
        """Test cambio de contraseña"""
        self.client.force_authenticate(user=self.user)

        url = '/api/usuarios/auth/cambiar_password/'
        data = {
            'password_actual': 'testpass123',
            'password_nueva': 'newpassword123',
            'password_confirmar': 'newpassword123'
        }

        response = self.client.post(url, data, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Verificar que la contraseña cambió
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password('newpassword123'))


class LogAccesoTest(TestCase):
    """Pruebas para el modelo LogAcceso"""

    def setUp(self):
        self.user = Usuario.objects.create_user(
            username='testuser',
            password='testpass123',
            nivel_acceso=Usuario.NivelAcceso.ADMIN_NIVEL_1
        )

    def test_crear_log_acceso(self):
        """Test creación de log de acceso"""
        log = LogAcceso.objects.create(
            usuario=self.user,
            accion='Login exitoso',
            modulo='auth',
            ip_address='127.0.0.1',
            exitoso=True
        )

        self.assertEqual(log.usuario, self.user)
        self.assertEqual(log.accion, 'Login exitoso')
        self.assertTrue(log.exitoso)

    def test_log_acceso_str(self):
        """Test representación string del log"""
        log = LogAcceso.objects.create(
            usuario=self.user,
            accion='Test action',
            modulo='test'
        )

        str_representation = str(log)
        self.assertIn('testuser', str_representation)


class ConfiguracionSistemaTest(TestCase):
    """Pruebas para el modelo ConfiguracionSistema"""

    def test_crear_configuracion(self):
        """Test creación de configuración del sistema"""
        config = ConfiguracionSistema.objects.create(
            nombre_empresa='Mi PyME Test',
            max_usuarios=20,
            session_timeout=45
        )

        self.assertEqual(config.nombre_empresa, 'Mi PyME Test')
        self.assertEqual(config.max_usuarios, 20)
        self.assertEqual(config.session_timeout, 45)

    def test_configuracion_unica(self):
        """Test que solo puede existir una configuración"""
        ConfiguracionSistema.objects.create(nombre_empresa='Primera')

        # Intentar crear una segunda debería fallar
        with self.assertRaises(Exception):
            ConfiguracionSistema.objects.create(nombre_empresa='Segunda')
