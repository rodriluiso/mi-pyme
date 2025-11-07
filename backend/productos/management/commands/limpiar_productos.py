from django.core.management.base import BaseCommand
from productos.models import Producto


class Command(BaseCommand):
    help = 'Elimina todos los productos de la base de datos'

    def add_arguments(self, parser):
        parser.add_argument(
            '--confirm',
            action='store_true',
            help='Confirmar eliminación sin preguntar',
        )

    def handle(self, *args, **options):
        productos = Producto.objects.all()
        total = productos.count()

        if total == 0:
            self.stdout.write(self.style.WARNING('No hay productos para eliminar.'))
            return

        self.stdout.write(f'Se encontraron {total} productos:')
        for producto in productos:
            self.stdout.write(f'  - {producto.nombre} (ID: {producto.id})')

        if not options['confirm']:
            confirmacion = input(f'\n¿Deseas eliminar TODOS los {total} productos? (escribe "SI" para confirmar): ')
            if confirmacion.strip().upper() != 'SI':
                self.stdout.write(self.style.WARNING('Operación cancelada.'))
                return

        productos.delete()
        self.stdout.write(self.style.SUCCESS(f'✓ Se eliminaron {total} productos correctamente.'))
