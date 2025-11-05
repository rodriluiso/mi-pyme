import type { FormEvent } from "react";
import { useState } from "react";
import { useApi } from "@/hooks/useApi";
import { useListado } from "@/hooks/useListado";
import type { ApiError } from "@/lib/api/types";
import type { Producto } from "@/types/mipyme";

const formatearDecimal = (valor: string | number | null | undefined, decimales = 2) => {
  const numero = Number(valor ?? "0");
  if (Number.isNaN(numero)) {
    return "0";
  }
  return numero.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: decimales });
};

type FormularioProducto = {
  nombre: string;
  sku: string;
  descripcion: string;
  stockInicial: string;
  stockKgInicial: string;
  stockMinimo: string;
  stockMinimoKg: string;
  activo: boolean;
};

const estadoInicialProducto: FormularioProducto = {
  nombre: "",
  sku: "",
  descripcion: "",
  stockInicial: "0",
  stockKgInicial: "0",
  stockMinimo: "0",
  stockMinimoKg: "0",
  activo: true
};

type FormularioStock = {
  producto: string;
  accion: "agregar" | "quitar";
  cantidad: string;
  cantidadKg: string;
};

const estadoInicialStock: FormularioStock = {
  producto: "",
  accion: "agregar",
  cantidad: "",
  cantidadKg: ""
};

