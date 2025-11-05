from datetime import datetime, timedelta
from decimal import Decimal
from django.db.models import Sum, Avg, Count, Min, Max, Q
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from compras.models import Compra, MateriaPrima
from productos.models import Producto
from recursos_humanos.models import Empleado
from ventas.models import Venta, LineaVenta
from clientes.models import Cliente
from .models import (
    MovimientoFinanciero,
    PagoCliente,
    PagoProveedor,
    CuentaBancaria,
    ExtractoBancario,
    MovimientoBancario,
    ConciliacionBancaria,
    ConfiguracionAFIP,
    FacturaElectronica,
    DetalleFacturaElectronica,
    LogAFIP,
    MedioPago,
    PeriodoIVA,
    PagoIVA,
)
from .serializers import (
    GastoManualSerializer,
    MovimientoFinancieroSerializer,
    PagoClienteSerializer,
    PagoProveedorSerializer,
    RegistrarPagoSerializer,
    CuentaBancariaSerializer,
    ExtractoBancarioSerializer,
    MovimientoBancarioSerializer,
    ConciliacionBancariaSerializer,
    ImportarExtractoSerializer,
    ConfiguracionAFIPSerializer,
    FacturaElectronicaSerializer,
    DetalleFacturaElectronicaSerializer,
    LogAFIPSerializer,
    CrearFacturaElectronicaSerializer,
    AutorizarFacturaSerializer,
    PeriodoIVASerializer,
    PagoIVASerializer,
    RecalcularIVASerializer,
)


class PagoClienteViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = PagoCliente.objects.select_related("cliente").all()
    serializer_class = PagoClienteSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["cliente", "medio", "fecha"]
    search_fields = ["cliente__nombre", "medio", "observacion"]
    ordering_fields = ["fecha", "monto", "cliente__nombre"]
    ordering = ["-fecha", "-id"]


class PagoProveedorViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = PagoProveedor.objects.select_related("proveedor").all()
    serializer_class = PagoProveedorSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["proveedor", "fecha", "medio"]
    search_fields = ["proveedor__nombre", "proveedor__identificacion", "observacion", "medio"]
    ordering_fields = ["fecha", "monto", "proveedor__nombre", "medio"]
    ordering = ["-fecha", "-id"]


class MovimientoFinancieroViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = MovimientoFinanciero.objects.select_related("compra", "venta", "proveedor").all()
    serializer_class = MovimientoFinancieroSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = {
        "tipo": ["exact"],
        "origen": ["exact"],
        "estado": ["exact"],
        "fecha": ["gte", "lte"],
        "fecha_vencimiento": ["gte", "lte"],
        "compra": ["exact"],
        "venta": ["exact"],
        "proveedor": ["exact"],
        "medio_pago": ["exact"],
    }
    search_fields = ["descripcion", "referencia_extra", "proveedor__nombre", "medio_pago"]
    ordering_fields = ["fecha", "monto", "tipo", "origen", "estado", "fecha_vencimiento", "medio_pago"]
    ordering = ["-fecha", "-id"]

    @action(detail=False, methods=["get"], url_path="gastos")
    def listar_gastos(self, request):
        origenes = [opcion.value for opcion in MovimientoFinanciero.Origen.gastos_registrables()]
        queryset = self.filter_queryset(
            self.get_queryset().filter(
                tipo=MovimientoFinanciero.Tipo.EGRESO, origen__in=origenes
            )
        )
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"], url_path="ingresos")
    def listar_ingresos(self, request):
        queryset = self.filter_queryset(self.get_queryset().filter(tipo=MovimientoFinanciero.Tipo.INGRESO))
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"], url_path="efectivo-real")
    def listar_efectivo_real(self, request):
        """Movimientos que representan efectivo real (PAGADO/COBRADO)"""
        queryset = self.filter_queryset(
            self.get_queryset().filter(
                estado__in=[MovimientoFinanciero.Estado.PAGADO, MovimientoFinanciero.Estado.COBRADO]
            )
        )
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"], url_path="compromisos-pendientes")
    def listar_compromisos_pendientes(self, request):
        """Movimientos pendientes (cuentas por pagar/cobrar)"""
        queryset = self.filter_queryset(
            self.get_queryset().filter(estado__in=[MovimientoFinanciero.Estado.PENDIENTE, MovimientoFinanciero.Estado.PARCIAL])
        )
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["post"], url_path="registrar-gasto")
    def registrar_gasto(self, request):
        serializer = GastoManualSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        movimiento = serializer.save()
        data = self.get_serializer(movimiento).data
        return Response(data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["get"], url_path="cuentas-por-pagar")
    def listar_cuentas_por_pagar(self, request):
        """Lista movimientos pendientes por pagar (egresos)"""
        queryset = self.filter_queryset(
            self.get_queryset().filter(
                tipo=MovimientoFinanciero.Tipo.EGRESO,
                estado__in=[MovimientoFinanciero.Estado.PENDIENTE, MovimientoFinanciero.Estado.PARCIAL]
            )
        )
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"], url_path="cuentas-por-cobrar")
    def listar_cuentas_por_cobrar(self, request):
        """Lista movimientos pendientes por cobrar (ingresos)"""
        queryset = self.filter_queryset(
            self.get_queryset().filter(
                tipo=MovimientoFinanciero.Tipo.INGRESO,
                estado__in=[MovimientoFinanciero.Estado.PENDIENTE, MovimientoFinanciero.Estado.PARCIAL]
            )
        )
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["post"], url_path="registrar-pago")
    def registrar_pago(self, request):
        """Registra un pago contra una cuenta por pagar pendiente"""
        serializer = RegistrarPagoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        movimiento = serializer.save()
        data = self.get_serializer(movimiento).data
        return Response(data, status=status.HTTP_200_OK)

    @action(detail=False, methods=["get"], url_path="resumen-cuentas-pagar")
    def resumen_cuentas_pagar(self, request):
        """Resumen de cuentas por pagar con totales y vencimientos"""
        pendientes = MovimientoFinanciero.pendientes_por_pagar()

        # Calcular totales
        total_pendiente = MovimientoFinanciero.total_pendiente_pagar()

        # Agrupar por proveedor
        from django.db.models import Sum
        resumen_proveedores = {}

        for mov in pendientes:
            if mov.proveedor:
                proveedor_id = mov.proveedor.id
                proveedor_nombre = mov.proveedor.nombre

                if proveedor_id not in resumen_proveedores:
                    resumen_proveedores[proveedor_id] = {
                        'proveedor_id': proveedor_id,
                        'proveedor_nombre': proveedor_nombre,
                        'total_pendiente': 0,
                        'cantidad_movimientos': 0,
                        'movimientos_vencidos': 0,
                        'total_vencido': 0
                    }

                monto_pendiente = mov.monto_pendiente
                resumen_proveedores[proveedor_id]['total_pendiente'] += monto_pendiente
                resumen_proveedores[proveedor_id]['cantidad_movimientos'] += 1

                # Verificar si está vencido
                if mov.fecha_vencimiento and mov.fecha_vencimiento < datetime.now().date():
                    resumen_proveedores[proveedor_id]['movimientos_vencidos'] += 1
                    resumen_proveedores[proveedor_id]['total_vencido'] += monto_pendiente

        # Movimientos próximos a vencer (próximos 7 días)
        fecha_limite = datetime.now().date() + timedelta(days=7)
        proximos_vencer = [
            mov for mov in pendientes
            if mov.fecha_vencimiento and mov.fecha_vencimiento <= fecha_limite
        ]

        return Response({
            'resumen_general': {
                'total_pendiente_pagar': str(total_pendiente),
                'cantidad_movimientos': len(pendientes),
                'cantidad_proveedores': len(resumen_proveedores),
                'proximos_vencer_7_dias': len(proximos_vencer)
            },
            'por_proveedor': list(resumen_proveedores.values()),
            'movimientos_detalle': self.get_serializer(pendientes, many=True).data,
            'proximos_vencimientos': self.get_serializer(proximos_vencer, many=True).data
        })

    @action(detail=False, methods=['get'], url_path='resumen/pendiente')
    def resumen_pendiente(self, request):
        fecha_desde = request.query_params.get('fecha_desde')
        fecha_hasta = request.query_params.get('fecha_hasta')
        fecha_desde_val = None
        fecha_hasta_val = None

        if fecha_desde:
            try:
                fecha_desde_val = datetime.strptime(fecha_desde, '%Y-%m-%d').date()
            except ValueError:
                return Response(
                    {'detail': 'fecha_desde invalida. Usa formato AAAA-MM-DD'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        if fecha_hasta:
            try:
                fecha_hasta_val = datetime.strptime(fecha_hasta, '%Y-%m-%d').date()
            except ValueError:
                return Response(
                    {'detail': 'fecha_hasta invalida. Usa formato AAAA-MM-DD'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        if fecha_desde_val and fecha_hasta_val and fecha_hasta_val < fecha_desde_val:
            return Response(
                {'detail': "El rango de fechas es invalido. 'fecha_hasta' debe ser igual o posterior a 'fecha_desde'."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        ventas_qs = Venta.objects.all()
        pagos_qs = PagoCliente.objects.all()
        compras_qs = Compra.objects.all()
        origenes_gasto = [opcion.value for opcion in MovimientoFinanciero.Origen.gastos_registrables()]
        gastos_qs = MovimientoFinanciero.objects.filter(
            tipo=MovimientoFinanciero.Tipo.EGRESO, origen__in=origenes_gasto
        )

        if fecha_desde_val:
            ventas_qs = ventas_qs.filter(fecha__gte=fecha_desde_val)
            pagos_qs = pagos_qs.filter(fecha__gte=fecha_desde_val)
            compras_qs = compras_qs.filter(fecha__gte=fecha_desde_val)
            gastos_qs = gastos_qs.filter(fecha__gte=fecha_desde_val)
        if fecha_hasta_val:
            ventas_qs = ventas_qs.filter(fecha__lte=fecha_hasta_val)
            pagos_qs = pagos_qs.filter(fecha__lte=fecha_hasta_val)
            compras_qs = compras_qs.filter(fecha__lte=fecha_hasta_val)
            gastos_qs = gastos_qs.filter(fecha__lte=fecha_hasta_val)

        # IMPORTANTE: Usamos subtotal (sin IVA) para ingresos reales
        # El IVA es un impuesto a recaudar, no un ingreso de la empresa
        total_ventas_subtotal = ventas_qs.aggregate(total=Sum('subtotal')) or {}
        total_ventas_total = ventas_qs.aggregate(total=Sum('total')) or {}
        total_ventas_iva = ventas_qs.aggregate(total=Sum('iva_monto')) or {}
        total_pagos = pagos_qs.aggregate(total=Sum('monto')) or {}
        total_compras = compras_qs.aggregate(total=Sum('total')) or {}
        total_gastos = gastos_qs.aggregate(total=Sum('monto')) or {}

        total_ventas_subtotal_val = total_ventas_subtotal.get('total') or Decimal('0')
        total_ventas_total_val = total_ventas_total.get('total') or Decimal('0')
        total_ventas_iva_val = total_ventas_iva.get('total') or Decimal('0')
        total_pagos_val = total_pagos.get('total') or Decimal('0')
        total_compras_val = total_compras.get('total') or Decimal('0')
        total_gastos_val = total_gastos.get('total') or Decimal('0')

        # Cálculos de balance (SIN IVA en ingresos)
        # Pendiente de cobro: total facturado - pagos recibidos
        pendiente = total_ventas_total_val - total_pagos_val

        # Ingresos reales (sin IVA)
        total_ingresos = total_ventas_subtotal_val

        # Egresos
        total_egresos = total_compras_val + total_gastos_val

        # Balance neto (ingresos reales - egresos)
        balance_neto = total_ingresos - total_egresos

        # Calcular porcentaje de margen (si hay ingresos)
        margen_porcentaje = 0
        if total_ingresos > 0:
            margen_porcentaje = float((balance_neto / total_ingresos) * 100)

        return Response({
            'total_ventas': str(total_ventas_total_val),  # Total facturado (con IVA)
            'total_ventas_sin_iva': str(total_ventas_subtotal_val),  # Ingreso real
            'iva_ventas': str(total_ventas_iva_val),  # IVA a pagar a AFIP
            'total_pagos': str(total_pagos_val),
            'pendiente_cobro': str(pendiente),
            'total_compras': str(total_compras_val),
            'total_gastos': str(total_gastos_val),
            'balance': {
                'total_ingresos': str(total_ingresos),  # SIN IVA
                'total_egresos': str(total_egresos),
                'balance_neto': str(balance_neto),
                'margen_porcentaje': round(margen_porcentaje, 2),
                'es_positivo': balance_neto > 0,
                'estado': 'positivo' if balance_neto > 0 else 'negativo' if balance_neto < 0 else 'neutral'
            }
        })

    @action(detail=False, methods=['get'], url_path='resumen/liquidez')
    def resumen_liquidez(self, request):
        """Obtiene resumen de liquidez separando efectivo real vs comprometido"""
        fecha_desde = request.query_params.get('fecha_desde')
        fecha_hasta = request.query_params.get('fecha_hasta')
        fecha_desde_val = None
        fecha_hasta_val = None

        if fecha_desde:
            try:
                fecha_desde_val = datetime.strptime(fecha_desde, '%Y-%m-%d').date()
            except ValueError:
                return Response(
                    {'detail': 'fecha_desde invalida. Usa formato AAAA-MM-DD'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        if fecha_hasta:
            try:
                fecha_hasta_val = datetime.strptime(fecha_hasta, '%Y-%m-%d').date()
            except ValueError:
                return Response(
                    {'detail': 'fecha_hasta invalida. Usa formato AAAA-MM-DD'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        if fecha_desde_val and fecha_hasta_val and fecha_hasta_val < fecha_desde_val:
            return Response(
                {'detail': "El rango de fechas es invalido. 'fecha_hasta' debe ser igual o posterior a 'fecha_desde'."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Filtros de fecha
        movimientos_qs = MovimientoFinanciero.objects.all()
        if fecha_desde_val:
            movimientos_qs = movimientos_qs.filter(fecha__gte=fecha_desde_val)
        if fecha_hasta_val:
            movimientos_qs = movimientos_qs.filter(fecha__lte=fecha_hasta_val)

        # Calcular métricas por estado
        # Efectivo real (PAGADO/COBRADO)
        ingresos_reales = movimientos_qs.filter(
            tipo=MovimientoFinanciero.Tipo.INGRESO,
            estado=MovimientoFinanciero.Estado.COBRADO
        ).aggregate(total=Sum('monto'))['total'] or Decimal('0')

        egresos_reales = movimientos_qs.filter(
            tipo=MovimientoFinanciero.Tipo.EGRESO,
            estado=MovimientoFinanciero.Estado.PAGADO
        ).aggregate(total=Sum('monto'))['total'] or Decimal('0')

        # Compromisos pendientes
        ingresos_pendientes = movimientos_qs.filter(
            tipo=MovimientoFinanciero.Tipo.INGRESO,
            estado=MovimientoFinanciero.Estado.PENDIENTE
        ).aggregate(total=Sum('monto'))['total'] or Decimal('0')

        egresos_pendientes = movimientos_qs.filter(
            tipo=MovimientoFinanciero.Tipo.EGRESO,
            estado=MovimientoFinanciero.Estado.PENDIENTE
        ).aggregate(total=Sum('monto'))['total'] or Decimal('0')

        # Cálculos de liquidez
        liquidez_real = ingresos_reales - egresos_reales
        liquidez_comprometida = ingresos_pendientes - egresos_pendientes
        liquidez_proyectada = liquidez_real + liquidez_comprometida

        # Estado de liquidez
        estado_liquidez = 'alta'
        if liquidez_real < 0:
            estado_liquidez = 'critica'
        elif liquidez_real < (liquidez_proyectada * Decimal('0.3')):
            estado_liquidez = 'baja'
        elif liquidez_real < (liquidez_proyectada * Decimal('0.6')):
            estado_liquidez = 'media'

        return Response({
            'liquidez': {
                'efectivo_disponible': str(liquidez_real),
                'compromisos_pendientes': str(liquidez_comprometida),
                'liquidez_proyectada': str(liquidez_proyectada),
                'estado_liquidez': estado_liquidez,
                'es_positiva': liquidez_real > 0
            },
            'desglose_ingresos': {
                'cobrados': str(ingresos_reales),
                'pendientes_cobro': str(ingresos_pendientes),
                'total_proyectado': str(ingresos_reales + ingresos_pendientes)
            },
            'desglose_egresos': {
                'pagados': str(egresos_reales),
                'pendientes_pago': str(egresos_pendientes),
                'total_proyectado': str(egresos_reales + egresos_pendientes)
            },
            'alertas': {
                'cuentas_por_cobrar': str(ingresos_pendientes),
                'cuentas_por_pagar': str(egresos_pendientes),
                'necesita_atencion': liquidez_real < 0 or egresos_pendientes > (liquidez_real * 2)
            }
        })

    @action(detail=False, methods=['get'], url_path='resumen/por-medio')
    def resumen_por_medio(self, request):
        """Obtiene resumen de dinero por medio de pago (Efectivo, Cheque, Transferencia)"""
        from django.db.models import Case, When, Value, CharField

        fecha_desde = request.query_params.get('fecha_desde')
        fecha_hasta = request.query_params.get('fecha_hasta')
        fecha_desde_val = None
        fecha_hasta_val = None

        if fecha_desde:
            try:
                fecha_desde_val = datetime.strptime(fecha_desde, '%Y-%m-%d').date()
            except ValueError:
                return Response(
                    {'detail': 'fecha_desde invalida. Usa formato AAAA-MM-DD'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        if fecha_hasta:
            try:
                fecha_hasta_val = datetime.strptime(fecha_hasta, '%Y-%m-%d').date()
            except ValueError:
                return Response(
                    {'detail': 'fecha_hasta invalida. Usa formato AAAA-MM-DD'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        movimientos_qs = MovimientoFinanciero.objects.filter(
            estado__in=[
                MovimientoFinanciero.Estado.PAGADO,
                MovimientoFinanciero.Estado.COBRADO,
            ],
            medio_pago__isnull=False,
        ).exclude(medio_pago="")
        if fecha_desde_val:
            movimientos_qs = movimientos_qs.filter(fecha__gte=fecha_desde_val)
        if fecha_hasta_val:
            movimientos_qs = movimientos_qs.filter(fecha__lte=fecha_hasta_val)

        ingresos_por_medio = movimientos_qs.filter(
            tipo=MovimientoFinanciero.Tipo.INGRESO
        ).values('medio_pago').annotate(
            total=Sum('monto'),
            cantidad_operaciones=Count('id')
        )

        egresos_por_medio = movimientos_qs.filter(
            tipo=MovimientoFinanciero.Tipo.EGRESO
        ).values('medio_pago').annotate(
            total=Sum('monto'),
            cantidad_operaciones=Count('id')
        )

        # Construir resumen por medio
        resumen_medios = {}

        # Inicializar con ceros
        for medio, _ in MedioPago.choices:
            resumen_medios[medio] = {
                'ingresos': Decimal('0'),
                'egresos': Decimal('0'),
                'neto': Decimal('0'),
                'cantidad_ingresos': 0,
                'cantidad_egresos': 0
            }

        # Llenar ingresos por medio
        for ingreso in ingresos_por_medio:
            medio = ingreso['medio_pago'] or ''
            if medio not in resumen_medios:
                continue
            resumen_medios[medio]['ingresos'] = ingreso['total'] or Decimal('0')
            resumen_medios[medio]['cantidad_ingresos'] = ingreso['cantidad_operaciones']

        # Llenar egresos por medio
        for egreso in egresos_por_medio:
            medio = egreso['medio_pago'] or ''
            if medio not in resumen_medios:
                continue
            resumen_medios[medio]['egresos'] = egreso['total'] or Decimal('0')
            resumen_medios[medio]['cantidad_egresos'] = egreso['cantidad_operaciones']

        # Calcular netos
        for medio in resumen_medios:
            resumen_medios[medio]['neto'] = (
                resumen_medios[medio]['ingresos'] - resumen_medios[medio]['egresos']
            )

        # Convertir a formato de respuesta
        resultado = []
        nombres_medios = dict(MedioPago.choices)
        nombres_medios.setdefault('TRANSFERENCIA', 'Transferencia/Cuenta Bancaria')

        for medio, datos in resumen_medios.items():
            resultado.append({
                'medio': medio,
                'medio_display': nombres_medios.get(medio, medio.title()),
                'ingresos': str(datos['ingresos']),
                'egresos': str(datos['egresos']),
                'neto': str(datos['neto']),
                'cantidad_ingresos': datos['cantidad_ingresos'],
                'cantidad_egresos': datos['cantidad_egresos'],
                'es_positivo': datos['neto'] > 0
            })

        # Totales generales
        total_ingresos = sum(Decimal(r['ingresos']) for r in resultado)
        total_egresos = sum(Decimal(r['egresos']) for r in resultado)
        total_neto = total_ingresos - total_egresos

        return Response({
            'por_medio': resultado,
            'totales': {
                'total_ingresos': str(total_ingresos),
                'total_egresos': str(total_egresos),
                'total_neto': str(total_neto),
                'es_positivo': total_neto > 0
            },
            'periodo': {
                'fecha_desde': fecha_desde,
                'fecha_hasta': fecha_hasta
            }
        })

    @action(detail=False, methods=['get'], url_path='comparativas/periodo')
    def comparativas_periodo(self, request):
        """Obtiene comparativas entre períodos para análisis de tendencias"""
        from datetime import timedelta
        from dateutil.relativedelta import relativedelta

        # Parámetros de entrada
        fecha_inicio = request.query_params.get('fecha_inicio')
        fecha_fin = request.query_params.get('fecha_fin')
        tipo_comparacion = request.query_params.get('tipo', 'mes_anterior')  # mes_anterior, año_anterior, trimestre_anterior

        if not fecha_inicio or not fecha_fin:
            return Response(
                {'detail': 'Se requieren fecha_inicio y fecha_fin'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            fecha_inicio_actual = datetime.strptime(fecha_inicio, '%Y-%m-%d').date()
            fecha_fin_actual = datetime.strptime(fecha_fin, '%Y-%m-%d').date()
        except ValueError:
            return Response(
                {'detail': 'Formato de fecha inválido. Usa AAAA-MM-DD'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Calcular período de comparación
        if tipo_comparacion == 'mes_anterior':
            fecha_inicio_anterior = fecha_inicio_actual - relativedelta(months=1)
            fecha_fin_anterior = fecha_fin_actual - relativedelta(months=1)
            etiqueta_anterior = "Mes anterior"
        elif tipo_comparacion == 'año_anterior':
            fecha_inicio_anterior = fecha_inicio_actual - relativedelta(years=1)
            fecha_fin_anterior = fecha_fin_actual - relativedelta(years=1)
            etiqueta_anterior = "Año anterior"
        elif tipo_comparacion == 'trimestre_anterior':
            fecha_inicio_anterior = fecha_inicio_actual - relativedelta(months=3)
            fecha_fin_anterior = fecha_fin_actual - relativedelta(months=3)
            etiqueta_anterior = "Trimestre anterior"
        else:
            return Response(
                {'detail': 'tipo debe ser: mes_anterior, año_anterior, o trimestre_anterior'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Función auxiliar para obtener métricas de un período
        def obtener_metricas_periodo(fecha_desde, fecha_hasta):
            from ventas.models import Venta
            from compras.models import Compra

            # Ventas del período
            ventas_periodo = Venta.objects.filter(
                fecha__gte=fecha_desde,
                fecha__lte=fecha_hasta
            )

            # Compras del período
            compras_periodo = Compra.objects.filter(
                fecha__gte=fecha_desde,
                fecha__lte=fecha_hasta
            )

            # Movimientos financieros del período
            movimientos_periodo = MovimientoFinanciero.objects.filter(
                fecha__gte=fecha_desde,
                fecha__lte=fecha_hasta,
                estado__in=[MovimientoFinanciero.Estado.PAGADO, MovimientoFinanciero.Estado.COBRADO]
            )

            # Calcular métricas
            total_ventas = ventas_periodo.aggregate(total=Sum('total'))['total'] or Decimal('0')
            cantidad_ventas = ventas_periodo.count()
            ticket_promedio = total_ventas / cantidad_ventas if cantidad_ventas > 0 else Decimal('0')

            total_compras = compras_periodo.aggregate(total=Sum('total'))['total'] or Decimal('0')
            cantidad_compras = compras_periodo.count()

            ingresos_reales = movimientos_periodo.filter(
                tipo=MovimientoFinanciero.Tipo.INGRESO
            ).aggregate(total=Sum('monto'))['total'] or Decimal('0')

            egresos_reales = movimientos_periodo.filter(
                tipo=MovimientoFinanciero.Tipo.EGRESO
            ).aggregate(total=Sum('monto'))['total'] or Decimal('0')

            balance_neto = ingresos_reales - egresos_reales
            margen_bruto = total_ventas - total_compras
            margen_porcentaje = (margen_bruto / total_ventas * 100) if total_ventas > 0 else Decimal('0')

            return {
                'ventas': {
                    'total': str(total_ventas),
                    'cantidad': cantidad_ventas,
                    'ticket_promedio': str(ticket_promedio),
                },
                'compras': {
                    'total': str(total_compras),
                    'cantidad': cantidad_compras,
                },
                'flujo_efectivo': {
                    'ingresos': str(ingresos_reales),
                    'egresos': str(egresos_reales),
                    'balance_neto': str(balance_neto),
                },
                'rentabilidad': {
                    'margen_bruto': str(margen_bruto),
                    'margen_porcentaje': float(margen_porcentaje),
                }
            }

        # Obtener métricas de ambos períodos
        metricas_actual = obtener_metricas_periodo(fecha_inicio_actual, fecha_fin_actual)
        metricas_anterior = obtener_metricas_periodo(fecha_inicio_anterior, fecha_fin_anterior)

        # Función para calcular variación porcentual
        def calcular_variacion(actual, anterior):
            actual_val = Decimal(str(actual))
            anterior_val = Decimal(str(anterior))

            if anterior_val == 0:
                return float('inf') if actual_val > 0 else 0

            variacion = ((actual_val - anterior_val) / anterior_val) * 100
            return float(variacion)

        # Calcular variaciones
        comparativas = {
            'periodo_actual': {
                'fecha_inicio': fecha_inicio,
                'fecha_fin': fecha_fin,
                'etiqueta': f"{fecha_inicio_actual.strftime('%d/%m/%Y')} - {fecha_fin_actual.strftime('%d/%m/%Y')}",
                'metricas': metricas_actual
            },
            'periodo_anterior': {
                'fecha_inicio': fecha_inicio_anterior.strftime('%Y-%m-%d'),
                'fecha_fin': fecha_fin_anterior.strftime('%Y-%m-%d'),
                'etiqueta': f"{etiqueta_anterior} ({fecha_inicio_anterior.strftime('%d/%m/%Y')} - {fecha_fin_anterior.strftime('%d/%m/%Y')})",
                'metricas': metricas_anterior
            },
            'variaciones': {
                'ventas_total': calcular_variacion(metricas_actual['ventas']['total'], metricas_anterior['ventas']['total']),
                'ventas_cantidad': calcular_variacion(metricas_actual['ventas']['cantidad'], metricas_anterior['ventas']['cantidad']),
                'ticket_promedio': calcular_variacion(metricas_actual['ventas']['ticket_promedio'], metricas_anterior['ventas']['ticket_promedio']),
                'compras_total': calcular_variacion(metricas_actual['compras']['total'], metricas_anterior['compras']['total']),
                'ingresos': calcular_variacion(metricas_actual['flujo_efectivo']['ingresos'], metricas_anterior['flujo_efectivo']['ingresos']),
                'egresos': calcular_variacion(metricas_actual['flujo_efectivo']['egresos'], metricas_anterior['flujo_efectivo']['egresos']),
                'balance_neto': calcular_variacion(metricas_actual['flujo_efectivo']['balance_neto'], metricas_anterior['flujo_efectivo']['balance_neto']),
                'margen_bruto': calcular_variacion(metricas_actual['rentabilidad']['margen_bruto'], metricas_anterior['rentabilidad']['margen_bruto']),
                'margen_porcentaje': metricas_actual['rentabilidad']['margen_porcentaje'] - metricas_anterior['rentabilidad']['margen_porcentaje'],
            },
            'resumen': {
                'tipo_comparacion': tipo_comparacion,
                'dias_periodo': (fecha_fin_actual - fecha_inicio_actual).days + 1,
                'tendencia_general': 'positiva' if calcular_variacion(metricas_actual['ventas']['total'], metricas_anterior['ventas']['total']) > 0 else 'negativa'
            }
        }

        return Response(comparativas)

    @action(detail=False, methods=['get'])
    def alertas_dashboard(self, request):
        """Obtiene todas las alertas para mostrar en el dashboard"""
        alertas = []

        # 1. Alertas de stock bajo - Productos
        productos_stock_bajo = Producto.productos_con_stock_bajo()
        for producto in productos_stock_bajo:
            alertas.append({
                'tipo': 'stock_bajo',
                'categoria': 'producto',
                'id': producto.id,
                'titulo': f'Stock bajo: {producto.nombre}',
                'descripcion': f'Quedan {producto.stock} unidades (mínimo: {producto.stock_minimo})',
                'urgencia': 'alta' if producto.stock == 0 else 'media',
                'fecha': None,
                'datos': {
                    'stock_actual': str(producto.stock),
                    'stock_minimo': str(producto.stock_minimo),
                    'sku': producto.sku,
                }
            })

        # 2. Alertas de stock bajo - Materias Primas
        materias_stock_bajo = MateriaPrima.materias_primas_con_stock_bajo()
        for materia in materias_stock_bajo:
            alertas.append({
                'tipo': 'stock_bajo',
                'categoria': 'materia_prima',
                'id': materia.id,
                'titulo': f'Stock bajo: {materia.nombre}',
                'descripcion': f'Quedan {materia.stock} {materia.get_unidad_medida_display()} (mínimo: {materia.stock_minimo})',
                'urgencia': 'alta' if materia.stock == 0 else 'media',
                'fecha': None,
                'datos': {
                    'stock_actual': str(materia.stock),
                    'stock_minimo': str(materia.stock_minimo),
                    'unidad_medida': materia.unidad_medida,
                    'sku': materia.sku,
                }
            })

        # 3. Alertas de pagos vencidos usando los nuevos campos
        hoy = datetime.now().date()
        ventas_vencidas = Venta.objects.filter(
            fecha_vencimiento__lt=hoy
        ).select_related('cliente')

        for venta in ventas_vencidas:
            estado_pago = venta.estado_pago
            if estado_pago in ['PENDIENTE', 'PARCIAL', 'VENCIDO']:
                dias_vencida = venta.dias_vencimiento
                saldo_pendiente = venta.saldo_pendiente
                urgencia_cobranza = venta.urgencia_cobranza.lower()

                alertas.append({
                    'tipo': 'pago_vencido',
                    'categoria': 'cliente',
                    'id': venta.cliente.id,
                    'titulo': f'Pago vencido: {venta.cliente.nombre}',
                    'descripcion': f'Venta #{venta.numero or venta.id} - Saldo: ${saldo_pendiente} - {dias_vencida} días vencido',
                    'urgencia': urgencia_cobranza,
                    'fecha': venta.fecha_vencimiento.isoformat(),
                    'datos': {
                        'saldo_pendiente': str(saldo_pendiente),
                        'dias_vencida': dias_vencida,
                        'venta_id': venta.id,
                        'venta_numero': venta.numero,
                        'estado_pago': estado_pago,
                        'condicion_pago': venta.condicion_pago,
                        'puede_enviar_recordatorio': venta.puede_enviar_recordatorio,
                    }
                })

        # 4. Alertas de ventas próximas a vencer (próximos 7 días)
        fecha_limite_proximo = hoy + timedelta(days=7)
        ventas_proximas_vencer = Venta.objects.filter(
            fecha_vencimiento__gte=hoy,
            fecha_vencimiento__lte=fecha_limite_proximo
        ).select_related('cliente')

        for venta in ventas_proximas_vencer:
            estado_pago = venta.estado_pago
            if estado_pago in ['PENDIENTE', 'PARCIAL']:
                dias_hasta_vencimiento = (venta.fecha_vencimiento - hoy).days
                saldo_pendiente = venta.saldo_pendiente

                alertas.append({
                    'tipo': 'pago_proximo_vencer',
                    'categoria': 'cliente',
                    'id': venta.cliente.id,
                    'titulo': f'Pago próximo a vencer: {venta.cliente.nombre}',
                    'descripcion': f'Venta #{venta.numero or venta.id} - Vence en {dias_hasta_vencimiento} días - Saldo: ${saldo_pendiente}',
                    'urgencia': 'media' if dias_hasta_vencimiento <= 3 else 'baja',
                    'fecha': venta.fecha_vencimiento.isoformat(),
                    'datos': {
                        'saldo_pendiente': str(saldo_pendiente),
                        'dias_hasta_vencimiento': dias_hasta_vencimiento,
                        'venta_id': venta.id,
                        'venta_numero': venta.numero,
                        'estado_pago': estado_pago,
                        'puede_enviar_recordatorio': venta.puede_enviar_recordatorio,
                    }
                })

        # 5. Alertas de cuentas por pagar vencidas
        cuentas_vencidas = MovimientoFinanciero.objects.filter(
            tipo=MovimientoFinanciero.Tipo.EGRESO,
            estado__in=[MovimientoFinanciero.Estado.PENDIENTE, MovimientoFinanciero.Estado.PARCIAL],
            fecha_vencimiento__lt=hoy
        ).select_related('proveedor')

        for cuenta in cuentas_vencidas:
            dias_vencida = (hoy - cuenta.fecha_vencimiento).days if cuenta.fecha_vencimiento else 0
            urgencia = 'alta' if dias_vencida > 30 else 'media' if dias_vencida > 7 else 'baja'

            alertas.append({
                'tipo': 'pago_proveedor_vencido',
                'categoria': 'proveedor',
                'id': cuenta.proveedor.id if cuenta.proveedor else None,
                'titulo': f'Pago vencido: {cuenta.proveedor.nombre if cuenta.proveedor else "Proveedor"}',
                'descripcion': f'Vencido hace {dias_vencida} días - Monto pendiente: ${cuenta.monto_pendiente}',
                'urgencia': urgencia,
                'fecha': cuenta.fecha_vencimiento.isoformat() if cuenta.fecha_vencimiento else None,
                'datos': {
                    'monto_pendiente': str(cuenta.monto_pendiente),
                    'dias_vencida': dias_vencida,
                    'movimiento_id': cuenta.id,
                    'descripcion': cuenta.descripcion,
                }
            })

        # 6. Alertas de cuentas por pagar próximas a vencer
        fecha_limite_pago = hoy + timedelta(days=7)
        cuentas_proximas_vencer = MovimientoFinanciero.objects.filter(
            tipo=MovimientoFinanciero.Tipo.EGRESO,
            estado__in=[MovimientoFinanciero.Estado.PENDIENTE, MovimientoFinanciero.Estado.PARCIAL],
            fecha_vencimiento__gte=hoy,
            fecha_vencimiento__lte=fecha_limite_pago
        ).select_related('proveedor')

        for cuenta in cuentas_proximas_vencer:
            dias_hasta_vencimiento = (cuenta.fecha_vencimiento - hoy).days if cuenta.fecha_vencimiento else 0

            alertas.append({
                'tipo': 'pago_proveedor_proximo_vencer',
                'categoria': 'proveedor',
                'id': cuenta.proveedor.id if cuenta.proveedor else None,
                'titulo': f'Pago próximo a vencer: {cuenta.proveedor.nombre if cuenta.proveedor else "Proveedor"}',
                'descripcion': f'Vence en {dias_hasta_vencimiento} días - Monto: ${cuenta.monto_pendiente}',
                'urgencia': 'media' if dias_hasta_vencimiento <= 3 else 'baja',
                'fecha': cuenta.fecha_vencimiento.isoformat() if cuenta.fecha_vencimiento else None,
                'datos': {
                    'monto_pendiente': str(cuenta.monto_pendiente),
                    'dias_hasta_vencimiento': dias_hasta_vencimiento,
                    'movimiento_id': cuenta.id,
                    'descripcion': cuenta.descripcion,
                }
            })

        # 7. Notificaciones de empleados (cumpleaños próximos)
        empleados = Empleado.objects.filter(activo=True)

        for empleado in empleados:
            # Calcular próximo cumpleaños y aniversario
            fecha_ingreso = empleado.fecha_ingreso
            años_trabajando = (hoy - fecha_ingreso).days // 365

            # Aniversario laboral próximo (próximos 7 días)
            proximo_aniversario = fecha_ingreso.replace(year=hoy.year)
            if proximo_aniversario < hoy:
                proximo_aniversario = fecha_ingreso.replace(year=hoy.year + 1)

            dias_hasta_aniversario = (proximo_aniversario - hoy).days
            if 0 <= dias_hasta_aniversario <= 7:
                alertas.append({
                    'tipo': 'aniversario_laboral',
                    'categoria': 'empleado',
                    'id': empleado.id,
                    'titulo': f'Aniversario laboral: {empleado.nombre_completo}',
                    'descripcion': f'Cumple {años_trabajando + 1} años en la empresa en {dias_hasta_aniversario} días',
                    'urgencia': 'baja',
                    'fecha': proximo_aniversario.isoformat(),
                    'datos': {
                        'años_trabajando': años_trabajando + 1,
                        'dias_hasta_aniversario': dias_hasta_aniversario,
                        'puesto': empleado.puesto,
                    }
                })

        # Ordenar alertas por urgencia y fecha
        orden_urgencia = {'alta': 0, 'media': 1, 'baja': 2}
        alertas.sort(key=lambda x: (orden_urgencia.get(x['urgencia'], 3), x['fecha'] or ''))

        return Response({
            'alertas': alertas,
            'total_alertas': len(alertas),
            'alertas_alta': len([a for a in alertas if a['urgencia'] == 'alta']),
            'alertas_media': len([a for a in alertas if a['urgencia'] == 'media']),
            'alertas_baja': len([a for a in alertas if a['urgencia'] == 'baja']),
        })

    @action(detail=False, methods=['get'])
    def reporte_rentabilidad_productos(self, request):
        """Genera reporte de rentabilidad por producto"""
        from django.db.models import F, Sum, Avg, Count
        from ventas.models import LineaVenta
        from compras.models import CompraLinea

        fecha_desde = request.query_params.get('fecha_desde')
        fecha_hasta = request.query_params.get('fecha_hasta')

        # Filtros de fecha si se proporcionan
        filtros_venta = {}
        filtros_compra = {}
        if fecha_desde:
            filtros_venta['venta__fecha__gte'] = fecha_desde
            filtros_compra['compra__fecha__gte'] = fecha_desde
        if fecha_hasta:
            filtros_venta['venta__fecha__lte'] = fecha_hasta
            filtros_compra['compra__fecha__lte'] = fecha_hasta

        # Datos de ventas por producto
        ventas_por_producto = LineaVenta.objects.filter(
            producto__isnull=False,
            **filtros_venta
        ).values(
            'producto__id',
            'producto__nombre',
            'producto__sku'
        ).annotate(
            total_vendido=Sum(F('cantidad') * F('precio_unitario')),
            cantidad_vendida=Sum('cantidad'),
            ventas_count=Count('venta', distinct=True),
            precio_promedio=Avg('precio_unitario')
        )

        # Datos de compras por materia prima (aproximación del costo)
        compras_por_materia = CompraLinea.objects.filter(
            materia_prima__isnull=False,
            **filtros_compra
        ).values(
            'materia_prima__id',
            'materia_prima__nombre'
        ).annotate(
            total_comprado=Sum(F('cantidad') * F('precio_unitario')),
            cantidad_comprada=Sum('cantidad'),
            costo_promedio=Avg('precio_unitario')
        )

        # Construir reporte de rentabilidad
        reporte_productos = []
        for venta in ventas_por_producto:
            producto_id = venta['producto__id']

            # Calcular margen estimado (usando precio promedio vs costo estimado)
            precio_promedio = float(venta['precio_promedio'] or 0)
            costo_estimado = float(Producto.objects.get(id=producto_id).precio or 0)

            margen_bruto = precio_promedio - costo_estimado
            margen_porcentaje = (margen_bruto / precio_promedio * 100) if precio_promedio > 0 else 0

            reporte_productos.append({
                'producto_id': producto_id,
                'producto_nombre': venta['producto__nombre'],
                'producto_sku': venta['producto__sku'],
                'total_vendido': float(venta['total_vendido'] or 0),
                'cantidad_vendida': float(venta['cantidad_vendida'] or 0),
                'ventas_count': venta['ventas_count'],
                'precio_promedio': precio_promedio,
                'costo_estimado': costo_estimado,
                'margen_bruto': margen_bruto,
                'margen_porcentaje': round(margen_porcentaje, 2),
            })

        # Ordenar por rentabilidad
        reporte_productos.sort(key=lambda x: x['total_vendido'], reverse=True)

        return Response({
            'periodo': {
                'fecha_desde': fecha_desde,
                'fecha_hasta': fecha_hasta
            },
            'productos': reporte_productos,
            'resumen': {
                'total_productos': len(reporte_productos),
                'total_vendido': sum(p['total_vendido'] for p in reporte_productos),
                'margen_promedio': sum(p['margen_porcentaje'] for p in reporte_productos) / len(reporte_productos) if reporte_productos else 0
            }
        })

    @action(detail=False, methods=['get'])
    def reporte_rentabilidad_clientes(self, request):
        """Genera reporte de rentabilidad por cliente"""
        from django.db.models import F, Sum, Count, Avg

        fecha_desde = request.query_params.get('fecha_desde')
        fecha_hasta = request.query_params.get('fecha_hasta')

        # Filtros de fecha
        filtros = {}
        if fecha_desde:
            filtros['fecha__gte'] = fecha_desde
        if fecha_hasta:
            filtros['fecha__lte'] = fecha_hasta

        # Análisis por cliente
        ventas_por_cliente = Venta.objects.filter(**filtros).values(
            'cliente__id',
            'cliente__nombre',
            'cliente__identificacion'
        ).annotate(
            total_vendido=Sum('total'),
            ventas_count=Count('id'),
            venta_promedio=Avg('total'),
            primera_venta=Min('fecha'),
            ultima_venta=Max('fecha')
        ).order_by('-total_vendido')

        # Pagos por cliente
        pagos_por_cliente = PagoCliente.objects.filter(**filtros).values(
            'cliente__id'
        ).annotate(
            total_pagado=Sum('monto')
        )

        # Crear diccionario de pagos para lookup rápido
        pagos_dict = {p['cliente__id']: float(p['total_pagado'] or 0) for p in pagos_por_cliente}

        reporte_clientes = []
        for venta in ventas_por_cliente:
            cliente_id = venta['cliente__id']
            total_vendido = float(venta['total_vendido'] or 0)
            total_pagado = pagos_dict.get(cliente_id, 0)
            deuda_pendiente = total_vendido - total_pagado

            # Calcular días desde última venta
            dias_ultima_venta = (datetime.now().date() - venta['ultima_venta']).days if venta['ultima_venta'] else 0

            reporte_clientes.append({
                'cliente_id': cliente_id,
                'cliente_nombre': venta['cliente__nombre'],
                'cliente_identificacion': venta['cliente__identificacion'],
                'total_vendido': total_vendido,
                'total_pagado': total_pagado,
                'deuda_pendiente': deuda_pendiente,
                'ventas_count': venta['ventas_count'],
                'venta_promedio': float(venta['venta_promedio'] or 0),
                'primera_venta': venta['primera_venta'].isoformat() if venta['primera_venta'] else None,
                'ultima_venta': venta['ultima_venta'].isoformat() if venta['ultima_venta'] else None,
                'dias_ultima_venta': dias_ultima_venta,
                'porcentaje_pago': (total_pagado / total_vendido * 100) if total_vendido > 0 else 0
            })

        return Response({
            'periodo': {
                'fecha_desde': fecha_desde,
                'fecha_hasta': fecha_hasta
            },
            'clientes': reporte_clientes,
            'resumen': {
                'total_clientes': len(reporte_clientes),
                'total_vendido': sum(c['total_vendido'] for c in reporte_clientes),
                'total_cobrado': sum(c['total_pagado'] for c in reporte_clientes),
                'deuda_total': sum(c['deuda_pendiente'] for c in reporte_clientes)
            }
        })

    @action(detail=False, methods=['get'])
    def tendencias_ventas(self, request):
        """Análisis de tendencias de ventas con comparativas mensuales"""
        from django.db.models import F, Sum, Count
        from django.db.models.functions import TruncMonth, TruncYear
        import calendar

        # Ventas por mes del último año
        hace_un_año = datetime.now().date() - timedelta(days=365)

        ventas_mensuales = Venta.objects.filter(
            fecha__gte=hace_un_año
        ).annotate(
            mes=TruncMonth('fecha')
        ).values('mes').annotate(
            total_ventas=Sum('total'),
            cantidad_ventas=Count('id'),
            venta_promedio=Avg('total')
        ).order_by('mes')

        # Formatear datos mensuales
        datos_mensuales = []
        for venta_mes in ventas_mensuales:
            mes_fecha = venta_mes['mes']
            datos_mensuales.append({
                'año': mes_fecha.year,
                'mes': mes_fecha.month,
                'mes_nombre': calendar.month_name[mes_fecha.month],
                'total_ventas': float(venta_mes['total_ventas'] or 0),
                'cantidad_ventas': venta_mes['cantidad_ventas'],
                'venta_promedio': float(venta_mes['venta_promedio'] or 0)
            })

        # Comparativa año actual vs año anterior
        año_actual = datetime.now().year
        año_anterior = año_actual - 1

        ventas_año_actual = Venta.objects.filter(
            fecha__year=año_actual
        ).aggregate(
            total=Sum('total'),
            cantidad=Count('id')
        )

        ventas_año_anterior = Venta.objects.filter(
            fecha__year=año_anterior
        ).aggregate(
            total=Sum('total'),
            cantidad=Count('id')
        )

        # Calcular crecimiento
        total_actual = float(ventas_año_actual['total'] or 0)
        total_anterior = float(ventas_año_anterior['total'] or 0)
        crecimiento_porcentual = ((total_actual - total_anterior) / total_anterior * 100) if total_anterior > 0 else 0

        # Top productos del período
        top_productos = LineaVenta.objects.filter(
            venta__fecha__gte=hace_un_año,
            producto__isnull=False
        ).values(
            'producto__nombre',
            'producto__sku'
        ).annotate(
            total_vendido=Sum(F('cantidad') * F('precio_unitario')),
            cantidad_total=Sum('cantidad')
        ).order_by('-total_vendido')[:10]

        return Response({
            'periodo_analisis': {
                'fecha_desde': hace_un_año.isoformat(),
                'fecha_hasta': datetime.now().date().isoformat()
            },
            'ventas_mensuales': datos_mensuales,
            'comparativa_anual': {
                'año_actual': {
                    'año': año_actual,
                    'total_ventas': total_actual,
                    'cantidad_ventas': ventas_año_actual['cantidad'] or 0
                },
                'año_anterior': {
                    'año': año_anterior,
                    'total_ventas': total_anterior,
                    'cantidad_ventas': ventas_año_anterior['cantidad'] or 0
                },
                'crecimiento_porcentual': round(crecimiento_porcentual, 2)
            },
            'top_productos': [
                {
                    'producto_nombre': p['producto__nombre'],
                    'producto_sku': p['producto__sku'],
                    'total_vendido': float(p['total_vendido'] or 0),
                    'cantidad_vendida': float(p['cantidad_total'] or 0)
                }
                for p in top_productos
            ]
        })

    @action(detail=False, methods=['get'])
    def analisis_rentabilidad_clientes(self, request):
        """
        Análisis detallado de rentabilidad por cliente
        """
        # Parámetros de fecha
        fecha_desde = request.query_params.get('fecha_desde')
        fecha_hasta = request.query_params.get('fecha_hasta')

        # Filtros por defecto (último año)
        if not fecha_desde:
            fecha_desde = datetime.now().date() - timedelta(days=365)
        else:
            fecha_desde = datetime.strptime(fecha_desde, '%Y-%m-%d').date()

        if not fecha_hasta:
            fecha_hasta = datetime.now().date()
        else:
            fecha_hasta = datetime.strptime(fecha_hasta, '%Y-%m-%d').date()

        # Análisis por cliente
        clientes_analisis = []

        for cliente in Cliente.objects.all():
            # Ventas del cliente en el período
            ventas_cliente = Venta.objects.filter(
                cliente_id=cliente.id,
                fecha__gte=fecha_desde,
                fecha__lte=fecha_hasta
            )

            # Métricas básicas
            total_ventas = ventas_cliente.aggregate(total=Sum('total'))['total'] or 0
            cantidad_ventas = ventas_cliente.count()

            if cantidad_ventas == 0:
                continue  # Saltar clientes sin ventas

            # Pagos recibidos del cliente
            pagos_cliente = PagoCliente.objects.filter(
                cliente_id=cliente.id,
                fecha__gte=fecha_desde,
                fecha__lte=fecha_hasta
            ).aggregate(total=Sum('monto'))['total'] or 0

            # Cálculos de rentabilidad
            ticket_promedio = float(total_ventas) / cantidad_ventas if cantidad_ventas > 0 else 0
            frecuencia_compra = cantidad_ventas / ((fecha_hasta - fecha_desde).days / 30) if (fecha_hasta - fecha_desde).days > 0 else 0

            # Margen estimado (20% por defecto - se puede personalizar)
            margen_estimado = float(total_ventas) * 0.20

            # Días desde última compra
            ultima_venta = ventas_cliente.order_by('-fecha').first()
            dias_ultima_compra = (datetime.now().date() - ultima_venta.fecha).days if ultima_venta else 999

            # Clasificación de cliente
            if ticket_promedio > 10000 and frecuencia_compra > 2:
                categoria = "VIP"
            elif ticket_promedio > 5000 and frecuencia_compra > 1:
                categoria = "Premium"
            elif frecuencia_compra > 0.5:
                categoria = "Regular"
            else:
                categoria = "Ocasional"

            clientes_analisis.append({
                'cliente_id': cliente.id,
                'cliente_nombre': cliente.nombre,
                'cliente_identificacion': cliente.identificacion,
                'total_ventas': float(total_ventas),
                'total_pagos': float(pagos_cliente),
                'saldo_pendiente': float(total_ventas) - float(pagos_cliente),
                'cantidad_ventas': cantidad_ventas,
                'ticket_promedio': round(ticket_promedio, 2),
                'frecuencia_mensual': round(frecuencia_compra, 2),
                'margen_estimado': round(margen_estimado, 2),
                'dias_ultima_compra': dias_ultima_compra,
                'categoria': categoria,
                'rentabilidad_score': round(
                    (ticket_promedio * 0.4 + frecuencia_compra * 0.3 + margen_estimado * 0.3) / 100, 2
                )
            })

        # Ordenar por rentabilidad
        clientes_analisis.sort(key=lambda x: x['rentabilidad_score'], reverse=True)

        # Estadísticas generales
        total_clientes_activos = len(clientes_analisis)
        total_ingresos = sum(c['total_ventas'] for c in clientes_analisis)
        total_margenes = sum(c['margen_estimado'] for c in clientes_analisis)

        # Top y bottom performers
        top_clientes = clientes_analisis[:5]
        clientes_riesgo = [c for c in clientes_analisis if c['dias_ultima_compra'] > 60][-5:]

        return Response({
            'periodo': {
                'fecha_desde': fecha_desde.isoformat(),
                'fecha_hasta': fecha_hasta.isoformat()
            },
            'resumen_general': {
                'total_clientes_activos': total_clientes_activos,
                'total_ingresos': float(total_ingresos),
                'total_margenes_estimados': float(total_margenes),
                'ticket_promedio_general': float(total_ingresos) / total_clientes_activos if total_clientes_activos > 0 else 0
            },
            'todos_los_clientes': clientes_analisis,
            'top_clientes': top_clientes,
            'clientes_en_riesgo': clientes_riesgo,
            'distribucion_categorias': {
                'VIP': len([c for c in clientes_analisis if c['categoria'] == 'VIP']),
                'Premium': len([c for c in clientes_analisis if c['categoria'] == 'Premium']),
                'Regular': len([c for c in clientes_analisis if c['categoria'] == 'Regular']),
                'Ocasional': len([c for c in clientes_analisis if c['categoria'] == 'Ocasional'])
            }
        })


class CuentaBancariaViewSet(viewsets.ModelViewSet):
    """ViewSet para gestionar cuentas bancarias"""
    permission_classes = [IsAuthenticated]
    queryset = CuentaBancaria.objects.all()
    serializer_class = CuentaBancariaSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["banco", "tipo_cuenta", "activa"]
    search_fields = ["banco", "numero_cuenta", "titular", "cbu", "alias"]
    ordering_fields = ["banco", "numero_cuenta", "fecha_creacion"]
    ordering = ["banco", "numero_cuenta"]

    @action(detail=True, methods=['post'])
    def actualizar_saldo(self, request, pk=None):
        """Actualizar saldo de la cuenta bancaria"""
        cuenta = self.get_object()
        nuevo_saldo = request.data.get('saldo')

        if nuevo_saldo is None:
            return Response(
                {"error": "Se requiere el campo 'saldo'"},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            cuenta.saldo_actual = Decimal(str(nuevo_saldo))
            cuenta.save()

            return Response({
                "mensaje": "Saldo actualizado correctamente",
                "cuenta": CuentaBancariaSerializer(cuenta).data
            })
        except (ValueError, TypeError):
            return Response(
                {"error": "El saldo debe ser un número válido"},
                status=status.HTTP_400_BAD_REQUEST
            )


class ExtractoBancarioViewSet(viewsets.ModelViewSet):
    """ViewSet para gestionar extractos bancarios"""
    permission_classes = [IsAuthenticated]
    queryset = ExtractoBancario.objects.select_related("cuenta_bancaria").prefetch_related("movimientos")
    serializer_class = ExtractoBancarioSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["cuenta_bancaria", "procesado", "fecha_desde", "fecha_hasta"]
    search_fields = ["cuenta_bancaria__banco", "cuenta_bancaria__numero_cuenta", "archivo_nombre"]
    ordering_fields = ["fecha_importacion", "fecha_desde", "fecha_hasta"]
    ordering = ["-fecha_importacion"]

    @action(detail=False, methods=['post'])
    def importar_extracto(self, request):
        """Importar extracto bancario desde archivo CSV/Excel"""
        import csv
        import io
        import pandas as pd
        from django.db import transaction

        serializer = ImportarExtractoSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        validated_data = serializer.validated_data
        cuenta_bancaria = validated_data['cuenta_bancaria']
        archivo = validated_data['archivo']

        try:
            with transaction.atomic():
                # Crear el extracto bancario
                extracto = ExtractoBancario.objects.create(
                    cuenta_bancaria=cuenta_bancaria,
                    archivo_nombre=archivo.name,
                    fecha_desde=validated_data['fecha_desde'],
                    fecha_hasta=validated_data['fecha_hasta'],
                    saldo_inicial=validated_data['saldo_inicial'],
                    saldo_final=validated_data['saldo_final']
                )

                # Procesar archivo
                movimientos_creados = 0

                if archivo.name.lower().endswith('.csv'):
                    # Procesar CSV
                    archivo_contenido = archivo.read().decode('utf-8')
                    csv_reader = csv.DictReader(io.StringIO(archivo_contenido))

                    for fila in csv_reader:
                        # Mapear campos (ajustar según formato del banco)
                        fecha_str = fila.get('fecha', fila.get('Fecha', ''))
                        descripcion = fila.get('descripcion', fila.get('Descripcion', ''))
                        debito = fila.get('debito', fila.get('Débito', ''))
                        credito = fila.get('credito', fila.get('Crédito', ''))
                        saldo = fila.get('saldo', fila.get('Saldo', ''))

                        if fecha_str and descripcion:
                            fecha = datetime.strptime(fecha_str, '%Y-%m-%d').date()

                            MovimientoBancario.objects.create(
                                extracto=extracto,
                                fecha=fecha,
                                descripcion=descripcion,
                                debito=Decimal(debito) if debito else None,
                                credito=Decimal(credito) if credito else None,
                                saldo=Decimal(saldo) if saldo else Decimal('0')
                            )
                            movimientos_creados += 1

                elif archivo.name.lower().endswith(('.xlsx', '.xls')):
                    # Procesar Excel
                    df = pd.read_excel(archivo)

                    for _, fila in df.iterrows():
                        fecha = fila.get('fecha', fila.get('Fecha'))
                        descripcion = fila.get('descripcion', fila.get('Descripcion', ''))
                        debito = fila.get('debito', fila.get('Débito'))
                        credito = fila.get('credito', fila.get('Crédito'))
                        saldo = fila.get('saldo', fila.get('Saldo', 0))

                        if pd.notna(fecha) and descripcion:
                            if isinstance(fecha, str):
                                fecha = datetime.strptime(fecha, '%Y-%m-%d').date()

                            MovimientoBancario.objects.create(
                                extracto=extracto,
                                fecha=fecha,
                                descripcion=str(descripcion),
                                debito=Decimal(str(debito)) if pd.notna(debito) and debito != 0 else None,
                                credito=Decimal(str(credito)) if pd.notna(credito) and credito != 0 else None,
                                saldo=Decimal(str(saldo)) if pd.notna(saldo) else Decimal('0')
                            )
                            movimientos_creados += 1

                # Actualizar total de movimientos y marcar como procesado
                extracto.total_movimientos = movimientos_creados
                extracto.procesado = True
                extracto.save()

                return Response({
                    "mensaje": "Extracto importado correctamente",
                    "extracto": ExtractoBancarioSerializer(extracto).data,
                    "movimientos_procesados": movimientos_creados
                })

        except Exception as e:
            return Response(
                {"error": f"Error al procesar el archivo: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=True, methods=['post'])
    def conciliar_automatico(self, request, pk=None):
        """Conciliación automática basada en coincidencias de monto y fecha"""
        extracto = self.get_object()

        movimientos_conciliados = 0
        movimientos_bancarios = extracto.movimientos.filter(conciliado=False)

        for mov_bancario in movimientos_bancarios:
            # Buscar movimientos financieros que coincidan por monto y fecha (±3 días)
            fecha_inicio = mov_bancario.fecha - timedelta(days=3)
            fecha_fin = mov_bancario.fecha + timedelta(days=3)

            monto_buscado = abs(mov_bancario.monto)

            movimientos_candidatos = MovimientoFinanciero.objects.filter(
                fecha__gte=fecha_inicio,
                fecha__lte=fecha_fin,
                monto=monto_buscado
            ).filter(movimiento_bancario__isnull=True)

            if movimientos_candidatos.exists():
                # Tomar el primer candidato que coincida
                mov_financiero = movimientos_candidatos.first()
                mov_bancario.movimiento_financiero = mov_financiero
                mov_bancario.conciliado = True
                mov_bancario.observaciones = "Conciliado automáticamente"
                mov_bancario.save()

                movimientos_conciliados += 1

        return Response({
            "mensaje": f"Conciliación automática completada",
            "movimientos_conciliados": movimientos_conciliados,
            "total_movimientos": movimientos_bancarios.count()
        })


class MovimientoBancarioViewSet(viewsets.ModelViewSet):
    """ViewSet para gestionar movimientos bancarios"""
    permission_classes = [IsAuthenticated]
    queryset = MovimientoBancario.objects.select_related("extracto__cuenta_bancaria", "movimiento_financiero")
    serializer_class = MovimientoBancarioSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["extracto__cuenta_bancaria", "conciliado", "fecha"]
    search_fields = ["descripcion", "referencia"]
    ordering_fields = ["fecha", "monto", "saldo"]
    ordering = ["-fecha"]

    @action(detail=True, methods=['post'])
    def conciliar_manual(self, request, pk=None):
        """Conciliar manualmente un movimiento bancario con un movimiento financiero"""
        movimiento_bancario = self.get_object()
        movimiento_financiero_id = request.data.get('movimiento_financiero_id')
        observaciones = request.data.get('observaciones', '')

        if not movimiento_financiero_id:
            return Response(
                {"error": "Se requiere el ID del movimiento financiero"},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            movimiento_financiero = MovimientoFinanciero.objects.get(id=movimiento_financiero_id)

            movimiento_bancario.movimiento_financiero = movimiento_financiero
            movimiento_bancario.conciliado = True
            movimiento_bancario.observaciones = observaciones
            movimiento_bancario.save()

            return Response({
                "mensaje": "Movimiento conciliado correctamente",
                "movimiento": MovimientoBancarioSerializer(movimiento_bancario).data
            })

        except MovimientoFinanciero.DoesNotExist:
            return Response(
                {"error": "Movimiento financiero no encontrado"},
                status=status.HTTP_404_NOT_FOUND
            )


class ConciliacionBancariaViewSet(viewsets.ModelViewSet):
    """ViewSet para gestionar conciliaciones bancarias"""
    permission_classes = [IsAuthenticated]
    queryset = ConciliacionBancaria.objects.select_related("cuenta_bancaria")
    serializer_class = ConciliacionBancariaSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["cuenta_bancaria", "fecha_conciliacion"]
    search_fields = ["cuenta_bancaria__banco", "cuenta_bancaria__numero_cuenta", "observaciones"]
    ordering_fields = ["fecha_conciliacion", "fecha_creacion"]
    ordering = ["-fecha_conciliacion"]

    @action(detail=False, methods=['post'])
    def generar_conciliacion(self, request):
        """Generar una nueva conciliación bancaria"""
        from django.db.models import Q

        cuenta_bancaria_id = request.data.get('cuenta_bancaria_id')
        fecha_conciliacion = request.data.get('fecha_conciliacion')
        saldo_banco = request.data.get('saldo_banco')
        observaciones = request.data.get('observaciones', '')

        if not all([cuenta_bancaria_id, fecha_conciliacion, saldo_banco]):
            return Response(
                {"error": "Se requieren cuenta_bancaria_id, fecha_conciliacion y saldo_banco"},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            cuenta_bancaria = CuentaBancaria.objects.get(id=cuenta_bancaria_id)
            fecha = datetime.strptime(fecha_conciliacion, '%Y-%m-%d').date()

            # Calcular saldo en libros hasta la fecha
            movimientos_hasta_fecha = MovimientoFinanciero.objects.filter(
                fecha__lte=fecha
            ).aggregate(
                ingresos=Sum('monto', filter=Q(tipo=MovimientoFinanciero.Tipo.INGRESO)),
                egresos=Sum('monto', filter=Q(tipo=MovimientoFinanciero.Tipo.EGRESO))
            )

            saldo_libro = (movimientos_hasta_fecha['ingresos'] or 0) - (movimientos_hasta_fecha['egresos'] or 0)

            # Crear conciliación
            conciliacion = ConciliacionBancaria.objects.create(
                cuenta_bancaria=cuenta_bancaria,
                fecha_conciliacion=fecha,
                saldo_libro=saldo_libro,
                saldo_banco=Decimal(str(saldo_banco)),
                observaciones=observaciones,
                usuario=request.user.username if hasattr(request, 'user') and request.user.is_authenticated else 'Sistema'
            )

            return Response({
                "mensaje": "Conciliación generada correctamente",
                "conciliacion": ConciliacionBancariaSerializer(conciliacion).data
            })

        except CuentaBancaria.DoesNotExist:
            return Response(
                {"error": "Cuenta bancaria no encontrada"},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            return Response(
                {"error": f"Error al generar conciliación: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class ConfiguracionAFIPViewSet(viewsets.ModelViewSet):
    """ViewSet para gestionar configuraciones AFIP"""
    permission_classes = [IsAuthenticated]
    queryset = ConfiguracionAFIP.objects.all()
    serializer_class = ConfiguracionAFIPSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["ambiente", "activa"]
    search_fields = ["cuit", "razon_social"]
    ordering_fields = ["cuit", "razon_social", "fecha_creacion"]
    ordering = ["-fecha_creacion"]

    @action(detail=True, methods=['post'])
    def test_conexion(self, request, pk=None):
        """Probar conexión con AFIP"""
        configuracion = self.get_object()

        try:
            # Aquí iría la lógica real de conexión con AFIP
            # Por ahora simularemos una respuesta exitosa
            return Response({
                "mensaje": "Conexión exitosa con AFIP",
                "ambiente": configuracion.get_ambiente_display(),
                "cuit": configuracion.cuit,
                "estado": "OK"
            })

        except Exception as e:
            return Response(
                {"error": f"Error al conectar con AFIP: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class FacturaElectronicaViewSet(viewsets.ModelViewSet):
    """ViewSet para gestionar facturas electrónicas AFIP"""
    permission_classes = [IsAuthenticated]
    queryset = FacturaElectronica.objects.select_related("configuracion_afip", "venta").prefetch_related("detalles", "logs")
    serializer_class = FacturaElectronicaSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["tipo_comprobante", "estado", "configuracion_afip", "fecha_emision"]
    search_fields = ["numero_comprobante", "cliente_razon_social", "cliente_numero_documento", "cae"]
    ordering_fields = ["fecha_emision", "numero_comprobante", "importe_total"]
    ordering = ["-fecha_emision", "-numero_comprobante"]

    @action(detail=False, methods=['post'])
    def crear_desde_venta(self, request):
        """Crear factura electrónica desde una venta existente"""
        serializer = CrearFacturaElectronicaSerializer(data=request.data, context={'request': request})
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        try:
            factura = serializer.save()
            return Response({
                "mensaje": "Factura electrónica creada correctamente",
                "factura": FacturaElectronicaSerializer(factura).data
            })

        except Exception as e:
            return Response(
                {"error": f"Error al crear factura: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['post'])
    def autorizar_lote(self, request):
        """Autorizar un lote de facturas con AFIP"""
        serializer = AutorizarFacturaSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        facturas_ids = serializer.validated_data['facturas_ids']
        facturas = FacturaElectronica.objects.filter(id__in=facturas_ids)

        resultados = []
        facturas_autorizadas = 0

        for factura in facturas:
            try:
                # Aquí iría la lógica real de autorización con AFIP
                # Por ahora simularemos una autorización exitosa

                # Simular generación de CAE
                import random
                cae = f"{random.randint(10000000000000, 99999999999999)}"
                fecha_vencimiento_cae = factura.fecha_emision + timedelta(days=10)

                # Actualizar factura
                factura.estado = FacturaElectronica.Estado.APROBADO
                factura.cae = cae
                factura.fecha_vencimiento_cae = fecha_vencimiento_cae
                factura.fecha_autorizacion = datetime.now()
                factura.save()

                # Crear log
                LogAFIP.objects.create(
                    factura=factura,
                    accion="Autorización",
                    resultado="OK",
                    mensaje=f"Factura autorizada con CAE {cae}"
                )

                resultados.append({
                    "factura_id": factura.id,
                    "numero_completo": factura.numero_completo,
                    "estado": "AUTORIZADA",
                    "cae": cae,
                    "mensaje": "Autorización exitosa"
                })

                facturas_autorizadas += 1

            except Exception as e:
                factura.estado = FacturaElectronica.Estado.RECHAZADO
                factura.observaciones_afip = str(e)
                factura.save()

                # Crear log de error
                LogAFIP.objects.create(
                    factura=factura,
                    accion="Autorización",
                    resultado="ERROR",
                    mensaje=str(e)
                )

                resultados.append({
                    "factura_id": factura.id,
                    "numero_completo": factura.numero_completo,
                    "estado": "ERROR",
                    "mensaje": str(e)
                })

        return Response({
            "mensaje": f"Proceso completado. {facturas_autorizadas} de {len(facturas)} facturas autorizadas",
            "facturas_autorizadas": facturas_autorizadas,
            "total_facturas": len(facturas),
            "resultados": resultados
        })

    @action(detail=True, methods=['post'])
    def autorizar_individual(self, request, pk=None):
        """Autorizar una factura individual con AFIP"""
        factura = self.get_object()

        if factura.estado not in [
            FacturaElectronica.Estado.BORRADOR,
            FacturaElectronica.Estado.PENDIENTE,
            FacturaElectronica.Estado.RECHAZADO
        ]:
            return Response(
                {"error": "La factura no está en estado autorizable"},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            # Aquí iría la lógica real de autorización con AFIP
            # Por ahora simularemos una autorización exitosa

            import random
            cae = f"{random.randint(10000000000000, 99999999999999)}"
            fecha_vencimiento_cae = factura.fecha_emision + timedelta(days=10)

            factura.estado = FacturaElectronica.Estado.APROBADO
            factura.cae = cae
            factura.fecha_vencimiento_cae = fecha_vencimiento_cae
            factura.fecha_autorizacion = datetime.now()
            factura.save()

            # Crear log
            LogAFIP.objects.create(
                factura=factura,
                accion="Autorización Individual",
                resultado="OK",
                mensaje=f"Factura autorizada con CAE {cae}"
            )

            return Response({
                "mensaje": "Factura autorizada correctamente",
                "factura": FacturaElectronicaSerializer(factura).data
            })

        except Exception as e:
            factura.estado = FacturaElectronica.Estado.RECHAZADO
            factura.observaciones_afip = str(e)
            factura.save()

            # Crear log de error
            LogAFIP.objects.create(
                factura=factura,
                accion="Autorización Individual",
                resultado="ERROR",
                mensaje=str(e)
            )

            return Response(
                {"error": f"Error al autorizar factura: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=True, methods=['get'])
    def generar_pdf(self, request, pk=None):
        """Generar PDF de la factura electrónica"""
        factura = self.get_object()

        if not factura.cae:
            return Response(
                {"error": "La factura debe estar autorizada para generar PDF"},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            # Aquí iría la lógica para generar el PDF real
            # Por ahora retornamos un enlace simulado
            pdf_url = f"/api/finanzas/facturas-electronicas/{factura.id}/pdf/"

            return Response({
                "mensaje": "PDF generado correctamente",
                "pdf_url": pdf_url,
                "factura": FacturaElectronicaSerializer(factura).data
            })

        except Exception as e:
            return Response(
                {"error": f"Error al generar PDF: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['get'])
    def estadisticas(self, request):
        """Estadísticas de facturación electrónica"""
        # Parámetros de fecha
        fecha_desde = request.query_params.get('fecha_desde')
        fecha_hasta = request.query_params.get('fecha_hasta')

        queryset = FacturaElectronica.objects.all()

        if fecha_desde:
            queryset = queryset.filter(fecha_emision__gte=fecha_desde)
        if fecha_hasta:
            queryset = queryset.filter(fecha_emision__lte=fecha_hasta)

        # Estadísticas por estado
        stats_estado = queryset.values('estado').annotate(
            cantidad=Count('id'),
            total_importe=Sum('importe_total')
        ).order_by('estado')

        # Estadísticas por tipo de comprobante
        stats_tipo = queryset.values('tipo_comprobante').annotate(
            cantidad=Count('id'),
            total_importe=Sum('importe_total')
        ).order_by('tipo_comprobante')

        # Resumen general
        resumen = queryset.aggregate(
            total_facturas=Count('id'),
            total_importe=Sum('importe_total'),
            facturas_autorizadas=Count('id', filter=Q(estado=FacturaElectronica.Estado.APROBADO)),
            facturas_rechazadas=Count('id', filter=Q(estado=FacturaElectronica.Estado.RECHAZADO))
        )

        return Response({
            'periodo': {
                'fecha_desde': fecha_desde,
                'fecha_hasta': fecha_hasta
            },
            'resumen': {
                'total_facturas': resumen['total_facturas'],
                'total_importe': float(resumen['total_importe'] or 0),
                'facturas_autorizadas': resumen['facturas_autorizadas'],
                'facturas_rechazadas': resumen['facturas_rechazadas'],
                'tasa_autorizacion': (
                    resumen['facturas_autorizadas'] / resumen['total_facturas'] * 100
                    if resumen['total_facturas'] > 0 else 0
                )
            },
            'por_estado': [
                {
                    'estado': item['estado'],
                    'cantidad': item['cantidad'],
                    'total_importe': float(item['total_importe'] or 0)
                }
                for item in stats_estado
            ],
            'por_tipo_comprobante': [
                {
                    'tipo_comprobante': item['tipo_comprobante'],
                    'cantidad': item['cantidad'],
                    'total_importe': float(item['total_importe'] or 0)
                }
                for item in stats_tipo
            ]
        })


class DetalleFacturaElectronicaViewSet(viewsets.ModelViewSet):
    """ViewSet para gestionar detalles de facturas electrónicas"""
    permission_classes = [IsAuthenticated]
    queryset = DetalleFacturaElectronica.objects.select_related("factura")
    serializer_class = DetalleFacturaElectronicaSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["factura"]
    search_fields = ["descripcion"]
    ordering_fields = ["id", "cantidad", "precio_unitario", "importe_total"]
    ordering = ["id"]


class LogAFIPViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet para consultar logs de AFIP (solo lectura)"""
    permission_classes = [IsAuthenticated]
    queryset = LogAFIP.objects.select_related("factura")
    serializer_class = LogAFIPSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["factura", "resultado", "accion"]
    search_fields = ["accion", "mensaje", "codigo_error"]
    ordering_fields = ["fecha_hora", "resultado"]
    ordering = ["-fecha_hora"]


class PeriodoIVAViewSet(viewsets.ModelViewSet):
    """ViewSet para gestionar períodos de IVA"""
    permission_classes = [IsAuthenticated]
    queryset = PeriodoIVA.objects.all()
    serializer_class = PeriodoIVASerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["anio", "mes", "estado"]
    search_fields = ["observaciones", "numero_presentacion"]
    ordering_fields = ["anio", "mes", "fecha_presentacion"]
    ordering = ["-anio", "-mes"]

    @action(detail=False, methods=["get"], url_path="periodo-actual")
    def periodo_actual(self, request):
        """Obtiene o crea el período IVA del mes actual"""
        periodo = PeriodoIVA.obtener_o_crear_periodo_actual()
        serializer = self.get_serializer(periodo)
        return Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="recalcular")
    def recalcular(self, request, pk=None):
        """Recalcula el IVA del período desde las ventas y compras"""
        periodo = self.get_object()

        if periodo.estado == PeriodoIVA.Estado.PRESENTADO:
            return Response(
                {"error": "No se puede recalcular un período ya presentado a AFIP"},
                status=status.HTTP_400_BAD_REQUEST
            )

        periodo.recalcular_desde_ventas_compras()
        serializer = self.get_serializer(periodo)
        return Response({
            "mensaje": "Período recalculado exitosamente",
            "periodo": serializer.data
        })

    @action(detail=True, methods=["post"], url_path="cerrar")
    def cerrar_periodo(self, request, pk=None):
        """Cierra el período para evitar modificaciones"""
        periodo = self.get_object()

        if periodo.estado == PeriodoIVA.Estado.PRESENTADO:
            return Response(
                {"error": "El período ya está presentado"},
                status=status.HTTP_400_BAD_REQUEST
            )

        periodo.estado = PeriodoIVA.Estado.CERRADO
        periodo.save()

        serializer = self.get_serializer(periodo)
        return Response({
            "mensaje": "Período cerrado exitosamente",
            "periodo": serializer.data
        })

    @action(detail=True, methods=["post"], url_path="presentar")
    def presentar_dj(self, request, pk=None):
        """Marca el período como presentado a AFIP"""
        from datetime import date

        periodo = self.get_object()

        if periodo.estado == PeriodoIVA.Estado.PRESENTADO:
            return Response(
                {"error": "El período ya está presentado"},
                status=status.HTTP_400_BAD_REQUEST
            )

        numero_presentacion = request.data.get("numero_presentacion")
        if not numero_presentacion:
            return Response(
                {"error": "Debe proporcionar el número de presentación"},
                status=status.HTTP_400_BAD_REQUEST
            )

        periodo.estado = PeriodoIVA.Estado.PRESENTADO
        periodo.fecha_presentacion = date.today()
        periodo.numero_presentacion = numero_presentacion
        periodo.save()

        serializer = self.get_serializer(periodo)
        return Response({
            "mensaje": "Período marcado como presentado exitosamente",
            "periodo": serializer.data
        })

    @action(detail=False, methods=["get"], url_path="resumen-iva")
    def resumen_iva(self, request):
        """Obtiene resumen de IVA pendiente de pago"""
        from django.db.models import Sum

        # Períodos abiertos y cerrados (no presentados)
        periodos_pendientes = PeriodoIVA.objects.filter(
            estado__in=[PeriodoIVA.Estado.ABIERTO, PeriodoIVA.Estado.CERRADO]
        )

        total_debito = periodos_pendientes.aggregate(total=Sum('iva_debito_fiscal'))['total'] or Decimal("0")
        total_credito = periodos_pendientes.aggregate(total=Sum('iva_credito_fiscal'))['total'] or Decimal("0")
        total_saldo_fisco = periodos_pendientes.aggregate(total=Sum('saldo_favor_fisco'))['total'] or Decimal("0")

        # Total pagado en esos períodos
        total_pagado = PagoIVA.objects.filter(
            periodo__in=periodos_pendientes
        ).aggregate(total=Sum('monto'))['total'] or Decimal("0")

        saldo_pendiente_pago = total_saldo_fisco - total_pagado

        return Response({
            "total_iva_debito_fiscal": str(total_debito),
            "total_iva_credito_fiscal": str(total_credito),
            "saldo_favor_fisco": str(total_saldo_fisco),
            "total_pagado": str(total_pagado),
            "saldo_pendiente_pago": str(saldo_pendiente_pago),
            "cantidad_periodos_pendientes": periodos_pendientes.count(),
            "periodos": self.get_serializer(periodos_pendientes, many=True).data
        })

    @action(detail=True, methods=["get"], url_path="libro-iva-ventas")
    def libro_iva_ventas(self, request, pk=None):
        """Genera el libro IVA de ventas para el período"""
        from ventas.models import Venta

        periodo = self.get_object()

        # Obtener todas las ventas del período
        ventas = Venta.objects.filter(
            fecha__gte=periodo.fecha_desde,
            fecha__lte=periodo.fecha_hasta
        ).select_related('cliente').order_by('fecha', 'id')

        # Calcular totales
        total_ventas = ventas.count()
        ventas_con_iva = ventas.filter(incluye_iva=True)
        ventas_sin_iva = ventas.filter(incluye_iva=False)

        total_gravado = ventas_con_iva.aggregate(total=Sum('subtotal'))['total'] or Decimal("0")
        total_iva = ventas_con_iva.aggregate(total=Sum('iva_monto'))['total'] or Decimal("0")
        total_exento = ventas_sin_iva.aggregate(total=Sum('total'))['total'] or Decimal("0")
        total_general = ventas.aggregate(total=Sum('total'))['total'] or Decimal("0")

        # Serializar ventas
        ventas_data = []
        for venta in ventas:
            ventas_data.append({
                'id': venta.id,
                'fecha': venta.fecha,
                'numero': venta.numero or f"V-{venta.id}",
                'cliente_nombre': venta.cliente.nombre,
                'cliente_identificacion': venta.cliente.identificacion,
                'subtotal': str(venta.subtotal),
                'iva_monto': str(venta.iva_monto),
                'total': str(venta.total),
                'incluye_iva': venta.incluye_iva
            })

        return Response({
            'periodo': {
                'mes': periodo.mes,
                'anio': periodo.anio,
                'nombre_mes': periodo.nombre_mes,
                'fecha_desde': periodo.fecha_desde,
                'fecha_hasta': periodo.fecha_hasta
            },
            'resumen': {
                'total_operaciones': total_ventas,
                'operaciones_con_iva': ventas_con_iva.count(),
                'operaciones_sin_iva': ventas_sin_iva.count(),
                'total_gravado': str(total_gravado),
                'total_iva': str(total_iva),
                'total_exento': str(total_exento),
                'total_general': str(total_general)
            },
            'ventas': ventas_data
        })

    @action(detail=True, methods=["get"], url_path="libro-iva-compras")
    def libro_iva_compras(self, request, pk=None):
        """Genera el libro IVA de compras para el período"""
        from compras.models import Compra

        periodo = self.get_object()

        # Obtener todas las compras del período
        compras = Compra.objects.filter(
            fecha__gte=periodo.fecha_desde,
            fecha__lte=periodo.fecha_hasta
        ).select_related('proveedor', 'categoria').order_by('fecha', 'id')

        # Calcular totales
        total_compras = compras.count()
        compras_con_iva = compras.filter(incluye_iva=True)
        compras_sin_iva = compras.filter(incluye_iva=False)

        total_gravado = compras_con_iva.aggregate(total=Sum('subtotal'))['total'] or Decimal("0")
        total_iva = compras_con_iva.aggregate(total=Sum('iva_monto'))['total'] or Decimal("0")
        total_exento = compras_sin_iva.aggregate(total=Sum('total'))['total'] or Decimal("0")
        total_general = compras.aggregate(total=Sum('total'))['total'] or Decimal("0")

        # Serializar compras
        compras_data = []
        for compra in compras:
            compras_data.append({
                'id': compra.id,
                'fecha': compra.fecha,
                'numero': compra.numero or f"C-{compra.id}",
                'proveedor_nombre': compra.proveedor.nombre,
                'proveedor_identificacion': compra.proveedor.identificacion,
                'categoria': compra.categoria.nombre if compra.categoria else '',
                'subtotal': str(compra.subtotal),
                'iva_monto': str(compra.iva_monto),
                'total': str(compra.total),
                'incluye_iva': compra.incluye_iva
            })

        return Response({
            'periodo': {
                'mes': periodo.mes,
                'anio': periodo.anio,
                'nombre_mes': periodo.nombre_mes,
                'fecha_desde': periodo.fecha_desde,
                'fecha_hasta': periodo.fecha_hasta
            },
            'resumen': {
                'total_operaciones': total_compras,
                'operaciones_con_iva': compras_con_iva.count(),
                'operaciones_sin_iva': compras_sin_iva.count(),
                'total_gravado': str(total_gravado),
                'total_iva_credito': str(total_iva),
                'total_exento': str(total_exento),
                'total_general': str(total_general)
            },
            'compras': compras_data
        })


class PagoIVAViewSet(viewsets.ModelViewSet):
    """ViewSet para gestionar pagos de IVA"""
    permission_classes = [IsAuthenticated]
    queryset = PagoIVA.objects.select_related("periodo", "movimiento_financiero").all()
    serializer_class = PagoIVASerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["periodo", "medio_pago", "fecha_pago"]
    search_fields = ["numero_comprobante", "observaciones"]
    ordering_fields = ["fecha_pago", "monto"]
    ordering = ["-fecha_pago"]
