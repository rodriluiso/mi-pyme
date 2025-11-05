import { useEffect, useState } from "react";
import { useApi } from "@/hooks/useApi";
import type { ApiError } from "@/lib/api/types";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  Area,
  AreaChart
} from 'recharts';

interface ClienteRentabilidad {
  cliente_id: number;
  cliente_nombre: string;
  cliente_identificacion: string;
  total_ventas: number;
  total_pagos: number;
  saldo_pendiente: number;
  cantidad_ventas: number;
  ticket_promedio: number;
  frecuencia_mensual: number;
  margen_estimado: number;
  dias_ultima_compra: number;
  categoria: "VIP" | "Premium" | "Regular" | "Ocasional";
  rentabilidad_score: number;
}

interface AnalisisRentabilidad {
  periodo: {
    fecha_desde: string;
    fecha_hasta: string;
  };
  resumen_general: {
    total_clientes_activos: number;
    total_ingresos: number;
    total_margenes_estimados: number;
    ticket_promedio_general: number;
  };
  todos_los_clientes: ClienteRentabilidad[];
  top_clientes: ClienteRentabilidad[];
  clientes_en_riesgo: ClienteRentabilidad[];
  distribucion_categorias: {
    VIP: number;
    Premium: number;
    Regular: number;
    Ocasional: number;
  };
}

