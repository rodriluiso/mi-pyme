import React, { useState, useEffect } from 'react';
import { useAppContext } from '@/contexts/AppContext';

interface CuentaBancaria {
  id: number;
  banco: string;
  numero_cuenta: string;
  tipo_cuenta: string;
  tipo_cuenta_display: string;
  titular: string;
  cbu?: string;
  alias?: string;
  saldo_actual: number;
  activa: boolean;
}

interface ExtractoBancario {
  id: number;
  cuenta_bancaria: number;
  cuenta_bancaria_info: CuentaBancaria;
  archivo_nombre: string;
  fecha_importacion: string;
  fecha_desde: string;
  fecha_hasta: string;
  saldo_inicial: number;
  saldo_final: number;
  total_movimientos: number;
  procesado: boolean;
}

interface MovimientoBancario {
  id: number;
  fecha: string;
  descripcion: string;
  referencia?: string;
  debito?: number;
  credito?: number;
  monto: number;
  saldo: number;
  conciliado: boolean;
  observaciones?: string;
}

interface ConciliacionBancaria {
  id: number;
  cuenta_bancaria: number;
  cuenta_bancaria_info: CuentaBancaria;
  fecha_conciliacion: string;
  fecha_creacion: string;
  saldo_libro: number;
  saldo_banco: number;
  diferencia: number;
  observaciones?: string;
  usuario?: string;
}

