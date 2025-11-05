import { useState, useEffect } from "react";
import { useApi } from "@/hooks/useApi";
import type { Venta } from "@/types/mipyme";

const formatearMoneda = (valor: number) => {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2
  }).format(valor);
};

const formatearFecha = (fecha: string) => {
  return new Date(fecha).toLocaleDateString('es-AR');
};

const getEstadoColor = (estado: string) => {
  switch (estado) {
    case 'PAGADO':
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    case 'PENDIENTE':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    case 'PARCIAL':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    case 'VENCIDO':
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
    case 'CANCELADO':
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
  }
};

const getUrgenciaColor = (urgencia: string) => {
  switch (urgencia) {
    case 'ALTA':
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
    case 'MEDIA':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    case 'BAJA':
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
  }
};

type TabType = 'pendientes' | 'vencidas' | 'urgentes' | 'resumen';

export default function CobranzasPage() {
  const api = useApi();
  const [activeTab, setActiveTab] = useState<TabType>('pendientes');
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [resumen, setResumen] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargarDatos = async () => {
    setLoading(true);
    setError(null);

    try {
      let endpoint = '';
      switch (activeTab) {
        case 'pendientes':
          endpoint = '/api/ventas/cobranzas/pendientes/';
          break;
        case 'vencidas':
          endpoint = '/api/ventas/cobranzas/vencidas/';
          break;
        case 'urgentes':
          endpoint = '/api/ventas/cobranzas/urgentes/';
          break;
        case 'resumen':
          endpoint = '/api/ventas/cobranzas/resumen/';
          break;
      }

      const response = await api.get(endpoint);

      if (activeTab === 'resumen') {
        setResumen(response);
        setVentas([]);
      } else {
        setVentas(response);
        setResumen(null);
      }
    } catch (err: any) {
      setError(err.message || 'Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  };

  const marcarRecordatorio = async (ventaId: number) => {
    try {
      await api.post(`/api/ventas/${ventaId}/marcar-recordatorio/`);
      await cargarDatos(); // Recargar datos
    } catch (err: any) {
      setError(err.message || 'Error al marcar recordatorio');
    }
  };

  useEffect(() => {
    cargarDatos();
  }, [activeTab]);

  const tabs = [
    { key: 'pendientes' as TabType, label: 'Pendientes', count: ventas.length },
    { key: 'vencidas' as TabType, label: 'Vencidas', count: ventas.length },
    { key: 'urgentes' as TabType, label: 'Urgentes', count: ventas.length },
    { key: 'resumen' as TabType, label: 'Resumen', count: null }
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Gestión de Cobranzas
        </h1>
        <p className="text-gray-600 dark:text-gray-300">
          Monitoreo y seguimiento de pagos pendientes
        </p>
      </div>

      {/* Pestañas */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.key
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              {tab.label}
              {tab.count !== null && (
                <span className="ml-2 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 py-0.5 px-2 rounded-full text-xs">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Contenido */}
      {loading && (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-200 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {/* Vista de Resumen */}
      {activeTab === 'resumen' && resumen && !loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Pendientes de Cobro
            </h3>
            <p className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">
              {resumen.pendientes}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">ventas</p>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Vencidas
            </h3>
            <p className="text-3xl font-bold text-red-600 dark:text-red-400">
              {resumen.vencidas}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">ventas</p>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Monto Pendiente
            </h3>
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {formatearMoneda(resumen.monto_pendiente_total)}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">total</p>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Monto Cobrado
            </h3>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
              {formatearMoneda(resumen.monto_pagado_total)}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">total</p>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Efectividad de Cobranza
            </h3>
            <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">
              {resumen.porcentaje_cobranza}%
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">del total</p>
          </div>
        </div>
      )}

      {/* Lista de Ventas */}
      {activeTab !== 'resumen' && !loading && (
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden border dark:border-gray-700">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Venta
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Cliente
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Total
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Saldo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Vencimiento
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Urgencia
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {ventas.map((venta) => (
                  <tr key={venta.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        #{venta.numero || venta.id}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {formatearFecha(venta.fecha)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-white">
                        {venta.cliente_nombre}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getEstadoColor(venta.estado_pago)}`}>
                        {venta.estado_pago}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {formatearMoneda(Number(venta.total))}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {formatearMoneda(Number(venta.saldo_pendiente))}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {venta.fecha_vencimiento ? (
                        <div className="text-sm text-gray-900 dark:text-white">
                          {formatearFecha(venta.fecha_vencimiento)}
                          {venta.esta_vencido && (
                            <div className="text-xs text-red-600 dark:text-red-400">
                              Vencido hace {venta.dias_vencimiento} días
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-gray-500 dark:text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getUrgenciaColor(venta.urgencia_cobranza)}`}>
                        {venta.urgencia_cobranza}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        {venta.puede_enviar_recordatorio && (
                          <button
                            onClick={() => marcarRecordatorio(venta.id)}
                            className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                          >
                            Recordatorio
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {ventas.length === 0 && !loading && (
            <div className="text-center py-12">
              <p className="text-gray-500 dark:text-gray-400">
                No hay ventas en esta categoría
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}