from rest_framework import serializers

from .models import (
    MovimientoFinanciero,
    PagoCliente,
    PagoProveedor,
    MedioPago,
    CuentaBancaria,
    ExtractoBancario,
    MovimientoBancario,
    ConciliacionBancaria,
    ConfiguracionAFIP,
    FacturaElectronica,
    DetalleFacturaElectronica,
    LogAFIP,
    PeriodoIVA,
    PagoIVA
)


class PagoClienteSerializer(serializers.ModelSerializer):
    cliente_nombre = serializers.CharField(source="cliente.nombre", read_only=True)
    venta_numero = serializers.CharField(source="venta.numero", read_only=True, allow_null=True)
    medio = serializers.ChoiceField(choices=MedioPago.choices)
    medio_display = serializers.CharField(source="get_medio_display", read_only=True)

    class Meta:
        model = PagoCliente
        fields = (
            "id",
            "fecha",
            "cliente",
            "cliente_nombre",
            "venta",
            "venta_numero",
            "monto",
            "medio",
            "medio_display",
            "observacion",
        )

    def create(self, validated_data):
        """
        Crea un pago de cliente con soporte opcional de undo.

        Si ENABLE_UNDO_SYSTEM está activado, usa PagoService para registrar
        el pago con capacidad de deshacer. Si está desactivado, usa la
        implementación original como fallback.
        """
        from django.conf import settings

        if getattr(settings, 'ENABLE_UNDO_SYSTEM', False):
            return self._create_with_undo(validated_data)
        else:
            return self._create_original(validated_data)

    def _create_with_undo(self, validated_data):
        """
        Implementación con sistema de undo habilitado.
        Usa PagoService para registrar el pago.
        """
        from usuarios.services.pago_service import PagoService

        # Obtener user del contexto
        user = self.context['request'].user

        # Extraer datos
        cliente_id = validated_data['cliente'].id
        monto = validated_data['monto']
        medio = validated_data['medio']
        fecha = validated_data.get('fecha')
        observacion = validated_data.get('observacion', '')
        venta_id = validated_data.get('venta').id if validated_data.get('venta') else None

        # Usar PagoService para crear el pago con undo
        pago = PagoService.registrar_pago(
            user=user,
            cliente_id=cliente_id,
            monto=monto,
            medio=medio,
            fecha=fecha,
            venta_id=venta_id,
            observacion=observacion
        )

        return pago

    def _create_original(self, validated_data):
        """
        Implementación original sin sistema de undo.
        Se mantiene como fallback para compatibilidad.
        """
        from ventas.models import Venta
        from decimal import Decimal
        from django.db import transaction

        with transaction.atomic():
            # Crear el pago del cliente
            pago = PagoCliente(**validated_data)
            pago.save()

            # Si el pago NO tiene venta asociada (pago "a cuenta"), aplicar FIFO
            if not pago.venta:
                self._aplicar_pago_fifo(pago)

            # Si el pago SÍ tiene venta asociada (pago directo a factura específica)
            else:
                # Aplicar el pago directamente a la factura especificada CON imputación
                pago.venta.aplicar_pago(pago.monto, pago=pago, crear_imputacion=True)

            # Construir descripción con información de factura si aplica
            descripcion_base = f"Pago recibido de {pago.cliente.nombre}"
            if pago.venta:
                descripcion_base += f" - Factura #{pago.venta.numero or pago.venta.id}"
            descripcion_base += f" - {pago.get_medio_display()}"

            # Crear movimiento financiero de ingreso real
            MovimientoFinanciero.objects.create(
                fecha=pago.fecha,
                tipo=MovimientoFinanciero.Tipo.INGRESO,
                estado=MovimientoFinanciero.Estado.COBRADO,
                origen=MovimientoFinanciero.Origen.MANUAL,
                monto=pago.monto,
                descripcion=descripcion_base,
                medio_pago=pago.medio,
            )

            return pago

    def _aplicar_pago_fifo(self, pago):
        """
        Aplica un pago "a cuenta" a las facturas pendientes más antiguas del cliente.
        Método FIFO (First In, First Out): Las facturas más antiguas se pagan primero.

        CRÍTICO: Solo aplica pagos a ventas activas (no anuladas).
        """
        from ventas.models import Venta
        from decimal import Decimal
        from django.db import models as django_models

        # Obtener facturas pendientes del cliente ordenadas por fecha (más antigua primero)
        # CRÍTICO: Filtrar anulada=False para evitar aplicar pagos a ventas deshechas
        facturas_pendientes = Venta.objects.filter(
            cliente=pago.cliente,
            anulada=False  # ✅ SOLO VENTAS ACTIVAS
        ).exclude(
            monto_pagado__gte=django_models.F('total')  # Excluir facturas ya pagadas completamente
        ).order_by('fecha', 'id')  # FIFO: más antiguas primero

        monto_restante = Decimal(str(pago.monto))
        facturas_afectadas = []

        # Aplicar el pago a cada factura en orden hasta agotar el monto
        for factura in facturas_pendientes:
            if monto_restante <= 0:
                break

            saldo_anterior = factura.saldo_pendiente

            # Aplicar pago a esta factura (retorna el sobrante) CON imputación
            monto_restante = factura.aplicar_pago(
                monto_restante,
                pago=pago,
                crear_imputacion=True
            )

            # Registrar qué facturas fueron afectadas
            monto_aplicado = saldo_anterior - factura.saldo_pendiente
            if monto_aplicado > 0:
                facturas_afectadas.append(f"#{factura.numero or factura.id}: ${monto_aplicado}")

        # Actualizar la observación del pago con las facturas afectadas
        if facturas_afectadas:
            pago.observacion = f"Pago a cuenta aplicado automáticamente (FIFO) a: {', '.join(facturas_afectadas)}"
            pago.save(update_fields=['observacion'])


