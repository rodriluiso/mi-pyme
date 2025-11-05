from django.contrib import admin

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
    PeriodoIVA,
    PagoIVA
)


@admin.register(PagoCliente)
class PagoClienteAdmin(admin.ModelAdmin):
    list_display = ("id", "fecha", "cliente", "monto", "medio")
    search_fields = ("cliente__nombre", "cliente__identificacion", "medio", "observacion")
    list_filter = ("fecha", "medio")


@admin.register(MovimientoFinanciero)
class MovimientoFinancieroAdmin(admin.ModelAdmin):
    list_display = ("id", "fecha", "tipo", "monto", "descripcion", "compra")
    list_filter = ("fecha", "tipo")
    search_fields = ("descripcion", "referencia_extra")

@admin.register(PagoProveedor)
class PagoProveedorAdmin(admin.ModelAdmin):
    list_display = ("id", "fecha", "proveedor", "monto")
    search_fields = ("proveedor__nombre", "proveedor__identificacion", "observacion")
    list_filter = ("fecha",)


@admin.register(CuentaBancaria)
class CuentaBancariaAdmin(admin.ModelAdmin):
    list_display = ("banco", "numero_cuenta", "tipo_cuenta", "titular", "saldo_actual", "activa")
    search_fields = ("banco", "numero_cuenta", "titular", "cbu", "alias")
    list_filter = ("banco", "tipo_cuenta", "activa")
    readonly_fields = ("fecha_creacion",)


@admin.register(ExtractoBancario)
class ExtractoBancarioAdmin(admin.ModelAdmin):
    list_display = ("cuenta_bancaria", "fecha_desde", "fecha_hasta", "saldo_inicial", "saldo_final", "total_movimientos", "procesado")
    search_fields = ("cuenta_bancaria__banco", "cuenta_bancaria__numero_cuenta", "archivo_nombre")
    list_filter = ("fecha_importacion", "procesado", "cuenta_bancaria")
    readonly_fields = ("fecha_importacion",)


@admin.register(MovimientoBancario)
class MovimientoBancarioAdmin(admin.ModelAdmin):
    list_display = ("fecha", "descripcion", "debito", "credito", "saldo", "conciliado")
    search_fields = ("descripcion", "referencia")
    list_filter = ("fecha", "conciliado", "extracto__cuenta_bancaria")
    readonly_fields = ("monto",)


@admin.register(ConciliacionBancaria)
class ConciliacionBancariaAdmin(admin.ModelAdmin):
    list_display = ("cuenta_bancaria", "fecha_conciliacion", "saldo_libro", "saldo_banco", "diferencia")
    search_fields = ("cuenta_bancaria__banco", "cuenta_bancaria__numero_cuenta", "usuario")
    list_filter = ("fecha_conciliacion", "cuenta_bancaria")
    readonly_fields = ("fecha_creacion", "diferencia")


@admin.register(ConfiguracionAFIP)
class ConfiguracionAFIPAdmin(admin.ModelAdmin):
    list_display = ("cuit", "razon_social", "ambiente", "punto_venta", "activa")
    search_fields = ("cuit", "razon_social")
    list_filter = ("ambiente", "activa")
    readonly_fields = ("fecha_creacion", "ultima_actualizacion")


class DetalleFacturaElectronicaInline(admin.TabularInline):
    model = DetalleFacturaElectronica
    extra = 0
    readonly_fields = ("importe_neto", "importe_iva", "importe_total")


