from rest_framework import serializers

from finanzas_reportes.models import MovimientoFinanciero
from .models import Empleado, PagoEmpleado


class EmpleadoSerializer(serializers.ModelSerializer):
    nombre_completo = serializers.ReadOnlyField()

    class Meta:
        model = Empleado
        fields = ("id", "nombre", "apellidos", "nombre_completo", "identificacion", "cuil",
                 "telefono", "fecha_ingreso", "direccion", "puesto", "activo")


class PagoEmpleadoSerializer(serializers.ModelSerializer):
    empleado_nombre = serializers.CharField(source="empleado.nombre_completo", read_only=True)
    medio_pago_display = serializers.CharField(source="get_medio_pago_display", read_only=True)

    class Meta:
        model = PagoEmpleado
        fields = ("id", "fecha", "empleado", "empleado_nombre", "monto", "medio_pago",
                 "medio_pago_display", "concepto", "generar_recibo")

    def create(self, validated_data):
        pago = super().create(validated_data)
        # Crear movimiento financiero automáticamente
        MovimientoFinanciero.objects.create(
            fecha=pago.fecha,
            tipo=MovimientoFinanciero.Tipo.EGRESO,
            origen=MovimientoFinanciero.Origen.PAGO_EMPLEADO,
            estado=MovimientoFinanciero.Estado.PAGADO,
            monto=pago.monto,
            monto_pagado=pago.monto,
            medio_pago=pago.medio_pago,
            descripcion=pago.concepto or f"Pago a {pago.empleado.nombre_completo}",
            referencia_extra=f"empleado:{pago.empleado_id}",
        )
        return pago