const ConciliacionBancariaPage = () => {
  const { isDarkMode } = useAppContext();
  const [activeTab, setActiveTab] = useState<'cuentas' | 'extractos' | 'conciliaciones'>('cuentas');
  const [cuentasBancarias, setCuentasBancarias] = useState<CuentaBancaria[]>([]);
  const [extractosBancarios, setExtractosBancarios] = useState<ExtractoBancario[]>([]);
  const [conciliaciones, setConciliaciones] = useState<ConciliacionBancaria[]>([]);
  const [movimientosBancarios, setMovimientosBancarios] = useState<MovimientoBancario[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedExtracto, setSelectedExtracto] = useState<ExtractoBancario | null>(null);

  // Modal states
  const [showNewAccountModal, setShowNewAccountModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showConciliationModal, setShowConciliationModal] = useState(false);

  // Form states
  const [newAccount, setNewAccount] = useState({
    banco: '',
    numero_cuenta: '',
    tipo_cuenta: 'CORRIENTE',
    titular: '',
    cbu: '',
    alias: '',
    saldo_actual: 0
  });

  const [importForm, setImportForm] = useState({
    cuenta_bancaria: '',
    fecha_desde: '',
    fecha_hasta: '',
    saldo_inicial: 0,
    saldo_final: 0,
    archivo: null as File | null
  });

  const [conciliationForm, setConciliationForm] = useState({
    cuenta_bancaria_id: '',
    fecha_conciliacion: '',
    saldo_banco: 0,
    observaciones: ''
  });

  useEffect(() => {
    fetchCuentasBancarias();
    fetchExtractosBancarios();
    fetchConciliaciones();
  }, []);

  const fetchCuentasBancarias = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api'}/finanzas/cuentas-bancarias/`);
      if (response.ok) {
        const data = await response.json();
        setCuentasBancarias(data.results || data);
      }
    } catch (error) {
      console.error('Error fetching bank accounts:', error);
    }
  };

  const fetchExtractosBancarios = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api'}/finanzas/extractos-bancarios/`);
      if (response.ok) {
        const data = await response.json();
        setExtractosBancarios(data.results || data);
      }
    } catch (error) {
      console.error('Error fetching bank statements:', error);
    }
  };

  const fetchConciliaciones = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api'}/finanzas/conciliaciones-bancarias/`);
      if (response.ok) {
        const data = await response.json();
        setConciliaciones(data.results || data);
      }
    } catch (error) {
      console.error('Error fetching reconciliations:', error);
    }
  };

  const fetchMovimientosBancarios = async (extractoId: number) => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api'}/finanzas/movimientos-bancarios/?extracto=${extractoId}`);
      if (response.ok) {
        const data = await response.json();
        setMovimientosBancarios(data.results || data);
      }
    } catch (error) {
      console.error('Error fetching bank movements:', error);
    }
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api'}/finanzas/cuentas-bancarias/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newAccount),
      });

      if (response.ok) {
        setShowNewAccountModal(false);
        setNewAccount({
          banco: '',
          numero_cuenta: '',
          tipo_cuenta: 'CORRIENTE',
          titular: '',
          cbu: '',
          alias: '',
          saldo_actual: 0
        });
        fetchCuentasBancarias();
      }
    } catch (error) {
      console.error('Error creating account:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleImportExtract = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importForm.archivo) return;

    setLoading(true);
    const formData = new FormData();
    formData.append('cuenta_bancaria', importForm.cuenta_bancaria);
    formData.append('fecha_desde', importForm.fecha_desde);
    formData.append('fecha_hasta', importForm.fecha_hasta);
    formData.append('saldo_inicial', importForm.saldo_inicial.toString());
    formData.append('saldo_final', importForm.saldo_final.toString());
    formData.append('archivo', importForm.archivo);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api'}/finanzas/extractos-bancarios/importar_extracto/`, {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        setShowImportModal(false);
        setImportForm({
          cuenta_bancaria: '',
          fecha_desde: '',
          fecha_hasta: '',
          saldo_inicial: 0,
          saldo_final: 0,
          archivo: null
        });
        fetchExtractosBancarios();
      }
    } catch (error) {
      console.error('Error importing extract:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateConciliation = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api'}/finanzas/conciliaciones-bancarias/generar_conciliacion/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(conciliationForm),
      });

      if (response.ok) {
        setShowConciliationModal(false);
        setConciliationForm({
          cuenta_bancaria_id: '',
          fecha_conciliacion: '',
          saldo_banco: 0,
          observaciones: ''
        });
        fetchConciliaciones();
      }
    } catch (error) {
      console.error('Error generating conciliation:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAutoReconcile = async (extractoId: number) => {
    setLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api'}/finanzas/extractos-bancarios/${extractoId}/conciliar_automatico/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        if (selectedExtracto && selectedExtracto.id === extractoId) {
          fetchMovimientosBancarios(extractoId);
        }
        fetchExtractosBancarios();
      }
    } catch (error) {
      console.error('Error auto reconciling:', error);
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

  return (
    <div className={`min-h-screen p-6 ${isDarkMode ? 'bg-slate-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Conciliación Bancaria</h1>
        <p className={`${isDarkMode ? 'text-slate-400' : 'text-gray-600'}`}>
          Gestione cuentas bancarias, importe extractos y realice conciliaciones automáticas
        </p>
      </div>

      {/* Navigation Tabs */}
      <div className="mb-6">
        <div className="border-b border-gray-200 dark:border-slate-700">
          <nav className="-mb-px flex space-x-8">
            {[
              { key: 'cuentas', label: 'Cuentas Bancarias' },
              { key: 'extractos', label: 'Extractos Bancarios' },
              { key: 'conciliaciones', label: 'Conciliaciones' }
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

      {/* Cuentas Bancarias Tab */}
      {activeTab === 'cuentas' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Cuentas Bancarias</h2>
            <button
              onClick={() => setShowNewAccountModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Nueva Cuenta
            </button>
          </div>

          <div className={`rounded-lg border ${isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-gray-200 bg-white'} overflow-hidden`}>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                <thead className={isDarkMode ? 'bg-slate-700' : 'bg-gray-50'}>
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                      Banco
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                      Número de Cuenta
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                      Tipo
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                      Titular
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                      Saldo Actual
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                      Estado
                    </th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDarkMode ? 'divide-slate-700' : 'divide-gray-200'}`}>
                  {cuentasBancarias.map((cuenta) => (
                    <tr key={cuenta.id} className={isDarkMode ? 'hover:bg-slate-700' : 'hover:bg-gray-50'}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        {cuenta.banco}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {cuenta.numero_cuenta}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {cuenta.tipo_cuenta_display}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {cuenta.titular}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {formatCurrency(cuenta.saldo_actual)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          cuenta.activa
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                        }`}>
                          {cuenta.activa ? 'Activa' : 'Inactiva'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Extractos Bancarios Tab */}
      {activeTab === 'extractos' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Extractos Bancarios</h2>
            <button
              onClick={() => setShowImportModal(true)}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Importar Extracto
            </button>
          </div>

          <div className={`rounded-lg border ${isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-gray-200 bg-white'} overflow-hidden`}>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                <thead className={isDarkMode ? 'bg-slate-700' : 'bg-gray-50'}>
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                      Cuenta
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                      Período
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                      Movimientos
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
                  {extractosBancarios.map((extracto) => (
                    <tr key={extracto.id} className={isDarkMode ? 'hover:bg-slate-700' : 'hover:bg-gray-50'}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div>
                          <div className="font-medium">{extracto.cuenta_bancaria_info.banco}</div>
                          <div className="text-gray-500 dark:text-slate-400">{extracto.cuenta_bancaria_info.numero_cuenta}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {formatDate(extracto.fecha_desde)} - {formatDate(extracto.fecha_hasta)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {extracto.total_movimientos}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          extracto.procesado
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                        }`}>
                          {extracto.procesado ? 'Procesado' : 'Pendiente'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                        <button
                          onClick={() => {
                            setSelectedExtracto(extracto);
                            fetchMovimientosBancarios(extracto.id);
                          }}
                          className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                        >
                          Ver Movimientos
                        </button>
                        {extracto.procesado && (
                          <button
                            onClick={() => handleAutoReconcile(extracto.id)}
                            disabled={loading}
                            className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300 disabled:opacity-50"
                          >
                            Conciliar Auto
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Movimientos del extracto seleccionado */}
          {selectedExtracto && (
            <div className={`rounded-lg border ${isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-gray-200 bg-white'} p-6`}>
              <h3 className="text-lg font-semibold mb-4">
                Movimientos - {selectedExtracto.cuenta_bancaria_info.banco} ({formatDate(selectedExtracto.fecha_desde)} - {formatDate(selectedExtracto.fecha_hasta)})
              </h3>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                  <thead className={isDarkMode ? 'bg-slate-700' : 'bg-gray-50'}>
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                        Fecha
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                        Descripción
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                        Débito
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                        Crédito
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                        Saldo
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                        Estado
                      </th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${isDarkMode ? 'divide-slate-700' : 'divide-gray-200'}`}>
                    {movimientosBancarios.map((movimiento) => (
                      <tr key={movimiento.id} className={isDarkMode ? 'hover:bg-slate-700' : 'hover:bg-gray-50'}>
                        <td className="px-4 py-3 whitespace-nowrap text-sm">
                          {formatDate(movimiento.fecha)}
                        </td>
                        <td className="px-4 py-3 text-sm max-w-xs">
                          <div className="truncate" title={movimiento.descripcion}>
                            {movimiento.descripcion}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-red-600 dark:text-red-400">
                          {movimiento.debito ? formatCurrency(movimiento.debito) : '-'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-green-600 dark:text-green-400">
                          {movimiento.credito ? formatCurrency(movimiento.credito) : '-'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm">
                          {formatCurrency(movimiento.saldo)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            movimiento.conciliado
                              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                              : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                          }`}>
                            {movimiento.conciliado ? 'Conciliado' : 'Pendiente'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Conciliaciones Tab */}
      {activeTab === 'conciliaciones' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Conciliaciones Bancarias</h2>
            <button
              onClick={() => setShowConciliationModal(true)}
              className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Nueva Conciliación
            </button>
          </div>

          <div className={`rounded-lg border ${isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-gray-200 bg-white'} overflow-hidden`}>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                <thead className={isDarkMode ? 'bg-slate-700' : 'bg-gray-50'}>
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                      Cuenta
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                      Fecha
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                      Saldo Libro
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                      Saldo Banco
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                      Diferencia
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                      Usuario
                    </th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDarkMode ? 'divide-slate-700' : 'divide-gray-200'}`}>
                  {conciliaciones.map((conciliacion) => (
                    <tr key={conciliacion.id} className={isDarkMode ? 'hover:bg-slate-700' : 'hover:bg-gray-50'}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div>
                          <div className="font-medium">{conciliacion.cuenta_bancaria_info.banco}</div>
                          <div className="text-gray-500 dark:text-slate-400">{conciliacion.cuenta_bancaria_info.numero_cuenta}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {formatDate(conciliacion.fecha_conciliacion)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {formatCurrency(conciliacion.saldo_libro)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {formatCurrency(conciliacion.saldo_banco)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`${
                          conciliacion.diferencia === 0
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}>
                          {formatCurrency(conciliacion.diferencia)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {conciliacion.usuario || 'Sistema'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal para Nueva Cuenta */}
      {showNewAccountModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className={`${isDarkMode ? 'bg-slate-800' : 'bg-white'} rounded-lg p-6 w-full max-w-md`}>
            <h3 className="text-lg font-semibold mb-4">Nueva Cuenta Bancaria</h3>

            <form onSubmit={handleCreateAccount} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Banco</label>
                <input
                  type="text"
                  value={newAccount.banco}
                  onChange={(e) => setNewAccount({ ...newAccount, banco: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-md ${isDarkMode ? 'bg-slate-700 border-slate-600' : 'bg-white border-gray-300'}`}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Número de Cuenta</label>
                <input
                  type="text"
                  value={newAccount.numero_cuenta}
                  onChange={(e) => setNewAccount({ ...newAccount, numero_cuenta: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-md ${isDarkMode ? 'bg-slate-700 border-slate-600' : 'bg-white border-gray-300'}`}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Tipo de Cuenta</label>
                <select
                  value={newAccount.tipo_cuenta}
                  onChange={(e) => setNewAccount({ ...newAccount, tipo_cuenta: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-md ${isDarkMode ? 'bg-slate-700 border-slate-600' : 'bg-white border-gray-300'}`}
                >
                  <option value="CORRIENTE">Cuenta Corriente</option>
                  <option value="AHORRO">Caja de Ahorro</option>
                  <option value="PLAZO_FIJO">Plazo Fijo</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Titular</label>
                <input
                  type="text"
                  value={newAccount.titular}
                  onChange={(e) => setNewAccount({ ...newAccount, titular: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-md ${isDarkMode ? 'bg-slate-700 border-slate-600' : 'bg-white border-gray-300'}`}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Saldo Inicial</label>
                <input
                  type="number"
                  step="0.01"
                  value={newAccount.saldo_actual}
                  onChange={(e) => setNewAccount({ ...newAccount, saldo_actual: parseFloat(e.target.value) || 0 })}
                  className={`w-full px-3 py-2 border rounded-md ${isDarkMode ? 'bg-slate-700 border-slate-600' : 'bg-white border-gray-300'}`}
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowNewAccountModal(false)}
                  className="px-4 py-2 text-gray-600 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md disabled:opacity-50"
                >
                  {loading ? 'Creando...' : 'Crear Cuenta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal para Importar Extracto */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className={`${isDarkMode ? 'bg-slate-800' : 'bg-white'} rounded-lg p-6 w-full max-w-md`}>
            <h3 className="text-lg font-semibold mb-4">Importar Extracto Bancario</h3>

            <form onSubmit={handleImportExtract} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Cuenta Bancaria</label>
                <select
                  value={importForm.cuenta_bancaria}
                  onChange={(e) => setImportForm({ ...importForm, cuenta_bancaria: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-md ${isDarkMode ? 'bg-slate-700 border-slate-600' : 'bg-white border-gray-300'}`}
                  required
                >
                  <option value="">Seleccionar cuenta...</option>
                  {cuentasBancarias.filter(c => c.activa).map((cuenta) => (
                    <option key={cuenta.id} value={cuenta.id}>
                      {cuenta.banco} - {cuenta.numero_cuenta}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Fecha Desde</label>
                  <input
                    type="date"
                    value={importForm.fecha_desde}
                    onChange={(e) => setImportForm({ ...importForm, fecha_desde: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-md ${isDarkMode ? 'bg-slate-700 border-slate-600' : 'bg-white border-gray-300'}`}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Fecha Hasta</label>
                  <input
                    type="date"
                    value={importForm.fecha_hasta}
                    onChange={(e) => setImportForm({ ...importForm, fecha_hasta: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-md ${isDarkMode ? 'bg-slate-700 border-slate-600' : 'bg-white border-gray-300'}`}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Saldo Inicial</label>
                  <input
                    type="number"
                    step="0.01"
                    value={importForm.saldo_inicial}
                    onChange={(e) => setImportForm({ ...importForm, saldo_inicial: parseFloat(e.target.value) || 0 })}
                    className={`w-full px-3 py-2 border rounded-md ${isDarkMode ? 'bg-slate-700 border-slate-600' : 'bg-white border-gray-300'}`}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Saldo Final</label>
                  <input
                    type="number"
                    step="0.01"
                    value={importForm.saldo_final}
                    onChange={(e) => setImportForm({ ...importForm, saldo_final: parseFloat(e.target.value) || 0 })}
                    className={`w-full px-3 py-2 border rounded-md ${isDarkMode ? 'bg-slate-700 border-slate-600' : 'bg-white border-gray-300'}`}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Archivo (CSV/Excel)</label>
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={(e) => setImportForm({ ...importForm, archivo: e.target.files?.[0] || null })}
                  className={`w-full px-3 py-2 border rounded-md ${isDarkMode ? 'bg-slate-700 border-slate-600' : 'bg-white border-gray-300'}`}
                  required
                />
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                  Formatos soportados: CSV, Excel (.xlsx, .xls)
                </p>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowImportModal(false)}
                  className="px-4 py-2 text-gray-600 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md disabled:opacity-50"
                >
                  {loading ? 'Importando...' : 'Importar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal para Nueva Conciliación */}
      {showConciliationModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className={`${isDarkMode ? 'bg-slate-800' : 'bg-white'} rounded-lg p-6 w-full max-w-md`}>
            <h3 className="text-lg font-semibold mb-4">Nueva Conciliación Bancaria</h3>

            <form onSubmit={handleGenerateConciliation} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Cuenta Bancaria</label>
                <select
                  value={conciliationForm.cuenta_bancaria_id}
                  onChange={(e) => setConciliationForm({ ...conciliationForm, cuenta_bancaria_id: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-md ${isDarkMode ? 'bg-slate-700 border-slate-600' : 'bg-white border-gray-300'}`}
                  required
                >
                  <option value="">Seleccionar cuenta...</option>
                  {cuentasBancarias.filter(c => c.activa).map((cuenta) => (
                    <option key={cuenta.id} value={cuenta.id}>
                      {cuenta.banco} - {cuenta.numero_cuenta}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Fecha de Conciliación</label>
                <input
                  type="date"
                  value={conciliationForm.fecha_conciliacion}
                  onChange={(e) => setConciliationForm({ ...conciliationForm, fecha_conciliacion: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-md ${isDarkMode ? 'bg-slate-700 border-slate-600' : 'bg-white border-gray-300'}`}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Saldo según Banco</label>
                <input
                  type="number"
                  step="0.01"
                  value={conciliationForm.saldo_banco}
                  onChange={(e) => setConciliationForm({ ...conciliationForm, saldo_banco: parseFloat(e.target.value) || 0 })}
                  className={`w-full px-3 py-2 border rounded-md ${isDarkMode ? 'bg-slate-700 border-slate-600' : 'bg-white border-gray-300'}`}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Observaciones</label>
                <textarea
                  value={conciliationForm.observaciones}
                  onChange={(e) => setConciliationForm({ ...conciliationForm, observaciones: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-md ${isDarkMode ? 'bg-slate-700 border-slate-600' : 'bg-white border-gray-300'}`}
                  rows={3}
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowConciliationModal(false)}
                  className="px-4 py-2 text-gray-600 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-md disabled:opacity-50"
                >
                  {loading ? 'Generando...' : 'Generar Conciliación'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConciliacionBancariaPage;
