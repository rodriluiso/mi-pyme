from rest_framework import status, viewsets
from rest_framework.decorators import action, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.http import HttpResponse
from django.template.loader import render_to_string
from django.utils import timezone
from django.db.models import Q, Sum, Count, F
from datetime import date, timedelta
import base64
import os
from django.conf import settings

from finanzas_reportes.serializers import PagoClienteSerializer
from usuarios.mixins import ModulePermissionMixin
from .models import Venta, LineaVenta
from .serializers import (
    RegistroPagoSerializer,
    VentaRapidaSerializer,
    VentaSerializer,
)


class VentaViewSet(ModulePermissionMixin, viewsets.ModelViewSet):
    modulo_requerido = 'ventas'
    permission_classes = [IsAuthenticated]
    queryset = Venta.objects.select_related("cliente").prefetch_related("lineas__producto").all()
    serializer_class = VentaSerializer

    @action(detail=False, methods=["post"], url_path="agregar-simple")
    def agregar_simple(self, request):
        serializer = VentaRapidaSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        venta = serializer.save()
        data = self.get_serializer(venta).data
        return Response(data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["post"], url_path="agregar-multiple")
    def agregar_multiple(self, request):
        serializer = VentaSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        venta = serializer.save()
        data = self.get_serializer(venta).data
        return Response(data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["post"], url_path="registrar-pago")
    def registrar_pago(self, request):
        serializer = RegistroPagoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        pago = serializer.save()
        data = PagoClienteSerializer(pago, context={"request": request}).data
        return Response(data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get"], url_path="remito", permission_classes=[AllowAny])
    def generar_remito(self, request, pk=None):
        from configuracion.models import ConfiguracionEmpresa

        venta = self.get_object()
        config = ConfiguracionEmpresa.get_configuracion()

        # Convertir logo a base64 para incrustar en HTML
        logo_base64 = ""
        logo_path = os.path.join(settings.BASE_DIR, 'static', 'logo.png')
        if os.path.exists(logo_path):
            with open(logo_path, 'rb') as logo_file:
                logo_base64 = base64.b64encode(logo_file.read()).decode('utf-8')

        # Generar HTML del remito
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Remito - #{venta.numero or venta.id}</title>
            <style>
                @page {{
                    size: A4;
                    margin: 10mm;
                }}
                @media print {{
                    @page {{ margin: 10mm; }}
                    body {{ margin: 0; }}
                }}
                body {{
                    font-family: Arial, sans-serif;
                    margin: 10px;
                    line-height: 1.3;
                    font-size: 9px;
                }}
                .header {{
                    border: 2px solid #000;
                    padding: 10px;
                    margin-bottom: 8px;
                    display: grid;
                    grid-template-columns: 220px 90px 1fr;
                    gap: 15px;
                    align-items: center;
                }}
                .header-left {{
                    text-align: center;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                }}
                .header-logo {{ max-width: 150px; height: auto; margin-bottom: 8px; }}
                .empresa-datos {{
                    font-size: 8px;
                    text-align: center;
                    line-height: 1.3;
                }}
                .header-centro {{
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                }}
                .tipo-comprobante {{
                    width: 75px;
                    height: 75px;
                    border: 3px solid #000;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 52px;
                    font-weight: bold;
                }}
                .cod-label {{
                    font-size: 8px;
                    margin-top: 3px;
                    text-align: center;
                    font-weight: bold;
                }}
                .header-derecha {{
                    font-size: 9px;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                }}
                .remito-title {{
                    font-weight: bold;
                    font-size: 14px;
                    margin-bottom: 8px;
                    text-align: center;
                }}
                .info-section {{
                    border: 1px solid #000;
                    padding: 8px;
                    margin-bottom: 8px;
                    font-size: 9px;
                }}
                .info-box {{
                    border: 1px solid #000;
                    padding: 8px;
                }}
                .info-box-title {{
                    font-weight: bold;
                    border-bottom: 1px solid #000;
                    padding-bottom: 3px;
                    margin-bottom: 5px;
                    text-align: center;
                }}
                .info-line {{
                    margin: 3px 0;
                    padding: 2px 0;
                }}
                .info-label {{
                    font-weight: bold;
                    display: inline-block;
                    width: 80px;
                }}
                table {{
                    width: 100%;
                    border-collapse: collapse;
                    margin: 5px 0 10px 0;
                    border: 1px solid #000;
                    min-height: 300px;
                }}
                th, td {{
                    border: 1px solid #000;
                    padding: 5px;
                    text-align: left;
                    font-size: 9px;
                }}
                th {{
                    background-color: #000;
                    color: white;
                    font-weight: bold;
                    text-align: center;
                }}
                .td-cantidad {{ width: 12%; text-align: center; }}
                .td-peso {{ width: 13%; text-align: center; }}
                tbody {{
                    height: 300px;
                    vertical-align: top;
                }}
                .observaciones {{
                    border: 1px solid #000;
                    padding: 6px;
                    margin: 8px 0;
                    font-size: 8px;
                    page-break-inside: avoid;
                }}
                .firmas {{
                    margin: 8px 0;
                    page-break-inside: avoid;
                }}
                .firma {{
                    border: 1px solid #000;
                    padding: 5px;
                    text-align: center;
                    min-height: 55px;
                    max-width: 400px;
                    margin: 0 auto;
                }}
                .firma strong {{
                    display: block;
                    margin-bottom: 5px;
                    font-size: 9px;
                }}
                .firma-linea {{
                    margin-top: 25px;
                    border-top: 1px solid #000;
                    padding-top: 3px;
                    font-size: 7px;
                }}
                .barcode-section {{
                    text-align: center;
                    margin: 10px 0;
                    padding: 5px;
                    border: 1px solid #000;
                }}
                .barcode-placeholder {{
                    height: 40px;
                    background: repeating-linear-gradient(
                        90deg,
                        #000 0px,
                        #000 2px,
                        #fff 2px,
                        #fff 4px
                    );
                    margin: 5px auto;
                    width: 80%;
                }}
                .footer {{
                    text-align: center;
                    padding: 5px;
                    font-size: 7px;
                    border-top: 1px solid #000;
                    margin-top: 5px;
                }}
            </style>
        </head>
        <body>
            <div class="header">
                <div class="header-left">
                    {"<img src='data:image/png;base64," + logo_base64 + "' class='header-logo' alt='Logo' />" if logo_base64 else ""}
                    <div class="empresa-datos">
                        <div><strong>{config.razon_social}</strong></div>
                        <div>CUIT: {config.cuit}</div>
                        <div>{config.domicilio_fiscal}</div>
                        <div>{config.localidad} - {config.provincia}</div>
                        <div>Teléfono: {config.telefono if hasattr(config, 'telefono') and config.telefono else '2224547329'}</div>
                    </div>
                </div>
                <div class="header-centro">
                    <div class="tipo-comprobante">R</div>
                    <div class="cod-label">COD. 91</div>
                </div>
                <div class="header-derecha">
                    <div class="remito-title">REMITO DE ENTREGA</div>
                    <div style="margin: 3px 0; text-align: center;">
                        <strong>{config.razon_social}</strong>
                    </div>
                    <div style="margin: 3px 0; text-align: center;">
                        <strong>Número de Remito: R-{str(venta.id).zfill(8)}</strong>
                    </div>
                    <div style="font-size: 8px; margin-top: 5px;">
                        <div><strong>Fecha de emisión:</strong> {venta.fecha.strftime('%d/%m/%Y')}</div>
                        <div><strong>Hora de emisión:</strong> {venta.fecha.strftime('%H:%M')}</div>
                        <div><strong>Lugar de emisión:</strong> {config.localidad}</div>
                    </div>
                </div>
            </div>

            <div class="info-section">
                <div class="info-box">
                    <div class="info-box-title">RECEPTOR (Recibe):</div>
                    <div class="info-line"><span class="info-label">Nombre:</span> {venta.cliente.razon_social}</div>
                    <div class="info-line"><span class="info-label">CUIT:</span> {venta.cliente.identificacion}</div>
                    <div class="info-line"><span class="info-label">Dirección:</span> {venta.cliente.direccion_fiscal or 'No especificado'}</div>
                    <div class="info-line"><span class="info-label">Localidad:</span> {venta.cliente.localidad_fiscal or 'No especificado'}</div>
                    <div class="info-line"><span class="info-label">Teléfono:</span> {venta.cliente.telefono if hasattr(venta.cliente, 'telefono') and venta.cliente.telefono else 'No especificado'}</div>
                </div>
            </div>

            <div style="border: 1px solid #000; padding: 5px; margin-bottom: 5px; font-size: 9px; font-weight: bold; background-color: #f0f0f0;">
                DETALLE DE MERCADERÍA ENTREGADA:
            </div>

            <table>
                <thead>
                    <tr>
                        <th>Descripción del Producto</th>
                        <th class="td-cantidad">Cantidad</th>
                        <th class="td-peso">Peso/Volumen</th>
                    </tr>
                </thead>
                <tbody>
        """

        # Agregar líneas de productos
        for linea in venta.lineas.all():
            cantidad_text = f"{float(linea.cantidad):.0f} unidades"
            peso_text = f"{float(linea.cantidad_kg):.2f} kg" if linea.cantidad_kg else "-"

            html_content += f"""
                    <tr>
                        <td>{linea.descripcion}</td>
                        <td class="td-cantidad">{cantidad_text}</td>
                        <td class="td-peso">{peso_text}</td>
                    </tr>
            """

        html_content += f"""
                </tbody>
            </table>

            <div class="observaciones">
                <strong>OBSERVACIONES:</strong><br/>
                {'<span>' + config.pie_remito.replace(chr(10), '<br/>') + '</span>' if config.pie_remito else '<span>• La mercadería detallada en este remito ha salido en perfecto estado de nuestro depósito.<br/>• Este documento certifica únicamente la entrega de las mercaderías mencionadas.</span>'}
            </div>

            <div class="firmas">
                <div class="firma">
                    <strong>RECIBE CONFORME</strong>
                    <div class="firma-linea">
                        <p>Firma y aclaración del receptor</p>
                        <p>{venta.cliente.razon_social}</p>
                    </div>
                </div>
            </div>

            <div class="barcode-section">
                <div style="font-size: 8px; margin-bottom: 5px;">Código de verificación AFIP</div>
                <div class="barcode-placeholder"></div>
                <div style="font-size: 7px; margin-top: 3px;">
                    CAI: {config.cai if config.cai else '________________________'} |
                    Fecha Vto: {config.cai_vencimiento.strftime('%d/%m/%Y') if config.cai_vencimiento else '___/___/______'}
                </div>
            </div>

            <div class="footer">
                <p>Documento no válido como factura | {config.razon_social} - CUIT: {config.cuit}</p>
                <p>Fecha de emisión: {venta.fecha.strftime('%d/%m/%Y %H:%M')} | Lugar de emisión: {config.localidad}</p>
            </div>
        </body>
        </html>
        """

        # Retornar HTML directamente (el navegador lo mostrará sin ruta en la vista previa de impresión)
        response = HttpResponse(html_content, content_type='text/html')
        return response

    @action(detail=False, methods=["get"], url_path="cobranzas/pendientes")
    def cobranzas_pendientes(self, request):
        """Obtiene todas las ventas con saldo pendiente de cobro"""
        ventas = Venta.objects.select_related("cliente").annotate(
            total_pagado_calc=Sum("cliente__pagos__monto")
        ).filter(
            Q(total_pagado_calc__lt=F("total")) | Q(total_pagado_calc__isnull=True)
        ).order_by("-fecha")

        serializer = self.get_serializer(ventas, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"], url_path="cobranzas/vencidas")
    def cobranzas_vencidas(self, request):
        """Obtiene todas las ventas vencidas"""
        hoy = date.today()
        ventas = Venta.objects.select_related("cliente").filter(
            fecha_vencimiento__lt=hoy
        ).annotate(
            total_pagado_calc=Sum("cliente__pagos__monto")
        ).filter(
            Q(total_pagado_calc__lt=F("total")) | Q(total_pagado_calc__isnull=True)
        ).order_by("fecha_vencimiento")

        serializer = self.get_serializer(ventas, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"], url_path="cobranzas/urgentes")
    def cobranzas_urgentes(self, request):
        """Obtiene ventas con urgencia alta de cobranza"""
        ventas = []
        for venta in Venta.objects.select_related("cliente").all():
            if venta.urgencia_cobranza == "ALTA":
                ventas.append(venta)

        serializer = self.get_serializer(ventas, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"], url_path="cobranzas/resumen")
    def resumen_cobranzas(self, request):
        """Resumen general del estado de cobranzas"""
        hoy = date.today()

        # Contadores por estado
        pendientes = Venta.objects.filter(
            Q(cliente__pagos__isnull=True) |
            Q(total__gt=Sum("cliente__pagos__monto"))
        ).count()

        vencidas = Venta.objects.filter(
            fecha_vencimiento__lt=hoy
        ).filter(
            Q(cliente__pagos__isnull=True) |
            Q(total__gt=Sum("cliente__pagos__monto"))
        ).count()

        # Montos
        monto_pendiente = Venta.objects.aggregate(
            total=Sum("total")
        )["total"] or 0

        monto_pagado = Sum("cliente__pagos__monto") or 0

        return Response({
            "pendientes": pendientes,
            "vencidas": vencidas,
            "monto_pendiente_total": monto_pendiente,
            "monto_pagado_total": monto_pagado,
            "porcentaje_cobranza": round((monto_pagado / monto_pendiente * 100), 2) if monto_pendiente > 0 else 0
        })

    @action(detail=True, methods=["post"], url_path="marcar-recordatorio")
    def marcar_recordatorio(self, request, pk=None):
        """Marca que se envió un recordatorio de pago al cliente"""
        venta = self.get_object()
        venta.fecha_ultimo_recordatorio = date.today()
        venta.save(update_fields=["fecha_ultimo_recordatorio"])

        serializer = self.get_serializer(venta)
        return Response(serializer.data)

    @action(detail=True, methods=["patch"], url_path="actualizar-condiciones")
    def actualizar_condiciones(self, request, pk=None):
        """Actualiza condiciones de pago de una venta"""
        venta = self.get_object()

        condicion_pago = request.data.get("condicion_pago")
        fecha_vencimiento = request.data.get("fecha_vencimiento")
        observaciones_cobro = request.data.get("observaciones_cobro")

        if condicion_pago:
            venta.condicion_pago = condicion_pago
        if fecha_vencimiento:
            venta.fecha_vencimiento = fecha_vencimiento
        if observaciones_cobro is not None:
            venta.observaciones_cobro = observaciones_cobro

        venta.save(update_fields=["condicion_pago", "fecha_vencimiento", "observaciones_cobro"])

        serializer = self.get_serializer(venta)
        return Response(serializer.data)

    def perform_destroy(self, instance):
        for linea in instance.lineas.select_related("producto"):
            if linea.producto:
                linea.producto.agregar_stock(linea.cantidad)
        super().perform_destroy(instance)

    @action(detail=False, methods=["get"], url_path="precios-recientes")
    def precios_recientes(self, request):
        """Obtiene los últimos 8 precios por kg únicos utilizados en ventas"""
        # Obtener precios únicos ordenados por fecha de venta más reciente
        precios = (
            LineaVenta.objects
            .select_related('venta')
            .filter(precio_unitario__gt=0)
            .values('precio_unitario')
            .annotate(
                ultima_vez=F('venta__fecha')
            )
            .order_by('-ultima_vez')
            .distinct()[:8]
        )

        # Extraer solo los valores de precio_unitario
        precios_lista = [
            float(precio['precio_unitario'])
            for precio in precios
        ]

        return Response({
            'precios': precios_lista
        })

