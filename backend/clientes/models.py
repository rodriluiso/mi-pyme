from django.db import models

class Cliente(models.Model):
    """
    Cliente principal (empresa matriz).
    Representa la entidad legal que puede tener múltiples sucursales.
    """
    nombre_fantasia = models.CharField(
        max_length=200,
        blank=True,
        default='',
        verbose_name="Nombre de Fantasía",
        help_text="Nombre comercial o de fantasía del cliente"
    )
    razon_social = models.CharField(
        max_length=200,
        blank=True,
        default='',
        verbose_name="Razón Social",
        help_text="Razón social legal (opcional, para facturas/remitos)"
    )
    identificacion = models.CharField(
        max_length=20,
        unique=True,
        help_text="CUIT/DNI de la empresa (único por entidad legal)"
    )
    telefono_principal = models.CharField(max_length=20, blank=True)
    correo_principal = models.EmailField(blank=True)

    # Campos de facturación principal
    direccion_fiscal = models.CharField(max_length=200, blank=True)
    localidad_fiscal = models.CharField(max_length=100, blank=True)

    # Campo para observaciones generales
    observaciones = models.TextField(blank=True, help_text="Observaciones generales del cliente")

    activo = models.BooleanField(default=True)
    fecha_creacion = models.DateTimeField(auto_now_add=True, null=True)

    class Meta:
        verbose_name = "Cliente"
        verbose_name_plural = "Clientes"
        ordering = ['nombre_fantasia']

    def __str__(self):
        return self.nombre_fantasia or self.razon_social or f"Cliente #{self.id}"

    @property
    def nombre(self):
        """Compatibilidad con código existente - devuelve nombre fantasía o razón social"""
        return self.nombre_fantasia or self.razon_social or ""

    @property
    def nombre_para_factura(self):
        """Nombre a usar en facturas y remitos - prioriza razón social si existe"""
        return self.razon_social if self.razon_social else (self.nombre_fantasia or "")

    @property
    def saldo(self):
        """
        Calcula el saldo total del cliente (todas las sucursales):
        total de ventas - total de pagos.
        """
        total_ventas = sum(v.total for v in self.ventas.all())
        total_pagos = sum(p.monto for p in self.pagos.all())
        return total_ventas - total_pagos


class SucursalCliente(models.Model):
    """
    Sucursal o punto de entrega de un cliente.
    Cada sucursal puede tener diferentes direcciones de entrega.
    """
    cliente = models.ForeignKey(
        Cliente,
        on_delete=models.CASCADE,
        related_name='sucursales'
    )

    nombre_sucursal = models.CharField(
        max_length=200,
        help_text="Nombre descriptivo de la sucursal"
    )
    codigo_sucursal = models.CharField(
        max_length=50,
        blank=True,
        help_text="Código interno de la sucursal"
    )

    # Datos de contacto específicos de la sucursal
    contacto_responsable = models.CharField(max_length=100, blank=True)
    telefono = models.CharField(max_length=20, blank=True)
    correo = models.EmailField(blank=True)

    # Dirección de entrega
    direccion = models.CharField(max_length=200)
    localidad = models.CharField(max_length=100)
    codigo_postal = models.CharField(max_length=10, blank=True)

    # Control de entregas
    horario_entrega = models.CharField(
        max_length=100,
        blank=True,
        help_text="Horarios preferidos para entrega"
    )
    observaciones = models.TextField(
        blank=True,
        help_text="Observaciones especiales para entregas"
    )

    activo = models.BooleanField(default=True)
    fecha_creacion = models.DateTimeField(auto_now_add=True, null=True)

    class Meta:
        verbose_name = "Sucursal de Cliente"
        verbose_name_plural = "Sucursales de Cliente"
        ordering = ['cliente__nombre_fantasia', 'nombre_sucursal']
        unique_together = ['cliente', 'codigo_sucursal']

    def __str__(self):
        if self.codigo_sucursal:
            return f"{self.cliente.nombre_fantasia} - {self.nombre_sucursal} ({self.codigo_sucursal})"
        return f"{self.cliente.nombre_fantasia} - {self.nombre_sucursal}"

    @property
    def nombre_completo(self):
        """Nombre completo para mostrar en interfaces"""
        return str(self)

    @property
    def direccion_completa(self):
        """Dirección completa formateada"""
        parts = [self.direccion]
        if self.localidad:
            parts.append(self.localidad)
        if self.codigo_postal:
            parts.append(f"({self.codigo_postal})")
        return ", ".join(parts)
