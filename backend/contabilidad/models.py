from django.db import models
from decimal import Decimal
from datetime import date, datetime
from django.contrib.auth import get_user_model

User = get_user_model()


class PlanCuentas(models.Model):
    """
    Plan de cuentas contables simplificado para PyME
    Basado en normas contables argentinas
    """

    class TipoCuenta(models.TextChoices):
        ACTIVO = 'ACTIVO', 'Activo'
        PASIVO = 'PASIVO', 'Pasivo'
        PATRIMONIO = 'PATRIMONIO', 'Patrimonio Neto'
        INGRESO = 'INGRESO', 'Ingresos'
        GASTO = 'GASTO', 'Gastos'
        COSTO = 'COSTO', 'Costos'

    class SubtipoCuenta(models.TextChoices):
        # Activos
        ACTIVO_CORRIENTE = 'ACTIVO_CORRIENTE', 'Activo Corriente'
        ACTIVO_NO_CORRIENTE = 'ACTIVO_NO_CORRIENTE', 'Activo No Corriente'

        # Pasivos
        PASIVO_CORRIENTE = 'PASIVO_CORRIENTE', 'Pasivo Corriente'
        PASIVO_NO_CORRIENTE = 'PASIVO_NO_CORRIENTE', 'Pasivo No Corriente'

        # Patrimonio
        CAPITAL = 'CAPITAL', 'Capital'
        RESULTADOS = 'RESULTADOS', 'Resultados'

        # Ingresos
        VENTAS = 'VENTAS', 'Ventas'
        OTROS_INGRESOS = 'OTROS_INGRESOS', 'Otros Ingresos'

        # Gastos
        GASTOS_OPERATIVOS = 'GASTOS_OPERATIVOS', 'Gastos Operativos'
        GASTOS_FINANCIEROS = 'GASTOS_FINANCIEROS', 'Gastos Financieros'

        # Costos
        COSTO_VENTAS = 'COSTO_VENTAS', 'Costo de Ventas'

    # Identificación
    codigo = models.CharField(max_length=20, unique=True)
    nombre = models.CharField(max_length=200)
    descripcion = models.TextField(blank=True)

    # Clasificación
    tipo_cuenta = models.CharField(max_length=20, choices=TipoCuenta.choices)
    subtipo_cuenta = models.CharField(max_length=30, choices=SubtipoCuenta.choices)

    # Jerarquía
    cuenta_padre = models.ForeignKey(
        'self',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='subcuentas'
    )
    nivel = models.PositiveSmallIntegerField(default=1)

    # Configuración
    acepta_movimientos = models.BooleanField(
        default=True,
        help_text="Si puede recibir asientos contables directamente"
    )
    activa = models.BooleanField(default=True)

    # Metadatos
    creado_en = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['codigo']
        verbose_name = 'Cuenta Contable'
        verbose_name_plural = 'Plan de Cuentas'

    def __str__(self):
        return f"{self.codigo} - {self.nombre}"

    @property
    def codigo_completo(self):
        """Código completo incluyendo cuenta padre"""
        if self.cuenta_padre:
            return f"{self.cuenta_padre.codigo_completo}.{self.codigo}"
        return self.codigo

    def get_saldo_actual(self, fecha_hasta=None):
        """Calcula el saldo actual de la cuenta"""
        if fecha_hasta is None:
            fecha_hasta = date.today()

        # Para cuentas que no aceptan movimientos, sumar subcuentas
        if not self.acepta_movimientos:
            saldo = Decimal('0')
            for subcuenta in self.subcuentas.filter(activa=True):
                saldo += subcuenta.get_saldo_actual(fecha_hasta)
            return saldo

        # Calcular saldo de movimientos directos
        from .models import AsientoContableDetalle

        movimientos = AsientoContableDetalle.objects.filter(
            cuenta=self,
            asiento__fecha__lte=fecha_hasta,
            asiento__procesado=True
        )

        debe = movimientos.aggregate(
            total=models.Sum('debe')
        )['total'] or Decimal('0')

        haber = movimientos.aggregate(
            total=models.Sum('haber')
        )['total'] or Decimal('0')

        # El saldo depende del tipo de cuenta
        if self.tipo_cuenta in ['ACTIVO', 'GASTO', 'COSTO']:
            return debe - haber
        else:  # PASIVO, PATRIMONIO, INGRESO
            return haber - debe

    @classmethod
    def crear_plan_basico(cls):
        """Crea un plan de cuentas básico para PyME"""
        cuentas_basicas = [
            # ACTIVOS
            ('1', 'ACTIVO', 'ACTIVO_CORRIENTE', None, False),
            ('1.1', 'Caja y Bancos', 'ACTIVO_CORRIENTE', '1', False),
            ('1.1.1', 'Caja', 'ACTIVO_CORRIENTE', '1.1', True),
            ('1.1.2', 'Banco Cuenta Corriente', 'ACTIVO_CORRIENTE', '1.1', True),
            ('1.2', 'Créditos', 'ACTIVO_CORRIENTE', '1', False),
            ('1.2.1', 'Deudores por Ventas', 'ACTIVO_CORRIENTE', '1.2', True),
            ('1.3', 'Inventarios', 'ACTIVO_CORRIENTE', '1', False),
            ('1.3.1', 'Mercaderías', 'ACTIVO_CORRIENTE', '1.3', True),
            ('1.3.2', 'Materias Primas', 'ACTIVO_CORRIENTE', '1.3', True),

            ('2', 'ACTIVO NO CORRIENTE', 'ACTIVO_NO_CORRIENTE', None, False),
            ('2.1', 'Bienes de Uso', 'ACTIVO_NO_CORRIENTE', '2', False),
            ('2.1.1', 'Equipos e Instalaciones', 'ACTIVO_NO_CORRIENTE', '2.1', True),

            # PASIVOS
            ('3', 'PASIVO', 'PASIVO_CORRIENTE', None, False),
            ('3.1', 'Deudas Comerciales', 'PASIVO_CORRIENTE', '3', False),
            ('3.1.1', 'Proveedores', 'PASIVO_CORRIENTE', '3.1', True),
            ('3.2', 'Deudas Fiscales', 'PASIVO_CORRIENTE', '3', False),
            ('3.2.1', 'IVA a Pagar', 'PASIVO_CORRIENTE', '3.2', True),

            # PATRIMONIO
            ('4', 'PATRIMONIO NETO', 'CAPITAL', None, False),
            ('4.1', 'Capital', 'CAPITAL', '4', True),
            ('4.2', 'Resultados Acumulados', 'RESULTADOS', '4', True),

            # INGRESOS
            ('5', 'INGRESOS', 'VENTAS', None, False),
            ('5.1', 'Ventas', 'VENTAS', '5', True),
            ('5.2', 'Otros Ingresos', 'OTROS_INGRESOS', '5', True),

            # GASTOS
            ('6', 'GASTOS', 'GASTOS_OPERATIVOS', None, False),
            ('6.1', 'Gastos de Administración', 'GASTOS_OPERATIVOS', '6', False),
            ('6.1.1', 'Sueldos y Cargas Sociales', 'GASTOS_OPERATIVOS', '6.1', True),
            ('6.1.2', 'Alquileres', 'GASTOS_OPERATIVOS', '6.1', True),
            ('6.1.3', 'Servicios', 'GASTOS_OPERATIVOS', '6.1', True),

            # COSTOS
            ('7', 'COSTOS', 'COSTO_VENTAS', None, False),
            ('7.1', 'Costo de Mercaderías Vendidas', 'COSTO_VENTAS', '7', True),
        ]

        for codigo, nombre, subtipo, padre_codigo, acepta_mov in cuentas_basicas:
            cuenta_padre = None
            if padre_codigo:
                cuenta_padre = cls.objects.filter(codigo=padre_codigo).first()

            cuenta, created = cls.objects.get_or_create(
                codigo=codigo,
                defaults={
                    'nombre': nombre,
                    'tipo_cuenta': subtipo.split('_')[0] if '_' not in subtipo else 'ACTIVO',
                    'subtipo_cuenta': subtipo,
                    'cuenta_padre': cuenta_padre,
                    'nivel': codigo.count('.') + 1,
                    'acepta_movimientos': acepta_mov
                }
            )


