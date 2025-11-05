from django.db import models
from django.utils import timezone
from decimal import Decimal
from datetime import date, timedelta
from clientes.models import Cliente
from productos.models import Producto

class Venta(models.Model):
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

    class Meta:
        ordering = ["-fecha", "-id"]

    def save(self, *args, **kwargs):
        # Funcionalidad simplificada para estabilidad
        super().save(*args, **kwargs)

    # NOTA: Propiedades de cobranzas comentadas temporalmente para estabilidad
    # @property
    # def total_pagado(self):
    #     """Calcula el total pagado por el cliente para esta venta"""
    #     from finanzas_reportes.models import PagoCliente
    #     pagos = PagoCliente.objects.filter(cliente=self.cliente, fecha__gte=self.fecha).aggregate(total=models.Sum('monto'))['total'] or Decimal('0')
    #     return min(pagos, self.total)

    # @property
    # def saldo_pendiente(self):
    #     """Calcula cuánto falta por pagar"""
    #     return self.total - self.total_pagado

    # NOTA: Métodos de cobranzas comentados temporalmente para estabilidad
    # def marcar_recordatorio_enviado(self):
    #     """Marca que se envió un recordatorio hoy"""
    #     self.fecha_ultimo_recordatorio = date.today()
    #     self.save(update_fields=['fecha_ultimo_recordatorio'])

    # def puede_enviar_recordatorio(self):
    #     """Verifica si se puede enviar recordatorio (no más de uno por semana)"""
    #     if not self.fecha_ultimo_recordatorio:
    #         return True
    #     dias_desde_ultimo = (date.today() - self.fecha_ultimo_recordatorio).days
    #     return dias_desde_ultimo >= 7

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
