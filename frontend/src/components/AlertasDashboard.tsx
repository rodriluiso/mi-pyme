import { useEffect, useMemo, useState } from "react";
import { useApi } from "@/hooks/useApi";
import type { AlertaDashboard } from "@/types/mipyme";

const AlertasDashboard = () => {
  const { request } = useApi();
  const [alertas, setAlertas] = useState<AlertaDashboard[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const cargarAlertas = async () => {
      try {
        setCargando(true);
        const response = await request<{ alertas?: AlertaDashboard[] } | AlertaDashboard[]>({
          method: "GET",
          url: "/finanzas/movimientos/alertas_dashboard/"
        });

        let alertasObtenidas: AlertaDashboard[] = [];
        if (Array.isArray(response)) {
          alertasObtenidas = response;
        } else if (response && Array.isArray(response.alertas)) {
          alertasObtenidas = response.alertas;
        }

        setAlertas(alertasObtenidas);
      } catch (error) {
        console.error("Error cargando alertas:", error);
        setAlertas([]);
      } finally {
        setCargando(false);
      }
    };

    void cargarAlertas();
  }, [request]);

  const alertasPorUrgencia = useMemo(() => {
    if (!Array.isArray(alertas)) {
      return [] as AlertaDashboard[];
    }

    return [...alertas].sort((a, b) => {
      const prioridadOrden: Record<string, number> = { alta: 3, media: 2, baja: 1 };
      const prioridadA = prioridadOrden[a?.urgencia ?? ""] || 0;
      const prioridadB = prioridadOrden[b?.urgencia ?? ""] || 0;
      return prioridadB - prioridadA;
    });
  }, [alertas]);

  const obtenerIconoAlerta = (tipo: string) => {
    switch (tipo) {
      case "stock_bajo":
        return (
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
        );
      case "pago_vencido":
        return (
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
          </svg>
        );
      case "pago_proximo_vencer":
        return (
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case "cobro_pendiente":
        return (
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
          </svg>
        );
      case "aniversario_empleado":
        return (
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        );
      default:
        return (
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        );
    }
  };

  const obtenerEstilosUrgencia = (urgencia: string | undefined) => {
    switch (urgencia) {
      case "alta":
        return "border-red-200 bg-red-50 text-red-700";
      case "media":
        return "border-amber-200 bg-amber-50 text-amber-700";
      case "baja":
        return "border-blue-200 bg-blue-50 text-blue-700";
      default:
        return "border-slate-200 bg-slate-50 text-slate-700";
    }
  };

  if (cargando) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Alertas del Sistema</h2>
        <p className="text-sm text-slate-500">Cargando alertas...</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-slate-900">Alertas del Sistema</h2>
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
          {alertasPorUrgencia.length} alerta{alertasPorUrgencia.length !== 1 ? 's' : ''}
        </span>
      </div>

      {alertasPorUrgencia.length === 0 ? (
        <div className="text-center py-6">
          <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
            <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-sm text-slate-500">¡Todo está en orden!</p>
          <p className="text-xs text-slate-400 mt-1">No hay alertas que requieran tu atención</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-80 overflow-y-auto">
          {alertasPorUrgencia.map((alerta, index) => (
            <div
              key={`${alerta?.tipo ?? 'alerta'}-${alerta?.id ?? index}-${index}`}
              className={`p-3 rounded-lg border ${obtenerEstilosUrgencia(alerta?.urgencia)}`}
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">
                  {obtenerIconoAlerta(alerta?.tipo ?? 'generica')}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium text-sm">{alerta?.titulo ?? 'Alerta'}</h3>
                      {alerta?.descripcion && (
                        <p className="text-xs mt-1 opacity-75">{alerta.descripcion}</p>
                      )}

                      {alerta?.tipo === 'stock_bajo' && alerta?.datos?.sku && (
                        <p className="text-xs mt-1 font-mono opacity-60">SKU: {alerta.datos.sku}</p>
                      )}

                      {alerta?.fecha && (
                        <p className="text-xs mt-1 opacity-60">
                          {new Date(alerta.fecha).toLocaleDateString()}
                        </p>
                      )}
                    </div>

                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ml-2 flex-shrink-0 ${
                        alerta?.urgencia === 'alta'
                          ? 'bg-red-100 text-red-800'
                          : alerta?.urgencia === 'media'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {alerta?.urgencia === 'alta'
                        ? 'Urgente'
                        : alerta?.urgencia === 'media'
                          ? 'Moderado'
                          : 'Bajo'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {alertasPorUrgencia.filter(alerta => alerta?.urgencia === 'alta').length > 0 && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm font-medium text-red-800">
            ¡Atención! {alertasPorUrgencia.filter(alerta => alerta?.urgencia === 'alta').length}{' '}
            alerta
            {alertasPorUrgencia.filter(alerta => alerta?.urgencia === 'alta').length !== 1 ? 's requieren' : ' requiere'}
            {' '}atención inmediata
          </p>
        </div>
      )}
    </div>
  );
};

export default AlertasDashboard;
