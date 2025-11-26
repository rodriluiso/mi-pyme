import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredModule?: string;
}

/**
 * Componente que protege rutas verificando si el usuario tiene acceso al módulo requerido
 */
export const ProtectedRoute = ({ children, requiredModule }: ProtectedRouteProps) => {
  const { user, isLoading } = useAuth();

  console.log('[ProtectedRoute] User:', user);
  console.log('[ProtectedRoute] Required module:', requiredModule);
  console.log('[ProtectedRoute] isLoading:', isLoading);

  // Mientras carga, mostrar indicador de carga
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-slate-600">Cargando...</p>
        </div>
      </div>
    );
  }

  // Si no está autenticado, redirigir al login
  if (!user) {
    console.log('[ProtectedRoute] No user, redirecting to /login');
    return <Navigate to="/login" replace />;
  }

  // Si no requiere módulo específico, permitir acceso
  if (!requiredModule) {
    console.log('[ProtectedRoute] No required module, allowing access');
    return <>{children}</>;
  }

  // Verificar si el usuario tiene acceso al módulo
  const hasAccess = user.modulos_permitidos?.includes(requiredModule) ?? false;
  console.log('[ProtectedRoute] User modulos_permitidos:', user.modulos_permitidos);
  console.log('[ProtectedRoute] Has access to', requiredModule, ':', hasAccess);

  if (!hasAccess) {
    console.log('[ProtectedRoute] Access denied, redirecting to /acceso-denegado');
    return <Navigate to="/acceso-denegado" replace />;
  }

  console.log('[ProtectedRoute] Access granted, rendering children');
  return <>{children}</>;
};
