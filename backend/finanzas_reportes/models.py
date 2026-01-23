from decimal import Decimal

from django.db import models
from django.utils import timezone
from django.db.models import Sum

from clientes.models import Cliente
from proveedores.models import Proveedor


class MedioPago(models.TextChoices):
    EFECTIVO = "EFECTIVO", "Efectivo"
    TRANSFERENCIA = "TRANSFERENCIA", "Transferencia"
    CHEQUE = "CHEQUE", "Cheque"


# ============================================================================
# MANAGERS PERSONALIZADOS PARA PAGOCLIENTE
# ============================================================================

class PagoClienteQuerySet(models.QuerySet):
    """
    QuerySet personalizado con métodos de filtrado para pagos de clientes.
    Permite filtrar pagos activos vs anulados sin romper queries existentes.
    """

    def activas(self):
        """Solo pagos no anulados"""
        return self.filter(anulado=False)

    def anuladas(self):
        """Solo pagos anulados"""
        return self.filter(anulado=True)


class PagoClienteManager(models.Manager):
    """Manager personalizado para PagoCliente"""

    def get_queryset(self):
        return PagoClienteQuerySet(self.model, using=self._db)

    def activas(self):
        """Retorna solo pagos activos (no anulados)"""
        return self.get_queryset().activas()

    def anuladas(self):
        """Retorna solo pagos anulados"""
        return self.get_queryset().anuladas()


class PagoCliente(models.Model):
    Medio = MedioPago

    cliente = models.ForeignKey(Cliente, on_delete=models.PROTECT, related_name="pagos")
    venta = models.ForeignKey(
        "ventas.Venta",
        on_delete=models.SET_NULL,
        related_name="pagos",
        null=True,
        blank=True,
        help_text="Factura/venta asociada a este pago (opcional, para clientes que pagan por factura)"
    )
    fecha = models.DateField(default=timezone.now)
    monto = models.DecimalField(max_digits=12, decimal_places=2)
    medio = models.CharField(max_length=20, choices=MedioPago.choices, default=MedioPago.EFECTIVO)
    observacion = models.CharField(max_length=200, blank=True)

    # Campos de anulación (para sistema de undo)
    anulado = models.BooleanField(default=False, db_index=True, help_text="Marca si el pago fue anulado/deshecho")
    fecha_anulacion = models.DateTimeField(null=True, blank=True, help_text="Fecha y hora en que se anuló el pago")
    anulado_por = models.ForeignKey(
        'usuarios.Usuario',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='pagos_anulados',
        help_text="Usuario que anuló el pago"
    )

    # Manager personalizado
    objects = PagoClienteManager()

    class Meta:
        ordering = ["-fecha", "-id"]

    def __str__(self):
        venta_info = f" - Factura #{self.venta.numero or self.venta.id}" if self.venta else ""
        return f"Pago {self.monto} de {self.cliente.nombre} ({self.get_medio_display()}){venta_info}"


class PagoProveedor(models.Model):
    Medio = MedioPago

    proveedor = models.ForeignKey(Proveedor, on_delete=models.PROTECT, related_name="pagos")
    fecha = models.DateField(default=timezone.now)
    monto = models.DecimalField(max_digits=12, decimal_places=2)
    medio = models.CharField(max_length=20, choices=MedioPago.choices, default=MedioPago.EFECTIVO)
    observacion = models.CharField(max_length=200, blank=True)

    class Meta:
        ordering = ["-fecha", "-id"]

    def __str__(self):
        return f"Pago a {self.proveedor.nombre} por {self.monto}"


