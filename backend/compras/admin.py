from django.contrib import admin

from .models import AjusteStockMateriaPrima, CategoriaCompra, Compra, CompraLinea, MateriaPrima, StockPorProveedor


class CompraLineaInline(admin.TabularInline):
    model = CompraLinea
    extra = 1


@admin.register(Compra)
class CompraAdmin(admin.ModelAdmin):
    list_display = ("id", "fecha", "proveedor", "categoria", "numero", "total")
    list_filter = ("fecha", "categoria", "proveedor")
    search_fields = ("numero", "proveedor__nombre", "proveedor__identificacion")
    inlines = [CompraLineaInline]


@admin.register(CategoriaCompra)
class CategoriaCompraAdmin(admin.ModelAdmin):
    list_display = ("id", "nombre")
    search_fields = ("nombre",)


@admin.register(MateriaPrima)
class MateriaPrimaAdmin(admin.ModelAdmin):
    list_display = ("id", "nombre", "sku", "unidad_medida", "stock", "precio_promedio", "activo")
    list_filter = ("unidad_medida", "activo")
    search_fields = ("nombre", "sku", "descripcion")
    readonly_fields = ("precio_promedio",)


@admin.register(AjusteStockMateriaPrima)
class AjusteStockMateriaPrimaAdmin(admin.ModelAdmin):
    list_display = ("id", "fecha", "materia_prima", "tipo_ajuste", "cantidad", "stock_anterior", "stock_nuevo", "usuario")
    list_filter = ("tipo_ajuste", "fecha", "materia_prima")
    search_fields = ("materia_prima__nombre", "motivo", "usuario")
    readonly_fields = ("fecha",)
    date_hierarchy = "fecha"


@admin.register(StockPorProveedor)
class StockPorProveedorAdmin(admin.ModelAdmin):
    list_display = ("id", "materia_prima", "proveedor", "cantidad_stock", "precio_promedio", "ultima_compra", "total_comprado")
    list_filter = ("materia_prima", "proveedor", "ultima_compra")
    search_fields = ("materia_prima__nombre", "proveedor__nombre")
    readonly_fields = ("total_comprado",)