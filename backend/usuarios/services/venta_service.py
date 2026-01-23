"""
Servicio de negocio para gestión de ventas.

Centraliza la lógica de creación y edición de ventas,
integrando el sistema de undo para permitir deshacer operaciones.
"""

from decimal import Decimal
from django.db import transaction
from django.utils import timezone

from ventas.models import Venta, LineaVenta
from productos.models import Producto
from usuarios.models import UndoAction
from .undo_service import UndoService


class VentaService:
    """
    Servicio para operaciones de ventas con soporte de undo.

    Maneja la creación y edición de ventas, asegurando:
    - Validación de stock
    - Cálculo de totales e IVA
    - Registro de acciones deshacibles
    - Transacciones atómicas
    """

    @staticmethod
    def _validar_stock_disponible(lineas_data):
        """
        Valida que hay stock suficiente para todas las líneas.

        Args:
            lineas_data: Lista de dicts con datos de líneas

        Raises:
            ValueError: Si no hay stock suficiente
        """
        for linea_data in lineas_data:
            producto_id = linea_data.get('producto')
            if not producto_id:
                continue

            try:
                producto = Producto.objects.get(id=producto_id)
            except Producto.DoesNotExist:
                raise ValueError(f"Producto con ID {producto_id} no existe")

            cantidad = linea_data.get('cantidad', 0)
            cantidad_kg = linea_data.get('cantidad_kg', 0)

            # Validar stock en unidades
            if cantidad and producto.stock < cantidad:
                raise ValueError(
                    f"Stock insuficiente en unidades para {producto.nombre}. "
                    f"Disponible: {producto.stock} unidades."
                )

            # Validar stock en kilogramos
            if cantidad_kg > 0 and producto.stock_kg < cantidad_kg:
                raise ValueError(
                    f"Stock insuficiente en kg para {producto.nombre}. "
                    f"Disponible: {producto.stock_kg} kg."
                )

    @staticmethod
    @transaction.atomic
    def crear_venta(user, cliente_id, lineas_data, incluye_iva=False,
                   numero="", condicion_pago="Contado", fecha_vencimiento=None,
                   observaciones_cobro=""):
        """
        Crea una nueva venta y registra la acción para poder deshacerla.

        Args:
            user: Usuario que crea la venta
            cliente_id: ID del cliente
            lineas_data: Lista de dicts con: producto, descripcion, cantidad, cantidad_kg, precio_unitario
            incluye_iva: Si se aplica IVA 21%
            numero: Número de factura/remito
            condicion_pago: Condición de pago (ej: "Contado", "30 días")
            fecha_vencimiento: Fecha límite de pago
            observaciones_cobro: Notas sobre cobranza

        Returns:
            Venta creada

        Raises:
            ValueError: Si hay problemas de validación o stock insuficiente
        """
        from clientes.models import Cliente

        # Validar stock disponible ANTES de crear
        VentaService._validar_stock_disponible(lineas_data)

        # Validar que el cliente existe
        try:
            cliente = Cliente.objects.get(id=cliente_id)
        except Cliente.DoesNotExist:
            raise ValueError(f"Cliente con ID {cliente_id} no existe")

        # Crear venta
        venta = Venta.objects.create(
            cliente=cliente,
            incluye_iva=incluye_iva,
            numero=numero,
            condicion_pago=condicion_pago,
            fecha_vencimiento=fecha_vencimiento,
            observaciones_cobro=observaciones_cobro
        )

        # Crear líneas y descontar stock
        subtotal = Decimal("0")
        undo_lineas = []  # Para el payload de undo

        for linea_data in lineas_data:
            producto_id = linea_data.get('producto')
            descripcion = linea_data.get('descripcion', '')
            cantidad = linea_data.get('cantidad', 1)
            cantidad_kg = linea_data.get('cantidad_kg', 0)
            precio_unitario = linea_data.get('precio_unitario', 0)

            # Obtener producto si existe
            producto = None
            if producto_id:
                producto = Producto.objects.select_for_update().get(id=producto_id)

                # Descontar stock
                producto.quitar_stock(cantidad, cantidad_kg=cantidad_kg)

                # Guardar datos para undo
                undo_lineas.append({
                    'producto_id': str(producto.id),
                    'producto_nombre': producto.nombre,
                    'cantidad': float(cantidad),
                    'cantidad_kg': float(cantidad_kg)
                })

            # Crear línea de venta
            linea = LineaVenta.objects.create(
                venta=venta,
                producto=producto,
                descripcion=descripcion,
                cantidad=cantidad,
                cantidad_kg=cantidad_kg,
                precio_unitario=precio_unitario
            )

            subtotal += linea.subtotal

        # Calcular IVA y total
        iva_monto = Decimal("0")
        if incluye_iva:
            iva_monto = subtotal * Decimal("0.21")

        total = subtotal + iva_monto

        # Actualizar venta con totales
        venta.subtotal = subtotal
        venta.iva_monto = iva_monto
        venta.total = total
        venta.save(update_fields=["subtotal", "iva_monto", "total"])

        # Registrar acción para undo
        undo_payload = {
            'venta_id': str(venta.id),
            'venta_numero': venta.numero,
            'cliente_id': str(cliente.id),
            'cliente_nombre': cliente.nombre_fantasia,
            'total': float(total),
            'lineas': undo_lineas
        }

        UndoService.register_action(
            user=user,
            action_type=UndoAction.ActionType.CREATE_VENTA,
            undo_payload=undo_payload,
            description=f"Crear venta #{venta.numero or venta.id} - ${venta.total}",
            content_object=venta
        )

        return venta

    @staticmethod
    def _restaurar_stock(venta):
        """
        Restaura el stock de productos de una venta.

        Args:
            venta: Instancia de Venta
        """
        for linea in venta.lineas.all():
            if linea.producto:
                linea.producto.agregar_stock(
                    cantidad=linea.cantidad,
                    cantidad_kg=linea.cantidad_kg
                )