class MovimientoFinanciero(models.Model):
    class Tipo(models.TextChoices):
        INGRESO = "INGRESO", "Ingreso"
        EGRESO = "EGRESO", "Egreso"

    class Estado(models.TextChoices):
        PENDIENTE = "PENDIENTE", "Pendiente"
        PAGADO = "PAGADO", "Pagado"
        COBRADO = "COBRADO", "Cobrado"
        PARCIAL = "PARCIAL", "Pago Parcial"
        CANCELADO = "CANCELADO", "Cancelado"

    class Origen(models.TextChoices):
        MANUAL = "MANUAL", "Manual"
        SERVICIO = "SERVICIO", "Servicio"
        GASTOS_VARIOS = "GASTOS_VARIOS", "Gastos varios"
        IMPUESTO = "IMPUESTO", "Impuesto"
        COMPRA = "COMPRA", "Compra"
        VENTA = "VENTA", "Venta"
        PAGO_EMPLEADO = "PAGO_EMPLEADO", "Pago empleado"
        PAGO_PROVEEDOR = "PAGO_PROVEEDOR", "Pago proveedor"

        @classmethod
        def gastos_registrables(cls):
            return [cls.SERVICIO, cls.GASTOS_VARIOS, cls.IMPUESTO, cls.PAGO_EMPLEADO]

    fecha = models.DateField(default=timezone.now)
    tipo = models.CharField(max_length=10, choices=Tipo.choices)
    estado = models.CharField(max_length=15, choices=Estado.choices, default=Estado.PAGADO)
    origen = models.CharField(max_length=20, choices=Origen.choices, default=Origen.MANUAL)
    monto = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"))
    monto_pagado = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"), help_text="Monto ya pagado (para pagos parciales)")
    descripcion = models.CharField(max_length=255, blank=True)
    fecha_vencimiento = models.DateField(null=True, blank=True, help_text="Fecha límite de pago (para compras a crédito)")
    proveedor = models.ForeignKey(
        "proveedores.Proveedor",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="movimientos_financieros",
        help_text="Proveedor al que se le debe (para egresos)"
    )
    compra = models.OneToOneField(
        "compras.Compra",
        on_delete=models.CASCADE,
        related_name="movimiento_financiero",
        null=True,
        blank=True,
    )
    venta = models.OneToOneField(
        "ventas.Venta",
        on_delete=models.CASCADE,
        related_name="movimiento_financiero",
        null=True,
        blank=True,
    )
    referencia_extra = models.CharField(max_length=100, blank=True)
    medio_pago = models.CharField(
        max_length=20,
        choices=MedioPago.choices,
        null=True,
        blank=True,
        help_text="Medio con el que se registró el cobro/pago real",
    )

    class Meta:
        ordering = ["-fecha", "-id"]
        verbose_name = "movimiento financiero"
        verbose_name_plural = "movimientos financieros"

    def __str__(self) -> str:
        return f"{self.get_tipo_display()} - {self.monto} ({self.get_origen_display()})"

    @property
    def monto_pendiente(self):
        """Calcula el monto pendiente de pago"""
        return self.monto - self.monto_pagado

    @property
    def esta_vencido(self):
        """Verifica si el movimiento está vencido (solo para pendientes)"""
        if self.estado != self.Estado.PENDIENTE or not self.fecha_vencimiento:
            return False
        from django.utils import timezone
        return self.fecha_vencimiento < timezone.now().date()

    def registrar_pago(self, monto_pago, fecha_pago=None):
        """Registra un pago parcial o total"""
        from django.utils import timezone

        if fecha_pago is None:
            fecha_pago = timezone.now().date()

        monto_pago = Decimal(str(monto_pago))

        if monto_pago <= 0:
            raise ValueError("El monto del pago debe ser positivo")

        if self.monto_pagado + monto_pago > self.monto:
            raise ValueError("El pago excede el monto total adeudado")

        self.monto_pagado += monto_pago

        # Actualizar estado según el pago
        if self.monto_pagado >= self.monto:
            self.estado = self.Estado.PAGADO
        elif self.monto_pagado > 0:
            self.estado = self.Estado.PARCIAL

        self.save()

        return self.monto_pendiente

    @classmethod
    def pendientes_por_pagar(cls):
        """Retorna todos los movimientos pendientes de pago"""
        return cls.objects.filter(
            tipo=cls.Tipo.EGRESO,
            estado__in=[cls.Estado.PENDIENTE, cls.Estado.PARCIAL]
        ).order_by('fecha_vencimiento', 'fecha')

    @classmethod
    def total_pendiente_pagar(cls):
        """Calcula el total pendiente por pagar"""
        movimientos = cls.pendientes_por_pagar()
        return sum(mov.monto_pendiente for mov in movimientos)


class CuentaBancaria(models.Model):
    """Modelo para representar cuentas bancarias de la empresa"""
    banco = models.CharField(max_length=100)
    numero_cuenta = models.CharField(max_length=50, unique=True)
    tipo_cuenta = models.CharField(max_length=50, choices=[
        ('CORRIENTE', 'Cuenta Corriente'),
        ('AHORRO', 'Caja de Ahorro'),
        ('PLAZO_FIJO', 'Plazo Fijo'),
    ], default='CORRIENTE')
    titular = models.CharField(max_length=100)
    cbu = models.CharField(max_length=22, blank=True)
    alias = models.CharField(max_length=20, blank=True)
    saldo_actual = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"))
    fecha_creacion = models.DateTimeField(auto_now_add=True)
    activa = models.BooleanField(default=True)

    class Meta:
        ordering = ['banco', 'numero_cuenta']
        verbose_name = "cuenta bancaria"
        verbose_name_plural = "cuentas bancarias"

    def __str__(self):
        return f"{self.banco} - {self.numero_cuenta} ({self.titular})"


