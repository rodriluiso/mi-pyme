"""
Tests de aritmética contable: Verificar que ventas suman y pagos restan correctamente.

REGLA CONTABLE:
- Ventas = DEUDA A FAVOR del negocio → SUMAN al saldo
- Pagos = DISMINUYEN la deuda → RESTAN del saldo
- Saldo = Σ(Ventas) - Σ(Pagos)

El medio de pago (efectivo, transferencia, cheque) NO debe afectar el cálculo.
"""
from decimal import Decimal
from django.test import TestCase
from django.utils import timezone

from clientes.models import Cliente
from ventas.models import Venta
from finanzas_reportes.models import PagoCliente, MedioPago
from usuarios.models import Usuario
from productos.models import Producto


class TestAritmeticaSaldos(TestCase):
    """Tests para verificar aritmética correcta de saldos"""

    def setUp(self):
        """Configuración inicial"""
        self.cliente = Cliente.objects.create(
            nombre_fantasia="Cliente Test",
            razon_social="Cliente Test SA",
            identificacion="12345678"
        )
        self.usuario = Usuario.objects.create(
            username="testuser",
            email="test@test.com"
        )

    def test_venta_suma_al_saldo(self):
        """
        REGLA: Ventas SUMAN al saldo (aumentan la deuda del cliente).

        Caso: Cliente sin movimientos crea venta de $1000
        Esperado: Saldo = $1000 (positivo, a favor del negocio)
        """
        # Estado inicial: saldo $0
        self.assertEqual(self.cliente.saldo, Decimal('0'))

        # Crear venta de $1000
        Venta.objects.create(
            cliente=self.cliente,
            total=Decimal('1000'),
            subtotal=Decimal('1000'),
            anulada=False
        )

        # Saldo debe AUMENTAR a $1000
        self.assertEqual(
            self.cliente.saldo,
            Decimal('1000'),
            "ERROR: La venta debe SUMAR al saldo (aumenta deuda del cliente)"
        )

    def test_pago_efectivo_resta_del_saldo(self):
        """
        REGLA: Pagos en EFECTIVO RESTAN del saldo (disminuyen la deuda).

        Caso: Cliente con deuda de $1000 paga $300 en efectivo
        Esperado: Saldo = $700
        """
        # Crear venta de $1000
        Venta.objects.create(
            cliente=self.cliente,
            total=Decimal('1000'),
            subtotal=Decimal('1000'),
            anulada=False
        )

        # Pago de $300 en EFECTIVO
        PagoCliente.objects.create(
            cliente=self.cliente,
            monto=Decimal('300'),
            medio=MedioPago.EFECTIVO,
            anulado=False,
            fecha=timezone.now().date()
        )

        # Saldo debe DISMINUIR a $700
        self.assertEqual(
            self.cliente.saldo,
            Decimal('700'),
            "ERROR: Pago en efectivo debe RESTAR del saldo (disminuye deuda)"
        )

    def test_pago_transferencia_resta_del_saldo(self):
        """
        REGLA: Pagos en TRANSFERENCIA RESTAN del saldo.

        El medio de pago NO afecta la aritmética.
        """
        # Crear venta de $1000
        Venta.objects.create(
            cliente=self.cliente,
            total=Decimal('1000'),
            subtotal=Decimal('1000'),
            anulada=False
        )

        # Pago de $400 en TRANSFERENCIA
        PagoCliente.objects.create(
            cliente=self.cliente,
            monto=Decimal('400'),
            medio=MedioPago.TRANSFERENCIA,
            anulado=False,
            fecha=timezone.now().date()
        )

        # Saldo debe DISMINUIR a $600
        self.assertEqual(
            self.cliente.saldo,
            Decimal('600'),
            "ERROR: Pago en transferencia debe RESTAR del saldo"
        )

    def test_pago_cheque_resta_del_saldo(self):
        """
        REGLA: Pagos en CHEQUE RESTAN del saldo.

        El medio de pago NO afecta la aritmética.
        """
        # Crear venta de $1000
        Venta.objects.create(
            cliente=self.cliente,
            total=Decimal('1000'),
            subtotal=Decimal('1000'),
            anulada=False
        )

        # Pago de $250 en CHEQUE
        PagoCliente.objects.create(
            cliente=self.cliente,
            monto=Decimal('250'),
            medio=MedioPago.CHEQUE,
            anulado=False,
            fecha=timezone.now().date()
        )

        # Saldo debe DISMINUIR a $750
        self.assertEqual(
            self.cliente.saldo,
            Decimal('750'),
            "ERROR: Pago en cheque debe RESTAR del saldo"
        )

    def test_multiples_pagos_diferentes_medios(self):
        """
        REGLA: Múltiples pagos en diferentes medios todos RESTAN.

        Caso: Deuda $2000, pagos mixtos
        """
        # Crear venta de $2000
        Venta.objects.create(
            cliente=self.cliente,
            total=Decimal('2000'),
            subtotal=Decimal('2000'),
            anulada=False
        )

        # Pago #1: $500 en efectivo
        PagoCliente.objects.create(
            cliente=self.cliente,
            monto=Decimal('500'),
            medio=MedioPago.EFECTIVO,
            anulado=False,
            fecha=timezone.now().date()
        )

        # Pago #2: $300 en transferencia
        PagoCliente.objects.create(
            cliente=self.cliente,
            monto=Decimal('300'),
            medio=MedioPago.TRANSFERENCIA,
            anulado=False,
            fecha=timezone.now().date()
        )

        # Pago #3: $200 en cheque
        PagoCliente.objects.create(
            cliente=self.cliente,
            monto=Decimal('200'),
            medio=MedioPago.CHEQUE,
            anulado=False,
            fecha=timezone.now().date()
        )

        # Saldo = $2000 - ($500 + $300 + $200) = $1000
        self.assertEqual(
            self.cliente.saldo,
            Decimal('1000'),
            "ERROR: Múltiples pagos deben RESTAR correctamente"
        )

    def test_ventas_multiples_suman_correctamente(self):
        """
        REGLA: Múltiples ventas todas SUMAN al saldo.

        Caso: 3 ventas diferentes
        """
        # Venta #1: $1000
        Venta.objects.create(
            cliente=self.cliente,
            total=Decimal('1000'),
            subtotal=Decimal('1000'),
            anulada=False
        )

        # Venta #2: $500
        Venta.objects.create(
            cliente=self.cliente,
            total=Decimal('500'),
            subtotal=Decimal('500'),
            anulada=False
        )

        # Venta #3: $750
        Venta.objects.create(
            cliente=self.cliente,
            total=Decimal('750'),
            subtotal=Decimal('750'),
            anulada=False
        )

        # Saldo = $1000 + $500 + $750 = $2250
        self.assertEqual(
            self.cliente.saldo,
            Decimal('2250'),
            "ERROR: Múltiples ventas deben SUMAR correctamente"
        )

    def test_caso_real_completo(self):
        """
        REGLA: Test con escenario real completo.

        Escenario:
        1. Venta #1: $1000
        2. Pago efectivo: $300
        3. Venta #2: $500
        4. Pago transferencia: $200
        5. Venta #3: $800
        6. Pago cheque: $150

        Cálculo manual:
        Total ventas: $1000 + $500 + $800 = $2300
        Total pagos: $300 + $200 + $150 = $650
        Saldo = $2300 - $650 = $1650
        """
        # Venta #1
        Venta.objects.create(
            cliente=self.cliente,
            total=Decimal('1000'),
            subtotal=Decimal('1000'),
            anulada=False
        )

        # Pago efectivo
        PagoCliente.objects.create(
            cliente=self.cliente,
            monto=Decimal('300'),
            medio=MedioPago.EFECTIVO,
            anulado=False,
            fecha=timezone.now().date()
        )

        # Venta #2
        Venta.objects.create(
            cliente=self.cliente,
            total=Decimal('500'),
            subtotal=Decimal('500'),
            anulada=False
        )

        # Pago transferencia
        PagoCliente.objects.create(
            cliente=self.cliente,
            monto=Decimal('200'),
            medio=MedioPago.TRANSFERENCIA,
            anulado=False,
            fecha=timezone.now().date()
        )

        # Venta #3
        Venta.objects.create(
            cliente=self.cliente,
            total=Decimal('800'),
            subtotal=Decimal('800'),
            anulada=False
        )

        # Pago cheque
        PagoCliente.objects.create(
            cliente=self.cliente,
            monto=Decimal('150'),
            medio=MedioPago.CHEQUE,
            anulado=False,
            fecha=timezone.now().date()
        )

        # Verificar saldo final
        self.assertEqual(
            self.cliente.saldo,
            Decimal('1650'),
            "ERROR: Caso real completo - saldo incorrecto"
        )

    def test_saldo_negativo_cliente_adelanta_pago(self):
        """
        REGLA: Si pagos > ventas, saldo es NEGATIVO (a favor del cliente).

        Caso: Cliente sin deuda paga $500 (adelanto)
        Esperado: Saldo = -$500
        """
        # Pago sin ventas previas
        PagoCliente.objects.create(
            cliente=self.cliente,
            monto=Decimal('500'),
            medio=MedioPago.EFECTIVO,
            anulado=False,
            fecha=timezone.now().date()
        )

        # Saldo debe ser NEGATIVO
        self.assertEqual(
            self.cliente.saldo,
            Decimal('-500'),
            "ERROR: Saldo debe ser negativo cuando pagos > ventas"
        )

    def test_saldo_cero_cuando_pago_completo(self):
        """
        REGLA: Si ventas = pagos, saldo es CERO.

        Caso: Venta $1000, pago $1000
        Esperado: Saldo = $0
        """
        # Venta de $1000
        Venta.objects.create(
            cliente=self.cliente,
            total=Decimal('1000'),
            subtotal=Decimal('1000'),
            anulada=False
        )

        # Pago completo de $1000
        PagoCliente.objects.create(
            cliente=self.cliente,
            monto=Decimal('1000'),
            medio=MedioPago.EFECTIVO,
            anulado=False,
            fecha=timezone.now().date()
        )

        # Saldo debe ser CERO
        self.assertEqual(
            self.cliente.saldo,
            Decimal('0'),
            "ERROR: Saldo debe ser CERO cuando deuda está saldada"
        )

    def test_signos_correctos_ventas_positivas_pagos_negativos(self):
        """
        VERIFICACIÓN DE SIGNOS:
        - total_ventas debe ser POSITIVO
        - total_pagos debe ser POSITIVO (pero se resta)
        - saldo = total_ventas - total_pagos
        """
        # Crear datos
        Venta.objects.create(
            cliente=self.cliente,
            total=Decimal('1000'),
            subtotal=Decimal('1000'),
            anulada=False
        )

        PagoCliente.objects.create(
            cliente=self.cliente,
            monto=Decimal('300'),
            medio=MedioPago.EFECTIVO,
            anulado=False,
            fecha=timezone.now().date()
        )

        # Verificar que los componentes tienen el signo correcto
        from django.db.models import Sum

        total_ventas = self.cliente.ventas.filter(anulada=False).aggregate(
            total=Sum('total')
        )['total']

        total_pagos = self.cliente.pagos.filter(anulado=False).aggregate(
            total=Sum('monto')
        )['total']

        # Verificar signos
        self.assertGreater(
            total_ventas,
            Decimal('0'),
            "ERROR: total_ventas debe ser POSITIVO"
        )

        self.assertGreater(
            total_pagos,
            Decimal('0'),
            "ERROR: total_pagos debe ser POSITIVO"
        )

        # Verificar que saldo = ventas - pagos
        saldo_calculado = total_ventas - total_pagos
        self.assertEqual(
            self.cliente.saldo,
            saldo_calculado,
            "ERROR: Saldo debe ser (ventas - pagos)"
        )

        # El saldo debe ser positivo en este caso
        self.assertEqual(
            saldo_calculado,
            Decimal('700'),
            "ERROR: Aritmética incorrecta"
        )