class PagoProveedorSerializer(serializers.ModelSerializer):
    proveedor_nombre = serializers.CharField(source="proveedor.nombre", read_only=True)
    medio = serializers.ChoiceField(choices=MedioPago.choices)
    medio_display = serializers.CharField(source="get_medio_display", read_only=True)

    class Meta:
        model = PagoProveedor
        fields = (
            "id",
            "proveedor",
            "proveedor_nombre",
            "fecha",
            "monto",
            "medio",
            "medio_display",
            "observacion",
        )

    def create(self, validated_data):
        # Crear el pago al proveedor
        pago = super().create(validated_data)

        # Crear movimiento financiero de egreso real
        MovimientoFinanciero.objects.create(
            fecha=pago.fecha,
            tipo=MovimientoFinanciero.Tipo.EGRESO,
            estado=MovimientoFinanciero.Estado.PAGADO,
            origen=MovimientoFinanciero.Origen.MANUAL,
            monto=pago.monto,
            descripcion=f"Pago realizado a {pago.proveedor.nombre} - {pago.get_medio_display()}",
            medio_pago=pago.medio,
            proveedor=pago.proveedor,
        )

        return pago


class MovimientoFinancieroSerializer(serializers.ModelSerializer):
    compra_id = serializers.IntegerField(source="compra.id", read_only=True)
    venta_id = serializers.IntegerField(source="venta.id", read_only=True)
    proveedor_nombre = serializers.CharField(source="proveedor.nombre", read_only=True)
    origen_display = serializers.CharField(source="get_origen_display", read_only=True)
    estado_display = serializers.CharField(source="get_estado_display", read_only=True)
    medio_pago_display = serializers.CharField(source="get_medio_pago_display", read_only=True)
    monto_pendiente = serializers.ReadOnlyField()

    class Meta:
        model = MovimientoFinanciero
        fields = (
            "id",
            "fecha",
            "tipo",
            "estado",
            "estado_display",
            "origen",
            "origen_display",
            "monto",
            "monto_pagado",
            "monto_pendiente",
            "fecha_vencimiento",
            "descripcion",
            "compra",
            "compra_id",
            "venta",
            "venta_id",
            "proveedor",
            "proveedor_nombre",
            "referencia_extra",
            "medio_pago",
            "medio_pago_display",
        )