class ExtractoBancario(models.Model):
    """Modelo para almacenar extractos bancarios importados"""
    cuenta_bancaria = models.ForeignKey(CuentaBancaria, on_delete=models.CASCADE, related_name="extractos")
    archivo_nombre = models.CharField(max_length=255)
    fecha_importacion = models.DateTimeField(auto_now_add=True)
    fecha_desde = models.DateField()
    fecha_hasta = models.DateField()
    saldo_inicial = models.DecimalField(max_digits=12, decimal_places=2)
    saldo_final = models.DecimalField(max_digits=12, decimal_places=2)
    total_movimientos = models.IntegerField(default=0)
    procesado = models.BooleanField(default=False)

    class Meta:
        ordering = ['-fecha_importacion']
        verbose_name = "extracto bancario"
        verbose_name_plural = "extractos bancarios"

    def __str__(self):
        return f"Extracto {self.cuenta_bancaria.banco} - {self.fecha_desde} a {self.fecha_hasta}"


class MovimientoBancario(models.Model):
    """Modelo para movimientos individuales del extracto bancario"""
    extracto = models.ForeignKey(ExtractoBancario, on_delete=models.CASCADE, related_name="movimientos")
    fecha = models.DateField()
    descripcion = models.CharField(max_length=255)
    referencia = models.CharField(max_length=100, blank=True)
    debito = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    credito = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    saldo = models.DecimalField(max_digits=12, decimal_places=2)
    conciliado = models.BooleanField(default=False)
    movimiento_financiero = models.ForeignKey(
        MovimientoFinanciero,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="movimiento_bancario"
    )
    observaciones = models.TextField(blank=True)

    class Meta:
        ordering = ['fecha', 'id']
        verbose_name = "movimiento bancario"
        verbose_name_plural = "movimientos bancarios"

    def __str__(self):
        tipo = "Débito" if self.debito else "Crédito"
        monto = self.debito or self.credito
        return f"{tipo} {monto} - {self.descripcion[:50]}"

    @property
    def monto(self):
        """Devuelve el monto del movimiento (positivo para créditos, negativo para débitos)"""
        if self.credito:
            return self.credito
        elif self.debito:
            return -self.debito
        return Decimal("0")


class ConciliacionBancaria(models.Model):
    """Modelo para registrar conciliaciones bancarias"""
    cuenta_bancaria = models.ForeignKey(CuentaBancaria, on_delete=models.CASCADE, related_name="conciliaciones")
    fecha_conciliacion = models.DateField()
    fecha_creacion = models.DateTimeField(auto_now_add=True)
    saldo_libro = models.DecimalField(max_digits=12, decimal_places=2)
    saldo_banco = models.DecimalField(max_digits=12, decimal_places=2)
    diferencia = models.DecimalField(max_digits=12, decimal_places=2)
    observaciones = models.TextField(blank=True)
    usuario = models.CharField(max_length=100, blank=True)  # En el futuro se puede conectar con User

    class Meta:
        ordering = ['-fecha_conciliacion']
        verbose_name = "conciliación bancaria"
        verbose_name_plural = "conciliaciones bancarias"
        unique_together = ['cuenta_bancaria', 'fecha_conciliacion']

    def __str__(self):
        return f"Conciliación {self.cuenta_bancaria.banco} - {self.fecha_conciliacion}"

    def save(self, *args, **kwargs):
        # Calcular la diferencia automáticamente
        self.diferencia = self.saldo_banco - self.saldo_libro
        super().save(*args, **kwargs)


class ConfiguracionAFIP(models.Model):
    """Configuración para integración con AFIP"""
    cuit = models.CharField(max_length=11, unique=True)
    razon_social = models.CharField(max_length=255)
    ambiente = models.CharField(max_length=20, choices=[
        ('testing', 'Homologación'),
        ('production', 'Producción'),
    ], default='testing')
    certificado_path = models.CharField(max_length=500, help_text="Ruta al archivo .crt")
    clave_privada_path = models.CharField(max_length=500, help_text="Ruta al archivo .key")
    punto_venta = models.IntegerField(default=1)
    activa = models.BooleanField(default=True)
    fecha_creacion = models.DateTimeField(auto_now_add=True)
    ultima_actualizacion = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "configuración AFIP"
        verbose_name_plural = "configuraciones AFIP"

    def __str__(self):
        return f"AFIP {self.cuit} - {self.get_ambiente_display()}"


