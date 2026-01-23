from decimal import Decimal

from django.core.validators import MinValueValidator
from django.db import models
from django.utils import timezone

from proveedores.models import Proveedor


class MateriaPrima(models.Model):
    """Materias primas que se compran a proveedores para la producción"""
    nombre = models.CharField(max_length=120)
    sku = models.CharField(max_length=50, unique=True, blank=True, null=True)
    descripcion = models.TextField(blank=True)
    unidad_medida = models.CharField(
        max_length=20,
        choices=[
            ('kg', 'Kilogramos'),
            ('g', 'Gramos'),
            ('l', 'Litros'),
            ('ml', 'Mililitros'),
            ('u', 'Unidades'),
            ('m', 'Metros'),
            ('cm', 'Centímetros'),
        ],
        default='u'
    )
    stock = models.DecimalField(
        max_digits=12,
        decimal_places=3,
        default=Decimal("0"),
        validators=[MinValueValidator(0)],
    )
    precio_promedio = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0"),
        validators=[MinValueValidator(0)],
        help_text="Precio promedio ponderado"
    )
    stock_minimo = models.DecimalField(
        max_digits=12,
        decimal_places=3,
        default=Decimal("0"),
        validators=[MinValueValidator(0)],
        help_text="Cantidad mínima para generar alerta de stock bajo"
    )
    activo = models.BooleanField(default=True)

    class Meta:
        ordering = ["nombre"]
        verbose_name = "materia prima"
        verbose_name_plural = "materias primas"

    def __str__(self) -> str:
        display = self.nombre
        if self.sku:
            display = f"{self.nombre} ({self.sku})"
        return display

    def save(self, *args, **kwargs):
        """Convertir SKU vacío en NULL para evitar conflictos de unicidad"""
        if self.sku == '':
            self.sku = None
        super().save(*args, **kwargs)

    def _normalizar_cantidad(self, cantidad) -> Decimal:
        if cantidad is None:
            raise ValueError("Debes indicar una cantidad válida")
        if not isinstance(cantidad, Decimal):
            cantidad = Decimal(str(cantidad))
        if cantidad <= 0:
            raise ValueError("La cantidad debe ser positiva")
        return cantidad

    def agregar_stock(self, cantidad, precio_unitario=None) -> None:
        """Agregar stock con precio promedio ponderado"""
        cantidad = self._normalizar_cantidad(cantidad)

        if precio_unitario and self.stock > 0:
            # Calcular precio promedio ponderado
            stock_anterior = self.stock
            precio_anterior = self.precio_promedio

            valor_anterior = stock_anterior * precio_anterior
            valor_nuevo = cantidad * Decimal(str(precio_unitario))

            nuevo_stock = stock_anterior + cantidad
            self.precio_promedio = (valor_anterior + valor_nuevo) / nuevo_stock
        elif precio_unitario:
            # Primer ingreso
            self.precio_promedio = Decimal(str(precio_unitario))

        self.stock += cantidad
        self.save(update_fields=["stock", "precio_promedio"])

    def quitar_stock(self, cantidad) -> None:
        cantidad = self._normalizar_cantidad(cantidad)
        if cantidad > self.stock:
            raise ValueError("La cantidad supera el stock disponible")
        self.stock -= cantidad
        self.save(update_fields=["stock"])

    def tiene_stock_bajo(self) -> bool:
        """Verifica si la materia prima tiene stock por debajo del mínimo."""
        return self.stock_minimo > 0 and self.stock <= self.stock_minimo

    @classmethod
    def materias_primas_con_stock_bajo(cls):
        """Retorna materias primas activas con stock por debajo del mínimo."""
        return cls.objects.filter(
            activo=True,
            stock_minimo__gt=0,
            stock__lte=models.F('stock_minimo')
        )


class AjusteStockMateriaPrima(models.Model):
    """Historial de ajustes de stock manuales para materias primas"""
    class TipoAjuste(models.TextChoices):
        ENTRADA = "ENTRADA", "Entrada (agregar stock)"
        SALIDA = "SALIDA", "Salida (quitar stock)"
        CORRECCION = "CORRECCION", "Corrección de inventario"
        MERMA = "MERMA", "Merma/pérdida"
        DEVOLUCION = "DEVOLUCION", "Devolución"

    materia_prima = models.ForeignKey(
        MateriaPrima,
        on_delete=models.PROTECT,
        related_name="ajustes_stock"
    )
    proveedor = models.ForeignKey(
        Proveedor,
        on_delete=models.PROTECT,
        related_name="ajustes_stock_materias",
        null=True,
        blank=True,
        help_text="Proveedor específico afectado por el ajuste (para salidas/consumos)"
    )
    fecha = models.DateTimeField(auto_now_add=True)
    tipo_ajuste = models.CharField(
        max_length=20,
        choices=TipoAjuste.choices,
        default=TipoAjuste.CORRECCION
    )
    cantidad = models.DecimalField(
        max_digits=12,
        decimal_places=3,
        help_text="Cantidad ajustada (positiva para entrada, negativa para salida)"
    )
    stock_anterior = models.DecimalField(
        max_digits=12,
        decimal_places=3,
        help_text="Stock antes del ajuste"
    )
    stock_nuevo = models.DecimalField(
        max_digits=12,
        decimal_places=3,
        help_text="Stock después del ajuste"
    )
    motivo = models.CharField(max_length=255, help_text="Motivo del ajuste")
    usuario = models.CharField(max_length=100, blank=True, help_text="Usuario que realizó el ajuste")

    class Meta:
        ordering = ["-fecha"]
        verbose_name = "ajuste de stock"
        verbose_name_plural = "ajustes de stock"

    def __str__(self):
        signo = "+" if self.cantidad >= 0 else ""
        return f"{self.materia_prima.nombre}: {signo}{self.cantidad} ({self.get_tipo_ajuste_display()})"