class GastoManualSerializer(serializers.Serializer):
    fecha = serializers.DateField(required=False)
    tipo = serializers.ChoiceField(
        choices=[(opcion.value, opcion.label) for opcion in MovimientoFinanciero.Origen.gastos_registrables()],
        default=MovimientoFinanciero.Origen.SERVICIO,
    )
    monto = serializers.DecimalField(max_digits=12, decimal_places=2)
    observacion = serializers.CharField(max_length=255, allow_blank=True, required=False)
    medio_pago = serializers.ChoiceField(choices=MedioPago.choices)

    def validate_tipo(self, value):
        valores_permitidos = [origen.value for origen in MovimientoFinanciero.Origen.gastos_registrables()]
        if value not in valores_permitidos:
            raise serializers.ValidationError("Selecciona un tipo de gasto valido")
        return value

    def create(self, validated_data):
        from django.utils import timezone

        fecha = validated_data.get("fecha") or timezone.now().date()
        origen = validated_data["tipo"]
        observacion = (validated_data.get("observacion") or "").strip()
        etiqueta = dict(MovimientoFinanciero.Origen.choices).get(origen, "Gasto")
        descripcion = f"{etiqueta} - {observacion}" if observacion else etiqueta
        return MovimientoFinanciero.objects.create(
            fecha=fecha,
            tipo=MovimientoFinanciero.Tipo.EGRESO,
            estado=MovimientoFinanciero.Estado.PAGADO,  # Gasto ya está pagado
            origen=origen,
            monto=validated_data["monto"],
            descripcion=descripcion,
            medio_pago=validated_data["medio_pago"],
        )


class RegistrarPagoSerializer(serializers.Serializer):
    """Serializer para registrar pagos contra cuentas por pagar pendientes"""
    movimiento_id = serializers.IntegerField()
    monto_pago = serializers.DecimalField(max_digits=12, decimal_places=2)
    fecha_pago = serializers.DateField(required=False)
    observacion = serializers.CharField(max_length=255, required=False, allow_blank=True)
    medio_pago = serializers.ChoiceField(choices=MedioPago.choices)

    def validate_movimiento_id(self, value):
        try:
            movimiento = MovimientoFinanciero.objects.get(id=value)
            if movimiento.estado not in [MovimientoFinanciero.Estado.PENDIENTE, MovimientoFinanciero.Estado.PARCIAL]:
                raise serializers.ValidationError("Solo se pueden registrar pagos contra movimientos pendientes o parciales")
            return value
        except MovimientoFinanciero.DoesNotExist:
            raise serializers.ValidationError("El movimiento especificado no existe")

    def validate_monto_pago(self, value):
        if value <= 0:
            raise serializers.ValidationError("El monto del pago debe ser mayor a cero")
        return value

    def validate(self, attrs):
        movimiento = MovimientoFinanciero.objects.get(id=attrs['movimiento_id'])
        monto_pendiente = movimiento.monto_pendiente

        if attrs['monto_pago'] > monto_pendiente:
            raise serializers.ValidationError({
                'monto_pago': f"El monto del pago ({attrs['monto_pago']}) no puede ser mayor al pendiente ({monto_pendiente})"
            })

        return attrs

    def create(self, validated_data):
        from django.utils import timezone

        movimiento = MovimientoFinanciero.objects.get(id=validated_data['movimiento_id'])
        fecha_pago = validated_data.get('fecha_pago') or timezone.now().date()

        # Registrar el pago
        movimiento.registrar_pago(
            monto_pago=validated_data['monto_pago'],
            fecha_pago=fecha_pago
        )

        # Crear movimiento de egreso real (pago efectivo)
        descripcion_base = f"Pago a {movimiento.proveedor.nombre if movimiento.proveedor else 'proveedor'}"
        observacion = validated_data.get('observacion', '').strip()
        descripcion_completa = f"{descripcion_base} - {observacion}" if observacion else descripcion_base

        MovimientoFinanciero.objects.create(
            fecha=fecha_pago,
            tipo=MovimientoFinanciero.Tipo.EGRESO,
            estado=MovimientoFinanciero.Estado.PAGADO,
            origen=MovimientoFinanciero.Origen.PAGO_PROVEEDOR,
            monto=validated_data['monto_pago'],
            descripcion=descripcion_completa,
            proveedor=movimiento.proveedor,
            referencia_extra=f"Pago parcial ID: {movimiento.id}",
            medio_pago=validated_data["medio_pago"],
        )

        return movimiento