class FacturaElectronica(models.Model):
    """Modelo para facturas electrónicas AFIP"""

    class TipoComprobante(models.TextChoices):
        FACTURA_A = "1", "Factura A"
        FACTURA_B = "6", "Factura B"
        FACTURA_C = "11", "Factura C"
        NOTA_DEBITO_A = "2", "Nota de Débito A"
        NOTA_DEBITO_B = "7", "Nota de Débito B"
        NOTA_DEBITO_C = "12", "Nota de Débito C"
        NOTA_CREDITO_A = "3", "Nota de Crédito A"
        NOTA_CREDITO_B = "8", "Nota de Crédito B"
        NOTA_CREDITO_C = "13", "Nota de Crédito C"

    class TipoDocumento(models.TextChoices):
        CUIT = "80", "CUIT"
        CUIL = "86", "CUIL"
        CDI = "87", "CDI"
        LE = "89", "LE"
        LC = "90", "LC"
        CI = "91", "CI Extranjera"
        EN_TRAMITE = "92", "En Trámite"
        ACTA_NACIMIENTO = "93", "Acta Nacimiento"
        CI_BS_AS = "95", "CI Buenos Aires"
        DNI = "96", "DNI"
        PASAPORTE = "94", "Pasaporte"

    class Estado(models.TextChoices):
        BORRADOR = "BORRADOR", "Borrador"
        PENDIENTE = "PENDIENTE", "Pendiente de Envío"
        ENVIADO = "ENVIADO", "Enviado a AFIP"
        APROBADO = "APROBADO", "Aprobado por AFIP"
        RECHAZADO = "RECHAZADO", "Rechazado por AFIP"
        ANULADO = "ANULADO", "Anulado"

    # Datos básicos
    configuracion_afip = models.ForeignKey(ConfiguracionAFIP, on_delete=models.PROTECT)
    tipo_comprobante = models.CharField(max_length=2, choices=TipoComprobante.choices)
    punto_venta = models.IntegerField()
    numero_comprobante = models.IntegerField(null=True, blank=True)
    fecha_emision = models.DateField(default=timezone.now)
    fecha_vencimiento = models.DateField(null=True, blank=True)

    # Cliente/Receptor
    cliente_tipo_documento = models.CharField(max_length=2, choices=TipoDocumento.choices, default=TipoDocumento.DNI)
    cliente_numero_documento = models.CharField(max_length=20)
    cliente_razon_social = models.CharField(max_length=255)
    cliente_email = models.EmailField(blank=True)
    cliente_domicilio = models.CharField(max_length=255, blank=True)

    # Importes
    importe_total = models.DecimalField(max_digits=12, decimal_places=2)
    importe_neto = models.DecimalField(max_digits=12, decimal_places=2)
    importe_iva = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"))
    importe_otros_tributos = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"))

    # Control AFIP
    cae = models.CharField(max_length=14, blank=True, null=True, help_text="Código de Autorización Electrónico")
    fecha_vencimiento_cae = models.DateField(null=True, blank=True)
    estado = models.CharField(max_length=20, choices=Estado.choices, default=Estado.BORRADOR)
    observaciones_afip = models.TextField(blank=True)

    # Control interno
    venta = models.OneToOneField(
        "ventas.Venta",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="factura_electronica"
    )
    fecha_creacion = models.DateTimeField(auto_now_add=True)
    fecha_autorizacion = models.DateTimeField(null=True, blank=True)
    usuario_creacion = models.CharField(max_length=100, blank=True)

    class Meta:
        ordering = ['-fecha_emision', '-numero_comprobante']
        verbose_name = "factura electrónica"
        verbose_name_plural = "facturas electrónicas"
        unique_together = ['configuracion_afip', 'tipo_comprobante', 'punto_venta', 'numero_comprobante']

    def __str__(self):
        numero = self.numero_comprobante or "SIN NÚMERO"
        return f"{self.get_tipo_comprobante_display()} {self.punto_venta:04d}-{numero:08d}"

    @property
    def numero_completo(self):
        """Retorna el número completo del comprobante"""
        if self.numero_comprobante:
            return f"{self.punto_venta:04d}-{self.numero_comprobante:08d}"
        return "PENDIENTE"

    def save(self, *args, **kwargs):
        # Validar que los importes sean consistentes
        if abs(self.importe_total - (self.importe_neto + self.importe_iva + self.importe_otros_tributos)) > Decimal("0.01"):
            raise ValueError("Los importes no son consistentes")
        super().save(*args, **kwargs)


