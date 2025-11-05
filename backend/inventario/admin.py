from django.contrib import admin
from .models import (
    MovimientoStock,
    ValorizacionInventario,
    AjusteInventario,
    AjusteInventarioDetalle,
    OrdenProduccion,
    ConsumoMateriaPrima
)


@admin.register(MovimientoStock)
class MovimientoStockAdmin(admin.ModelAdmin):
    list_display = [
        'fecha', 'tipo_movimiento', 'nombre_item', 'cantidad',
        'cantidad_anterior', 'cantidad_nueva', 'costo_unitario', 'usuario'
    ]
    list_filter = ['tipo_movimiento', 'fecha', 'content_type']
    search_fields = ['motivo', 'numero_documento']
    readonly_fields = ['cantidad_nueva', 'costo_total', 'creado_en', 'actualizado_en']
    date_hierarchy = 'fecha'

    fieldsets = (
        ('Información Básica', {
            'fields': ('fecha', 'tipo_movimiento', 'content_type', 'object_id')
        }),
        ('Cantidades', {
            'fields': ('cantidad', 'cantidad_anterior', 'cantidad_nueva')
        }),
        ('Costos', {
            'fields': ('costo_unitario', 'costo_total')
        }),
        ('Referencias', {
            'fields': ('venta', 'compra', 'orden_produccion', 'ajuste_inventario')
        }),
        ('Detalles', {
            'fields': ('motivo', 'numero_documento', 'usuario')
        }),
        ('Metadatos', {
            'fields': ('creado_en', 'actualizado_en'),
            'classes': ('collapse',)
        })
    )


class AjusteInventarioDetalleInline(admin.TabularInline):
    model = AjusteInventarioDetalle
    extra = 0
    readonly_fields = ['diferencia', 'costo_total_diferencia']


@admin.register(AjusteInventario)
class AjusteInventarioAdmin(admin.ModelAdmin):
    list_display = [
        'numero', 'fecha', 'tipo_ajuste', 'descripcion',
        'procesado', 'usuario'
    ]
    list_filter = ['tipo_ajuste', 'procesado', 'fecha']
    search_fields = ['numero', 'descripcion']
    readonly_fields = ['numero', 'procesado', 'fecha_procesado']
    inlines = [AjusteInventarioDetalleInline]

    fieldsets = (
        ('Información Básica', {
            'fields': ('numero', 'fecha', 'tipo_ajuste')
        }),
        ('Descripción', {
            'fields': ('descripcion', 'observaciones')
        }),
        ('Control', {
            'fields': ('usuario', 'procesado', 'fecha_procesado')
        })
    )


class ConsumoMateriaPrimaInline(admin.TabularInline):
    model = ConsumoMateriaPrima
    extra = 0
    readonly_fields = ['costo_total_planificado', 'costo_total_real', 'fecha_consumo']


@admin.register(OrdenProduccion)
class OrdenProduccionAdmin(admin.ModelAdmin):
    list_display = [
        'numero', 'producto', 'cantidad_planificada', 'cantidad_producida',
        'estado', 'fecha_creacion', 'responsable'
    ]
    list_filter = ['estado', 'fecha_creacion', 'producto']
    search_fields = ['numero', 'producto__nombre', 'descripcion']
    readonly_fields = [
        'numero', 'porcentaje_avance', 'costo_unitario_planificado',
        'costo_unitario_real'
    ]
    inlines = [ConsumoMateriaPrimaInline]

    fieldsets = (
        ('Información Básica', {
            'fields': ('numero', 'fecha_creacion', 'producto', 'responsable')
        }),
        ('Planificación', {
            'fields': (
                'fecha_inicio_planificada', 'fecha_fin_planificada',
                'cantidad_planificada', 'descripcion'
            )
        }),
        ('Ejecución', {
            'fields': (
                'fecha_inicio_real', 'fecha_fin_real',
                'cantidad_producida', 'estado', 'observaciones'
            )
        }),
        ('Costos', {
            'fields': (
                'costo_materias_primas', 'costo_mano_obra',
                'costo_gastos_generales', 'costo_total'
            )
        }),
        ('Indicadores', {
            'fields': ('porcentaje_avance', 'costo_unitario_planificado', 'costo_unitario_real'),
            'classes': ('collapse',)
        })
    )


@admin.register(ValorizacionInventario)
class ValorizacionInventarioAdmin(admin.ModelAdmin):
    list_display = [
        'lote_entrada', 'nombre_item', 'fecha_entrada',
        'cantidad_inicial', 'cantidad_actual', 'costo_unitario',
        'costo_total_actual', 'activo'
    ]
    list_filter = ['activo', 'fecha_entrada', 'content_type']
    search_fields = ['lote_entrada']
    readonly_fields = ['costo_total_inicial', 'costo_total_actual']

    fieldsets = (
        ('Lote', {
            'fields': ('lote_entrada', 'fecha_entrada', 'content_type', 'object_id')
        }),
        ('Cantidades', {
            'fields': ('cantidad_inicial', 'cantidad_actual')
        }),
        ('Costos', {
            'fields': ('costo_unitario', 'costo_total_inicial', 'costo_total_actual')
        }),
        ('Control', {
            'fields': ('movimiento_origen', 'activo')
        })
    )


@admin.register(ConsumoMateriaPrima)
class ConsumoMateriaPrimaAdmin(admin.ModelAdmin):
    list_display = [
        'orden_produccion', 'materia_prima', 'cantidad_planificada',
        'cantidad_consumida', 'costo_total_real', 'consumido'
    ]
    list_filter = ['consumido', 'fecha_consumo']
    search_fields = ['orden_produccion__numero', 'materia_prima__nombre']
    readonly_fields = ['costo_total_planificado', 'costo_total_real', 'fecha_consumo']