/**
 * Cliente de API para el sistema de Mi-PYME
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

/**
 * Obtiene el token de autenticación del localStorage
 */
function getAuthToken(): string | null {
  return localStorage.getItem('authToken');
}

/**
 * Headers comunes para todas las peticiones
 */
function getHeaders(): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  const token = getAuthToken();
  if (token) {
    headers['Authorization'] = `Token ${token}`;
  }

  return headers;
}

/**
 * Interfaz para la respuesta de disponibilidad de undo
 */
export interface UndoAvailability {
  available: boolean;
  description?: string;
  action_type?: string;
  created_at?: string;
}

/**
 * Interfaz para la respuesta de undo exitoso
 */
export interface UndoResponse {
  success: boolean;
  action_undone?: string;
  message: string;
}

/**
 * Verifica si hay una acción disponible para deshacer
 */
export async function checkUndoAvailability(): Promise<UndoAvailability> {
  const response = await fetch(`${API_BASE_URL}/usuarios/undo/availability`, {
    method: 'GET',
    headers: getHeaders(),
  });

  if (!response.ok) {
    throw new Error('Error al verificar disponibilidad de undo');
  }

  return response.json();
}

/**
 * Deshace la última acción del usuario
 */
export async function undoLastAction(): Promise<UndoResponse> {
  const response = await fetch(`${API_BASE_URL}/usuarios/undo/last`, {
    method: 'POST',
    headers: getHeaders(),
  });

  const data = await response.json();

  if (!response.ok) {
    // Si hay un error, retornar el mensaje de error del servidor
    return {
      success: false,
      message: data.message || 'Error al deshacer la acción',
    };
  }

  return data;
}
