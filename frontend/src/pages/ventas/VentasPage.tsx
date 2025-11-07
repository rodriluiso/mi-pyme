import type { ChangeEvent, FormEvent } from "react";
import { useMemo, useState } from "react";
import { useApi } from "@/hooks/useApi";
import { useListado } from "@/hooks/useListado";
import type { ApiError } from "@/lib/api/types";
import type { Cliente, Producto, Venta, SucursalCliente } from "@/types/mipyme";

const formatearDecimal = (valor: string | null | undefined) => {
  const numero = Number(valor ?? "0");
  if (Number.isNaN(numero)) {
    return "0";
  }
  return numero.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatearCantidad = (valor: string | null | undefined) => {
  const numero = Number(valor ?? "0");
  if (Number.isNaN(numero)) {
    return "0";
  }
  return numero.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
};

const normalizarTexto = (valor: string | number | null | undefined) => {
  if (valor === null || valor === undefined) {
    return "";
  }
  return String(valor)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
};

type LineaFormulario = {
  id: string; // ID temporal para la UI
  producto: string;
  descripcion: string;
  cantidad: string; // Cantidad en unidades (para stock)
  cantidadKg: string; // Cantidad en kg (para facturación)
  precioUnitario: string; // Precio por kg
};

type FormularioVenta = {
  cliente: string;
  sucursal?: string; // ID de la sucursal seleccionada (si aplica)
  numero: string;
  lineas: LineaFormulario[];
  generarRemito: boolean;
  incluye_iva: boolean;
};

const crearLineaVacia = (): LineaFormulario => ({
  id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
  producto: "",
  descripcion: "",
  cantidad: "1",
  cantidadKg: "0",
  precioUnitario: ""
});

const estadoInicialFormulario: FormularioVenta = {
  cliente: "",
  numero: "",
  lineas: [crearLineaVacia()],
  generarRemito: false,
  incluye_iva: false
};

const VentasPage = () => {
  const { datos: ventas, cargando, error, recargar } = useListado<Venta>("/ventas/");
  const { datos: clientes } = useListado<Cliente>("/clientes/");
  const { datos: productos } = useListado<Producto>("/productos/");
  const { datos: sucursales } = useListado<SucursalCliente>("/clientes/sucursales/");
  const { request } = useApi();

  const [formulario, setFormulario] = useState<FormularioVenta>(estadoInicialFormulario);
  const [enviando, setEnviando] = useState(false);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);
  const [mensajeError, setMensajeError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");

  const clientesOrdenados = useMemo(() => {
    return [...clientes].sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [clientes]);

  const productosOrdenados = useMemo(() => {
    return [...productos]
      .filter((producto) => producto.activo)
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [productos]);

  // Crear una lista combinada de clientes con sus sucursales para el selector
  const opcionesClienteSucursal = useMemo(() => {
    const opciones: Array<{id: string, nombre: string, clienteId: number, sucursalId?: number, tipo: 'cliente' | 'sucursal'}> = [];

    clientes.forEach(cliente => {
      if (cliente.sucursales && cliente.sucursales.length > 1) {
        // Si tiene múltiples sucursales, agregar cada sucursal como opción separada
        cliente.sucursales.forEach(sucursal => {
          opciones.push({
            id: `sucursal-${sucursal.id}`,
            nombre: `${cliente.nombre} - ${sucursal.nombre_sucursal} (${sucursal.codigo_sucursal})`,
            clienteId: cliente.id,
            sucursalId: sucursal.id,
            tipo: 'sucursal'
          });
        });
      } else {
        // Si tiene una sola sucursal, mostrar como cliente normal
        opciones.push({
          id: `cliente-${cliente.id}`,
          nombre: cliente.nombre,
          clienteId: cliente.id,
          tipo: 'cliente'
        });
      }
    });

    return opciones.sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [clientes]);

  const calcularTotal = useMemo(() => {
    const subtotal = formulario.lineas.reduce((total, linea) => {
      const cantidadKg = Number(linea.cantidadKg) || 0;
      const precio = Number(linea.precioUnitario) || 0;
      return total + (cantidadKg * precio);
    }, 0);

    const iva = formulario.incluye_iva ? subtotal * 0.21 : 0;
    const total = subtotal + iva;

    return { subtotal, iva, total };
  }, [formulario.lineas, formulario.incluye_iva]);

  const terminoNormalizado = useMemo(() => normalizarTexto(busqueda), [busqueda]);

  const ventasFiltradas = useMemo(() => {
    if (!terminoNormalizado) {
      return ventas;
    }

    return ventas.filter((venta) => {
      const camposVenta: Array<string | number | null | undefined> = [
        venta.numero,
        venta.cliente_nombre,
        venta.fecha,
        venta.total,
        venta.id
      ];

      const totalNumerico = Number(venta.total ?? 0);
      if (!Number.isNaN(totalNumerico)) {
        camposVenta.push(totalNumerico);
      }

      if (camposVenta.some((campo) => normalizarTexto(campo).includes(terminoNormalizado))) {
        return true;
      }

      return venta.lineas.some((linea) => {
        const camposLinea: Array<string | number | null | undefined> = [
          linea.producto_nombre,
          linea.descripcion,
          linea.cantidad,
          linea.precio_unitario,
          linea.subtotal
        ];
        return camposLinea.some((campo) => normalizarTexto(campo).includes(terminoNormalizado));
      });
    });
  }, [terminoNormalizado, ventas]);

  const hayVentas = ventas.length > 0;

  const manejarBusqueda = (evento: ChangeEvent<HTMLInputElement>) => {
    setBusqueda(evento.target.value);
  };

  const actualizarCampoVenta = (campo: keyof Omit<FormularioVenta, 'lineas'>, valor: string | boolean) => {
    setFormulario((prev) => ({ ...prev, [campo]: valor }));
  };

  const actualizarLineaVenta = (idLinea: string, campo: keyof LineaFormulario, valor: string) => {
    setFormulario((prev) => ({
      ...prev,
      lineas: prev.lineas.map((linea) =>
        linea.id === idLinea ? { ...linea, [campo]: valor } : linea
      )
    }));
  };

  const manejarCambioProducto = (idLinea: string, valor: string) => {
    limpiarMensajes();
    const producto = productosOrdenados.find((item) => String(item.id) === valor);

    setFormulario((prev) => ({
      ...prev,
      lineas: prev.lineas.map((linea) => {
        if (linea.id !== idLinea) return linea;

        const nuevaLinea = { ...linea, producto: valor };
        if (producto) {
          if (!linea.descripcion.trim()) {
            nuevaLinea.descripcion = producto.nombre;
          }
          if (!linea.precioUnitario) {
            nuevaLinea.precioUnitario = producto.precio;
          }
        }
        return nuevaLinea;
      })
    }));
  };

  const agregarLinea = () => {
    setFormulario((prev) => ({
      ...prev,
      lineas: [...prev.lineas, crearLineaVacia()]
    }));
  };

  const eliminarLinea = (idLinea: string) => {
    setFormulario((prev) => ({
      ...prev,
      lineas: prev.lineas.filter((linea) => linea.id !== idLinea)
    }));
  };

  const limpiarMensajes = () => {
    setMensajeExito(null);
    setMensajeError(null);
  };

  const manejarSubmit = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    limpiarMensajes();

    if (!formulario.cliente) {
      setMensajeError("Selecciona un cliente");
      return;
    }

    if (formulario.lineas.length === 0) {
      setMensajeError("Agrega al menos un producto a la venta");
      return;
    }

    // Validar cada línea de la venta
    for (let i = 0; i < formulario.lineas.length; i++) {
      const linea = formulario.lineas[i];
      const numeroLinea = i + 1;

      if (!linea.descripcion.trim()) {
        setMensajeError(`Línea ${numeroLinea}: Ingresa una descripción para el producto`);
        return;
      }

      const cantidadValor = Number(linea.cantidad);
      if (!linea.cantidad || Number.isNaN(cantidadValor) || cantidadValor <= 0) {
        setMensajeError(`Línea ${numeroLinea}: Ingresa una cantidad válida`);
        return;
      }

      const precioValor = Number(linea.precioUnitario);
      if (!linea.precioUnitario || Number.isNaN(precioValor) || precioValor < 0) {
        setMensajeError(`Línea ${numeroLinea}: Ingresa un precio unitario válido`);
        return;
      }

      // Validar stock si hay producto seleccionado
      if (linea.producto) {
        const producto = productosOrdenados.find((p) => String(p.id) === linea.producto);
        if (producto) {
          const stockDisponible = Number(producto.stock ?? "0");
          if (cantidadValor > stockDisponible) {
            setMensajeError(`Línea ${numeroLinea}: Stock insuficiente. Disponible: ${formatearCantidad(producto.stock)} unidades`);
            return;
          }
        }
      }
    }

    setEnviando(true);
    try {
      const lineasPayload = formulario.lineas.map((linea) => ({
        producto: linea.producto ? Number(linea.producto) : null,
        descripcion: linea.descripcion.trim(),
        cantidad: linea.cantidad,
        cantidad_kg: linea.cantidadKg,
        precio_unitario: linea.precioUnitario
      }));

      const payload = {
        cliente: Number(formulario.cliente),
        numero: formulario.numero.trim() || undefined,
        incluye_iva: formulario.incluye_iva,
        lineas: lineasPayload
      };

      const ventaCreada = await request<Venta>({
        method: "POST",
        url: "/ventas/agregar-multiple/",
        data: payload
      });

      // Si se marcó la opción de generar remito, descargar el archivo
      if (formulario.generarRemito) {
        try {
          const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api'}/ventas/${ventaCreada.id}/remito/`, {
            method: 'GET'
          });

          if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `remito-venta-${ventaCreada.numero || ventaCreada.id}.html`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            setMensajeExito("Venta registrada correctamente y remito descargado");
          } else {
            setMensajeExito("Venta registrada correctamente (error al generar remito)");
          }
        } catch (error) {
          setMensajeExito("Venta registrada correctamente (error al generar remito)");
        }
      } else {
        setMensajeExito("Venta registrada correctamente");
      }

      setFormulario(estadoInicialFormulario);
      // Pequeño delay para asegurar consistencia de BD en producción
      await new Promise(resolve => setTimeout(resolve, 300));
      await recargar();
    } catch (err) {
      const apiError = err as ApiError;
      let detalle = apiError.message || "No se pudo registrar la venta";
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
      setMensajeError(detalle);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white dark:text-white">Ventas</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 dark:text-slate-400">Revisa el historial de ventas y controla los montos emitidos.</p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => recargar()}
              className="inline-flex items-center rounded-full border border-slate-200 dark:border-slate-700 px-4 py-1 text-sm font-medium text-slate-600 dark:text-slate-400 dark:text-slate-400 transition hover:border-blue-200 hover:text-blue-600 dark:hover:border-blue-500 dark:hover:text-blue-400"
            >
              Recargar listado
            </button>
            {hayVentas && (
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Mostrando {ventasFiltradas.length} de {ventas.length} ventas
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400" htmlFor="ventas-busqueda">
              Buscar
            </label>
            <input
              id="ventas-busqueda"
              type="search"
              value={busqueda}
              onChange={manejarBusqueda}
              className="rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:bg-slate-700 dark:text-white"
              placeholder="Cliente, producto, total, nro"
            />
          </div>
        </div>
      </header>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              No fue posible obtener las ventas. Detalle: {error.message || "error desconocido"}
            </div>
          )}

          {!cargando && !error && hayVentas && (
            <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm">
              <header className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Historial de ventas</h2>
                {cargando && <span className="text-xs text-slate-500 dark:text-slate-400">Actualizando...</span>}
              </header>
              {/* Vista de tabla para pantallas grandes */}
              <div className="mt-4 hidden overflow-x-auto lg:block">
                <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700 text-left text-sm text-slate-700 dark:text-slate-300">
                  <thead className="bg-slate-50 dark:bg-slate-700 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    <tr>
                      <th className="px-4 py-3">Venta</th>
                      <th className="px-4 py-3">Cliente</th>
                      <th className="px-4 py-3">Fecha</th>
                      <th className="px-4 py-3 text-right">Total</th>
                      <th className="px-4 py-3">Detalle</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {ventasFiltradas.map((venta) => (
                      <tr key={venta.id} className="hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-700">
                        <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                          Venta #{venta.numero || venta.id}
                        </td>
                        <td className="px-4 py-3">{venta.cliente_nombre}</td>
                        <td className="px-4 py-3">{venta.fecha}</td>
                        <td className="px-4 py-3 text-right">${formatearDecimal(venta.total)}</td>
                        <td className="px-4 py-3">
                          {venta.lineas.length > 0 ? (
                            <details className="text-xs">
                              <summary className="cursor-pointer text-blue-600 hover:underline">Ver detalle</summary>
                              <ul className="mt-2 space-y-1">
                                {venta.lineas.map((linea) => (
                                  <li key={linea.id} className="rounded bg-slate-100 px-2 py-1">
                                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                                      {linea.producto_nombre || linea.descripcion}
                                    </span>
                                    {linea.producto_nombre && linea.descripcion && (
                                      <span className="text-slate-500 dark:text-slate-400"> - {linea.descripcion}</span>
                                    )}
                                    <span className="mx-1 text-slate-400">|</span>
                                    {formatearCantidad(linea.cantidad)}u ({formatearCantidad(linea.cantidad_kg)}kg) × ${formatearDecimal(linea.precio_unitario)}/kg
                                    <span className="mx-1 text-slate-400">=</span>
                                    ${formatearDecimal(linea.subtotal)}
                                  </li>
                                ))}
                              </ul>
                            </details>
                          ) : (
                            <span className="text-xs text-slate-400">Sin detalle</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Vista de cards para móviles y tabletas */}
              <div className="mt-4 space-y-3 lg:hidden">
                {ventasFiltradas.map((venta) => (
                  <div key={venta.id} className="rounded-lg border border-slate-200 bg-slate-50 dark:bg-slate-700 p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-semibold text-slate-900 dark:text-white">
                          Venta #{venta.numero || venta.id}
                        </h4>
                        <p className="text-sm text-slate-600 dark:text-slate-400">{venta.cliente_nombre}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{venta.fecha}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-slate-900 dark:text-white">${formatearDecimal(venta.total)}</p>
                      </div>
                    </div>
                    {venta.lineas.length > 0 && (
                      <div className="mt-3">
                        <details className="text-xs">
                          <summary className="cursor-pointer text-blue-600 hover:underline">Ver detalle de productos</summary>
                          <ul className="mt-2 space-y-1">
                            {venta.lineas.map((linea) => (
                              <li key={linea.id} className="rounded bg-white px-2 py-1 text-xs">
                                <div className="font-semibold text-slate-700 dark:text-slate-300">
                                  {linea.producto_nombre || linea.descripcion}
                                </div>
                                {linea.producto_nombre && linea.descripcion && (
                                  <div className="text-slate-500 dark:text-slate-400">{linea.descripcion}</div>
                                )}
                                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                                  <span>{formatearCantidad(linea.cantidad)}u ({formatearCantidad(linea.cantidad_kg)}kg) × ${formatearDecimal(linea.precio_unitario)}/kg</span>
                                  <span className="font-semibold">${formatearDecimal(linea.subtotal)}</span>
                                </div>
                              </li>
                            ))}
                          </ul>
                        </details>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {!cargando && !error && !hayVentas && (
            <p className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 text-sm text-slate-500 dark:text-slate-400">
              Todavia no hay ventas registradas.
            </p>
          )}
        </div>

        <aside className="h-fit rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Registrar venta</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Agrega múltiples productos a una misma orden de venta.</p>

          <form className="mt-4 grid gap-4" onSubmit={manejarSubmit}>
            {/* Cliente y número de comprobante */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="venta-cliente">
                Cliente *
              </label>
              <select
                id="venta-cliente"
                value={formulario.sucursal ? `sucursal-${formulario.sucursal}` : formulario.cliente ? `cliente-${formulario.cliente}` : ""}
                onChange={(evento) => {
                  const selectedValue = evento.target.value;
                  const selectedOption = opcionesClienteSucursal.find(opcion => opcion.id === selectedValue);
                  if (selectedOption) {
                    setFormulario(prev => ({
                      ...prev,
                      cliente: selectedOption.clienteId.toString(),
                      sucursal: selectedOption.tipo === 'sucursal' ? selectedOption.sucursalId?.toString() : undefined
                    }));
                  }
                }}
                className="rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:bg-slate-700 dark:text-white"
                disabled={enviando}
                required
              >
                <option value="">Selecciona un cliente</option>
                {opcionesClienteSucursal.map((opcion) => (
                  <option key={opcion.id} value={opcion.id}>
                    {opcion.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="venta-numero">
                Número de comprobante
              </label>
              <input
                id="venta-numero"
                type="text"
                value={formulario.numero}
                onChange={(evento) => actualizarCampoVenta("numero", evento.target.value)}
                className="rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:bg-slate-700 dark:text-white"
                placeholder="Ej: FA-00012"
                disabled={enviando}
              />
            </div>

            {/* Líneas de productos */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Productos *
                </label>
                <button
                  type="button"
                  onClick={agregarLinea}
                  disabled={enviando}
                  className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-1 text-xs font-medium text-white transition hover:bg-emerald-500 disabled:bg-emerald-300"
                >
                  + Agregar producto
                </button>
              </div>

              <div className="space-y-3">
                {formulario.lineas.map((linea, indice) => {
                  const producto = linea.producto
                    ? productosOrdenados.find((p) => String(p.id) === linea.producto)
                    : null;
                  const subtotal = Number(linea.cantidadKg || 0) * Number(linea.precioUnitario || 0);
                  const productoSelectId = `venta-linea-${linea.id}-producto`;
                  const descripcionInputId = `venta-linea-${linea.id}-descripcion`;
                  const cantidadInputId = `venta-linea-${linea.id}-cantidad`;
                  const cantidadKgInputId = `venta-linea-${linea.id}-cantidad-kg`;
                  const precioInputId = `venta-linea-${linea.id}-precio`;

                  return (
                    <div key={linea.id} className="rounded-lg border border-slate-200 bg-slate-50 dark:bg-slate-700 p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                          Producto {indice + 1}
                        </span>
                        {formulario.lineas.length > 1 && (
                          <button
                            type="button"
                            onClick={() => eliminarLinea(linea.id)}
                            disabled={enviando}
                            className="text-xs text-red-600 hover:text-red-700 disabled:text-red-300"
                          >
                            Eliminar
                          </button>
                        )}
                      </div>

                      <div className="grid gap-2 md:grid-cols-2">
                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-medium text-slate-600 dark:text-slate-400" htmlFor={productoSelectId}>
                            Producto
                          </label>
                          <select id={productoSelectId}
                            value={linea.producto}
                            onChange={(evento) => manejarCambioProducto(linea.id, evento.target.value)}
                            className="rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:bg-slate-700 dark:text-white"
                            disabled={enviando}
                          >
                            <option value="">Sin producto asociado</option>
                            {productosOrdenados.map((prod) => {
                              const stock = Number(prod.stock ?? "0");
                              const rotuloStock = stock > 0 ? `stock: ${formatearCantidad(prod.stock)}` : 'sin stock';
                              return (
                                <option key={prod.id} value={prod.id} disabled={stock <= 0}>
                                  {prod.nombre} ({rotuloStock})
                                </option>
                              );
                            })}
                          </select>
                          {producto && (
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              Stock: {formatearCantidad(producto.stock)} | Precio: ${formatearDecimal(producto.precio)}
                            </p>
                          )}
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                            Descripción *
                          </label>
                          <input
                            type="text"
                            value={linea.descripcion}
                            onChange={(evento) => actualizarLineaVenta(linea.id, "descripcion", evento.target.value)}
                            className="rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:bg-slate-700 dark:text-white"
                            placeholder="Detalle del producto"
                            disabled={enviando}
                            required
                          />
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-medium text-slate-600 dark:text-slate-400" htmlFor={cantidadInputId}>
                            Cantidad (unidades) *
                          </label>
                          <input id={cantidadInputId}
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={linea.cantidad}
                            onChange={(evento) => actualizarLineaVenta(linea.id, "cantidad", evento.target.value)}
                            className="rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:bg-slate-700 dark:text-white"
                            disabled={enviando}
                            required
                          />
                          <p className="text-xs text-slate-500 dark:text-slate-400">Para stock</p>
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-medium text-slate-600 dark:text-slate-400" htmlFor={cantidadKgInputId}>
                            Cantidad (kg) *
                          </label>
                          <input id={cantidadKgInputId}
                            type="number"
                            min="0"
                            step="0.001"
                            value={linea.cantidadKg}
                            onChange={(evento) => actualizarLineaVenta(linea.id, "cantidadKg", evento.target.value)}
                            className="rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:bg-slate-700 dark:text-white"
                            disabled={enviando}
                            required
                          />
                          <p className="text-xs text-slate-500 dark:text-slate-400">Para facturación</p>
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-medium text-slate-600 dark:text-slate-400" htmlFor={precioInputId}>
                            Precio por kg *
                          </label>
                          <input id={precioInputId}
                            type="number"
                            min="0"
                            step="0.01"
                            value={linea.precioUnitario}
                            onChange={(evento) => actualizarLineaVenta(linea.id, "precioUnitario", evento.target.value)}
                            className="rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:bg-slate-700 dark:text-white"
                            disabled={enviando}
                            required
                          />
                        </div>
                      </div>

                      <div className="mt-2 text-right">
                        <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                          Subtotal: ${formatearDecimal(subtotal.toString())}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Opción de remito */}
            <div className="flex items-center gap-2 border-t border-slate-200 pt-3">
              <input
                id="venta-remito"
                type="checkbox"
                checked={formulario.generarRemito}
                onChange={(evento) => actualizarCampoVenta("generarRemito", evento.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                disabled={enviando}
              />
              <label htmlFor="venta-remito" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Generar remito de entrega (certificado de entrega sin precios)
              </label>
            </div>

            {/* Checkbox IVA */}
            <div className="flex items-center gap-2 mb-3">
              <input
                id="incluye_iva"
                type="checkbox"
                checked={formulario.incluye_iva}
                onChange={(e) => actualizarCampoVenta("incluye_iva", e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
              />
              <label htmlFor="incluye_iva" className="text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                Incluir IVA (21%)
              </label>
            </div>

            {/* Total y botones */}
            <div className="border-t border-slate-200 pt-3">
              {formulario.incluye_iva && (
                <div className="mb-2 space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600 dark:text-slate-400">Subtotal:</span>
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      ${formatearDecimal(calcularTotal.subtotal.toString())}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600 dark:text-slate-400">IVA (21%):</span>
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      ${formatearDecimal(calcularTotal.iva.toString())}
                    </span>
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between mb-3">
                <span className="text-lg font-semibold text-slate-700 dark:text-slate-300">Total:</span>
                <span className="text-xl font-bold text-slate-900 dark:text-white">
                  ${formatearDecimal(calcularTotal.total.toString())}
                </span>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <button
                  type="submit"
                  disabled={enviando || formulario.lineas.length === 0}
                  className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-blue-300"
                >
                  {enviando ? "Registrando..." : "Registrar venta"}
                </button>
                {mensajeExito && <span className="text-sm font-medium text-emerald-600">{mensajeExito}</span>}
                {mensajeError && <span className="text-sm font-medium text-red-600">{mensajeError}</span>}
              </div>
            </div>
          </form>
        </aside>
      </section>
    </section>
  );
};

export default VentasPage;
