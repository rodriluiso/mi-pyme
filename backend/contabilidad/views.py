from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Q, Sum, F
from datetime import date, datetime, timedelta
from decimal import Decimal

from .models import (
    PlanCuentas,
    AsientoContable,
    BalanceGeneral,
    EstadoResultados
)
from .serializers import (
    PlanCuentasSerializer,
    AsientoContableSerializer,
    BalanceGeneralSerializer,
    EstadoResultadosSerializer,
    ReporteFinancieroResumenSerializer,
    GenerarReporteSerializer
)


class PlanCuentasViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    """ViewSet para el plan de cuentas"""

    queryset = PlanCuentas.objects.filter(activa=True).order_by('codigo')
    serializer_class = PlanCuentasSerializer

    def get_queryset(self):
        queryset = super().get_queryset()

        # Filtros
        tipo_cuenta = self.request.query_params.get('tipo_cuenta')
        acepta_movimientos = self.request.query_params.get('acepta_movimientos')
        nivel = self.request.query_params.get('nivel')

        if tipo_cuenta:
            queryset = queryset.filter(tipo_cuenta=tipo_cuenta)

        if acepta_movimientos is not None:
            acepta_mov = acepta_movimientos.lower() == 'true'
            queryset = queryset.filter(acepta_movimientos=acepta_mov)

        if nivel:
            queryset = queryset.filter(nivel=nivel)

        return queryset

    @action(detail=False, methods=['post'])
    def crear_plan_basico(self, request):
        """Crea el plan de cuentas básico para PyME"""
        try:
            PlanCuentas.crear_plan_basico()
            return Response({'message': 'Plan de cuentas básico creado exitosamente'})
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=False, methods=['get'])
    def arbol_cuentas(self, request):
        """Obtiene el árbol completo de cuentas"""
        cuentas_principales = PlanCuentas.objects.filter(
            nivel=1,
            activa=True
        ).order_by('codigo')

        def construir_arbol(cuenta):
            """Construye recursivamente el árbol de cuentas"""
            data = PlanCuentasSerializer(cuenta).data

            # Obtener subcuentas
            subcuentas = cuenta.subcuentas.filter(activa=True).order_by('codigo')
            if subcuentas.exists():
                data['subcuentas'] = [construir_arbol(sub) for sub in subcuentas]
            else:
                data['subcuentas'] = []

            return data

        arbol = [construir_arbol(cuenta) for cuenta in cuentas_principales]

        return Response({
            'cuentas': arbol,
            'total_cuentas': PlanCuentas.objects.filter(activa=True).count()
        })


