from django.db import models
from django.utils import timezone
from decimal import Decimal
from datetime import date, timedelta
from clientes.models import Cliente
from productos.models import Producto


# ============================================================================
# MANAGERS PERSONALIZADOS PARA VENTA
# ============================================================================

class VentaQuerySet(models.QuerySet):
    """
    QuerySet personalizado con métodos de filtrado para ventas.
    Permite filtrar ventas activas vs anuladas sin romper queries existentes.
    """

    def activas(self):
        """Solo ventas no anuladas"""
        return self.filter(anulada=False)

    def anuladas(self):
        """Solo ventas anuladas"""
        return self.filter(anulada=True)

    def pendientes(self):
        """
        Solo ventas con pago pendiente (PENDIENTE o PARCIAL).
        Usa índice en estado_pago para mejor performance.
        """
        return self.filter(
            anulada=False,
            estado_pago__in=['PENDIENTE', 'PARCIAL']
        )

    def completamente_pagadas(self):
        """Solo ventas completamente pagadas"""
        return self.filter(anulada=False, estado_pago='PAGADA')


class VentaManager(models.Manager):
    """Manager personalizado para Venta"""

    def get_queryset(self):
        return VentaQuerySet(self.model, using=self._db)

    def activas(self):
        """Retorna solo ventas activas (no anuladas)"""
        return self.get_queryset().activas()

    def anuladas(self):
        """Retorna solo ventas anuladas"""
        return self.get_queryset().anuladas()

    def pendientes(self):
        """Retorna solo ventas con pago pendiente"""
        return self.get_queryset().pendientes()

    def completamente_pagadas(self):
        """Retorna solo ventas completamente pagadas"""
        return self.get_queryset().completamente_pagadas()


# ============================================================================
# MODELOS
# ============================================================================

