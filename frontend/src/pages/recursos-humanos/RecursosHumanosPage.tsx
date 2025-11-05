import { useState } from "react";
import { useApi } from "@/hooks/useApi";
import { useListado } from "@/hooks/useListado";
import type { ApiError } from "@/lib/api/types";
import type { Empleado, PagoEmpleado } from "@/types/mipyme";

const formatearDecimal = (valor: string | number | null | undefined) => {
  const numero = Number(valor ?? "0");
  if (Number.isNaN(numero)) {
    return "0";
  }
  return numero.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

type FormularioEmpleado = {
  nombre: string;
  apellidos: string;
  identificacion: string;
  cuil: string;
  telefono: string;
  fecha_ingreso: string;
  direccion: string;
  puesto: string;
};

type FormularioPago = {
  empleado: string;
  monto: string;
  medio_pago: string;
  concepto: string;
  generar_recibo: boolean;
};

const estadoInicialEmpleado: FormularioEmpleado = {
  nombre: "",
  apellidos: "",
  identificacion: "",
  cuil: "",
  telefono: "",
  fecha_ingreso: new Date().toISOString().slice(0, 10),
  direccion: "",
  puesto: ""
};

const estadoInicialPago: FormularioPago = {
  empleado: "",
  monto: "",
  medio_pago: "EFECTIVO",
  concepto: "",
  generar_recibo: false
};

const RecursosHumanosPage = () => {
  const { request } = useApi();

  // Estados para datos
  const {
    datos: empleados,
    cargando: cargandoEmpleados,
    error: errorEmpleados,
    recargar: recargarEmpleados
  } = useListado<Empleado>("/rrhh/empleados/");

  const {
    datos: pagos,
    cargando: cargandoPagos,
    error: errorPagos,
    recargar: recargarPagos
  } = useListado<PagoEmpleado>("/rrhh/pagos/");

  // Estados para formularios
  const [formularioEmpleado, setFormularioEmpleado] = useState<FormularioEmpleado>(estadoInicialEmpleado);
  const [formularioPago, setFormularioPago] = useState<FormularioPago>(estadoInicialPago);
  const [formularioEmpleadoExpandido, setFormularioEmpleadoExpandido] = useState(false);

  // Estados para loading y errores
  const [enviandoEmpleado, setEnviandoEmpleado] = useState(false);
  const [enviandoPago, setEnviandoPago] = useState(false);
  const [errorFormularioEmpleado, setErrorFormularioEmpleado] = useState<ApiError | null>(null);
  const [errorFormularioPago, setErrorFormularioPago] = useState<ApiError | null>(null);

  const recargarTodo = async () => {
    await Promise.all([recargarEmpleados(), recargarPagos()]);
  };

  const agregarEmpleado = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formularioEmpleado.nombre.trim() || !formularioEmpleado.apellidos.trim()) return;

    setEnviandoEmpleado(true);
    setErrorFormularioEmpleado(null);

    try {
      await request({
        method: "POST",
        url: "/rrhh/empleados/",
        data: formularioEmpleado
      });

      setFormularioEmpleado(estadoInicialEmpleado);
      setFormularioEmpleadoExpandido(false);
      await recargarEmpleados();
    } catch (error) {
      setErrorFormularioEmpleado(error as ApiError);
    } finally {
      setEnviandoEmpleado(false);
    }
  };

  const registrarPago = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formularioPago.empleado || !formularioPago.monto) return;

    setEnviandoPago(true);
    setErrorFormularioPago(null);

    try {
      await request({
        method: "POST",
        url: "/rrhh/pagos/",
        data: {
          ...formularioPago,
          empleado: Number(formularioPago.empleado),
          monto: Number(formularioPago.monto)
        }
      });

      setFormularioPago(estadoInicialPago);
      await Promise.all([recargarPagos(), recargarTodo()]);
    } catch (error) {
      setErrorFormularioPago(error as ApiError);
    } finally {
      setEnviandoPago(false);
    }
  };

  const empleadosActivos = empleados.filter(emp => emp.activo);

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Recursos Humanos</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Gestiona empleados, registra pagos y genera recibos de sueldo.
            </p>
          </div>
          <button
            type="button"
            onClick={() => recargarTodo()}
            className="inline-flex items-center rounded-full border border-slate-200 px-4 py-1 text-sm font-medium text-slate-600 dark:text-slate-400 transition hover:border-blue-200 hover:text-blue-600"
          >
            Recargar datos
          </button>
        </div>
      </section>

      {/* Layout principal con contenido central y paneles laterales */}
      <section className="grid gap-6 lg:grid-cols-3">
        {/* Contenido principal - Lista de empleados y pagos */}
        <div className="lg:col-span-2 space-y-6">
          {/* Lista de empleados */}
          <article className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Empleados ({empleados.length})</h2>
              {cargandoEmpleados && <span className="text-xs text-slate-500 dark:text-slate-400">Cargando...</span>}
            </div>

            {errorEmpleados && (
              <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                No fue posible obtener los empleados. {errorEmpleados.message || "Error"}
              </p>
            )}

            {!cargandoEmpleados && !errorEmpleados && empleados.length === 0 && (
              <p className="text-sm text-slate-500 dark:text-slate-400">Sin empleados registrados.</p>
            )}

            {!cargandoEmpleados && !errorEmpleados && empleados.length > 0 && (
              <div className="space-y-3">
                {empleados.map((empleado) => (
                  <div key={empleado.id} className="rounded-lg bg-slate-50 p-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-semibold text-slate-800">{empleado.nombre_completo}</p>
                        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          <p>{empleado.puesto || "Sin puesto asignado"}</p>
                          {empleado.identificacion && <p>DNI: {empleado.identificacion}</p>}
                          {empleado.telefono && <p>Tel: {empleado.telefono}</p>}
                          <p>Ingreso: {new Date(empleado.fecha_ingreso).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                          empleado.activo
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-slate-200 text-slate-600 dark:text-slate-400"
                        }`}
                      >
                        {empleado.activo ? "Activo" : "Inactivo"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </article>

          {/* Lista de pagos recientes */}
          <article className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Pagos recientes</h2>
              {cargandoPagos && <span className="text-xs text-slate-500 dark:text-slate-400">Cargando...</span>}
            </div>

            {errorPagos && (
              <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                No fue posible obtener los pagos. {errorPagos.message || "Error"}
              </p>
            )}

            {!cargandoPagos && !errorPagos && pagos.length === 0 && (
              <p className="text-sm text-slate-500 dark:text-slate-400">Sin pagos registrados.</p>
            )}

            {!cargandoPagos && !errorPagos && pagos.length > 0 && (
              <div className="space-y-3">
                {pagos.slice(0, 10).map((pago) => (
                  <div key={pago.id} className="rounded-lg bg-slate-50 p-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-semibold text-slate-800">{pago.empleado_nombre}</p>
                        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          <p>{new Date(pago.fecha).toLocaleDateString()} • {pago.medio_pago_display}</p>
                          {pago.concepto && <p>{pago.concepto}</p>}
                          {pago.generar_recibo && (
                            <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                              Con recibo
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="text-sm font-semibold text-green-600">
                        ${formatearDecimal(pago.monto)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </article>
        </div>

        {/* Panel lateral derecho con formularios */}
        <div className="space-y-6">
          {/* Formulario de registro de pago */}
          <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Registrar pago</h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Registra un pago a empleado. Se agregará automáticamente como egreso en finanzas.
            </p>

            <form className="mt-4 grid gap-3" onSubmit={registrarPago}>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="empleado-pago">
                  Empleado *
                </label>
                <select
                  id="empleado-pago"
                  value={formularioPago.empleado}
                  onChange={(e) => setFormularioPago(prev => ({ ...prev, empleado: e.target.value }))}
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  required
                >
                  <option value="">Seleccionar empleado</option>
                  {empleadosActivos.map((empleado) => (
                    <option key={empleado.id} value={empleado.id}>
                      {empleado.nombre_completo} - {empleado.puesto || 'Sin puesto'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="monto-pago">
                  Monto *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  id="monto-pago"
                  value={formularioPago.monto}
                  onChange={(e) => setFormularioPago(prev => ({ ...prev, monto: e.target.value }))}
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="medio-pago">
                  Forma de pago *
                </label>
                <select
                  id="medio-pago"
                  value={formularioPago.medio_pago}
                  onChange={(e) => setFormularioPago(prev => ({ ...prev, medio_pago: e.target.value }))}
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  required
                >
                  <option value="EFECTIVO">Efectivo</option>
                  <option value="TRANSFERENCIA">Transferencia</option>
                  <option value="CHEQUE">Cheque</option>
                  <option value="DEPOSITO">Depósito</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="concepto-pago">
                  Concepto
                </label>
                <input
                  type="text"
                  id="concepto-pago"
                  value={formularioPago.concepto}
                  onChange={(e) => setFormularioPago(prev => ({ ...prev, concepto: e.target.value }))}
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  placeholder="Ej: Sueldo enero 2024"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="generar-recibo"
                  checked={formularioPago.generar_recibo}
                  onChange={(e) => setFormularioPago(prev => ({ ...prev, generar_recibo: e.target.checked }))}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="generar-recibo" className="text-sm text-slate-700 dark:text-slate-300">
                  Generar recibo de sueldo
                </label>
              </div>

              <button
                type="submit"
                disabled={enviandoPago || !formularioPago.empleado || !formularioPago.monto}
                className="w-full inline-flex items-center justify-center gap-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500 disabled:bg-slate-300"
              >
                {enviandoPago ? "Registrando..." : "Registrar pago"}
              </button>

              {errorFormularioPago && (
                <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {errorFormularioPago.message || "Error al registrar el pago"}
                </p>
              )}
            </form>
          </section>

          {/* Formulario plegable para agregar empleado */}
          <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm">
            <button
              type="button"
              onClick={() => setFormularioEmpleadoExpandido(!formularioEmpleadoExpandido)}
              className="flex w-full items-center justify-between text-lg font-semibold text-slate-900 dark:text-white"
            >
              <span>Agregar empleado</span>
              <svg
                className={`h-5 w-5 transition-transform ${formularioEmpleadoExpandido ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {formularioEmpleadoExpandido && (
              <div className="mt-4 animate-in slide-in-from-top-2 duration-200">
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                  Completa la información del nuevo empleado. Los campos marcados con * son obligatorios.
                </p>

                <form onSubmit={agregarEmpleado} className="grid gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="nombre-empleado">
                      Nombre *
                    </label>
                    <input
                      type="text"
                      id="nombre-empleado"
                      value={formularioEmpleado.nombre}
                      onChange={(e) => setFormularioEmpleado(prev => ({ ...prev, nombre: e.target.value }))}
                      className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="apellidos-empleado">
                      Apellidos *
                    </label>
                    <input
                      type="text"
                      id="apellidos-empleado"
                      value={formularioEmpleado.apellidos}
                      onChange={(e) => setFormularioEmpleado(prev => ({ ...prev, apellidos: e.target.value }))}
                      className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="dni-empleado">
                      DNI
                    </label>
                    <input
                      type="text"
                      id="dni-empleado"
                      value={formularioEmpleado.identificacion}
                      onChange={(e) => setFormularioEmpleado(prev => ({ ...prev, identificacion: e.target.value }))}
                      className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                      placeholder="12345678"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="cuil-empleado">
                      CUIL
                    </label>
                    <input
                      type="text"
                      id="cuil-empleado"
                      value={formularioEmpleado.cuil}
                      onChange={(e) => setFormularioEmpleado(prev => ({ ...prev, cuil: e.target.value }))}
                      className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                      placeholder="20-12345678-9"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="telefono-empleado">
                      Número de teléfono
                    </label>
                    <input
                      type="tel"
                      id="telefono-empleado"
                      value={formularioEmpleado.telefono}
                      onChange={(e) => setFormularioEmpleado(prev => ({ ...prev, telefono: e.target.value }))}
                      className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                      placeholder="+54 11 1234-5678"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="fecha-ingreso-empleado">
                      Fecha de ingreso
                    </label>
                    <input
                      type="date"
                      id="fecha-ingreso-empleado"
                      value={formularioEmpleado.fecha_ingreso}
                      onChange={(e) => setFormularioEmpleado(prev => ({ ...prev, fecha_ingreso: e.target.value }))}
                      className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="direccion-empleado">
                      Dirección
                    </label>
                    <input
                      type="text"
                      id="direccion-empleado"
                      value={formularioEmpleado.direccion}
                      onChange={(e) => setFormularioEmpleado(prev => ({ ...prev, direccion: e.target.value }))}
                      className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                      placeholder="Calle, número, ciudad, provincia"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="puesto-empleado">
                      Puesto
                    </label>
                    <input
                      type="text"
                      id="puesto-empleado"
                      value={formularioEmpleado.puesto}
                      onChange={(e) => setFormularioEmpleado(prev => ({ ...prev, puesto: e.target.value }))}
                      className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                      placeholder="Ej: Desarrollador, Vendedor, Administrador"
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={enviandoEmpleado || !formularioEmpleado.nombre.trim() || !formularioEmpleado.apellidos.trim()}
                      className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-500 disabled:bg-slate-300"
                    >
                      {enviandoEmpleado ? "Agregando..." : "Agregar"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setFormularioEmpleado(estadoInicialEmpleado);
                        setFormularioEmpleadoExpandido(false);
                      }}
                      className="px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 border border-slate-300 rounded-lg hover:bg-slate-50"
                    >
                      ×
                    </button>
                  </div>

                  {errorFormularioEmpleado && (
                    <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                      {errorFormularioEmpleado.message || "Error al agregar el empleado"}
                    </p>
                  )}
                </form>
              </div>
            )}
          </section>
        </div>
      </section>
    </div>
  );
};

export default RecursosHumanosPage;