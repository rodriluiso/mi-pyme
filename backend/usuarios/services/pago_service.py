"""
Servicio de negocio para gestión de pagos de clientes.

Centraliza la lógica de registro de pagos,
integrando el sistema de undo para permitir deshacer operaciones.
"""

from decimal import Decimal
from django.db import transaction
from django.utils import timezone

from finanzas_reportes.models import PagoCliente, MovimientoFinanciero
from ventas.models import Venta
from usuarios.models import UndoAction
from .undo_service import UndoService


class PagoService:
    """
    Servicio para operaciones de pagos con soporte de undo.

    Maneja el registro de pagos de clientes, asegurando:
    - Aplicación correcta a facturas (directa o FIFO)
    - Creación de movimientos financieros
    - Registro de acciones deshacibles
    - Transacciones atómicas
    """

    @staticmethod
    @transaction.atomic
    def registrar_pago(user, cliente_id, monto, medio, fecha=None,
                      venta_id=None, observacion=""):
        """
        Registra un pago de cliente y crea la acción de undo.

        Args:
            user: Usuario que registra el pago
            cliente_id: ID del cliente que paga
            monto: Monto del pago
            medio: Medio de pago (EFECTIVO, TRANSFERENCIA, CHEQUE)
            fecha: Fecha del pago (default: hoy)
            venta_id: ID de venta específica (opcional, si es None aplica FIFO)
            observacion: Observación del pago

        Returns:
            PagoCliente creado

        Raises:
            ValueError: Si hay problemas de validación
        """
        from clientes.models import Cliente

        # Validar cliente
        try:
            cliente = Cliente.objects.get(id=cliente_id)
        except Cliente.DoesNotExist:
            raise ValueError(f"Cliente con ID {cliente_id} no existe")

        # Validar venta si se especificó
        venta = None
        if venta_id:
            try:
                venta = Venta.objects.get(id=venta_id)
                if venta.cliente_id != cliente_id:
                    raise ValueError("La venta no pertenece al cliente especificado")
            except Venta.DoesNotExist:
                raise ValueError(f"Venta con ID {venta_id} no existe")

        # Validar monto
        monto = Decimal(str(monto))
        if monto <= 0:
            raise ValueError("El monto debe ser positivo")

        # Fecha por defecto
        if not fecha:
            fecha = timezone.now().date()

        # Crear el pago
        pago = PagoCliente.objects.create(
            cliente=cliente,
            venta=venta,
            fecha=fecha,
            monto=monto,
            medio=medio,
            observacion=observacion
        )

        # Preparar payload para undo
        undo_payload = {
            'pago_id': str(pago.id),
            'cliente_id': str(cliente.id),
            'cliente_nombre': cliente.nombre,
            'monto': float(monto),
            'medio': medio,
            'fecha': fecha.isoformat(),
        }

        # Aplicar el pago y registrar datos para undo
        if venta:
            # Pago directo a factura específica
            undo_payload['venta_id'] = str(venta.id)
            undo_payload['venta_numero'] = venta.numero or str(venta.id)
            undo_payload['monto_pagado_anterior'] = float(venta.monto_pagado)

            # Aplicar pago CON imputación
            venta.aplicar_pago(monto, pago=pago, crear_imputacion=True)

            descripcion_base = f"Pago de {cliente.nombre} - Factura #{venta.numero or venta.id}"
        else:
            # Pago "a cuenta" con FIFO
            facturas_afectadas, observacion_fifo = PagoService._aplicar_pago_fifo(
                pago, cliente
            )

            undo_payload['facturas_afectadas'] = facturas_afectadas

            # Actualizar observación si fue FIFO
            if observacion_fifo:
                pago.observacion = observacion_fifo
                pago.save(update_fields=['observacion'])

            descripcion_base = f"Pago a cuenta de {cliente.nombre}"

        # Agregar medio de pago a descripción
        descripcion_completa = f"{descripcion_base} - {pago.get_medio_display()}"

        # Crear movimiento financiero de ingreso
        movimiento = MovimientoFinanciero.objects.create(
            fecha=fecha,
            tipo=MovimientoFinanciero.Tipo.INGRESO,
            estado=MovimientoFinanciero.Estado.COBRADO,
            origen=MovimientoFinanciero.Origen.MANUAL,
            monto=monto,
            monto_pagado=monto,
            descripcion=descripcion_completa,
            medio_pago=medio,
        )

        # Agregar movimiento financiero al payload
        undo_payload['movimiento_financiero_id'] = str(movimiento.id)

        # Registrar acción de undo
        UndoService.register_action(
            user=user,
            action_type=UndoAction.ActionType.REGISTER_PAGO_CLIENTE,
            undo_payload=undo_payload,
            description=f"Registrar pago de {cliente.nombre} - ${monto}",
            content_object=pago
        )

        return pago

    @staticmethod
    def _aplicar_pago_fifo(pago, cliente):
        """
        Aplica un pago "a cuenta" a las facturas pendientes más antiguas del cliente.
        Método FIFO (First In, First Out): Las facturas más antiguas se pagan primero.

        Args:
            pago: Instancia de PagoCliente
            cliente: Instancia de Cliente

        Returns:
            Tuple (facturas_afectadas, observacion)
            - facturas_afectadas: Lista de dicts con info para undo
            - observacion: String para actualizar pago.observacion
        """
        from django.db.models import F

        # Obtener facturas pendientes del cliente ordenadas por fecha (más antigua primero)
        facturas_pendientes = Venta.objects.filter(
            cliente=cliente,
            anulada=False  # No aplicar a ventas anuladas
        ).exclude(
            monto_pagado__gte=F('total')  # Excluir facturas ya pagadas completamente
        ).order_by('fecha', 'id')  # FIFO: más antiguas primero

        monto_restante = Decimal(str(pago.monto))
        facturas_afectadas = []
        facturas_info = []

        # Aplicar el pago a cada factura en orden hasta agotar el monto
        for factura in facturas_pendientes:
            if monto_restante <= 0:
                break

            # Guardar estado anterior para undo
            monto_pagado_anterior = factura.monto_pagado
            saldo_anterior = factura.saldo_pendiente

            # Aplicar pago a esta factura (retorna el sobrante) CON imputación
            monto_restante = factura.aplicar_pago(
                monto_restante,
                pago=pago,
                crear_imputacion=True
            )

            # Calcular cuánto se aplicó a esta factura
            monto_aplicado = saldo_anterior - factura.saldo_pendiente

            if monto_aplicado > 0:
                # Guardar para undo
                facturas_afectadas.append({
                    'venta_id': str(factura.id),
                    'venta_numero': factura.numero or str(factura.id),
                    'monto_aplicado': float(monto_aplicado),
                    'monto_pagado_anterior': float(monto_pagado_anterior)
                })

                # Guardar para observación
                facturas_info.append(f"#{factura.numero or factura.id}: ${monto_aplicado}")

        # Construir observación
        observacion = ""
        if facturas_info:
            observacion = f"Pago a cuenta aplicado automáticamente (FIFO) a: {', '.join(facturas_info)}"

        return facturas_afectadas, observacion