class CuentaBancariaSerializer(serializers.ModelSerializer):
    tipo_cuenta_display = serializers.CharField(source="get_tipo_cuenta_display", read_only=True)

    class Meta:
        model = CuentaBancaria
        fields = (
            "id",
            "banco",
            "numero_cuenta",
            "tipo_cuenta",
            "tipo_cuenta_display",
            "titular",
            "cbu",
            "alias",
            "saldo_actual",
            "fecha_creacion",
            "activa",
        )
        read_only_fields = ("fecha_creacion",)


class MovimientoBancarioSerializer(serializers.ModelSerializer):
    monto = serializers.ReadOnlyField()

    class Meta:
        model = MovimientoBancario
        fields = (
            "id",
            "fecha",
            "descripcion",
            "referencia",
            "debito",
            "credito",
            "monto",
            "saldo",
            "conciliado",
            "movimiento_financiero",
            "observaciones",
        )


class ExtractoBancarioSerializer(serializers.ModelSerializer):
    cuenta_bancaria_info = CuentaBancariaSerializer(source="cuenta_bancaria", read_only=True)
    movimientos = MovimientoBancarioSerializer(many=True, read_only=True)

    class Meta:
        model = ExtractoBancario
        fields = (
            "id",
            "cuenta_bancaria",
            "cuenta_bancaria_info",
            "archivo_nombre",
            "fecha_importacion",
            "fecha_desde",
            "fecha_hasta",
            "saldo_inicial",
            "saldo_final",
            "total_movimientos",
            "procesado",
            "movimientos",
        )
        read_only_fields = ("fecha_importacion", "total_movimientos")


class ConciliacionBancariaSerializer(serializers.ModelSerializer):
    cuenta_bancaria_info = CuentaBancariaSerializer(source="cuenta_bancaria", read_only=True)
    diferencia = serializers.ReadOnlyField()

    class Meta:
        model = ConciliacionBancaria
        fields = (
            "id",
            "cuenta_bancaria",
            "cuenta_bancaria_info",
            "fecha_conciliacion",
            "fecha_creacion",
            "saldo_libro",
            "saldo_banco",
            "diferencia",
            "observaciones",
            "usuario",
        )
        read_only_fields = ("fecha_creacion", "diferencia")


