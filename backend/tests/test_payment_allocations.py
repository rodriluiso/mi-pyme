"""
Tests del sistema de imputación de pagos.

Verifica que:
1. Las imputaciones se crean correctamente
2. El estado_pago se actualiza
3. Los 5 casos especificados funcionan correctamente
4. La trazabilidad es completa
"""

from decimal import Decimal
from django.test import TestCase
from django.utils import timezone

from clientes.models import Cliente
from ventas.models import Venta
from finanzas_reportes.models import PagoCliente, ImputacionPago, MedioPago
from usuarios.models import Usuario


class TestPaymentAllocations(TestCase):
    """Tests para el sistema de imputación de pagos"""

    def setUp(self):
        """Configuración inicial para cada test"""
        self.cliente = Cliente.objects.create(
            nombre_fantasia="Cliente Test",
            razon_social="Cliente Test SA",
            identificacion="12345678"
        )
        self.usuario = Usuario.objects.create(
            username="testuser",
            email="test@test.com"
        )

    def test_caso_1_factura_100_pago_100_completamente_pagada(self):
        """
        Caso 1: 1 factura de 100, pago 100 → factura pasa a PAGADA y no aparece en pendientes

        Verificaciones:
        - Factura tiene estado_pago = PAGADA
        - Factura tiene monto_pagado = 100
        - Factura.saldo_pendiente = 0
        - Factura.esta_pagada = True
        - Se creó 1 imputación de 100
        - Imputación.revertida = False
        - Factura NO aparece en Venta.objects.pendientes()
        """
        # Crear factura de $100
        venta = Venta.objects.create(
            cliente=self.cliente,
            total=Decimal('100'),
            subtotal=Decimal('100'),
            anulada=False
        )

        # Verificar estado inicial
        self.assertEqual(venta.estado_pago, Venta.EstadoPago.PENDIENTE)
        self.assertEqual(venta.saldo_pendiente, Decimal('100'))

        # Crear pago de $100
        pago = PagoCliente.objects.create(
            cliente=self.cliente,
            venta=venta,
            monto=Decimal('100'),
            medio=MedioPago.EFECTIVO,
            anulado=False,
            fecha=timezone.now().date()
        )

        # Aplicar pago CON imputación
        venta.aplicar_pago(Decimal('100'), pago=pago, crear_imputacion=True)

        # Recargar venta desde BD
        venta.refresh_from_db()

        # ✅ Verificaciones del Caso 1
        self.assertEqual(venta.estado_pago, Venta.EstadoPago.PAGADA)
        self.assertEqual(venta.monto_pagado, Decimal('100'))
        self.assertEqual(venta.saldo_pendiente, Decimal('0'))
        self.assertTrue(venta.esta_pagada)

        # Verificar imputación
        imputaciones = ImputacionPago.objects.filter(pago=pago, venta=venta)
        self.assertEqual(imputaciones.count(), 1)

        imputacion = imputaciones.first()
        self.assertEqual(imputacion.monto_imputado, Decimal('100'))
        self.assertFalse(imputacion.revertida)

        # Verificar que NO aparece en pendientes
        pendientes = Venta.objects.pendientes().filter(id=venta.id)
        self.assertEqual(pendientes.count(), 0)

        # Verificar que SÍ aparece en completamente pagadas
        pagadas = Venta.objects.completamente_pagadas().filter(id=venta.id)
        self.assertEqual(pagadas.count(), 1)

    def test_caso_2_factura_100_pago_30_parcial(self):
        """
        Caso 2: 1 factura de 100, pago 30 → factura queda PARCIAL con pendiente 70

        Verificaciones:
        - estado_pago = PARCIAL
        - monto_pagado = 30
        - saldo_pendiente = 70
        - esta_pagada = False
        - Imputación de 30 creada
        - Factura SÍ aparece en Venta.objects.pendientes()
        """
        # Crear factura de $100
        venta = Venta.objects.create(
            cliente=self.cliente,
            total=Decimal('100'),
            subtotal=Decimal('100'),
            anulada=False
        )

        # Crear pago de $30
        pago = PagoCliente.objects.create(
            cliente=self.cliente,
            venta=venta,
            monto=Decimal('30'),
            medio=MedioPago.EFECTIVO,
            anulado=False,
            fecha=timezone.now().date()
        )

        # Aplicar pago
        venta.aplicar_pago(Decimal('30'), pago=pago, crear_imputacion=True)

        # Recargar venta
        venta.refresh_from_db()

        # ✅ Verificaciones del Caso 2
        self.assertEqual(venta.estado_pago, Venta.EstadoPago.PARCIAL)
        self.assertEqual(venta.monto_pagado, Decimal('30'))
        self.assertEqual(venta.saldo_pendiente, Decimal('70'))
        self.assertFalse(venta.esta_pagada)

        # Verificar imputación
        imputacion = ImputacionPago.objects.get(pago=pago, venta=venta)
        self.assertEqual(imputacion.monto_imputado, Decimal('30'))
        self.assertFalse(imputacion.revertida)

        # Verificar que SÍ aparece en pendientes
        pendientes = Venta.objects.pendientes().filter(id=venta.id)
        self.assertEqual(pendientes.count(), 1)

    def test_caso_3_dos_facturas_100_50_pago_cuenta_120_fifo(self):
        """
        Caso 3: 2 facturas 100 y 50, pago a cuenta 120 → primera pagada, segunda parcial con 30 pendiente

        Verificaciones:
        - Factura #1: PAGADA, monto_pagado=100, saldo_pendiente=0
        - Factura #2: PARCIAL, monto_pagado=20, saldo_pendiente=30
        - Se crearon 2 imputaciones:
          - Pago → Factura #1: $100
          - Pago → Factura #2: $20
        - Total imputado = $120 (mismo que monto del pago)
        - Solo Factura #2 aparece en pendientes
        """
        # Crear facturas
        factura1 = Venta.objects.create(
            cliente=self.cliente,
            total=Decimal('100'),
            subtotal=Decimal('100'),
            anulada=False,
            fecha=timezone.now().date()
        )

        factura2 = Venta.objects.create(
            cliente=self.cliente,
            total=Decimal('50'),
            subtotal=Decimal('50'),
            anulada=False,
            fecha=timezone.now().date()
        )

        # Crear pago "a cuenta" (sin venta específica)
        pago = PagoCliente.objects.create(
            cliente=self.cliente,
            venta=None,  # ← Pago a cuenta
            monto=Decimal('120'),
            medio=MedioPago.TRANSFERENCIA,
            anulado=False,
            fecha=timezone.now().date()
        )

        # Aplicar FIFO manualmente (simulando lo que hace el serializer)
        monto_restante = Decimal('120')

        # Aplicar a factura1
        monto_restante = factura1.aplicar_pago(monto_restante, pago=pago, crear_imputacion=True)

        # Aplicar a factura2
        monto_restante = factura2.aplicar_pago(monto_restante, pago=pago, crear_imputacion=True)

        # Recargar facturas
        factura1.refresh_from_db()
        factura2.refresh_from_db()

        # ✅ Verificaciones del Caso 3

        # Factura #1
        self.assertEqual(factura1.estado_pago, Venta.EstadoPago.PAGADA)
        self.assertEqual(factura1.monto_pagado, Decimal('100'))
        self.assertEqual(factura1.saldo_pendiente, Decimal('0'))
        self.assertTrue(factura1.esta_pagada)

        # Factura #2
        self.assertEqual(factura2.estado_pago, Venta.EstadoPago.PARCIAL)
        self.assertEqual(factura2.monto_pagado, Decimal('20'))
        self.assertEqual(factura2.saldo_pendiente, Decimal('30'))
        self.assertFalse(factura2.esta_pagada)

        # Verificar imputaciones
        imputaciones = ImputacionPago.objects.filter(pago=pago).order_by('venta__fecha')
        self.assertEqual(imputaciones.count(), 2)

        imp1 = imputaciones[0]
        self.assertEqual(imp1.venta.id, factura1.id)
        self.assertEqual(imp1.monto_imputado, Decimal('100'))

        imp2 = imputaciones[1]
        self.assertEqual(imp2.venta.id, factura2.id)
        self.assertEqual(imp2.monto_imputado, Decimal('20'))

        # Total imputado
        total_imputado = sum([imp.monto_imputado for imp in imputaciones])
        self.assertEqual(total_imputado, Decimal('120'))

        # Verificar pendientes
        pendientes_ids = Venta.objects.pendientes().values_list('id', flat=True)
        self.assertNotIn(factura1.id, pendientes_ids)  # Factura1 NO pendiente
        self.assertIn(factura2.id, pendientes_ids)  # Factura2 SÍ pendiente

    def test_caso_4_pago_cuenta_mayor_total_pendiente_sobrante(self):
        """
        Caso 4: pago a cuenta mayor al total pendiente → queda crédito/saldo a favor

        Escenario:
        - Factura: $100
        - Pago: $150
        - Resultado: Factura PAGADA, sobrante de $50

        Verificaciones:
        - Factura PAGADA con monto_pagado = 100 (no 150)
        - Imputación de $100 (no $150)
        - Saldo cliente = -$50 (a favor del cliente)
        """
        # Crear factura de $100
        venta = Venta.objects.create(
            cliente=self.cliente,
            total=Decimal('100'),
            subtotal=Decimal('100'),
            anulada=False
        )

        # Crear pago de $150
        pago = PagoCliente.objects.create(
            cliente=self.cliente,
            venta=venta,
            monto=Decimal('150'),
            medio=MedioPago.EFECTIVO,
            anulado=False,
            fecha=timezone.now().date()
        )

        # Aplicar pago (retorna sobrante)
        sobrante = venta.aplicar_pago(Decimal('150'), pago=pago, crear_imputacion=True)

        # Recargar venta
        venta.refresh_from_db()

        # ✅ Verificaciones del Caso 4

        # Verificar sobrante
        self.assertEqual(sobrante, Decimal('50'))

        # Factura debe estar PAGADA (no sobrepasada)
        self.assertEqual(venta.estado_pago, Venta.EstadoPago.PAGADA)
        self.assertEqual(venta.monto_pagado, Decimal('100'))  # NO 150
        self.assertEqual(venta.saldo_pendiente, Decimal('0'))

        # Imputación debe ser de $100 (no $150)
        imputacion = ImputacionPago.objects.get(pago=pago, venta=venta)
        self.assertEqual(imputacion.monto_imputado, Decimal('100'))

        # Saldo del cliente
        saldo_cliente = self.cliente.saldo
        # Total ventas - Total pagos = $100 - $150 = -$50 (a favor del cliente)
        self.assertEqual(saldo_cliente, Decimal('-50'))

    def test_caso_5_pago_apuntado_factura_especifica_respeta_eleccion(self):
        """
        Caso 5: pago apuntado a factura específica aunque haya otras más viejas → se respeta esa factura

        Escenario:
        - Factura #1 (vieja): $100, fecha = hoy - 10 días
        - Factura #2 (nueva): $50, fecha = hoy
        - Pago de $30 apuntando ESPECÍFICAMENTE a Factura #2

        Verificaciones:
        - Factura #1: PENDIENTE, monto_pagado=0
        - Factura #2: PARCIAL, monto_pagado=30
        - Imputación: Pago → Factura #2 ($30)
        - NO se creó imputación para Factura #1
        """
        from datetime import timedelta

        # Crear factura vieja
        fecha_vieja = timezone.now().date() - timedelta(days=10)
        factura1 = Venta.objects.create(
            cliente=self.cliente,
            total=Decimal('100'),
            subtotal=Decimal('100'),
            anulada=False,
            fecha=fecha_vieja
        )

        # Crear factura nueva
        factura2 = Venta.objects.create(
            cliente=self.cliente,
            total=Decimal('50'),
            subtotal=Decimal('50'),
            anulada=False,
            fecha=timezone.now().date()
        )

        # Crear pago apuntando ESPECÍFICAMENTE a factura2 (la más nueva)
        pago = PagoCliente.objects.create(
            cliente=self.cliente,
            venta=factura2,  # ← Apunta a la factura nueva
            monto=Decimal('30'),
            medio=MedioPago.CHEQUE,
            anulado=False,
            fecha=timezone.now().date()
        )

        # Aplicar pago solo a factura2
        factura2.aplicar_pago(Decimal('30'), pago=pago, crear_imputacion=True)

        # Recargar facturas
        factura1.refresh_from_db()
        factura2.refresh_from_db()

        # ✅ Verificaciones del Caso 5

        # Factura #1 (vieja) NO debe tener pagos
        self.assertEqual(factura1.estado_pago, Venta.EstadoPago.PENDIENTE)
        self.assertEqual(factura1.monto_pagado, Decimal('0'))
        self.assertEqual(factura1.saldo_pendiente, Decimal('100'))

        # Factura #2 (nueva) SÍ debe tener el pago
        self.assertEqual(factura2.estado_pago, Venta.EstadoPago.PARCIAL)
        self.assertEqual(factura2.monto_pagado, Decimal('30'))
        self.assertEqual(factura2.saldo_pendiente, Decimal('20'))

        # Verificar imputaciones
        imputaciones = ImputacionPago.objects.filter(pago=pago)
        self.assertEqual(imputaciones.count(), 1)

        imputacion = imputaciones.first()
        self.assertEqual(imputacion.venta.id, factura2.id)  # Solo factura2
        self.assertEqual(imputacion.monto_imputado, Decimal('30'))

        # NO debe haber imputación para factura1
        imp_factura1 = ImputacionPago.objects.filter(pago=pago, venta=factura1)
        self.assertEqual(imp_factura1.count(), 0)

    def test_trazabilidad_completa_pagos_por_factura(self):
        """
        Test adicional: Verificar que se puede obtener trazabilidad completa

        - ¿Qué pagos afectaron la factura X?
        - ¿Qué facturas fueron afectadas por el pago Y?
        """
        # Crear 2 facturas
        factura1 = Venta.objects.create(
            cliente=self.cliente,
            total=Decimal('100'),
            subtotal=Decimal('100'),
            anulada=False
        )

        factura2 = Venta.objects.create(
            cliente=self.cliente,
            total=Decimal('50'),
            subtotal=Decimal('50'),
            anulada=False
        )

        # Crear 2 pagos
        pago1 = PagoCliente.objects.create(
            cliente=self.cliente,
            monto=Decimal('80'),
            medio=MedioPago.EFECTIVO,
            anulado=False,
            fecha=timezone.now().date()
        )

        pago2 = PagoCliente.objects.create(
            cliente=self.cliente,
            monto=Decimal('70'),
            medio=MedioPago.TRANSFERENCIA,
            anulado=False,
            fecha=timezone.now().date()
        )

        # Aplicar pago1: $80 → factura1 queda en PARCIAL (pagado $80 de $100, saldo pendiente $20)
        factura1.aplicar_pago(Decimal('80'), pago=pago1, crear_imputacion=True)

        # Aplicar pago2: $70 → primero a factura1 (toma $20), luego a factura2 (toma $50)
        # factura1.aplicar_pago retorna el sobrante después de aplicar lo que puede
        restante = factura1.aplicar_pago(pago2.monto, pago=pago2, crear_imputacion=True)
        # Ahora restante = $50 (70 - 20), aplicar a factura2
        if restante > 0:
            factura2.aplicar_pago(restante, pago=pago2, crear_imputacion=True)

        # ✅ Trazabilidad: ¿Qué pagos afectaron factura1?
        pagos_factura1 = ImputacionPago.objects.filter(
            venta=factura1,
            revertida=False
        ).select_related('pago')

        self.assertEqual(pagos_factura1.count(), 2)
        montos_factura1 = [imp.monto_imputado for imp in pagos_factura1]
        self.assertIn(Decimal('80'), montos_factura1)
        self.assertIn(Decimal('20'), montos_factura1)

        # ✅ Trazabilidad: ¿Qué facturas fueron afectadas por pago2?
        facturas_pago2 = ImputacionPago.objects.filter(
            pago=pago2,
            revertida=False
        ).select_related('venta')

        self.assertEqual(facturas_pago2.count(), 2)
        facturas_ids = [imp.venta.id for imp in facturas_pago2]
        self.assertIn(factura1.id, facturas_ids)
        self.assertIn(factura2.id, facturas_ids)

        # ✅ Verificar sumas
        total_factura1 = sum([imp.monto_imputado for imp in pagos_factura1])
        self.assertEqual(total_factura1, factura1.monto_pagado)
