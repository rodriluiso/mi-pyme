from django.db import models
from django.core.validators import MinValueValidator
from decimal import Decimal
from datetime import date, datetime
from django.contrib.auth import get_user_model
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType


User = get_user_model()


class MovimientoStock(models.Model):
    """
    Registro detallado de todos los movimientos de stock
    (entradas, salidas, ajustes, transferencias, etc.)
    """

    class TipoMovimiento(models.TextChoices):
        ENTRADA_COMPRA = 'ENTRADA_COMPRA', 'Entrada por Compra'
        ENTRADA_DEVOLUCION = 'ENTRADA_DEVOLUCION', 'Entrada por Devolución'
        ENTRADA_AJUSTE = 'ENTRADA_AJUSTE', 'Entrada por Ajuste'
        ENTRADA_INICIAL = 'ENTRADA_INICIAL', 'Entrada Inicial'
        ENTRADA_PRODUCCION = 'ENTRADA_PRODUCCION', 'Entrada por Producción'

        SALIDA_VENTA = 'SALIDA_VENTA', 'Salida por Venta'
        SALIDA_DEVOLUCION = 'SALIDA_DEVOLUCION', 'Salida por Devolución'
        SALIDA_AJUSTE = 'SALIDA_AJUSTE', 'Salida por Ajuste'
        SALIDA_PRODUCCION = 'SALIDA_PRODUCCION', 'Salida por Producción'
        SALIDA_MERMA = 'SALIDA_MERMA', 'Salida por Merma'
        SALIDA_ROBO = 'SALIDA_ROBO', 'Salida por Robo/Pérdida'

    # Campos principales
    fecha = models.DateTimeField(default=datetime.now)
    tipo_movimiento = models.CharField(max_length=30, choices=TipoMovimiento.choices)

    # Producto o Materia Prima (usando GenericForeignKey para ambos)
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.PositiveIntegerField()
    item = GenericForeignKey('content_type', 'object_id')

    # Cantidades
    cantidad = models.DecimalField(
        max_digits=15,
        decimal_places=3,
        validators=[MinValueValidator(Decimal('0.001'))]
    )
    cantidad_anterior = models.DecimalField(max_digits=15, decimal_places=3, default=0)
    cantidad_nueva = models.DecimalField(max_digits=15, decimal_places=3)

    # Valorización
    costo_unitario = models.DecimalField(
        max_digits=15,
        decimal_places=4,
        null=True,
        blank=True,
        help_text="Costo unitario del producto en este movimiento"
    )
    costo_total = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        null=True,
        blank=True
    )

    # Referencias a documentos originales
    venta = models.ForeignKey(
        'ventas.Venta',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='movimientos_stock'
    )
    compra = models.ForeignKey(
        'compras.Compra',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='movimientos_stock'
    )
    orden_produccion = models.ForeignKey(
        'inventario.OrdenProduccion',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='movimientos_stock'
    )
    ajuste_inventario = models.ForeignKey(
        'inventario.AjusteInventario',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='movimientos_stock'
    )

    # Metadatos
    motivo = models.TextField(blank=True, help_text="Explicación del movimiento")
    usuario = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    numero_documento = models.CharField(max_length=50, blank=True)

    # Campos de control
    creado_en = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-fecha', '-creado_en']
        verbose_name = 'Movimiento de Stock'
        verbose_name_plural = 'Movimientos de Stock'
        indexes = [
            models.Index(fields=['fecha']),
            models.Index(fields=['tipo_movimiento']),
            models.Index(fields=['content_type', 'object_id']),
            models.Index(fields=['venta']),
            models.Index(fields=['compra']),
        ]

    def __str__(self):
        direccion = "↗️" if self.es_entrada else "↘️"
        return f"{direccion} {self.get_tipo_movimiento_display()} - {self.cantidad} - {self.fecha.strftime('%d/%m/%Y')}"

    @property
    def es_entrada(self):
        """Determina si el movimiento es una entrada de stock"""
        return self.tipo_movimiento.startswith('ENTRADA')

    @property
    def es_salida(self):
        """Determina si el movimiento es una salida de stock"""
        return self.tipo_movimiento.startswith('SALIDA')

    @property
    def nombre_item(self):
        """Obtiene el nombre del item (producto o materia prima)"""
        if hasattr(self.item, 'nombre'):
            return self.item.nombre
        return str(self.item)

    @property
    def sku_item(self):
        """Obtiene el SKU del item"""
        if hasattr(self.item, 'sku'):
            return self.item.sku
        return None

    def save(self, *args, **kwargs):
        # Calcular costo total automáticamente
        if self.costo_unitario and self.cantidad:
            self.costo_total = self.costo_unitario * self.cantidad

        # Calcular cantidad nueva basada en tipo de movimiento
        if self.es_entrada:
            self.cantidad_nueva = self.cantidad_anterior + self.cantidad
        else:
            self.cantidad_nueva = self.cantidad_anterior - self.cantidad

        super().save(*args, **kwargs)


