import { useState, useEffect } from 'react';
import { format, subMonths, endOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';

interface CuentaBalance {
  id: number;
  cuenta: {
    codigo: string;
    nombre: string;
    tipo_cuenta: string;
  };
  saldo: string;
}

interface BalanceGeneral {
  id: number;
  fecha_corte: string;
  total_activo: string;
  total_pasivo: string;
  total_patrimonio: string;
  fecha_generacion: string;
  usuario: string;
  detalles: CuentaBalance[];
}

const BalanceGeneralPage = () => {
  const [balances, setBalances] = useState<BalanceGeneral[]>([]);
  const [selectedBalance, setSelectedBalance] = useState<BalanceGeneral | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [fechaCorte, setFechaCorte] = useState(
    format(endOfMonth(new Date()), 'yyyy-MM-dd')
  );

  const fetchBalances = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:8000/api/contabilidad/balance-general/');
      if (!response.ok) throw new Error('Error al cargar balances');
      const data = await response.json();
      setBalances(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  const generateBalance = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:8000/api/contabilidad/balance-general/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fecha_corte: fechaCorte })
      });

      if (!response.ok) throw new Error('Error al generar balance');

      await fetchBalances();
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBalances();
  }, []);

  const groupedAccounts = selectedBalance?.detalles.reduce((groups, cuenta) => {
    const tipo = cuenta.cuenta.tipo_cuenta;
    if (!groups[tipo]) groups[tipo] = [];
    groups[tipo].push(cuenta);
    return groups;
  }, {} as Record<string, CuentaBalance[]>) || {};

  const formatCurrency = (amount: string) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(parseFloat(amount));
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
            Balance General
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            Gestión y visualización de balances generales
          </p>
        </div>

        {/* Controles */}
        <div className="bg-white dark:bg-slate-800 rounded-lg p-6 mb-6 shadow-sm">
          <div className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Fecha de Corte
              </label>
              <input
                type="date"
                value={fechaCorte}
                onChange={(e) => setFechaCorte(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md
                         bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
              />
            </div>
            <button
              onClick={generateBalance}
              disabled={loading}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50
                       text-white rounded-md font-medium transition-colors"
            >
              {loading ? 'Generando...' : 'Generar Balance'}
            </button>
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-800 rounded-md">
              <p className="text-red-700 dark:text-red-400 text-sm">{error}</p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Lista de Balances */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm">
              <div className="p-6 border-b border-slate-200 dark:border-slate-700">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                  Balances Generados
                </h3>
              </div>
              <div className="p-4 max-h-96 overflow-y-auto">
                {balances.length === 0 ? (
                  <p className="text-slate-500 dark:text-slate-400 text-center py-8">
                    No hay balances generados
                  </p>
                ) : (
                  <div className="space-y-2">
                    {balances.map((balance) => (
                      <button
                        key={balance.id}
                        onClick={() => setSelectedBalance(balance)}
                        className={`w-full text-left p-3 rounded-md transition-colors ${
                          selectedBalance?.id === balance.id
                            ? 'bg-blue-100 dark:bg-blue-900/20 border border-blue-300 dark:border-blue-700'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-700 border border-transparent'
                        }`}
                      >
                        <div className="text-sm font-medium text-slate-900 dark:text-white">
                          {format(new Date(balance.fecha_corte), 'PPP', { locale: es })}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          Total Activo: {formatCurrency(balance.total_activo)}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Balance Detallado */}
          <div className="lg:col-span-2">
            {selectedBalance ? (
              <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm">
                <div className="p-6 border-b border-slate-200 dark:border-slate-700">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                        Balance General
                      </h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        Al {format(new Date(selectedBalance.fecha_corte), 'PPP', { locale: es })}
                      </p>
                    </div>
                    <button
                      onClick={() => window.print()}
                      className="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-md text-sm"
                    >
                      Imprimir
                    </button>
                  </div>
                </div>

                <div className="p-6">
                  {/* Resumen Totales */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                    <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                      <h4 className="text-sm font-medium text-green-800 dark:text-green-400">Total Activo</h4>
                      <p className="text-xl font-bold text-green-900 dark:text-green-300">
                        {formatCurrency(selectedBalance.total_activo)}
                      </p>
                    </div>
                    <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
                      <h4 className="text-sm font-medium text-red-800 dark:text-red-400">Total Pasivo</h4>
                      <p className="text-xl font-bold text-red-900 dark:text-red-300">
                        {formatCurrency(selectedBalance.total_pasivo)}
                      </p>
                    </div>
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                      <h4 className="text-sm font-medium text-blue-800 dark:text-blue-400">Patrimonio</h4>
                      <p className="text-xl font-bold text-blue-900 dark:text-blue-300">
                        {formatCurrency(selectedBalance.total_patrimonio)}
                      </p>
                    </div>
                  </div>

                  {/* Detalle por Tipo de Cuenta */}
                  <div className="space-y-6">
                    {Object.entries(groupedAccounts).map(([tipo, cuentas]) => (
                      <div key={tipo} className="border border-slate-200 dark:border-slate-700 rounded-lg">
                        <div className="bg-slate-50 dark:bg-slate-700 px-4 py-3 border-b border-slate-200 dark:border-slate-600">
                          <h4 className="font-semibold text-slate-900 dark:text-white capitalize">
                            {tipo.replace('_', ' ')}
                          </h4>
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
                              <span className="font-medium text-slate-900 dark:text-white">
                                {formatCurrency(cuenta.saldo)}
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
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
                  Selecciona un Balance
                </h3>
                <p className="text-slate-500 dark:text-slate-400">
                  Elige un balance de la lista para ver su detalle completo
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BalanceGeneralPage;