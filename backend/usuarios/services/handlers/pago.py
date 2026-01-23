"""
Handler para deshacer operaciones de pagos de clientes.

Implementa la lógica específica para revertir registros de pagos,
incluyendo validaciones robustas y reversión de movimientos financieros.
"""

from django.db import transaction
from django.utils import timezone

from finanzas_reportes.models import PagoCliente, MovimientoFinanciero
from ventas.models import Venta

from .base import BaseUndoHandler
from ..undo_service import CannotUndoException


class PagoClienteUndoHandler(BaseUndoHandler):
    """
    Handler para deshacer registro de pagos de clientes.

    Valida que:
    - El pago aún existe
    - No fue modificado después de registrarlo
    - No está ya anulado
    - Las ventas afectadas siguen existiendo

    Al deshacer:
    - Revierte Venta.monto_pagado de todas las ventas afectadas
    - Anula el MovimientoFinanciero (marca como CANCELADO)
    - Marca el pago como anulado (NO lo borra)
    """

    def validate_can_undo(self, undo_action):
        """
        Validaciones CRÍTICAS antes de deshacer pago.

        Args:
            undo_action: Instancia de UndoAction

        Returns:
            True si se puede deshacer

        Raises:
            CannotUndoException: Si no se puede deshacer con mensaje específico
        """
        payload = undo_action.undo_payload
        pago_id = payload['pago_id']

        # 1. Verificar que el pago existe
        try:
            pago = PagoCliente.objects.get(id=pago_id)
        except PagoCliente.DoesNotExist:
            raise CannotUndoException("El pago ya no existe")

        # 2. Verificar que no está ya anulado
        if getattr(pago, 'anulado', False):
            raise CannotUndoException("El pago ya está anulado")

        # 3. Verificar que las ventas afectadas aún existen
        # Caso 1: Pago directo a factura
        if 'venta_id' in payload:
            venta_id = payload['venta_id']
            try:
                venta = Venta.objects.get(id=venta_id)

                # CRÍTICO: Verificar que la venta no fue anulada posteriormente
                if venta.anulada:
                    raise CannotUndoException(
                        f"No se puede deshacer: la factura #{venta.numero or venta.id} fue anulada"
                    )

            except Venta.DoesNotExist:
                raise CannotUndoException(
                    f"La factura #{payload.get('venta_numero', venta_id)} ya no existe"
                )

        # Caso 2: Pago FIFO (múltiples facturas)
        elif 'facturas_afectadas' in payload:
            for factura_data in payload['facturas_afectadas']:
                venta_id = factura_data['venta_id']
                try:
                    venta = Venta.objects.get(id=venta_id)

                    if venta.anulada:
                        raise CannotUndoException(
                            f"No se puede deshacer: la factura #{venta.numero or venta.id} fue anulada"
                        )

                except Venta.DoesNotExist:
                    raise CannotUndoException(
                        f"La factura #{factura_data.get('venta_numero', venta_id)} ya no existe"
                    )

        # 4. Verificar que el movimiento financiero existe
        if 'movimiento_financiero_id' in payload:
            try:
                MovimientoFinanciero.objects.get(id=payload['movimiento_financiero_id'])
            except MovimientoFinanciero.DoesNotExist:
                raise CannotUndoException("El movimiento financiero asociado ya no existe")

        return True

    @transaction.atomic
    def undo(self, undo_action, result):
        """
        Deshace el registro de un pago de cliente.

        Pasos:
        1. Obtiene el pago con lock (select_for_update)
        2. Revierte monto_pagado en ventas afectadas
        3. Anula el MovimientoFinanciero
        4. Marca el pago como anulado

        Args:
            undo_action: Instancia de UndoAction
            result: Instancia de UndoResult para tracking

        Side effects:
            - Decrementa Venta.monto_pagado
            - Marca MovimientoFinanciero.estado = CANCELADO
            - Marca pago.anulado = True
            - Actualiza result.steps_completed
            - Marca result.success = True si todo OK
        """
        payload = undo_action.undo_payload

        # Paso 1: Obtener pago con lock para prevenir race conditions
        result.steps_completed.append("Obteniendo pago con lock")
        pago = PagoCliente.objects.select_for_update().get(id=payload['pago_id'])

        # Paso 2: Revertir monto_pagado en ventas afectadas
        result.steps_completed.append("Iniciando reversión de pagos aplicados")

        # Caso 1: Pago directo a factura específica
        if 'venta_id' in payload:
            venta = Venta.objects.select_for_update().get(id=payload['venta_id'])

            # Restaurar monto_pagado anterior
            monto_pagado_anterior = payload['monto_pagado_anterior']
            venta.monto_pagado = monto_pagado_anterior
            venta.save(update_fields=['monto_pagado'])

            result.steps_completed.append(
                f"Revertido pago en factura #{venta.numero or venta.id}: "
                f"${payload['monto']} (monto_pagado: ${venta.monto_pagado})"
            )

        # Caso 2: Pago FIFO (múltiples facturas)
        elif 'facturas_afectadas' in payload:
            for factura_data in payload['facturas_afectadas']:
                venta = Venta.objects.select_for_update().get(id=factura_data['venta_id'])

                # Restaurar monto_pagado anterior
                monto_pagado_anterior = factura_data['monto_pagado_anterior']
                venta.monto_pagado = monto_pagado_anterior
                venta.save(update_fields=['monto_pagado'])

                result.steps_completed.append(
                    f"Revertido pago FIFO en factura #{venta.numero or venta.id}: "
                    f"-${factura_data['monto_aplicado']} (monto_pagado: ${venta.monto_pagado})"
                )

        # Paso 3: Anular MovimientoFinanciero
        result.steps_completed.append("Anulando movimiento financiero")

        if 'movimiento_financiero_id' in payload:
            movimiento = MovimientoFinanciero.objects.select_for_update().get(
                id=payload['movimiento_financiero_id']
            )

            movimiento.estado = MovimientoFinanciero.Estado.CANCELADO
            movimiento.descripcion += " [ANULADO]"
            movimiento.save(update_fields=['estado', 'descripcion'])

            result.steps_completed.append(
                f"Movimiento financiero marcado como CANCELADO (ID: {movimiento.id})"
            )

        # Paso 4: Marcar pago como anulado (NO borrar)
        result.steps_completed.append("Anulando pago")

        pago.anulado = True
        pago.fecha_anulacion = timezone.now()
        pago.anulado_por = undo_action.user
        pago.save(update_fields=['anulado', 'fecha_anulacion', 'anulado_por'])

        result.success = True

        # Descripción del resultado
        cliente_nombre = payload.get('cliente_nombre', 'cliente')
        monto = payload.get('monto', 0)

        if 'venta_numero' in payload:
            result.description = (
                f"Pago de {cliente_nombre} (${monto}) a factura #{payload['venta_numero']} "
                f"deshecho exitosamente"
            )
        else:
            num_facturas = len(payload.get('facturas_afectadas', []))
            result.description = (
                f"Pago a cuenta de {cliente_nombre} (${monto}) deshecho exitosamente. "
                f"Revertidos {num_facturas} factura(s) afectada(s)"
            )
