from django.core.management.base import BaseCommand
from usuarios.models import Usuario


class Command(BaseCommand):
    help = 'Promocionar un usuario a ADMIN_TOTAL'

    def add_arguments(self, parser):
        parser.add_argument('username', type=str, help='Nombre de usuario a promocionar')

    def handle(self, *args, **options):
        username = options['username']

        try:
            usuario = Usuario.objects.get(username=username)
            usuario.nivel_acceso = 'ADMIN_TOTAL'
            usuario.save()

            self.stdout.write(
                self.style.SUCCESS(
                    f'Usuario "{username}" promocionado a ADMIN_TOTAL correctamente'
                )
            )
        except Usuario.DoesNotExist:
            self.stdout.write(
                self.style.ERROR(f'Usuario "{username}" no encontrado')
            )
