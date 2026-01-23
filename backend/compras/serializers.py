from decimal import Decimal
from datetime import datetime

from django.db import transaction
from rest_framework import serializers

from .models import AjusteStockMateriaPrima, CategoriaCompra, Compra, CompraLinea, MateriaPrima, StockPorProveedor


class MateriaPrimaSerializer(serializers.ModelSerializer):
    class Meta:
        model = MateriaPrima
        fields = (
            "id", "nombre", "sku", "descripcion", "unidad_medida",
            "stock", "stock_minimo", "precio_promedio", "activo"
        )


class CategoriaCompraSerializer(serializers.ModelSerializer):
    class Meta:
        model = CategoriaCompra
        fields = ("id", "nombre", "descripcion")


class CompraLineaSerializer(serializers.ModelSerializer):
    materia_prima = serializers.PrimaryKeyRelatedField(
        queryset=MateriaPrima.objects.all(), allow_null=True, required=False
    )
    subtotal = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    materia_prima_nombre = serializers.CharField(source="materia_prima.nombre", read_only=True)

    class Meta:
        model = CompraLinea
        fields = (
            "id",
            "materia_prima",
            "materia_prima_nombre",
            "descripcion",
            "cantidad",
            "precio_unitario",
            "total_linea",
            "subtotal",
        )

    def validate(self, attrs):
        cantidad = attrs.get("cantidad")
        precio = attrs.get("precio_unitario")
        total_linea = attrs.get("total_linea")
        materia_prima = attrs.get("materia_prima")

        def is_positive(value):
            return value is not None and value > 0

        if not any(map(is_positive, (cantidad, total_linea))):
            raise serializers.ValidationError(
                "Debes especificar cantidad o un total_linea para la compra."
            )

        if total_linea is None:
            if precio is None or precio <= 0:
                raise serializers.ValidationError(
                    "Si no indicas total_linea debes indicar precio_unitario positivo."
                )
        if cantidad is not None and cantidad <= 0:
            raise serializers.ValidationError("La cantidad debe ser mayor a cero si se informa.")
        if total_linea is not None and total_linea <= 0:
            raise serializers.ValidationError("El total_linea debe ser mayor a cero si se informa.")
        if materia_prima and not is_positive(cantidad):
            raise serializers.ValidationError(
                "Para actualizar el stock de la materia prima debes informar cantidad."
            )
        return attrs


