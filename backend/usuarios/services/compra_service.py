"""
Servicio de negocio para gestión de compras.

Centraliza la lógica de creación de compras,
integrando el sistema de undo con snapshot completo para permitir deshacer operaciones.

⚠️ IMPORTANTE: El precio promedio ponderado NO es reversible si hay compras posteriores.
Por eso, el handler de undo validará que no existan compras posteriores antes de deshacer.
"""

from decimal import Decimal
from django.db import transaction
from django.utils import timezone

from compras.models import Compra, CompraLinea, MateriaPrima, StockPorProveedor
from finanzas_reportes.models import MovimientoFinanciero
from usuarios.models import UndoAction
from .undo_service import UndoService


class CompraService:
    """
    Servicio para operaciones de compras con soporte de undo.

    Maneja la creación de compras, asegurando:
    - Snapshot completo del estado anterior (stock y precios promedios)
    - Creación de líneas y actualización automática de stock
    - Creación de movimientos financieros
    - Registro de acciones deshacibles
    - Transacciones atómicas
    """

    @staticmethod
    @transaction.atomic
    def crear_compra(user, proveedor_id, lineas_data, incluye_iva=False,
                    fecha=None, numero="", categoria_id=None, notas=""):
        """
        Crea una nueva compra y registra la acción para poder deshacerla.

        ⚠️ LIMITACIÓN: Solo se puede deshacer si NO hay compras posteriores
        de las mismas materias primas (validado en CompraUndoHandler).

        Args:
            user: Usuario que crea la compra
            proveedor_id: ID del proveedor
            lineas_data: Lista de dicts con: materia_prima (opcional), descripcion,
                        cantidad, precio_unitario, total_linea
            incluye_iva: Si se aplica IVA 21%
            fecha: Fecha de la compra (default: hoy)
            numero: Número de factura/remito
            categoria_id: ID de categoría de compra (opcional)
            notas: Notas adicionales

        Returns:
            Compra creada

        Raises:
            ValueError: Si hay problemas de validación
        """
        from proveedores.models import Proveedor
        from compras.models import CategoriaCompra

        # Validar proveedor
        try:
            proveedor = Proveedor.objects.get(id=proveedor_id)
        except Proveedor.DoesNotExist:
            raise ValueError(f"Proveedor con ID {proveedor_id} no existe")

        # Validar categoría si se especificó
        categoria = None
        if categoria_id:
            try:
                categoria = CategoriaCompra.objects.get(id=categoria_id)
            except CategoriaCompra.DoesNotExist:
                raise ValueError(f"Categoría con ID {categoria_id} no existe")

        # Fecha por defecto
        if not fecha:
            fecha = timezone.now().date()

        # Crear la compra
        compra = Compra.objects.create(
            proveedor=proveedor,
            categoria=categoria,
            fecha=fecha,
            numero=numero,
            incluye_iva=incluye_iva,
            notas=notas
        )

        # Preparar payload para undo
        undo_lineas = []
        subtotal = Decimal("0")

        # Crear líneas y capturar snapshot
        for linea_data in lineas_data:
            materia_prima_id = linea_data.get('materia_prima')
            descripcion = linea_data.get('descripcion', '')
            cantidad = linea_data.get('cantidad')
            precio_unitario = linea_data.get('precio_unitario')
            total_linea = linea_data.get('total_linea')

            # PASO 1: Capturar snapshot ANTES de crear la línea
            snapshot = {}

            if materia_prima_id and cantidad:
                try:
                    materia_prima = MateriaPrima.objects.select_for_update().get(id=materia_prima_id)

                    # Capturar estado anterior de MateriaPrima
                    snapshot['materia_prima_id'] = str(materia_prima.id)
                    snapshot['materia_prima_nombre'] = materia_prima.nombre
                    snapshot['stock_anterior_mp'] = float(materia_prima.stock)
                    snapshot['precio_promedio_anterior_mp'] = float(materia_prima.precio_promedio)

                    # Capturar estado anterior de StockPorProveedor (si existe)
                    try:
                        stock_proveedor = StockPorProveedor.objects.select_for_update().get(
                            materia_prima=materia_prima,
                            proveedor=proveedor
                        )
                        snapshot['stock_anterior_proveedor'] = float(stock_proveedor.cantidad_stock)
                        snapshot['precio_promedio_proveedor_anterior'] = float(stock_proveedor.precio_promedio)
                    except StockPorProveedor.DoesNotExist:
                        # Primera compra a este proveedor
                        snapshot['stock_anterior_proveedor'] = 0.0
                        snapshot['precio_promedio_proveedor_anterior'] = 0.0

                except MateriaPrima.DoesNotExist:
                    raise ValueError(f"Materia prima con ID {materia_prima_id} no existe")

            # PASO 2: Crear la línea (actualiza stock automáticamente)
            linea = CompraLinea.objects.create(
                compra=compra,
                materia_prima_id=materia_prima_id,
                descripcion=descripcion,
                cantidad=cantidad,
                precio_unitario=precio_unitario,
                total_linea=total_linea
            )

            # PASO 3: Guardar snapshot con datos de la línea
            if snapshot:
                snapshot['compralinea_id'] = str(linea.id)
                snapshot['cantidad'] = float(cantidad) if cantidad else 0.0
                snapshot['precio_unitario'] = float(precio_unitario) if precio_unitario else 0.0
                undo_lineas.append(snapshot)

            subtotal += linea.subtotal

        # Calcular IVA y total
        iva_monto = Decimal("0")
        if incluye_iva:
            iva_monto = subtotal * Decimal("0.21")

        total = subtotal + iva_monto

        # Actualizar compra con totales
        compra.subtotal = subtotal
        compra.iva_monto = iva_monto
        compra.total = total
        compra.save(update_fields=["subtotal", "iva_monto", "total"])

        # Crear MovimientoFinanciero
        descripcion_mov = f"Compra #{compra.numero or compra.id} - {proveedor.nombre}"
        movimiento = MovimientoFinanciero.objects.create(
            compra=compra,
            fecha=fecha,
            tipo=MovimientoFinanciero.Tipo.EGRESO,
            estado=MovimientoFinanciero.Estado.PENDIENTE,
            origen=MovimientoFinanciero.Origen.COMPRA,
            monto=total,
            descripcion=descripcion_mov,
            proveedor=proveedor
        )

        # Registrar acción de undo con snapshot completo
        undo_payload = {
            'compra_id': str(compra.id),
            'compra_numero': compra.numero or str(compra.id),
            'proveedor_id': str(proveedor.id),
            'proveedor_nombre': proveedor.nombre,
            'total': float(total),
            'lineas': undo_lineas,
            'movimiento_financiero_id': str(movimiento.id)
        }

        UndoService.register_action(
            user=user,
            action_type=UndoAction.ActionType.CREATE_COMPRA,
            undo_payload=undo_payload,
            description=f"Crear compra #{compra.numero or compra.id} - ${compra.total}",
            content_object=compra
        )

        return compra
