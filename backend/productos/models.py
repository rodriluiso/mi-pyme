from decimal import Decimal

from django.core.validators import MinValueValidator
from django.db import models


class Producto(models.Model):
    nombre = models.CharField(max_length=120)
    sku = models.CharField(max_length=50, unique=True, blank=True, null=True)
    descripcion = models.TextField(blank=True)
    precio = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0"),
        validators=[MinValueValidator(0)],
    )
    stock = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0"),
        validators=[MinValueValidator(0)],
        help_text="Stock en unidades"
    )
    stock_kg = models.DecimalField(
        max_digits=12,
        decimal_places=3,
        default=Decimal("0"),
        validators=[MinValueValidator(0)],
        help_text="Stock en kilogramos"
    )
    stock_minimo = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0"),
        validators=[MinValueValidator(0)],
        help_text="Cantidad mínima de unidades para generar alerta de stock bajo"
    )
    stock_minimo_kg = models.DecimalField(
        max_digits=12,
        decimal_places=3,
        default=Decimal("0"),
        validators=[MinValueValidator(0)],
        help_text="Cantidad mínima de kg para generar alerta de stock bajo"
    )
    activo = models.BooleanField(default=True)

    class Meta:
        ordering = ["nombre"]
        verbose_name = "producto"
        verbose_name_plural = "productos"

    def __str__(self) -> str:
        display = self.nombre
        if self.sku:
            display = f"{self.nombre} ({self.sku})"
        return display

    def _normalizar_cantidad(self, cantidad) -> Decimal:
        if cantidad is None:
            raise ValueError("Debes indicar una cantidad válida")
        if not isinstance(cantidad, Decimal):
            cantidad = Decimal(str(cantidad))
        if cantidad <= 0:
            raise ValueError("La cantidad debe ser positiva")
        return cantidad

    def agregar_stock(self, cantidad, cantidad_kg=None) -> None:
        cantidad = self._normalizar_cantidad(cantidad)
        self.stock += cantidad

        if cantidad_kg is not None:
            cantidad_kg = Decimal(str(cantidad_kg))
            if cantidad_kg < 0:
                raise ValueError("La cantidad en kg no puede ser negativa")
            self.stock_kg += cantidad_kg

        self.save(update_fields=["stock", "stock_kg"])

    def quitar_stock(self, cantidad, cantidad_kg=None) -> None:
        cantidad = self._normalizar_cantidad(cantidad)
        if cantidad > self.stock:
            raise ValueError("La cantidad supera el stock disponible")
        self.stock -= cantidad

        if cantidad_kg is not None:
            cantidad_kg = Decimal(str(cantidad_kg))
            if cantidad_kg < 0:
                raise ValueError("La cantidad en kg no puede ser negativa")
            if cantidad_kg > self.stock_kg:
                raise ValueError("La cantidad en kg supera el stock disponible")
            self.stock_kg -= cantidad_kg

        self.save(update_fields=["stock", "stock_kg"])

    def tiene_stock_bajo(self) -> bool:
        """Verifica si el producto tiene stock por debajo del mínimo."""
        return self.stock_minimo > 0 and self.stock <= self.stock_minimo

    @classmethod
    def productos_con_stock_bajo(cls):
        """Retorna productos activos con stock por debajo del mínimo."""
        return cls.objects.filter(
            activo=True,
            stock_minimo__gt=0,
            stock__lte=models.F('stock_minimo')
        )