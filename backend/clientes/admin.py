from django.contrib import admin
from .models import Cliente, SucursalCliente


class SucursalClienteInline(admin.TabularInline):
    model = SucursalCliente
    extra = 1
    fields = ('nombre_sucursal', 'codigo_sucursal', 'direccion', 'localidad', 'telefono', 'activo')


@admin.register(Cliente)
class ClienteAdmin(admin.ModelAdmin):
    list_display = ("razon_social", "identificacion", "correo_principal", "telefono_principal", "activo", "total_sucursales")
    search_fields = ("razon_social", "identificacion", "correo_principal")
    list_filter = ("activo", "fecha_creacion")
    readonly_fields = ("fecha_creacion",)
    inlines = [SucursalClienteInline]

    def total_sucursales(self, obj):
        return obj.sucursales.filter(activo=True).count()
    total_sucursales.short_description = "Sucursales"


@admin.register(SucursalCliente)
class SucursalClienteAdmin(admin.ModelAdmin):
    list_display = ("nombre_completo", "direccion", "localidad", "telefono", "activo")
    search_fields = ("nombre_sucursal", "codigo_sucursal", "direccion", "cliente__razon_social")
    list_filter = ("activo", "localidad", "fecha_creacion")
    readonly_fields = ("fecha_creacion",)
    raw_id_fields = ("cliente",)

