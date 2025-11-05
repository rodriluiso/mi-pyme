import type { FormEvent } from "react";
import { useMemo, useState } from "react";
import { useApi } from "@/hooks/useApi";
import { useListado } from "@/hooks/useListado";
import type { ApiError } from "@/lib/api/types";
import type { Proveedor } from "@/types/mipyme";

const formatearDecimal = (valor: string | number | null | undefined) => {
  const numero = Number(valor ?? 0);
  if (Number.isNaN(numero)) {
    return "0";
  }
  return numero.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const mediosPago = [
  { value: "EFECTIVO", label: "Efectivo" },
  { value: "TRANSFERENCIA", label: "Transferencia" },
  { value: "CHEQUE", label: "Cheque" }
];

type FormularioProveedor = {
  nombre: string;
  identificacion: string;
  contacto: string;
  telefono: string;
  correo: string;
  direccion: string;
  notas: string;
  activo: boolean;
};

type FormularioPagoProveedor = {
  proveedor: string;
  monto: string;
  medio: string;
  fecha: string;
  observacion: string;
};

const estadoInicialFormulario: FormularioProveedor = {
  nombre: "",
  identificacion: "",
  contacto: "",
  telefono: "",
  correo: "",
  direccion: "",
  notas: "",
  activo: true
};

const crearEstadoInicialPago = (): FormularioPagoProveedor => ({
  proveedor: "",
  monto: "",
  medio: "EFECTIVO",
  fecha: new Date().toISOString().slice(0, 10),
  observacion: ""
});

const ProveedoresPage = () => {
  const { datos: proveedores, cargando, error, recargar } = useListado<Proveedor>("/proveedores/");
  const { request } = useApi();

  const [formulario, setFormulario] = useState<FormularioProveedor>(estadoInicialFormulario);
  const [enviandoProveedor, setEnviandoProveedor] = useState(false);
  const [mensajeExitoProveedor, setMensajeExitoProveedor] = useState<string | null>(null);
  const [mensajeErrorProveedor, setMensajeErrorProveedor] = useState<string | null>(null);
  const [modoEdicion, setModoEdicion] = useState<Proveedor | null>(null);

  const [formularioPago, setFormularioPago] = useState<FormularioPagoProveedor>(crearEstadoInicialPago());
  const [enviandoPago, setEnviandoPago] = useState(false);
  const [mensajeExitoPago, setMensajeExitoPago] = useState<string | null>(null);
  const [mensajeErrorPago, setMensajeErrorPago] = useState<string | null>(null);

  const [formularioProveedorExpandido, setFormularioProveedorExpandido] = useState(false);

  const proveedoresOrdenados = useMemo(() => {
    return [...proveedores].sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [proveedores]);

  const limpiarMensajesProveedor = () => {
    setMensajeExitoProveedor(null);
    setMensajeErrorProveedor(null);
  };

  const limpiarMensajesPago = () => {
    setMensajeExitoPago(null);
    setMensajeErrorPago(null);
  };

  const actualizarCampoProveedor = (campo: keyof FormularioProveedor, valor: string | boolean) => {
    setFormulario((prev) => ({ ...prev, [campo]: valor }));
  };

  const actualizarCampoPago = (campo: keyof FormularioPagoProveedor, valor: string) => {
    setFormularioPago((prev) => ({ ...prev, [campo]: valor }));
  };

  const prepararEdicion = (proveedor: Proveedor) => {
    setModoEdicion(proveedor);
    setFormulario({
      nombre: proveedor.nombre,
      identificacion: proveedor.identificacion,
      contacto: proveedor.contacto,
      telefono: proveedor.telefono,
      correo: proveedor.correo,
      direccion: proveedor.direccion,
      notas: proveedor.notas,
      activo: proveedor.activo
    });
    setFormularioProveedorExpandido(true);
    limpiarMensajesProveedor();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelarEdicion = () => {
    setModoEdicion(null);
    setFormulario(estadoInicialFormulario);
    limpiarMensajesProveedor();
  };

  const prepararPago = (proveedor: Proveedor) => {
    setFormularioPago((prev) => ({
      proveedor: String(proveedor.id),
      monto: "",
      medio: prev.medio || "EFECTIVO",
      fecha: prev.fecha || new Date().toISOString().slice(0, 10),
      observacion:
        prev.proveedor === String(proveedor.id) && prev.observacion
          ? prev.observacion
          : `Pago a ${proveedor.nombre}`
    }));
    limpiarMensajesPago();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const manejarSubmitProveedor = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    limpiarMensajesProveedor();

    if (!formulario.nombre.trim()) {
      setMensajeErrorProveedor("El nombre es obligatorio");
      return;
    }

    setEnviandoProveedor(true);
    try {
      const payload = {
        nombre: formulario.nombre.trim(),
        identificacion: formulario.identificacion.trim(),
        contacto: formulario.contacto.trim(),
        telefono: formulario.telefono.trim(),
        correo: formulario.correo.trim(),
        direccion: formulario.direccion.trim(),
        notas: formulario.notas.trim(),
        activo: formulario.activo
      };

      if (modoEdicion) {
        await request<Proveedor>({
          method: "PUT",
          url: `/proveedores/${modoEdicion.id}/`,
          data: payload
        });
        setMensajeExitoProveedor("Proveedor actualizado correctamente");
      } else {
        await request<Proveedor>({
          method: "POST",
          url: "/proveedores/",
          data: payload
        });
        setMensajeExitoProveedor("Proveedor creado correctamente");
      }

      setFormulario(estadoInicialFormulario);
      setModoEdicion(null);
      await recargar();
    } catch (err) {
      const apiError = err as ApiError;
      let detalle = apiError.message || "No se pudo guardar el proveedor";
      if (apiError.data && typeof apiError.data === "object") {
        const valores = Object.values(apiError.data as Record<string, unknown>);
        const primerMensaje = valores.find((valor) => typeof valor === "string" || Array.isArray(valor));
        if (typeof primerMensaje === "string") {
          detalle = primerMensaje;
        } else if (Array.isArray(primerMensaje) && primerMensaje.length > 0) {
          const primerItem = primerMensaje[0];
          if (typeof primerItem === "string") {
            detalle = primerItem;
          }
        }
      }
      setMensajeErrorProveedor(detalle);
    } finally {
      setEnviandoProveedor(false);
    }
  };

  const manejarRegistroPago = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    limpiarMensajesPago();

    if (!formularioPago.proveedor) {
      setMensajeErrorPago("Selecciona un proveedor");
      return;
    }
    const montoNumero = Number(formularioPago.monto);
    if (!formularioPago.monto || Number.isNaN(montoNumero) || montoNumero <= 0) {
      setMensajeErrorPago("Ingresa un monto valido");
      return;
    }
    if (!formularioPago.medio) {
      setMensajeErrorPago("Selecciona un medio de pago");
      return;
    }

    setEnviandoPago(true);
    try {
      await request({
        method: "POST",
        url: "/finanzas/pagos-proveedores/",
        data: {
          proveedor: Number(formularioPago.proveedor),
          monto: formularioPago.monto,
          medio: formularioPago.medio,
          fecha: formularioPago.fecha || undefined,
          observacion: formularioPago.observacion.trim() || undefined
        }
      });
      setMensajeExitoPago("Pago registrado correctamente");
      setFormularioPago((prev) => ({
        ...crearEstadoInicialPago(),
        proveedor: prev.proveedor,
        medio: prev.medio || "EFECTIVO"
      }));
      await recargar();
    } catch (err) {
      const apiError = err as ApiError;
      let detalle = apiError.message || "No se pudo registrar el pago";
      if (apiError.data && typeof apiError.data === "object") {
        const valores = Object.values(apiError.data as Record<string, unknown>);
        const primerMensaje = valores.find((valor) => typeof valor === "string" || Array.isArray(valor));
        if (typeof primerMensaje === "string") {
          detalle = primerMensaje;
        } else if (Array.isArray(primerMensaje) && primerMensaje.length > 0) {
          const primerItem = primerMensaje[0];
          if (typeof primerItem === "string") {
            detalle = primerItem;
          }
        }
      }
      setMensajeErrorPago(detalle);
    } finally {
      setEnviandoPago(false);
    }
  };

  const eliminarProveedor = async (proveedor: Proveedor) => {
    const confirmar = window.confirm(`Seguro que deseas borrar a ${proveedor.nombre}?`);
    if (!confirmar) return;
    limpiarMensajesProveedor();
    setEnviandoProveedor(true);
    try {
      await request<void>({
        method: "DELETE",
        url: `/proveedores/${proveedor.id}/`
      });
      setMensajeExitoProveedor("Proveedor eliminado correctamente");
      if (modoEdicion?.id === proveedor.id) {
        cancelarEdicion();
      }
      await recargar();
    } catch (err) {
      const apiError = err as ApiError;
      setMensajeErrorProveedor(apiError.message || "No se pudo eliminar el proveedor");
    } finally {
      setEnviandoProveedor(false);
    }
  };

  return (
    <section className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_360px] lg:items-start">
      <header className="flex flex-col gap-2 lg:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Proveedores</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Gestiona proveedores, contactos y controla su estado de cuenta.</p>
          </div>
          <button
            type="button"
            onClick={() => void recargar()}
            className="inline-flex items-center rounded-full border border-slate-200 dark:border-slate-700 px-4 py-1 text-sm font-medium text-slate-600 dark:text-slate-400 transition hover:border-blue-200 hover:text-blue-600 dark:hover:border-blue-500 dark:hover:text-blue-400"
          >
            Recargar datos
          </button>
        </div>
      </header>

      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm">
        {cargando && <p className="p-4 text-sm text-slate-500 dark:text-slate-400">Cargando proveedores...</p>}
        {error && !cargando && (
          <p className="p-4 text-sm text-red-600 dark:text-red-400">No fue posible obtener los proveedores. {error.message || "Error"}</p>
        )}
        {!cargando && !error && proveedoresOrdenados.length === 0 && (
          <p className="p-4 text-sm text-slate-500 dark:text-slate-400">Todavia no hay proveedores cargados.</p>
        )}
        {!cargando && !error && proveedoresOrdenados.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700 text-left text-sm text-slate-700 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-700 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3">Nombre</th>
                  <th className="px-4 py-3">Identificacion</th>
                  <th className="px-4 py-3">Contacto</th>
                  <th className="px-4 py-3">Telefono</th>
                  <th className="px-4 py-3">Correo</th>
                  <th className="px-4 py-3 text-right">Saldo</th>
                  <th className="px-4 py-3 text-right">Comprado</th>
                  <th className="px-4 py-3 text-right">Pagado</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {proveedoresOrdenados.map((proveedor) => {
                  const totalCompras = formatearDecimal(proveedor.total_compras);
                  const totalPagado = formatearDecimal(proveedor.total_pagado);
                  const saldoNumero = Number(proveedor.saldo ?? 0);
                  const saldoTexto = formatearDecimal(proveedor.saldo);
                  const saldoClase =
                    saldoNumero > 0 ? "text-red-600 dark:text-red-400" : saldoNumero < 0 ? "text-emerald-600 dark:text-emerald-400" : "text-slate-700 dark:text-slate-300";
                  return (
                    <tr key={proveedor.id} className="hover:bg-slate-50 dark:hover:bg-slate-700">
                      <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{proveedor.nombre}</td>
                      <td className="px-4 py-3">{proveedor.identificacion || "-"}</td>
                      <td className="px-4 py-3">{proveedor.contacto || "-"}</td>
                      <td className="px-4 py-3">{proveedor.telefono || "-"}</td>
                      <td className="px-4 py-3">{proveedor.correo || "-"}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`font-semibold ${saldoClase}`}>${saldoTexto}</span>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-400">${totalCompras}</td>
                      <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-400">${totalPagado}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            proveedor.activo ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400" : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400"
                          }`}
                        >
                          {proveedor.activo ? "Activo" : "Inactivo"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex flex-wrap justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => prepararPago(proveedor)}
                            className="rounded-full border border-amber-200 dark:border-amber-600 px-3 py-1 text-xs font-medium text-amber-700 dark:text-amber-400 transition hover:bg-amber-50 dark:hover:bg-amber-900/30"
                          >
                            Ingresar pago
                          </button>
                          <button
                            type="button"
                            onClick={() => prepararEdicion(proveedor)}
                            className="rounded-full border border-blue-200 dark:border-blue-600 px-3 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 transition hover:bg-blue-50 dark:hover:bg-blue-900/30"
                          >
                            Modificar
                          </button>
                          <button
                            type="button"
                            onClick={() => eliminarProveedor(proveedor)}
                            className="rounded-full border border-red-200 dark:border-red-600 px-3 py-1 text-xs font-medium text-red-600 dark:text-red-400 transition hover:bg-red-50 dark:hover:bg-red-900/30"
                          >
                            Borrar
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <aside className="flex flex-col gap-5">
        <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm">
          <button
            type="button"
            onClick={() => setFormularioProveedorExpandido(!formularioProveedorExpandido)}
            className="w-full text-left focus:outline-none"
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                  {modoEdicion ? "Editar proveedor" : "Agregar proveedor"}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Gestiona los datos del proveedor y su información de contacto.</p>
              </div>
              <div className="flex items-center">
                <span className="text-xs text-slate-400 dark:text-slate-500 mr-2">
                  {formularioProveedorExpandido ? "Contraer" : "Expandir"}
                </span>
                <svg
                  className={`w-5 h-5 text-slate-400 dark:text-slate-500 transition-transform duration-200 ${
                    formularioProveedorExpandido ? "transform rotate-180" : ""
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

          {formularioProveedorExpandido && (
            <div className="animate-in slide-in-from-top-2 duration-200">
              <form className="mt-4 grid gap-4" onSubmit={manejarSubmitProveedor}>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="prov-nombre">
                Nombre *
              </label>
              <input
                id="prov-nombre"
                type="text"
                value={formulario.nombre}
                onChange={(evento) => actualizarCampoProveedor("nombre", evento.target.value)}
                className="rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:bg-slate-700 dark:text-white"
                placeholder="Ej: Proveedor SA"
                disabled={enviandoProveedor}
                required
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="prov-identificacion">
                Identificacion
              </label>
              <input
                id="prov-identificacion"
                type="text"
                value={formulario.identificacion}
                onChange={(evento) => actualizarCampoProveedor("identificacion", evento.target.value)}
                className="rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:bg-slate-700 dark:text-white"
                placeholder="CUIT/ID"
                disabled={enviandoProveedor}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="prov-contacto">
                Contacto
              </label>
              <input
                id="prov-contacto"
                type="text"
                value={formulario.contacto}
                onChange={(evento) => actualizarCampoProveedor("contacto", evento.target.value)}
                className="rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:bg-slate-700 dark:text-white"
                placeholder="Persona de contacto"
                disabled={enviandoProveedor}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="prov-telefono">
                Telefono
              </label>
              <input
                id="prov-telefono"
                type="tel"
                value={formulario.telefono}
                onChange={(evento) => actualizarCampoProveedor("telefono", evento.target.value)}
                className="rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:bg-slate-700 dark:text-white"
                placeholder="Ej: 11-1234-5678"
                disabled={enviandoProveedor}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="prov-correo">
                Correo
              </label>
              <input
                id="prov-correo"
                type="email"
                value={formulario.correo}
                onChange={(evento) => actualizarCampoProveedor("correo", evento.target.value)}
                className="rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:bg-slate-700 dark:text-white"
                placeholder="contacto@empresa.com"
                disabled={enviandoProveedor}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="prov-direccion">
                Direccion
              </label>
              <input
                id="prov-direccion"
                type="text"
                value={formulario.direccion}
                onChange={(evento) => actualizarCampoProveedor("direccion", evento.target.value)}
                className="rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:bg-slate-700 dark:text-white"
                placeholder="Calle, numero, localidad"
                disabled={enviandoProveedor}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="prov-notas">
                Notas
              </label>
              <textarea
                id="prov-notas"
                value={formulario.notas}
                onChange={(evento) => actualizarCampoProveedor("notas", evento.target.value)}
                className="rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:bg-slate-700 dark:text-white"
                rows={2}
                disabled={enviandoProveedor}
              />
            </div>
            <label className="flex items-center gap-2 text-sm dark:text-slate-300">
              <input
                id="prov-activo"
                type="checkbox"
                checked={formulario.activo}
                onChange={(evento) => actualizarCampoProveedor("activo", evento.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              Activo
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={enviandoProveedor}
                className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-blue-300"
              >
                {enviandoProveedor ? "Guardando..." : modoEdicion ? "Guardar cambios" : "Guardar proveedor"}
              </button>
              {modoEdicion && (
                <button
                  type="button"
                  onClick={cancelarEdicion}
                  className="rounded-full border border-slate-300 dark:border-slate-600 px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-400 transition hover:border-slate-400 dark:hover:border-slate-500"
                >
                  Cancelar
                </button>
              )}
              {mensajeExitoProveedor && <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">{mensajeExitoProveedor}</span>}
              {mensajeErrorProveedor && <span className="text-sm font-medium text-red-600 dark:text-red-400">{mensajeErrorProveedor}</span>}
            </div>
          </form>
            </div>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Registrar pago a proveedor</h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Selecciona el proveedor e ingresa el abono para actualizar su estado de cuenta.</p>
          <form className="mt-4 grid gap-4" onSubmit={manejarRegistroPago}>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="pago-proveedor">
                Proveedor *
              </label>
              <select
                id="pago-proveedor"
                value={formularioPago.proveedor}
                onChange={(evento) => actualizarCampoPago("proveedor", evento.target.value)}
                className="rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:bg-slate-700 dark:text-white"
                disabled={enviandoPago}
                required
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
                className="rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:bg-slate-700 dark:text-white"
                disabled={enviandoPago}
                required
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
                className="rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:bg-slate-700 dark:text-white"
                disabled={enviandoPago}
                required
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
                className="rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:bg-slate-700 dark:text-white"
                disabled={enviandoPago}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="pago-observacion">
                Observacion
              </label>
              <textarea
                id="pago-observacion"
                value={formularioPago.observacion}
                onChange={(evento) => actualizarCampoPago("observacion", evento.target.value)}
                className="rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:bg-slate-700 dark:text-white"
                rows={2}
                disabled={enviandoPago}
              />
            </div>
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={enviandoPago}
                className="inline-flex items-center gap-2 rounded-full bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-500 disabled:cursor-not-allowed disabled:bg-amber-300"
              >
                {enviandoPago ? "Registrando..." : "Registrar pago"}
              </button>
              {mensajeExitoPago && <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">{mensajeExitoPago}</span>}
              {mensajeErrorPago && <span className="text-sm font-medium text-red-600 dark:text-red-400">{mensajeErrorPago}</span>}
            </div>
          </form>
        </section>
      </aside>
    </section>
  );
};

export default ProveedoresPage;
