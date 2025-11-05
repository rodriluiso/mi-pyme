import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api/client';

interface ConfiguracionEmpresa {
  id: number;
  razon_social: string;
  nombre_fantasia: string;
  cuit: string;
  condicion_iva: string;
  inicio_actividades: string | null;
  domicilio_fiscal: string;
  localidad: string;
  provincia: string;
  codigo_postal: string;
  telefono: string;
  email: string;
  sitio_web: string;
  punto_venta: number;
  ingresos_brutos: string;
  cai: string;
  cai_vencimiento: string | null;
  pie_remito: string;
  pie_factura: string;
  banco_nombre: string;
  banco_cbu: string;
  banco_alias: string;
  logo: string | null;
  actualizado_en: string;
  actualizado_por_nombre?: string;
}

const CONDICIONES_IVA = [
  { value: 'responsable_inscripto', label: 'Responsable Inscripto' },
  { value: 'monotributo', label: 'Monotributo' },
  { value: 'exento', label: 'Exento' },
  { value: 'consumidor_final', label: 'Consumidor Final' },
];

export default function ConfiguracionEmpresaPage() {
  const [configuracion, setConfiguracion] = useState<ConfiguracionEmpresa | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'basico' | 'fiscal' | 'documentos' | 'banco'>('basico');

  useEffect(() => {
    cargarConfiguracion();
  }, []);

  const cargarConfiguracion = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/configuracion/actual/');
      setConfiguracion(response.data);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Error al cargar configuración');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!configuracion) return;

    try {
      setSaving(true);
      setError(null);
      setSuccessMessage(null);

      const response = await apiClient.put(`/configuracion/${configuracion.id}/`, configuracion);
      setConfiguracion(response.data);
      setSuccessMessage('Configuración guardada exitosamente');

      // Limpiar mensaje después de 3 segundos
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Error al guardar configuración');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field: keyof ConfiguracionEmpresa, value: any) => {
    if (!configuracion) return;
    setConfiguracion({ ...configuracion, [field]: value });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando configuración...</p>
        </div>
      </div>
    );
  }

  if (!configuracion) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          No se pudo cargar la configuración de empresa
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'basico', label: 'Datos Básicos' },
    { id: 'fiscal', label: 'Datos Fiscales' },
    { id: 'documentos', label: 'Documentos' },
    { id: 'banco', label: 'Datos Bancarios' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Configuración de Empresa</h1>
              <p className="mt-1 text-sm text-gray-600">
                Datos que aparecerán en remitos, facturas y documentos oficiales
              </p>
            </div>
            {configuracion.actualizado_por_nombre && (
              <div className="text-right text-sm text-gray-500">
                <p>Última actualización:</p>
                <p>{new Date(configuracion.actualizado_en).toLocaleString()}</p>
                <p>por {configuracion.actualizado_por_nombre}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mensajes */}
      {error && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        </div>
      )}

      {successMessage && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
            ✓ {successMessage}
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tabs */}
        <div className="mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white shadow rounded-lg">
          <div className="px-6 py-8">
            {/* Tab: Datos Básicos */}
            {activeTab === 'basico' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Razón Social *
                    </label>
                    <input
                      type="text"
                      value={configuracion.razon_social}
                      onChange={(e) => handleChange('razon_social', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Nombre de Fantasía
                    </label>
                    <input
                      type="text"
                      value={configuracion.nombre_fantasia}
                      onChange={(e) => handleChange('nombre_fantasia', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Domicilio Fiscal *
                    </label>
                    <input
                      type="text"
                      value={configuracion.domicilio_fiscal}
                      onChange={(e) => handleChange('domicilio_fiscal', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Localidad *
                    </label>
                    <input
                      type="text"
                      value={configuracion.localidad}
                      onChange={(e) => handleChange('localidad', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Provincia *
                    </label>
                    <input
                      type="text"
                      value={configuracion.provincia}
                      onChange={(e) => handleChange('provincia', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Código Postal *
                    </label>
                    <input
                      type="text"
                      value={configuracion.codigo_postal}
                      onChange={(e) => handleChange('codigo_postal', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Teléfono
                    </label>
                    <input
                      type="text"
                      value={configuracion.telefono}
                      onChange={(e) => handleChange('telefono', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email
                    </label>
                    <input
                      type="email"
                      value={configuracion.email}
                      onChange={(e) => handleChange('email', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Sitio Web
                    </label>
                    <input
                      type="url"
                      value={configuracion.sitio_web}
                      onChange={(e) => handleChange('sitio_web', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="https://www.ejemplo.com"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Tab: Datos Fiscales */}
            {activeTab === 'fiscal' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      CUIT *
                    </label>
                    <input
                      type="text"
                      value={configuracion.cuit}
                      onChange={(e) => handleChange('cuit', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="XX-XXXXXXXX-X"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Condición ante IVA *
                    </label>
                    <select
                      value={configuracion.condicion_iva}
                      onChange={(e) => handleChange('condicion_iva', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      {CONDICIONES_IVA.map((condicion) => (
                        <option key={condicion.value} value={condicion.value}>
                          {condicion.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Inicio de Actividades
                    </label>
                    <input
                      type="date"
                      value={configuracion.inicio_actividades || ''}
                      onChange={(e) => handleChange('inicio_actividades', e.target.value || null)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Ingresos Brutos
                    </label>
                    <input
                      type="text"
                      value={configuracion.ingresos_brutos}
                      onChange={(e) => handleChange('ingresos_brutos', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Número de Ingresos Brutos"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Punto de Venta AFIP
                    </label>
                    <input
                      type="number"
                      value={configuracion.punto_venta}
                      onChange={(e) => handleChange('punto_venta', parseInt(e.target.value) || 1)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      min="1"
                    />
                    <p className="mt-1 text-sm text-gray-500">
                      Punto de venta para facturación electrónica
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      CAI (Código de Autorización de Impresión)
                    </label>
                    <input
                      type="text"
                      value={configuracion.cai}
                      onChange={(e) => handleChange('cai', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Código de Autorización"
                    />
                    <p className="mt-1 text-sm text-gray-500">
                      Código autorizado por AFIP para emitir comprobantes
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Vencimiento del CAI
                    </label>
                    <input
                      type="date"
                      value={configuracion.cai_vencimiento || ''}
                      onChange={(e) => handleChange('cai_vencimiento', e.target.value || null)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="mt-1 text-sm text-gray-500">
                      Fecha de vencimiento del CAI
                    </p>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                  <h3 className="text-sm font-medium text-blue-900 mb-2">
                    Certificados AFIP (Próximamente)
                  </h3>
                  <p className="text-sm text-blue-700">
                    La carga de certificados digitales para facturación electrónica estará disponible próximamente.
                    Contacta al administrador del sistema para más información.
                  </p>
                </div>
              </div>
            )}

            {/* Tab: Documentos */}
            {activeTab === 'documentos' && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Pie de Remito
                  </label>
                  <textarea
                    value={configuracion.pie_remito}
                    onChange={(e) => handleChange('pie_remito', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={4}
                    placeholder="Texto que aparecerá al pie de los remitos..."
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    Este texto aparecerá al pie de todos los remitos generados
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Pie de Factura
                  </label>
                  <textarea
                    value={configuracion.pie_factura}
                    onChange={(e) => handleChange('pie_factura', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={4}
                    placeholder="Texto que aparecerá al pie de las facturas..."
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    Este texto aparecerá al pie de todas las facturas generadas
                  </p>
                </div>
              </div>
            )}

            {/* Tab: Datos Bancarios */}
            {activeTab === 'banco' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Banco
                    </label>
                    <input
                      type="text"
                      value={configuracion.banco_nombre}
                      onChange={(e) => handleChange('banco_nombre', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Nombre del banco"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      CBU
                    </label>
                    <input
                      type="text"
                      value={configuracion.banco_cbu}
                      onChange={(e) => handleChange('banco_cbu', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="0000000000000000000000"
                      maxLength={22}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Alias CBU
                    </label>
                    <input
                      type="text"
                      value={configuracion.banco_alias}
                      onChange={(e) => handleChange('banco_alias', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="MI.EMPRESA.ALIAS"
                    />
                  </div>
                </div>

                <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
                  <p className="text-sm text-gray-700">
                    Los datos bancarios aparecerán en las facturas para facilitar el pago de tus clientes
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Footer con botón guardar */}
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 rounded-b-lg flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className={`px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors ${
                saving ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {saving ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
