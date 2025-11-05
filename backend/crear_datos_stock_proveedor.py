#!/usr/bin/env python
"""
Script para crear datos de prueba de stock por proveedor
"""
import os
import sys
import django
from decimal import Decimal
from datetime import date

# Configurar Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from compras.models import MateriaPrima, StockPorProveedor
from proveedores.models import Proveedor

def crear_datos_stock_proveedor():
    """Crear datos de prueba de stock por proveedor"""

    # Obtener materias primas y proveedores existentes
    materias_primas = MateriaPrima.objects.filter(activo=True)
    proveedores = Proveedor.objects.filter(activo=True)

    if not materias_primas.exists():
        print("No hay materias primas activas. Creando una de prueba...")
        mp = MateriaPrima.objects.create(
            nombre="Harina",
            sku="HAR001",
            descripcion="Harina de trigo",
            unidad_medida="kg",
            stock=Decimal("100.000"),
            precio_promedio=Decimal("2.50")
        )
        materias_primas = [mp]

    if not proveedores.exists():
        print("No hay proveedores activos. Creando algunos de prueba...")
        prov1 = Proveedor.objects.create(
            nombre="Proveedor A",
            identificacion="20123456781",
            contacto="Juan Pérez",
            telefono="+54911234567",
            correo="contacto@proveedora.com",
            direccion="Av. Corrientes 1234"
        )
        prov2 = Proveedor.objects.create(
            nombre="Proveedor B",
            identificacion="20987654321",
            contacto="María García",
            telefono="+54911987654",
            correo="info@proveedorb.com",
            direccion="Av. Santa Fe 5678"
        )
        proveedores = [prov1, prov2]

    # Crear registros de stock por proveedor
    for mp in materias_primas:
        stock_total = mp.stock

        # Dividir el stock entre los proveedores disponibles
        if len(proveedores) >= 2:
            # Distribuir stock entre múltiples proveedores
            porcentaje_prov1 = Decimal("0.6")  # 60% al primer proveedor
            porcentaje_prov2 = Decimal("0.4")  # 40% al segundo proveedor

            stock_prov1 = stock_total * porcentaje_prov1
            stock_prov2 = stock_total * porcentaje_prov2

            # Crear o actualizar registros
            stock_por_prov1, created = StockPorProveedor.objects.get_or_create(
                materia_prima=mp,
                proveedor=proveedores[0],
                defaults={
                    'cantidad_stock': stock_prov1,
                    'precio_promedio': mp.precio_promedio,
                    'ultima_compra': date.today(),
                    'total_comprado': stock_prov1 * Decimal("1.2")  # 20% más comprado históricamente
                }
            )

            stock_por_prov2, created = StockPorProveedor.objects.get_or_create(
                materia_prima=mp,
                proveedor=proveedores[1],
                defaults={
                    'cantidad_stock': stock_prov2,
                    'precio_promedio': mp.precio_promedio * Decimal("1.1"),  # Precio ligeramente diferente
                    'ultima_compra': date.today(),
                    'total_comprado': stock_prov2 * Decimal("1.5")  # 50% más comprado históricamente
                }
            )

            print(f"Stock creado para {mp.nombre}:")
            print(f"   - {proveedores[0].nombre}: {stock_prov1} {mp.unidad_medida}")
            print(f"   - {proveedores[1].nombre}: {stock_prov2} {mp.unidad_medida}")

        else:
            # Solo un proveedor disponible
            stock_por_prov, created = StockPorProveedor.objects.get_or_create(
                materia_prima=mp,
                proveedor=proveedores[0],
                defaults={
                    'cantidad_stock': stock_total,
                    'precio_promedio': mp.precio_promedio,
                    'ultima_compra': date.today(),
                    'total_comprado': stock_total * Decimal("1.3")
                }
            )
            print(f"Stock creado para {mp.nombre}: {proveedores[0].nombre} - {stock_total} {mp.unidad_medida}")

if __name__ == "__main__":
    print("Creando datos de stock por proveedor...")
    crear_datos_stock_proveedor()
    print("Datos creados exitosamente!")