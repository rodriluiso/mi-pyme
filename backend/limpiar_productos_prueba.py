"""
Script para limpiar productos de prueba de la base de datos.
Uso: python limpiar_productos_prueba.py
"""
import os
import django

# Configurar Django para desarrollo local
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings.dev')
django.setup()

from productos.models import Producto

def limpiar_productos():
    """Eliminar todos los productos de la base de datos"""
    productos = Producto.objects.all()
    total = productos.count()

    if total == 0:
        print("No hay productos para eliminar.")
        return

    print(f"Se encontraron {total} productos:")
    for producto in productos:
        print(f"  - {producto.nombre} (ID: {producto.id})")

    confirmacion = input(f"\n¿Deseas eliminar TODOS los {total} productos? (escribe 'SI' para confirmar): ")

    if confirmacion.strip().upper() == 'SI':
        productos.delete()
        print(f"\n✓ Se eliminaron {total} productos correctamente.")
    else:
        print("\nOperación cancelada.")

if __name__ == '__main__':
    limpiar_productos()
