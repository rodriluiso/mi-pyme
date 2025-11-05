import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useListado } from "@/hooks/useListado";
import { useApi } from "@/hooks/useApi";
import type { ApiError } from "@/lib/api/types";
import type {
  AjusteStockMateriaPrima,
  AjusteStockRequest,
  Compra,
  MateriaPrima,
  Proveedor,
  ResumenCompraPorCategoria,
  ResumenCompraPorProveedor,
  StockDetallado,
  StockResumenPorProveedor
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

type PeriodoResumen = "semanal" | "mensual" | "trimestral" | "anual";

const OPCIONES_PERIODO: Array<{ valor: PeriodoResumen; etiqueta: string }> = [
  { valor: "semanal", etiqueta: "Ultimos 7 dias" },
  { valor: "mensual", etiqueta: "Ultimos 30 dias" },
  { valor: "trimestral", etiqueta: "Ultimos 90 dias" },
  { valor: "anual", etiqueta: "Ultimos 12 meses" }
];

type FormularioCompra = {
  proveedor: string;
  materiaPrima: string;
  descripcion: string;
  cantidad: string;
  monto: string;
  aplicarIVA: boolean;
  numero: string;
};

type FormularioMateriaPrima = {
  nombre: string;
  sku: string;
  descripcion: string;
  unidad_medida: string;
  stock: string;
  stock_minimo: string;
};

type FormularioAjusteStock = {
  materiaPrima: string;
  tipo_ajuste: 'ENTRADA' | 'SALIDA' | 'CORRECCION' | 'MERMA' | 'DEVOLUCION';
  cantidad: string;
  motivo: string;
  usuario: string;
  proveedor: string;
};

const estadoInicialFormularioCompra: FormularioCompra = {
  proveedor: "",
  materiaPrima: "",
  descripcion: "",
  cantidad: "",
  monto: "",
  aplicarIVA: false,
  numero: ""
};

const estadoInicialFormularioMateriaPrima: FormularioMateriaPrima = {
  nombre: "",
  sku: "",
  descripcion: "",
  unidad_medida: "kg",
  stock: "",
  stock_minimo: "0"
};

const estadoInicialFormularioAjusteStock: FormularioAjusteStock = {
  materiaPrima: "",
  tipo_ajuste: "ENTRADA",
  cantidad: "",
  motivo: "",
  usuario: "Usuario",
  proveedor: ""
};

const ComprasPage = () => {
  const { datos: compras, cargando, error, recargar } = useListado<Compra>("/compras/");
  const { datos: materiasPrimas, recargar: recargarMateriasPrimas } = useListado<MateriaPrima>("/compras/materias-primas/");
  const { datos: proveedores } = useListado<Proveedor>("/proveedores/");
  const { request } = useApi();

  const [resumenProveedores, setResumenProveedores] = useState<ResumenCompraPorProveedor[]>([]);
  const [resumenCategorias, setResumenCategorias] = useState<ResumenCompraPorCategoria[]>([]);
  const [errorResumen, setErrorResumen] = useState<ApiError | null>(null);
  const [cargandoResumen, setCargandoResumen] = useState<boolean>(true);

  const [formularioCompra, setFormularioCompra] = useState<FormularioCompra>(estadoInicialFormularioCompra);
  const [enviandoCompra, setEnviandoCompra] = useState(false);
  const [mensajeExitoCompra, setMensajeExitoCompra] = useState<string | null>(null);
  const [mensajeErrorCompra, setMensajeErrorCompra] = useState<string | null>(null);

  const [formularioMateriaPrima, setFormularioMateriaPrima] = useState<FormularioMateriaPrima>(estadoInicialFormularioMateriaPrima);
  const [enviandoMateriaPrima, setEnviandoMateriaPrima] = useState(false);
  const [mensajeExitoMateriaPrima, setMensajeExitoMateriaPrima] = useState<string | null>(null);
  const [mensajeErrorMateriaPrima, setMensajeErrorMateriaPrima] = useState<string | null>(null);
  const [formularioMateriaPrimaExpandido, setFormularioMateriaPrimaExpandido] = useState(false);

  const [formularioAjusteStock, setFormularioAjusteStock] = useState<FormularioAjusteStock>(estadoInicialFormularioAjusteStock);
  const [enviandoAjusteStock, setEnviandoAjusteStock] = useState(false);
  const [mensajeExitoAjusteStock, setMensajeExitoAjusteStock] = useState<string | null>(null);
  const [mensajeErrorAjusteStock, setMensajeErrorAjusteStock] = useState<string | null>(null);
  const [formularioAjusteStockExpandido, setFormularioAjusteStockExpandido] = useState(false);
  const [historialAjustes, setHistorialAjustes] = useState<AjusteStockMateriaPrima[]>([]);
  const [cargandoHistorial, setCargandoHistorial] = useState(false);
  const [mostrandoHistorial, setMostrandoHistorial] = useState(false);

  const [stockDetallado, setStockDetallado] = useState<StockDetallado[]>([]);
  const [cargandoStockDetallado, setCargandoStockDetallado] = useState(false);
  const [vistaDetallada, setVistaDetallada] = useState(false);

  const [stockPorProveedor, setStockPorProveedor] = useState<StockResumenPorProveedor[]>([]);
  const [cargandoStockPorProveedor, setCargandoStockPorProveedor] = useState(false);
  const [vistaStockPorProveedor, setVistaStockPorProveedor] = useState(false);

  const [periodoResumen, setPeriodoResumen] = useState<PeriodoResumen>("anual");

  const cargarResumenes = useCallback(async () => {
    setCargandoResumen(true);
    setErrorResumen(null);
    try {
      const query = `?periodo=${periodoResumen}`;
      const [porProveedor, porCategoria] = await Promise.all([
        request<ResumenCompraPorProveedor[]>({ method: "GET", url: `/compras/resumen/proveedores/${query}` }),
        request<ResumenCompraPorCategoria[]>({ method: "GET", url: `/compras/resumen/categorias/${query}` })
      ]);
      setResumenProveedores(porProveedor);
      setResumenCategorias(porCategoria);
    } catch (err) {
      setErrorResumen(err as ApiError);
    } finally {
      setCargandoResumen(false);
    }
  }, [periodoResumen, request]);

  useEffect(() => {
    void cargarResumenes();
  }, [cargarResumenes]);

  const cargarStockDetallado = useCallback(async () => {
    setCargandoStockDetallado(true);
    try {
      const datos = await request<StockDetallado[]>({
        method: "GET",
        url: "/compras/materias-primas/stock-detallado/"
      });
      setStockDetallado(datos);
    } catch (err) {
      console.error("Error al cargar stock detallado:", err);
    } finally {
      setCargandoStockDetallado(false);
    }
  }, [request]);

  const cargarStockPorProveedor = useCallback(async () => {
    setCargandoStockPorProveedor(true);
    try {
      const datos = await request<StockResumenPorProveedor[]>({
        method: "GET",
        url: "/compras/materias-primas/stock-por-proveedor/"
      });
      setStockPorProveedor(datos);
    } catch (err) {
      console.error("Error al cargar stock por proveedor:", err);
      setStockPorProveedor([]);
    } finally {
      setCargandoStockPorProveedor(false);
    }
  }, [request]);

  useEffect(() => {
    if (vistaDetallada) {
      void cargarStockDetallado();
    }
  }, [vistaDetallada, cargarStockDetallado]);

  useEffect(() => {
    if (vistaStockPorProveedor) {
      void cargarStockPorProveedor();
    }
  }, [vistaStockPorProveedor, cargarStockPorProveedor]);

  const recargarTodo = async () => {
    await Promise.all([recargar(), recargarMateriasPrimas(), cargarResumenes()]);
  };

  const manejarCambioPeriodo = (valor: PeriodoResumen) => {
    setPeriodoResumen(valor);
  };

  const actualizarCampoMateriaPrima = (campo: keyof FormularioMateriaPrima, valor: string) => {
    setFormularioMateriaPrima((prev) => ({ ...prev, [campo]: valor }));
  };

  const actualizarCampoAjusteStock = (campo: keyof FormularioAjusteStock, valor: string) => {
    setFormularioAjusteStock((prev) => ({ ...prev, [campo]: valor }));
  };

  const manejarSubmitMateriaPrima = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    setMensajeExitoMateriaPrima(null);
    setMensajeErrorMateriaPrima(null);

    if (!formularioMateriaPrima.nombre.trim()) {
      setMensajeErrorMateriaPrima("El nombre es requerido");
      return;
    }

    if (!formularioMateriaPrima.stock || Number(formularioMateriaPrima.stock) < 0) {
      setMensajeErrorMateriaPrima("Ingresa un stock inicial válido");
      return;
    }

    setEnviandoMateriaPrima(true);

    try {
      await request<MateriaPrima>({
        method: "POST",
        url: "/compras/materias-primas/",
        data: {
          nombre: formularioMateriaPrima.nombre.trim(),
          sku: formularioMateriaPrima.sku.trim() || undefined,
          descripcion: formularioMateriaPrima.descripcion.trim(),
          unidad_medida: formularioMateriaPrima.unidad_medida,
          stock: Number(formularioMateriaPrima.stock),
          stock_minimo: Number(formularioMateriaPrima.stock_minimo) || 0,
          precio_promedio: 0,
          activo: true
        }
      });

      setFormularioMateriaPrima(estadoInicialFormularioMateriaPrima);
      setMensajeExitoMateriaPrima("Materia prima creada correctamente");
      await recargarTodo();
    } catch (err) {
      const apiError = err as ApiError;
      setMensajeErrorMateriaPrima(apiError.message || "No se pudo crear la materia prima");
    } finally {
      setEnviandoMateriaPrima(false);
    }
  };

  const manejarSubmitAjusteStock = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    setMensajeExitoAjusteStock(null);
    setMensajeErrorAjusteStock(null);

    if (!formularioAjusteStock.materiaPrima) {
      setMensajeErrorAjusteStock("Selecciona una materia prima");
      return;
    }

    if (!formularioAjusteStock.cantidad || Number(formularioAjusteStock.cantidad) <= 0) {
      setMensajeErrorAjusteStock("Ingresa una cantidad válida");
      return;
    }

    if (!formularioAjusteStock.motivo.trim()) {
      setMensajeErrorAjusteStock("Describe el motivo del ajuste");
      return;
    }

    if (formularioAjusteStock.tipo_ajuste === 'SALIDA' && !formularioAjusteStock.proveedor) {
      setMensajeErrorAjusteStock("Selecciona un proveedor para la salida de stock");
      return;
    }

    setEnviandoAjusteStock(true);

    try {
      const cantidad = (formularioAjusteStock.tipo_ajuste === 'SALIDA' || formularioAjusteStock.tipo_ajuste === 'MERMA')
        ? -Math.abs(Number(formularioAjusteStock.cantidad))
        : Math.abs(Number(formularioAjusteStock.cantidad));

      const ajusteData: AjusteStockRequest = {
        tipo_ajuste: formularioAjusteStock.tipo_ajuste,
        cantidad: cantidad,
        motivo: formularioAjusteStock.motivo.trim(),
        usuario: formularioAjusteStock.usuario.trim() || "Usuario",
        proveedor_id: formularioAjusteStock.proveedor ? Number(formularioAjusteStock.proveedor) : undefined
      };

      await request({
        method: "POST",
        url: `/compras/materias-primas/${formularioAjusteStock.materiaPrima}/ajustar-stock/`,
        data: ajusteData
      });

      setFormularioAjusteStock(estadoInicialFormularioAjusteStock);
      setMensajeExitoAjusteStock("Stock ajustado correctamente");
      await recargarTodo();

      // Recargar historial si se está mostrando
      if (mostrandoHistorial) {
        await cargarHistorialAjustes(Number(formularioAjusteStock.materiaPrima));
      }
    } catch (err) {
      const apiError = err as ApiError;
      setMensajeErrorAjusteStock(apiError.message || "No se pudo ajustar el stock");
    } finally {
      setEnviandoAjusteStock(false);
    }
  };

  const cargarHistorialAjustes = async (materiaPrimaId: number) => {
    setCargandoHistorial(true);
    try {
      const datos = await request<AjusteStockMateriaPrima[]>({
        method: "GET",
        url: `/compras/materias-primas/${materiaPrimaId}/historial-ajustes/`
      });
      setHistorialAjustes(datos);
    } catch (err) {
      console.error("Error al cargar historial de ajustes:", err);
      setHistorialAjustes([]);
    } finally {
      setCargandoHistorial(false);
    }
  };

  const manejarSeleccionMateriaPrimaAjuste = async (materiaPrimaId: string) => {
    actualizarCampoAjusteStock("materiaPrima", materiaPrimaId);
    if (materiaPrimaId && mostrandoHistorial) {
      await cargarHistorialAjustes(Number(materiaPrimaId));
    }
  };

  const materiasPrimasOrdenadas = useMemo(() => {
    return [...materiasPrimas]
      .filter((mp) => mp.activo)
      .sort((a, b) => Number(b.stock) - Number(a.stock))
      .slice(0, 15);
  }, [materiasPrimas]);

  const proveedoresOrdenados = useMemo(() => {
    return [...proveedores].sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [proveedores]);

  const montoBase = Number(formularioCompra.monto);
  const montoValido = Number.isNaN(montoBase) || montoBase <= 0 ? 0 : montoBase;
  const ivaCalculado = formularioCompra.aplicarIVA ? Number((montoValido * 0.21).toFixed(2)) : 0;
  const totalEstimado = Number((montoValido + ivaCalculado).toFixed(2));

  const actualizarCampoCompra = (campo: keyof FormularioCompra, valor: string | boolean) => {
    setFormularioCompra((prev) => ({ ...prev, [campo]: valor }));
  };

  const manejarCambioMateriaPrima = (valor: string) => {
    setFormularioCompra((prev) => {
      const siguiente: FormularioCompra = { ...prev, materiaPrima: valor };
      if (valor) {
        const materiaPrimaSeleccionada = materiasPrimas.find((mp) => mp.id === Number(valor));
        if (materiaPrimaSeleccionada && !prev.descripcion.trim()) {
          siguiente.descripcion = materiaPrimaSeleccionada.nombre;
        }
      }
      return siguiente;
    });
  };

  const manejarSubmitCompra = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    setMensajeExitoCompra(null);
    setMensajeErrorCompra(null);

    if (!formularioCompra.proveedor) {
      setMensajeErrorCompra("Selecciona un proveedor");
      return;
    }

    const descripcion = formularioCompra.descripcion.trim();
    if (!descripcion) {
      setMensajeErrorCompra("Describe la compra");
      return;
    }

    const monto = Number(formularioCompra.monto);
    if (Number.isNaN(monto) || monto <= 0) {
      setMensajeErrorCompra("Ingresa un monto valido");
      return;
    }

    const cantidad = Number(formularioCompra.cantidad);
    if (Number.isNaN(cantidad) || cantidad <= 0) {
      setMensajeErrorCompra("Ingresa una cantidad valida");
      return;
    }

    const proveedorId = Number(formularioCompra.proveedor);
    const materiaPrimaId = formularioCompra.materiaPrima ? Number(formularioCompra.materiaPrima) : null;

    const precioUnitario = Number(monto.toFixed(2));
    const subtotal = Number((precioUnitario * cantidad).toFixed(2));
    const ivaNormalizado = formularioCompra.aplicarIVA
      ? Number((subtotal * 0.21).toFixed(2))
      : 0;
    const totalLinea = Number((subtotal + ivaNormalizado).toFixed(2));

    setEnviandoCompra(true);

    try {
      await request<Compra>({
        method: "POST",
        url: "/compras/",
        data: {
          proveedor: proveedorId,
          numero: formularioCompra.numero.trim() || undefined,
          lineas: [
            {
              materia_prima: materiaPrimaId,
              descripcion,
              cantidad: Number(formularioCompra.cantidad),
              precio_unitario: precioUnitario,
              total_linea: totalLinea
            }
          ]
        }
      });

      setFormularioCompra(estadoInicialFormularioCompra);
      setMensajeExitoCompra("Compra registrada correctamente");
      await recargarTodo();
    } catch (err) {
      const apiError = err as ApiError;
      setMensajeErrorCompra(apiError.message || "No se pudo registrar la compra");
    } finally {
      setEnviandoCompra(false);
    }
  };

  return (
    <section className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_340px] lg:items-start">
      <header className="flex flex-col gap-2 lg:col-span-2">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white dark:text-white">Compras</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Analiza compras, categorias y proveedores asociados para mantener el control de egresos.
        </p>
      </header>

      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => recargarTodo()}
              className="inline-flex items-center rounded-full border border-slate-200 px-4 py-1 text-sm font-medium text-slate-600 dark:text-slate-400 transition hover:border-blue-200 hover:text-blue-600"
            >
              Recargar datos
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400" htmlFor="periodo-resumen">
              Periodo
            </label>
            <select
              id="periodo-resumen"
              value={periodoResumen}
              onChange={(evento) => manejarCambioPeriodo(evento.target.value as PeriodoResumen)}
              className="rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:bg-slate-700 dark:text-white"
            >
              {OPCIONES_PERIODO.map((opcion) => (
                <option key={opcion.valor} value={opcion.valor}>
                  {opcion.etiqueta}
                </option>
              ))}
            </select>
          </div>
        </div>

        <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm">
          <header className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Stock de materia prima</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Materias primas activas ordenadas por stock disponible.</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-slate-500 dark:text-slate-400" htmlFor="vista-detallada">
                    Vista detallada
                  </label>
                  <input
                    id="vista-detallada"
                    type="checkbox"
                    checked={vistaDetallada}
                    onChange={(evento) => setVistaDetallada(evento.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-slate-500 dark:text-slate-400" htmlFor="vista-stock-proveedor">
                    Stock por proveedor
                  </label>
                  <input
                    id="vista-stock-proveedor"
                    type="checkbox"
                    checked={vistaStockPorProveedor}
                    onChange={(evento) => setVistaStockPorProveedor(evento.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-green-600 focus:ring-green-500"
                  />
                </div>
              </div>
            </div>
          </header>
          {!vistaDetallada && !vistaStockPorProveedor ? (
            materiasPrimasOrdenadas.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Sin materias primas cargadas.</p>
            ) : (
              <ul className="mt-4 space-y-2 text-sm text-slate-600 dark:text-slate-400">
                {materiasPrimasOrdenadas.map((materiaPrima) => (
                  <li key={materiaPrima.id} className="flex items-center justify-between rounded-lg bg-slate-50 dark:bg-slate-700 px-3 py-2">
                    <div>
                      <p className="font-semibold text-slate-700 dark:text-slate-300">{materiaPrima.nombre}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">SKU: {materiaPrima.sku || "Sin SKU"}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Unidad: {materiaPrima.unidad_medida}</p>
                    </div>
                    <div className="text-right text-xs">
                      <p>Stock: {formatearDecimal(materiaPrima.stock)}</p>
                      <p>Precio Prom: ${formatearDecimal(materiaPrima.precio_promedio)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )
          ) : vistaDetallada ? (
            <div className="mt-4">
              {cargandoStockDetallado && (
                <p className="text-sm text-slate-500 dark:text-slate-400">Cargando detalle de stock...</p>
              )}
              {!cargandoStockDetallado && stockDetallado.length === 0 && (
                <p className="text-sm text-slate-500 dark:text-slate-400">Sin datos de stock detallado disponibles.</p>
              )}
              {!cargandoStockDetallado && stockDetallado.length > 0 && (
                <div className="space-y-4">
                  {stockDetallado.map((item) => (
                    <div key={item.id} className="rounded-lg border border-slate-200 bg-slate-50 dark:bg-slate-700 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h3 className="font-semibold text-slate-700 dark:text-slate-300">{item.nombre}</h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400">SKU: {item.sku || "Sin SKU"} | {item.unidad_medida}</p>
                        </div>
                        <div className="text-right text-sm">
                          <p className="font-semibold text-slate-800">Stock Total: {formatearDecimal(item.stock_actual)}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">Precio Prom: ${formatearDecimal(item.precio_promedio_actual)}</p>
                        </div>
                      </div>

                      {item.proveedores.length > 0 ? (
                        <div>
                          <h4 className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">Detalle por proveedor:</h4>
                          <ul className="space-y-1">
                            {item.proveedores.map((proveedor) => (
                              <li key={proveedor.proveedor_id} className="flex items-center justify-between rounded bg-white px-3 py-2 text-xs">
                                <span className="font-medium text-slate-700 dark:text-slate-300">{proveedor.proveedor_nombre}</span>
                                <div className="text-right">
                                  <p>Comprado: {formatearDecimal(proveedor.cantidad_comprada)}</p>
                                  <p className="text-slate-500 dark:text-slate-400">{formatearEntero(proveedor.numero_compras)} compra{proveedor.numero_compras !== 1 ? 's' : ''} | Prom: ${formatearDecimal(proveedor.precio_promedio)}</p>
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-500 dark:text-slate-400">Sin historial de compras de proveedores.</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : vistaStockPorProveedor ? (
            <div className="mt-4">
              {cargandoStockPorProveedor && (
                <p className="text-sm text-slate-500 dark:text-slate-400">Cargando stock por proveedor...</p>
              )}
              {!cargandoStockPorProveedor && stockPorProveedor.length === 0 && (
                <p className="text-sm text-slate-500 dark:text-slate-400">Sin datos de stock por proveedor disponibles.</p>
              )}
              {!cargandoStockPorProveedor && stockPorProveedor.length > 0 && (
                <div className="space-y-6">
                  {stockPorProveedor.map((item) => (
                    <div key={item.materia_prima_id} className="rounded-lg border border-slate-200 bg-slate-50 dark:bg-slate-700 p-4">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="font-semibold text-slate-700 dark:text-slate-300 text-lg">{item.materia_prima_nombre}</h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            SKU: {item.sku || "Sin SKU"} | {item.unidad_medida} | Stock Total: {formatearDecimal(item.stock_total)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-green-600">
                            {item.proveedores.length} proveedor{item.proveedores.length !== 1 ? 'es' : ''}
                          </p>
                        </div>
                      </div>

                      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                        {item.proveedores.map((proveedor) => (
                          <div key={proveedor.id} className="rounded-lg bg-white dark:bg-slate-600 border border-slate-200 dark:border-slate-500 p-4">
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="font-semibold text-slate-700 dark:text-slate-300">{proveedor.proveedor_nombre}</h4>
                              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                                {formatearDecimal(proveedor.cantidad_stock)} {proveedor.unidad_medida}
                              </span>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-400">
                              <div>
                                <p className="font-medium">Precio promedio:</p>
                                <p className="text-slate-800 dark:text-slate-200">${formatearDecimal(proveedor.precio_promedio)}</p>
                              </div>
                              <div>
                                <p className="font-medium">Última compra:</p>
                                <p className="text-slate-800 dark:text-slate-200">{proveedor.ultima_compra}</p>
                              </div>
                              <div>
                                <p className="font-medium">Total comprado:</p>
                                <p className="text-slate-800 dark:text-slate-200">{formatearDecimal(proveedor.total_comprado)} {proveedor.unidad_medida}</p>
                              </div>
                              <div>
                                <p className="font-medium">Porcentaje del stock:</p>
                                <p className="text-slate-800 dark:text-slate-200">
                                  {((Number(proveedor.cantidad_stock) / item.stock_total) * 100).toFixed(1)}%
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </section>

        {cargando && <p className="text-sm text-slate-500 dark:text-slate-400">Cargando compras...</p>}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            No fue posible obtener las compras. Detalle: {error.message || "error desconocido"}
          </div>
        )}

        {!cargando && !error && compras.length === 0 && (
          <p className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-500 dark:text-slate-400">
            Todavia no hay compras registradas.
          </p>
        )}

        {!cargando && !error && compras.length > 0 && (
          <div className="grid gap-4">
            {compras.map((compra) => (
              <article key={compra.id} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm">
                <header className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                      Compra #{compra.numero || compra.id}
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Fecha: {compra.fecha}</p>
                  </div>
                  <span className="rounded-full bg-slate-900 px-3 py-1 text-sm font-semibold text-white">
                    ${formatearDecimal(compra.total)}
                  </span>
                </header>
                <dl className="mt-4 grid gap-2 text-sm text-slate-600 dark:text-slate-400 sm:grid-cols-2">
                  <div>
                    <dt className="font-semibold text-slate-500 dark:text-slate-400">Proveedor</dt>
                    <dd className="text-slate-800">{compra.proveedor_nombre}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-slate-500 dark:text-slate-400">Categoria</dt>
                    <dd>{compra.categoria_nombre || "Sin categoria"}</dd>
                  </div>
                </dl>
                {compra.lineas.length > 0 && (
                  <div className="mt-4">
                    <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400">Lineas</h3>
                    <ul className="mt-2 space-y-2 text-xs text-slate-600 dark:text-slate-400">
                      {compra.lineas.map((linea) => (
                        <li key={linea.id} className="rounded-lg bg-slate-50 dark:bg-slate-700 px-3 py-2">
                          <span className="font-semibold text-slate-700 dark:text-slate-300">{linea.descripcion}</span>
                          <span className="mx-2 text-slate-400"> | </span>
                          {linea.materia_prima_nombre || "Sin materia prima"}
                          <span className="mx-2 text-slate-400"> | </span>
                          Cantidad: {linea.cantidad || "0"}
                          <span className="mx-2 text-slate-400"> | </span>
                          Subtotal: ${formatearDecimal(linea.subtotal)}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {compra.notas && (
                  <p className="mt-4 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
                    Nota: {compra.notas}
                  </p>
                )}
              </article>
            ))}
          </div>
        )}
      </div>

      <aside className="flex flex-col gap-6">
        <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Ingresar compra</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Registra una compra de materia prima para actualizar stock y egresos.</p>

          <form className="mt-4 grid gap-4" onSubmit={manejarSubmitCompra}>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="compra-proveedor">
                Proveedor *
              </label>
              <select
                id="compra-proveedor"
                value={formularioCompra.proveedor}
                onChange={(evento) => actualizarCampoCompra("proveedor", evento.target.value)}
                className="rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:bg-slate-700 dark:text-white"
                required
                disabled={enviandoCompra}
              >
                <option value="">Selecciona un proveedor</option>
                {proveedoresOrdenados.map((proveedor) => (
                  <option key={proveedor.id} value={proveedor.id}>
                    {proveedor.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="compra-materia-prima">
                Materia prima (opcional)
              </label>
              <select
                id="compra-materia-prima"
                value={formularioCompra.materiaPrima}
                onChange={(evento) => manejarCambioMateriaPrima(evento.target.value)}
                className="rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:bg-slate-700 dark:text-white"
                disabled={enviandoCompra}
              >
                <option value="">Sin materia prima asociada</option>
                {materiasPrimas.map((materiaPrima) => (
                  <option key={materiaPrima.id} value={materiaPrima.id}>
                    {materiaPrima.nombre} ({materiaPrima.unidad_medida})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="compra-descripcion">
                Descripcion *
              </label>
              <input
                id="compra-descripcion"
                type="text"
                value={formularioCompra.descripcion}
                onChange={(evento) => actualizarCampoCompra("descripcion", evento.target.value)}
                className="rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:bg-slate-700 dark:text-white"
                placeholder="Detalle de la compra"
                required
                disabled={enviandoCompra}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="compra-cantidad">
                Cantidad *
              </label>
              <input
                id="compra-cantidad"
                type="number"
                min="0.01"
                step="0.01"
                value={formularioCompra.cantidad}
                onChange={(evento) => actualizarCampoCompra("cantidad", evento.target.value)}
                className="rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:bg-slate-700 dark:text-white"
                placeholder="Cantidad comprada"
                required
                disabled={enviandoCompra}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="compra-monto">
                Precio unitario *
              </label>
              <input
                id="compra-monto"
                type="number"
                min="0.01"
                step="0.01"
                value={formularioCompra.monto}
                onChange={(evento) => actualizarCampoCompra("monto", evento.target.value)}
                className="rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:bg-slate-700 dark:text-white"
                placeholder="Precio por unidad"
                required
                disabled={enviandoCompra}
              />
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <input
                  id="compra-iva"
                  type="checkbox"
                  checked={formularioCompra.aplicarIVA}
                  onChange={(evento) => actualizarCampoCompra("aplicarIVA", evento.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  disabled={enviandoCompra}
                />
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="compra-iva">
                  Aplicar IVA 21%
                </label>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                IVA: ${formatearDecimal(ivaCalculado)} - Total estimado: ${formatearDecimal(totalEstimado)}
              </p>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="compra-numero">
                Numero de factura (opcional)
              </label>
              <input
                id="compra-numero"
                type="text"
                value={formularioCompra.numero}
                onChange={(evento) => actualizarCampoCompra("numero", evento.target.value)}
                className="rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:bg-slate-700 dark:text-white"
                placeholder="Ej: FC-000123"
                disabled={enviandoCompra}
              />
            </div>

            <div className="flex items-center gap-3">
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-blue-300"
                disabled={enviandoCompra}
              >
                {enviandoCompra ? "Registrando..." : "Registrar compra"}
              </button>
              {mensajeExitoCompra && (
                <span className="text-sm font-medium text-emerald-600">{mensajeExitoCompra}</span>
              )}
              {mensajeErrorCompra && (
                <span className="text-sm font-medium text-red-600">{mensajeErrorCompra}</span>
              )}
            </div>
          </form>
        </section>

        <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm">
          <button
            type="button"
            onClick={() => setFormularioMateriaPrimaExpandido(!formularioMateriaPrimaExpandido)}
            className="w-full text-left focus:outline-none"
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Agregar materia prima</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Registra nuevas materias primas para tu inventario.</p>
              </div>
              <div className="flex items-center">
                <span className="text-xs text-slate-400 mr-2">
                  {formularioMateriaPrimaExpandido ? "Contraer" : "Expandir"}
                </span>
                <svg
                  className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${
                    formularioMateriaPrimaExpandido ? "transform rotate-180" : ""
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </button>

          {formularioMateriaPrimaExpandido && (
            <div className="animate-in slide-in-from-top-2 duration-200">
              <form className="mt-4 grid gap-4" onSubmit={manejarSubmitMateriaPrima}>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="mp-nombre">
                Nombre *
              </label>
              <input
                id="mp-nombre"
                type="text"
                value={formularioMateriaPrima.nombre}
                onChange={(evento) => actualizarCampoMateriaPrima("nombre", evento.target.value)}
                className="rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:bg-slate-700 dark:text-white"
                placeholder="Ej: Harina de trigo"
                required
                disabled={enviandoMateriaPrima}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="mp-sku">
                SKU (opcional)
              </label>
              <input
                id="mp-sku"
                type="text"
                value={formularioMateriaPrima.sku}
                onChange={(evento) => actualizarCampoMateriaPrima("sku", evento.target.value)}
                className="rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:bg-slate-700 dark:text-white"
                placeholder="Ej: HAR001"
                disabled={enviandoMateriaPrima}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="mp-descripcion">
                Descripción (opcional)
              </label>
              <textarea
                id="mp-descripcion"
                value={formularioMateriaPrima.descripcion}
                onChange={(evento) => actualizarCampoMateriaPrima("descripcion", evento.target.value)}
                className="rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:bg-slate-700 dark:text-white"
                placeholder="Descripción detallada"
                rows={2}
                disabled={enviandoMateriaPrima}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="mp-unidad">
                Unidad de medida *
              </label>
              <select
                id="mp-unidad"
                value={formularioMateriaPrima.unidad_medida}
                onChange={(evento) => actualizarCampoMateriaPrima("unidad_medida", evento.target.value)}
                className="rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:bg-slate-700 dark:text-white"
                required
                disabled={enviandoMateriaPrima}
              >
                <option value="kg">Kilogramos (kg)</option>
                <option value="g">Gramos (g)</option>
                <option value="l">Litros (l)</option>
                <option value="ml">Mililitros (ml)</option>
                <option value="u">Unidades (u)</option>
                <option value="m">Metros (m)</option>
                <option value="cm">Centímetros (cm)</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="mp-stock">
                  Stock inicial *
                </label>
                <input
                  id="mp-stock"
                  type="number"
                  min="0"
                  step="0.001"
                  value={formularioMateriaPrima.stock}
                  onChange={(evento) => actualizarCampoMateriaPrima("stock", evento.target.value)}
                  className="rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:bg-slate-700 dark:text-white"
                  placeholder="0"
                  required
                  disabled={enviandoMateriaPrima}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="mp-stock-minimo">
                  Stock mínimo
                </label>
                <input
                  id="mp-stock-minimo"
                  type="number"
                  min="0"
                  step="0.001"
                  value={formularioMateriaPrima.stock_minimo}
                  onChange={(evento) => actualizarCampoMateriaPrima("stock_minimo", evento.target.value)}
                  className="rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:bg-slate-700 dark:text-white"
                  placeholder="0"
                  disabled={enviandoMateriaPrima}
                />
                <p className="text-xs text-slate-500 dark:text-slate-400">Para alertas automáticas</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-full bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-500 disabled:cursor-not-allowed disabled:bg-green-300"
                disabled={enviandoMateriaPrima}
              >
                {enviandoMateriaPrima ? "Creando..." : "Crear materia prima"}
              </button>
              {mensajeExitoMateriaPrima && (
                <span className="text-sm font-medium text-emerald-600">{mensajeExitoMateriaPrima}</span>
              )}
              {mensajeErrorMateriaPrima && (
                <span className="text-sm font-medium text-red-600">{mensajeErrorMateriaPrima}</span>
              )}
            </div>
          </form>
            </div>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm">
          <button
            type="button"
            onClick={() => setFormularioAjusteStockExpandido(!formularioAjusteStockExpandido)}
            className="w-full text-left focus:outline-none"
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Ajustar stock</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Realiza ajustes de entrada, salida o corrección de inventario.</p>
              </div>
              <div className="flex items-center">
                <span className="text-xs text-slate-400 mr-2">
                  {formularioAjusteStockExpandido ? "Contraer" : "Expandir"}
                </span>
                <svg
                  className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${
                    formularioAjusteStockExpandido ? "transform rotate-180" : ""
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </button>

          {formularioAjusteStockExpandido && (
            <div className="animate-in slide-in-from-top-2 duration-200">
              <form className="mt-4 grid gap-4" onSubmit={manejarSubmitAjusteStock}>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="ajuste-materia-prima">
                    Materia prima *
                  </label>
                  <select
                    id="ajuste-materia-prima"
                    value={formularioAjusteStock.materiaPrima}
                    onChange={(evento) => manejarSeleccionMateriaPrimaAjuste(evento.target.value)}
                    className="rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:bg-slate-700 dark:text-white"
                    required
                    disabled={enviandoAjusteStock}
                  >
                    <option value="">Selecciona una materia prima</option>
                    {materiasPrimas.filter(mp => mp.activo).map((materiaPrima) => (
                      <option key={materiaPrima.id} value={materiaPrima.id}>
                        {materiaPrima.nombre} - Stock: {formatearDecimal(materiaPrima.stock)} {materiaPrima.unidad_medida}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="ajuste-tipo">
                    Tipo de ajuste *
                  </label>
                  <select
                    id="ajuste-tipo"
                    value={formularioAjusteStock.tipo_ajuste}
                    onChange={(evento) => {
                      actualizarCampoAjusteStock("tipo_ajuste", evento.target.value as 'ENTRADA' | 'SALIDA' | 'CORRECCION' | 'MERMA' | 'DEVOLUCION');
                      // Reset provider selection when changing adjustment type
                      if (evento.target.value !== 'SALIDA') {
                        actualizarCampoAjusteStock("proveedor", "");
                      }
                    }}
                    className="rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:bg-slate-700 dark:text-white"
                    required
                    disabled={enviandoAjusteStock}
                  >
                    <option value="ENTRADA">Entrada (agregar stock)</option>
                    <option value="SALIDA">Salida (quitar stock)</option>
                    <option value="CORRECCION">Corrección de inventario</option>
                    <option value="MERMA">Merma/pérdida</option>
                    <option value="DEVOLUCION">Devolución</option>
                  </select>
                </div>

                {formularioAjusteStock.tipo_ajuste === 'SALIDA' && (
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="ajuste-proveedor">
                      Proveedor específico *
                    </label>
                    <select
                      id="ajuste-proveedor"
                      value={formularioAjusteStock.proveedor}
                      onChange={(evento) => actualizarCampoAjusteStock("proveedor", evento.target.value)}
                      className="rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:bg-slate-700 dark:text-white"
                      required
                      disabled={enviandoAjusteStock}
                    >
                      <option value="">Selecciona un proveedor</option>
                      {proveedoresOrdenados.map((proveedor) => (
                        <option key={proveedor.id} value={proveedor.id}>
                          {proveedor.nombre}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      El stock se descontará específicamente de este proveedor
                    </p>
                  </div>
                )}

                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="ajuste-cantidad">
                    Cantidad *
                  </label>
                  <input
                    id="ajuste-cantidad"
                    type="number"
                    min="0.001"
                    step="0.001"
                    value={formularioAjusteStock.cantidad}
                    onChange={(evento) => actualizarCampoAjusteStock("cantidad", evento.target.value)}
                    className="rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:bg-slate-700 dark:text-white"
                    placeholder="Cantidad a ajustar"
                    required
                    disabled={enviandoAjusteStock}
                  />
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {formularioAjusteStock.tipo_ajuste === 'ENTRADA' && "Se agregará esta cantidad al stock"}
                    {(formularioAjusteStock.tipo_ajuste === 'SALIDA' || formularioAjusteStock.tipo_ajuste === 'MERMA') && "Se quitará esta cantidad del stock"}
                    {(formularioAjusteStock.tipo_ajuste === 'CORRECCION' || formularioAjusteStock.tipo_ajuste === 'DEVOLUCION') && "Se ajustará el stock según corresponda"}
                  </p>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="ajuste-motivo">
                    Motivo *
                  </label>
                  <textarea
                    id="ajuste-motivo"
                    value={formularioAjusteStock.motivo}
                    onChange={(evento) => actualizarCampoAjusteStock("motivo", evento.target.value)}
                    className="rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:bg-slate-700 dark:text-white"
                    placeholder="Describe el motivo del ajuste (ej: Inventario físico, pérdida, rotura, etc.)"
                    rows={2}
                    required
                    disabled={enviandoAjusteStock}
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="ajuste-usuario">
                    Usuario responsable
                  </label>
                  <input
                    id="ajuste-usuario"
                    type="text"
                    value={formularioAjusteStock.usuario}
                    onChange={(evento) => actualizarCampoAjusteStock("usuario", evento.target.value)}
                    className="rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:bg-slate-700 dark:text-white"
                    placeholder="Nombre del usuario que realiza el ajuste"
                    disabled={enviandoAjusteStock}
                  />
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="submit"
                    className="inline-flex items-center gap-2 rounded-full bg-orange-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-500 disabled:cursor-not-allowed disabled:bg-orange-300"
                    disabled={enviandoAjusteStock}
                  >
                    {enviandoAjusteStock ? "Ajustando..." : "Ajustar stock"}
                  </button>
                  {mensajeExitoAjusteStock && (
                    <span className="text-sm font-medium text-emerald-600">{mensajeExitoAjusteStock}</span>
                  )}
                  {mensajeErrorAjusteStock && (
                    <span className="text-sm font-medium text-red-600">{mensajeErrorAjusteStock}</span>
                  )}
                </div>

                {formularioAjusteStock.materiaPrima && (
                  <div className="border-t border-slate-200 dark:border-slate-600 pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Historial de ajustes</h3>
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-medium text-slate-500 dark:text-slate-400" htmlFor="mostrar-historial">
                          Mostrar historial
                        </label>
                        <input
                          id="mostrar-historial"
                          type="checkbox"
                          checked={mostrandoHistorial}
                          onChange={async (evento) => {
                            setMostrandoHistorial(evento.target.checked);
                            if (evento.target.checked && formularioAjusteStock.materiaPrima) {
                              await cargarHistorialAjustes(Number(formularioAjusteStock.materiaPrima));
                            }
                          }}
                          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    {mostrandoHistorial && (
                      <div>
                        {cargandoHistorial && (
                          <p className="text-sm text-slate-500 dark:text-slate-400">Cargando historial...</p>
                        )}
                        {!cargandoHistorial && historialAjustes.length === 0 && (
                          <p className="text-sm text-slate-500 dark:text-slate-400">Sin ajustes registrados para esta materia prima.</p>
                        )}
                        {!cargandoHistorial && historialAjustes.length > 0 && (
                          <div className="space-y-2 max-h-60 overflow-y-auto">
                            {historialAjustes.map((ajuste) => (
                              <div key={ajuste.id} className="rounded-lg bg-slate-50 dark:bg-slate-700 p-3 text-xs">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                                    {ajuste.tipo_ajuste.toUpperCase()}
                                  </span>
                                  <span className="text-slate-500 dark:text-slate-400">{ajuste.fecha}</span>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-slate-600 dark:text-slate-400">
                                  <div>
                                    <p>Cantidad: {ajuste.cantidad > 0 ? '+' : ''}{formatearDecimal(ajuste.cantidad)}</p>
                                    <p>Usuario: {ajuste.usuario}</p>
                                  </div>
                                  <div>
                                    <p>Stock: {formatearDecimal(ajuste.stock_anterior)} → {formatearDecimal(ajuste.stock_nuevo)}</p>
                                    <p className="text-xs">Motivo: {ajuste.motivo}</p>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </form>
            </div>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Resumen por proveedor</h2>
          {cargandoResumen && <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Calculando resumen...</p>}
          {errorResumen && (
            <p className="mt-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              No fue posible calcular el resumen. Detalle: {errorResumen.message || "error desconocido"}
            </p>
          )}
          {!cargandoResumen && !errorResumen && resumenProveedores.length === 0 && (
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Sin datos suficientes.</p>
          )}
          {!cargandoResumen && !errorResumen && resumenProveedores.length > 0 && (
            <ul className="mt-4 space-y-2 text-sm text-slate-600 dark:text-slate-400">
              {resumenProveedores.map((item) => (
                <li
                  key={item.proveedor_id}
                  className="flex items-center justify-between rounded-lg bg-slate-50 dark:bg-slate-700 px-3 py-2"
                >
                  <span className="font-medium text-slate-700 dark:text-slate-300">{item.proveedor}</span>
                  <div className="text-right text-xs">
                    <p>Compras: {formatearEntero(item.compras)}</p>
                    <p>Total: ${formatearEntero(item.total)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Resumen por categoria</h2>
          {cargandoResumen && <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Calculando resumen...</p>}
          {errorResumen && (
            <p className="mt-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              No fue posible calcular el resumen. Detalle: {errorResumen.message || "error desconocido"}
            </p>
          )}
          {!cargandoResumen && !errorResumen && resumenCategorias.length === 0 && (
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Sin datos suficientes.</p>
          )}
          {!cargandoResumen && !errorResumen && resumenCategorias.length > 0 && (
            <ul className="mt-4 space-y-2 text-sm text-slate-600 dark:text-slate-400">
              {resumenCategorias.map((item, index) => (
                <li
                  key={item.categoria_id ?? `sin-categoria-${index}`}
                  className="flex items-center justify-between rounded-lg bg-slate-50 dark:bg-slate-700 px-3 py-2"
                >
                  <span className="font-medium text-slate-700 dark:text-slate-300">{item.categoria || "Sin categoria"}</span>
                  <div className="text-right text-xs">
                    <p>Compras: {formatearEntero(item.compras)}</p>
                    <p>Total: ${formatearEntero(item.total)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </aside>
    </section>
  );
};

export default ComprasPage;