@admin.register(FacturaElectronica)
class FacturaElectronicaAdmin(admin.ModelAdmin):
    list_display = ("numero_completo", "tipo_comprobante", "cliente_razon_social", "fecha_emision", "importe_total", "estado", "cae")
    search_fields = ("numero_comprobante", "cliente_razon_social", "cliente_numero_documento", "cae")
    list_filter = ("tipo_comprobante", "estado", "fecha_emision", "configuracion_afip")
    readonly_fields = ("numero_completo", "fecha_creacion", "fecha_autorizacion", "cae", "fecha_vencimiento_cae")
    inlines = [DetalleFacturaElectronicaInline]

    fieldsets = (
        ("Información Básica", {
            "fields": ("configuracion_afip", "tipo_comprobante", "punto_venta", "numero_comprobante", "fecha_emision", "fecha_vencimiento")
        }),
        ("Cliente", {
            "fields": ("cliente_tipo_documento", "cliente_numero_documento", "cliente_razon_social", "cliente_email", "cliente_domicilio")
        }),
        ("Importes", {
            "fields": ("importe_neto", "importe_iva", "importe_otros_tributos", "importe_total")
        }),
        ("AFIP", {
            "fields": ("estado", "cae", "fecha_vencimiento_cae", "observaciones_afip")
        }),
        ("Control", {
            "fields": ("venta", "fecha_creacion", "fecha_autorizacion", "usuario_creacion"),
            "classes": ("collapse",)
        })
    )


@admin.register(LogAFIP)
class LogAFIPAdmin(admin.ModelAdmin):
    list_display = ("factura", "fecha_hora", "accion", "resultado", "codigo_error")
    search_fields = ("factura__numero_comprobante", "accion", "mensaje", "codigo_error")
    list_filter = ("resultado", "fecha_hora", "accion")
    readonly_fields = ("fecha_hora",)

    fieldsets = (
        ("Información Básica", {
            "fields": ("factura", "fecha_hora", "accion", "resultado", "codigo_error", "mensaje")
        }),
        ("Detalles Técnicos", {
            "fields": ("request_xml", "response_xml"),
            "classes": ("collapse",)
        })
    )


class PagoIVAInline(admin.TabularInline):
    model = PagoIVA
    extra = 0
    readonly_fields = ("movimiento_financiero", "fecha_creacion")


@admin.register(PeriodoIVA)
class PeriodoIVAAdmin(admin.ModelAdmin):
    list_display = ("__str__", "nombre_mes", "estado", "iva_debito_fiscal", "iva_credito_fiscal", "saldo_favor_fisco", "fecha_presentacion")
    search_fields = ("observaciones", "numero_presentacion")
    list_filter = ("anio", "mes", "estado", "fecha_presentacion")
    readonly_fields = ("iva_debito_fiscal", "iva_credito_fiscal", "saldo_favor_fisco", "saldo_favor_contribuyente", "fecha_creacion", "fecha_actualizacion")
    inlines = [PagoIVAInline]

    fieldsets = (
        ("Período", {
            "fields": ("anio", "mes", "fecha_desde", "fecha_hasta", "estado")
        }),
        ("IVA", {
            "fields": ("iva_debito_fiscal", "iva_credito_fiscal", "saldo_favor_fisco", "saldo_favor_contribuyente")
        }),
        ("Presentación AFIP", {
            "fields": ("fecha_presentacion", "numero_presentacion", "observaciones")
        }),
        ("Auditoría", {
            "fields": ("fecha_creacion", "fecha_actualizacion"),
            "classes": ("collapse",)
        })
    )


@admin.register(PagoIVA)
class PagoIVAAdmin(admin.ModelAdmin):
    list_display = ("periodo", "fecha_pago", "monto", "medio_pago", "numero_comprobante")
    search_fields = ("periodo__anio", "periodo__mes", "numero_comprobante", "observaciones")
    list_filter = ("fecha_pago", "medio_pago", "periodo__anio")
    readonly_fields = ("movimiento_financiero", "fecha_creacion")

    fieldsets = (
        ("Pago", {
            "fields": ("periodo", "fecha_pago", "monto", "medio_pago", "numero_comprobante")
        }),
        ("Detalles", {
            "fields": ("observaciones",)
        }),
        ("Control", {
            "fields": ("movimiento_financiero", "fecha_creacion"),
            "classes": ("collapse",)
        })
    )
