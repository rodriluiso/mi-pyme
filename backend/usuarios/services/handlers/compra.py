"""
Handler para deshacer operaciones de compras.

Implementa la lógica específica para revertir la creación de compras,
incluyendo validaciones CRÍTICAS sobre compras posteriores y restauración
exacta de stock y precios promedios.

⚠️ LIMITACIÓN IMPORTANTE:
No se puede deshacer una compra si hay compras POSTERIORES de las mismas
materias primas, porque el precio promedio ponderado NO es reversible.
"""

from django.db import transaction
from django.utils import timezone

from compras.models import Compra, CompraLinea, MateriaPrima, StockPorProveedor
from finanzas_reportes.models import MovimientoFinanciero

from .base import BaseUndoHandler
from ..undo_service import CannotUndoException


class CompraUndoHandler(BaseUndoHandler):
    """
    Handler para deshacer creación de compras.

    Valida que:
    - La compra aún existe
    - No fue modificada después de crearla
    - No está ya anulada
    - NO hay compras posteriores de las mismas materias primas (CRÍTICO)

    Al deshacer:
    - Restaura EXACTAMENTE stock y precio_promedio de MateriaPrima
    - Restaura EXACTAMENTE stock y precio_promedio de StockPorProveedor
    - Anula el MovimientoFinanciero (marca como CANCELADO)
    - Marca la compra como anulada (NO la borra)
    """

    def validate_can_undo(self, undo_action):
        """
        Validaciones CRÍTICAS antes de deshacer compra.

        La validación más importante es verificar que NO hay compras
        posteriores, ya que el precio promedio ponderado no es reversible.

        Args:
            undo_action: Instancia de UndoAction

        Returns:
            True si se puede deshacer

        Raises:
            CannotUndoException: Si no se puede deshacer con mensaje específico
        """
        payload = undo_action.undo_payload
        compra_id = payload['compra_id']

        # 1. Verificar que la compra existe
        try:
            compra = Compra.objects.get(id=compra_id)
        except Compra.DoesNotExist:
            raise CannotUndoException("La compra ya no existe")

        # 2. Verificar que no está ya anulada
        if getattr(compra, 'anulada', False):
            raise CannotUndoException("La compra ya está anulada")

        # 3. CRÍTICO: Verificar que NO hay compras posteriores de las mismas materias primas
        fecha_compra = undo_action.created_at

        for linea_data in payload.get('lineas', []):
            materia_prima_id = linea_data.get('materia_prima_id')
            if not materia_prima_id:
                continue

            # Verificar si hay compras posteriores de esta materia prima
            compras_posteriores = CompraLinea.objects.filter(
                materia_prima_id=materia_prima_id,
                compra__fecha__gt=fecha_compra.date(),
                compra__anulada=False  # No contar compras anuladas
            ).exists()

            if compras_posteriores:
                materia_prima_nombre = linea_data.get('materia_prima_nombre', materia_prima_id)
                raise CannotUndoException(
                    f"No se puede deshacer: hubo compras posteriores de {materia_prima_nombre}. "
                    f"El precio promedio ponderado no puede revertirse con precisión."
                )

        # 4. Verificar que las materias primas aún existen
        for linea_data in payload.get('lineas', []):
            materia_prima_id = linea_data.get('materia_prima_id')
            if materia_prima_id:
                try:
                    MateriaPrima.objects.get(id=materia_prima_id)
                except MateriaPrima.DoesNotExist:
                    raise CannotUndoException(
                        f"La materia prima {linea_data.get('materia_prima_nombre', materia_prima_id)} "
                        f"ya no existe"
                    )

        # 5. Verificar que el movimiento financiero existe
        if 'movimiento_financiero_id' in payload:
            try:
                MovimientoFinanciero.objects.get(id=payload['movimiento_financiero_id'])
            except MovimientoFinanciero.DoesNotExist:
                raise CannotUndoException("El movimiento financiero asociado ya no existe")

        return True

    @transaction.atomic
    def undo(self, undo_action, result):
        """
        Deshace la creación de una compra.

        Pasos:
        1. Obtiene la compra con lock (select_for_update)
        2. Restaura EXACTAMENTE stock y precio_promedio de cada MateriaPrima
        3. Restaura EXACTAMENTE stock y precio_promedio de cada StockPorProveedor
        4. Anula el MovimientoFinanciero
        5. Marca la compra como anulada

        Args:
            undo_action: Instancia de UndoAction
            result: Instancia de UndoResult para tracking

        Side effects:
            - Restaura MateriaPrima.stock y precio_promedio a valores exactos anteriores
            - Restaura StockPorProveedor.cantidad_stock y precio_promedio
            - Marca MovimientoFinanciero.estado = CANCELADO
            - Marca compra.anulada = True
            - Actualiza result.steps_completed
            - Marca result.success = True si todo OK
        """
        payload = undo_action.undo_payload

        # Paso 1: Obtener compra con lock para prevenir race conditions
        result.steps_completed.append("Obteniendo compra con lock")
        compra = Compra.objects.select_for_update().get(id=payload['compra_id'])

        # Paso 2: Restaurar stock y precios promedios
        result.steps_completed.append("Iniciando restauración de stock y precios")

        for linea_data in payload.get('lineas', []):
            materia_prima_id = linea_data.get('materia_prima_id')
            if not materia_prima_id:
                continue

            # Obtener materia prima con lock
            try:
                materia_prima = MateriaPrima.objects.select_for_update().get(id=materia_prima_id)
            except MateriaPrima.DoesNotExist:
                result.steps_failed.append(
                    f"Materia prima {linea_data.get('materia_prima_nombre', materia_prima_id)} no encontrada"
                )
                continue

            # RESTAURAR EXACTAMENTE los valores anteriores
            stock_anterior = linea_data.get('stock_anterior_mp')
            precio_promedio_anterior = linea_data.get('precio_promedio_anterior_mp')

            materia_prima.stock = stock_anterior
            materia_prima.precio_promedio = precio_promedio_anterior
            materia_prima.save(update_fields=['stock', 'precio_promedio'])

            result.steps_completed.append(
                f"Stock restaurado de {materia_prima.nombre}: "
                f"{stock_anterior} unidades, precio promedio: ${precio_promedio_anterior}"
            )

            # Restaurar StockPorProveedor si existía
            stock_anterior_proveedor = linea_data.get('stock_anterior_proveedor', 0)
            precio_promedio_proveedor_anterior = linea_data.get('precio_promedio_proveedor_anterior', 0)

            try:
                stock_proveedor = StockPorProveedor.objects.select_for_update().get(
                    materia_prima=materia_prima,
                    proveedor_id=payload['proveedor_id']
                )

                # RESTAURAR EXACTAMENTE los valores anteriores
                stock_proveedor.cantidad_stock = stock_anterior_proveedor
                stock_proveedor.precio_promedio = precio_promedio_proveedor_anterior
                stock_proveedor.save(update_fields=['cantidad_stock', 'precio_promedio'])

                result.steps_completed.append(
                    f"Stock por proveedor restaurado: {stock_anterior_proveedor} unidades"
                )

            except StockPorProveedor.DoesNotExist:
                result.steps_completed.append(
                    "Stock por proveedor no existía antes (primera compra)"
                )

        # Paso 3: Anular MovimientoFinanciero
        result.steps_completed.append("Anulando movimiento financiero")

        if 'movimiento_financiero_id' in payload:
            try:
                movimiento = MovimientoFinanciero.objects.select_for_update().get(
                    id=payload['movimiento_financiero_id']
                )

                movimiento.estado = MovimientoFinanciero.Estado.CANCELADO
                movimiento.descripcion += " [ANULADO]"
                movimiento.save(update_fields=['estado', 'descripcion'])

                result.steps_completed.append(
                    f"Movimiento financiero marcado como CANCELADO (ID: {movimiento.id})"
                )
            except MovimientoFinanciero.DoesNotExist:
                result.steps_failed.append("Movimiento financiero no encontrado")

        # Paso 4: Marcar compra como anulada (NO borrar)
        result.steps_completed.append("Anulando compra")

        compra.anulada = True
        compra.fecha_anulacion = timezone.now()
        compra.motivo_anulacion = "Operación deshecha por el usuario"
        compra.anulada_por = undo_action.user
        compra.save(update_fields=[
            'anulada',
            'fecha_anulacion',
            'motivo_anulacion',
            'anulada_por'
        ])

        result.success = True

        # Descripción del resultado
        proveedor_nombre = payload.get('proveedor_nombre', 'proveedor')
        total = payload.get('total', 0)
        num_lineas = len(payload.get('lineas', []))

        result.description = (
            f"Compra #{payload.get('compra_numero')} de {proveedor_nombre} (${total}) "
            f"deshecha exitosamente. Restaurados {num_lineas} materia(s) prima(s)."
        )
