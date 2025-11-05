from rest_framework import serializers

from .models import Proveedor


class ProveedorSerializer(serializers.ModelSerializer):
    total_compras = serializers.DecimalField(max_digits=18, decimal_places=2, read_only=True)
    total_pagado = serializers.DecimalField(max_digits=18, decimal_places=2, read_only=True)
    saldo = serializers.DecimalField(max_digits=18, decimal_places=2, read_only=True)

    class Meta:
        model = Proveedor
        fields = (
            "id",
            "nombre",
            "identificacion",
            "contacto",
            "telefono",
            "correo",
            "direccion",
            "notas",
            "activo",
            "total_compras",
            "total_pagado",
            "saldo",
        )
