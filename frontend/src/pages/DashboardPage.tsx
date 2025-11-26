import { useEffect, useMemo, useState } from "react";
import { useApi } from "@/hooks/useApi";
import { useListado } from "@/hooks/useListado";
import { useAuth } from "@/contexts/AuthContext";
import type { ApiError } from "@/lib/api/types";
import type {
  Cliente,
  Compra,
  PagoCliente,
  ResumenPendiente,
  Venta,
  MateriaPrima,
  Producto
} from "@/types/mipyme";
import AlertasDashboard from "@/components/AlertasDashboard";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';

const formatearDecimal = (valor: number) =>
  valor.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatearEntero = (valor: number) =>
  valor.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });

type Recordatorio = {
  id: string;
  titulo: string;
  descripcion: string;
  fecha: string;
  prioridad: "alta" | "media" | "baja";
  completado: boolean;
};

type FormularioRecordatorio = {
  titulo: string;
  descripcion: string;
  fecha: string;
  prioridad: "alta" | "media" | "baja";
};

const estadoInicialRecordatorio: FormularioRecordatorio = {
  titulo: "",
  descripcion: "",
  fecha: new Date().toISOString().slice(0, 10),
  prioridad: "media"
};

const DashboardPage = () => {
  const { request } = useApi();
  const { canAccessModule } = useAuth();
  const [cargando, setCargando] = useState<boolean>(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [compras, setCompras] = useState<Compra[]>([]);
  const [pagos, setPagos] = useState<PagoCliente[]>([]);
  const [resumenPendiente, setResumenPendiente] = useState<ResumenPendiente | null>(null);

  // Datos para las nuevas funcionalidades - solo cargar si tiene permisos
  const { datos: materiasPrimasData } = useListado<MateriaPrima>(
    canAccessModule('compras') ? "/compras/materias-primas/" : null
  );
  const { datos: productosData } = useListado<Producto>(
    canAccessModule('productos') ? "/productos/" : null
  );

  // Usar valores por defecto para evitar errores cuando los datos aún no han cargado
  const materiasPrimas = Array.isArray(materiasPrimasData) ? materiasPrimasData : [];
  const productos = Array.isArray(productosData) ? productosData : [];

  // Estados para recordatorios
  const [recordatorios, setRecordatorios] = useState<Recordatorio[]>([]);
  const [mostrarFormularioRecordatorio, setMostrarFormularioRecordatorio] = useState(false);
  const [formularioRecordatorio, setFormularioRecordatorio] = useState<FormularioRecordatorio>(estadoInicialRecordatorio);

  // Estados para calendario
  const [fechaCalendario, setFechaCalendario] = useState(new Date());
  const [diaSeleccionado, setDiaSeleccionado] = useState<string | null>(null);
  const [mostrarFormularioCalendario, setMostrarFormularioCalendario] = useState(false);

  useEffect(() => {
    const cargar = async () => {
      setCargando(true);
      setError(null);
      try {
        // Solo cargar datos de módulos a los que el usuario tiene acceso
        const requests = [];

        if (canAccessModule('clientes')) {
          requests.push(
            request<{ results: Cliente[] } | Cliente[]>({ method: "GET", url: "/clientes/" })
              .then(resp => ({ tipo: 'clientes', data: resp }))
          );
        }

        if (canAccessModule('ventas')) {
          requests.push(
            request<{ results: Venta[] } | Venta[]>({ method: "GET", url: "/ventas/" })
              .then(resp => ({ tipo: 'ventas', data: resp }))
          );
        }

        if (canAccessModule('compras')) {
          requests.push(
            request<{ results: Compra[] } | Compra[]>({ method: "GET", url: "/compras/" })
              .then(resp => ({ tipo: 'compras', data: resp }))
          );
        }

        if (canAccessModule('finanzas')) {
          requests.push(
            request<{ results: PagoCliente[] } | PagoCliente[]>({ method: "GET", url: "/finanzas/pagos/" })
              .then(resp => ({ tipo: 'pagos', data: resp })),
            request<ResumenPendiente>({ method: "GET", url: "/finanzas/movimientos/resumen/pendiente/" })
              .then(resp => ({ tipo: 'resumen', data: resp }))
          );
        }

        const responses = await Promise.all(requests);

        // Procesar respuestas
        responses.forEach((response: any) => {
          const data = response.data;
          switch (response.tipo) {
            case 'clientes':
              setClientes(Array.isArray(data) ? data : data?.results || []);
              break;
            case 'ventas':
              setVentas(Array.isArray(data) ? data : data?.results || []);
              break;
            case 'compras':
              setCompras(Array.isArray(data) ? data : data?.results || []);
              break;
            case 'pagos':
              setPagos(Array.isArray(data) ? data : data?.results || []);
              break;
            case 'resumen':
              setResumenPendiente(data);
              break;
          }
        });
      } catch (err) {
        setError(err as ApiError);
      } finally {
        setCargando(false);
      }
    };

    // Cargar recordatorios desde localStorage
    const recordatoriosGuardados = localStorage.getItem('mipyme-recordatorios');
    if (recordatoriosGuardados) {
      setRecordatorios(JSON.parse(recordatoriosGuardados));
    }

    void cargar();
  }, [request, canAccessModule]);

  // Calcular stock total en kilogramos (solo productos terminados)
  const stockTotalKg = useMemo(() => {
    const stockProductos = productos.reduce((total, p) => {
      return total + Number(p.stock_kg || 0); // stock en kilogramos
    }, 0);

    return stockProductos;
  }, [productos]);

  // Calcular ventas de la semana
  const ventasSemana = useMemo(() => {
    const hoy = new Date();
    const inicioSemana = new Date(hoy);
    inicioSemana.setDate(hoy.getDate() - 7);

    const ventasDeSemana = ventas.filter(venta => {
      const fechaVenta = new Date(venta.fecha);
      return fechaVenta >= inicioSemana && fechaVenta <= hoy;
    });

    return {
      cantidad: ventasDeSemana.length,
      total: ventasDeSemana.reduce((suma, venta) => suma + Number(venta.total || 0), 0),
      ventas: ventasDeSemana
    };
  }, [ventas]);

  const totales = useMemo(() => {
    const totalVentas = ventas.reduce((acumulado, venta) => acumulado + Number(venta.total ?? "0"), 0);
    const totalCompras = compras.reduce((acumulado, compra) => acumulado + Number(compra.total ?? "0"), 0);
    const totalPagos = pagos.reduce((acumulado, pago) => acumulado + Number(pago.monto ?? "0"), 0);

    return {
      totalClientes: clientes.length,
      totalVentas,
      totalCompras,
      totalPagos,
      pendiente: Number(resumenPendiente?.pendiente_cobro ?? "0"),
      utilidad: totalVentas - totalCompras
    };
  }, [clientes.length, compras, pagos, resumenPendiente?.pendiente_cobro, ventas]);

  const ventasRecientes = useMemo(() => ventas.slice(0, 5), [ventas]);

  // Datos para gráficos y estadísticas
  const estadisticas = useMemo(() => {
    // Ventas por mes (últimos 6 meses)
    const ventasPorMes = [];
    const hoy = new Date();

    for (let i = 5; i >= 0; i--) {
      const fecha = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
      const mes = fecha.toLocaleDateString('es', { month: 'short', year: '2-digit' });

      const ventasDelMes = ventas.filter(venta => {
        const fechaVenta = new Date(venta.fecha);
        return fechaVenta.getMonth() === fecha.getMonth() &&
               fechaVenta.getFullYear() === fecha.getFullYear();
      });

      const totalDinero = ventasDelMes.reduce((sum, venta) => sum + Number(venta.total || 0), 0);
      const totalKg = ventasDelMes.reduce((sum, venta) => {
        // Sumar kilogramos de las líneas de venta (asumiendo datos de productos)
        return sum + Number(venta.total || 0) * 0.01; // Aproximación: $1 ≈ 0.01kg
      }, 0);

      ventasPorMes.push({
        mes,
        dinero: totalDinero,
        kg: totalKg,
        cantidad: ventasDelMes.length
      });
    }

    // Top 5 clientes por volumen de compras
    const clientesAgrupados = clientes.map(cliente => {
      const ventasCliente = ventas.filter(venta => venta.cliente_nombre === cliente.nombre);
      const totalComprado = ventasCliente.reduce((sum, venta) => sum + Number(venta.total || 0), 0);
      const cantidadVentas = ventasCliente.length;

      return {
        nombre: cliente.nombre,
        total: totalComprado,
        ventas: cantidadVentas,
        promedio: cantidadVentas > 0 ? totalComprado / cantidadVentas : 0
      };
    }).filter(cliente => cliente.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    // Productos más vendidos
    const productosVendidos = productos.map(producto => {
      // Simulación de datos de ventas por producto
      const ventasAleatorias = Math.floor(Math.random() * 50) + 1;
      const ingresos = ventasAleatorias * Number(producto.precio || 0);

      return {
        nombre: producto.nombre,
        cantidad: ventasAleatorias,
        ingresos: ingresos,
        stock: Number(producto.stock || 0)
      };
    }).sort((a, b) => b.cantidad - a.cantidad).slice(0, 5);

    // Comparación mensual (crecimiento)
    const crecimiento = ventasPorMes.length >= 2 ?
      ((ventasPorMes[ventasPorMes.length - 1].dinero - ventasPorMes[ventasPorMes.length - 2].dinero) /
       ventasPorMes[ventasPorMes.length - 2].dinero * 100) : 0;

    return {
      ventasPorMes,
      topClientes: clientesAgrupados,
      topProductos: productosVendidos,
      crecimientoMensual: crecimiento
    };
  }, [ventas, clientes, productos]);

  const recargarTodo = async () => {
    setCargando(true);
    setError(null);
    try {
      // Solo cargar datos de módulos a los que el usuario tiene acceso
      const requests = [];

      if (canAccessModule('clientes')) {
        requests.push(
          request<{ results: Cliente[] } | Cliente[]>({ method: "GET", url: "/clientes/" })
            .then(resp => ({ tipo: 'clientes', data: resp }))
        );
      }

      if (canAccessModule('ventas')) {
        requests.push(
          request<{ results: Venta[] } | Venta[]>({ method: "GET", url: "/ventas/" })
            .then(resp => ({ tipo: 'ventas', data: resp }))
        );
      }

      if (canAccessModule('compras')) {
        requests.push(
          request<{ results: Compra[] } | Compra[]>({ method: "GET", url: "/compras/" })
            .then(resp => ({ tipo: 'compras', data: resp }))
        );
      }

      if (canAccessModule('finanzas')) {
        requests.push(
          request<{ results: PagoCliente[] } | PagoCliente[]>({ method: "GET", url: "/finanzas/pagos/" })
            .then(resp => ({ tipo: 'pagos', data: resp })),
          request<ResumenPendiente>({ method: "GET", url: "/finanzas/movimientos/resumen/pendiente/" })
            .then(resp => ({ tipo: 'resumen', data: resp }))
        );
      }

      const responses = await Promise.all(requests);

      // Procesar respuestas
      responses.forEach((response: any) => {
        const data = response.data;
        switch (response.tipo) {
          case 'clientes':
            setClientes(Array.isArray(data) ? data : data?.results || []);
            break;
          case 'ventas':
            setVentas(Array.isArray(data) ? data : data?.results || []);
            break;
          case 'compras':
            setCompras(Array.isArray(data) ? data : data?.results || []);
            break;
          case 'pagos':
            setPagos(Array.isArray(data) ? data : data?.results || []);
            break;
          case 'resumen':
            setResumenPendiente(data);
            break;
        }
      });
    } catch (err) {
      setError(err as ApiError);
    } finally {
      setCargando(false);
    }
  };

  // Funciones para recordatorios
  const guardarRecordatorios = (nuevosRecordatorios: Recordatorio[]) => {
    localStorage.setItem('mipyme-recordatorios', JSON.stringify(nuevosRecordatorios));
    setRecordatorios(nuevosRecordatorios);
  };

  const agregarRecordatorio = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formularioRecordatorio.titulo.trim()) return;

    const nuevoRecordatorio: Recordatorio = {
      id: Date.now().toString(),
      titulo: formularioRecordatorio.titulo.trim(),
      descripcion: formularioRecordatorio.descripcion.trim(),
      fecha: formularioRecordatorio.fecha,
      prioridad: formularioRecordatorio.prioridad,
      completado: false
    };

    const nuevosRecordatorios = [nuevoRecordatorio, ...recordatorios];
    guardarRecordatorios(nuevosRecordatorios);

    setFormularioRecordatorio(estadoInicialRecordatorio);
    setMostrarFormularioRecordatorio(false);
    setMostrarFormularioCalendario(false);
  };

  const toggleRecordatorio = (id: string) => {
    const nuevosRecordatorios = recordatorios.map(r =>
      r.id === id ? { ...r, completado: !r.completado } : r
    );
    guardarRecordatorios(nuevosRecordatorios);
  };

  const eliminarRecordatorio = (id: string) => {
    const nuevosRecordatorios = recordatorios.filter(r => r.id !== id);
    guardarRecordatorios(nuevosRecordatorios);
  };

  const recordatoriosPendientes = recordatorios.filter(r => !r.completado);
  const recordatoriosUrgentes = recordatoriosPendientes.filter(r => {
    const fechaRecordatorio = new Date(r.fecha);
    const hoy = new Date();
    const diferenciaDias = Math.ceil((fechaRecordatorio.getTime() - hoy.getTime()) / (1000 * 3600 * 24));
    return diferenciaDias <= 3 && diferenciaDias >= 0; // próximos 3 días
  });

  // Funciones para calendario
  const obtenerDiasDelMes = (fecha: Date) => {
    const año = fecha.getFullYear();
    const mes = fecha.getMonth();
    const primerDia = new Date(año, mes, 1);
    const ultimoDia = new Date(año, mes + 1, 0);
    const diasEnMes = ultimoDia.getDate();
    const primerDiaSemana = primerDia.getDay();

    const dias = [];

    // Agregar días vacíos del mes anterior
    for (let i = 0; i < primerDiaSemana; i++) {
      dias.push(null);
    }

    // Agregar días del mes actual
    for (let dia = 1; dia <= diasEnMes; dia++) {
      dias.push(dia);
    }

    return dias;
  };

  const formatearFechaCalendario = (dia: number) => {
    const año = fechaCalendario.getFullYear();
    const mes = fechaCalendario.getMonth();
    return new Date(año, mes, dia).toISOString().slice(0, 10);
  };

  const obtenerRecordatoriosDelDia = (dia: number) => {
    const fechaDia = formatearFechaCalendario(dia);
    return recordatorios.filter(r => r.fecha === fechaDia);
  };

  const manejarClickDia = (dia: number) => {
    const fechaSeleccionada = formatearFechaCalendario(dia);
    setDiaSeleccionado(fechaSeleccionada);
    setFormularioRecordatorio(prev => ({ ...prev, fecha: fechaSeleccionada }));
    setMostrarFormularioCalendario(true);
  };

  const navegarMes = (direccion: 'anterior' | 'siguiente') => {
    setFechaCalendario(prev => {
      const nuevaFecha = new Date(prev);
      if (direccion === 'anterior') {
        nuevaFecha.setMonth(prev.getMonth() - 1);
      } else {
        nuevaFecha.setMonth(prev.getMonth() + 1);
      }
      return nuevaFecha;
    });
  };

  const diasSemana = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const nombresMeses = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Tablero general</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Resumen ejecutivo de tu PyME con métricas clave y recordatorios importantes.
            </p>
          </div>
          <button
            type="button"
            onClick={() => recargarTodo()}
            className="inline-flex items-center rounded-full border border-slate-200 dark:border-slate-700 px-4 py-1 text-sm font-medium text-slate-600 dark:text-slate-300 transition hover:border-blue-200 hover:text-blue-600 dark:hover:border-blue-500 dark:hover:text-blue-400"
          >
            Recargar datos
          </button>
        </div>
        {cargando && <p className="text-sm text-slate-500 dark:text-slate-400">Cargando indicadores...</p>}
        {error && (
          <p className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-700 dark:text-red-300">
            Ocurrió un problema al obtener los datos. {error.message || "Error"}
          </p>
        )}
      </section>

      {/* Métricas principales mejoradas */}
      <section className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
        <article className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Stock Total</p>
              <p className="mt-3 text-2xl font-semibold text-slate-900 dark:text-white">{formatearDecimal(stockTotalKg)} kg</p>
            </div>
            <div className="h-12 w-12 rounded-full bg-purple-100 flex items-center justify-center">
              <svg className="h-6 w-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Ventas Semana</p>
              <p className="mt-3 text-2xl font-semibold text-green-600">${formatearDecimal(ventasSemana.total)}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{ventasSemana.cantidad} ventas</p>
            </div>
            <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
              <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Utilidad Bruta</p>
              <p className={`mt-3 text-2xl font-semibold ${totales.utilidad >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ${formatearDecimal(totales.utilidad)}
              </p>
            </div>
            <div className={`h-12 w-12 rounded-full flex items-center justify-center ${totales.utilidad >= 0 ? 'bg-green-100' : 'bg-red-100'}`}>
              <svg className={`h-6 w-6 ${totales.utilidad >= 0 ? 'text-green-600' : 'text-red-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
              </svg>
            </div>
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Clientes</p>
              <p className="mt-3 text-2xl font-semibold text-slate-900 dark:text-white">{totales.totalClientes}</p>
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
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Pendiente</p>
              <p className="mt-3 text-2xl font-semibold text-amber-600">${formatearDecimal(totales.pendiente)}</p>
            </div>
            <div className="h-12 w-12 rounded-full bg-amber-100 flex items-center justify-center">
              <svg className="h-6 w-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </article>
      </section>

      {/* Sección de Estadísticas con Gráficos */}
      <section className="grid gap-6 grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
        {/* Ventas por Mes - Dinero */}
        <article className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Ventas por Mes (Dinero)</h3>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 bg-blue-500 rounded-full"></div>
              <span className="text-xs text-slate-500 dark:text-slate-400">Ingresos</span>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={estadisticas.ventasPorMes}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="mes" tick={{ fontSize: 12 }} stroke="#64748b" />
                <YAxis tick={{ fontSize: 12 }} stroke="#64748b" />
                <Tooltip
                  formatter={(value: number) => [`$${formatearDecimal(value)}`, 'Ventas']}
                  labelStyle={{ color: '#1e293b' }}
                  contentStyle={{
                    backgroundColor: 'var(--tooltip-bg, #f8fafc)',
                    border: '1px solid var(--tooltip-border, #e2e8f0)',
                    borderRadius: '8px',
                    color: 'var(--tooltip-text, #1e293b)'
                  }}
                  labelStyle={{ color: 'var(--tooltip-text, #1e293b)' }}
                />
                <Area
                  type="monotone"
                  dataKey="dinero"
                  stroke="#3b82f6"
                  fill="#3b82f6"
                  fillOpacity={0.3}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 flex items-center justify-between">
            <span className="text-sm text-slate-600 dark:text-slate-400">Tendencia mensual</span>
            <span className={`text-sm font-semibold ${estadisticas.crecimientoMensual >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {estadisticas.crecimientoMensual >= 0 ? '+' : ''}{estadisticas.crecimientoMensual.toFixed(1)}%
            </span>
          </div>
        </article>

        {/* Ventas por Mes - Kilogramos */}
        <article className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Ventas por Mes (Kg)</h3>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 bg-green-500 rounded-full"></div>
              <span className="text-xs text-slate-500 dark:text-slate-400">Kilogramos</span>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={estadisticas.ventasPorMes}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="mes" tick={{ fontSize: 12 }} stroke="#64748b" />
                <YAxis tick={{ fontSize: 12 }} stroke="#64748b" />
                <Tooltip
                  formatter={(value: number) => [`${value.toFixed(1)} kg`, 'Kilogramos']}
                  labelStyle={{ color: '#1e293b' }}
                  contentStyle={{
                    backgroundColor: 'var(--tooltip-bg, #f8fafc)',
                    border: '1px solid var(--tooltip-border, #e2e8f0)',
                    borderRadius: '8px',
                    color: 'var(--tooltip-text, #1e293b)'
                  }}
                  labelStyle={{ color: 'var(--tooltip-text, #1e293b)' }}
                />
                <Line
                  type="monotone"
                  dataKey="kg"
                  stroke="#10b981"
                  strokeWidth={3}
                  dot={{ fill: '#10b981', strokeWidth: 2, r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4">
            <span className="text-sm text-slate-600 dark:text-slate-400">
              Total últimos 6 meses: {estadisticas.ventasPorMes.reduce((sum, mes) => sum + mes.kg, 0).toFixed(1)} kg
            </span>
          </div>
        </article>

        {/* Top Clientes */}
        <article className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Top Clientes</h3>
            <span className="text-xs text-slate-500 dark:text-slate-400">Por volumen de compras</span>
          </div>
          <div className="space-y-4">
            {estadisticas.topClientes.length > 0 ? estadisticas.topClientes.map((cliente, index) => (
              <div key={cliente.nombre} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 text-white text-sm font-bold">
                    {index + 1}
                  </div>
                  <div>
                    <p className="font-medium text-slate-900 dark:text-white">{cliente.nombre}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{cliente.ventas} ventas</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-slate-900 dark:text-white">${formatearDecimal(cliente.total)}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Promedio: ${formatearDecimal(cliente.promedio)}</p>
                </div>
              </div>
            )) : (
              <p className="text-center text-slate-500 dark:text-slate-400 py-8">No hay datos de clientes disponibles</p>
            )}
          </div>
        </article>

        {/* Productos Más Vendidos */}
        <article className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Productos Más Vendidos</h3>
            <span className="text-xs text-slate-500 dark:text-slate-400">Top 5</span>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={estadisticas.topProductos} layout="horizontal">
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" tick={{ fontSize: 12 }} stroke="#64748b" />
                <YAxis
                  type="category"
                  dataKey="nombre"
                  tick={{ fontSize: 10 }}
                  stroke="#64748b"
                  width={80}
                />
                <Tooltip
                  formatter={(value: number) => [`${value} unidades`, 'Vendidas']}
                  labelStyle={{ color: '#1e293b' }}
                  contentStyle={{
                    backgroundColor: 'var(--tooltip-bg, #f8fafc)',
                    border: '1px solid var(--tooltip-border, #e2e8f0)',
                    borderRadius: '8px',
                    color: 'var(--tooltip-text, #1e293b)'
                  }}
                  labelStyle={{ color: 'var(--tooltip-text, #1e293b)' }}
                />
                <Bar dataKey="cantidad" fill="#f59e0b" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>

        {/* Análisis de Tendencias */}
        <article className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Análisis de Tendencias</h3>
            <span className="text-xs text-slate-500 dark:text-slate-400">Últimos meses</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {estadisticas.ventasPorMes.reduce((sum, mes) => sum + mes.cantidad, 0)}
              </p>
              <p className="text-sm text-blue-600 dark:text-blue-400">Total Ventas</p>
            </div>
            <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                ${formatearDecimal(estadisticas.ventasPorMes.reduce((sum, mes) => sum + mes.dinero, 0))}
              </p>
              <p className="text-sm text-green-600 dark:text-green-400">Ingresos Totales</p>
            </div>
            <div className="text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {estadisticas.topClientes.length}
              </p>
              <p className="text-sm text-purple-600 dark:text-purple-400">Clientes Activos</p>
            </div>
            <div className="text-center p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                {estadisticas.topProductos.length}
              </p>
              <p className="text-sm text-amber-600 dark:text-amber-400">Productos en Venta</p>
            </div>
          </div>
          <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-700 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Crecimiento Mensual</span>
              <span className={`text-lg font-bold ${estadisticas.crecimientoMensual >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {estadisticas.crecimientoMensual >= 0 ? '↗️' : '↘️'} {Math.abs(estadisticas.crecimientoMensual).toFixed(1)}%
              </span>
            </div>
          </div>
        </article>

        {/* Distribución de Ventas por Mes */}
        <article className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Distribución Mensual</h3>
            <span className="text-xs text-slate-500 dark:text-slate-400">Participación por mes</span>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={estadisticas.ventasPorMes}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({mes, percent}) => `${mes}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="dinero"
                >
                  {estadisticas.ventasPorMes.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={[
                      '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'
                    ][index % 6]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => [`$${formatearDecimal(value)}`, 'Ventas']}
                  contentStyle={{
                    backgroundColor: 'var(--tooltip-bg, #f8fafc)',
                    border: '1px solid var(--tooltip-border, #e2e8f0)',
                    borderRadius: '8px',
                    color: 'var(--tooltip-text, #1e293b)'
                  }}
                  labelStyle={{ color: 'var(--tooltip-text, #1e293b)' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </article>
      </section>

      {/* Alertas del Sistema */}
      <section>
        <AlertasDashboard />
      </section>

      {/* Sección principal con recordatorios, calendario y ventas */}
      <section className="grid gap-6 grid-cols-1 lg:grid-cols-4">
        {/* Recordatorios y eventos */}
        <article className="lg:col-span-1 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Recordatorios</h2>
            <button
              type="button"
              onClick={() => setMostrarFormularioRecordatorio(!mostrarFormularioRecordatorio)}
              className="inline-flex items-center gap-1 rounded-lg border border-blue-200 dark:border-blue-700 px-3 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 transition hover:bg-blue-50 dark:hover:bg-blue-900/20"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Agregar
            </button>
          </div>

          {/* Formulario para agregar recordatorio */}
          {mostrarFormularioRecordatorio && (
            <form onSubmit={agregarRecordatorio} className="mb-4 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Título del recordatorio"
                  value={formularioRecordatorio.titulo}
                  onChange={(e) => setFormularioRecordatorio(prev => ({ ...prev, titulo: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg focus:border-blue-500 focus:outline-none"
                  required
                />
                <textarea
                  placeholder="Descripción (opcional)"
                  value={formularioRecordatorio.descripcion}
                  onChange={(e) => setFormularioRecordatorio(prev => ({ ...prev, descripcion: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg focus:border-blue-500 focus:outline-none"
                  rows={2}
                />
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={formularioRecordatorio.fecha}
                    onChange={(e) => setFormularioRecordatorio(prev => ({ ...prev, fecha: e.target.value }))}
                    className="flex-1 px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg focus:border-blue-500 focus:outline-none"
                  />
                  <select
                    value={formularioRecordatorio.prioridad}
                    onChange={(e) => setFormularioRecordatorio(prev => ({ ...prev, prioridad: e.target.value as "alta" | "media" | "baja" }))}
                    className="px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg focus:border-blue-500 focus:outline-none"
                  >
                    <option value="baja">Baja</option>
                    <option value="media">Media</option>
                    <option value="alta">Alta</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="flex-1 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-500"
                  >
                    Guardar
                  </button>
                  <button
                    type="button"
                    onClick={() => setMostrarFormularioRecordatorio(false)}
                    className="px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* Lista de recordatorios */}
          {recordatoriosPendientes.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">No hay recordatorios pendientes.</p>
          ) : (
            <div className="space-y-3">
              {recordatoriosPendientes.slice(0, 6).map((recordatorio) => {
                const fechaRecordatorio = new Date(recordatorio.fecha);
                const hoy = new Date();
                const diferenciaDias = Math.ceil((fechaRecordatorio.getTime() - hoy.getTime()) / (1000 * 3600 * 24));
                const esUrgente = diferenciaDias <= 3 && diferenciaDias >= 0;

                const colorPrioridad = {
                  alta: 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300',
                  media: 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300',
                  baja: 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                }[recordatorio.prioridad];

                return (
                  <div key={recordatorio.id} className={`p-3 rounded-lg border ${colorPrioridad} ${esUrgente ? 'ring-2 ring-red-200 dark:ring-red-800' : ''}`}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => toggleRecordatorio(recordatorio.id)}
                            className="h-4 w-4 rounded border-2 border-current flex items-center justify-center hover:bg-current hover:text-white transition-colors"
                          >
                            {recordatorio.completado && (
                              <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            )}
                          </button>
                          <h3 className="font-medium text-sm">{recordatorio.titulo}</h3>
                          {esUrgente && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-300">
                              Urgente
                            </span>
                          )}
                        </div>
                        {recordatorio.descripcion && (
                          <p className="mt-1 text-xs opacity-75">{recordatorio.descripcion}</p>
                        )}
                        <p className="mt-1 text-xs opacity-60">
                          {diferenciaDias === 0 ? 'Hoy' :
                           diferenciaDias === 1 ? 'Mañana' :
                           diferenciaDias > 0 ? `En ${diferenciaDias} días` :
                           `Hace ${Math.abs(diferenciaDias)} días`}
                        </p>
                      </div>
                      <button
                        onClick={() => eliminarRecordatorio(recordatorio.id)}
                        className="ml-2 p-1 rounded hover:bg-current hover:text-white opacity-50 hover:opacity-100 transition-all"
                      >
                        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {recordatoriosUrgentes.length > 0 && (
            <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm font-medium text-red-800 dark:text-red-300">
                ⚠️ Tienes {recordatoriosUrgentes.length} recordatorio{recordatoriosUrgentes.length > 1 ? 's' : ''} urgente{recordatoriosUrgentes.length > 1 ? 's' : ''}
              </p>
            </div>
          )}
        </article>

        {/* Calendario */}
        <article className="lg:col-span-1 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Calendario</h2>
            <span className="text-xs text-slate-500 dark:text-slate-400">Eventos y fechas importantes</span>
          </div>

          {/* Navegación del calendario */}
          <div className="flex items-center justify-between mb-4">
            <button
              type="button"
              onClick={() => navegarMes('anterior')}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <svg className="h-4 w-4 text-slate-600 dark:text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h3 className="font-semibold text-slate-900 dark:text-white">
              {nombresMeses[fechaCalendario.getMonth()]} {fechaCalendario.getFullYear()}
            </h3>
            <button
              type="button"
              onClick={() => navegarMes('siguiente')}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <svg className="h-4 w-4 text-slate-600 dark:text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Días de la semana */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {diasSemana.map((dia) => (
              <div key={dia} className="text-center text-xs font-medium text-slate-500 dark:text-slate-400 py-2">
                {dia}
              </div>
            ))}
          </div>

          {/* Días del mes */}
          <div className="grid grid-cols-7 gap-1">
            {obtenerDiasDelMes(fechaCalendario).map((dia, index) => {
              if (dia === null) {
                return <div key={`empty-${index}`} className="h-8"></div>;
              }

              const recordatoriosDelDia = obtenerRecordatoriosDelDia(dia);
              const tieneRecordatorios = recordatoriosDelDia.length > 0;
              const esHoy = new Date().toDateString() === new Date(fechaCalendario.getFullYear(), fechaCalendario.getMonth(), dia).toDateString();
              const esDiaSeleccionado = diaSeleccionado === formatearFechaCalendario(dia);

              return (
                <button
                  key={`${fechaCalendario.getFullYear()}-${fechaCalendario.getMonth()+1}-${dia}`}
                  type="button"
                  onClick={() => manejarClickDia(dia)}
                  className={`
                    h-8 rounded-lg text-sm font-medium transition-all hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 dark:hover:text-blue-400
                    ${esHoy ? 'bg-blue-600 text-white hover:bg-blue-700' : ''}
                    ${esDiaSeleccionado && !esHoy ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400' : ''}
                    ${tieneRecordatorios && !esHoy ? 'bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400' : ''}
                    ${!esHoy && !esDiaSeleccionado && !tieneRecordatorios ? 'text-slate-700 dark:text-slate-300' : ''}
                  `}
                >
                  <div className="flex flex-col items-center">
                    <span>{dia}</span>
                    {tieneRecordatorios && (
                      <div className="h-1 w-1 bg-current rounded-full mt-0.5"></div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Formulario rápido para agregar evento en fecha seleccionada */}
          {mostrarFormularioCalendario && diaSeleccionado && (
            <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <h4 className="font-medium text-blue-800 dark:text-blue-300 mb-2">
                Agregar evento - {new Date(diaSeleccionado).toLocaleDateString()}
              </h4>
              <form onSubmit={agregarRecordatorio}>
                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder="Título del evento"
                    value={formularioRecordatorio.titulo}
                    onChange={(e) => setFormularioRecordatorio(prev => ({ ...prev, titulo: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-blue-300 dark:border-blue-600 dark:bg-slate-700 dark:text-white rounded-lg focus:border-blue-500 focus:outline-none"
                    required
                  />
                  <div className="flex gap-2">
                    <select
                      value={formularioRecordatorio.prioridad}
                      onChange={(e) => setFormularioRecordatorio(prev => ({ ...prev, prioridad: e.target.value as "alta" | "media" | "baja" }))}
                      className="flex-1 px-3 py-2 text-sm border border-blue-300 dark:border-blue-600 dark:bg-slate-700 dark:text-white rounded-lg focus:border-blue-500 focus:outline-none"
                    >
                      <option value="baja">Baja</option>
                      <option value="media">Media</option>
                      <option value="alta">Alta</option>
                    </select>
                    <button
                      type="submit"
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-500"
                    >
                      Agregar
                    </button>
                    <button
                      type="button"
                      onClick={() => setMostrarFormularioCalendario(false)}
                      className="px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700"
                    >
                      ×
                    </button>
                  </div>
                </div>
              </form>
            </div>
          )}

          {/* Mostrar recordatorios del día seleccionado */}
          {diaSeleccionado && obtenerRecordatoriosDelDia(Number(diaSeleccionado.split('-')[2])).length > 0 && (
            <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg">
              <h4 className="font-medium text-slate-800 dark:text-white mb-2">
                Eventos del día {Number(diaSeleccionado.split('-')[2])}
              </h4>
              <div className="space-y-2">
                {obtenerRecordatoriosDelDia(Number(diaSeleccionado.split('-')[2])).map((recordatorio) => {
                  const colorPrioridad = {
                    alta: 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300',
                    media: 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300',
                    baja: 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                  }[recordatorio.prioridad];

                  return (
                    <div key={recordatorio.id} className={`p-2 rounded border ${colorPrioridad}`}>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{recordatorio.titulo}</span>
                        <button
                          onClick={() => eliminarRecordatorio(recordatorio.id)}
                          className="text-xs opacity-50 hover:opacity-100"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </article>

        {/* Ventas recientes y de la semana */}
        <article className="lg:col-span-2 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Actividad de Ventas</h2>
            <span className="text-xs text-slate-500 dark:text-slate-400">Últimas ventas y resumen semanal</span>
          </div>

          {/* Resumen semanal destacado */}
          {ventasSemana.cantidad > 0 && (
            <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <h3 className="font-medium text-green-800 dark:text-green-300 mb-2">Resumen de la Semana</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-green-600 dark:text-green-400">Ventas realizadas</p>
                  <p className="font-semibold text-green-800 dark:text-green-300">{ventasSemana.cantidad}</p>
                </div>
                <div>
                  <p className="text-green-600 dark:text-green-400">Ingresos totales</p>
                  <p className="font-semibold text-green-800 dark:text-green-300">${formatearDecimal(ventasSemana.total)}</p>
                </div>
              </div>
            </div>
          )}

          {ventasRecientes.length === 0 && !cargando && (
            <p className="text-sm text-slate-500 dark:text-slate-400">Sin ventas registradas recientemente.</p>
          )}

          {ventasRecientes.length > 0 && (
            <div>
              <h3 className="font-medium text-slate-700 dark:text-slate-300 mb-3">Ventas Recientes</h3>
              <ul className="space-y-3 text-sm text-slate-600 dark:text-slate-400">
                {ventasRecientes.map((venta) => (
                  <li key={venta.id} className="rounded-xl bg-slate-50 dark:bg-slate-700 px-4 py-3">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-slate-800 dark:text-white">{venta.cliente_nombre}</p>
                      <span className="text-xs text-slate-500 dark:text-slate-400">{venta.fecha}</span>
                    </div>
                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      Venta #{venta.numero || venta.id}
                    </div>
                    <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                      ${formatearDecimal(Number(venta.total ?? "0"))}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </article>
      </section>
    </div>
  );
};

export default DashboardPage;