class AsientoContable(models.Model):
    """
    Asientos contables para registrar todas las operaciones
    """

    # Identificación
    numero = models.CharField(max_length=50, unique=True)
    fecha = models.DateField()
    concepto = models.TextField()

    # Referencias a documentos
    venta = models.ForeignKey(
        'ventas.Venta',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='asientos_contables'
    )
    compra = models.ForeignKey(
        'compras.Compra',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='asientos_contables'
    )
    movimiento_financiero = models.ForeignKey(
        'finanzas_reportes.MovimientoFinanciero',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='asientos_contables'
    )

    # Control
    procesado = models.BooleanField(default=False)
    usuario = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)

    # Metadatos
    creado_en = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-fecha', '-numero']
        verbose_name = 'Asiento Contable'
        verbose_name_plural = 'Asientos Contables'

    def __str__(self):
        return f"Asiento {self.numero} - {self.fecha}"

    @property
    def total_debe(self):
        """Total del debe"""
        return self.detalles.aggregate(
            total=models.Sum('debe')
        )['total'] or Decimal('0')

    @property
    def total_haber(self):
        """Total del haber"""
        return self.detalles.aggregate(
            total=models.Sum('haber')
        )['total'] or Decimal('0')

    @property
    def esta_balanceado(self):
        """Verifica si el asiento está balanceado"""
        return self.total_debe == self.total_haber

    def procesar(self):
        """Procesa el asiento si está balanceado"""
        if not self.esta_balanceado:
            raise ValueError("El asiento no está balanceado")

        self.procesado = True
        self.save()


