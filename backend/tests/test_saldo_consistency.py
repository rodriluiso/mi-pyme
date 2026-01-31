"""
Tests de consistencia de saldos contables.

Verifica que el cálculo de saldos excluya correctamente ventas y pagos anulados,
garantizando que el sistema coincida EXACTAMENTE con el seguimiento manual.
"""
from decimal import Decimal
from django.test import TestCase
from django.utils import timezone

from clientes.models import Cliente
from ventas.models import Venta, LineaVenta
from finanzas_reportes.models import PagoCliente
from usuarios.models import Usuario
from productos.models import Producto


class TestSaldoConsistency(TestCase):
    """Tests para verificar consistencia de saldos"""

    def setUp(self):
        """Configuración inicial para cada test"""
        self.cliente = Cliente.objects.create(
            nombre_fantasia="Test Cliente",
            razon_social="Test Cliente SA",
            identificacion="12345678"
        )
        self.usuario = Usuario.objects.create(
            username="testuser",
            email="test@test.com"
        )
        self.producto = Producto.objects.create(
            nombre="Producto Test",
            precio=Decimal('100'),
            stock=1000,
            stock_kg=Decimal('1000')
        )

    def test_saldo_excluye_ventas_anuladas(self):
        """
        ERROR CRÍTICO #1: El saldo NO debe incluir ventas anuladas.

        Caso de prueba:
        - Venta activa: $1000
        - Venta anulada: $500
        - Saldo esperado: $1000 (NO $1500)
        """
        # Crear venta activa de $1000
        venta1 = Venta.objects.create(
            cliente=self.cliente,
            total=Decimal('1000'),
            subtotal=Decimal('1000'),
            anulada=False
        )

        # Crear venta anulada de $500
        venta2 = Venta.objects.create(
            cliente=self.cliente,
            total=Decimal('500'),
            subtotal=Decimal('500'),
            anulada=True  # ← ANULADA
        )

        # El saldo debe ser SOLO la venta activa
        self.assertEqual(
            self.cliente.saldo,
            Decimal('1000'),  # NO $1500
            "ERROR CRÍTICO: El saldo NO debe incluir ventas anuladas"
        )

    def test_saldo_excluye_pagos_anulados(self):
        """
        ERROR CRÍTICO #1: El saldo NO debe incluir pagos anulados.

        Caso de prueba:
        - Venta: $1000
        - Pago activo: $300
        - Pago anulado: $200
        - Saldo esperado: $700 (NO $500)
        """
        # Crear venta de $1000
        venta = Venta.objects.create(
            cliente=self.cliente,
            total=Decimal('1000'),
            subtotal=Decimal('1000'),
            anulada=False
        )

        # Pago activo de $300
        pago1 = PagoCliente.objects.create(
            cliente=self.cliente,
            monto=Decimal('300'),
            anulado=False,
            fecha=timezone.now().date()
        )

        # Pago anulado de $200
        pago2 = PagoCliente.objects.create(
            cliente=self.cliente,
            monto=Decimal('200'),
            anulado=True,  # ← ANULADO
            fecha=timezone.now().date()
        )

        # Saldo = $1000 - $300 = $700 (NO - $500)
        self.assertEqual(
            self.cliente.saldo,
            Decimal('700'),
            "ERROR CRÍTICO: El saldo NO debe descontar pagos anulados"
        )

    def test_saldo_pendiente_cero_si_anulada(self):
        """
        ERROR #5: Ventas anuladas deben tener saldo_pendiente = 0.

        Caso de prueba:
        - Venta anulada de $1000 con $300 pagados
        - saldo_pendiente esperado: $0 (NO $700)
        """
        venta = Venta.objects.create(
            cliente=self.cliente,
            total=Decimal('1000'),
            subtotal=Decimal('1000'),
            monto_pagado=Decimal('300'),
            anulada=True  # ← ANULADA
        )

        # Aunque tiene $700 sin pagar, está anulada
        self.assertEqual(
            venta.saldo_pendiente,
            Decimal('0'),
            "ERROR: Ventas anuladas NO deben tener saldo pendiente"
        )

    def test_aplicar_pago_a_venta_anulada_falla(self):
        """
        ERROR #4: No se debe poder aplicar pago a una venta anulada.

        Caso de prueba:
        - Venta anulada de $1000
        - Intentar aplicar pago de $500
        - Debe lanzar ValueError
        """
        venta = Venta.objects.create(
            cliente=self.cliente,
            total=Decimal('1000'),
            subtotal=Decimal('1000'),
            anulada=True  # ← ANULADA
        )

        # Intentar aplicar pago debe fallar
        with self.assertRaises(ValueError) as context:
            venta.aplicar_pago(Decimal('500'))

        self.assertIn("anulada", str(context.exception).lower())

    def test_saldo_con_ventas_y_pagos_mixtos(self):
        """
        Test completo con ventas y pagos mixtos (activos y anulados).

        Escenario:
        - Venta activa #1: $1000
        - Venta activa #2: $500
        - Venta anulada #3: $800
        - Pago activo #1: $300
        - Pago activo #2: $200
        - Pago anulado #3: $150

        Cálculo manual:
        Total ventas activas: $1000 + $500 = $1500
        Total pagos activos: $300 + $200 = $500
        Saldo = $1500 - $500 = $1000
        """
        # Crear ventas
        Venta.objects.create(
            cliente=self.cliente,
            total=Decimal('1000'),
            subtotal=Decimal('1000'),
            anulada=False
        )
        Venta.objects.create(
            cliente=self.cliente,
            total=Decimal('500'),
            subtotal=Decimal('500'),
            anulada=False
        )
        Venta.objects.create(
            cliente=self.cliente,
            total=Decimal('800'),
            subtotal=Decimal('800'),
            anulada=True  # ← ANULADA
        )

        # Crear pagos
        PagoCliente.objects.create(
            cliente=self.cliente,
            monto=Decimal('300'),
            anulado=False,
            fecha=timezone.now().date()
        )
        PagoCliente.objects.create(
            cliente=self.cliente,
            monto=Decimal('200'),
            anulado=False,
            fecha=timezone.now().date()
        )
        PagoCliente.objects.create(
            cliente=self.cliente,
            monto=Decimal('150'),
            anulado=True,  # ← ANULADO
            fecha=timezone.now().date()
        )

        # Verificar saldo
        self.assertEqual(
            self.cliente.saldo,
            Decimal('1000'),
            "ERROR: Saldo debe calcular solo ventas y pagos activos"
        )

    def test_venta_aplicar_pago_incrementa_monto_pagado(self):
        """Verificar que aplicar_pago funciona correctamente en ventas activas"""
        venta = Venta.objects.create(
            cliente=self.cliente,
            total=Decimal('1000'),
            subtotal=Decimal('1000'),
            monto_pagado=Decimal('0'),
            anulada=False
        )

        # Aplicar pago de $300
        sobrante = venta.aplicar_pago(Decimal('300'))

        # Verificar
        venta.refresh_from_db()
        self.assertEqual(venta.monto_pagado, Decimal('300'))
        self.assertEqual(sobrante, Decimal('0'))
        self.assertEqual(venta.saldo_pendiente, Decimal('700'))

    def test_venta_aplicar_pago_con_sobrante(self):
        """Verificar que aplicar_pago retorna sobrante correctamente"""
        venta = Venta.objects.create(
            cliente=self.cliente,
            total=Decimal('1000'),
            subtotal=Decimal('1000'),
            monto_pagado=Decimal('700'),
            anulada=False
        )

        # Aplicar pago de $500 (mayor que el saldo de $300)
        sobrante = venta.aplicar_pago(Decimal('500'))

        # Verificar
        venta.refresh_from_db()
        self.assertEqual(venta.monto_pagado, Decimal('1000'))  # Se pagó completo
        self.assertEqual(sobrante, Decimal('200'))  # Sobrante: $500 - $300
        self.assertEqual(venta.saldo_pendiente, Decimal('0'))
        self.assertTrue(venta.esta_pagada)
