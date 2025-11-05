from rest_framework import serializers

from .models import Producto


class ProductoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Producto
        fields = (
            "id",
            "nombre",
            "sku",
            "descripcion",
            "precio",
            "stock",
            "stock_kg",
            "stock_minimo",
            "stock_minimo_kg",
            "activo",
        )

    def validate_sku(self, value):
        """Convierte cadenas vacías a None para evitar problemas de unicidad"""
        if value == "":
            return None
        return value