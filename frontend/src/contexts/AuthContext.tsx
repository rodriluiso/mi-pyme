import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AuthContextType, Usuario, LoginRequest, LoginResponse } from '@/types/mipyme';
import { apiClient } from '@/lib/api/client';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<Usuario | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Al cargar: intenta rehidratar sesión
  useEffect(() => {
    const checkAuth = async () => {
      try {
        // 1) Obtiene cookie CSRF
        await apiClient.get('/usuarios/auth/csrf/');
        // 2) Pide perfil
        const { data } = await apiClient.get<Usuario>('/usuarios/auth/perfil/');
        console.log('[AuthContext] Perfil response:', data);
        console.log('[AuthContext] Modulos permitidos en perfil:', data?.modulos_permitidos);
        if (data) setUser(data);
      } catch {
        console.log('No hay sesión activa');
      } finally {
        setIsLoading(false);
      }
    };

    void checkAuth();
  }, []);

  const login = async (credentials: LoginRequest): Promise<void> => {
    setIsLoading(true);
    try {
      // Limpiar cualquier token anterior antes de hacer login
      localStorage.removeItem('auth_token');

      const { data } = await apiClient.post<LoginResponse>('/usuarios/auth/login/', credentials);
      console.log('[AuthContext] Login response:', data);
      console.log('[AuthContext] Usuario:', data.usuario);
      console.log('[AuthContext] Modulos permitidos:', data.usuario.modulos_permitidos);
      setUser(data.usuario);

      // Guardar token en localStorage para autenticación cross-domain (mobile)
      if (data.token) {
        localStorage.setItem('auth_token', data.token);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await apiClient.post('/usuarios/auth/logout/');
    } catch (error) {
      console.error('Error durante logout:', error);
    } finally {
      setUser(null);
      // Limpiar token de localStorage
      localStorage.removeItem('auth_token');
    }
  };

  const updateProfile = async (data: Partial<Usuario>): Promise<void> => {
    const response = await apiClient.put<{ usuario: Usuario; mensaje?: string }>(
      '/usuarios/auth/actualizar_perfil/',
      data
    );
    setUser(response.data.usuario);
  };

  const canAccessModule = (modulo: string): boolean => {
    if (!user) return false;
    return user.modulos_permitidos.includes(modulo);
  };

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    logout,
    updateProfile,
    canAccessModule,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth debe ser usado dentro de un AuthProvider');
  }
  return context;
}

