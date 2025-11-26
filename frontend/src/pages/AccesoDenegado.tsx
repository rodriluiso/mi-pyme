import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

const AccesoDenegadoPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-6">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
          {/* Ícono de acceso denegado */}
          <div className="mx-auto w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-6">
            <svg
              className="w-10 h-10 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>

          {/* Título */}
          <h1 className="text-2xl font-bold text-slate-900 mb-3">
            Acceso Denegado
          </h1>

          {/* Mensaje */}
          <p className="text-slate-600 mb-6">
            Tu nivel de acceso <span className="font-semibold text-slate-900">{user?.nivel_acceso_display || 'actual'}</span> no
            tiene permisos para acceder a este módulo.
          </p>

          {/* Información adicional */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-sm text-left">
            <p className="text-blue-800 font-medium mb-2">
              Módulos disponibles para ti:
            </p>
            <ul className="text-blue-700 space-y-1">
              {user?.modulos_permitidos?.map((modulo) => (
                <li key={modulo} className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span className="capitalize">{modulo.replace('_', ' ')}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Botones de acción */}
          <div className="flex gap-3">
            <button
              onClick={() => navigate(-1)}
              className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-lg font-medium hover:bg-slate-200 transition-colors"
            >
              Volver atrás
            </button>
            <button
              onClick={() => navigate('/')}
              className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              Ir al inicio
            </button>
          </div>

          {/* Nota para contactar admin */}
          <p className="text-xs text-slate-500 mt-6">
            Si necesitas acceso a este módulo, contacta a tu administrador del sistema
          </p>
        </div>
      </div>
    </div>
  );
};

export default AccesoDenegadoPage;
