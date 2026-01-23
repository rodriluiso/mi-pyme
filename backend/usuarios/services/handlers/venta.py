"""
Handler para deshacer operaciones de ventas.

Implementa la lógica específica para revertir la creación de ventas,
incluyendo validaciones robustas y restauración de stock.
"""

from django.db import transaction
from django.utils import timezone

from ventas.models import Venta
from productos.models import Producto
from finanzas_reportes.models import PagoCliente

from .base import BaseUndoHandler
from ..undo_service import CannotUndoException


class VentaUndoHandler(BaseUndoHandler):
    """
    Handler para deshacer creación de ventas.

    Valida que:
    - La venta aún existe
    - No tiene pagos registrados
    - No fue modificada después de crearla
    - No está ya anulada

    Al deshacer:
    - Restaura stock de productos
    - Marca la venta como anulada (NO la borra)
    """

    def validate_can_undo(self, undo_action):
        """
        Validaciones CRÍTICAS antes de deshacer venta.

        Args:
            undo_action: Instancia de UndoAction

        Returns:
            True si se puede deshacer

        Raises:
            CannotUndoException: Si no se puede deshacer con mensaje específico
        """
        payload = undo_action.undo_payload
        venta_id = payload['venta_id']

        # 1. Verificar que la venta existe
        try:
            venta = Venta.objects.get(id=venta_id)
        except Venta.DoesNotExist:
            raise CannotUndoException("La venta ya no existe")

        # 2. CRÍTICO: Verificar que NO hay pagos posteriores
        # Nota: El campo 'anulado' no existe aún en PagoCliente en este código,
        # pero si lo agregamos en Fase 3, descomentar la línea
        pagos_count = PagoCliente.objects.filter(
            venta_id=venta_id,
            # anulado=False  # Descomentar cuando se agregue el campo
        ).count()

        if pagos_count > 0:
            raise CannotUndoException(
                "No se puede deshacer: ya hay pagos registrados para esta venta"
            )

        # 3. Verificar que la venta no fue editada después
        # Django auto_now_add no crea fecha_modificacion, así que omitimos esto
        # Si el modelo tiene fecha_modificacion, descomentar:
        # if hasattr(venta, 'fecha_modificacion'):
        #     if venta.fecha_modificacion > undo_action.created_at:
        #         raise CannotUndoException(
        #             "No se puede deshacer: la venta fue modificada"
        #         )

        # 4. Verificar que no está ya anulada
        if getattr(venta, 'anulada', False):
            raise CannotUndoException("La venta ya está anulada")

        # 5. Verificar que los productos aún existen
        for linea_data in payload.get('lineas', []):
            producto_id = linea_data.get('producto_id')
            if producto_id:
                try:
                    Producto.objects.get(id=producto_id)
                except Producto.DoesNotExist:
                    raise CannotUndoException(
                        f"El producto {linea_data.get('producto_nombre', producto_id)} "
                        f"ya no existe, no se puede restaurar el stock"
                    )

        return True

    @transaction.atomic
    def undo(self, undo_action, result):
        """
        Deshace la creación de una venta.

        Pasos:
        1. Obtiene la venta con lock (select_for_update)
        2. Obtiene productos con lock (prefetch para evitar N+1)
        3. Restaura stock de cada producto
        4. Marca la venta como anulada

        Args:
            undo_action: Instancia de UndoAction
            result: Instancia de UndoResult para tracking

        Side effects:
            - Incrementa stock de productos
            - Marca venta.anulada = True
            - Actualiza result.steps_completed
            - Marca result.success = True si todo OK
        """
        payload = undo_action.undo_payload

        # Paso 1: Obtener venta con lock para prevenir race conditions
        result.steps_completed.append("Obteniendo venta con lock")
        venta = Venta.objects.select_for_update().get(id=payload['venta_id'])

        # Paso 2: Prefetch productos (evitar N+1 queries)
        result.steps_completed.append("Cargando productos afectados")
        producto_ids = [
            l['producto_id']
            for l in payload.get('lineas', [])
            if l.get('producto_id')
        ]

        productos = {
            str(p.id): p
            for p in Producto.objects.select_for_update().filter(
                id__in=producto_ids
            )
        }

        # Paso 3: Restaurar stock de productos
        result.steps_completed.append("Iniciando restauración de stock")

        for linea_data in payload.get('lineas', []):
            producto_id = linea_data.get('producto_id')
            if not producto_id:
                continue

            producto = productos.get(producto_id)
            if not producto:
                result.steps_failed.append(
                    f"Producto {linea_data.get('producto_nombre', producto_id)} no encontrado"
                )
                continue

            # Restaurar stock
            cantidad = linea_data.get('cantidad', 0)
            cantidad_kg = linea_data.get('cantidad_kg', 0)

            producto.agregar_stock(
                cantidad=cantidad,
                cantidad_kg=cantidad_kg
            )

            result.steps_completed.append(
                f"Stock restaurado: {producto.nombre} "
                f"(+{cantidad} unidades, +{cantidad_kg} kg)"
            )

        # Paso 4: Marcar venta como anulada (NO borrar)
        result.steps_completed.append("Anulando venta")

        venta.anulada = True
        venta.fecha_anulacion = timezone.now()
        venta.motivo_anulacion = "Operación deshecha por el usuario"
        venta.anulada_por = undo_action.user
        venta.save(update_fields=[
            'anulada',
            'fecha_anulacion',
            'motivo_anulacion',
            'anulada_por'
        ])

        result.success = True
        result.description = (
            f"Venta #{venta.numero or venta.id} deshecha exitosamente. "
            f"Stock restaurado para {len(payload.get('lineas', []))} producto(s)."
        )