class ImportarExtractoSerializer(serializers.Serializer):
    """Serializer para importar extractos bancarios desde archivo CSV/Excel"""
    cuenta_bancaria = serializers.PrimaryKeyRelatedField(queryset=CuentaBancaria.objects.filter(activa=True))
    archivo = serializers.FileField()
    fecha_desde = serializers.DateField()
    fecha_hasta = serializers.DateField()
    saldo_inicial = serializers.DecimalField(max_digits=12, decimal_places=2)
    saldo_final = serializers.DecimalField(max_digits=12, decimal_places=2)

    def validate_archivo(self, value):
        """Validar que el archivo sea CSV o Excel"""
        if not value.name.lower().endswith(('.csv', '.xlsx', '.xls')):
            raise serializers.ValidationError("Solo se permiten archivos CSV o Excel (.csv, .xlsx, .xls)")
        return value

    def validate(self, attrs):
        """Validar fechas y saldos"""
        if attrs['fecha_desde'] > attrs['fecha_hasta']:
            raise serializers.ValidationError("La fecha desde no puede ser mayor a la fecha hasta")

        if attrs['saldo_inicial'] < 0 or attrs['saldo_final'] < 0:
            raise serializers.ValidationError("Los saldos no pueden ser negativos")

        return attrs


class ConfiguracionAFIPSerializer(serializers.ModelSerializer):
    ambiente_display = serializers.CharField(source="get_ambiente_display", read_only=True)

    class Meta:
        model = ConfiguracionAFIP
        fields = (
            "id",
            "cuit",
            "razon_social",
            "ambiente",
            "ambiente_display",
            "certificado_path",
            "clave_privada_path",
            "punto_venta",
            "activa",
            "fecha_creacion",
            "ultima_actualizacion",
        )
        read_only_fields = ("fecha_creacion", "ultima_actualizacion")


class DetalleFacturaElectronicaSerializer(serializers.ModelSerializer):
    importe_neto = serializers.ReadOnlyField()
    importe_iva = serializers.ReadOnlyField()
    importe_total = serializers.ReadOnlyField()

    class Meta:
        model = DetalleFacturaElectronica
        fields = (
            "id",
            "descripcion",
            "cantidad",
            "precio_unitario",
            "alicuota_iva",
            "importe_neto",
            "importe_iva",
            "importe_total",
        )


class LogAFIPSerializer(serializers.ModelSerializer):
    class Meta:
        model = LogAFIP
        fields = (
            "id",
            "fecha_hora",
            "accion",
            "resultado",
            "mensaje",
            "codigo_error",
        )
        read_only_fields = ("fecha_hora",)


class FacturaElectronicaSerializer(serializers.ModelSerializer):
    configuracion_afip_info = ConfiguracionAFIPSerializer(source="configuracion_afip", read_only=True)
    tipo_comprobante_display = serializers.CharField(source="get_tipo_comprobante_display", read_only=True)
    cliente_tipo_documento_display = serializers.CharField(source="get_cliente_tipo_documento_display", read_only=True)
    estado_display = serializers.CharField(source="get_estado_display", read_only=True)
    numero_completo = serializers.ReadOnlyField()
    detalles = DetalleFacturaElectronicaSerializer(many=True, read_only=True)
    logs = LogAFIPSerializer(many=True, read_only=True)
    venta_info = serializers.SerializerMethodField()

    class Meta:
        model = FacturaElectronica
        fields = (
            "id",
            "configuracion_afip",
            "configuracion_afip_info",
            "tipo_comprobante",
            "tipo_comprobante_display",
            "punto_venta",
            "numero_comprobante",
            "numero_completo",
            "fecha_emision",
            "fecha_vencimiento",
            "cliente_tipo_documento",
            "cliente_tipo_documento_display",
            "cliente_numero_documento",
            "cliente_razon_social",
            "cliente_email",
            "cliente_domicilio",
            "importe_total",
            "importe_neto",
            "importe_iva",
            "importe_otros_tributos",
            "cae",
            "fecha_vencimiento_cae",
            "estado",
            "estado_display",
            "observaciones_afip",
            "venta",
            "venta_info",
            "fecha_creacion",
            "fecha_autorizacion",
            "usuario_creacion",
            "detalles",
            "logs",
        )
        read_only_fields = (
            "numero_comprobante",
            "numero_completo",
            "cae",
            "fecha_vencimiento_cae",
            "fecha_creacion",
            "fecha_autorizacion",
        )

    def get_venta_info(self, obj):
        if obj.venta:
            return {
                "id": obj.venta.id,
                "fecha": obj.venta.fecha,
                "total": float(obj.venta.total),
                "cliente_nombre": obj.venta.cliente.nombre if obj.venta.cliente else None,
            }
        return None