class AsientoContableViewSet(viewsets.ModelViewSet):
    """ViewSet para asientos contables"""
    permission_classes = [IsAuthenticated]
    queryset = AsientoContable.objects.select_related('usuario').prefetch_related(
        'detalles__cuenta'
    ).order_by('-fecha', '-numero')
    serializer_class = AsientoContableSerializer

    @action(detail=True, methods=['post'])
    def procesar(self, request, pk=None):
        """Procesa un asiento contable"""
        asiento = self.get_object()

        if asiento.procesado:
            return Response(
                {'error': 'El asiento ya está procesado'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            asiento.procesar()
            return Response({'message': 'Asiento procesado exitosamente'})
        except ValueError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=True, methods=['post'])
    def agregar_detalle(self, request, pk=None):
        """Agregar detalle a un asiento"""
        from .serializers import AsientoContableDetalleSerializer

        asiento = self.get_object()

        if asiento.procesado:
            return Response(
                {'error': 'No se pueden modificar asientos procesados'},
                status=status.HTTP_400_BAD_REQUEST
            )

        data = request.data.copy()
        data['asiento'] = asiento.id

        serializer = AsientoContableDetalleSerializer(data=data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class ReportesFinancierosViewSet(viewsets.ViewSet):
    """ViewSet para reportes financieros"""
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['post'])
    def generar(self, request):
        """Genera reportes financieros"""
        serializer = GenerarReporteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        tipo_reporte = serializer.validated_data['tipo_reporte']

        try:
            if tipo_reporte == 'balance':
                fecha_corte = serializer.validated_data['fecha_corte']
                balance = BalanceGeneral.generar(fecha_corte, request.user)
                data = BalanceGeneralSerializer(balance).data
                return Response(data)

            elif tipo_reporte == 'resultados':
                fecha_desde = serializer.validated_data['fecha_desde']
                fecha_hasta = serializer.validated_data['fecha_hasta']
                estado = EstadoResultados.generar(fecha_desde, fecha_hasta, request.user)
                data = EstadoResultadosSerializer(estado).data
                return Response(data)

            elif tipo_reporte == 'resumen':
                resumen = self._generar_resumen_financiero()
                return Response(resumen)

        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    def _generar_resumen_financiero(self):
        """Genera resumen financiero completo"""
        hoy = date.today()
        inicio_mes = hoy.replace(day=1)
        fin_mes_anterior = inicio_mes - timedelta(days=1)
        inicio_mes_anterior = fin_mes_anterior.replace(day=1)

        # Balance actual (generar balance al día de hoy)
        try:
            balance_actual = BalanceGeneral.generar(hoy)
            total_activos = balance_actual.total_activo
            total_pasivos = balance_actual.total_pasivo
            patrimonio_neto = balance_actual.total_patrimonio
        except:
            total_activos = Decimal('0')
            total_pasivos = Decimal('0')
            patrimonio_neto = Decimal('0')

        # Resultados del mes actual
        try:
            estado_actual = EstadoResultados.generar(inicio_mes, hoy)
            ingresos_periodo = estado_actual.total_ingresos
            gastos_periodo = estado_actual.total_gastos
            utilidad_periodo = estado_actual.utilidad_neta
        except:
            ingresos_periodo = Decimal('0')
            gastos_periodo = Decimal('0')
            utilidad_periodo = Decimal('0')

        # Resultados del mes anterior para comparación
        try:
            estado_anterior = EstadoResultados.generar(inicio_mes_anterior, fin_mes_anterior)
            ingresos_anterior = estado_anterior.total_ingresos
        except:
            ingresos_anterior = Decimal('0')

        # Cálculo de indicadores
        # Ratio de liquidez (activos corrientes / pasivos corrientes)
        activos_corrientes = self._obtener_activos_corrientes()
        pasivos_corrientes = self._obtener_pasivos_corrientes()
        ratio_liquidez = (activos_corrientes / pasivos_corrientes) if pasivos_corrientes > 0 else Decimal('0')

        # Ratio de endeudamiento (pasivos / activos)
        ratio_endeudamiento = (total_pasivos / total_activos) * 100 if total_activos > 0 else Decimal('0')

        # Margen de utilidad
        margen_utilidad = (utilidad_periodo / ingresos_periodo) * 100 if ingresos_periodo > 0 else Decimal('0')

        # Crecimiento de ingresos
        crecimiento_ingresos = Decimal('0')
        if ingresos_anterior > 0:
            crecimiento_ingresos = ((ingresos_periodo - ingresos_anterior) / ingresos_anterior) * 100

        # Variación del patrimonio (mes actual vs anterior)
        variacion_patrimonio = Decimal('0')  # Simplificado por ahora

        return {
            'total_activos': total_activos,
            'total_pasivos': total_pasivos,
            'patrimonio_neto': patrimonio_neto,
            'ingresos_periodo': ingresos_periodo,
            'gastos_periodo': gastos_periodo,
            'utilidad_periodo': utilidad_periodo,
            'ratio_liquidez': round(ratio_liquidez, 2),
            'ratio_endeudamiento': round(ratio_endeudamiento, 2),
            'margen_utilidad': round(margen_utilidad, 2),
            'crecimiento_ingresos': round(crecimiento_ingresos, 2),
            'variacion_patrimonio': round(variacion_patrimonio, 2)
        }

    def _obtener_activos_corrientes(self):
        """Obtiene el total de activos corrientes"""
        cuentas_activo_corriente = PlanCuentas.objects.filter(
            tipo_cuenta='ACTIVO',
            subtipo_cuenta='ACTIVO_CORRIENTE',
            activa=True
        )

        total = Decimal('0')
        for cuenta in cuentas_activo_corriente:
            total += cuenta.get_saldo_actual()

        return total

    def _obtener_pasivos_corrientes(self):
        """Obtiene el total de pasivos corrientes"""
        cuentas_pasivo_corriente = PlanCuentas.objects.filter(
            tipo_cuenta='PASIVO',
            subtipo_cuenta='PASIVO_CORRIENTE',
            activa=True
        )

        total = Decimal('0')
        for cuenta in cuentas_pasivo_corriente:
            total += cuenta.get_saldo_actual()

        return total

    @action(detail=False, methods=['get'])
    def balance_general(self, request):
        """Obtiene el último balance general"""
        fecha_corte = request.query_params.get('fecha_corte')

        if fecha_corte:
            try:
                # Convertir string a date
                fecha_corte = datetime.strptime(fecha_corte, '%Y-%m-%d').date()
            except ValueError:
                return Response(
                    {'error': 'Formato de fecha inválido. Use YYYY-MM-DD'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        else:
            fecha_corte = date.today()

        try:
            # Buscar balance existente o crear uno nuevo
            balance = BalanceGeneral.objects.filter(fecha_corte=fecha_corte).first()
            if not balance:
                balance = BalanceGeneral.generar(fecha_corte, request.user)

            serializer = BalanceGeneralSerializer(balance)
            return Response(serializer.data)

        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=False, methods=['get'])
    def estado_resultados(self, request):
        """Obtiene el estado de resultados para un período"""
        fecha_desde = request.query_params.get('fecha_desde')
        fecha_hasta = request.query_params.get('fecha_hasta')

        if not fecha_desde or not fecha_hasta:
            # Por defecto, mes actual
            hoy = date.today()
            fecha_desde = hoy.replace(day=1)
            fecha_hasta = hoy
        else:
            try:
                fecha_desde = datetime.strptime(fecha_desde, '%Y-%m-%d').date()
                fecha_hasta = datetime.strptime(fecha_hasta, '%Y-%m-%d').date()
            except ValueError:
                return Response(
                    {'error': 'Formato de fecha inválido. Use YYYY-MM-DD'},
                    status=status.HTTP_400_BAD_REQUEST
                )

        try:
            # Buscar estado existente o crear uno nuevo
            estado = EstadoResultados.objects.filter(
                fecha_desde=fecha_desde,
                fecha_hasta=fecha_hasta
            ).first()

            if not estado:
                estado = EstadoResultados.generar(fecha_desde, fecha_hasta, request.user)

            serializer = EstadoResultadosSerializer(estado)
            return Response(serializer.data)

        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=False, methods=['get'])
    def resumen_ejecutivo(self, request):
        """Obtiene resumen ejecutivo financiero"""
        try:
            resumen = self._generar_resumen_financiero()
            return Response(resumen)
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=False, methods=['get'])
    def indicadores_clave(self, request):
        """Obtiene indicadores financieros clave"""
        hoy = date.today()

        # Obtener datos de los últimos 12 meses
        inicio_periodo = hoy.replace(year=hoy.year - 1) if hoy.month == 12 else hoy.replace(month=1)

        try:
            # Balance actual
            balance = BalanceGeneral.generar(hoy)

            # Estado de resultados del período
            estado = EstadoResultados.generar(inicio_periodo, hoy)

            # Indicadores básicos
            liquidez = Decimal('0')
            if balance.total_pasivo > 0:
                liquidez = balance.total_activo / balance.total_pasivo

            rentabilidad = Decimal('0')
            if estado.total_ingresos > 0:
                rentabilidad = (estado.utilidad_neta / estado.total_ingresos) * 100

            endeudamiento = Decimal('0')
            if balance.total_activo > 0:
                endeudamiento = (balance.total_pasivo / balance.total_activo) * 100

            return Response({
                'liquidez': round(float(liquidez), 2),
                'rentabilidad': round(float(rentabilidad), 2),
                'endeudamiento': round(float(endeudamiento), 2),
                'patrimonio': round(float(balance.total_patrimonio), 2),
                'ingresos_anuales': round(float(estado.total_ingresos), 2),
                'utilidad_anual': round(float(estado.utilidad_neta), 2)
            })

        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )