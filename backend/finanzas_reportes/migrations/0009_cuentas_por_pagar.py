# Generated manually for cuentas por pagar functionality

from django.db import migrations, models
import django.db.models.deletion
from decimal import Decimal


class Migration(migrations.Migration):

    dependencies = [
        ('finanzas_reportes', '0008_movimientofinanciero_estado'),
        ('proveedores', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='movimientofinanciero',
            name='estado',
            field=models.CharField(
                choices=[
                    ('PENDIENTE', 'Pendiente'),
                    ('PAGADO', 'Pagado'),
                    ('COBRADO', 'Cobrado'),
                    ('PARCIAL', 'Pago Parcial'),
                    ('CANCELADO', 'Cancelado')
                ],
                default='PAGADO',
                max_length=15
            ),
        ),
        migrations.AddField(
            model_name='movimientofinanciero',
            name='monto_pagado',
            field=models.DecimalField(
                decimal_places=2,
                default=Decimal('0'),
                help_text='Monto ya pagado (para pagos parciales)',
                max_digits=12
            ),
        ),
        migrations.AddField(
            model_name='movimientofinanciero',
            name='fecha_vencimiento',
            field=models.DateField(
                blank=True,
                help_text='Fecha límite de pago (para compras a crédito)',
                null=True
            ),
        ),
        migrations.AddField(
            model_name='movimientofinanciero',
            name='proveedor',
            field=models.ForeignKey(
                blank=True,
                help_text='Proveedor al que se le debe (para egresos)',
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name='movimientos_financieros',
                to='proveedores.proveedor'
            ),
        ),
    ]