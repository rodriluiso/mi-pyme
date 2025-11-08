import axios from 'axios';
import { normalizeApiError } from './errors';
import { getElectronApiConfig, isElectron } from '../electron';

// Función para obtener el token CSRF de las cookies
function getCookie(name: string): string | null {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    return parts.pop()?.split(';').shift() || null;
  }
  return null;
}

// Detectar si estamos en Tauri
function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI__' in window;
}

// Configurar baseURL según el entorno
let baseURL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api';
let timeout = 15000;

// Si estamos en Tauri (app de escritorio), usar Render backend
if (isTauri()) {
  baseURL = 'https://mipyme-backend.onrender.com/api';
  timeout = 30000; // Más tiempo porque puede estar en la nube
  console.log('[Tauri] Using Render backend:', baseURL);
}
// Si estamos en Electron, obtener configuración de forma asíncrona
else if (isElectron()) {
  getElectronApiConfig().then(config => {
    if (config) {
      apiClient.defaults.baseURL = config.baseURL;
      apiClient.defaults.timeout = config.timeout;
      console.log('[Electron] API configured with baseURL:', config.baseURL);
    }
  });
}

export const apiClient = axios.create({
  baseURL,
  timeout,
  headers: {
    'Content-Type': 'application/json'
  },
  withCredentials: true  // Importante: Enviar cookies de sesión
});

// Interceptor para agregar tokens de autenticación a todas las peticiones
apiClient.interceptors.request.use(
  (config) => {
    // 1. Obtener token de autenticación (para mobile/cross-domain)
    const authToken = localStorage.getItem('auth_token');
    if (authToken) {
      config.headers['Authorization'] = `Token ${authToken}`;
    }

    // 2. Obtener token CSRF de las cookies (para same-domain)
    const csrfToken = getCookie('csrftoken');
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