class ValorizacionInventario(models.Model):
    """
    Control de valorización de inventario por producto/materia prima
    Implementa FIFO, LIFO, Promedio Ponderado
    """

    class MetodoValorizacion(models.TextChoices):
        FIFO = 'FIFO', 'Primero en Entrar, Primero en Salir'
        LIFO = 'LIFO', 'Último en Entrar, Primero en Salir'
        PROMEDIO = 'PROMEDIO', 'Promedio Ponderado'

    # Producto o Materia Prima
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.PositiveIntegerField()
    item = GenericForeignKey('content_type', 'object_id')

    # Lote de entrada (para FIFO/LIFO)
    lote_entrada = models.CharField(max_length=100, blank=True)
    fecha_entrada = models.DateTimeField()

    # Cantidades
    cantidad_inicial = models.DecimalField(max_digits=15, decimal_places=3)
    cantidad_actual = models.DecimalField(max_digits=15, decimal_places=3)

    # Costos
    costo_unitario = models.DecimalField(max_digits=15, decimal_places=4)
    costo_total_inicial = models.DecimalField(max_digits=15, decimal_places=2)
    costo_total_actual = models.DecimalField(max_digits=15, decimal_places=2)

    # Referencia al movimiento que creó este lote
    movimiento_origen = models.ForeignKey(
        MovimientoStock,
        on_delete=models.CASCADE,
        related_name='lotes_valorizacion'
    )

    # Metadatos
    activo = models.BooleanField(default=True)
    creado_en = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['fecha_entrada']
        verbose_name = 'Lote de Valorización'
        verbose_name_plural = 'Lotes de Valorización'
        indexes = [
            models.Index(fields=['content_type', 'object_id']),
            models.Index(fields=['fecha_entrada']),
            models.Index(fields=['activo']),
        ]

    def __str__(self):
        return f"Lote {self.lote_entrada} - {self.cantidad_actual}/{self.cantidad_inicial}"

    @property
    def nombre_item(self):
        """Obtiene el nombre del item (producto o materia prima)"""
        if hasattr(self.item, 'nombre'):
            return self.item.nombre
        return str(self.item)


class AjusteInventario(models.Model):
    """
    Ajustes de inventario para corregir diferencias entre
    inventario físico y contable
    """

    class TipoAjuste(models.TextChoices):
        FISICO = 'FISICO', 'Inventario Físico'
        CORRECCION = 'CORRECCION', 'Corrección de Error'
        MERMA = 'MERMA', 'Merma/Deterioro'
        ROBO = 'ROBO', 'Robo/Pérdida'
        ENTRADA_INICIAL = 'ENTRADA_INICIAL', 'Entrada Inicial'

    # Información general
    numero = models.CharField(max_length=50, unique=True)
    fecha = models.DateField(default=date.today)
    tipo_ajuste = models.CharField(max_length=20, choices=TipoAjuste.choices)

    # Descripción y motivo
    descripcion = models.TextField()
    observaciones = models.TextField(blank=True)

    # Usuario que realizó el ajuste
    usuario = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)

    # Control de estado
    procesado = models.BooleanField(default=False)
    fecha_procesado = models.DateTimeField(null=True, blank=True)

    # Metadatos
    creado_en = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-fecha', '-creado_en']
        verbose_name = 'Ajuste de Inventario'
        verbose_name_plural = 'Ajustes de Inventario'

    def __str__(self):
        return f"Ajuste {self.numero} - {self.fecha}"

    def procesar_ajuste(self):
        """Procesa el ajuste creando los movimientos de stock correspondientes"""
        if self.procesado:
            return

        from django.db import transaction

        with transaction.atomic():
            for detalle in self.detalles.all():
                detalle.crear_movimiento_stock()

            self.procesado = True
            self.fecha_procesado = datetime.now()
            self.save()


