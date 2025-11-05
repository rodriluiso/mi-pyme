from rest_framework.routers import DefaultRouter

from .views import (
    MovimientoFinancieroViewSet,
    PagoClienteViewSet,
    PagoProveedorViewSet,
    CuentaBancariaViewSet,
    ExtractoBancarioViewSet,
    MovimientoBancarioViewSet,
    ConciliacionBancariaViewSet,
    ConfiguracionAFIPViewSet,
    FacturaElectronicaViewSet,
    DetalleFacturaElectronicaViewSet,
    LogAFIPViewSet,
    PeriodoIVAViewSet,
    PagoIVAViewSet
)

router = DefaultRouter()
router.register(r"pagos", PagoClienteViewSet, basename="pago-cliente")
router.register(r"pagos-proveedores", PagoProveedorViewSet, basename="pago-proveedor")
router.register(r"movimientos", MovimientoFinancieroViewSet, basename="movimiento-financiero")
router.register(r"cuentas-bancarias", CuentaBancariaViewSet, basename="cuenta-bancaria")
router.register(r"extractos-bancarios", ExtractoBancarioViewSet, basename="extracto-bancario")
router.register(r"movimientos-bancarios", MovimientoBancarioViewSet, basename="movimiento-bancario")
router.register(r"conciliaciones-bancarias", ConciliacionBancariaViewSet, basename="conciliacion-bancaria")
router.register(r"configuraciones-afip", ConfiguracionAFIPViewSet, basename="configuracion-afip")
router.register(r"facturas-electronicas", FacturaElectronicaViewSet, basename="factura-electronica")
router.register(r"detalles-facturas-electronicas", DetalleFacturaElectronicaViewSet, basename="detalle-factura-electronica")
router.register(r"logs-afip", LogAFIPViewSet, basename="log-afip")
router.register(r"periodos-iva", PeriodoIVAViewSet, basename="periodo-iva")
router.register(r"pagos-iva", PagoIVAViewSet, basename="pago-iva")

urlpatterns = router.urls