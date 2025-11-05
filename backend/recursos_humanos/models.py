from django.db import models
from django.utils import timezone
from datetime import date


class Empleado(models.Model):
    nombre = models.CharField(max_length=120)
    apellidos = models.CharField(max_length=120, blank=True, default="")
    identificacion = models.CharField(max_length=40, blank=True)  # DNI
    cuil = models.CharField(max_length=15, blank=True)
    telefono = models.CharField(max_length=20, blank=True)
    fecha_ingreso = models.DateField(default=date.today)
    direccion = models.CharField(max_length=255, blank=True)
    puesto = models.CharField(max_length=120, blank=True)
    activo = models.BooleanField(default=True)

    class Meta:
        ordering = ["apellidos", "nombre"]

    def __str__(self):
        return f"{self.apellidos}, {self.nombre}"

    @property
    def nombre_completo(self):
        return f"{self.nombre} {self.apellidos}"


class PagoEmpleado(models.Model):
    class MedioPago(models.TextChoices):
        EFECTIVO = "EFECTIVO", "Efectivo"
        TRANSFERENCIA = "TRANSFERENCIA", "Transferencia"
        CHEQUE = "CHEQUE", "Cheque"
        DEPOSITO = "DEPOSITO", "Depósito"

    empleado = models.ForeignKey(Empleado, on_delete=models.PROTECT, related_name="pagos")
    fecha = models.DateField(default=date.today)
    monto = models.DecimalField(max_digits=12, decimal_places=2)
    medio_pago = models.CharField(max_length=20, choices=MedioPago.choices, default=MedioPago.EFECTIVO)
    concepto = models.CharField(max_length=200, blank=True)
    generar_recibo = models.BooleanField(default=False, help_text="Genera recibo de sueldo")

    class Meta:
        ordering = ["-fecha", "-id"]

    def __str__(self):
        return f"Pago {self.monto} a {self.empleado.nombre_completo}"