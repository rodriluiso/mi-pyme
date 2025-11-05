from django.contrib import admin
from .models import (
    PlanCuentas,
    AsientoContable,
    AsientoContableDetalle,
    BalanceGeneral,
    BalanceGeneralDetalle,
    EstadoResultados,
    EstadoResultadosDetalle
)


@admin.register(PlanCuentas)
class PlanCuentasAdmin(admin.ModelAdmin):
    list_display = [
        'codigo', 'nombre', 'tipo_cuenta', 'subtipo_cuenta',
        'acepta_movimientos', 'activa', 'nivel'
    ]
    list_filter = ['tipo_cuenta', 'subtipo_cuenta', 'acepta_movimientos', 'activa', 'nivel']
    search_fields = ['codigo', 'nombre', 'descripcion']
    ordering = ['codigo']

    fieldsets = (
        ('Identificación', {
            'fields': ('codigo', 'nombre', 'descripcion')
        }),
        ('Clasificación', {
            'fields': ('tipo_cuenta', 'subtipo_cuenta', 'cuenta_padre', 'nivel')
        }),
        ('Configuración', {
            'fields': ('acepta_movimientos', 'activa')
        })
    )


class AsientoContableDetalleInline(admin.TabularInline):
    model = AsientoContableDetalle
    extra = 2
    fields = ['cuenta', 'debe', 'haber', 'detalle']


@admin.register(AsientoContable)
class AsientoContableAdmin(admin.ModelAdmin):
    list_display = [
        'numero', 'fecha', 'concepto', 'total_debe', 'total_haber',
        'esta_balanceado', 'procesado', 'usuario'
    ]
    list_filter = ['procesado', 'fecha']
    search_fields = ['numero', 'concepto']
    readonly_fields = ['numero', 'total_debe', 'total_haber', 'esta_balanceado']
    inlines = [AsientoContableDetalleInline]

    fieldsets = (
        ('Información Básica', {
            'fields': ('numero', 'fecha', 'concepto')
        }),
        ('Referencias', {
            'fields': ('venta', 'compra', 'movimiento_financiero')
        }),
        ('Control', {
            'fields': ('procesado', 'usuario', 'total_debe', 'total_haber', 'esta_balanceado')
        })
    )


class BalanceGeneralDetalleInline(admin.TabularInline):
    model = BalanceGeneralDetalle
    extra = 0
    readonly_fields = ['cuenta', 'saldo']
    can_delete = False


@admin.register(BalanceGeneral)
class BalanceGeneralAdmin(admin.ModelAdmin):
    list_display = [
        'fecha_corte', 'total_activo', 'total_pasivo',
        'total_patrimonio', 'fecha_generacion', 'usuario'
    ]
    list_filter = ['fecha_corte', 'fecha_generacion']
    readonly_fields = [
        'total_activo', 'total_pasivo', 'total_patrimonio', 'fecha_generacion'
    ]
    inlines = [BalanceGeneralDetalleInline]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False


class EstadoResultadosDetalleInline(admin.TabularInline):
    model = EstadoResultadosDetalle
    extra = 0
    readonly_fields = ['cuenta', 'importe']
    can_delete = False


@admin.register(EstadoResultados)
class EstadoResultadosAdmin(admin.ModelAdmin):
    list_display = [
        'fecha_desde', 'fecha_hasta', 'total_ingresos', 'total_gastos',
        'utilidad_neta', 'fecha_generacion', 'usuario'
    ]
    list_filter = ['fecha_desde', 'fecha_hasta', 'fecha_generacion']
    readonly_fields = [
        'total_ingresos', 'total_costos', 'total_gastos',
        'utilidad_bruta', 'utilidad_neta', 'fecha_generacion'
    ]
    inlines = [EstadoResultadosDetalleInline]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False