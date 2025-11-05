import { useState, useEffect } from "react";
import { useApi } from "@/hooks/useApi";
import type {
  ReporteRentabilidadProductosResponse,
  ReporteRentabilidadClientesResponse,
  TendenciasVentasResponse
} from "@/types/mipyme";

type TipoReporte = "productos" | "clientes" | "tendencias";

const ReportesPage = () => {
  const { request } = useApi();
  const [tipoReporte, setTipoReporte] = useState<TipoReporte>("productos");
  const [cargando, setCargando] = useState(false);
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");

  // Estados para los diferentes reportes
  const [reporteProductos, setReporteProductos] = useState<ReporteRentabilidadProductosResponse | null>(null);
  const [reporteClientes, setReporteClientes] = useState<ReporteRentabilidadClientesResponse | null>(null);
  const [reporteTendencias, setReporteTendencias] = useState<TendenciasVentasResponse | null>(null);

  const formatearDecimal = (valor: number, decimales = 2) => {
    return valor.toLocaleString(undefined, {
      minimumFractionDigits: decimales,
      maximumFractionDigits: decimales
    });
  };

  const cargarReporte = async () => {
    setCargando(true);
    try {
      const params = new URLSearchParams();
      if (fechaDesde) params.append('fecha_desde', fechaDesde);
      if (fechaHasta) params.append('fecha_hasta', fechaHasta);
      const queryString = params.toString();

      switch (tipoReporte) {
        case "productos":
          const respProductos = await request<ReporteRentabilidadProductosResponse>({
            method: "GET",
            url: `/finanzas/movimientos/reporte_rentabilidad_productos/${queryString ? `?${queryString}` : ''}`
          });
          setReporteProductos(respProductos);
          break;

        case "clientes":
          const respClientes = await request<ReporteRentabilidadClientesResponse>({
            method: "GET",
            url: `/finanzas/movimientos/reporte_rentabilidad_clientes/${queryString ? `?${queryString}` : ''}`
          });
          setReporteClientes(respClientes);
          break;

        case "tendencias":
          const respTendencias = await request<TendenciasVentasResponse>({
            method: "GET",
            url: "/finanzas/movimientos/tendencias_ventas/"
          });
          setReporteTendencias(respTendencias);
          break;
      }
    } catch (error) {
      console.error("Error cargando reporte:", error);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    void cargarReporte();
  }, [tipoReporte]);

  const obtenerColorMargen = (porcentaje: number) => {
    if (porcentaje >= 30) return "text-green-600";
    if (porcentaje >= 15) return "text-amber-600";
    return "text-red-600";
  };

  const obtenerColorDeuda = (porcentaje: number) => {
    if (porcentaje >= 90) return "text-green-600";
    if (porcentaje >= 70) return "text-amber-600";
    return "text-red-600";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Reportes Avanzados</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Análisis detallado de rentabilidad, tendencias y performance del negocio
            </p>
          </div>
          <button
            type="button"
            onClick={() => cargarReporte()}
            disabled={cargando}
            className="inline-flex items-center rounded-full border border-slate-200 px-4 py-1 text-sm font-medium text-slate-600 dark:text-slate-400 transition hover:border-blue-200 hover:text-blue-600 disabled:opacity-50"
          >
            {cargando ? "Cargando..." : "Actualizar datos"}
          </button>
        </div>
      </section>

      {/* Controles de filtros */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Filtros y Configuración</h2>

        {/* Selector de tipo de reporte */}
        <div className="grid gap-4 md:grid-cols-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Tipo de Reporte</label>
            <select
              value={tipoReporte}
              onChange={(e) => setTipoReporte(e.target.value as TipoReporte)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="productos">Rentabilidad por Productos</option>
              <option value="clientes">Rentabilidad por Clientes</option>
              <option value="tendencias">Tendencias de Ventas</option>
            </select>
          </div>

          {tipoReporte !== "tendencias" && (
            <>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Fecha Desde</label>
                <input
                  type="date"
                  value={fechaDesde}
                  onChange={(e) => setFechaDesde(e.target.value)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Fecha Hasta</label>
                <input
                  type="date"
                  value={fechaHasta}
                  onChange={(e) => setFechaHasta(e.target.value)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => cargarReporte()}
                  disabled={cargando}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
                >
                  Aplicar Filtros
                </button>
              </div>
            </>
          )}
        </div>
      </section>

      {/* Contenido del reporte */}
      {cargando ? (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-8 shadow-sm text-center">
          <p className="text-slate-500 dark:text-slate-400">Cargando reporte...</p>
        </div>
      ) : (
        <>
          {/* Reporte de Productos */}
          {tipoReporte === "productos" && reporteProductos && (
            <section className="space-y-4">
              {/* Resumen */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Resumen de Rentabilidad por Productos</h3>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <p className="text-sm text-blue-600 font-medium">Total Productos</p>
                    <p className="text-2xl font-bold text-blue-900">{reporteProductos.resumen.total_productos}</p>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <p className="text-sm text-green-600 font-medium">Total Vendido</p>
                    <p className="text-2xl font-bold text-green-900">${formatearDecimal(reporteProductos.resumen.total_vendido)}</p>
                  </div>
                  <div className="text-center p-4 bg-amber-50 rounded-lg">
                    <p className="text-sm text-amber-600 font-medium">Margen Promedio</p>
                    <p className="text-2xl font-bold text-amber-900">{formatearDecimal(reporteProductos.resumen.margen_promedio)}%</p>
                  </div>
                </div>
              </div>

              {/* Tabla de productos */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-200">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Detalle por Producto</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Producto</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Vendido</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Cantidad</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Precio Prom.</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Margen %</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Ventas</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200">
                      {reporteProductos.productos.map((producto) => (
                        <tr key={producto.producto_id} className="hover:bg-slate-50">
                          <td className="px-4 py-3">
                            <div>
                              <p className="font-medium text-slate-900 dark:text-white">{producto.producto_nombre}</p>
                              <p className="text-sm text-slate-500 dark:text-slate-400">SKU: {producto.producto_sku}</p>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-slate-900 dark:text-white">
                            ${formatearDecimal(producto.total_vendido)}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">
                            {formatearDecimal(producto.cantidad_vendida, 0)}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">
                            ${formatearDecimal(producto.precio_promedio)}
                          </td>
                          <td className={`px-4 py-3 text-right font-medium ${obtenerColorMargen(producto.margen_porcentaje)}`}>
                            {formatearDecimal(producto.margen_porcentaje)}%
                          </td>
                          <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">
                            {producto.ventas_count}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}

          {/* Reporte de Clientes */}
          {tipoReporte === "clientes" && reporteClientes && (
            <section className="space-y-4">
              {/* Resumen */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Resumen de Rentabilidad por Clientes</h3>
                <div className="grid gap-4 md:grid-cols-4">
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <p className="text-sm text-blue-600 font-medium">Total Clientes</p>
                    <p className="text-2xl font-bold text-blue-900">{reporteClientes.resumen.total_clientes}</p>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <p className="text-sm text-green-600 font-medium">Total Vendido</p>
                    <p className="text-2xl font-bold text-green-900">${formatearDecimal(reporteClientes.resumen.total_vendido)}</p>
                  </div>
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <p className="text-sm text-blue-600 font-medium">Total Cobrado</p>
                    <p className="text-2xl font-bold text-blue-900">${formatearDecimal(reporteClientes.resumen.total_cobrado)}</p>
                  </div>
                  <div className="text-center p-4 bg-red-50 rounded-lg">
                    <p className="text-sm text-red-600 font-medium">Deuda Total</p>
                    <p className="text-2xl font-bold text-red-900">${formatearDecimal(reporteClientes.resumen.deuda_total)}</p>
                  </div>
                </div>
              </div>

              {/* Tabla de clientes */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-200">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Detalle por Cliente</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Cliente</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Vendido</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Pagado</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Deuda</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">% Pago</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Ventas</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Última Venta</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200">
                      {reporteClientes.clientes.map((cliente) => (
                        <tr key={cliente.cliente_id} className="hover:bg-slate-50">
                          <td className="px-4 py-3">
                            <div>
                              <p className="font-medium text-slate-900 dark:text-white">{cliente.cliente_nombre}</p>
                              <p className="text-sm text-slate-500 dark:text-slate-400">{cliente.cliente_identificacion}</p>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-slate-900 dark:text-white">
                            ${formatearDecimal(cliente.total_vendido)}
                          </td>
                          <td className="px-4 py-3 text-right text-green-700">
                            ${formatearDecimal(cliente.total_pagado)}
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-red-700">
                            ${formatearDecimal(cliente.deuda_pendiente)}
                          </td>
                          <td className={`px-4 py-3 text-right font-medium ${obtenerColorDeuda(cliente.porcentaje_pago)}`}>
                            {formatearDecimal(cliente.porcentaje_pago)}%
                          </td>
                          <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">
                            {cliente.ventas_count}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">
                            {cliente.dias_ultima_venta === 0 ? 'Hoy' :
                             cliente.dias_ultima_venta === 1 ? 'Ayer' :
                             `Hace ${cliente.dias_ultima_venta} días`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}

          {/* Reporte de Tendencias */}
          {tipoReporte === "tendencias" && reporteTendencias && (
            <section className="space-y-4">
              {/* Comparativa anual */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Comparativa Anual</h3>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <p className="text-sm text-blue-600 font-medium">Año {reporteTendencias.comparativa_anual.año_actual.año}</p>
                    <p className="text-2xl font-bold text-blue-900">
                      ${formatearDecimal(reporteTendencias.comparativa_anual.año_actual.total_ventas)}
                    </p>
                    <p className="text-sm text-blue-700">
                      {reporteTendencias.comparativa_anual.año_actual.cantidad_ventas} ventas
                    </p>
                  </div>
                  <div className="text-center p-4 bg-slate-50 rounded-lg">
                    <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">Año {reporteTendencias.comparativa_anual.año_anterior.año}</p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">
                      ${formatearDecimal(reporteTendencias.comparativa_anual.año_anterior.total_ventas)}
                    </p>
                    <p className="text-sm text-slate-700 dark:text-slate-300">
                      {reporteTendencias.comparativa_anual.año_anterior.cantidad_ventas} ventas
                    </p>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <p className="text-sm text-green-600 font-medium">Crecimiento</p>
                    <p className={`text-2xl font-bold ${reporteTendencias.comparativa_anual.crecimiento_porcentual >= 0 ? 'text-green-900' : 'text-red-900'}`}>
                      {reporteTendencias.comparativa_anual.crecimiento_porcentual > 0 ? '+' : ''}
                      {formatearDecimal(reporteTendencias.comparativa_anual.crecimiento_porcentual)}%
                    </p>
                  </div>
                </div>
              </div>

              {/* Ventas mensuales */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Ventas Mensuales</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Mes</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Ventas</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Cantidad</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Promedio</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200">
                      {reporteTendencias.ventas_mensuales.map((mes) => (
                        <tr key={`${mes.año}-${mes.mes}`} className="hover:bg-slate-50">
                          <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                            {mes.mes_nombre} {mes.año}
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-slate-900 dark:text-white">
                            ${formatearDecimal(mes.total_ventas)}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">
                            {mes.cantidad_ventas}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">
                            ${formatearDecimal(mes.venta_promedio)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Top productos */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Top Productos del Período</h3>
                <div className="space-y-3">
                  {reporteTendencias.top_productos.map((producto, index) => (
                    <div key={producto.producto_sku} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center justify-center w-8 h-8 bg-blue-100 text-blue-800 rounded-full text-sm font-bold">
                          {index + 1}
                        </span>
                        <div>
                          <p className="font-medium text-slate-900 dark:text-white">{producto.producto_nombre}</p>
                          <p className="text-sm text-slate-500 dark:text-slate-400">SKU: {producto.producto_sku}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-slate-900 dark:text-white">${formatearDecimal(producto.total_vendido)}</p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">{formatearDecimal(producto.cantidad_vendida, 0)} unidades</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
};

export default ReportesPage;