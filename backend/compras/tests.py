from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase
from rest_framework import status
from decimal import Decimal
from .models import MateriaPrima, AjusteStockMateriaPrima
from proveedores.models import Proveedor

User = get_user_model()


class MateriaPrimaModelTest(TestCase):
    """Pruebas para el modelo MateriaPrima"""

    def setUp(self):
        self.materia_prima = MateriaPrima.objects.create(
            nombre="Harina",
            sku="HAR001",
            descripcion="Harina de trigo",
            unidad_medida="kg",
            stock=Decimal("100.00"),
            stock_minimo=Decimal("10.00"),
            precio_promedio=Decimal("50.00")
        )

    def test_agregar_stock(self):
        """Test agregar stock a una materia prima"""
        stock_inicial = self.materia_prima.stock
        cantidad_agregar = Decimal("25.00")

        self.materia_prima.agregar_stock(cantidad_agregar)
        self.materia_prima.refresh_from_db()

        self.assertEqual(
            self.materia_prima.stock,
            stock_inicial + cantidad_agregar
        )

    def test_quitar_stock(self):
        """Test quitar stock de una materia prima"""
        stock_inicial = self.materia_prima.stock
        cantidad_quitar = Decimal("20.00")

        self.materia_prima.quitar_stock(cantidad_quitar)
        self.materia_prima.refresh_from_db()

        self.assertEqual(
            self.materia_prima.stock,
            stock_inicial - cantidad_quitar
        )

    def test_quitar_stock_insuficiente(self):
        """Test error al quitar más stock del disponible"""
        cantidad_excesiva = self.materia_prima.stock + Decimal("10.00")

        with self.assertRaises(ValueError):
            self.materia_prima.quitar_stock(cantidad_excesiva)

    def test_tiene_stock_bajo(self):
        """Test detección de stock bajo"""
        # Stock normal
        self.assertFalse(self.materia_prima.tiene_stock_bajo())

        # Reducir stock por debajo del mínimo
        self.materia_prima.stock = Decimal("5.00")
        self.materia_prima.save()

        self.assertTrue(self.materia_prima.tiene_stock_bajo())


class AjusteStockAPITest(APITestCase):
    """Pruebas para la API de ajuste de stock"""

    def setUp(self):
        # Crear usuario de prueba
        self.user = User.objects.create_user(
            username='testuser',
            password='testpass123',
            nivel_acceso=User.NivelAcceso.ADMIN_TOTAL
        )

        # Crear proveedor de prueba
        self.proveedor = Proveedor.objects.create(
            nombre="Proveedor Test",
            identificacion="12345678",
            contacto="Test Contact",
            telefono="123456789",
            correo="test@test.com",
            direccion="Test Address"
        )

        # Crear materia prima de prueba
        self.materia_prima = MateriaPrima.objects.create(
            nombre="Azúcar",
            sku="AZU001",
            descripcion="Azúcar blanca",
            unidad_medida="kg",
            stock=Decimal("50.00"),
            stock_minimo=Decimal("5.00"),
            precio_promedio=Decimal("30.00")
        )

        # Autenticar usuario
        self.client.force_authenticate(user=self.user)

    def test_ajuste_stock_entrada(self):
        """Test ajuste de stock tipo ENTRADA"""
        stock_inicial = self.materia_prima.stock
        cantidad = Decimal("20.00")

        url = f'/api/compras/materias-primas/{self.materia_prima.id}/ajustar-stock/'
        data = {
            'tipo_ajuste': 'ENTRADA',
            'cantidad': cantidad,
            'motivo': 'Compra adicional',
            'usuario': 'testuser'
        }

        response = self.client.post(url, data, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Verificar que el stock se actualizó
        self.materia_prima.refresh_from_db()
        self.assertEqual(
            self.materia_prima.stock,
            stock_inicial + cantidad
        )

        # Verificar que se creó el registro de ajuste
        ajuste = AjusteStockMateriaPrima.objects.filter(
            materia_prima=self.materia_prima
        ).first()

        self.assertIsNotNone(ajuste)
        self.assertEqual(ajuste.tipo_ajuste, 'ENTRADA')
        self.assertEqual(ajuste.cantidad, cantidad)
        self.assertEqual(ajuste.stock_anterior, stock_inicial)

    def test_ajuste_stock_salida(self):
        """Test ajuste de stock tipo SALIDA"""
        stock_inicial = self.materia_prima.stock
        cantidad = Decimal("15.00")

        url = f'/api/compras/materias-primas/{self.materia_prima.id}/ajustar-stock/'
        data = {
            'tipo_ajuste': 'SALIDA',
            'cantidad': -cantidad,  # La cantidad debe ser negativa para salidas
            'motivo': 'Consumo en producción',
            'usuario': 'testuser'
        }

        response = self.client.post(url, data, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Verificar que el stock se redujo
        self.materia_prima.refresh_from_db()
        self.assertEqual(
            self.materia_prima.stock,
            stock_inicial - cantidad
        )

    def test_ajuste_stock_salida_excesiva(self):
        """Test error al quitar más stock del disponible"""
        cantidad_excesiva = self.materia_prima.stock + Decimal("10.00")

        url = f'/api/compras/materias-primas/{self.materia_prima.id}/ajustar-stock/'
        data = {
            'tipo_ajuste': 'SALIDA',
            'cantidad': -cantidad_excesiva,  # La cantidad debe ser negativa para salidas
            'motivo': 'Intento de salida excesiva',
            'usuario': 'testuser'
        }

        response = self.client.post(url, data, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_historial_ajustes(self):
        """Test obtener historial de ajustes"""
        # Realizar algunos ajustes
        self.materia_prima.agregar_stock(Decimal("10.00"))
        AjusteStockMateriaPrima.objects.create(
            materia_prima=self.materia_prima,
            tipo_ajuste='ENTRADA',
            cantidad=Decimal("10.00"),
            stock_anterior=Decimal("50.00"),
            stock_nuevo=Decimal("60.00"),
            motivo='Ajuste de prueba',
            usuario='testuser'
        )

        url = f'/api/compras/materias-primas/{self.materia_prima.id}/historial-ajustes/'
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['cantidad'], '10.000')
