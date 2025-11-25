from django.core.management.base import BaseCommand
from usuarios.models import Usuario
from rest_framework.authtoken.models import Token


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

            # Regenerar token para que refleje los nuevos permisos
            Token.objects.filter(user=usuario).delete()
            new_token = Token.objects.create(user=usuario)

            self.stdout.write(
                self.style.SUCCESS(
                    f'Usuario "{username}" promocionado a ADMIN_TOTAL correctamente'
                )
            )
            self.stdout.write(
                self.style.SUCCESS(
                    f'Nuevo token generado: {new_token.key}'
                )
            )
            self.stdout.write(
                self.style.WARNING(
                    'El usuario debe cerrar sesión y volver a iniciar sesión'
                )
            )
        except Usuario.DoesNotExist:
            self.stdout.write(
                self.style.ERROR(f'Usuario "{username}" no encontrado')
            )
