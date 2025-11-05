import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useApi } from "@/hooks/useApi";
import type { ApiError } from "@/lib/api/types";
import type { PerfilClienteResponse } from "@/types/mipyme";

const formatearMoneda = (valor: string | null | undefined) => {
  const numero = Number(valor ?? "0");
  if (Number.isNaN(numero)) {
    return "0";
  }
  return numero.toLocaleString(undefined, {
    style: "currency",
    currency: "ARS"
  });
};

const ClientePerfilPage = () => {
  const { clienteId } = useParams<{ clienteId: string }>();
  const navigate = useNavigate();
  const { request } = useApi();

  const [perfil, setPerfil] = useState<PerfilClienteResponse | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);

  const cargarPerfil = async () => {
    if (!clienteId) return;
    setCargando(true);
    setError(null);
    try {
      const data = await request<PerfilClienteResponse>({
        method: "GET",
        url: `/clientes/${clienteId}/perfil/`
      });
      setPerfil(data);
    } catch (err) {
      setError(err as ApiError);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    void cargarPerfil();
  }, [clienteId]);

  if (!clienteId) {
    return (
      <section className="flex flex-col gap-4 py-12 text-center">
        <p className="text-sm text-slate-500">Cliente no especificado.</p>
        <Link to="/clientes" className="text-sm font-medium text-blue-600">
          Volver al listado
        </Link>
      </section>
    );
  }

  if (cargando) {
    return (
      <section className="flex flex-col gap-4 py-12 text-center">
        <p className="text-sm text-slate-500">Cargando perfil de cliente...</p>
      </section>
    );
  }

  if (error || !perfil) {
    return (
      <section className="flex flex-col gap-4 py-12 text-center">
        <p className="text-sm text-red-600">
          No fue posible obtener el perfil. {error?.message || "Error desconocido"}
        </p>
        <button
          type="button"
          onClick={() => cargarPerfil()}
          className="mx-auto rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-blue-200 hover:text-blue-600"
        >
          Reintentar
        </button>
        <Link to="/clientes" className="text-sm font-medium text-blue-600">
          Volver al listado
        </Link>
      </section>
    );
  }

  const { cliente, historial_ventas, historial_compras, pagos, saldo, total_ventas, total_compras, total_pagos } =
    perfil;

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Perfil de {cliente.nombre}</h1>
          <p className="text-sm text-slate-500">Resumen financiero y movimientos recientes.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded-full border border-slate-200 px-3 py-1 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-800"
          >
            Volver
          </button>
          <button
            type="button"
            onClick={() => cargarPerfil()}
            className="rounded-full border border-slate-200 px-3 py-1 text-sm font-medium text-slate-600 transition hover:border-blue-200 hover:text-blue-600"
          >
            Recargar perfil
          </button>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-4">
        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:col-span-2">
          <h2 className="text-lg font-semibold text-slate-900">Datos del cliente</h2>
          <dl className="mt-4 grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
            <div>
              <dt className="font-semibold text-slate-500">Identificación</dt>
              <dd>{cliente.identificacion}</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-500">Correo</dt>
              <dd>{cliente.correo || 'Sin correo'}</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-500">Teléfono</dt>
              <dd>{cliente.telefono || 'Sin teléfono'}</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-500">Dirección</dt>
              <dd>{cliente.direccion || 'Sin dirección'}</dd>
            </div>
          </dl>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-500">Saldo actual</h3>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{formatearMoneda(saldo)}</p>
          <p className="mt-2 text-xs text-slate-500">Ventas - Pagos registrados</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-500">Totales</h3>
          <ul className="mt-2 space-y-1 text-sm text-slate-600">
            <li><span className="font-semibold text-slate-500">Ventas:</span> {formatearMoneda(total_ventas)}</li>
            <li><span className="font-semibold text-slate-500">Pagos:</span> {formatearMoneda(total_pagos)}</li>
            <li><span className="font-semibold text-slate-500">Compras:</span> {formatearMoneda(total_compras)}</li>
          </ul>
        </article>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Ventas recientes</h2>
            <span className="text-xs text-slate-500">Últimas {historial_ventas.length}</span>
          </div>
          {historial_ventas.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">Sin ventas registradas.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              {historial_ventas.map((venta) => (
                <li key={venta.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                  <div>
                    <p className="font-semibold text-slate-700">Venta #{venta.id}</p>
                    <p className="text-xs text-slate-500">{venta.fecha}</p>
                  </div>
                  <span className="text-sm font-semibold text-slate-900">{formatearMoneda(venta.total)}</span>
                </li>
              ))}
            </ul>
          )}
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Pagos registrados</h2>
            <span className="text-xs text-slate-500">Últimos {pagos.length}</span>
          </div>
          {pagos.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">Sin pagos registrados.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              {pagos.map((pago) => (
                <li key={pago.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                  <div>
                    <p className="font-semibold text-slate-700">{pago.medio}</p>
                    <p className="text-xs text-slate-500">{pago.fecha}</p>
                  </div>
                  <span className="text-sm font-semibold text-slate-900">{formatearMoneda(pago.monto)}</span>
                </li>
              ))}
            </ul>
          )}
        </article>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Compras vinculadas</h2>
          <span className="text-xs text-slate-500">Últimas {historial_compras.length}</span>
        </div>
        {historial_compras.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">Sin compras asociadas a este cliente.</p>
        ) : (
          <ul className="mt-3 grid gap-2 text-sm text-slate-600 md:grid-cols-2">
            {historial_compras.map((compra) => (
              <li key={compra.id} className="rounded-lg bg-slate-50 px-3 py-2">
                <p className="font-semibold text-slate-700">Compra #{compra.id}</p>
                <p className="text-xs text-slate-500">{compra.fecha}</p>
                <p className="text-sm font-semibold text-slate-900">{formatearMoneda(compra.total)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
};

export default ClientePerfilPage;
