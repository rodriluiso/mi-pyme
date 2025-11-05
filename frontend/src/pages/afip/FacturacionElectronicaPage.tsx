import React, { useState, useEffect } from 'react';
import { useAppContext } from '@/contexts/AppContext';

interface ConfiguracionAFIP {
  id: number;
  cuit: string;
  razon_social: string;
  ambiente: string;
  ambiente_display: string;
  punto_venta: number;
  activa: boolean;
}

interface FacturaElectronica {
  id: number;
  tipo_comprobante: string;
  tipo_comprobante_display: string;
  numero_completo: string;
  fecha_emision: string;
  cliente_razon_social: string;
  cliente_numero_documento: string;
  importe_total: number;
  estado: string;
  estado_display: string;
  cae?: string;
  fecha_vencimiento_cae?: string;
  configuracion_afip_info: ConfiguracionAFIP;
  venta_info?: {
    id: number;
    fecha: string;
    total: number;
    cliente_nombre?: string;
  };
}

interface Venta {
  id: number;
  fecha: string;
  cliente_nombre?: string;
  total: number;
  cliente_id?: number;
}

interface EstadisticasFacturacion {
  resumen: {
    total_facturas: number;
    total_importe: number;
    facturas_autorizadas: number;
    facturas_rechazadas: number;
    tasa_autorizacion: number;
  };
  por_estado: Array<{
    estado: string;
    cantidad: number;
    total_importe: number;
  }>;
  por_tipo_comprobante: Array<{
    tipo_comprobante: string;
    cantidad: number;
    total_importe: number;
  }>;
}