class CategoriaCompra(models.Model):
    nombre = models.CharField(max_length=100, unique=True)
    descripcion = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ["nombre"]
        verbose_name = "categoría de compra"
        verbose_name_plural = "categorías de compra"

    def __str__(self) -> str:
        return self.nombre


# ============================================================================
# MANAGERS PERSONALIZADOS PARA COMPRA
# ============================================================================

class CompraQuerySet(models.QuerySet):
    """
    QuerySet personalizado con métodos de filtrado para compras.
    Permite filtrar compras activas vs anuladas sin romper queries existentes.
    """

    def activas(self):
        """Solo compras no anuladas"""
        return self.filter(anulada=False)

    def anuladas(self):
        """Solo compras anuladas"""
        return self.filter(anulada=True)


class CompraManager(models.Manager):
    """Manager personalizado para Compra"""

    def get_queryset(self):
        return CompraQuerySet(self.model, using=self._db)

    def activas(self):
        """Retorna solo compras activas (no anuladas)"""
        return self.get_queryset().activas()

    def anuladas(self):
        """Retorna solo compras anuladas"""
        return self.get_queryset().anuladas()


class Compra(models.Model):
    proveedor = models.ForeignKey(Proveedor, on_delete=models.PROTECT, related_name="compras")
    categoria = models.ForeignKey(
        CategoriaCompra, on_delete=models.SET_NULL, null=True, blank=True, related_name="compras"
    )
    fecha = models.DateField(default=timezone.now)
    numero = models.CharField(max_length=40, blank=True)

    # Campos de IVA (igual que en Ventas)
    incluye_iva = models.BooleanField(default=False, help_text="Si está marcado, se aplica 21% de IVA")
    subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"), help_text="Monto sin IVA")
    iva_monto = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"), help_text="Monto del IVA (21%)")
    total = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"), help_text="Subtotal + IVA")

    notas = models.TextField(blank=True)

    # Campos de anulación (para sistema de undo)
    anulada = models.BooleanField(default=False, db_index=True, help_text="Marca si la compra fue anulada/deshecha")
    fecha_anulacion = models.DateTimeField(null=True, blank=True, help_text="Fecha y hora en que se anuló la compra")
    motivo_anulacion = models.CharField(max_length=255, blank=True, help_text="Motivo de la anulación")
    anulada_por = models.ForeignKey(
        'usuarios.Usuario',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='compras_anuladas',
        help_text="Usuario que anuló la compra"
    )

    # Manager personalizado
    objects = CompraManager()

    class Meta:
        ordering = ["-fecha", "-id"]

    def __str__(self) -> str:
        return f"Compra #{self.numero or self.id} - {self.proveedor.nombre}"

    def recalcular_total(self) -> Decimal:
        """Recalcula subtotal, IVA y total desde las líneas"""
        subtotal = sum((linea.subtotal for linea in self.lineas.all()), Decimal("0"))
        iva_monto = Decimal("0")

        if self.incluye_iva:
            iva_monto = subtotal * Decimal("0.21")  # 21% de IVA

        total = subtotal + iva_monto

        self.subtotal = subtotal
        self.iva_monto = iva_monto
        self.total = total
        self.save(update_fields=["subtotal", "iva_monto", "total"])
        return total


