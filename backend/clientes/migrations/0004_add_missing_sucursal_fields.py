# Generated manually to add missing SucursalCliente fields

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('clientes', '0003_cliente_sucursal_architecture'),
    ]

    operations = [
        # Add the missing fields to SucursalCliente
        migrations.AddField(
            model_name='sucursalcliente',
            name='contacto_responsable',
            field=models.CharField(blank=True, max_length=100),
        ),
        migrations.AddField(
            model_name='sucursalcliente',
            name='horario_entrega',
            field=models.CharField(blank=True, help_text='Horarios preferidos para entrega', max_length=100),
        ),

        # Update model options to match models.py
        migrations.AlterModelOptions(
            name='sucursalcliente',
            options={'ordering': ['cliente__razon_social', 'nombre_sucursal'], 'verbose_name': 'Sucursal de Cliente', 'verbose_name_plural': 'Sucursales de Cliente'},
        ),

        # Update unique_together constraint
        migrations.AlterUniqueTogether(
            name='sucursalcliente',
            unique_together={('cliente', 'codigo_sucursal')},
        ),
    ]