class DetalleFacturaElectronica(models.Model):
    """Detalle de items de la factura electrónica"""
    factura = models.ForeignKey(FacturaElectronica, on_delete=models.CASCADE, related_name="detalles")
    descripcion = models.CharField(max_length=255)
    cantidad = models.DecimalField(max_digits=10, decimal_places=2)
    precio_unitario = models.DecimalField(max_digits=12, decimal_places=2)
    alicuota_iva = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("21.00"))
    importe_neto = models.DecimalField(max_digits=12, decimal_places=2)
    importe_iva = models.DecimalField(max_digits=12, decimal_places=2)
    importe_total = models.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        verbose_name = "detalle factura electrónica"
        verbose_name_plural = "detalles factura electrónica"

    def save(self, *args, **kwargs):
        # Calcular importes automáticamente
        self.importe_neto = self.cantidad * self.precio_unitario
        self.importe_iva = self.importe_neto * (self.alicuota_iva / 100)
        self.importe_total = self.importe_neto + self.importe_iva
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.descripcion} x {self.cantidad}"


class LogAFIP(models.Model):
    """Log de comunicaciones con AFIP"""
    factura = models.ForeignKey(FacturaElectronica, on_delete=models.CASCADE, related_name="logs")
    fecha_hora = models.DateTimeField(auto_now_add=True)
    accion = models.CharField(max_length=100)
    request_xml = models.TextField(blank=True)
    response_xml = models.TextField(blank=True)
    resultado = models.CharField(max_length=20, choices=[
        ('OK', 'Exitoso'),
        ('ERROR', 'Error'),
        ('WARNING', 'Advertencia'),
    ])
    mensaje = models.TextField(blank=True)
    codigo_error = models.CharField(max_length=10, blank=True)

    class Meta:
        ordering = ['-fecha_hora']
        verbose_name = "log AFIP"
        verbose_name_plural = "logs AFIP"

    def __str__(self):
        return f"{self.accion} - {self.resultado} ({self.fecha_hora})"