const formatearDecimal = (valor: number) =>
  valor.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatearEntero = (valor: number) =>
  valor.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const RentabilidadClientesPage = () => {
  const { request } = useApi();
  const [datos, setDatos] = useState<AnalisisRentabilidad | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [filtroCategoria, setFiltroCategoria] = useState<string>("todas");
  const [ordenamiento, setOrdenamiento] = useState<"rentabilidad" | "ventas" | "frecuencia">("rentabilidad");

  const cargarDatos = async () => {
    setCargando(true);
    setError(null);
    try {
      const response = await request<AnalisisRentabilidad>({
        method: "GET",
        url: "/finanzas/movimientos/analisis_rentabilidad_clientes/"
      });
      setDatos(response);
    } catch (err) {
      setError(err as ApiError);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  const clientesFiltrados = datos?.todos_los_clientes.filter(cliente =>
    filtroCategoria === "todas" || cliente.categoria === filtroCategoria
  ).sort((a, b) => {
    switch (ordenamiento) {
      case "ventas":
        return b.total_ventas - a.total_ventas;
      case "frecuencia":
        return b.frecuencia_mensual - a.frecuencia_mensual;
      default:
        return b.rentabilidad_score - a.rentabilidad_score;
    }
  }) || [];

  const coloresCategorias = {
    VIP: "#8b5cf6",
    Premium: "#06b6d4",
    Regular: "#10b981",
    Ocasional: "#f59e0b"
  };

  const datosDistribucion = datos ? Object.entries(datos.distribucion_categorias).map(([categoria, cantidad]) => ({
    categoria,
    cantidad,
    color: coloresCategorias[categoria as keyof typeof coloresCategorias]
  })) : [];

  const getBadgeColor = (categoria: string) => {
    switch (categoria) {
      case "VIP":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300";
      case "Premium":
        return "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/20 dark:text-cyan-300";
      case "Regular":
        return "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300";
      case "Ocasional":
        return "bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300";
    }
  };

  if (cargando) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-slate-600 dark:text-slate-400">Analizando rentabilidad de clientes...</p>
        </div>
      </div>
    );
  }

  if (error || !datos) {
    return (
      <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-700 dark:text-red-300">
        Error al cargar el análisis de rentabilidad: {error?.message || "Error desconocido"}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
          Análisis de Rentabilidad por Cliente
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Análisis detallado de la rentabilidad y valor de cada cliente del período {datos.periodo.fecha_desde} al {datos.periodo.fecha_hasta}
        </p>
        <button
          onClick={cargarDatos}
          className="self-start inline-flex items-center rounded-full border border-slate-200 dark:border-slate-700 px-4 py-1 text-sm font-medium text-slate-600 dark:text-slate-300 transition hover:border-blue-200 hover:text-blue-600 dark:hover:border-blue-500 dark:hover:text-blue-400"
        >
          Actualizar análisis
        </button>
      </header>

      {/* Resumen General */}
      <section className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Clientes Activos</p>
              <p className="mt-3 text-2xl font-semibold text-slate-900 dark:text-white">
                {formatearEntero(datos.resumen_general.total_clientes_activos)}
              </p>
            </div>
            <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
              <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Ingresos Totales</p>
              <p className="mt-3 text-2xl font-semibold text-green-600">
                ${formatearDecimal(datos.resumen_general.total_ingresos)}
              </p>
            </div>
            <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
              <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
              </svg>
            </div>
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Márgenes Estimados</p>
              <p className="mt-3 text-2xl font-semibold text-purple-600">
                ${formatearDecimal(datos.resumen_general.total_margenes_estimados)}
              </p>
            </div>
            <div className="h-12 w-12 rounded-full bg-purple-100 flex items-center justify-center">
              <svg className="h-6 w-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Ticket Promedio</p>
              <p className="mt-3 text-2xl font-semibold text-amber-600">
                ${formatearDecimal(datos.resumen_general.ticket_promedio_general)}
              </p>
            </div>
            <div className="h-12 w-12 rounded-full bg-amber-100 flex items-center justify-center">
              <svg className="h-6 w-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
              </svg>
            </div>
          </div>
        </article>
      </section>

      {/* Gráficos y Análisis */}
      <section className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        {/* Distribución por Categorías */}
        <article className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
            Distribución por Categorías
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={datosDistribucion}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  // Recharts marca percent como unknown en sus tipos
                  label={({categoria, cantidad, percent}: any) => `${categoria}: ${cantidad} (${(Number(percent) * 100).toFixed(0)}%)`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="cantidad"
                >
                  {datosDistribucion.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </article>

        {/* Top 5 Clientes */}
        <article className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
            Top 5 Clientes Más Rentables
          </h3>
          <div className="space-y-4">
            {datos.top_clientes.map((cliente, index) => (
              <div key={cliente.cliente_id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 text-white text-sm font-bold">
                    {index + 1}
                  </div>
                  <div>
                    <p className="font-medium text-slate-900 dark:text-white">{cliente.cliente_nombre}</p>
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getBadgeColor(cliente.categoria)}`}>
                        {cliente.categoria}
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        Score: {cliente.rentabilidad_score}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-slate-900 dark:text-white">
                    ${formatearDecimal(cliente.total_ventas)}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {cliente.cantidad_ventas} ventas
                  </p>
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>

      {/* Tabla Detallada */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm">
        <div className="p-6 border-b border-slate-200 dark:border-slate-700">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              Análisis Detallado por Cliente
            </h3>
            <div className="flex items-center gap-3">
              <select
                value={filtroCategoria}
                onChange={(e) => setFiltroCategoria(e.target.value)}
                className="rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              >
                <option value="todas">Todas las categorías</option>
                <option value="VIP">VIP</option>
                <option value="Premium">Premium</option>
                <option value="Regular">Regular</option>
                <option value="Ocasional">Ocasional</option>
              </select>
              <select
                value={ordenamiento}
                onChange={(e) => setOrdenamiento(e.target.value as typeof ordenamiento)}
                className="rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              >
                <option value="rentabilidad">Por rentabilidad</option>
                <option value="ventas">Por ventas totales</option>
                <option value="frecuencia">Por frecuencia</option>
              </select>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700 text-left text-sm text-slate-700 dark:text-slate-300">
            <thead className="bg-slate-50 dark:bg-slate-700 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Categoría</th>
                <th className="px-4 py-3">Total Ventas</th>
                <th className="px-4 py-3">Ticket Promedio</th>
                <th className="px-4 py-3">Frecuencia Mensual</th>
                <th className="px-4 py-3">Margen Estimado</th>
                <th className="px-4 py-3">Última Compra</th>
                <th className="px-4 py-3">Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {clientesFiltrados.map((cliente) => (
                <tr key={cliente.cliente_id} className="hover:bg-slate-50 dark:hover:bg-slate-700">
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-slate-900 dark:text-white">{cliente.cliente_nombre}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{cliente.cliente_identificacion}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getBadgeColor(cliente.categoria)}`}>
                      {cliente.categoria}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-semibold">
                    ${formatearDecimal(cliente.total_ventas)}
                    <p className="text-xs text-slate-500 dark:text-slate-400">{cliente.cantidad_ventas} ventas</p>
                  </td>
                  <td className="px-4 py-3">${formatearDecimal(cliente.ticket_promedio)}</td>
                  <td className="px-4 py-3">{cliente.frecuencia_mensual.toFixed(1)}/mes</td>
                  <td className="px-4 py-3 text-green-600 dark:text-green-400 font-semibold">
                    ${formatearDecimal(cliente.margen_estimado)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs ${cliente.dias_ultima_compra > 60 ? 'text-red-600 dark:text-red-400' : 'text-slate-500 dark:text-slate-400'}`}>
                      {cliente.dias_ultima_compra} días
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center">
                      <div className="h-2 bg-slate-200 dark:bg-slate-600 rounded-full w-16 mr-2">
                        <div
                          className="h-2 bg-blue-600 rounded-full"
                          style={{ width: `${Math.min(cliente.rentabilidad_score * 10, 100)}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium">{cliente.rentabilidad_score}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Clientes en Riesgo */}
      {datos.clientes_en_riesgo.length > 0 && (
        <section className="rounded-2xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-6">
          <h3 className="text-lg font-semibold text-red-800 dark:text-red-300 mb-4">
            ⚠️ Clientes en Riesgo (Sin compras recientes)
          </h3>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {datos.clientes_en_riesgo.map((cliente) => (
              <div key={cliente.cliente_id} className="bg-white dark:bg-slate-800 p-4 rounded-lg">
                <p className="font-medium text-slate-900 dark:text-white">{cliente.cliente_nombre}</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Última compra: {cliente.dias_ultima_compra} días
                </p>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Total histórico: ${formatearDecimal(cliente.total_ventas)}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default RentabilidadClientesPage;