class AjusteInventarioDetalle(models.Model):
    """
    Detalle de cada item en un ajuste de inventario
    """

    ajuste = models.ForeignKey(
        AjusteInventario,
        on_delete=models.CASCADE,
        related_name='detalles'
    )

    # Producto o Materia Prima
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.PositiveIntegerField()
    item = GenericForeignKey('content_type', 'object_id')

    # Cantidades
    cantidad_sistema = models.DecimalField(
        max_digits=15,
        decimal_places=3,
        help_text="Cantidad según el sistema"
    )
    cantidad_fisica = models.DecimalField(
        max_digits=15,
        decimal_places=3,
        help_text="Cantidad contada físicamente"
    )
    diferencia = models.DecimalField(
        max_digits=15,
        decimal_places=3,
        help_text="Diferencia (física - sistema)"
    )

    # Valorización
    costo_unitario = models.DecimalField(max_digits=15, decimal_places=4)
    costo_total_diferencia = models.DecimalField(max_digits=15, decimal_places=2)

    # Observaciones específicas del item
    observaciones = models.TextField(blank=True)

    class Meta:
        unique_together = ['ajuste', 'content_type', 'object_id']
        verbose_name = 'Detalle de Ajuste'
        verbose_name_plural = 'Detalles de Ajuste'

    def save(self, *args, **kwargs):
        # Calcular diferencia automáticamente
        self.diferencia = self.cantidad_fisica - self.cantidad_sistema

        # Calcular costo total de la diferencia
        self.costo_total_diferencia = self.diferencia * self.costo_unitario

        super().save(*args, **kwargs)

    def crear_movimiento_stock(self):
        """Crea el movimiento de stock para este detalle de ajuste"""
        if self.diferencia == 0:
            return None

        tipo_movimiento = (
            MovimientoStock.TipoMovimiento.ENTRADA_AJUSTE
            if self.diferencia > 0
            else MovimientoStock.TipoMovimiento.SALIDA_AJUSTE
        )

        return MovimientoStock.objects.create(
            fecha=datetime.combine(self.ajuste.fecha, datetime.min.time()),
            tipo_movimiento=tipo_movimiento,
            content_type=self.content_type,
            object_id=self.object_id,
            cantidad=abs(self.diferencia),
            cantidad_anterior=self.cantidad_sistema,
            costo_unitario=self.costo_unitario,
            ajuste_inventario=self.ajuste,
            motivo=f"Ajuste inventario #{self.ajuste.numero}: {self.ajuste.descripcion}",
            usuario=self.ajuste.usuario,
            numero_documento=self.ajuste.numero
        )


class OrdenProduccion(models.Model):
    """
    Órdenes de producción para control de fabricación
    y consumo de materias primas
    """

    class Estado(models.TextChoices):
        PLANIFICADA = 'PLANIFICADA', 'Planificada'
        EN_PROCESO = 'EN_PROCESO', 'En Proceso'
        TERMINADA = 'TERMINADA', 'Terminada'
        CANCELADA = 'CANCELADA', 'Cancelada'

    # Información básica
    numero = models.CharField(max_length=50, unique=True)
    fecha_creacion = models.DateField(default=date.today)
    fecha_inicio_planificada = models.DateField()
    fecha_fin_planificada = models.DateField()
    fecha_inicio_real = models.DateTimeField(null=True, blank=True)
    fecha_fin_real = models.DateTimeField(null=True, blank=True)

    # Producto a fabricar
    producto = models.ForeignKey(
        'productos.Producto',
        on_delete=models.CASCADE,
        related_name='ordenes_produccion'
    )
    cantidad_planificada = models.DecimalField(max_digits=15, decimal_places=3)
    cantidad_producida = models.DecimalField(max_digits=15, decimal_places=3, default=0)

    # Estado y control
    estado = models.CharField(max_length=20, choices=Estado.choices, default=Estado.PLANIFICADA)

    # Costos
    costo_materias_primas = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    costo_mano_obra = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    costo_gastos_generales = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    costo_total = models.DecimalField(max_digits=15, decimal_places=2, default=0)

    # Observaciones
    descripcion = models.TextField(blank=True)
    observaciones = models.TextField(blank=True)

    # Usuario responsable
    responsable = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)

    # Metadatos
    creado_en = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-fecha_creacion', '-creado_en']
        verbose_name = 'Orden de Producción'
        verbose_name_plural = 'Órdenes de Producción'

    def __str__(self):
        return f"OP {self.numero} - {self.producto.nombre} ({self.cantidad_planificada})"

    @property
    def porcentaje_avance(self):
        """Calcula el porcentaje de avance de la producción"""
        if self.cantidad_planificada == 0:
            return 0
        return min(100, (self.cantidad_producida / self.cantidad_planificada) * 100)

    @property
    def costo_unitario_planificado(self):
        """Costo unitario planificado"""
        if self.cantidad_planificada == 0:
            return 0
        return self.costo_total / self.cantidad_planificada

    @property
    def costo_unitario_real(self):
        """Costo unitario real basado en lo producido"""
        if self.cantidad_producida == 0:
            return 0
        return self.costo_total / self.cantidad_producida

    def iniciar_produccion(self):
        """Inicia la orden de producción"""
        if self.estado == self.Estado.PLANIFICADA:
            self.estado = self.Estado.EN_PROCESO
            self.fecha_inicio_real = datetime.now()
            self.save()

    def finalizar_produccion(self):
        """Finaliza la orden de producción"""
        if self.estado == self.Estado.EN_PROCESO:
            self.estado = self.Estado.TERMINADA
            self.fecha_fin_real = datetime.now()
            self.save()

            # Crear movimiento de entrada del producto terminado
            MovimientoStock.objects.create(
                fecha=self.fecha_fin_real,
                tipo_movimiento=MovimientoStock.TipoMovimiento.ENTRADA_PRODUCCION,
                content_type=ContentType.objects.get_for_model(self.producto),
                object_id=self.producto.id,
                cantidad=self.cantidad_producida,
                cantidad_anterior=self.producto.stock,
                costo_unitario=self.costo_unitario_real,
                orden_produccion=self,
                motivo=f"Producción completada - OP {self.numero}",
                numero_documento=self.numero
            )

            # Actualizar stock del producto
            self.producto.stock += self.cantidad_producida
            self.producto.save()


