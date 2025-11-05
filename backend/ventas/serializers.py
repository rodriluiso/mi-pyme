from decimal import Decimal

from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

from clientes.models import Cliente
from productos.models import Producto
from finanzas_reportes.models import MovimientoFinanciero, PagoCliente
from .models import LineaVenta, Venta


class LineaVentaSerializer(serializers.ModelSerializer):
    producto = serializers.PrimaryKeyRelatedField(
        queryset=Producto.objects.filter(activo=True), allow_null=True, required=False
    )
    producto_nombre = serializers.CharField(source="producto.nombre", read_only=True)
    subtotal = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = LineaVenta
        fields = ("id", "producto", "producto_nombre", "descripcion", "cantidad", "cantidad_kg", "precio_unitario", "subtotal")

    def validate(self, attrs):
        cantidad = attrs.get("cantidad")
        if cantidad is not None and cantidad <= 0:
            raise serializers.ValidationError({"cantidad": "La cantidad en unidades debe ser mayor a cero"})
        cantidad_kg = attrs.get("cantidad_kg")
        if cantidad_kg is not None and cantidad_kg < 0:
            raise serializers.ValidationError({"cantidad_kg": "La cantidad en kg no puede ser negativa"})
        precio = attrs.get("precio_unitario")
        if precio is not None and precio < 0:
            raise serializers.ValidationError({"precio_unitario": "El precio no puede ser negativo"})
        return attrs