class CompraSerializer(serializers.ModelSerializer):
    proveedor_nombre = serializers.CharField(source="proveedor.nombre", read_only=True)
    categoria_nombre = serializers.CharField(source="categoria.nombre", read_only=True)
    lineas = CompraLineaSerializer(many=True)

    class Meta:
        model = Compra
        fields = (
            "id",
            "fecha",
            "numero",
            "proveedor",
            "proveedor_nombre",
            "categoria",
            "categoria_nombre",
            # Campos de IVA
            "incluye_iva",
            "subtotal",
            "iva_monto",
            "total",
            "notas",
            "lineas",
        )

    def _build_lineas(self, compra: Compra, lineas_data):
        # revert stock from existing lines
        for linea in compra.lineas.select_related("materia_prima"):
            if linea.materia_prima and linea.unidades_para_stock > 0:
                linea.materia_prima.quitar_stock(linea.unidades_para_stock)
        compra.lineas.all().delete()

        subtotal = Decimal("0")
        for linea_data in lineas_data:
            linea = CompraLinea.objects.create(compra=compra, **linea_data)
            subtotal += linea.subtotal
            # El stock se actualiza automáticamente en el método save() del modelo

        # Calcular IVA si está incluido
        iva_monto = Decimal("0")
        if compra.incluye_iva:
            iva_monto = subtotal * Decimal("0.21")  # 21% de IVA

        total = subtotal + iva_monto

        compra.subtotal = subtotal
        compra.iva_monto = iva_monto
        compra.total = total
        compra.save(update_fields=["subtotal", "iva_monto", "total"])
        return total

    def create(self, validated_data):
        """
        Crea una compra con soporte opcional de undo.

        Si ENABLE_UNDO_SYSTEM está activado, usa CompraService para registrar
        la compra con capacidad de deshacer. Si está desactivado, usa la
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
        Usa CompraService para registrar la compra.
        """
        from usuarios.services.compra_service import CompraService

        # Obtener user del contexto
        user = self.context['request'].user

        # Extraer datos
        lineas_data = validated_data.pop("lineas", [])
        proveedor_id = validated_data['proveedor'].id
        incluye_iva = validated_data.get('incluye_iva', False)
        fecha = validated_data.get('fecha')
        numero = validated_data.get('numero', '')
        categoria_id = validated_data.get('categoria').id if validated_data.get('categoria') else None
        notas = validated_data.get('notas', '')

        # Convertir lineas_data al formato esperado por CompraService
        lineas_service = []
        for linea_data in lineas_data:
            linea_dict = {
                'materia_prima': linea_data.get('materia_prima').id if linea_data.get('materia_prima') else None,
                'descripcion': linea_data.get('descripcion', ''),
                'cantidad': linea_data.get('cantidad'),
                'precio_unitario': linea_data.get('precio_unitario'),
                'total_linea': linea_data.get('total_linea')
            }
            lineas_service.append(linea_dict)

        # Usar CompraService para crear la compra con undo
        compra = CompraService.crear_compra(
            user=user,
            proveedor_id=proveedor_id,
            lineas_data=lineas_service,
            incluye_iva=incluye_iva,
            fecha=fecha,
            numero=numero,
            categoria_id=categoria_id,
            notas=notas
        )

        return compra

    @transaction.atomic
    def _create_original(self, validated_data):
        """
        Implementación original sin sistema de undo.
        Se mantiene como fallback para compatibilidad.
        """
        lineas_data = validated_data.pop("lineas", [])
        compra = Compra.objects.create(**validated_data)
        total = self._build_lineas(compra, lineas_data)
        if isinstance(compra.fecha, datetime):
            compra.fecha = compra.fecha.date()
        self._sync_movimiento_financiero(compra, total)
        return compra

    @transaction.atomic
    def update(self, instance, validated_data):
        lineas_data = validated_data.pop("lineas", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if lineas_data is not None:
            total = self._build_lineas(instance, lineas_data)
        else:
            total = instance.recalcular_total()
        if isinstance(instance.fecha, datetime):
            instance.fecha = instance.fecha.date()
        self._sync_movimiento_financiero(instance, total)
        return instance

    def _sync_movimiento_financiero(self, compra: Compra, total):
        from finanzas_reportes.models import MovimientoFinanciero

        descripcion = f"Compra #{compra.numero or compra.id} - {compra.proveedor.nombre}"
        movimiento, _created = MovimientoFinanciero.objects.get_or_create(
            compra=compra,
            defaults={
                "fecha": compra.fecha,
                "tipo": MovimientoFinanciero.Tipo.EGRESO,
                "estado": MovimientoFinanciero.Estado.PENDIENTE,
                "origen": MovimientoFinanciero.Origen.COMPRA,
                "monto": total,
                "descripcion": descripcion,
                "proveedor": compra.proveedor,
            },
        )
        if not _created:
            movimiento.fecha = compra.fecha
            movimiento.monto = total
            movimiento.tipo = MovimientoFinanciero.Tipo.EGRESO
            movimiento.estado = MovimientoFinanciero.Estado.PENDIENTE
            movimiento.origen = MovimientoFinanciero.Origen.COMPRA
            movimiento.descripcion = descripcion
            movimiento.proveedor = compra.proveedor
            movimiento.save(update_fields=["fecha", "monto", "tipo", "estado", "origen", "descripcion", "proveedor"])


class AjusteStockMateriaPrimaSerializer(serializers.ModelSerializer):
    materia_prima_nombre = serializers.CharField(source="materia_prima.nombre", read_only=True)
    tipo_ajuste_display = serializers.CharField(source="get_tipo_ajuste_display", read_only=True)
    proveedor_nombre = serializers.CharField(source="proveedor.nombre", read_only=True)

    class Meta:
        model = AjusteStockMateriaPrima
        fields = (
            "id", "fecha", "materia_prima", "materia_prima_nombre", "proveedor",
            "proveedor_nombre", "tipo_ajuste", "tipo_ajuste_display", "cantidad",
            "stock_anterior", "stock_nuevo", "motivo", "usuario"
        )
        read_only_fields = ("fecha", "stock_anterior", "stock_nuevo")


class AjustarStockSerializer(serializers.Serializer):
    """Serializer para ajustar stock de materia prima"""
    tipo_ajuste = serializers.ChoiceField(
        choices=AjusteStockMateriaPrima.TipoAjuste.choices,
        default=AjusteStockMateriaPrima.TipoAjuste.CORRECCION
    )
    cantidad = serializers.DecimalField(
        max_digits=12,
        decimal_places=3,
        help_text="Cantidad a ajustar (positiva para agregar, negativa para quitar)"
    )
    motivo = serializers.CharField(
        max_length=255,
        help_text="Motivo del ajuste de stock"
    )
    usuario = serializers.CharField(
        max_length=100,
        required=False,
        allow_blank=True,
        help_text="Usuario que realiza el ajuste"
    )
    proveedor_id = serializers.IntegerField(
        required=False,
        allow_null=True,
        help_text="ID del proveedor específico para ajustes de salida/consumo"
    )

    def validate_cantidad(self, value):
        if value == 0:
            raise serializers.ValidationError("La cantidad no puede ser cero")
        return value

    def validate_motivo(self, value):
        if not value.strip():
            raise serializers.ValidationError("El motivo es requerido")
        return value.strip()


class StockPorProveedorSerializer(serializers.ModelSerializer):
    """Serializer para mostrar stock desglosado por proveedor"""
    materia_prima_nombre = serializers.CharField(source="materia_prima.nombre", read_only=True)
    proveedor_nombre = serializers.CharField(source="proveedor.nombre", read_only=True)
    unidad_medida = serializers.CharField(source="materia_prima.unidad_medida", read_only=True)

    class Meta:
        model = StockPorProveedor
        fields = (
            "id", "materia_prima", "materia_prima_nombre", "proveedor", "proveedor_nombre",
            "cantidad_stock", "precio_promedio", "ultima_compra", "total_comprado",
            "unidad_medida"
        )


class StockResumenPorProveedorSerializer(serializers.Serializer):
    """Serializer para resumen de stock agrupado por materia prima y proveedor"""
    materia_prima_id = serializers.IntegerField()
    materia_prima_nombre = serializers.CharField()
    sku = serializers.CharField(allow_blank=True)
    unidad_medida = serializers.CharField()
    stock_total = serializers.DecimalField(max_digits=12, decimal_places=3)
    proveedores = StockPorProveedorSerializer(many=True, read_only=True)