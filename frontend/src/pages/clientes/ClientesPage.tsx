import type { FormEvent } from "react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useApi } from "@/hooks/useApi";
import { useListado } from "@/hooks/useListado";
import type { ApiError } from "@/lib/api/types";
import type { Cliente } from "@/types/mipyme";

type SucursalFormulario = {
  nombre_sucursal: string;
  codigo_sucursal: string;
  direccion: string;
  localidad: string;
  telefono: string;
  contacto_responsable: string;
};

type FormularioCliente = {
  nombre: string;
  razon_social: string;
  identificacion: string;
  correo: string;
  telefono: string;
  direccion: string;
  localidad: string;
  tiene_multiples_sucursales: boolean;
  sucursales: SucursalFormulario[];
};

const estadoInicialFormulario: FormularioCliente = {
  nombre: "",
  razon_social: "",
  identificacion: "",
  correo: "",
  telefono: "",
  direccion: "",
  localidad: "",
  tiene_multiples_sucursales: false,
  sucursales: [{
    nombre_sucursal: "Sucursal Principal",
    codigo_sucursal: "PRINCIPAL",
    direccion: "",
    localidad: "",
    telefono: "",
    contacto_responsable: ""
  }]
};

const ClientesPage = () => {
  const { datos: clientes, cargando, error, recargar } = useListado<Cliente>("/clientes/");
  const { request } = useApi();

  const [formulario, setFormulario] = useState<FormularioCliente>(estadoInicialFormulario);
  const [enviando, setEnviando] = useState(false);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);
  const [mensajeError, setMensajeError] = useState<string | null>(null);
  const [modoEdicion, setModoEdicion] = useState<Cliente | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [ordenamiento, setOrdenamiento] = useState<{
    campo: keyof Cliente;
    direccion: 'asc' | 'desc';
  }>({ campo: 'nombre', direccion: 'asc' });

  // Función helper para manejar campos de forma segura
  const obtenerValorSeguro = (valor: any, nombreCampo?: string): string => {
    if (valor === null || valor === undefined) {
      console.log(`Campo ${nombreCampo || 'desconocido'} era null/undefined, usando string vacío`);
      return '';
    }
    if (typeof valor === 'string') return valor;
    console.log(`Campo ${nombreCampo || 'desconocido'} no era string, era:`, typeof valor, valor);
    return String(valor);
  };

  const actualizarCampo = (campo: keyof FormularioCliente, valor: string | boolean) => {
    setFormulario((anterior) => ({ ...anterior, [campo]: valor }));
  };

  const actualizarSucursal = (indice: number, campo: keyof SucursalFormulario, valor: string) => {
    setFormulario((anterior) => ({
      ...anterior,
      sucursales: anterior.sucursales.map((sucursal, i) =>
        i === indice ? { ...sucursal, [campo]: valor } : sucursal
      )
    }));
  };

  const agregarSucursal = () => {
    setFormulario((anterior) => ({
      ...anterior,
      sucursales: [...anterior.sucursales, {
        nombre_sucursal: `Sucursal ${anterior.sucursales.length + 1}`,
        codigo_sucursal: `SUC${anterior.sucursales.length + 1}`,
        direccion: "",
        localidad: "",
        telefono: "",
        contacto_responsable: ""
      }]
    }));
  };

  const eliminarSucursal = (indice: number) => {
    if (formulario.sucursales.length > 1) {
      setFormulario((anterior) => ({
        ...anterior,
        sucursales: anterior.sucursales.filter((_, i) => i !== indice)
      }));
    }
  };

  const limpiarMensajes = () => {
    setMensajeExito(null);
    setMensajeError(null);
  };

  const cambiarOrdenamiento = (campo: keyof Cliente) => {
    setOrdenamiento((anterior) => ({
      campo,
      direccion: anterior.campo === campo && anterior.direccion === 'asc' ? 'desc' : 'asc'
    }));
  };

  const prepararEdicion = (cliente: Cliente) => {
    setModoEdicion(cliente);
    setFormulario({
      nombre: cliente.nombre,
      razon_social: (cliente as any).razon_social || "",
      identificacion: cliente.identificacion,
      correo: cliente.correo,
      telefono: cliente.telefono,
      direccion: cliente.direccion,
      localidad: cliente.localidad,
      tiene_multiples_sucursales: (cliente.total_sucursales || 1) > 1,
      sucursales: [{
        nombre_sucursal: "Sucursal Principal",
        codigo_sucursal: "PRINCIPAL",
        direccion: cliente.direccion,
        localidad: cliente.localidad,
        telefono: cliente.telefono,
        contacto_responsable: ""
      }]
    });
    limpiarMensajes();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelarEdicion = () => {
    setModoEdicion(null);
    setFormulario(estadoInicialFormulario);
    limpiarMensajes();
  };

  const manejarSubmit = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    limpiarMensajes();

    const nombre = obtenerValorSeguro(formulario.nombre, 'nombre').trim();
    const identificacion = obtenerValorSeguro(formulario.identificacion, 'identificacion').trim();

    if (!nombre || !identificacion) {
      setMensajeError("Nombre e identificacion son obligatorios");
      return;
    }

    // Validar sucursales si tiene_multiples_sucursales está activado
    if (formulario.tiene_multiples_sucursales && formulario.sucursales) {
      const sucursalesValidas = formulario.sucursales.filter(s =>
        obtenerValorSeguro(s.nombre_sucursal, 'sucursal.nombre_sucursal').trim()
      );

      if (sucursalesValidas.length === 0) {
        setMensajeError("Debe ingresar al menos una sucursal con nombre");
        return;
      }

      // Advertir si hay sucursales sin nombre que se van a ignorar
      const sucursalesSinNombre = formulario.sucursales.length - sucursalesValidas.length;
      if (sucursalesSinNombre > 0) {
        console.warn(`⚠️ Se ignorarán ${sucursalesSinNombre} sucursal(es) sin nombre`);
      }
    }

    setEnviando(true);
    try {
      if (modoEdicion) {
        // Para edición, mantenemos la lógica simple sin sucursales
        const payload = {
          nombre,
          razon_social: obtenerValorSeguro(formulario.razon_social, 'razon_social').trim(),
          identificacion,
          correo: obtenerValorSeguro(formulario.correo).trim(),
          telefono: obtenerValorSeguro(formulario.telefono).trim(),
          direccion: obtenerValorSeguro(formulario.direccion).trim(),
          localidad: obtenerValorSeguro(formulario.localidad).trim()
        };

        await request<Cliente>({
          method: "PUT",
          url: `/clientes/${modoEdicion.id}/`,
          data: payload
        });
        setMensajeExito("Cliente actualizado correctamente");
      } else {
        // Para creación nueva, incluimos las sucursales si las hay
        if (formulario.tiene_multiples_sucursales) {
          // Crear cliente con sucursales
          const clientePayload = {
            nombre,
            razon_social: obtenerValorSeguro(formulario.razon_social, 'razon_social').trim(),
            identificacion,
            correo: obtenerValorSeguro(formulario.correo).trim(),
            telefono: obtenerValorSeguro(formulario.telefono).trim(),
            direccion: obtenerValorSeguro(formulario.direccion).trim(),
            localidad: obtenerValorSeguro(formulario.localidad).trim()
          };

          const clienteCreado = await request<Cliente>({
            method: "POST",
            url: "/clientes/",
            data: clientePayload
          });

          // Crear las sucursales para el cliente
          console.log('Creando sucursales, datos:', formulario.sucursales);
          console.log('Total sucursales a crear:', formulario.sucursales.length);

          let sucursalesCreadas = 0;

          for (let i = 0; i < formulario.sucursales.length; i++) {
            const sucursal = formulario.sucursales[i];
            console.log(`Procesando sucursal ${i + 1}/${formulario.sucursales.length}:`, sucursal);

            const nombreSucursal = obtenerValorSeguro(sucursal.nombre_sucursal, 'sucursal.nombre_sucursal').trim();
            console.log('Nombre sucursal después de obtenerValorSeguro:', nombreSucursal);

            if (nombreSucursal) {
              console.log(`Creando sucursal ${i + 1}: ${nombreSucursal}`);

              const sucursalData = {
                nombre_sucursal: obtenerValorSeguro(sucursal.nombre_sucursal).trim(),
                codigo_sucursal: obtenerValorSeguro(sucursal.codigo_sucursal).trim(),
                direccion: obtenerValorSeguro(sucursal.direccion).trim(),
                localidad: obtenerValorSeguro(sucursal.localidad).trim(),
                telefono: obtenerValorSeguro(sucursal.telefono).trim(),
                contacto_responsable: obtenerValorSeguro(sucursal.contacto_responsable).trim()
              };

              console.log('Datos de sucursal a enviar:', sucursalData);

              try {
                const sucursalCreada = await request({
                  method: "POST",
                  url: `/clientes/${clienteCreado.id}/sucursales/crear/`,
                  data: sucursalData
                });
                console.log(`Sucursal ${i + 1} creada exitosamente:`, sucursalCreada);
                sucursalesCreadas++;
              } catch (error) {
                console.error(`Error creando sucursal ${i + 1}:`, error);
                throw error; // Re-lanzar el error para detener el proceso
              }
            } else {
              console.log(`Saltando sucursal ${i + 1} - nombre vacío`);
            }
          }
          setMensajeExito(`Cliente creado correctamente con ${sucursalesCreadas} sucursal${sucursalesCreadas !== 1 ? 'es' : ''}`);
        } else {
          // Crear cliente normal (una sola ubicación)
          const payload = {
            nombre,
            razon_social: obtenerValorSeguro(formulario.razon_social, 'razon_social').trim(),
            identificacion,
            correo: obtenerValorSeguro(formulario.correo).trim(),
            telefono: obtenerValorSeguro(formulario.telefono).trim(),
            direccion: obtenerValorSeguro(formulario.direccion).trim(),
            localidad: obtenerValorSeguro(formulario.localidad).trim()
          };

          await request<Cliente>({
            method: "POST",
            url: "/clientes/",
            data: payload
          });
          setMensajeExito("Cliente creado correctamente");
        }
      }

      setFormulario(estadoInicialFormulario);
      setModoEdicion(null);
      // Pequeño delay para asegurar consistencia de BD en producción
      await new Promise(resolve => setTimeout(resolve, 300));
      await recargar();
    } catch (err) {
      const apiError = err as ApiError;
      let detalle = apiError.message || "No se pudo guardar el cliente";
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

  const eliminarCliente = async (cliente: Cliente) => {
    const confirmar = window.confirm(`¿Seguro que deseas borrar a ${cliente.nombre}?`);
    if (!confirmar) return;
    limpiarMensajes();
    setEnviando(true);
    try {
      await request<void>({
        method: "DELETE",
        url: `/clientes/${cliente.id}/`
      });
      setMensajeExito("Cliente eliminado correctamente");
      if (modoEdicion?.id === cliente.id) {
        cancelarEdicion();
      }
      // Pequeño delay para asegurar consistencia de BD en producción
      await new Promise(resolve => setTimeout(resolve, 300));
      await recargar();
    } catch (err) {
      const apiError = err as ApiError;
      setMensajeError(apiError.message || "No se pudo eliminar el cliente");
    } finally {
      setEnviando(false);
    }
  };

  const clientesOrdenados = useMemo(() => {
    let clientesFiltrados = [...clientes];

    // Filtrar por búsqueda si hay un término de búsqueda
    if (obtenerValorSeguro(busqueda).trim()) {
      const terminoBusqueda = busqueda.toLowerCase();
      clientesFiltrados = clientesFiltrados.filter((cliente) =>
        cliente.nombre.toLowerCase().includes(terminoBusqueda) ||
        cliente.identificacion.toLowerCase().includes(terminoBusqueda) ||
        (cliente.correo && cliente.correo.toLowerCase().includes(terminoBusqueda)) ||
        (cliente.telefono && cliente.telefono.toLowerCase().includes(terminoBusqueda)) ||
        (cliente.direccion && cliente.direccion.toLowerCase().includes(terminoBusqueda)) ||
        (cliente.localidad && cliente.localidad.toLowerCase().includes(terminoBusqueda))
      );
    }

    // Ordenar por campo seleccionado
    return clientesFiltrados.sort((a, b) => {
      const valorA = a[ordenamiento.campo] || '';
      const valorB = b[ordenamiento.campo] || '';

      // Manejo especial para números (como saldo y total_sucursales)
      if (ordenamiento.campo === 'saldo') {
        const numeroA = Number(valorA) || 0;
        const numeroB = Number(valorB) || 0;
        return ordenamiento.direccion === 'asc' ? numeroA - numeroB : numeroB - numeroA;
      }

      if (ordenamiento.campo === 'total_sucursales') {
        const numeroA = Number(valorA) || 1;
        const numeroB = Number(valorB) || 1;
        return ordenamiento.direccion === 'asc' ? numeroA - numeroB : numeroB - numeroA;
      }

      // Para strings, usar localeCompare
      const resultado = String(valorA).localeCompare(String(valorB));
      return ordenamiento.direccion === 'asc' ? resultado : -resultado;
    });
  }, [clientes, busqueda, ordenamiento]);

  const formatearSaldo = (cliente: Cliente) => {
    const saldo = Number((cliente as Cliente & { saldo?: unknown }).saldo ?? "0");
    if (Number.isNaN(saldo)) return "0";
    return saldo.toLocaleString(undefined, {
      style: "currency",
      currency: "ARS"
    });
  };

  const renderizarIconoOrdenamiento = (campo: keyof Cliente) => {
    if (ordenamiento.campo !== campo) {
      return <span className="text-slate-300">↕</span>;
    }
    return ordenamiento.direccion === 'asc' ? (
      <span className="text-blue-600">↑</span>
    ) : (
      <span className="text-blue-600">↓</span>
    );
  };

  return (
    <section className="flex flex-col gap-6 xl:grid xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
      <header className="flex flex-col gap-2 xl:col-span-2">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Clientes</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Consulta y controla la informacion clave de los clientes registrados en MiPyME.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => recargar()}
              className="inline-flex items-center rounded-full border border-slate-200 dark:border-slate-700 px-4 py-1 text-sm font-medium text-slate-600 dark:text-slate-300 transition hover:border-blue-200 hover:text-blue-600 dark:hover:border-blue-500 dark:hover:text-blue-400"
            >
              Recargar listado
            </button>
            {clientes.length > 0 && (
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Mostrando {clientesOrdenados.length} de {clientes.length} clientes
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400" htmlFor="clientes-busqueda">
              Buscar
            </label>
            <input
              id="clientes-busqueda"
              type="search"
              value={busqueda}
              onChange={(evento) => setBusqueda(evento.target.value)}
              className="rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              placeholder="Nombre, localidad, identificación..."
            />
          </div>
        </div>
      </header>

      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm">
        {/* Vista de tabla para pantallas grandes */}
        <div className="hidden overflow-x-auto lg:block">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700 text-left text-sm text-slate-700 dark:text-slate-300">
            <thead className="bg-slate-50 dark:bg-slate-700 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3">
                  <button
                    onClick={() => cambiarOrdenamiento('nombre')}
                    className="flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                  >
                    Nombre {renderizarIconoOrdenamiento('nombre')}
                  </button>
                </th>
                <th className="px-4 py-3">
                  <button
                    onClick={() => cambiarOrdenamiento('identificacion')}
                    className="flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                  >
                    Identificacion {renderizarIconoOrdenamiento('identificacion')}
                  </button>
                </th>
                <th className="px-4 py-3">
                  <button
                    onClick={() => cambiarOrdenamiento('saldo')}
                    className="flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                  >
                    Estado de cuenta {renderizarIconoOrdenamiento('saldo')}
                  </button>
                </th>
                <th className="px-4 py-3">
                  <button
                    onClick={() => cambiarOrdenamiento('correo')}
                    className="flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                  >
                    Correo {renderizarIconoOrdenamiento('correo')}
                  </button>
                </th>
                <th className="px-4 py-3">
                  <button
                    onClick={() => cambiarOrdenamiento('telefono')}
                    className="flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                  >
                    Telefono {renderizarIconoOrdenamiento('telefono')}
                  </button>
                </th>
                <th className="px-4 py-3">
                  <button
                    onClick={() => cambiarOrdenamiento('direccion')}
                    className="flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                  >
                    Direccion {renderizarIconoOrdenamiento('direccion')}
                  </button>
                </th>
                <th className="px-4 py-3">
                  <button
                    onClick={() => cambiarOrdenamiento('localidad')}
                    className="flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                  >
                    Localidad {renderizarIconoOrdenamiento('localidad')}
                  </button>
                </th>
                <th className="px-4 py-3">
                  <button
                    onClick={() => cambiarOrdenamiento('total_sucursales')}
                    className="flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                  >
                    Sucursales {renderizarIconoOrdenamiento('total_sucursales')}
                  </button>
                </th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {clientesOrdenados.map((cliente) => (
                <tr key={cliente.id} className="hover:bg-slate-50 dark:hover:bg-slate-700">
                  <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{cliente.nombre}</td>
                  <td className="px-4 py-3">{cliente.identificacion}</td>
                  <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-200">{formatearSaldo(cliente)}</td>
                  <td className="px-4 py-3">{cliente.correo || "-"}</td>
                  <td className="px-4 py-3">{cliente.telefono || "-"}</td>
                  <td className="px-4 py-3">{cliente.direccion || "-"}</td>
                  <td className="px-4 py-3">{cliente.localidad || "-"}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 dark:bg-blue-900/20 px-2 py-1 text-xs font-medium text-blue-800 dark:text-blue-400">
                      🏢 {cliente.total_sucursales || 1}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Link
                        to={`/clientes/${cliente.id}`}
                        className="rounded-full border border-slate-200 dark:border-slate-600 px-3 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 transition hover:bg-slate-100 dark:hover:bg-slate-700"
                      >
                        Ver perfil
                      </Link>
                      <button
                        type="button"
                        onClick={() => prepararEdicion(cliente)}
                        className="rounded-full border border-blue-200 dark:border-blue-500 px-3 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 transition hover:bg-blue-50 dark:hover:bg-blue-900/20"
                      >
                        Modificar
                      </button>
                      {(cliente.total_sucursales || 1) >= 1 && (
                        <button
                          type="button"
                          onClick={() => window.alert(`Funcionalidad de gestión de sucursales para ${cliente.nombre} próximamente. Cliente tiene ${cliente.total_sucursales || 1} sucursal${(cliente.total_sucursales || 1) !== 1 ? 'es' : ''}.`)}
                          className="rounded-full border border-green-200 dark:border-green-500 px-3 py-1 text-xs font-medium text-green-600 dark:text-green-400 transition hover:bg-green-50 dark:hover:bg-green-900/20"
                        >
                          🏢 Sucursales
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => eliminarCliente(cliente)}
                        className="rounded-full border border-red-200 dark:border-red-500 px-3 py-1 text-xs font-medium text-red-600 dark:text-red-400 transition hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        Borrar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Vista de cards para móviles y tabletas */}
        <div className="lg:hidden">
          {/* Selector de ordenamiento para móvil */}
          <div className="border-b border-slate-100 dark:border-slate-700 p-4">
            <div className="flex items-center justify-between gap-3">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="ordenamiento-movil">
                Ordenar por:
              </label>
              <select
                id="ordenamiento-movil"
                value={`${ordenamiento.campo}-${ordenamiento.direccion}`}
                onChange={(e) => {
                  const [campo, direccion] = e.target.value.split('-') as [keyof Cliente, 'asc' | 'desc'];
                  setOrdenamiento({ campo, direccion });
                }}
                className="rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              >
                <option value="nombre-asc">Nombre (A-Z)</option>
                <option value="nombre-desc">Nombre (Z-A)</option>
                <option value="identificacion-asc">Identificación (A-Z)</option>
                <option value="identificacion-desc">Identificación (Z-A)</option>
                <option value="correo-asc">Correo (A-Z)</option>
                <option value="correo-desc">Correo (Z-A)</option>
                <option value="telefono-asc">Teléfono (A-Z)</option>
                <option value="telefono-desc">Teléfono (Z-A)</option>
                <option value="direccion-asc">Dirección (A-Z)</option>
                <option value="direccion-desc">Dirección (Z-A)</option>
                <option value="localidad-asc">Localidad (A-Z)</option>
                <option value="localidad-desc">Localidad (Z-A)</option>
                <option value="total_sucursales-asc">Sucursales (menor a mayor)</option>
                <option value="total_sucursales-desc">Sucursales (mayor a menor)</option>
                <option value="saldo-asc">Saldo (menor a mayor)</option>
                <option value="saldo-desc">Saldo (mayor a menor)</option>
              </select>
            </div>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
          {clientesOrdenados.map((cliente) => (
            <div key={cliente.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-700">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-slate-900 dark:text-white truncate">{cliente.nombre}</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">ID: {cliente.identificacion}</p>
                  <div className="mt-2 space-y-1">
                    {cliente.correo && (
                      <p className="text-xs text-slate-600 dark:text-slate-400">📧 {cliente.correo}</p>
                    )}
                    {cliente.telefono && (
                      <p className="text-xs text-slate-600 dark:text-slate-400">📞 {cliente.telefono}</p>
                    )}
                    {cliente.direccion && (
                      <p className="text-xs text-slate-600 dark:text-slate-400">📍 {cliente.direccion}</p>
                    )}
                    {cliente.localidad && (
                      <p className="text-xs text-slate-600 dark:text-slate-400">🏙️ {cliente.localidad}</p>
                    )}
                    <p className="text-xs text-blue-600 dark:text-blue-400">🏢 {cliente.total_sucursales || 1} sucursal{(cliente.total_sucursales || 1) !== 1 ? 'es' : ''}</p>
                  </div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-2">
                    {formatearSaldo(cliente)}
                  </p>
                </div>
                <div className="flex flex-col gap-1 ml-4">
                  <Link
                    to={`/clientes/${cliente.id}`}
                    className="rounded-full border border-slate-200 dark:border-slate-600 px-2 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 transition hover:bg-slate-100 dark:hover:bg-slate-700 text-center"
                  >
                    Ver
                  </Link>
                  <button
                    type="button"
                    onClick={() => prepararEdicion(cliente)}
                    className="rounded-full border border-blue-200 dark:border-blue-500 px-2 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 transition hover:bg-blue-50 dark:hover:bg-blue-900/20"
                  >
                    Editar
                  </button>
                  {(cliente.total_sucursales || 1) >= 1 && (
                    <button
                      type="button"
                      onClick={() => window.alert(`Funcionalidad de gestión de sucursales para ${cliente.nombre} próximamente. Cliente tiene ${cliente.total_sucursales || 1} sucursal${(cliente.total_sucursales || 1) !== 1 ? 'es' : ''}.`)}
                      className="rounded-full border border-green-200 dark:border-green-500 px-2 py-1 text-xs font-medium text-green-600 dark:text-green-400 transition hover:bg-green-50 dark:hover:bg-green-900/20"
                    >
                      🏢
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => eliminarCliente(cliente)}
                    className="rounded-full border border-red-200 dark:border-red-500 px-2 py-1 text-xs font-medium text-red-600 dark:text-red-400 transition hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    Borrar
                  </button>
                </div>
              </div>
            </div>
          ))}
          </div>
        </div>
      </div>

      <aside className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm h-fit">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              {modoEdicion ? "Editar cliente" : "Registrar nuevo cliente"}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Completa los datos minimos y guarda para {modoEdicion ? "actualizar" : "agregar"} un cliente.
            </p>
          </div>
          {modoEdicion && (
            <button
              type="button"
              onClick={cancelarEdicion}
              className="rounded-full border border-slate-200 dark:border-slate-600 px-3 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 transition hover:border-slate-300 hover:text-slate-700 dark:hover:border-slate-500 dark:hover:text-slate-200"
            >
              Cancelar edicion
            </button>
          )}
        </div>
        <form className="mt-4 grid gap-4" onSubmit={manejarSubmit}>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="cliente-nombre">
              Nombre completo *
            </label>
            <input
              id="cliente-nombre"
              type="text"
              value={formulario.nombre}
              onChange={(evento) => actualizarCampo("nombre", evento.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              placeholder="Ej: Ana Perez"
              disabled={enviando}
              required
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="cliente-razon-social">
              Razón Social (opcional)
            </label>
            <input
              id="cliente-razon-social"
              type="text"
              value={formulario.razon_social}
              onChange={(evento) => actualizarCampo("razon_social", evento.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              placeholder="Ej: Lácteos El Roble S.A."
              disabled={enviando}
            />
            <p className="text-xs text-slate-500">Solo para facturas y remitos</p>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="cliente-identificacion">
              Identificacion (CUIT/DNI) *
            </label>
            <input
              id="cliente-identificacion"
              type="text"
              value={formulario.identificacion}
              onChange={(evento) => actualizarCampo("identificacion", evento.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              placeholder="Ej: 20-12345678-5"
              disabled={modoEdicion !== null || enviando}
              required
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="cliente-correo">
              Correo electronico
            </label>
            <input
              id="cliente-correo"
              type="email"
              value={formulario.correo}
              onChange={(evento) => actualizarCampo("correo", evento.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              placeholder="nombre@empresa.com"
              disabled={enviando}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="cliente-telefono">
              Telefono
            </label>
            <input
              id="cliente-telefono"
              type="tel"
              value={formulario.telefono}
              onChange={(evento) => actualizarCampo("telefono", evento.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              placeholder="Ej: 11-1234-5678"
              disabled={enviando}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="cliente-direccion">
              Direccion
            </label>
            <input
              id="cliente-direccion"
              type="text"
              value={formulario.direccion}
              onChange={(evento) => actualizarCampo("direccion", evento.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              placeholder="Calle, numero, localidad"
              disabled={enviando}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="cliente-localidad">
              Localidad
            </label>
            <input
              id="cliente-localidad"
              type="text"
              value={formulario.localidad}
              onChange={(evento) => actualizarCampo("localidad", evento.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              placeholder="Ej: Buenos Aires"
              disabled={enviando}
            />
          </div>

          {/* Sección de múltiples sucursales */}
          <div className="border-t border-slate-200 dark:border-slate-600 pt-4">
            <div className="flex items-center gap-3 mb-3">
              <input
                id="multiples-sucursales"
                type="checkbox"
                checked={formulario.tiene_multiples_sucursales}
                onChange={(evento) => actualizarCampo("tiene_multiples_sucursales", evento.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                disabled={enviando}
              />
              <label htmlFor="multiples-sucursales" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                🏢 Este cliente tiene múltiples sucursales
              </label>
            </div>

            {formulario.tiene_multiples_sucursales && (
              <div className="space-y-4">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Define las diferentes ubicaciones donde este cliente recibe mercadería. Cada sucursal puede tener su propia dirección de entrega.
                </p>

                {formulario.sucursales.map((sucursal, indice) => (
                  <div key={indice} className="border border-slate-200 dark:border-slate-600 rounded-lg p-3 bg-slate-50 dark:bg-slate-700">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                        Sucursal {indice + 1}
                      </h4>
                      {formulario.sucursales.length > 1 && (
                        <button
                          type="button"
                          onClick={() => eliminarSucursal(indice)}
                          className="text-red-600 hover:text-red-800 text-xs"
                          disabled={enviando}
                        >
                          ✕ Eliminar
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                          Nombre de sucursal
                        </label>
                        <input
                          type="text"
                          value={sucursal.nombre_sucursal}
                          onChange={(e) => actualizarSucursal(indice, "nombre_sucursal", e.target.value)}
                          className="w-full rounded border border-slate-300 dark:border-slate-500 px-2 py-1 text-xs"
                          placeholder="Ej: Sucursal Norte"
                          disabled={enviando}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                          Código
                        </label>
                        <input
                          type="text"
                          value={sucursal.codigo_sucursal}
                          onChange={(e) => actualizarSucursal(indice, "codigo_sucursal", e.target.value)}
                          className="w-full rounded border border-slate-300 dark:border-slate-500 px-2 py-1 text-xs"
                          placeholder="Ej: NORTE"
                          disabled={enviando}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                          Dirección
                        </label>
                        <input
                          type="text"
                          value={sucursal.direccion}
                          onChange={(e) => actualizarSucursal(indice, "direccion", e.target.value)}
                          className="w-full rounded border border-slate-300 dark:border-slate-500 px-2 py-1 text-xs"
                          placeholder="Dirección de entrega"
                          disabled={enviando}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                          Localidad
                        </label>
                        <input
                          type="text"
                          value={sucursal.localidad}
                          onChange={(e) => actualizarSucursal(indice, "localidad", e.target.value)}
                          className="w-full rounded border border-slate-300 dark:border-slate-500 px-2 py-1 text-xs"
                          placeholder="Localidad"
                          disabled={enviando}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                          Teléfono
                        </label>
                        <input
                          type="text"
                          value={sucursal.telefono}
                          onChange={(e) => actualizarSucursal(indice, "telefono", e.target.value)}
                          className="w-full rounded border border-slate-300 dark:border-slate-500 px-2 py-1 text-xs"
                          placeholder="Teléfono sucursal"
                          disabled={enviando}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                          Contacto responsable
                        </label>
                        <input
                          type="text"
                          value={sucursal.contacto_responsable}
                          onChange={(e) => actualizarSucursal(indice, "contacto_responsable", e.target.value)}
                          className="w-full rounded border border-slate-300 dark:border-slate-500 px-2 py-1 text-xs"
                          placeholder="Nombre del responsable"
                          disabled={enviando}
                        />
                      </div>
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={agregarSucursal}
                  className="w-full border-2 border-dashed border-blue-300 dark:border-blue-600 rounded-lg p-3 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors text-sm"
                  disabled={enviando}
                >
                  + Agregar otra sucursal
                </button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={enviando}
              className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-blue-300"
            >
              {enviando ? "Guardando..." : modoEdicion ? "Guardar cambios" : "Guardar cliente"}
            </button>
            {mensajeExito && (
              <span className="text-sm font-medium text-emerald-600">{mensajeExito}</span>
            )}
            {mensajeError && (
              <span className="text-sm font-medium text-red-600">{mensajeError}</span>
            )}
          </div>
          <button
            type="button"
            onClick={() => recargar()}
            className="rounded-full border border-slate-200 dark:border-slate-600 px-3 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 transition hover:border-blue-200 hover:text-blue-600 dark:hover:border-blue-500 dark:hover:text-blue-400"
          >
            Recargar listado
          </button>
        </form>
      </aside>

      {cargando && (
        <p className="text-sm text-slate-500 dark:text-slate-400">Cargando clientes...</p>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-700 dark:text-red-300">
          No fue posible obtener los clientes. Detalle: {error.message || "error desconocido"}
        </div>
      )}

      {!cargando && !error && clientesOrdenados.length === 0 && (
        <p className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 text-sm text-slate-500 dark:text-slate-400">
          Todavia no hay clientes cargados.
        </p>
      )}
    </section>
  );
};

export default ClientesPage;