class AsientoContableDetalle(models.Model):
    """
    Detalle de cada asiento contable (debe y haber)
    """

    asiento = models.ForeignKey(
        AsientoContable,
        on_delete=models.CASCADE,
        related_name='detalles'
    )
    cuenta = models.ForeignKey(
        PlanCuentas,
        on_delete=models.CASCADE,
        related_name='movimientos'
    )

    # Importes
    debe = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        default=Decimal('0')
    )
    haber = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        default=Decimal('0')
    )

    # Descripción específica
    detalle = models.CharField(max_length=500, blank=True)

    class Meta:
        ordering = ['id']
        verbose_name = 'Detalle de Asiento'
        verbose_name_plural = 'Detalles de Asientos'

    def clean(self):
        from django.core.exceptions import ValidationError

        if self.debe > 0 and self.haber > 0:
            raise ValidationError("No puede tener debe y haber simultáneamente")

        if self.debe == 0 and self.haber == 0:
            raise ValidationError("Debe tener debe o haber")

        if not self.cuenta.acepta_movimientos:
            raise ValidationError("Esta cuenta no acepta movimientos directos")


class BalanceGeneral(models.Model):
    """
    Balance General generado automáticamente
    """

    fecha_corte = models.DateField()
    fecha_generacion = models.DateTimeField(auto_now_add=True)

    # Totales calculados
    total_activo = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    total_pasivo = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    total_patrimonio = models.DecimalField(max_digits=15, decimal_places=2, default=0)

    # Control
    usuario = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)

    class Meta:
        ordering = ['-fecha_corte']
        unique_together = ['fecha_corte']
        verbose_name = 'Balance General'
        verbose_name_plural = 'Balances Generales'

    def __str__(self):
        return f"Balance General al {self.fecha_corte}"

    @classmethod
    def generar(cls, fecha_corte, usuario=None):
        """Genera un balance general para la fecha especificada"""

        # Eliminar balance existente para esa fecha
        cls.objects.filter(fecha_corte=fecha_corte).delete()

        # Crear nuevo balance
        balance = cls.objects.create(
            fecha_corte=fecha_corte,
            usuario=usuario
        )

        # Generar detalles
        balance._generar_detalles()

        return balance

    def _generar_detalles(self):
        """Genera los detalles del balance"""
        # Eliminar detalles existentes
        self.detalles.all().delete()

        # Obtener cuentas principales
        cuentas_principales = PlanCuentas.objects.filter(
            nivel=1,
            activa=True,
            tipo_cuenta__in=['ACTIVO', 'PASIVO', 'PATRIMONIO']
        )

        total_activo = Decimal('0')
        total_pasivo = Decimal('0')
        total_patrimonio = Decimal('0')

        for cuenta in cuentas_principales:
            saldo = cuenta.get_saldo_actual(self.fecha_corte)

            if saldo != 0:  # Solo incluir cuentas con saldo
                BalanceGeneralDetalle.objects.create(
                    balance=self,
                    cuenta=cuenta,
                    saldo=saldo
                )

                if cuenta.tipo_cuenta == 'ACTIVO':
                    total_activo += saldo
                elif cuenta.tipo_cuenta == 'PASIVO':
                    total_pasivo += saldo
                elif cuenta.tipo_cuenta == 'PATRIMONIO':
                    total_patrimonio += saldo

        # Actualizar totales
        self.total_activo = total_activo
        self.total_pasivo = total_pasivo
        self.total_patrimonio = total_patrimonio
        self.save()


