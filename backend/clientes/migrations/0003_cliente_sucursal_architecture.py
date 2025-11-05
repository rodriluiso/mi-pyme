# Generated manually for Cliente/SucursalCliente architecture migration

from django.db import migrations, models
import django.db.models.deletion


def migrate_data_to_new_structure(apps, schema_editor):
    """
    Migrates existing Cliente data to new Cliente/SucursalCliente structure.
    Each existing Cliente becomes a Cliente entity with one SucursalCliente.
    """
    Cliente = apps.get_model('clientes', 'Cliente')
    SucursalCliente = apps.get_model('clientes', 'SucursalCliente')

    # Update existing clientes with new field values
    for cliente in Cliente.objects.all():
        # Populate new fields based on old field values
        cliente.razon_social = cliente.nombre or 'Cliente sin nombre'
        cliente.correo_principal = cliente.correo or ''
        cliente.telefono_principal = cliente.telefono or ''
        cliente.direccion_fiscal = cliente.direccion or ''
        cliente.localidad_fiscal = cliente.localidad or ''
        cliente.activo = True
        cliente.save()

        # Create default SucursalCliente (location) for each existing cliente
        SucursalCliente.objects.create(
            cliente=cliente,
            nombre_sucursal='Sucursal Principal',
            codigo_sucursal='PRINCIPAL',
            direccion=cliente.direccion or '',
            localidad=cliente.localidad or '',
            telefono=cliente.telefono or '',
            activo=True
        )


def reverse_migrate_data(apps, schema_editor):
    """
    Reverse migration: Convert back to single Cliente model
    """
    Cliente = apps.get_model('clientes', 'Cliente')
    SucursalCliente = apps.get_model('clientes', 'SucursalCliente')

    # This is a destructive operation - we can only keep one sucursal per cliente
    for cliente in Cliente.objects.all():
        # Get the first active sucursal or any sucursal
        sucursal = cliente.sucursales.filter(activo=True).first() or cliente.sucursales.first()
        if sucursal:
            # Update cliente with sucursal data for backward compatibility
            cliente.nombre = cliente.razon_social
            cliente.correo = cliente.correo_principal
            cliente.telefono = sucursal.telefono or cliente.telefono_principal
            cliente.direccion = sucursal.direccion
            cliente.localidad = sucursal.localidad
            cliente.save()


class Migration(migrations.Migration):

    dependencies = [
        ('clientes', '0002_cliente_localidad'),
    ]

    operations = [
        # Step 1: Create new SucursalCliente model
        migrations.CreateModel(
            name='SucursalCliente',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('nombre_sucursal', models.CharField(help_text='Nombre descriptivo de la sucursal', max_length=200)),
                ('codigo_sucursal', models.CharField(help_text='Código interno de la sucursal', max_length=50, blank=True)),
                ('contacto_responsable', models.CharField(max_length=100, blank=True)),
                ('telefono', models.CharField(blank=True, max_length=20)),
                ('correo', models.EmailField(blank=True)),
                ('direccion', models.CharField(max_length=200)),
                ('localidad', models.CharField(max_length=100)),
                ('codigo_postal', models.CharField(blank=True, max_length=10)),
                ('horario_entrega', models.CharField(max_length=100, blank=True, help_text='Horarios preferidos para entrega')),
                ('observaciones', models.TextField(blank=True, help_text='Observaciones especiales para entregas')),
                ('activo', models.BooleanField(default=True)),
                ('fecha_creacion', models.DateTimeField(auto_now_add=True)),
            ],
            options={
                'verbose_name': 'Sucursal de Cliente',
                'verbose_name_plural': 'Sucursales de Clientes',
                'ordering': ['cliente__razon_social', 'nombre_sucursal'],
            },
        ),

        # Step 2: Add new fields to Cliente model
        migrations.AddField(
            model_name='cliente',
            name='razon_social',
            field=models.CharField(default='', help_text='Razón social de la empresa', max_length=200),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name='cliente',
            name='correo_principal',
            field=models.EmailField(blank=True, help_text='Correo electrónico principal'),
        ),
        migrations.AddField(
            model_name='cliente',
            name='telefono_principal',
            field=models.CharField(blank=True, help_text='Teléfono principal', max_length=20),
        ),
        migrations.AddField(
            model_name='cliente',
            name='direccion_fiscal',
            field=models.CharField(blank=True, help_text='Dirección fiscal registrada', max_length=200),
        ),
        migrations.AddField(
            model_name='cliente',
            name='localidad_fiscal',
            field=models.CharField(blank=True, help_text='Localidad de la dirección fiscal', max_length=100),
        ),
        migrations.AddField(
            model_name='cliente',
            name='activo',
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name='cliente',
            name='fecha_creacion',
            field=models.DateTimeField(auto_now_add=True, null=True),
        ),
        migrations.AddField(
            model_name='cliente',
            name='observaciones',
            field=models.TextField(blank=True),
        ),

        # Step 3: Add foreign key to SucursalCliente
        migrations.AddField(
            model_name='sucursalcliente',
            name='cliente',
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='sucursales', to='clientes.cliente'),
        ),

        # Step 4: Add unique constraint for sucursal codes
        migrations.AlterUniqueTogether(
            name='sucursalcliente',
            unique_together={('cliente', 'codigo_sucursal')},
        ),

        # Step 5: Migrate existing data
        migrations.RunPython(
            migrate_data_to_new_structure,
            reverse_migrate_data,
        ),

        # Step 6: Remove old fields (after data migration)
        migrations.RemoveField(
            model_name='cliente',
            name='nombre',
        ),
        migrations.RemoveField(
            model_name='cliente',
            name='direccion',
        ),
        migrations.RemoveField(
            model_name='cliente',
            name='telefono',
        ),
        migrations.RemoveField(
            model_name='cliente',
            name='correo',
        ),
        migrations.RemoveField(
            model_name='cliente',
            name='localidad',
        ),

        # Step 7: Update Cliente model options
        migrations.AlterModelOptions(
            name='cliente',
            options={'ordering': ['razon_social'], 'verbose_name': 'Cliente', 'verbose_name_plural': 'Clientes'},
        ),

        # Step 8: Update field help texts and constraints
        migrations.AlterField(
            model_name='cliente',
            name='identificacion',
            field=models.CharField(help_text='CUIT/DNI de la empresa (único por entidad legal)', max_length=20, unique=True),
        ),
    ]