const ProductosPage = () => {
  const { datos: productos, cargando, error, recargar } = useListado<Producto>("/productos/");
  const { request } = useApi();

  const [formProducto, setFormProducto] = useState<FormularioProducto>(estadoInicialProducto);
  const [mensajeProducto, setMensajeProducto] = useState<string | null>(null);
  const [errorProducto, setErrorProducto] = useState<string | null>(null);
  const [enviandoProducto, setEnviandoProducto] = useState(false);

  const [formStock, setFormStock] = useState<FormularioStock>(estadoInicialStock);
  const [mensajeStock, setMensajeStock] = useState<string | null>(null);
  const [errorStock, setErrorStock] = useState<string | null>(null);
  const [enviandoStock, setEnviandoStock] = useState(false);

  const [formularioProductoExpandido, setFormularioProductoExpandido] = useState(false);

  const manejarCambioProducto = (campo: keyof FormularioProducto, valor: string | boolean) => {
    setFormProducto((prev) => ({ ...prev, [campo]: valor }));
  };

  const manejarCambioStock = (campo: keyof FormularioStock, valor: string) => {
    setFormStock((prev) => ({ ...prev, [campo]: valor }));
  };

  const limpiarMensajes = () => {
    setMensajeProducto(null);
    setErrorProducto(null);
    setMensajeStock(null);
    setErrorStock(null);
  };

  const registrarProducto = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    limpiarMensajes();

    if (!formProducto.nombre.trim()) {
      setErrorProducto("El nombre es obligatorio");
      return;
    }

    const stockValor = Number(formProducto.stockInicial || 0);
    if (Number.isNaN(stockValor) || stockValor < 0) {
      setErrorProducto("Ingresa un stock inicial valido");
      return;
    }

    const stockKgValor = Number(formProducto.stockKgInicial || 0);
    if (Number.isNaN(stockKgValor) || stockKgValor < 0) {
      setErrorProducto("Ingresa un stock en kg valido");
      return;
    }

    setEnviandoProducto(true);
    try {
      await request<Producto>({
        method: "POST",
        url: "/productos/",
        data: {
          nombre: formProducto.nombre.trim(),
          sku: formProducto.sku.trim() || undefined,
          descripcion: formProducto.descripcion.trim() || undefined,
          precio: "0",
          stock: stockValor.toString(),
          stock_kg: stockKgValor.toString(),
          stock_minimo: formProducto.stockMinimo || "0",
          stock_minimo_kg: formProducto.stockMinimoKg || "0",
          activo: formProducto.activo
        }
      });
      setMensajeProducto("Producto creado correctamente");
      setFormProducto(estadoInicialProducto);
      await recargar();
    } catch (err) {
      const apiError = err as ApiError;
      setErrorProducto(apiError.message || "No se pudo crear el producto");
    } finally {
      setEnviandoProducto(false);
    }
  };

  const ajustarStock = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    limpiarMensajes();

    if (!formStock.producto) {
      setErrorStock("Selecciona un producto");
      return;
    }

    const cantidadValor = Number(formStock.cantidad);
    if (!formStock.cantidad || Number.isNaN(cantidadValor) || cantidadValor <= 0) {
      setErrorStock("Ingresa una cantidad valida");
      return;
    }

    const cantidadKgValor = formStock.cantidadKg ? Number(formStock.cantidadKg) : null;
    if (formStock.cantidadKg && (Number.isNaN(cantidadKgValor) || cantidadKgValor! < 0)) {
      setErrorStock("Ingresa una cantidad en kg valida");
      return;
    }

    setEnviandoStock(true);
    try {
      const endpoint = formStock.accion === "agregar" ? "agregar-stock" : "quitar-stock";
      const data: { cantidad: string; cantidad_kg?: string } = {
        cantidad: cantidadValor.toString()
      };
      if (cantidadKgValor !== null) {
        data.cantidad_kg = cantidadKgValor.toString();
      }
      await request<Producto>({
        method: "POST",
        url: `/productos/${formStock.producto}/${endpoint}/`,
        data
      });
      setMensajeStock("Stock actualizado correctamente");
      setFormStock((prev) => ({ ...estadoInicialStock, producto: prev.producto }));
      await recargar();
    } catch (err) {
      const apiError = err as ApiError;
      setErrorStock(apiError.message || "No se pudo actualizar el stock");
    } finally {
      setEnviandoStock(false);
    }
  };

  return (
    <section className="grid gap-6 lg:grid-cols-[minmax(0,1.8fr)_360px]">
      <div className="space-y-4">
        <header className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Productos</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Administra el catalogo y el stock disponible para tus ventas.</p>
          <button
            type="button"
            onClick={() => recargar()}
            className="inline-flex w-fit items-center rounded-full border border-slate-200 dark:border-slate-700 px-4 py-1 text-sm font-medium text-slate-600 dark:text-slate-400 transition hover:border-blue-200 hover:text-blue-600 dark:hover:border-blue-500 dark:hover:text-blue-400"
          >
            Recargar listado
          </button>
        </header>

        {error && (
          <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/30 p-4 text-sm text-red-700 dark:text-red-400">
            No fue posible obtener los productos. Detalle: {error.message || "error desconocido"}
          </div>
        )}

        {!cargando && !error && productos.length === 0 && (
          <p className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 text-sm text-slate-500 dark:text-slate-400">
            Todavia no hay productos cargados. Registra uno desde el panel derecho.
          </p>
        )}

        {!cargando && productos.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700 text-left text-sm text-slate-700 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-700 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3">Nombre</th>
                  <th className="px-4 py-3">SKU</th>
                  <th className="px-4 py-3 text-right">Precio</th>
                  <th className="px-4 py-3 text-right">Stock (u)</th>
                  <th className="px-4 py-3 text-right">Stock (kg)</th>
                  <th className="px-4 py-3">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {productos.map((producto) => (
                  <tr key={producto.id} className="hover:bg-slate-50 dark:hover:bg-slate-700">
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{producto.nombre}</td>
                    <td className="px-4 py-3">{producto.sku || "-"}</td>
                    <td className="px-4 py-3 text-right">${formatearDecimal(producto.precio)}</td>
                    <td className="px-4 py-3 text-right">
                      {formatearDecimal(producto.stock, 2)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {formatearDecimal(producto.stock_kg, 3)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          producto.activo ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400" : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400"
                        }`}
                      >
                        {producto.activo ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <aside className="flex h-fit flex-col gap-5">
        <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm">
          <button
            type="button"
            onClick={() => setFormularioProductoExpandido(!formularioProductoExpandido)}
            className="w-full text-left focus:outline-none"
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Agregar producto</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Completa los datos basicos y un stock inicial para comenzar a vender.</p>
              </div>
              <div className="flex items-center">
                <span className="text-xs text-slate-400 dark:text-slate-500 mr-2">
                  {formularioProductoExpandido ? "Contraer" : "Expandir"}
                </span>
                <svg
                  className={`w-5 h-5 text-slate-400 dark:text-slate-500 transition-transform duration-200 ${
                    formularioProductoExpandido ? "transform rotate-180" : ""
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

          {formularioProductoExpandido && (
            <div className="animate-in slide-in-from-top-2 duration-200">
              <form className="mt-4 grid gap-3" onSubmit={registrarProducto}>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="prod-nombre">Nombre *</label>
              <input
                id="prod-nombre"
                type="text"
                value={formProducto.nombre}
                onChange={(evento) => manejarCambioProducto("nombre", evento.target.value)}
                className="rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:bg-slate-700 dark:text-white"
                placeholder="Ej: Caja por 12 unidades"
                disabled={enviandoProducto}
                required
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="prod-sku">SKU</label>
              <input
                id="prod-sku"
                type="text"
                value={formProducto.sku}
                onChange={(evento) => manejarCambioProducto("sku", evento.target.value)}
                className="rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:bg-slate-700 dark:text-white"
                placeholder="Codigo interno"
                disabled={enviandoProducto}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="prod-stock">Stock inicial (unidades)</label>
                <input
                  id="prod-stock"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formProducto.stockInicial}
                  onChange={(evento) => manejarCambioProducto("stockInicial", evento.target.value)}
                  className="rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:bg-slate-700 dark:text-white"
                  placeholder="Ej: 20"
                  disabled={enviandoProducto}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="prod-stock-kg">Stock inicial (kg)</label>
                <input
                  id="prod-stock-kg"
                  type="number"
                  min="0"
                  step="0.001"
                  value={formProducto.stockKgInicial}
                  onChange={(evento) => manejarCambioProducto("stockKgInicial", evento.target.value)}
                  className="rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:bg-slate-700 dark:text-white"
                  placeholder="Ej: 60"
                  disabled={enviandoProducto}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="prod-stock-minimo">Stock mínimo (u)</label>
                <input
                  id="prod-stock-minimo"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formProducto.stockMinimo}
                  onChange={(evento) => manejarCambioProducto("stockMinimo", evento.target.value)}
                  className="rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:bg-slate-700 dark:text-white"
                  placeholder="Ej: 5"
                  disabled={enviandoProducto}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="prod-stock-minimo-kg">Stock mínimo (kg)</label>
                <input
                  id="prod-stock-minimo-kg"
                  type="number"
                  min="0"
                  step="0.001"
                  value={formProducto.stockMinimoKg}
                  onChange={(evento) => manejarCambioProducto("stockMinimoKg", evento.target.value)}
                  className="rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:bg-slate-700 dark:text-white"
                  placeholder="Ej: 15"
                  disabled={enviandoProducto}
                />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="prod-descripcion">Descripcion</label>
              <textarea
                id="prod-descripcion"
                value={formProducto.descripcion}
                onChange={(evento) => manejarCambioProducto("descripcion", evento.target.value)}
                className="rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:bg-slate-700 dark:text-white"
                rows={2}
                placeholder="Detalle corto del producto"
                disabled={enviandoProducto}
              />
            </div>
            <label className="flex items-center gap-2 text-sm dark:text-slate-300" htmlFor="prod-activo">
              <input
                id="prod-activo"
                type="checkbox"
                checked={formProducto.activo}
                onChange={(evento) => manejarCambioProducto("activo", evento.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                disabled={enviandoProducto}
              />
              Activo para ventas
            </label>
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={enviandoProducto}
                className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-blue-300"
              >
                {enviandoProducto ? "Guardando..." : "Guardar producto"}
              </button>
              {mensajeProducto && <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">{mensajeProducto}</span>}
              {errorProducto && <span className="text-sm font-medium text-red-600 dark:text-red-400">{errorProducto}</span>}
            </div>
          </form>
            </div>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Ajustar stock</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Suma produccion o descuenta ventas manuales impactando el stock actual.</p>
          <form className="mt-4 grid gap-3" onSubmit={ajustarStock}>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="stock-producto">Producto *</label>
              <select
                id="stock-producto"
                value={formStock.producto}
                onChange={(evento) => manejarCambioStock("producto", evento.target.value)}
                className="rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:bg-slate-700 dark:text-white"
                disabled={enviandoStock}
                required
              >
                <option value="">Selecciona un producto</option>
                {productos.map((producto) => (
                   <option key={producto.id} value={producto.id}>
                     {producto.nombre} ({formatearDecimal(producto.stock)}u / {formatearDecimal(producto.stock_kg, 3)}kg)
                   </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="stock-accion">Accion *</label>
              <select
                id="stock-accion"
                value={formStock.accion}
                onChange={(evento) => manejarCambioStock("accion", evento.target.value as "agregar" | "quitar")}
                className="rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:bg-slate-700 dark:text-white"
                disabled={enviandoStock}
              >
                <option value="agregar">Agregar stock</option>
                <option value="quitar">Quitar stock</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="stock-cantidad">Cantidad (unidades) *</label>
                <input
                  id="stock-cantidad"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={formStock.cantidad}
                  onChange={(evento) => manejarCambioStock("cantidad", evento.target.value)}
                  className="rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:bg-slate-700 dark:text-white"
                  disabled={enviandoStock}
                  required
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="stock-cantidad-kg">Cantidad (kg)</label>
                <input
                  id="stock-cantidad-kg"
                  type="number"
                  min="0"
                  step="0.001"
                  value={formStock.cantidadKg}
                  onChange={(evento) => manejarCambioStock("cantidadKg", evento.target.value)}
                  className="rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:bg-slate-700 dark:text-white"
                  placeholder="Opcional"
                  disabled={enviandoStock}
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={enviandoStock}
                className="inline-flex items-center gap-2 rounded-full bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-500 disabled:cursor-not-allowed disabled:bg-amber-300"
              >
                {enviandoStock ? "Actualizando..." : "Aplicar cambio"}
              </button>
              {mensajeStock && <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">{mensajeStock}</span>}
              {errorStock && <span className="text-sm font-medium text-red-600 dark:text-red-400">{errorStock}</span>}
            </div>
          </form>
        </section>
      </aside>
    </section>
  );
};

export default ProductosPage;