class StockPorProveedor(models.Model):
    """Mantiene el stock de cada materia prima desglosado por proveedor"""
    materia_prima = models.ForeignKey(
        MateriaPrima,
        on_delete=models.CASCADE,
        related_name="stock_por_proveedor"
    )
    proveedor = models.ForeignKey(
        Proveedor,
        on_delete=models.CASCADE,
        related_name="stock_materias_primas"
    )
    cantidad_stock = models.DecimalField(
        max_digits=12,
        decimal_places=3,
        default=Decimal("0"),
        validators=[MinValueValidator(0)],
        help_text="Cantidad en stock de esta materia prima proveniente de este proveedor"
    )
    precio_promedio = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0"),
        validators=[MinValueValidator(0)],
        help_text="Precio promedio ponderado de compras a este proveedor"
    )
    ultima_compra = models.DateField(
        null=True,
        blank=True,
        help_text="Fecha de la última compra a este proveedor"
    )
    total_comprado = models.DecimalField(
        max_digits=12,
        decimal_places=3,
        default=Decimal("0"),
        help_text="Total histórico comprado a este proveedor"
    )

    class Meta:
        unique_together = [["materia_prima", "proveedor"]]
        ordering = ["materia_prima__nombre", "proveedor__nombre"]
        verbose_name = "stock por proveedor"
        verbose_name_plural = "stock por proveedor"

    def __str__(self):
        return f"{self.materia_prima.nombre} - {self.proveedor.nombre}: {self.cantidad_stock}"

    def agregar_cantidad(self, cantidad, precio_unitario=None):
        """Agregar cantidad de stock para este proveedor"""
        cantidad = Decimal(str(cantidad))
        if cantidad <= 0:
            raise ValueError("La cantidad debe ser positiva")

        # Actualizar precio promedio ponderado si se proporciona precio
        if precio_unitario and self.cantidad_stock > 0:
            precio_unitario = Decimal(str(precio_unitario))
            valor_anterior = self.cantidad_stock * self.precio_promedio
            valor_nuevo = cantidad * precio_unitario
            nueva_cantidad = self.cantidad_stock + cantidad
            self.precio_promedio = (valor_anterior + valor_nuevo) / nueva_cantidad
        elif precio_unitario:
            self.precio_promedio = Decimal(str(precio_unitario))

        self.cantidad_stock += cantidad
        self.total_comprado += cantidad
        self.save()

    def quitar_cantidad(self, cantidad):
        """Quitar cantidad de stock para este proveedor"""
        cantidad = Decimal(str(cantidad))
        if cantidad <= 0:
            raise ValueError("La cantidad debe ser positiva")
        if cantidad > self.cantidad_stock:
            raise ValueError("La cantidad supera el stock disponible de este proveedor")

        self.cantidad_stock -= cantidad
        self.save()


class CompraLinea(models.Model):
    compra = models.ForeignKey(Compra, on_delete=models.CASCADE, related_name="lineas")
    materia_prima = models.ForeignKey(
        MateriaPrima,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="compras"
    )
    descripcion = models.CharField(max_length=200)
    cantidad = models.DecimalField(max_digits=10, decimal_places=3, null=True, blank=True)
    precio_unitario = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    total_linea = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)

    class Meta:
        ordering = ["id"]

    @property
    def subtotal(self) -> Decimal:
        if self.total_linea is not None:
            return self.total_linea
        cantidad = self.cantidad or Decimal("0")
        precio = self.precio_unitario or Decimal("0")
        return cantidad * precio

    @property
    def unidades_para_stock(self) -> Decimal:
        return self.cantidad or Decimal("0")

    def __str__(self) -> str:
        return f"{self.descripcion} x {self.cantidad or 0}"

    def save(self, *args, **kwargs):
        """Al guardar, actualizar stock de materia prima si está asociada"""
        is_new = self.pk is None
        old_cantidad = None
        old_precio = None

        if not is_new:
            # Obtener cantidad anterior para revertir stock
            old_obj = CompraLinea.objects.filter(pk=self.pk).first()
            if old_obj:
                old_cantidad = old_obj.cantidad
                old_precio = old_obj.precio_unitario

        super().save(*args, **kwargs)

        # Actualizar stock de materia prima y stock por proveedor
        if self.materia_prima and self.cantidad and self.precio_unitario:
            if old_cantidad:
                # Revertir cantidad anterior
                self.materia_prima.quitar_stock(old_cantidad)

                # Revertir del stock por proveedor también
                if old_precio:
                    stock_proveedor, _ = StockPorProveedor.objects.get_or_create(
                        materia_prima=self.materia_prima,
                        proveedor=self.compra.proveedor,
                        defaults={
                            'cantidad_stock': Decimal('0'),
                            'precio_promedio': Decimal('0'),
                            'ultima_compra': self.compra.fecha,
                            'total_comprado': Decimal('0')
                        }
                    )
                    if stock_proveedor.cantidad_stock >= old_cantidad:
                        stock_proveedor.cantidad_stock -= old_cantidad
                        stock_proveedor.save()

            # Agregar nueva cantidad al stock total
            self.materia_prima.agregar_stock(self.cantidad, self.precio_unitario)

            # Agregar nueva cantidad al stock por proveedor
            stock_proveedor, created = StockPorProveedor.objects.get_or_create(
                materia_prima=self.materia_prima,
                proveedor=self.compra.proveedor,
                defaults={
                    'cantidad_stock': Decimal('0'),
                    'precio_promedio': self.precio_unitario,
                    'ultima_compra': self.compra.fecha,
                    'total_comprado': Decimal('0')
                }
            )

            # Actualizar el stock por proveedor
            stock_proveedor.agregar_cantidad(self.cantidad, self.precio_unitario)
            stock_proveedor.ultima_compra = self.compra.fecha
            stock_proveedor.save()