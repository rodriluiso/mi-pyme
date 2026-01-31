"""
Comando de Django para migrar datos existentes al sistema de imputaciones.

Reconstruye retroactivamente los registros de ImputacionPago basándose
en el estado actual de PagoCliente y Venta.

Uso:
    python manage.py migrate_payment_allocations [--dry-run] [--verbose]

Opciones:
    --dry-run: Simula la migración sin escribir en la BD
    --verbose: Muestra información detallada de cada pago procesado
"""

from decimal import Decimal
from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import F, Q, Sum
from finanzas_reportes.models import PagoCliente, ImputacionPago
from ventas.models import Venta


class Command(BaseCommand):
    help = 'Migra pagos existentes al sistema de imputaciones'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Simula la migración sin escribir en la BD',
        )
        parser.add_argument(
            '--verbose',
            action='store_true',
            help='Muestra información detallada',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        verbose = options['verbose']

        self.stdout.write(self.style.WARNING("=" * 70))
        self.stdout.write(self.style.WARNING("MIGRACIÓN DE SISTEMA DE IMPUTACIONES"))
        self.stdout.write(self.style.WARNING("=" * 70))
        self.stdout.write("")

        if dry_run:
            self.stdout.write(self.style.NOTICE("MODO DRY-RUN: No se escribirá en la BD"))
            self.stdout.write("")

        # Verificar que no haya imputaciones previas
        imputaciones_existentes = ImputacionPago.objects.count()
        if imputaciones_existentes > 0 and not dry_run:
            self.stdout.write(
                self.style.ERROR(
                    f"ERROR: Ya existen {imputaciones_existentes} imputaciones en la BD."
                )
            )
            self.stdout.write(
                self.style.ERROR(
                    "Esta migración solo debe ejecutarse una vez sobre una BD limpia de imputaciones."
                )
            )
            return

        # Obtener pagos activos (no anulados)
        pagos = PagoCliente.objects.filter(anulado=False).order_by('fecha', 'id')
        total_pagos = pagos.count()

        self.stdout.write(f"Total de pagos a procesar: {total_pagos}")
        self.stdout.write("")

        stats = {
            'procesados': 0,
            'pagos_directos': 0,
            'pagos_fifo': 0,
            'imputaciones_creadas': 0,
            'errores': 0,
        }

        with transaction.atomic():
            for pago in pagos:
                try:
                    if pago.venta:
                        # Caso 1: Pago directo a factura específica
                        self._migrar_pago_directo(pago, stats, verbose, dry_run)
                    else:
                        # Caso 2: Pago "a cuenta" (reconstruir FIFO)
                        self._migrar_pago_fifo(pago, stats, verbose, dry_run)

                    stats['procesados'] += 1

                    if stats['procesados'] % 100 == 0:
                        self.stdout.write(
                            f"Progreso: {stats['procesados']}/{total_pagos} pagos procesados..."
                        )

                except Exception as e:
                    stats['errores'] += 1
                    self.stdout.write(
                        self.style.ERROR(
                            f"Error procesando Pago #{pago.id}: {str(e)}"
                        )
                    )

            if dry_run:
                # No commitear en dry-run
                transaction.set_rollback(True)

        # Mostrar estadísticas finales
        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS("=" * 70))
        self.stdout.write(self.style.SUCCESS("MIGRACIÓN COMPLETADA"))
        self.stdout.write(self.style.SUCCESS("=" * 70))
        self.stdout.write(f"Pagos procesados: {stats['procesados']}/{total_pagos}")
        self.stdout.write(f"Pagos directos: {stats['pagos_directos']}")
        self.stdout.write(f"Pagos FIFO: {stats['pagos_fifo']}")
        self.stdout.write(f"Imputaciones creadas: {stats['imputaciones_creadas']}")
        self.stdout.write(f"Errores: {stats['errores']}")

        if dry_run:
            self.stdout.write("")
            self.stdout.write(
                self.style.NOTICE(
                    "NOTA: Modo dry-run - ningún cambio fue guardado en la BD"
                )
            )

        # Validar consistencia si no es dry-run
        if not dry_run and stats['errores'] == 0:
            self.stdout.write("")
            self._validar_consistencia()

    def _migrar_pago_directo(self, pago, stats, verbose, dry_run):
        """
        Migra un pago que fue aplicado directamente a una factura específica.
        """
        if pago.venta.anulada:
            if verbose:
                self.stdout.write(
                    self.style.WARNING(
                        f"Pago #{pago.id}: Factura #{pago.venta.id} está anulada, omitiendo"
                    )
                )
            return

        stats['pagos_directos'] += 1

        if not dry_run:
            ImputacionPago.objects.create(
                pago=pago,
                venta=pago.venta,
                monto_imputado=pago.monto,
                observaciones="Migrado automáticamente - pago directo a factura"
            )
            stats['imputaciones_creadas'] += 1

        if verbose:
            self.stdout.write(
                f"Pago #{pago.id} → Factura #{pago.venta.numero or pago.venta.id} "
                f"(${pago.monto})"
            )

    def _migrar_pago_fifo(self, pago, stats, verbose, dry_run):
        """
        Reconstruye las imputaciones de un pago "a cuenta" usando FIFO.

        IMPORTANTE: Como el pago ya fue aplicado en el pasado, debemos
        reconstruir a qué facturas se aplicó basándonos en:
        1. Facturas del cliente anteriores o iguales a fecha del pago
        2. Ordenadas por fecha (FIFO)
        3. Con monto_pagado > 0 (que tuvieron pagos aplicados)
        """
        stats['pagos_fifo'] += 1

        # Obtener facturas del cliente que podrían haber sido pagadas por este pago
        facturas_candidatas = Venta.objects.filter(
            cliente=pago.cliente,
            fecha__lte=pago.fecha,  # Solo facturas anteriores al pago
            anulada=False,
            monto_pagado__gt=0  # Que tengan pagos aplicados
        ).order_by('fecha', 'id')

        monto_restante = pago.monto
        imputaciones = []

        for factura in facturas_candidatas:
            if monto_restante <= 0:
                break

            # Calcular cuánto de esta factura puede ser atribuido a este pago
            # Esto es una APROXIMACIÓN porque no tenemos el historial exacto
            saldo_factura = factura.total - factura.monto_pagado
            monto_atribuible = min(monto_restante, factura.monto_pagado)

            if monto_atribuible > 0:
                imputaciones.append({
                    'factura': factura,
                    'monto': monto_atribuible
                })
                monto_restante -= monto_atribuible

        # Crear imputaciones
        if not dry_run:
            for imp in imputaciones:
                ImputacionPago.objects.create(
                    pago=pago,
                    venta=imp['factura'],
                    monto_imputado=imp['monto'],
                    observaciones="Migrado automáticamente - reconstruido con FIFO"
                )
                stats['imputaciones_creadas'] += 1

        if verbose and imputaciones:
            self.stdout.write(
                f"Pago #{pago.id} (FIFO) → "
                + ", ".join([
                    f"Factura #{imp['factura'].numero or imp['factura'].id} (${imp['monto']})"
                    for imp in imputaciones
                ])
            )

    def _validar_consistencia(self):
        """
        Valida que las imputaciones sean consistentes con monto_pagado.

        Invariante: SUM(imputaciones) = venta.monto_pagado
        """
        self.stdout.write("")
        self.stdout.write(self.style.WARNING("Validando consistencia..."))

        ventas_con_inconsistencias = []

        for venta in Venta.objects.filter(anulada=False, monto_pagado__gt=0):
            total_imputado = ImputacionPago.objects.filter(
                venta=venta,
                revertida=False
            ).aggregate(
                total=Sum('monto_imputado')
            )['total'] or Decimal('0')

            # Permitir una diferencia mínima por redondeo
            diferencia = abs(total_imputado - venta.monto_pagado)

            if diferencia > Decimal('0.01'):
                ventas_con_inconsistencias.append({
                    'venta_id': venta.id,
                    'numero': venta.numero or str(venta.id),
                    'monto_pagado': venta.monto_pagado,
                    'total_imputado': total_imputado,
                    'diferencia': diferencia
                })

        if ventas_con_inconsistencias:
            self.stdout.write(
                self.style.ERROR(
                    f"ADVERTENCIA: {len(ventas_con_inconsistencias)} facturas con inconsistencias:"
                )
            )
            for v in ventas_con_inconsistencias[:10]:  # Mostrar solo las primeras 10
                self.stdout.write(
                    self.style.ERROR(
                        f"  Factura #{v['numero']}: "
                        f"monto_pagado=${v['monto_pagado']}, "
                        f"imputado=${v['total_imputado']}, "
                        f"diferencia=${v['diferencia']}"
                    )
                )
        else:
            self.stdout.write(
                self.style.SUCCESS("Validación OK: Todas las facturas son consistentes")
            )