class CrearFacturaElectronicaSerializer(serializers.Serializer):
    """Serializer para crear facturas electrónicas desde ventas existentes"""
    venta_id = serializers.IntegerField()
    configuracion_afip_id = serializers.IntegerField()
    tipo_comprobante = serializers.ChoiceField(choices=FacturaElectronica.TipoComprobante.choices)
    cliente_tipo_documento = serializers.ChoiceField(
        choices=FacturaElectronica.TipoDocumento.choices,
        default=FacturaElectronica.TipoDocumento.DNI
    )
    cliente_numero_documento = serializers.CharField(max_length=20)
    cliente_razon_social = serializers.CharField(max_length=255)
    cliente_email = serializers.EmailField(required=False, allow_blank=True)
    cliente_domicilio = serializers.CharField(max_length=255, required=False, allow_blank=True)
    incluir_iva = serializers.BooleanField(default=True)
    alicuota_iva = serializers.DecimalField(max_digits=5, decimal_places=2, default=21.00)

    def validate_venta_id(self, value):
        from ventas.models import Venta
        try:
            venta = Venta.objects.get(id=value)
            # Verificar que no tenga ya una factura electrónica
            if hasattr(venta, 'factura_electronica'):
                raise serializers.ValidationError("Esta venta ya tiene una factura electrónica asociada")
            return value
        except Venta.DoesNotExist:
            raise serializers.ValidationError("La venta especificada no existe")

    def validate_configuracion_afip_id(self, value):
        try:
            config = ConfiguracionAFIP.objects.get(id=value, activa=True)
            return value
        except ConfiguracionAFIP.DoesNotExist:
            raise serializers.ValidationError("La configuración AFIP especificada no existe o no está activa")

    def create(self, validated_data):
        from ventas.models import Venta
        from decimal import Decimal

        venta = Venta.objects.get(id=validated_data['venta_id'])
        configuracion_afip = ConfiguracionAFIP.objects.get(id=validated_data['configuracion_afip_id'])

        # Calcular importes
        importe_neto = venta.total
        if validated_data['incluir_iva']:
            # Si se incluye IVA, calcular neto e IVA por separado
            factor_iva = 1 + (validated_data['alicuota_iva'] / 100)
            importe_neto = venta.total / factor_iva
            importe_iva = venta.total - importe_neto
        else:
            importe_iva = Decimal("0")

        # Crear factura electrónica
        factura = FacturaElectronica.objects.create(
            configuracion_afip=configuracion_afip,
            tipo_comprobante=validated_data['tipo_comprobante'],
            punto_venta=configuracion_afip.punto_venta,
            fecha_emision=venta.fecha,
            cliente_tipo_documento=validated_data['cliente_tipo_documento'],
            cliente_numero_documento=validated_data['cliente_numero_documento'],
            cliente_razon_social=validated_data['cliente_razon_social'],
            cliente_email=validated_data.get('cliente_email', ''),
            cliente_domicilio=validated_data.get('cliente_domicilio', ''),
            importe_total=venta.total,
            importe_neto=importe_neto,
            importe_iva=importe_iva,
            importe_otros_tributos=Decimal("0"),
            venta=venta,
            estado=FacturaElectronica.Estado.BORRADOR,
            usuario_creacion=getattr(self.context.get('request'), 'user', {}).get('username', 'Sistema')
        )

        # Crear detalles desde líneas de venta
        for linea in venta.lineas.all():
            DetalleFacturaElectronica.objects.create(
                factura=factura,
                descripcion=linea.producto.nombre if linea.producto else "Producto/Servicio",
                cantidad=linea.cantidad,
                precio_unitario=linea.precio_unitario,
                alicuota_iva=validated_data['alicuota_iva'] if validated_data['incluir_iva'] else Decimal("0")
            )

        return factura