const FacturacionElectronicaPage = () => {
  const { isDarkMode } = useAppContext();
  const [activeTab, setActiveTab] = useState<'facturas' | 'configuracion' | 'estadisticas'>('facturas');
  const [facturas, setFacturas] = useState<FacturaElectronica[]>([]);
  const [configuraciones, setConfiguraciones] = useState<ConfiguracionAFIP[]>([]);
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [estadisticas, setEstadisticas] = useState<EstadisticasFacturacion | null>(null);
  const [loading, setLoading] = useState(false);

  // Modal states
  const [showCreateFacturaModal, setShowCreateFacturaModal] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [selectedFacturas, setSelectedFacturas] = useState<number[]>([]);

  // Form states
  const [createFacturaForm, setCreateFacturaForm] = useState({
    venta_id: '',
    configuracion_afip_id: '',
    tipo_comprobante: '6', // Factura B por defecto
    cliente_tipo_documento: '96', // DNI por defecto
    cliente_numero_documento: '',
    cliente_razon_social: '',
    cliente_email: '',
    cliente_domicilio: '',
    incluir_iva: true,
    alicuota_iva: 21.00
  });

  const [configForm, setConfigForm] = useState({
    cuit: '',
    razon_social: '',
    ambiente: 'testing',
    certificado_path: '',
    clave_privada_path: '',
    punto_venta: 1
  });

  useEffect(() => {
    fetchFacturas();
    fetchConfiguraciones();
    fetchVentas();
    fetchEstadisticas();
  }, []);

  const fetchFacturas = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api'}/finanzas/facturas-electronicas/`);
      if (response.ok) {
        const data = await response.json();
        setFacturas(data.results || data);
      }
    } catch (error) {
      console.error('Error fetching facturas:', error);
    }
  };

  const fetchConfiguraciones = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api'}/finanzas/configuraciones-afip/`);
      if (response.ok) {
        const data = await response.json();
        setConfiguraciones(data.results || data);
      }
    } catch (error) {
      console.error('Error fetching configuraciones:', error);
    }
  };

  const fetchVentas = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api'}/ventas/ventas/`);
      if (response.ok) {
        const data = await response.json();
        // Filtrar ventas que no tengan factura electrónica
        const ventasSinFactura = (data.results || data).filter((venta: any) => !venta.factura_electronica);
        setVentas(ventasSinFactura);
      }
    } catch (error) {
      console.error('Error fetching ventas:', error);
    }
  };

  const fetchEstadisticas = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api'}/finanzas/facturas-electronicas/estadisticas/`);
      if (response.ok) {
        const data = await response.json();
        setEstadisticas(data);
      }
    } catch (error) {
      console.error('Error fetching estadísticas:', error);
    }
  };

  const handleCreateFactura = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api'}/finanzas/facturas-electronicas/crear_desde_venta/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...createFacturaForm,
          venta_id: parseInt(createFacturaForm.venta_id),
          configuracion_afip_id: parseInt(createFacturaForm.configuracion_afip_id),
        }),
      });

      if (response.ok) {
        setShowCreateFacturaModal(false);
        setCreateFacturaForm({
          venta_id: '',
          configuracion_afip_id: '',
          tipo_comprobante: '6',
          cliente_tipo_documento: '96',
          cliente_numero_documento: '',
          cliente_razon_social: '',
          cliente_email: '',
          cliente_domicilio: '',
          incluir_iva: true,
          alicuota_iva: 21.00
        });
        fetchFacturas();
        fetchVentas();
      }
    } catch (error) {
      console.error('Error creating factura:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api'}/finanzas/configuraciones-afip/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(configForm),
      });

      if (response.ok) {
        setShowConfigModal(false);
        setConfigForm({
          cuit: '',
          razon_social: '',
          ambiente: 'testing',
          certificado_path: '',
          clave_privada_path: '',
          punto_venta: 1
        });
        fetchConfiguraciones();
      }
    } catch (error) {
      console.error('Error creating config:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAutorizarLote = async () => {
    if (selectedFacturas.length === 0) return;

    setLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api'}/finanzas/facturas-electronicas/autorizar_lote/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          facturas_ids: selectedFacturas
        }),
      });

      if (response.ok) {
        setSelectedFacturas([]);
        fetchFacturas();
        fetchEstadisticas();
      }
    } catch (error) {
      console.error('Error autorizando lote:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAutorizarIndividual = async (facturaId: number) => {
    setLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api'}/finanzas/facturas-electronicas/${facturaId}/autorizar_individual/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        fetchFacturas();
        fetchEstadisticas();
      }
    } catch (error) {
      console.error('Error autorizando factura:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTestConexion = async (configId: number) => {
    setLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api'}/finanzas/configuraciones-afip/${configId}/test_conexion/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        alert(`Conexión exitosa: ${data.mensaje}`);
      } else {
        const errorData = await response.json();
        alert(`Error en conexión: ${errorData.error}`);
      }
    } catch (error) {
      console.error('Error testing conexión:', error);
      alert('Error al probar conexión');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number | string) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(num);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-AR');
  };

  const getEstadoBadgeColor = (estado: string) => {
    switch (estado) {
      case 'APROBADO':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'RECHAZADO':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'PENDIENTE':
      case 'ENVIADO':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'BORRADOR':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
      default:
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    }
  };

  const tiposComprobante = [
    { value: '1', label: 'Factura A' },
    { value: '6', label: 'Factura B' },
    { value: '11', label: 'Factura C' },
    { value: '2', label: 'Nota de Débito A' },
    { value: '7', label: 'Nota de Débito B' },
    { value: '12', label: 'Nota de Débito C' },
    { value: '3', label: 'Nota de Crédito A' },
    { value: '8', label: 'Nota de Crédito B' },
    { value: '13', label: 'Nota de Crédito C' },
  ];

  const tiposDocumento = [
    { value: '80', label: 'CUIT' },
    { value: '86', label: 'CUIL' },
    { value: '96', label: 'DNI' },
    { value: '94', label: 'Pasaporte' },
    { value: '91', label: 'CI Extranjera' },
  ];

  return (
    <div className={`min-h-screen p-6 ${isDarkMode ? 'bg-slate-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Facturación Electrónica AFIP</h1>
        <p className={`${isDarkMode ? 'text-slate-400' : 'text-gray-600'}`}>
          Gestione facturas electrónicas, configuraciones AFIP y autorización de comprobantes
        </p>
      </div>

      {/* Navigation Tabs */}
      <div className="mb-6">
        <div className="border-b border-gray-200 dark:border-slate-700">
          <nav className="-mb-px flex space-x-8">
            {[
              { key: 'facturas', label: 'Facturas Electrónicas' },
              { key: 'configuracion', label: 'Configuración AFIP' },
              { key: 'estadisticas', label: 'Estadísticas' }
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.key
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-slate-400 dark:hover:text-slate-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Facturas Tab */}
      {activeTab === 'facturas' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Facturas Electrónicas</h2>
            <div className="flex space-x-3">
              {selectedFacturas.length > 0 && (
                <button
                  onClick={handleAutorizarLote}
                  disabled={loading}
                  className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                >
                  Autorizar Lote ({selectedFacturas.length})
                </button>
              )}
              <button
                onClick={() => setShowCreateFacturaModal(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                Nueva Factura
              </button>
            </div>
          </div>

          <div className={`rounded-lg border ${isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-gray-200 bg-white'} overflow-hidden`}>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                <thead className={isDarkMode ? 'bg-slate-700' : 'bg-gray-50'}>
                  <tr>
                    <th className="px-6 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={selectedFacturas.length === facturas.length && facturas.length > 0}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedFacturas(facturas.map(f => f.id));
                          } else {
                            setSelectedFacturas([]);
                          }
                        }}
                        className="rounded"
                      />
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                      Comprobante
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                      Fecha
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                      Cliente
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                      Importe
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                      Estado
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                      CAE
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDarkMode ? 'divide-slate-700' : 'divide-gray-200'}`}>
                  {facturas.map((factura) => (
                    <tr key={factura.id} className={isDarkMode ? 'hover:bg-slate-700' : 'hover:bg-gray-50'}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={selectedFacturas.includes(factura.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedFacturas([...selectedFacturas, factura.id]);
                            } else {
                              setSelectedFacturas(selectedFacturas.filter(id => id !== factura.id));
                            }
                          }}
                          className="rounded"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div>
                          <div className="font-medium">{factura.tipo_comprobante_display}</div>
                          <div className="text-gray-500 dark:text-slate-400">{factura.numero_completo}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {formatDate(factura.fecha_emision)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div>
                          <div className="font-medium">{factura.cliente_razon_social}</div>
                          <div className="text-gray-500 dark:text-slate-400">{factura.cliente_numero_documento}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        {formatCurrency(factura.importe_total)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getEstadoBadgeColor(factura.estado)}`}>
                          {factura.estado_display}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {factura.cae || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                        {factura.estado === 'BORRADOR' && (
                          <button
                            onClick={() => handleAutorizarIndividual(factura.id)}
                            disabled={loading}
                            className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300 disabled:opacity-50"
                          >
                            Autorizar
                          </button>
                        )}
                        {factura.cae && (
                          <button
                            onClick={() => window.open(`/api/finanzas/facturas-electronicas/${factura.id}/pdf/`, '_blank')}
                            className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                          >
                            PDF
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Configuración Tab */}
      {activeTab === 'configuracion' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Configuraciones AFIP</h2>
            <button
              onClick={() => setShowConfigModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Nueva Configuración
            </button>
          </div>

          <div className={`rounded-lg border ${isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-gray-200 bg-white'} overflow-hidden`}>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                <thead className={isDarkMode ? 'bg-slate-700' : 'bg-gray-50'}>
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                      CUIT
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                      Razón Social
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                      Ambiente
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                      Punto de Venta
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                      Estado
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDarkMode ? 'divide-slate-700' : 'divide-gray-200'}`}>
                  {configuraciones.map((config) => (
                    <tr key={config.id} className={isDarkMode ? 'hover:bg-slate-700' : 'hover:bg-gray-50'}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        {config.cuit}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {config.razon_social}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          config.ambiente === 'production'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                        }`}>
                          {config.ambiente_display}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {config.punto_venta}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          config.activa
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                        }`}>
                          {config.activa ? 'Activa' : 'Inactiva'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                        <button
                          onClick={() => handleTestConexion(config.id)}
                          disabled={loading || !config.activa}
                          className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 disabled:opacity-50"
                        >
                          Test Conexión
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Estadísticas Tab */}
      {activeTab === 'estadisticas' && estadisticas && (
        <div className="space-y-6">
          <h2 className="text-xl font-semibold">Estadísticas de Facturación</h2>

          {/* Resumen */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className={`rounded-lg border ${isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-gray-200 bg-white'} p-6`}>
              <div className="flex items-center">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-600 dark:text-slate-400">Total Facturas</p>
                  <p className="text-2xl font-bold">{estadisticas.resumen.total_facturas}</p>
                </div>
              </div>
            </div>

            <div className={`rounded-lg border ${isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-gray-200 bg-white'} p-6`}>
              <div className="flex items-center">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-600 dark:text-slate-400">Importe Total</p>
                  <p className="text-2xl font-bold">{formatCurrency(estadisticas.resumen.total_importe)}</p>
                </div>
              </div>
            </div>

            <div className={`rounded-lg border ${isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-gray-200 bg-white'} p-6`}>
              <div className="flex items-center">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-600 dark:text-slate-400">Autorizadas</p>
                  <p className="text-2xl font-bold text-green-600">{estadisticas.resumen.facturas_autorizadas}</p>
                </div>
              </div>
            </div>

            <div className={`rounded-lg border ${isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-gray-200 bg-white'} p-6`}>
              <div className="flex items-center">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-600 dark:text-slate-400">Tasa Autorización</p>
                  <p className="text-2xl font-bold">{estadisticas.resumen.tasa_autorizacion.toFixed(1)}%</p>
                </div>
              </div>
            </div>
          </div>

          {/* Por Estado */}
          <div className={`rounded-lg border ${isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-gray-200 bg-white'} p-6`}>
            <h3 className="text-lg font-semibold mb-4">Por Estado</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                <thead className={isDarkMode ? 'bg-slate-700' : 'bg-gray-50'}>
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                      Estado
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                      Cantidad
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                      Importe Total
                    </th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDarkMode ? 'divide-slate-700' : 'divide-gray-200'}`}>
                  {estadisticas.por_estado.map((item, index) => (
                    <tr key={index}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getEstadoBadgeColor(item.estado)}`}>
                          {item.estado}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">{item.cantidad}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">{formatCurrency(item.total_importe)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal para Nueva Factura */}
      {showCreateFacturaModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className={`${isDarkMode ? 'bg-slate-800' : 'bg-white'} rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto`}>
            <h3 className="text-lg font-semibold mb-4">Nueva Factura Electrónica</h3>

            <form onSubmit={handleCreateFactura} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Venta</label>
                  <select
                    value={createFacturaForm.venta_id}
                    onChange={(e) => setCreateFacturaForm({ ...createFacturaForm, venta_id: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-md ${isDarkMode ? 'bg-slate-700 border-slate-600' : 'bg-white border-gray-300'}`}
                    required
                  >
                    <option value="">Seleccionar venta...</option>
                    {ventas.map((venta) => (
                      <option key={venta.id} value={venta.id}>
                        Venta #{venta.id} - {formatDate(venta.fecha)} - {formatCurrency(venta.total)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Configuración AFIP</label>
                  <select
                    value={createFacturaForm.configuracion_afip_id}
                    onChange={(e) => setCreateFacturaForm({ ...createFacturaForm, configuracion_afip_id: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-md ${isDarkMode ? 'bg-slate-700 border-slate-600' : 'bg-white border-gray-300'}`}
                    required
                  >
                    <option value="">Seleccionar configuración...</option>
                    {configuraciones.filter(c => c.activa).map((config) => (
                      <option key={config.id} value={config.id}>
                        {config.razon_social} ({config.cuit})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Tipo de Comprobante</label>
                  <select
                    value={createFacturaForm.tipo_comprobante}
                    onChange={(e) => setCreateFacturaForm({ ...createFacturaForm, tipo_comprobante: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-md ${isDarkMode ? 'bg-slate-700 border-slate-600' : 'bg-white border-gray-300'}`}
                  >
                    {tiposComprobante.map((tipo) => (
                      <option key={tipo.value} value={tipo.value}>
                        {tipo.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Tipo de Documento</label>
                  <select
                    value={createFacturaForm.cliente_tipo_documento}
                    onChange={(e) => setCreateFacturaForm({ ...createFacturaForm, cliente_tipo_documento: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-md ${isDarkMode ? 'bg-slate-700 border-slate-600' : 'bg-white border-gray-300'}`}
                  >
                    {tiposDocumento.map((tipo) => (
                      <option key={tipo.value} value={tipo.value}>
                        {tipo.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Número de Documento</label>
                  <input
                    type="text"
                    value={createFacturaForm.cliente_numero_documento}
                    onChange={(e) => setCreateFacturaForm({ ...createFacturaForm, cliente_numero_documento: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-md ${isDarkMode ? 'bg-slate-700 border-slate-600' : 'bg-white border-gray-300'}`}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Razón Social</label>
                  <input
                    type="text"
                    value={createFacturaForm.cliente_razon_social}
                    onChange={(e) => setCreateFacturaForm({ ...createFacturaForm, cliente_razon_social: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-md ${isDarkMode ? 'bg-slate-700 border-slate-600' : 'bg-white border-gray-300'}`}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Email (opcional)</label>
                <input
                  type="email"
                  value={createFacturaForm.cliente_email}
                  onChange={(e) => setCreateFacturaForm({ ...createFacturaForm, cliente_email: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-md ${isDarkMode ? 'bg-slate-700 border-slate-600' : 'bg-white border-gray-300'}`}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={createFacturaForm.incluir_iva}
                    onChange={(e) => setCreateFacturaForm({ ...createFacturaForm, incluir_iva: e.target.checked })}
                    className="rounded mr-2"
                  />
                  <label className="text-sm font-medium">Incluir IVA</label>
                </div>

                {createFacturaForm.incluir_iva && (
                  <div>
                    <label className="block text-sm font-medium mb-1">Alícuota IVA (%)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={createFacturaForm.alicuota_iva}
                      onChange={(e) => setCreateFacturaForm({ ...createFacturaForm, alicuota_iva: parseFloat(e.target.value) || 0 })}
                      className={`w-full px-3 py-2 border rounded-md ${isDarkMode ? 'bg-slate-700 border-slate-600' : 'bg-white border-gray-300'}`}
                    />
                  </div>
                )}
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateFacturaModal(false)}
                  className="px-4 py-2 text-gray-600 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md disabled:opacity-50"
                >
                  {loading ? 'Creando...' : 'Crear Factura'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal para Nueva Configuración */}
      {showConfigModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className={`${isDarkMode ? 'bg-slate-800' : 'bg-white'} rounded-lg p-6 w-full max-w-md`}>
            <h3 className="text-lg font-semibold mb-4">Nueva Configuración AFIP</h3>

            <form onSubmit={handleCreateConfig} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">CUIT</label>
                <input
                  type="text"
                  value={configForm.cuit}
                  onChange={(e) => setConfigForm({ ...configForm, cuit: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-md ${isDarkMode ? 'bg-slate-700 border-slate-600' : 'bg-white border-gray-300'}`}
                  placeholder="20-12345678-9"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Razón Social</label>
                <input
                  type="text"
                  value={configForm.razon_social}
                  onChange={(e) => setConfigForm({ ...configForm, razon_social: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-md ${isDarkMode ? 'bg-slate-700 border-slate-600' : 'bg-white border-gray-300'}`}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Ambiente</label>
                <select
                  value={configForm.ambiente}
                  onChange={(e) => setConfigForm({ ...configForm, ambiente: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-md ${isDarkMode ? 'bg-slate-700 border-slate-600' : 'bg-white border-gray-300'}`}
                >
                  <option value="testing">Homologación</option>
                  <option value="production">Producción</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Punto de Venta</label>
                <input
                  type="number"
                  min="1"
                  value={configForm.punto_venta}
                  onChange={(e) => setConfigForm({ ...configForm, punto_venta: parseInt(e.target.value) || 1 })}
                  className={`w-full px-3 py-2 border rounded-md ${isDarkMode ? 'bg-slate-700 border-slate-600' : 'bg-white border-gray-300'}`}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Ruta Certificado (.crt)</label>
                <input
                  type="text"
                  value={configForm.certificado_path}
                  onChange={(e) => setConfigForm({ ...configForm, certificado_path: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-md ${isDarkMode ? 'bg-slate-700 border-slate-600' : 'bg-white border-gray-300'}`}
                  placeholder="/path/to/certificate.crt"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Ruta Clave Privada (.key)</label>
                <input
                  type="text"
                  value={configForm.clave_privada_path}
                  onChange={(e) => setConfigForm({ ...configForm, clave_privada_path: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-md ${isDarkMode ? 'bg-slate-700 border-slate-600' : 'bg-white border-gray-300'}`}
                  placeholder="/path/to/private.key"
                  required
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowConfigModal(false)}
                  className="px-4 py-2 text-gray-600 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md disabled:opacity-50"
                >
                  {loading ? 'Creando...' : 'Crear Configuración'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default FacturacionElectronicaPage;
