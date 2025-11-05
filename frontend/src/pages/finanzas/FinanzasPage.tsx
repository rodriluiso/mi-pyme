import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useListado } from "@/hooks/useListado";
import { useApi } from "@/hooks/useApi";
import type { ApiError } from "@/lib/api/types";
import type {
  Cliente,
  MovimientoFinanciero,
  PagoCliente,
  ResumenPendiente,
  ResumenPorMedioResponse,
  ComparativasPeriodoResponse,
  ResumenCuentasPagar,
  Venta
} from "@/types/mipyme";

const formatearDecimal = (valor: string | null | undefined) => {
  const numero = Number(valor ?? "0");
  if (Number.isNaN(numero)) {
    return "0";
  }
  return numero.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatearVariacion = (variacion: number) => {
  if (!isFinite(variacion)) return "N/A";
  const signo = variacion >= 0 ? "+" : "";
  return `${signo}${variacion.toFixed(1)}%`;
};

const getVariacionColor = (variacion: number) => {
  if (!isFinite(variacion)) return "text-slate-500";
  return variacion >= 0
    ? "text-green-600 dark:text-green-400"
    : "text-red-600 dark:text-red-400";
};

const mediosPago = [
  { value: "EFECTIVO", label: "Efectivo" },
  { value: "TRANSFERENCIA", label: "Transferencia" },
  { value: "CHEQUE", label: "Cheque" }
];

const tiposGasto = [
  { value: "SERVICIO", label: "Servicio" },
  { value: "GASTOS_VARIOS", label: "Gastos varios" },
  { value: "IMPUESTO", label: "Impuesto" }
];

type FormularioPago = {
  cliente: string;
  venta: string;
  monto: string;
  medio: string;
  observacion: string;
  fecha: string;
};

const estadoInicialPago: FormularioPago = {
  cliente: "",
  venta: "",
  monto: "",
  medio: "EFECTIVO",
  observacion: "",
  fecha: new Date().toISOString().slice(0, 10)
};

type FormularioGasto = {
  tipo: string;
  monto: string;
  medio: string;
  observacion: string;
  fecha: string;
};

const estadoInicialGasto: FormularioGasto = {
  tipo: "SERVICIO",
  monto: "",
  medio: "EFECTIVO",
  observacion: "",
  fecha: new Date().toISOString().slice(0, 10)
};

type FiltrosGasto = {
  desde: string;
  hasta: string;
};

const estadoInicialFiltrosGasto: FiltrosGasto = { desde: "", hasta: "" };

type RangoTiempo = {
  desde: string;
  hasta: string;
  etiqueta: string;
};

const obtenerRangosPredef = (): RangoTiempo[] => {
  const hoy = new Date();
  const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  const ultimoDiaMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
  const primerDiaAnio = new Date(hoy.getFullYear(), 0, 1);
  const ultimoDiaAnio = new Date(hoy.getFullYear(), 11, 31);
  const hace30Dias = new Date(hoy);
  hace30Dias.setDate(hoy.getDate() - 30);
  const hace7Dias = new Date(hoy);
  hace7Dias.setDate(hoy.getDate() - 7);

  return [
    {
      desde: "",
      hasta: "",
      etiqueta: "Todo el tiempo"
    },
    {
      desde: hace7Dias.toISOString().slice(0, 10),
      hasta: hoy.toISOString().slice(0, 10),
      etiqueta: "Esta semana"
    },
    {
      desde: hace30Dias.toISOString().slice(0, 10),
      hasta: hoy.toISOString().slice(0, 10),
      etiqueta: "Últimos 30 días"
    },
    {
      desde: primerDiaMes.toISOString().slice(0, 10),
      hasta: ultimoDiaMes.toISOString().slice(0, 10),
      etiqueta: "Este mes"
    },
    {
      desde: primerDiaAnio.toISOString().slice(0, 10),
      hasta: ultimoDiaAnio.toISOString().slice(0, 10),
      etiqueta: "Este año"
    }
  ];
};

const FinanzasPage = () => {
  const { datos: clientesData } = useListado<Cliente>("/clientes/");
  const { datos: ventasData } = useListado<Venta>("/ventas/");
  const clientes = Array.isArray(clientesData) ? clientesData : [];
  const ventas = Array.isArray(ventasData) ? ventasData : [];
  const { datos: pagosData, cargando: cargandoPagos, error: errorPagos, recargar: recargarPagos } =
    useListado<PagoCliente>("/finanzas/pagos/");
  const {
    datos: movimientosData,
    cargando: cargandoMovimientos,
    error: errorMovimientos,
    recargar: recargarMovimientos
  } = useListado<MovimientoFinanciero>("/finanzas/movimientos/efectivo-real/");

  const pagos = Array.isArray(pagosData) ? pagosData : [];
  const movimientos = Array.isArray(movimientosData) ? movimientosData : [];

  const [parametrosGastos, setParametrosGastos] = useState<FiltrosGasto>(estadoInicialFiltrosGasto);
  const gastosEndpoint = useMemo(() => {
    const params = new URLSearchParams();
    if (parametrosGastos.desde) {
      params.append("fecha__gte", parametrosGastos.desde);
    }
    if (parametrosGastos.hasta) {
      params.append("fecha__lte", parametrosGastos.hasta);
    }
    const query = params.toString();
    return `/finanzas/movimientos/gastos/${query ? `?${query}` : ""}`;
  }, [parametrosGastos]);

  const {
    datos: gastos,
    cargando: cargandoGastos,
    error: errorGastos,
    recargar: recargarGastos
  } = useListado<MovimientoFinanciero>(gastosEndpoint);

  const { request } = useApi();
  const [resumen, setResumen] = useState<ResumenPendiente | null>(null);
  const [errorResumen, setErrorResumen] = useState<ApiError | null>(null);
  const [cargandoResumen, setCargandoResumen] = useState<boolean>(true);

  const [resumenCuentasPagar, setResumenCuentasPagar] = useState<ResumenCuentasPagar | null>(null);
  const [errorCuentasPagar, setErrorCuentasPagar] = useState<ApiError | null>(null);
  const [cargandoCuentasPagar, setCargandoCuentasPagar] = useState<boolean>(true);

  const [resumenPorMedio, setResumenPorMedio] = useState<ResumenPorMedioResponse | null>(null);
  const [errorResumenPorMedio, setErrorResumenPorMedio] = useState<ApiError | null>(null);
  const [cargandoResumenPorMedio, setCargandoResumenPorMedio] = useState<boolean>(false);
  const [mostrarResumenPorMedio, setMostrarResumenPorMedio] = useState<boolean>(false);

  const [comparativas, setComparativas] = useState<ComparativasPeriodoResponse | null>(null);
  const [errorComparativas, setErrorComparativas] = useState<ApiError | null>(null);
  const [cargandoComparativas, setCargandoComparativas] = useState<boolean>(false);
  const [mostrarComparativas, setMostrarComparativas] = useState<boolean>(false);
  const [tipoComparacion, setTipoComparacion] = useState<'mes_anterior' | 'año_anterior' | 'trimestre_anterior'>('mes_anterior');

  const [formularioPago, setFormularioPago] = useState<FormularioPago>(estadoInicialPago);
  const [formularioGasto, setFormularioGasto] = useState<FormularioGasto>(estadoInicialGasto);
  const [filtrosGasto, setFiltrosGasto] = useState<FiltrosGasto>(estadoInicialFiltrosGasto);
  const [enviandoPago, setEnviandoPago] = useState(false);
  const [enviandoGasto, setEnviandoGasto] = useState(false);
  const [mensajeExitoPago, setMensajeExitoPago] = useState<string | null>(null);
  const [mensajeErrorPago, setMensajeErrorPago] = useState<string | null>(null);
  const [mensajeExitoGasto, setMensajeExitoGasto] = useState<string | null>(null);
  const [mensajeErrorGasto, setMensajeErrorGasto] = useState<string | null>(null);
  const [rangoIndicadores, setRangoIndicadores] = useState<RangoTiempo>(obtenerRangosPredef()[0]);

  const clientesOrdenados = useMemo(() => {
    return [...clientes].sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [clientes]);

  const cargarResumen = async (rango?: RangoTiempo) => {
    setCargandoResumen(true);
    setErrorResumen(null);
    try {
      const rangoActual = rango || rangoIndicadores;
      const params = new URLSearchParams();
      if (rangoActual.desde) {
        params.append("fecha_desde", rangoActual.desde);
      }
      if (rangoActual.hasta) {
        params.append("fecha_hasta", rangoActual.hasta);
      }
      const query = params.toString();
      const url = `/finanzas/movimientos/resumen/pendiente/${query ? `?${query}` : ""}`;

      const respuesta = await request<ResumenPendiente>({
        method: "GET",
        url
      });
      setResumen(respuesta);
    } catch (err) {
      setErrorResumen(err as ApiError);
    } finally {
      setCargandoResumen(false);
    }
  };

  const cargarCuentasPagar = async () => {
    setCargandoCuentasPagar(true);
    setErrorCuentasPagar(null);
    try {
      const respuesta = await request<ResumenCuentasPagar>({
        method: "GET",
        url: "/finanzas/movimientos/resumen-cuentas-pagar/"
      });
      setResumenCuentasPagar(respuesta);
    } catch (err) {
      setErrorCuentasPagar(err as ApiError);
    } finally {
      setCargandoCuentasPagar(false);
    }
  };

  useEffect(() => {
    void cargarResumen();
    void cargarCuentasPagar();
  }, []);

  // Filtrar ventas del cliente seleccionado para el pago
  const ventasDelCliente = useMemo(() => {
    if (!formularioPago.cliente) return [];
    return ventas.filter(venta => String(venta.cliente) === formularioPago.cliente);
  }, [ventas, formularioPago.cliente]);

  const cambiarRangoIndicadores = async (nuevoRango: RangoTiempo) => {
    setRangoIndicadores(nuevoRango);
    await cargarResumen(nuevoRango);
  };

  const cargarResumenPorMedio = async () => {
    setCargandoResumenPorMedio(true);
    setErrorResumenPorMedio(null);
    try {
      const params = new URLSearchParams();
      if (rangoIndicadores.desde) {
        params.append("fecha_desde", rangoIndicadores.desde);
      }
      if (rangoIndicadores.hasta) {
        params.append("fecha_hasta", rangoIndicadores.hasta);
      }
      const query = params.toString();
      const url = `/finanzas/movimientos/resumen/por-medio/${query ? `?${query}` : ""}`;

      const respuesta = await request<ResumenPorMedioResponse>({
        method: "GET",
        url
      });
      setResumenPorMedio(respuesta);
    } catch (err) {
      setErrorResumenPorMedio(err as ApiError);
    } finally {
      setCargandoResumenPorMedio(false);
    }
  };

  const toggleResumenPorMedio = async () => {
    if (!mostrarResumenPorMedio && !resumenPorMedio) {
      await cargarResumenPorMedio();
    }
    setMostrarResumenPorMedio(!mostrarResumenPorMedio);
  };

  const cargarComparativas = async () => {
    setCargandoComparativas(true);
    setErrorComparativas(null);
    try {
      const params = new URLSearchParams();
      params.append("fecha_inicio", rangoIndicadores.desde || new Date().toISOString().slice(0, 10));
      params.append("fecha_fin", rangoIndicadores.hasta || new Date().toISOString().slice(0, 10));
      params.append("tipo", tipoComparacion);

      const url = `/finanzas/movimientos/comparativas/periodo/?${params.toString()}`;

      const respuesta = await request<ComparativasPeriodoResponse>({
        method: "GET",
        url
      });
      setComparativas(respuesta);
    } catch (err) {
      setErrorComparativas(err as ApiError);
    } finally {
      setCargandoComparativas(false);
    }
  };

  const toggleComparativas = async () => {
    if (!mostrarComparativas && !comparativas) {
      await cargarComparativas();
    }
    setMostrarComparativas(!mostrarComparativas);
  };

  const cambiarTipoComparacion = async (nuevoTipo: 'mes_anterior' | 'año_anterior' | 'trimestre_anterior') => {
    setTipoComparacion(nuevoTipo);
    if (mostrarComparativas) {
      await cargarComparativas();
    }
  };

  const recargarTodo = async () => {
    await Promise.all([recargarPagos(), recargarGastos(), recargarMovimientos(), cargarResumen(), cargarCuentasPagar()]);
  };

  const actualizarCampoPago = (campo: keyof FormularioPago, valor: string) => {
    setFormularioPago((anterior) => ({ ...anterior, [campo]: valor }));
  };

  const actualizarCampoGasto = (campo: keyof FormularioGasto, valor: string) => {
    setFormularioGasto((anterior) => ({ ...anterior, [campo]: valor }));
  };

  const limpiarMensajesPago = () => {
    setMensajeErrorPago(null);
    setMensajeExitoPago(null);
  };

  const limpiarMensajesGasto = () => {
    setMensajeErrorGasto(null);
    setMensajeExitoGasto(null);
  };

  const manejarRegistroPago = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    limpiarMensajesPago();

    if (!formularioPago.cliente) {
      setMensajeErrorPago("Selecciona un cliente");
      return;
    }
    if (!formularioPago.monto) {
      setMensajeErrorPago("Ingresa un monto valido");
      return;
    }

    setEnviandoPago(true);
    try {
      await request<PagoCliente>({
        method: "POST",
        url: "/finanzas/pagos/",
        data: {
          cliente: Number(formularioPago.cliente),
          venta: formularioPago.venta ? Number(formularioPago.venta) : null,
          monto: formularioPago.monto,
          medio: formularioPago.medio,
          observacion: formularioPago.observacion.trim() || undefined,
          fecha: formularioPago.fecha || undefined
        }
      });
      setMensajeExitoPago("Pago registrado correctamente");
      setFormularioPago(estadoInicialPago);
      await Promise.all([recargarPagos(), cargarResumen()]);
    } catch (err) {
      const apiError = err as ApiError;
      let detalle = apiError.message || "No se pudo registrar el pago";
      if (apiError.data && typeof apiError.data === "object") {
        const errores = Object.values(apiError.data as Record<string, unknown>).flat();
        if (errores.length > 0) {
          detalle = String(errores[0]);
        }
      }
      setMensajeErrorPago(detalle);
    } finally {
      setEnviandoPago(false);
    }
  };

  const manejarRegistroGasto = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    limpiarMensajesGasto();

    if (!formularioGasto.monto) {
      setMensajeErrorGasto("Ingresa un monto valido");
      return;
    }
    if (!formularioGasto.medio) {
      setMensajeErrorGasto("Selecciona un medio de pago");
      return;
    }

    setEnviandoGasto(true);
    try {
      await request<MovimientoFinanciero>({
        method: "POST",
        url: "/finanzas/movimientos/registrar-gasto/",
        data: {
          tipo: formularioGasto.tipo,
          monto: formularioGasto.monto,
          medio_pago: formularioGasto.medio,
          observacion: formularioGasto.observacion.trim() || undefined,
          fecha: formularioGasto.fecha || undefined
        }
      });
      setMensajeExitoGasto("Gasto registrado correctamente");
      setFormularioGasto(estadoInicialGasto);
      await Promise.all([recargarGastos(), cargarResumen()]);
    } catch (err) {
      const apiError = err as ApiError;
      let detalle = apiError.message || "No se pudo registrar el gasto";
      if (apiError.data && typeof apiError.data === "object") {
        const errores = Object.values(apiError.data as Record<string, unknown>).flat();
        if (errores.length > 0) {
          detalle = String(errores[0]);
        }
      }
      setMensajeErrorGasto(detalle);
    } finally {
      setEnviandoGasto(false);
    }
  };

  const manejarCambioFiltroGasto = (campo: keyof FiltrosGasto, valor: string) => {
    setFiltrosGasto((anterior) => ({ ...anterior, [campo]: valor }));
  };

  const aplicarFiltroGastos = (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    setParametrosGastos({ ...filtrosGasto });
  };

  const limpiarFiltroGastos = () => {
    setFiltrosGasto(estadoInicialFiltrosGasto);
    setParametrosGastos(estadoInicialFiltrosGasto);
  };

  const totalVentas = resumen?.total_ventas ?? "0";
  const totalVentasSinIva = resumen?.total_ventas_sin_iva ?? "0";
  const ivaVentas = resumen?.iva_ventas ?? "0";
  const totalPagos = resumen?.total_pagos ?? "0";
  const totalCompras = resumen?.total_compras ?? "0";
  const totalGastos = resumen?.total_gastos ?? "0";
  const pendienteCobro = resumen?.pendiente_cobro ?? "0";

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Finanzas</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Consulta pagos recibidos, movimientos financieros y registra gastos operativos.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void recargarTodo()}
            className="inline-flex items-center rounded-full border border-slate-200 px-4 py-1 text-sm font-medium text-slate-600 dark:text-slate-400 transition hover:border-blue-200 hover:text-blue-600"
          >
            Recargar datos
          </button>
        </div>
      </header>

      {/* Selector de rango de tiempo para indicadores */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Período de indicadores</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Selecciona el rango de tiempo para calcular los indicadores financieros
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="flex flex-wrap gap-2">
              {obtenerRangosPredef().map((rango) => (
                <button
                  key={rango.etiqueta}
                  onClick={() => void cambiarRangoIndicadores(rango)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                    rangoIndicadores.etiqueta === rango.etiqueta
                      ? "bg-blue-600 text-white"
                      : "border border-slate-300 text-slate-600 dark:text-slate-400 hover:border-blue-200 hover:text-blue-600"
                  }`}
                  disabled={cargandoResumen}
                >
                  {rango.etiqueta}
                </button>
              ))}
            </div>
            {rangoIndicadores.desde && rangoIndicadores.hasta && (
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {new Date(rangoIndicadores.desde).toLocaleDateString()} - {new Date(rangoIndicadores.hasta).toLocaleDateString()}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <article className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400">Total de ventas</h2>
          <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
            ${cargandoResumen ? "Calculando..." : formatearDecimal(totalVentas)}
          </p>
        </article>
        <article className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400">Pagos recibidos</h2>
          <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
            ${cargandoResumen ? "Calculando..." : formatearDecimal(totalPagos)}
          </p>
        </article>
        <article className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400">Compras</h2>
          <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
            ${cargandoResumen ? "Calculando..." : formatearDecimal(totalCompras)}
          </p>
        </article>
        <article className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400">Gastos</h2>
          <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
            ${cargandoResumen ? "Calculando..." : formatearDecimal(totalGastos)}
          </p>
        </article>
        <article className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400">Pendiente de cobro</h2>
          {cargandoResumen && <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Calculando...</p>}
          {!cargandoResumen && (
            <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
              ${formatearDecimal(pendienteCobro)}
            </p>
          )}
          {errorResumen && (
            <p className="mt-2 text-xs text-red-600">
              No fue posible obtener el resumen. {errorResumen.message || "Error"}
            </p>
          )}
        </article>

        {/* Indicador de IVA Pendiente AFIP */}
        <article className="rounded-xl border border-orange-200 dark:border-orange-700 bg-orange-50 dark:bg-orange-900/20 p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-orange-600 dark:text-orange-400">IVA pendiente AFIP</h2>
          {cargandoResumen && <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Calculando...</p>}
          {!cargandoResumen && (
            <div>
              <p className="mt-2 text-2xl font-semibold text-orange-700 dark:text-orange-300">
                ${formatearDecimal(ivaVentas)}
              </p>
              <p className="mt-1 text-xs text-orange-600 dark:text-orange-400">
                Impuesto a pagar (no es ingreso)
              </p>
            </div>
          )}
          {errorResumen && (
            <p className="mt-2 text-xs text-red-600">
              No disponible
            </p>
          )}
        </article>

        {/* Indicador de Pendiente de Pago (Deuda con proveedores) */}
        <article className="rounded-xl border border-red-200 dark:border-red-700 bg-red-50 dark:bg-red-900/20 p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-red-600 dark:text-red-400">Pendiente de pago</h2>
          {cargandoCuentasPagar && <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Calculando...</p>}
          {!cargandoCuentasPagar && resumenCuentasPagar && (
            <p className="mt-2 text-2xl font-semibold text-red-700 dark:text-red-300">
              ${formatearDecimal(resumenCuentasPagar.resumen_general.total_pendiente_pagar)}
            </p>
          )}
          {errorCuentasPagar && (
            <p className="mt-2 text-xs text-red-600">
              No fue posible obtener las cuentas. {errorCuentasPagar.message || "Error"}
            </p>
          )}
        </article>

        {/* Indicador de Balance */}
        <article className={`rounded-xl border p-5 shadow-sm ${
          !cargandoResumen && resumen?.balance
            ? resumen.balance.es_positivo
              ? "border-green-200 bg-green-50 dark:border-green-700 dark:bg-green-900/20"
              : "border-red-200 bg-red-50 dark:border-red-700 dark:bg-red-900/20"
            : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
        }`}>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400">Balance Neto</h2>
            {!cargandoResumen && resumen?.balance && (
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                resumen.balance.es_positivo
                  ? "bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100"
                  : "bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100"
              }`}>
                {resumen.balance.estado.toUpperCase()}
              </span>
            )}
          </div>

          {cargandoResumen && <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Calculando...</p>}

          {!cargandoResumen && resumen?.balance && (
            <div className="mt-2">
              <p className={`text-2xl font-semibold ${
                resumen.balance.es_positivo
                  ? "text-green-700 dark:text-green-300"
                  : "text-red-700 dark:text-red-300"
              }`}>
                {resumen.balance.es_positivo ? "+" : ""}${formatearDecimal(resumen.balance.balance_neto)}
              </p>
              <div className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                <p>Ingresos: ${formatearDecimal(resumen.balance.total_ingresos)}</p>
                <p>Egresos: ${formatearDecimal(resumen.balance.total_egresos)}</p>
                <p className="font-medium">Margen: {resumen.balance.margen_porcentaje.toFixed(1)}%</p>
              </div>
            </div>
          )}

          {errorResumen && (
            <p className="mt-2 text-xs text-red-600">
              No fue posible calcular el balance. {errorResumen.message || "Error"}
            </p>
          )}
        </article>

        {/* Indicador de Dinero por Medio */}
        <article className="md:col-span-2 xl:col-span-3 2xl:col-span-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-600 dark:text-slate-400">Dinero por medio de pago</h2>
            <button
              onClick={toggleResumenPorMedio}
              disabled={cargandoResumenPorMedio}
              className="inline-flex items-center gap-1 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-2 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 transition hover:bg-slate-50 dark:hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {mostrarResumenPorMedio ? "Ocultar" : "Ver desglose"}
              <svg
                className={`h-3 w-3 transition-transform ${mostrarResumenPorMedio ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>

          {cargandoResumenPorMedio && (
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Cargando desglose...</p>
          )}

          {errorResumenPorMedio && (
            <p className="mt-2 text-xs text-red-600">
              No fue posible cargar el desglose. {errorResumenPorMedio.message || "Error"}
            </p>
          )}

          {mostrarResumenPorMedio && resumenPorMedio && (
            <div className="mt-4 space-y-3">
              {/* Layout compacto y simple */}
              {resumenPorMedio.por_medio.map((medio) => (
                <div
                  key={medio.medio}
                  className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 p-3"
                >
                  <div className="flex items-center gap-6">
                    <div className="text-sm font-medium text-slate-700 dark:text-slate-300 min-w-[160px]">
                      {medio.medio_display}
                    </div>
                    <div className="text-sm text-slate-600 dark:text-slate-400 flex-1">
                      <span className="text-green-600 dark:text-green-400 font-medium">
                        ↗ Ingresos: ${formatearDecimal(medio.ingresos)}
                      </span>
                      <span className="mx-4">•</span>
                      <span className="text-red-600 dark:text-red-400 font-medium">
                        ↙ Egresos: ${formatearDecimal(medio.egresos)}
                      </span>
                    </div>
                  </div>
                  <div className={`text-right min-w-[120px] ${
                    medio.es_positivo
                      ? "text-green-700 dark:text-green-300"
                      : "text-red-700 dark:text-red-300"
                  }`}>
                    <div className="text-xl font-bold">
                      {medio.es_positivo ? "+" : ""}${formatearDecimal(medio.neto)}
                    </div>
                  </div>
                </div>
              ))}

              {/* Total general */}
              <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-600 pt-3 bg-slate-100 dark:bg-slate-700/30 rounded-lg p-3">
                <div>
                  <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">Total general</div>
                  <div className="text-xs text-slate-600 dark:text-slate-400">
                    <span className="text-green-600 dark:text-green-400">
                      Ingresos: ${formatearDecimal(resumenPorMedio.totales.total_ingresos)}
                    </span>
                    <span className="mx-2">•</span>
                    <span className="text-red-600 dark:text-red-400">
                      Egresos: ${formatearDecimal(resumenPorMedio.totales.total_egresos)}
                    </span>
                  </div>
                </div>
                <div className={`text-right ${
                  resumenPorMedio.totales.es_positivo
                    ? "text-green-700 dark:text-green-300"
                    : "text-red-700 dark:text-red-300"
                }`}>
                  <div className="text-xl font-bold">
                    {resumenPorMedio.totales.es_positivo ? "+" : ""}${formatearDecimal(resumenPorMedio.totales.total_neto)}
                  </div>
                </div>
              </div>
            </div>
          )}
        </article>

        {/* Comparativas Período a Período */}
        <article className="col-span-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-600 dark:text-slate-400">Comparativas período a período</h2>
            <div className="flex items-center gap-2">
              <select
                value={tipoComparacion}
                onChange={(e) => cambiarTipoComparacion(e.target.value as 'mes_anterior' | 'año_anterior' | 'trimestre_anterior')}
                className="rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-2 py-1 text-xs text-slate-600 dark:text-slate-300"
              >
                <option value="mes_anterior">vs Mes anterior</option>
                <option value="trimestre_anterior">vs Trimestre anterior</option>
                <option value="año_anterior">vs Año anterior</option>
              </select>
              <button
                onClick={toggleComparativas}
                disabled={cargandoComparativas}
                className="inline-flex items-center gap-1 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-2 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 transition hover:bg-slate-50 dark:hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {mostrarComparativas ? "Ocultar" : "Ver comparativa"}
                <svg
                  className={`h-3 w-3 transition-transform ${mostrarComparativas ? "rotate-180" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
          </div>

          {cargandoComparativas && (
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Cargando comparativa...</p>
          )}

          {errorComparativas && (
            <p className="mt-2 text-xs text-red-600">
              No fue posible cargar la comparativa. {errorComparativas.message || "Error"}
            </p>
          )}

          {mostrarComparativas && comparativas && (
            <div className="mt-4">
              {/* Encabezados de períodos */}
              <div className="mb-4 grid grid-cols-2 gap-4">
                <div className="text-center">
                  <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    {comparativas.periodo_actual.etiqueta}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Período actual</p>
                </div>
                <div className="text-center">
                  <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    {comparativas.periodo_anterior.etiqueta}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Período de comparación</p>
                </div>
              </div>

              {/* Métricas comparativas */}
              <div className="space-y-3">
                {/* Ventas */}
                <div className="rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 p-3">
                  <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">💰 Ventas</h4>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">Total ventas</div>
                      <div className="font-semibold">${formatearDecimal(comparativas.periodo_actual.metricas.ventas.total)}</div>
                      <div className={`text-xs font-medium ${getVariacionColor(comparativas.variaciones.ventas_total)}`}>
                        {formatearVariacion(comparativas.variaciones.ventas_total)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">Cantidad ventas</div>
                      <div className="font-semibold">{comparativas.periodo_actual.metricas.ventas.cantidad}</div>
                      <div className={`text-xs font-medium ${getVariacionColor(comparativas.variaciones.ventas_cantidad)}`}>
                        {formatearVariacion(comparativas.variaciones.ventas_cantidad)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">Ticket promedio</div>
                      <div className="font-semibold">${formatearDecimal(comparativas.periodo_actual.metricas.ventas.ticket_promedio)}</div>
                      <div className={`text-xs font-medium ${getVariacionColor(comparativas.variaciones.ticket_promedio)}`}>
                        {formatearVariacion(comparativas.variaciones.ticket_promedio)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Flujo de efectivo */}
                <div className="rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 p-3">
                  <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">💸 Flujo de efectivo</h4>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">Ingresos</div>
                      <div className="font-semibold text-green-600">${formatearDecimal(comparativas.periodo_actual.metricas.flujo_efectivo.ingresos)}</div>
                      <div className={`text-xs font-medium ${getVariacionColor(comparativas.variaciones.ingresos)}`}>
                        {formatearVariacion(comparativas.variaciones.ingresos)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">Egresos</div>
                      <div className="font-semibold text-red-600">${formatearDecimal(comparativas.periodo_actual.metricas.flujo_efectivo.egresos)}</div>
                      <div className={`text-xs font-medium ${getVariacionColor(-comparativas.variaciones.egresos)}`}>
                        {formatearVariacion(comparativas.variaciones.egresos)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">Balance neto</div>
                      <div className={`font-semibold ${
                        Number(comparativas.periodo_actual.metricas.flujo_efectivo.balance_neto) >= 0
                          ? "text-green-600" : "text-red-600"
                      }`}>
                        ${formatearDecimal(comparativas.periodo_actual.metricas.flujo_efectivo.balance_neto)}
                      </div>
                      <div className={`text-xs font-medium ${getVariacionColor(comparativas.variaciones.balance_neto)}`}>
                        {formatearVariacion(comparativas.variaciones.balance_neto)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Rentabilidad */}
                <div className="rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 p-3">
                  <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">📊 Rentabilidad</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">Margen bruto</div>
                      <div className="font-semibold">${formatearDecimal(comparativas.periodo_actual.metricas.rentabilidad.margen_bruto)}</div>
                      <div className={`text-xs font-medium ${getVariacionColor(comparativas.variaciones.margen_bruto)}`}>
                        {formatearVariacion(comparativas.variaciones.margen_bruto)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">Margen %</div>
                      <div className="font-semibold">{comparativas.periodo_actual.metricas.rentabilidad.margen_porcentaje.toFixed(1)}%</div>
                      <div className={`text-xs font-medium ${getVariacionColor(comparativas.variaciones.margen_porcentaje)}`}>
                        {comparativas.variaciones.margen_porcentaje >= 0 ? "+" : ""}{comparativas.variaciones.margen_porcentaje.toFixed(1)}pp
                      </div>
                    </div>
                  </div>
                </div>

                {/* Resumen de tendencia */}
                <div className={`rounded-lg border p-3 ${
                  comparativas.resumen.tendencia_general === 'positiva'
                    ? "border-green-200 bg-green-50 dark:border-green-700 dark:bg-green-900/20"
                    : "border-red-200 bg-red-50 dark:border-red-700 dark:bg-red-900/20"
                }`}>
                  <div className="flex items-center gap-2">
                    <span className="text-lg">
                      {comparativas.resumen.tendencia_general === 'positiva' ? "📈" : "📉"}
                    </span>
                    <div>
                      <h4 className={`text-sm font-medium ${
                        comparativas.resumen.tendencia_general === 'positiva'
                          ? "text-green-700 dark:text-green-300"
                          : "text-red-700 dark:text-red-300"
                      }`}>
                        Tendencia {comparativas.resumen.tendencia_general === 'positiva' ? 'Positiva' : 'Negativa'}
                      </h4>
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        Período de {comparativas.resumen.dias_periodo} días vs {comparativas.resumen.tipo_comparacion.replace('_', ' ')}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </article>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Registrar pago recibido</h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Selecciona el cliente e ingresa el monto recibido para actualizar los saldos.</p>
          <form className="mt-4 grid gap-4 md:grid-cols-2" onSubmit={manejarRegistroPago}>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="pago-cliente">
                Cliente *
              </label>
              <select
                id="pago-cliente"
                value={formularioPago.cliente}
                onChange={(evento) => actualizarCampoPago("cliente", evento.target.value)}
                className="rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                disabled={enviandoPago}
                required
              >
                <option value="">Selecciona un cliente</option>
                {clientesOrdenados.map((cliente) => (
                  <option key={cliente.id} value={cliente.id}>
                    {cliente.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="pago-venta">
                Factura (Opcional)
              </label>
              <select
                id="pago-venta"
                value={formularioPago.venta}
                onChange={(evento) => actualizarCampoPago("venta", evento.target.value)}
                className="rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                disabled={enviandoPago || !formularioPago.cliente}
              >
                <option value="">Sin factura (pago a cuenta)</option>
                {ventasDelCliente.map((venta) => (
                  <option key={venta.id} value={venta.id}>
                    {venta.numero ? `Factura #${venta.numero}` : `Venta #${venta.id}`} - ${formatearDecimal(venta.total)}
                  </option>
                ))}
              </select>
              {!formularioPago.cliente && (
                <p className="text-xs text-slate-500 dark:text-slate-400">Selecciona primero un cliente</p>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="pago-monto">
                Monto *
              </label>
              <input
                id="pago-monto"
                type="number"
                min="0.01"
                step="0.01"
                value={formularioPago.monto}
                onChange={(evento) => actualizarCampoPago("monto", evento.target.value)}
                className="rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                required
                disabled={enviandoPago}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="pago-medio">
                Medio *
              </label>
              <select
                id="pago-medio"
                value={formularioPago.medio}
                onChange={(evento) => actualizarCampoPago("medio", evento.target.value)}
                className="rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                disabled={enviandoPago}
              >
                {mediosPago.map((medio) => (
                  <option key={medio.value} value={medio.value}>
                    {medio.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="pago-fecha">
                Fecha
              </label>
              <input
                id="pago-fecha"
                type="date"
                value={formularioPago.fecha}
                onChange={(evento) => actualizarCampoPago("fecha", evento.target.value)}
                className="rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                disabled={enviandoPago}
              />
            </div>
            <div className="md:col-span-2 flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="pago-observacion">
                Observacion
              </label>
              <textarea
                id="pago-observacion"
                value={formularioPago.observacion}
                onChange={(evento) => actualizarCampoPago("observacion", evento.target.value)}
                className="rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                rows={2}
                disabled={enviandoPago}
              />
            </div>
            <div className="md:col-span-2 flex items-center gap-3">
              <button
                type="submit"
                disabled={enviandoPago}
                className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-blue-300"
              >
                {enviandoPago ? "Registrando..." : "Registrar pago"}
              </button>
              {mensajeExitoPago && <span className="text-sm font-medium text-emerald-600">{mensajeExitoPago}</span>}
              {mensajeErrorPago && <span className="text-sm font-medium text-red-600">{mensajeErrorPago}</span>}
            </div>
          </form>
        </section>

        <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Registrar gasto</h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Clasifica el gasto y agrega una observacion opcional.</p>
          <form className="mt-4 grid gap-4 md:grid-cols-2" onSubmit={manejarRegistroGasto}>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="gasto-tipo">
                Tipo de gasto *
              </label>
              <select
                id="gasto-tipo"
                value={formularioGasto.tipo}
                onChange={(evento) => actualizarCampoGasto("tipo", evento.target.value)}
                className="rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                disabled={enviandoGasto}
              >
                {tiposGasto.map((tipo) => (
                  <option key={tipo.value} value={tipo.value}>
                    {tipo.label}
                  </option>
                ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="gasto-monto">
                  Monto *
                </label>
              <input
                id="gasto-monto"
                type="number"
                min="0.01"
                step="0.01"
                value={formularioGasto.monto}
                onChange={(evento) => actualizarCampoGasto("monto", evento.target.value)}
                className="rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                required
                disabled={enviandoGasto}
              />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="gasto-medio">
                  Medio *
                </label>
                <select
                  id="gasto-medio"
                  value={formularioGasto.medio}
                  onChange={(evento) => actualizarCampoGasto("medio", evento.target.value)}
                  className="rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  disabled={enviandoGasto}
                >
                  {mediosPago.map((medio) => (
                    <option key={medio.value} value={medio.value}>
                      {medio.label}
                    </option>
                  ))}
                </select>
              </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="gasto-fecha">
                Fecha
              </label>
              <input
                id="gasto-fecha"
                type="date"
                value={formularioGasto.fecha}
                onChange={(evento) => actualizarCampoGasto("fecha", evento.target.value)}
                className="rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                disabled={enviandoGasto}
              />
            </div>
            <div className="md:col-span-2 flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="gasto-observacion">
                Observacion
              </label>
              <textarea
                id="gasto-observacion"
                value={formularioGasto.observacion}
                onChange={(evento) => actualizarCampoGasto("observacion", evento.target.value)}
                className="rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                rows={2}
                disabled={enviandoGasto}
              />
            </div>
            <div className="md:col-span-2 flex items-center gap-3">
              <button
                type="submit"
                disabled={enviandoGasto}
                className="inline-flex items-center gap-2 rounded-full bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-500 disabled:cursor-not-allowed disabled:bg-amber-300"
              >
                {enviandoGasto ? "Registrando..." : "Registrar gasto"}
              </button>
              {mensajeExitoGasto && <span className="text-sm font-medium text-emerald-600">{mensajeExitoGasto}</span>}
              {mensajeErrorGasto && <span className="text-sm font-medium text-red-600">{mensajeErrorGasto}</span>}
            </div>
          </form>
        </section>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <article className="flex flex-col gap-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm">
          <header className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Pagos de clientes</h2>
            {cargandoPagos && <span className="text-xs text-slate-500 dark:text-slate-400">Cargando...</span>}
          </header>
          {errorPagos && (
            <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              No fue posible obtener los pagos. {errorPagos.message || "Error"}
            </p>
          )}
          {!cargandoPagos && !errorPagos && pagos.length === 0 && (
            <p className="text-sm text-slate-500 dark:text-slate-400">Sin pagos registrados.</p>
          )}
          {!cargandoPagos && !errorPagos && pagos.length > 0 && (
            <div className="max-h-96 overflow-y-auto border-t border-slate-200 dark:border-slate-600 pt-3">
              <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                {pagos.map((pago) => (
                  <li key={pago.id} className="rounded-lg bg-slate-50 dark:bg-slate-700 px-3 py-2">
                    <p className="font-semibold text-slate-700 dark:text-slate-300">{pago.cliente_nombre}</p>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      <span>{pago.fecha}</span>
                      <span className="mx-2 text-slate-400">-</span>
                      <span>{pago.medio_display}</span>
                      {pago.venta_numero && (
                        <>
                          <span className="mx-2 text-slate-400">-</span>
                          <span className="text-blue-600 dark:text-blue-400">Factura #{pago.venta_numero}</span>
                        </>
                      )}
                    </div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      ${formatearDecimal(pago.monto)}
                    </p>
                    {pago.observacion && (
                      <p className="text-xs text-slate-500 dark:text-slate-400">Nota: {pago.observacion}</p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </article>

        <article className="flex flex-col gap-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm">
          <header className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Gastos registrados</h2>
            {cargandoGastos && <span className="text-xs text-slate-500 dark:text-slate-400">Cargando...</span>}
          </header>
          <form className="grid gap-2 md:grid-cols-2" onSubmit={aplicarFiltroGastos}>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400" htmlFor="gasto-desde">Desde</label>
              <input
                id="gasto-desde"
                type="date"
                value={filtrosGasto.desde}
                onChange={(evento) => manejarCambioFiltroGasto("desde", evento.target.value)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400" htmlFor="gasto-hasta">Hasta</label>
              <input
                id="gasto-hasta"
                type="date"
                value={filtrosGasto.hasta}
                onChange={(evento) => manejarCambioFiltroGasto("hasta", evento.target.value)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div className="md:col-span-2 flex gap-2">
              <button
                type="submit"
                className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-700"
              >
                Aplicar filtro
              </button>
              <button
                type="button"
                onClick={limpiarFiltroGastos}
                className="rounded-full border border-slate-300 dark:border-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 transition hover:border-slate-400 dark:hover:border-slate-500"
              >
                Limpiar
              </button>
            </div>
          </form>
          {errorGastos && (
            <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              No fue posible obtener los gastos. {errorGastos.message || "Error"}
            </p>
          )}
          {!cargandoGastos && !errorGastos && gastos.length === 0 && (
            <p className="text-sm text-slate-500 dark:text-slate-400">Sin gastos registrados para el periodo seleccionado.</p>
          )}
          {!cargandoGastos && !errorGastos && gastos.length > 0 && (
            <div className="max-h-96 overflow-y-auto border-t border-slate-200 dark:border-slate-600 pt-3">
              <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                {gastos.map((gasto) => (
                  <li key={gasto.id} className="rounded-lg bg-slate-50 px-3 py-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold text-slate-700 dark:text-slate-300">{gasto.descripcion}</p>
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                        {gasto.origen_display}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                      <span>{gasto.fecha}</span>
                      {gasto.medio_pago_display && (
                        <span className="rounded-full bg-slate-200 dark:bg-slate-600 px-2 py-0.5 text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                          {gasto.medio_pago_display}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      ${formatearDecimal(gasto.monto)}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </article>

        <article className="flex flex-col gap-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm">
          <header className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Efectivo real (pagado/cobrado)</h2>
            {cargandoMovimientos && <span className="text-xs text-slate-500 dark:text-slate-400">Cargando...</span>}
          </header>
          {errorMovimientos && (
            <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              No fue posible obtener los movimientos. {errorMovimientos.message || "Error"}
            </p>
          )}
          {!cargandoMovimientos && !errorMovimientos && movimientos.length === 0 && (
            <p className="text-sm text-slate-500 dark:text-slate-400">Sin movimientos registrados.</p>
          )}
          {!cargandoMovimientos && !errorMovimientos && movimientos.length > 0 && (
            <div className="max-h-96 overflow-y-auto border-t border-slate-200 dark:border-slate-600 pt-3">
              <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                {movimientos.map((movimiento) => (
                  <li key={movimiento.id} className="rounded-lg bg-slate-50 px-3 py-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold text-slate-700 dark:text-slate-300">{movimiento.descripcion}</p>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          movimiento.tipo === "INGRESO"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {movimiento.tipo}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      <span>{movimiento.fecha}</span>
                      <span className="mx-2 text-slate-400">-</span>
                      <span>{movimiento.origen_display}</span>
                    </div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      ${formatearDecimal(movimiento.monto)}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </article>
      </section>
    </section>
  );
};

export default FinanzasPage;