class AutorizarFacturaSerializer(serializers.Serializer):
    """Serializer para autorizar facturas con AFIP"""
    facturas_ids = serializers.ListField(
        child=serializers.IntegerField(),
        allow_empty=False,
        help_text="Lista de IDs de facturas a autorizar"
    )

    def validate_facturas_ids(self, value):
        facturas = FacturaElectronica.objects.filter(
            id__in=value,
            estado__in=[
                FacturaElectronica.Estado.BORRADOR,
                FacturaElectronica.Estado.PENDIENTE,
                FacturaElectronica.Estado.RECHAZADO
            ]
        )

        if facturas.count() != len(value):
            raise serializers.ValidationError("Algunas facturas no existen o no están en estado autorizable")

        return value


class PeriodoIVASerializer(serializers.ModelSerializer):
    """Serializer para períodos de IVA"""
    nombre_mes = serializers.CharField(read_only=True)
    estado_display = serializers.CharField(source="get_estado_display", read_only=True)
    total_pagado = serializers.SerializerMethodField()

    class Meta:
        model = PeriodoIVA
        fields = (
            "id",
            "anio",
            "mes",
            "nombre_mes",
            "fecha_desde",
            "fecha_hasta",
            "estado",
            "estado_display",
            "iva_debito_fiscal",
            "iva_credito_fiscal",
            "saldo_favor_fisco",
            "saldo_favor_contribuyente",
            "fecha_presentacion",
            "numero_presentacion",
            "observaciones",
            "total_pagado",
            "fecha_creacion",
            "fecha_actualizacion",
        )
        read_only_fields = (
            "iva_debito_fiscal",
            "iva_credito_fiscal",
            "saldo_favor_fisco",
            "saldo_favor_contribuyente",
            "fecha_creacion",
            "fecha_actualizacion",
        )

    def get_total_pagado(self, obj):
        """Calcula el total pagado en este período"""
        from django.db.models import Sum
        total = obj.pagos.aggregate(total=Sum('monto'))['total']
        return str(total) if total else "0.00"


class PagoIVASerializer(serializers.ModelSerializer):
    """Serializer para pagos de IVA"""
    periodo_str = serializers.CharField(source="periodo.__str__", read_only=True)
    medio_pago_display = serializers.CharField(source="get_medio_pago_display", read_only=True)

    class Meta:
        model = PagoIVA
        fields = (
            "id",
            "periodo",
            "periodo_str",
            "fecha_pago",
            "monto",
            "medio_pago",
            "medio_pago_display",
            "numero_comprobante",
            "observaciones",
            "movimiento_financiero",
            "fecha_creacion",
        )
        read_only_fields = ("movimiento_financiero", "fecha_creacion")

    def validate(self, attrs):
        """Validar que el monto no exceda el saldo a pagar del período"""
        periodo = attrs.get('periodo')
        monto = attrs.get('monto')

        if periodo and monto:
            # Calcular cuánto falta pagar en este período
            from django.db.models import Sum
            total_pagado = periodo.pagos.aggregate(total=Sum('monto'))['total'] or 0
            saldo_pendiente = periodo.saldo_favor_fisco - total_pagado

            if monto > saldo_pendiente:
                raise serializers.ValidationError({
                    'monto': f'El monto excede el saldo pendiente de ${saldo_pendiente}'
                })

        return attrs


class RecalcularIVASerializer(serializers.Serializer):
    """Serializer para recalcular IVA de un período"""
    periodo_id = serializers.IntegerField()

    def validate_periodo_id(self, value):
        """Verificar que el período existe"""
        try:
            PeriodoIVA.objects.get(id=value)
        except PeriodoIVA.DoesNotExist:
            raise serializers.ValidationError("El período no existe")
        return value