class Venta(models.Model):
    """
    Estados de pago de una factura
    """
    class EstadoPago(models.TextChoices):
        PENDIENTE = "PENDIENTE", "Pendiente"
        PARCIAL = "PARCIAL", "Pago Parcial"
        PAGADA = "PAGADA", "Pagada Completamente"

    cliente = models.ForeignKey(Cliente, on_delete=models.PROTECT, related_name="ventas")
    fecha = models.DateField(auto_now_add=True)
    numero = models.CharField(max_length=20, blank=True)  # ej. Nro factura

    # Campos de IVA
    incluye_iva = models.BooleanField(default=False, help_text="Si está marcado, se aplica 21% de IVA")
    subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=0, help_text="Monto sin IVA")
    iva_monto = models.DecimalField(max_digits=12, decimal_places=2, default=0, help_text="Monto del IVA (21%)")
    total = models.DecimalField(max_digits=12, decimal_places=2, default=0, help_text="Subtotal + IVA")

    # Campos de cobranzas (reactivados para coincidir con la base de datos)
    fecha_vencimiento = models.DateField(blank=True, null=True, help_text="Fecha límite para el pago")
    condicion_pago = models.CharField(max_length=50, default="Contado", blank=True, null=True, help_text="Ej: Contado, 30 días, 60 días")
    observaciones_cobro = models.TextField(blank=True, default="", help_text="Notas sobre el estado de cobranza")
    fecha_ultimo_recordatorio = models.DateField(blank=True, null=True, help_text="Última vez que se envió recordatorio")
    monto_pagado = models.DecimalField(max_digits=12, decimal_places=2, default=0, help_text="Monto total pagado de esta factura")

    # Estado de pago (calculado automáticamente o actualizado por triggers)
    estado_pago = models.CharField(
        max_length=20,
        choices=EstadoPago.choices,
        default=EstadoPago.PENDIENTE,
        db_index=True,
        help_text="Estado de pago de la factura"
    )

    # Campos de anulación (para sistema de undo)
    anulada = models.BooleanField(default=False, db_index=True, help_text="Marca si la venta fue anulada/deshecha")
    fecha_anulacion = models.DateTimeField(null=True, blank=True, help_text="Fecha y hora en que se anuló la venta")
    motivo_anulacion = models.CharField(max_length=255, blank=True, help_text="Motivo de la anulación")
    anulada_por = models.ForeignKey(
        'usuarios.Usuario',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='ventas_anuladas',
        help_text="Usuario que anuló la venta"
    )

    # Manager personalizado
    objects = VentaManager()

    class Meta:
        ordering = ["-fecha", "-id"]

    def save(self, *args, **kwargs):
        # Funcionalidad simplificada para estabilidad
        super().save(*args, **kwargs)

    @property
    def saldo_pendiente(self):
        """
        Calcula cuánto falta por pagar de esta factura.
        Retorna 0 si la venta está anulada (no tiene deuda contable).
        """
        if self.anulada:
            return Decimal('0')
        return self.total - self.monto_pagado

    @property
    def esta_pagada(self):
        """Verifica si la factura está completamente pagada"""
        return self.monto_pagado >= self.total

    def actualizar_estado_pago(self):
        """
        Actualiza el estado_pago basado en monto_pagado.

        Reglas:
        - PENDIENTE: monto_pagado == 0
        - PARCIAL: 0 < monto_pagado < total
        - PAGADA: monto_pagado >= total
        """
        if self.anulada:
            # Ventas anuladas no tienen estado de pago relevante
            return

        if self.monto_pagado <= 0:
            nuevo_estado = self.EstadoPago.PENDIENTE
        elif self.monto_pagado >= self.total:
            nuevo_estado = self.EstadoPago.PAGADA
        else:
            nuevo_estado = self.EstadoPago.PARCIAL

        if self.estado_pago != nuevo_estado:
            self.estado_pago = nuevo_estado
            self.save(update_fields=['estado_pago'])

    def aplicar_pago(self, monto, pago=None, crear_imputacion=True):
        """
        Aplica un pago a esta factura. Retorna el monto sobrante si el pago excede el saldo.

        Args:
            monto: Monto a aplicar
            pago: Instancia de PagoCliente (opcional, para crear imputación)
            crear_imputacion: Si True, crea registro en ImputacionPago

        Returns:
            Decimal: Monto sobrante (0 si el pago fue exacto o menor que el saldo)

        Raises:
            ValueError: Si la venta está anulada o el monto es inválido.

        IMPORTANTE: Este método actualiza monto_pagado Y crea ImputacionPago.
        """
        # CRÍTICO: Validar que la venta NO esté anulada
        if self.anulada:
            raise ValueError(
                f"No se puede aplicar pago a la venta #{self.numero or self.id} "
                f"porque está anulada"
            )

        monto = Decimal(str(monto))

        if monto <= 0:
            raise ValueError("El monto del pago debe ser positivo")

        saldo = self.saldo_pendiente
        sobrante = Decimal('0')
        monto_aplicado = monto

        if monto >= saldo:
            # El pago cubre todo el saldo pendiente
            monto_aplicado = saldo
            self.monto_pagado = self.total
            sobrante = monto - saldo
        else:
            # El pago es parcial
            self.monto_pagado += monto

        # Guardar monto_pagado
        self.save(update_fields=['monto_pagado'])

        # Actualizar estado de pago
        self.actualizar_estado_pago()

        # Crear imputación si se proveyó el pago
        if crear_imputacion and pago and monto_aplicado > 0:
            from finanzas_reportes.models import ImputacionPago
            ImputacionPago.objects.create(
                pago=pago,
                venta=self,
                monto_imputado=monto_aplicado,
                observaciones=f"Aplicado automáticamente al registrar pago"
            )

        return sobrante

    def marcar_recordatorio_enviado(self):
        """Marca que se envió un recordatorio hoy"""
        self.fecha_ultimo_recordatorio = date.today()
        self.save(update_fields=['fecha_ultimo_recordatorio'])

    def puede_enviar_recordatorio(self):
        """Verifica si se puede enviar recordatorio (no más de uno por semana)"""
        if not self.fecha_ultimo_recordatorio:
            return True
        dias_desde_ultimo = (date.today() - self.fecha_ultimo_recordatorio).days
        return dias_desde_ultimo >= 7

    def __str__(self):
        return f"Venta #{self.numero or self.id} - {self.cliente.nombre}"

class LineaVenta(models.Model):
    venta = models.ForeignKey(Venta, on_delete=models.CASCADE, related_name="lineas")
    producto = models.ForeignKey(Producto, on_delete=models.PROTECT, null=True, blank=True, related_name="lineas_venta")
    descripcion = models.CharField(max_length=200)     # si más adelante tienen Producto, acá va FK
    cantidad = models.DecimalField(max_digits=10, decimal_places=2, default=1, help_text="Cantidad en unidades (para descontar stock)")
    cantidad_kg = models.DecimalField(max_digits=10, decimal_places=3, default=0, help_text="Cantidad en kilogramos (para facturación)")
    precio_unitario = models.DecimalField(max_digits=12, decimal_places=2, default=0, help_text="Precio por kilogramo")

    @property
    def subtotal(self):
        """Calcula el subtotal usando cantidad_kg × precio"""
        return self.cantidad_kg * self.precio_unitario

    def __str__(self):
        return f"{self.descripcion} x {self.cantidad}u ({self.cantidad_kg}kg)"
