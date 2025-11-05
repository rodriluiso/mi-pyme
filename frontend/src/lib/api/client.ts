import axios from 'axios';
import { normalizeApiError } from './errors';

// Función para obtener el token CSRF de las cookies
function getCookie(name: string): string | null {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    return parts.pop()?.split(';').shift() || null;
  }
  return null;
}

export const apiClient = axios.create({
  // En desarrollo usamos localhost para que las cookies de CSRF sean legibles desde el frontend (mismo dominio)
  baseURL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api',
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json'
  },
  withCredentials: true  // Importante: Enviar cookies de sesión
});

// Interceptor para agregar el token CSRF a todas las peticiones
apiClient.interceptors.request.use(
  (config) => {
    // Obtener token CSRF de las cookies
    const csrfToken = getCookie('csrftoken');

    // Agregar token CSRF solo para métodos que lo requieren
    if (csrfToken && config.method && ['post', 'put', 'patch', 'delete'].includes(config.method.toLowerCase())) {
      config.headers['X-CSRFToken'] = csrfToken;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

apiClient.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(normalizeApiError(error))
);

export type ApiClient = typeof apiClient;
