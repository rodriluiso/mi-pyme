import { useCallback, useEffect, useState, useMemo } from "react";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
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
  ResponsiveContainer
} from "recharts";
import { useApi } from "@/hooks/useApi";
import { useListado } from "@/hooks/useListado";
import type { ApiError } from "@/lib/api/types";
import type {
  Compra,
  Venta,
  MateriaPrima,
  Producto,
  Cliente,
  Proveedor
} from "@/types/mipyme";

const formatearDecimal = (valor: string | number | null | undefined) => {
  const numero = Number(valor ?? "0");
  if (Number.isNaN(numero)) {
    return "0";
  }
  return numero.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatearEntero = (valor: number | null | undefined) => {
  const numero = Number(valor ?? 0);
  if (Number.isNaN(numero)) {
    return "0";
  }
  return numero.toLocaleString();
};

const COLORES_GRAFICOS = [
  "#3B82F6", // blue-500
  "#10B981", // emerald-500
  "#F59E0B", // amber-500
  "#EF4444", // red-500
  "#8B5CF6", // violet-500
  "#06B6D4", // cyan-500
  "#84CC16", // lime-500
  "#F97316", // orange-500
];

type PeriodoAnalisis = "semanal" | "mensual" | "trimestral" | "anual";

const OPCIONES_PERIODO: Array<{ valor: PeriodoAnalisis; etiqueta: string }> = [
  { valor: "semanal", etiqueta: "Últimos 7 días" },
  { valor: "mensual", etiqueta: "Últimos 30 días" },
  { valor: "trimestral", etiqueta: "Últimos 3 meses" },
  { valor: "anual", etiqueta: "Último año" }
];

type MetricasVentas = {
  totalVentas: number;
  totalCompras: number;
  utilidadBruta: number;
  numeroClientes: number;
  ventasPromedio: number;
  numeroVentas: number;
  productosVendidos: number;
  ticketPromedio: number;
};

type TopCliente = {
  cliente: string;
  cliente_id: number;
  total: number;
  ventas: number;
  fill: string;
};

type TopProducto = {
  producto: string;
  cantidad_vendida: number;
  ingresos: number;
  fill: string;
};

const EstadisticasPage = () => {
  const { request } = useApi();

  // Datos básicos del sistema
  const { datos: compras } = useListado<Compra>("/compras/");
  const { datos: ventas } = useListado<Venta>("/ventas/");
  const { datos: materiasPrimas } = useListado<MateriaPrima>("/compras/materias-primas/");
  const { datos: productos } = useListado<Producto>("/productos/");
  const { datos: clientes } = useListado<Cliente>("/clientes/");
  const { datos: proveedores } = useListado<Proveedor>("/proveedores/");

  // Estados para datos calculados
  const [periodo, setPeriodo] = useState<PeriodoAnalisis>("mensual");
  const [cargandoEstadisticas, setCargandoEstadisticas] = useState(false);
  const [errorEstadisticas, setErrorEstadisticas] = useState<ApiError | null>(null);

  const [topClientes, setTopClientes] = useState<TopCliente[]>([]);
  const [topProductos, setTopProductos] = useState<TopProducto[]>([]);

  // Calcular métricas de ventas
  const metricas: MetricasVentas = useMemo(() => {
    const totalVentas = ventas.reduce((suma, venta) => suma + Number(venta.total), 0);
    const totalCompras = compras.reduce((suma, compra) => suma + Number(compra.total), 0);
    const utilidadBruta = totalVentas - totalCompras;

    const numeroVentas = ventas.length;
    const ventasPromedio = numeroVentas > 0 ? totalVentas / numeroVentas : 0;
    const ticketPromedio = ventasPromedio; // Mismo valor, diferente concepto

    const productosVendidos = ventas.reduce((suma, venta) => {
      return suma + venta.lineas.reduce((sumaLineas, linea) => {
        return sumaLineas + Number(linea.cantidad || 0);
      }, 0);
    }, 0);

    return {
      totalVentas,
      totalCompras,
      utilidadBruta,
      numeroClientes: clientes.length,
      ventasPromedio,
      numeroVentas,
      productosVendidos,
      ticketPromedio
    };
  }, [compras, ventas, clientes]);

  // Calcular Top Clientes
  const calcularTopClientes = useCallback(() => {
    const ventasPorCliente = new Map<number, { nombre: string; total: number; cantidad: number }>();

    ventas.forEach(venta => {
      const clienteId = venta.cliente;
      const clienteNombre = venta.cliente_nombre;
      const total = Number(venta.total);

      if (ventasPorCliente.has(clienteId)) {
        const existente = ventasPorCliente.get(clienteId)!;
        ventasPorCliente.set(clienteId, {
          nombre: existente.nombre,
          total: existente.total + total,
          cantidad: existente.cantidad + 1
        });
      } else {
        ventasPorCliente.set(clienteId, {
          nombre: clienteNombre,
          total: total,
          cantidad: 1
        });
      }
    });

    const topClientesArray = Array.from(ventasPorCliente.entries())
      .map(([id, datos]) => ({
        cliente: datos.nombre,
        cliente_id: id,
        total: datos.total,
        ventas: datos.cantidad,
        fill: ""
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5)
      .map((cliente, index) => ({
        ...cliente,
        fill: COLORES_GRAFICOS[index % COLORES_GRAFICOS.length]
      }));

    setTopClientes(topClientesArray);
  }, [ventas]);

  // Calcular Top Productos
  const calcularTopProductos = useCallback(() => {
    const productosPorVenta = new Map<string, { cantidad: number; ingresos: number }>();

    ventas.forEach(venta => {
      venta.lineas.forEach(linea => {
        const productoNombre = linea.producto_nombre || linea.descripcion || "Producto sin nombre";
        const cantidad = Number(linea.cantidad || 0);
        const ingresos = Number(linea.subtotal || 0);

        if (productosPorVenta.has(productoNombre)) {
          const existente = productosPorVenta.get(productoNombre)!;
          productosPorVenta.set(productoNombre, {
            cantidad: existente.cantidad + cantidad,
            ingresos: existente.ingresos + ingresos
          });
        } else {
          productosPorVenta.set(productoNombre, {
            cantidad: cantidad,
            ingresos: ingresos
          });
        }
      });
    });

    const topProductosArray = Array.from(productosPorVenta.entries())
      .map(([nombre, datos]) => ({
        producto: nombre,
        cantidad_vendida: datos.cantidad,
        ingresos: datos.ingresos,
        fill: ""
      }))
      .sort((a, b) => b.ingresos - a.ingresos)
      .slice(0, 5)
      .map((producto, index) => ({
        ...producto,
        fill: COLORES_GRAFICOS[index % COLORES_GRAFICOS.length]
      }));

    setTopProductos(topProductosArray);
  }, [ventas]);

  const cargarResumenes = useCallback(async () => {
    setCargandoEstadisticas(true);
    setErrorEstadisticas(null);

    try {
      calcularTopClientes();
      calcularTopProductos();
    } catch (err) {
      setErrorEstadisticas(err as ApiError);
    } finally {
      setCargandoEstadisticas(false);
    }
  }, [calcularTopClientes, calcularTopProductos]);

  useEffect(() => {
    void cargarResumenes();
  }, [cargarResumenes]);

  // Función para convertir cantidad a kilogramos según el producto
  const convertirAKilogramos = useCallback((cantidad: number, productoId: number | null) => {
    if (!productoId) return cantidad; // Si no hay producto asociado, asumir que ya está en kg

    const producto = productos.find(p => p.id === productoId);
    if (!producto) return cantidad; // Si no encontramos el producto, asumir kg

    // Para productos terminados, asumimos que están en kg por defecto
    // En el futuro se podría agregar una unidad de medida específica para productos
    return cantidad;
  }, [productos]);

  // Datos de evolución temporal de ventas
  const evolucionVentas = useMemo(() => {
    const datos = [];
    const fechaActual = new Date();

    for (let i = 29; i >= 0; i--) {
      const fecha = new Date(fechaActual);
      fecha.setDate(fecha.getDate() - i);

      const ventasDelDia = ventas.filter(v => {
        const fechaVenta = new Date(v.fecha);
        return fechaVenta.toDateString() === fecha.toDateString();
      }).reduce((suma, v) => suma + Number(v.total), 0);

      const cantidadVentas = ventas.filter(v => {
        const fechaVenta = new Date(v.fecha);
        return fechaVenta.toDateString() === fecha.toDateString();
      }).length;

      datos.push({
        fecha: fecha.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' }),
        ingresos: ventasDelDia,
        cantidad: cantidadVentas,
        promedio: cantidadVentas > 0 ? ventasDelDia / cantidadVentas : 0
      });
    }

    return datos;
  }, [ventas]);

  // Datos de evolución de ventas en kilogramos
  const evolucionVentasKg = useMemo(() => {
    const datos = [];
    const fechaActual = new Date();

    // Determinar el rango de días según el período seleccionado
    let diasAtras;
    switch (periodo) {
      case "semanal":
        diasAtras = 7;
        break;
      case "mensual":
        diasAtras = 30;
        break;
      case "trimestral":
        diasAtras = 90;
        break;
      case "anual":
        diasAtras = 365;
        break;
      default:
        diasAtras = 30;
    }

    for (let i = diasAtras - 1; i >= 0; i--) {
      const fecha = new Date(fechaActual);
      fecha.setDate(fecha.getDate() - i);

      const ventasDelDia = ventas.filter(v => {
        const fechaVenta = new Date(v.fecha);
        return fechaVenta.toDateString() === fecha.toDateString();
      });

      // Calcular kilogramos vendidos en el día
      const kilogramosVendidos = ventasDelDia.reduce((totalKg, venta) => {
        return totalKg + venta.lineas.reduce((sumaLineas, linea) => {
          const cantidad = Number(linea.cantidad || 0);
          const kgLinea = convertirAKilogramos(cantidad, linea.producto);
          return sumaLineas + kgLinea;
        }, 0);
      }, 0);

      // Formato de fecha según el período
      let formatoFecha;
      if (periodo === "semanal") {
        formatoFecha = fecha.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
      } else if (periodo === "mensual") {
        formatoFecha = fecha.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
      } else if (periodo === "trimestral") {
        formatoFecha = fecha.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
      } else {
        formatoFecha = fecha.toLocaleDateString('es-ES', { month: '2-digit', year: '2-digit' });
      }

      datos.push({
        fecha: formatoFecha,
        kilogramos: kilogramosVendidos,
        numeroVentas: ventasDelDia.length
      });
    }

    // Si es período anual, agrupar por mes
    if (periodo === "anual") {
      const datosPorMes = new Map();
      datos.forEach(dato => {
        const [mes, año] = dato.fecha.split('/');
        const claveMes = `${mes}/${año}`;

        if (datosPorMes.has(claveMes)) {
          const existente = datosPorMes.get(claveMes);
          datosPorMes.set(claveMes, {
            fecha: claveMes,
            kilogramos: existente.kilogramos + dato.kilogramos,
            numeroVentas: existente.numeroVentas + dato.numeroVentas
          });
        } else {
          datosPorMes.set(claveMes, dato);
        }
      });

      return Array.from(datosPorMes.values()).sort((a, b) => {
        const [mesA, añoA] = a.fecha.split('/');
        const [mesB, añoB] = b.fecha.split('/');
        return new Date(Number(`20${añoA}`), Number(mesA) - 1).getTime() -
               new Date(Number(`20${añoB}`), Number(mesB) - 1).getTime();
      });
    }

    return datos;
  }, [ventas, productos, periodo, convertirAKilogramos]);

  // Distribución de ventas por estado de productos
  const ventasPorEstado = useMemo(() => [
    {
      nombre: "Productos Activos",
      valor: ventas.filter(v =>
        v.lineas.some(l => {
          const producto = productos.find(p => p.id === l.producto);
          return producto?.activo || !producto;
        })
      ).length,
      fill: COLORES_GRAFICOS[0]
    },
    {
      nombre: "Productos Inactivos",
      valor: ventas.filter(v =>
        v.lineas.some(l => {
          const producto = productos.find(p => p.id === l.producto);
          return producto && !producto.activo;
        })
      ).length,
      fill: COLORES_GRAFICOS[1]
    }
  ], [ventas, productos]);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Estadísticas de Ventas</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Análisis completo del rendimiento de ventas, top clientes y productos más vendidos.
        </p>

        <div className="flex flex-wrap items-center gap-4 mt-4">
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400" htmlFor="periodo-estadisticas">
              Período de análisis
            </label>
            <select
              id="periodo-estadisticas"
              value={periodo}
              onChange={(evento) => setPeriodo(evento.target.value as PeriodoAnalisis)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            >
              {OPCIONES_PERIODO.map((opcion) => (
                <option key={opcion.valor} value={opcion.valor}>
                  {opcion.etiqueta}
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>

      {/* Métricas principales de ventas */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Total Ventas</p>
              <p className="text-2xl font-bold text-green-600">${formatearDecimal(metricas.totalVentas)}</p>
            </div>
            <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
              <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Número de Ventas</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{formatearEntero(metricas.numeroVentas)}</p>
            </div>
            <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
              <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Ticket Promedio</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">${formatearDecimal(metricas.ticketPromedio)}</p>
            </div>
            <div className="h-12 w-12 rounded-full bg-amber-100 flex items-center justify-center">
              <svg className="h-6 w-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Clientes Activos</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{formatearEntero(metricas.numeroClientes)}</p>
            </div>
            <div className="h-12 w-12 rounded-full bg-purple-100 flex items-center justify-center">
              <svg className="h-6 w-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
          </div>
        </div>
      </section>

      {/* Gráficos principales */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Evolución de ventas */}
        <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
            Evolución de Ventas
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={evolucionVentas}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="fecha" tick={{ fontSize: 12 }} stroke="#64748b" />
              <YAxis tick={{ fontSize: 12 }} stroke="#64748b" />
              <Tooltip
                formatter={(value: number, name: string) => {
                  if (name === 'ingresos') return [`$${formatearDecimal(value)}`, 'Ingresos'];
                  if (name === 'cantidad') return [formatearEntero(value), 'Cantidad'];
                  if (name === 'promedio') return [`$${formatearDecimal(value)}`, 'Promedio'];
                  return [value, name];
                }}
                labelStyle={{ color: '#475569' }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="ingresos"
                stroke={COLORES_GRAFICOS[0]}
                strokeWidth={2}
                name="Ingresos"
                dot={{ fill: COLORES_GRAFICOS[0], strokeWidth: 2, r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="cantidad"
                stroke={COLORES_GRAFICOS[1]}
                strokeWidth={2}
                name="Cantidad"
                dot={{ fill: COLORES_GRAFICOS[1], strokeWidth: 2, r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </section>

        {/* Evolución de ventas en kilogramos */}
        <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
            Ventas en Kilogramos - {OPCIONES_PERIODO.find(op => op.valor === periodo)?.etiqueta}
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={evolucionVentasKg}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="fecha"
                tick={{ fontSize: 12 }}
                stroke="#64748b"
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis tick={{ fontSize: 12 }} stroke="#64748b" />
              <Tooltip
                formatter={(value: number, name: string) => {
                  if (name === 'kilogramos') return [`${formatearDecimal(value)} kg`, 'Kilogramos Vendidos'];
                  if (name === 'numeroVentas') return [formatearEntero(value), 'Número de Ventas'];
                  return [value, name];
                }}
                labelStyle={{ color: '#475569' }}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="kilogramos"
                stroke={COLORES_GRAFICOS[2]}
                fill={COLORES_GRAFICOS[2]}
                fillOpacity={0.6}
                strokeWidth={2}
                name="Kilogramos"
              />
            </AreaChart>
          </ResponsiveContainer>

          {/* Resumen de kilogramos */}
          <div className="mt-4 p-3 bg-slate-50 rounded-lg">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-slate-600 dark:text-slate-400">Total Kilogramos Vendidos</p>
                <p className="font-semibold text-slate-900 dark:text-white">
                  {formatearDecimal(evolucionVentasKg.reduce((suma, dato) => suma + dato.kilogramos, 0))} kg
                </p>
              </div>
              <div>
                <p className="text-slate-600 dark:text-slate-400">Promedio Diario</p>
                <p className="font-semibold text-slate-900 dark:text-white">
                  {formatearDecimal(evolucionVentasKg.length > 0
                    ? evolucionVentasKg.reduce((suma, dato) => suma + dato.kilogramos, 0) / evolucionVentasKg.length
                    : 0)} kg/día
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Top clientes */}
        <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
            Top 5 Clientes
          </h2>
          {cargandoEstadisticas ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">Cargando datos...</p>
          ) : topClientes.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topClientes}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  dataKey="cliente"
                  tick={{ fontSize: 12 }}
                  stroke="#64748b"
                  angle={-45}
                  textAnchor="end"
                  height={60}
                />
                <YAxis tick={{ fontSize: 12 }} stroke="#64748b" />
                <Tooltip
                  formatter={(value: number) => [`$${formatearDecimal(value)}`, 'Total Comprado']}
                  labelStyle={{ color: '#475569' }}
                />
                <Bar dataKey="total" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400">Sin datos suficientes</p>
          )}
        </section>
      </div>

      {/* Gráficos de distribución */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Top productos más vendidos */}
        <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
            Top Productos por Ingresos
          </h2>
          {topProductos.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={topProductos}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  dataKey="ingresos"
                  label={({ producto, ingresos }) => `${producto.substring(0, 15)}${producto.length > 15 ? '...' : ''}: $${formatearDecimal(ingresos)}`}
                >
                  {topProductos.map((entrada, index) => (
                    <Cell key={`cell-${index}`} fill={entrada.fill} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [`$${formatearDecimal(Number(value))}`, 'Ingresos']} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400">Sin datos suficientes</p>
          )}
        </section>

        {/* Distribución de ventas por estado */}
        <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
            Ventas por Estado de Producto
          </h2>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={ventasPorEstado}
                cx="50%"
                cy="50%"
                outerRadius={80}
                dataKey="valor"
                label={({ nombre, valor }) => `${nombre}: ${valor}`}
              >
                {ventasPorEstado.map((entrada, index) => (
                  <Cell key={`cell-${index}`} fill={entrada.fill} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </section>

        {/* Métricas adicionales */}
        <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
            Resumen de Ventas
          </h2>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-600 dark:text-slate-400">Total Clientes</span>
              <span className="font-semibold text-slate-900 dark:text-white">{metricas.numeroClientes}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-600 dark:text-slate-400">Productos Vendidos</span>
              <span className="font-semibold text-slate-900 dark:text-white">{formatearEntero(metricas.productosVendidos)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-600 dark:text-slate-400">Venta Promedio</span>
              <span className="font-semibold text-slate-900 dark:text-white">${formatearDecimal(metricas.ventasPromedio)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-600 dark:text-slate-400">Utilidad Bruta</span>
              <span className={`font-semibold ${metricas.utilidadBruta >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ${formatearDecimal(metricas.utilidadBruta)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-600 dark:text-slate-400">Productos Disponibles</span>
              <span className="font-semibold text-slate-900 dark:text-white">{productos.filter(p => p.activo).length}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-600 dark:text-slate-400">Materias Primas</span>
              <span className="font-semibold text-slate-900 dark:text-white">{materiasPrimas.filter(mp => mp.activo).length}</span>
            </div>
          </div>
        </section>
      </div>

      {errorEstadisticas && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Error al cargar algunas estadísticas: {errorEstadisticas.message || "Error desconocido"}
        </div>
      )}
    </div>
  );
};

export default EstadisticasPage;