class BalanceGeneralDetalle(models.Model):
    """
    Detalle del Balance General por cuenta
    """

    balance = models.ForeignKey(
        BalanceGeneral,
        on_delete=models.CASCADE,
        related_name='detalles'
    )
    cuenta = models.ForeignKey(PlanCuentas, on_delete=models.CASCADE)
    saldo = models.DecimalField(max_digits=15, decimal_places=2)

    class Meta:
        ordering = ['cuenta__codigo']
        unique_together = ['balance', 'cuenta']


class EstadoResultados(models.Model):
    """
    Estado de Resultados (P&L) generado automáticamente
    """

    fecha_desde = models.DateField()
    fecha_hasta = models.DateField()
    fecha_generacion = models.DateTimeField(auto_now_add=True)

    # Totales calculados
    total_ingresos = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    total_costos = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    total_gastos = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    utilidad_bruta = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    utilidad_neta = models.DecimalField(max_digits=15, decimal_places=2, default=0)

    # Control
    usuario = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)

    class Meta:
        ordering = ['-fecha_hasta']
        unique_together = ['fecha_desde', 'fecha_hasta']
        verbose_name = 'Estado de Resultados'
        verbose_name_plural = 'Estados de Resultados'

    def __str__(self):
        return f"Estado de Resultados {self.fecha_desde} - {self.fecha_hasta}"

    @classmethod
    def generar(cls, fecha_desde, fecha_hasta, usuario=None):
        """Genera un estado de resultados para el período especificado"""

        # Eliminar estado existente para ese período
        cls.objects.filter(
            fecha_desde=fecha_desde,
            fecha_hasta=fecha_hasta
        ).delete()

        # Crear nuevo estado
        estado = cls.objects.create(
            fecha_desde=fecha_desde,
            fecha_hasta=fecha_hasta,
            usuario=usuario
        )

        # Generar detalles
        estado._generar_detalles()

        return estado

    def _generar_detalles(self):
        """Genera los detalles del estado de resultados"""
        # Eliminar detalles existentes
        self.detalles.all().delete()

        # Obtener cuentas de ingresos, costos y gastos
        tipos_cuenta = ['INGRESO', 'COSTO', 'GASTO']
        cuentas = PlanCuentas.objects.filter(
            activa=True,
            tipo_cuenta__in=tipos_cuenta,
            acepta_movimientos=True
        )

        total_ingresos = Decimal('0')
        total_costos = Decimal('0')
        total_gastos = Decimal('0')

        for cuenta in cuentas:
            # Calcular saldo del período
            movimientos = AsientoContableDetalle.objects.filter(
                cuenta=cuenta,
                asiento__fecha__gte=self.fecha_desde,
                asiento__fecha__lte=self.fecha_hasta,
                asiento__procesado=True
            )

            debe = movimientos.aggregate(
                total=models.Sum('debe')
            )['total'] or Decimal('0')

            haber = movimientos.aggregate(
                total=models.Sum('haber')
            )['total'] or Decimal('0')

            # Para ingresos: haber - debe
            # Para gastos y costos: debe - haber
            if cuenta.tipo_cuenta == 'INGRESO':
                saldo = haber - debe
                total_ingresos += saldo
            else:  # GASTO o COSTO
                saldo = debe - haber
                if cuenta.tipo_cuenta == 'COSTO':
                    total_costos += saldo
                else:
                    total_gastos += saldo

            if saldo != 0:  # Solo incluir cuentas con movimiento
                EstadoResultadosDetalle.objects.create(
                    estado=self,
                    cuenta=cuenta,
                    importe=saldo
                )

        # Calcular utilidades
        utilidad_bruta = total_ingresos - total_costos
        utilidad_neta = utilidad_bruta - total_gastos

        # Actualizar totales
        self.total_ingresos = total_ingresos
        self.total_costos = total_costos
        self.total_gastos = total_gastos
        self.utilidad_bruta = utilidad_bruta
        self.utilidad_neta = utilidad_neta
        self.save()


class EstadoResultadosDetalle(models.Model):
    """
    Detalle del Estado de Resultados por cuenta
    """

    estado = models.ForeignKey(
        EstadoResultados,
        on_delete=models.CASCADE,
        related_name='detalles'
    )
    cuenta = models.ForeignKey(PlanCuentas, on_delete=models.CASCADE)
    importe = models.DecimalField(max_digits=15, decimal_places=2)

    class Meta:
        ordering = ['cuenta__codigo']
        unique_together = ['estado', 'cuenta']