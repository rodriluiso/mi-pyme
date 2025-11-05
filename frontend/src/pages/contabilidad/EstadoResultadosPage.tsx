import { useState, useEffect } from 'react';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface CuentaResultado {
  id: number;
  cuenta: {
    codigo: string;
    nombre: string;
    tipo_cuenta: string;
  };
  importe: string;
}

interface EstadoResultados {
  id: number;
  fecha_desde: string;
  fecha_hasta: string;
  total_ingresos: string;
  total_costos: string;
  total_gastos: string;
  utilidad_bruta: string;
  utilidad_neta: string;
  fecha_generacion: string;
  usuario: string;
  detalles: CuentaResultado[];
}

const EstadoResultadosPage = () => {
  const [estados, setEstados] = useState<EstadoResultados[]>([]);
  const [selectedEstado, setSelectedEstado] = useState<EstadoResultados | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [fechaDesde, setFechaDesde] = useState(
    format(startOfMonth(new Date()), 'yyyy-MM-dd')
  );
  const [fechaHasta, setFechaHasta] = useState(
    format(endOfMonth(new Date()), 'yyyy-MM-dd')
  );

  const fetchEstados = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:8000/api/contabilidad/estado-resultados/');
      if (!response.ok) throw new Error('Error al cargar estados de resultados');
      const data = await response.json();
      setEstados(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  const generateEstado = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:8000/api/contabilidad/estado-resultados/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fecha_desde: fechaDesde,
          fecha_hasta: fechaHasta
        })
      });

      if (!response.ok) throw new Error('Error al generar estado de resultados');

      await fetchEstados();
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEstados();
  }, []);

  const formatCurrency = (amount: string) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(parseFloat(amount));
  };

  const getChartData = () => {
    if (!selectedEstado) return [];

    return [
      {
        name: 'Ingresos',
        valor: parseFloat(selectedEstado.total_ingresos),
        color: '#10b981'
      },
      {
        name: 'Costos',
        valor: -parseFloat(selectedEstado.total_costos),
        color: '#f59e0b'
      },
      {
        name: 'Gastos',
        valor: -parseFloat(selectedEstado.total_gastos),
        color: '#ef4444'
      },
      {
        name: 'Utilidad Neta',
        valor: parseFloat(selectedEstado.utilidad_neta),
        color: '#3b82f6'
      }
    ];
  };

  const groupedAccounts = selectedEstado?.detalles.reduce((groups, cuenta) => {
    const tipo = cuenta.cuenta.tipo_cuenta;
    if (!groups[tipo]) groups[tipo] = [];
    groups[tipo].push(cuenta);
    return groups;
  }, {} as Record<string, CuentaResultado[]>) || {};

  const margenBruto = selectedEstado ?
    (parseFloat(selectedEstado.utilidad_bruta) / parseFloat(selectedEstado.total_ingresos)) * 100 : 0;

  const margenNeto = selectedEstado ?
    (parseFloat(selectedEstado.utilidad_neta) / parseFloat(selectedEstado.total_ingresos)) * 100 : 0;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
            Estado de Resultados
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            Análisis de ingresos, gastos y utilidades por período
          </p>
        </div>

        {/* Controles */}
        <div className="bg-white dark:bg-slate-800 rounded-lg p-6 mb-6 shadow-sm">
          <div className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Fecha Desde
              </label>
              <input
                type="date"
                value={fechaDesde}
                onChange={(e) => setFechaDesde(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md
                         bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Fecha Hasta
              </label>
              <input
                type="date"
                value={fechaHasta}
                onChange={(e) => setFechaHasta(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md
                         bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
              />
            </div>
            <button
              onClick={generateEstado}
              disabled={loading}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50
                       text-white rounded-md font-medium transition-colors"
            >
              {loading ? 'Generando...' : 'Generar Estado'}
            </button>
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-800 rounded-md">
              <p className="text-red-700 dark:text-red-400 text-sm">{error}</p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Lista de Estados */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm">
              <div className="p-6 border-b border-slate-200 dark:border-slate-700">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                  Estados Generados
                </h3>
              </div>
              <div className="p-4 max-h-96 overflow-y-auto">
                {estados.length === 0 ? (
                  <p className="text-slate-500 dark:text-slate-400 text-center py-8">
                    No hay estados generados
                  </p>
                ) : (
                  <div className="space-y-2">
                    {estados.map((estado) => (
                      <button
                        key={estado.id}
                        onClick={() => setSelectedEstado(estado)}
                        className={`w-full text-left p-3 rounded-md transition-colors ${
                          selectedEstado?.id === estado.id
                            ? 'bg-blue-100 dark:bg-blue-900/20 border border-blue-300 dark:border-blue-700'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-700 border border-transparent'
                        }`}
                      >
                        <div className="text-sm font-medium text-slate-900 dark:text-white">
                          {format(new Date(estado.fecha_desde), 'MMM yyyy', { locale: es })} -
                          {format(new Date(estado.fecha_hasta), 'MMM yyyy', { locale: es })}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          Utilidad: {formatCurrency(estado.utilidad_neta)}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Estado Detallado */}
          <div className="lg:col-span-2">
            {selectedEstado ? (
              <div className="space-y-6">
                {/* Resumen Visual */}
                <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-6">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                        Estado de Resultados
                      </h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        Del {format(new Date(selectedEstado.fecha_desde), 'PP', { locale: es })} al{' '}
                        {format(new Date(selectedEstado.fecha_hasta), 'PP', { locale: es })}
                      </p>
                    </div>
                    <button
                      onClick={() => window.print()}
                      className="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-md text-sm"
                    >
                      Imprimir
                    </button>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                      <h4 className="text-sm font-medium text-green-800 dark:text-green-400">Ingresos</h4>
                      <p className="text-lg font-bold text-green-900 dark:text-green-300">
                        {formatCurrency(selectedEstado.total_ingresos)}
                      </p>
                    </div>
                    <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg">
                      <h4 className="text-sm font-medium text-orange-800 dark:text-orange-400">Costos</h4>
                      <p className="text-lg font-bold text-orange-900 dark:text-orange-300">
                        {formatCurrency(selectedEstado.total_costos)}
                      </p>
                    </div>
                    <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
                      <h4 className="text-sm font-medium text-red-800 dark:text-red-400">Gastos</h4>
                      <p className="text-lg font-bold text-red-900 dark:text-red-300">
                        {formatCurrency(selectedEstado.total_gastos)}
                      </p>
                    </div>
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                      <h4 className="text-sm font-medium text-blue-800 dark:text-blue-400">Utilidad Neta</h4>
                      <p className="text-lg font-bold text-blue-900 dark:text-blue-300">
                        {formatCurrency(selectedEstado.utilidad_neta)}
                      </p>
                    </div>
                  </div>

                  {/* Gráfico */}
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={getChartData()}>
                        <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                        <XAxis dataKey="name" className="text-xs" />
                        <YAxis className="text-xs" />
                        <Tooltip
                          formatter={(value: number) => formatCurrency(value.toString())}
                          labelClassName="text-slate-900"
                        />
                        <Bar dataKey="valor" fill="#3b82f6" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Análisis de Márgenes */}
                <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-6">
                  <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                    Análisis de Márgenes
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <p className="text-sm text-slate-600 dark:text-slate-400">Utilidad Bruta</p>
                      <p className="text-xl font-bold text-slate-900 dark:text-white">
                        {formatCurrency(selectedEstado.utilidad_bruta)}
                      </p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        Margen: {margenBruto.toFixed(1)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-600 dark:text-slate-400">Utilidad Neta</p>
                      <p className="text-xl font-bold text-slate-900 dark:text-white">
                        {formatCurrency(selectedEstado.utilidad_neta)}
                      </p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        Margen: {margenNeto.toFixed(1)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-600 dark:text-slate-400">ROI</p>
                      <p className="text-xl font-bold text-slate-900 dark:text-white">
                        {margenNeto > 0 ? '+' : ''}{margenNeto.toFixed(1)}%
                      </p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        Retorno sobre ingresos
                      </p>
                    </div>
                  </div>
                </div>

                {/* Detalle por Cuenta */}
                <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-6">
                  <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                    Detalle por Cuenta
                  </h4>
                  <div className="space-y-4">
                    {Object.entries(groupedAccounts).map(([tipo, cuentas]) => (
                      <div key={tipo} className="border border-slate-200 dark:border-slate-700 rounded-lg">
                        <div className="bg-slate-50 dark:bg-slate-700 px-4 py-3 border-b border-slate-200 dark:border-slate-600">
                          <h5 className="font-semibold text-slate-900 dark:text-white capitalize">
                            {tipo.replace('_', ' ')}
                          </h5>
                        </div>
                        <div className="divide-y divide-slate-200 dark:divide-slate-700">
                          {cuentas.map((cuenta) => (
                            <div key={cuenta.id} className="px-4 py-3 flex justify-between items-center">
                              <div>
                                <span className="text-sm font-medium text-slate-900 dark:text-white">
                                  {cuenta.cuenta.codigo}
                                </span>
                                <span className="ml-2 text-slate-600 dark:text-slate-400">
                                  {cuenta.cuenta.nombre}
                                </span>
                              </div>
                              <span className={`font-medium ${
                                parseFloat(cuenta.importe) >= 0
                                  ? 'text-green-600 dark:text-green-400'
                                  : 'text-red-600 dark:text-red-400'
                              }`}>
                                {formatCurrency(cuenta.importe)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-12 text-center">
                <div className="text-slate-400 dark:text-slate-500 mb-4">
                  <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
                  Selecciona un Estado
                </h3>
                <p className="text-slate-500 dark:text-slate-400">
                  Elige un estado de resultados de la lista para ver su análisis completo
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EstadoResultadosPage;