class ConsumoMateriaPrima(models.Model):
    """
    Registro del consumo de materias primas en órdenes de producción
    """

    orden_produccion = models.ForeignKey(
        OrdenProduccion,
        on_delete=models.CASCADE,
        related_name='consumos_materia_prima'
    )

    materia_prima = models.ForeignKey(
        'compras.MateriaPrima',
        on_delete=models.CASCADE,
        related_name='consumos_produccion'
    )

    # Cantidades
    cantidad_planificada = models.DecimalField(
        max_digits=15,
        decimal_places=3,
        help_text="Cantidad planificada según receta"
    )
    cantidad_consumida = models.DecimalField(
        max_digits=15,
        decimal_places=3,
        default=0,
        help_text="Cantidad realmente consumida"
    )

    # Costos
    costo_unitario = models.DecimalField(max_digits=15, decimal_places=4)
    costo_total_planificado = models.DecimalField(max_digits=15, decimal_places=2)
    costo_total_real = models.DecimalField(max_digits=15, decimal_places=2, default=0)

    # Control
    consumido = models.BooleanField(default=False)
    fecha_consumo = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ['orden_produccion', 'materia_prima']
        verbose_name = 'Consumo de Materia Prima'
        verbose_name_plural = 'Consumos de Materia Prima'

    def save(self, *args, **kwargs):
        # Calcular costos automáticamente
        self.costo_total_planificado = self.cantidad_planificada * self.costo_unitario
        self.costo_total_real = self.cantidad_consumida * self.costo_unitario
        super().save(*args, **kwargs)

    def consumir_materia_prima(self, cantidad=None):
        """Registra el consumo real de la materia prima"""
        if self.consumido:
            return

        cantidad_a_consumir = cantidad or self.cantidad_planificada

        # Verificar stock disponible
        if self.materia_prima.stock < cantidad_a_consumir:
            raise ValueError(f"Stock insuficiente de {self.materia_prima.nombre}")

        # Crear movimiento de salida
        MovimientoStock.objects.create(
            fecha=datetime.now(),
            tipo_movimiento=MovimientoStock.TipoMovimiento.SALIDA_PRODUCCION,
            content_type=ContentType.objects.get_for_model(self.materia_prima),
            object_id=self.materia_prima.id,
            cantidad=cantidad_a_consumir,
            cantidad_anterior=self.materia_prima.stock,
            costo_unitario=self.costo_unitario,
            orden_produccion=self.orden_produccion,
            motivo=f"Consumo en producción - OP {self.orden_produccion.numero}",
            numero_documento=self.orden_produccion.numero
        )

        # Actualizar stock de materia prima
        self.materia_prima.stock -= cantidad_a_consumir
        self.materia_prima.save()

        # Actualizar registro de consumo
        self.cantidad_consumida = cantidad_a_consumir
        self.consumido = True
        self.fecha_consumo = datetime.now()
        self.save()