class PeriodoIVA(models.Model):
    """Modelo para períodos de IVA (mensuales)"""

    class Estado(models.TextChoices):
        ABIERTO = "ABIERTO", "Abierto"
        CERRADO = "CERRADO", "Cerrado"
        PRESENTADO = "PRESENTADO", "Presentado a AFIP"

    anio = models.IntegerField()
    mes = models.IntegerField()  # 1-12
    fecha_desde = models.DateField()
    fecha_hasta = models.DateField()
    estado = models.CharField(max_length=20, choices=Estado.choices, default=Estado.ABIERTO)

    # IVA Débito Fiscal (ventas)
    iva_debito_fiscal = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0"),
        help_text="IVA cobrado en ventas (21%)"
    )

    # IVA Crédito Fiscal (compras)
    iva_credito_fiscal = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0"),
        help_text="IVA pagado en compras (deducible)"
    )

    # Saldo
    saldo_favor_fisco = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0"),
        help_text="Saldo a favor del fisco (débito - crédito si es positivo)"
    )
    saldo_favor_contribuyente = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0"),
        help_text="Saldo a favor del contribuyente (crédito - débito si es positivo)"
    )

    # Control
    fecha_presentacion = models.DateField(null=True, blank=True, help_text="Fecha de presentación de la DJ")
    numero_presentacion = models.CharField(max_length=50, blank=True, help_text="Número de presentación AFIP")
    observaciones = models.TextField(blank=True)
    fecha_creacion = models.DateTimeField(auto_now_add=True)
    fecha_actualizacion = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-anio', '-mes']
        verbose_name = "período IVA"
        verbose_name_plural = "períodos IVA"
        unique_together = ['anio', 'mes']

    def __str__(self):
        return f"IVA {self.mes:02d}/{self.anio} - {self.get_estado_display()}"

    @property
    def nombre_mes(self):
        """Retorna el nombre del mes"""
        meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
        return meses[self.mes - 1] if 1 <= self.mes <= 12 else 'Desconocido'

    def calcular_saldos(self):
        """Calcula los saldos de IVA del período"""
        diferencia = self.iva_debito_fiscal - self.iva_credito_fiscal

        if diferencia > 0:
            self.saldo_favor_fisco = diferencia
            self.saldo_favor_contribuyente = Decimal("0")
        else:
            self.saldo_favor_fisco = Decimal("0")
            self.saldo_favor_contribuyente = abs(diferencia)

        self.save()

    def recalcular_desde_ventas_compras(self):
        """Recalcula el IVA del período desde las ventas y compras registradas"""
        from ventas.models import Venta
        from compras.models import Compra

        # Calcular IVA débito fiscal (ventas con IVA)
        ventas = Venta.objects.filter(
            fecha__gte=self.fecha_desde,
            fecha__lte=self.fecha_hasta,
            incluye_iva=True
        )
        self.iva_debito_fiscal = ventas.aggregate(total=Sum('iva_monto'))['total'] or Decimal("0")

        # Calcular IVA crédito fiscal (compras con IVA)
        compras = Compra.objects.filter(
            fecha__gte=self.fecha_desde,
            fecha__lte=self.fecha_hasta,
            incluye_iva=True
        )
        self.iva_credito_fiscal = compras.aggregate(total=Sum('iva_monto'))['total'] or Decimal("0")

        self.calcular_saldos()

    @classmethod
    def obtener_o_crear_periodo_actual(cls):
        """Obtiene o crea el período IVA del mes actual"""
        from datetime import date
        import calendar

        hoy = date.today()
        anio = hoy.year
        mes = hoy.month

        # Obtener primer y último día del mes
        primer_dia = date(anio, mes, 1)
        ultimo_dia = date(anio, mes, calendar.monthrange(anio, mes)[1])

        periodo, created = cls.objects.get_or_create(
            anio=anio,
            mes=mes,
            defaults={
                'fecha_desde': primer_dia,
                'fecha_hasta': ultimo_dia,
            }
        )

        if created:
            periodo.recalcular_desde_ventas_compras()

        return periodo


class PagoIVA(models.Model):
    """Modelo para registrar pagos de IVA a AFIP"""

    class MedioPago(models.TextChoices):
        TRANSFERENCIA = "TRANSFERENCIA", "Transferencia Bancaria"
        VEP = "VEP", "Volante Electrónico de Pago (VEP)"
        DEBITO_AUTOMATICO = "DEBITO", "Débito Automático"
        COMPENSACION = "COMPENSACION", "Compensación con saldos a favor"

    periodo = models.ForeignKey(PeriodoIVA, on_delete=models.PROTECT, related_name="pagos")
    fecha_pago = models.DateField(default=timezone.now)
    monto = models.DecimalField(max_digits=12, decimal_places=2)
    medio_pago = models.CharField(max_length=20, choices=MedioPago.choices)
    numero_comprobante = models.CharField(max_length=50, blank=True, help_text="Número de VEP o comprobante")
    observaciones = models.TextField(blank=True)

    # Asociar con movimiento financiero para reflejar en caja
    movimiento_financiero = models.OneToOneField(
        MovimientoFinanciero,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="pago_iva"
    )

    fecha_creacion = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-fecha_pago']
        verbose_name = "pago de IVA"
        verbose_name_plural = "pagos de IVA"

    def __str__(self):
        return f"Pago IVA {self.periodo} - ${self.monto} ({self.fecha_pago})"

    def save(self, *args, **kwargs):
        """Al guardar, crear el movimiento financiero automáticamente"""
        is_new = self.pk is None
        super().save(*args, **kwargs)

        if is_new and not self.movimiento_financiero:
            # Crear movimiento financiero de egreso por pago de impuesto
            movimiento = MovimientoFinanciero.objects.create(
                fecha=self.fecha_pago,
                tipo=MovimientoFinanciero.Tipo.EGRESO,
                origen=MovimientoFinanciero.Origen.IMPUESTO,
                estado=MovimientoFinanciero.Estado.PAGADO,
                monto=self.monto,
                monto_pagado=self.monto,
                descripcion=f"Pago IVA período {self.periodo.mes:02d}/{self.periodo.anio}",
                medio_pago=self.medio_pago if self.medio_pago in ['TRANSFERENCIA', 'DEBITO'] else None
            )
            self.movimiento_financiero = movimiento
            self.save(update_fields=['movimiento_financiero'])