class VentaSerializer(serializers.ModelSerializer):
    lineas = LineaVentaSerializer(many=True)
    cliente_nombre = serializers.CharField(source="cliente.nombre", read_only=True)

    # Campos calculados para estados de pago (comentados temporalmente para estabilidad)
    # total_pagado = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    # saldo_pendiente = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    # porcentaje_pagado = serializers.FloatField(read_only=True)
    # estado_pago = serializers.CharField(read_only=True)
    # dias_vencimiento = serializers.IntegerField(read_only=True)
    # esta_vencido = serializers.BooleanField(read_only=True)
    # urgencia_cobranza = serializers.CharField(read_only=True)
    # puede_enviar_recordatorio = serializers.BooleanField(read_only=True)

    class Meta:
        model = Venta
        fields = (
            "id", "fecha", "numero", "cliente", "cliente_nombre",
            # Campos de IVA
            "incluye_iva", "subtotal", "iva_monto", "total", "lineas",
            # Campos de cobranzas
            "fecha_vencimiento", "condicion_pago", "observaciones_cobro",
            "fecha_ultimo_recordatorio",
        )

    def _sync_movimiento(self, venta: Venta) -> None:
        # Las ventas ya no generan movimientos financieros automáticamente
        # Solo los pagos de clientes generan ingresos reales
        pass

    def _validar_stock_disponible(self, lineas_data):
        errores = []
        for linea in lineas_data:
            producto = linea.get("producto")
            if not producto:
                continue
            cantidad = linea.get("cantidad")
            cantidad_kg = linea.get("cantidad_kg") or Decimal("0")

            if cantidad is None or cantidad <= 0:
                errores.append("Debes indicar una cantidad positiva para el producto seleccionado.")
                continue

            # Validar stock en unidades
            if producto.stock < cantidad:
                errores.append(
                    f"Stock insuficiente en unidades para {producto.nombre}. Disponible: {producto.stock} unidades."
                )

            # Validar stock en kilogramos
            if cantidad_kg > 0 and producto.stock_kg < cantidad_kg:
                errores.append(
                    f"Stock insuficiente en kg para {producto.nombre}. Disponible: {producto.stock_kg} kg."
                )
        if errores:
            raise serializers.ValidationError({"lineas": errores})

    def _restaurar_stock(self, venta: Venta) -> None:
        for linea in venta.lineas.select_related("producto"):
            if linea.producto:
                linea.producto.agregar_stock(linea.cantidad, cantidad_kg=linea.cantidad_kg)

    def _aplicar_lineas(self, venta: Venta, lineas_data):
        subtotal = Decimal("0")
        for linea_data in lineas_data:
            producto = linea_data.get("producto")
            cantidad = linea_data.get("cantidad") or Decimal("0")
            cantidad_kg = linea_data.get("cantidad_kg") or Decimal("0")
            linea = LineaVenta.objects.create(venta=venta, **linea_data)
            subtotal += linea.subtotal
            if producto:
                try:
                    # Descontar tanto unidades como kilogramos del stock
                    producto.quitar_stock(cantidad, cantidad_kg=cantidad_kg)
                except ValueError as exc:
                    raise serializers.ValidationError({"lineas": [str(exc)]})

        # Calcular IVA si está incluido
        iva_monto = Decimal("0")
        if venta.incluye_iva:
            iva_monto = subtotal * Decimal("0.21")  # 21% de IVA

        total = subtotal + iva_monto
        return subtotal, iva_monto, total

    @transaction.atomic
    def create(self, validated_data):
        lineas_data = validated_data.pop("lineas", [])
        self._validar_stock_disponible(lineas_data)

        # Establecer valores por defecto para campos de cobranzas
        if 'condicion_pago' not in validated_data:
            validated_data['condicion_pago'] = "Contado"

        venta = Venta.objects.create(**validated_data)
        subtotal, iva_monto, total = self._aplicar_lineas(venta, lineas_data)
        venta.subtotal = subtotal
        venta.iva_monto = iva_monto
        venta.total = total
        venta.save(update_fields=["subtotal", "iva_monto", "total"])
        self._sync_movimiento(venta)
        return venta

    @transaction.atomic
    def update(self, instance, validated_data):
        lineas_data = validated_data.pop("lineas", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if lineas_data is not None:
            self._restaurar_stock(instance)
            instance.lineas.all().delete()
            self._validar_stock_disponible(lineas_data)
            subtotal, iva_monto, total = self._aplicar_lineas(instance, lineas_data)
            instance.subtotal = subtotal
            instance.iva_monto = iva_monto
            instance.total = total
        else:
            subtotal = sum((linea.subtotal for linea in instance.lineas.all()), Decimal("0"))
            iva_monto = Decimal("0")
            if instance.incluye_iva:
                iva_monto = subtotal * Decimal("0.21")
            total = subtotal + iva_monto
            instance.subtotal = subtotal
            instance.iva_monto = iva_monto
            instance.total = total
        instance.save()
        self._sync_movimiento(instance)
        return instance


class VentaRapidaSerializer(serializers.Serializer):
    cliente = serializers.PrimaryKeyRelatedField(queryset=Cliente.objects.all())
    producto = serializers.PrimaryKeyRelatedField(
        queryset=Producto.objects.filter(activo=True), required=False, allow_null=True
    )
    descripcion = serializers.CharField(max_length=200)
    cantidad = serializers.DecimalField(max_digits=10, decimal_places=2, help_text="Cantidad en unidades (para stock)")
    cantidad_kg = serializers.DecimalField(max_digits=10, decimal_places=3, help_text="Cantidad en kilogramos (para facturación)")
    precio_unitario = serializers.DecimalField(max_digits=12, decimal_places=2, help_text="Precio por kilogramo")
    numero = serializers.CharField(max_length=40, required=False, allow_blank=True)

    # Campo de IVA
    incluye_iva = serializers.BooleanField(default=False, required=False)

    # Campos para gestión de cobranzas
    condicion_pago = serializers.CharField(max_length=50, required=False, default="Contado")
    fecha_vencimiento = serializers.DateField(required=False, allow_null=True)
    observaciones_cobro = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        cantidad = attrs.get("cantidad")
        if cantidad is not None and cantidad <= 0:
            raise serializers.ValidationError({"cantidad": "La cantidad en unidades debe ser mayor a cero"})
        cantidad_kg = attrs.get("cantidad_kg")
        if cantidad_kg is not None and cantidad_kg < 0:
            raise serializers.ValidationError({"cantidad_kg": "La cantidad en kg no puede ser negativa"})

        producto = attrs.get("producto")
        if producto:
            # Validar stock en unidades
            if producto.stock < cantidad:
                raise serializers.ValidationError({
                    "producto": f"Stock insuficiente en unidades para {producto.nombre}. Disponible: {producto.stock} unidades."
                })
            # Validar stock en kilogramos
            if cantidad_kg > 0 and producto.stock_kg < cantidad_kg:
                raise serializers.ValidationError({
                    "producto": f"Stock insuficiente en kg para {producto.nombre}. Disponible: {producto.stock_kg} kg."
                })
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        cliente = validated_data["cliente"]
        producto = validated_data.get("producto")
        descripcion = validated_data["descripcion"]
        cantidad = validated_data["cantidad"]
        cantidad_kg = validated_data["cantidad_kg"]
        precio_unitario = validated_data["precio_unitario"]
        numero = validated_data.get("numero", "")

        # Campo de IVA
        incluye_iva = validated_data.get("incluye_iva", False)

        # Campos de cobranzas
        condicion_pago = validated_data.get("condicion_pago", "Contado")
        fecha_vencimiento = validated_data.get("fecha_vencimiento")
        observaciones_cobro = validated_data.get("observaciones_cobro", "")

        venta = Venta.objects.create(
            cliente=cliente,
            numero=numero,
            incluye_iva=incluye_iva,
            condicion_pago=condicion_pago,
            fecha_vencimiento=fecha_vencimiento,
            observaciones_cobro=observaciones_cobro
        )
        linea = LineaVenta.objects.create(
            venta=venta,
            producto=producto,
            descripcion=descripcion,
            cantidad=cantidad,
            cantidad_kg=cantidad_kg,
            precio_unitario=precio_unitario,
        )

        # Calcular subtotal usando cantidad_kg × precio, IVA y total
        subtotal = linea.subtotal
        iva_monto = Decimal("0")
        if incluye_iva:
            iva_monto = subtotal * Decimal("0.21")
        total = subtotal + iva_monto

        venta.subtotal = subtotal
        venta.iva_monto = iva_monto
        venta.total = total
        venta.save(update_fields=["subtotal", "iva_monto", "total"])

        # Descontar stock en UNIDADES y KILOGRAMOS
        if producto:
            try:
                producto.quitar_stock(cantidad, cantidad_kg=cantidad_kg)
            except ValueError as exc:
                raise serializers.ValidationError({"producto": str(exc)})
        return venta


class RegistroPagoSerializer(serializers.Serializer):
    cliente = serializers.PrimaryKeyRelatedField(queryset=Cliente.objects.all())
    venta = serializers.PrimaryKeyRelatedField(
        queryset=Venta.objects.all(),
        required=False,
        allow_null=True,
        help_text="Factura/venta asociada (opcional)"
    )
    monto = serializers.DecimalField(max_digits=12, decimal_places=2)
    medio = serializers.ChoiceField(choices=PagoCliente.Medio.choices)
    observacion = serializers.CharField(required=False, allow_blank=True, max_length=200)
    fecha = serializers.DateField(required=False)

    @transaction.atomic
    def create(self, validated_data):
        if not validated_data.get("fecha"):
            validated_data["fecha"] = timezone.now().date()
        return PagoCliente.objects.create(**validated_data)