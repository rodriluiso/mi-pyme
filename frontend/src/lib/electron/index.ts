/**
 * Utilidades para integración con Electron
 */

// Type definitions para window.electronAPI
declare global {
  interface Window {
    electronAPI?: {
      getApiConfig: () => Promise<{ baseURL: string; timeout: number }>;
      cache: {
        save: (endpoint: string, data: unknown) => Promise<{ success: boolean }>;
        get: (endpoint: string) => Promise<{ success: boolean; data?: unknown; timestamp?: number }>;
        clean: () => Promise<{ success: boolean; deleted?: number }>;
      };
      checkOnline: () => Promise<{ online: boolean }>;
      platform: string;
      version: string;
    };
  }
}

/**
 * Verifica si la app está corriendo en Electron
 */
export function isElectron(): boolean {
  return typeof window !== 'undefined' && window.electronAPI !== undefined;
}

/**
 * Obtiene la configuración de API desde Electron
 */
export async function getElectronApiConfig(): Promise<{ baseURL: string; timeout: number } | null> {
  if (!isElectron() || !window.electronAPI) {
    return null;
  }

  try {
    return await window.electronAPI.getApiConfig();
  } catch (error) {
    console.error('Error getting Electron API config:', error);
    return null;
  }
}

/**
 * Verifica si hay conexión a internet
 */
export async function checkOnlineStatus(): Promise<boolean> {
  if (!isElectron() || !window.electronAPI) {
    // En navegador web, asumimos online
    return navigator.onLine;
  }

  try {
    const result = await window.electronAPI.checkOnline();
    return result.online;
  } catch (error) {
    console.error('Error checking online status:', error);
    return false;
  }
}

/**
 * Guarda datos en cache (solo en Electron)
 */
export async function saveToCache(endpoint: string, data: unknown): Promise<boolean> {
  if (!isElectron() || !window.electronAPI) {
    return false;
  }

  try {
    const result = await window.electronAPI.cache.save(endpoint, data);
    return result.success;
  } catch (error) {
    console.error('Error saving to cache:', error);
    return false;
  }
}

/**
 * Obtiene datos del cache (solo en Electron)
 */
export async function getFromCache(endpoint: string): Promise<unknown | null> {
  if (!isElectron() || !window.electronAPI) {
    return null;
  }

  try {
    const result = await window.electronAPI.cache.get(endpoint);
    return result.success ? result.data : null;
  } catch (error) {
    console.error('Error getting from cache:', error);
    return null;
  }
}

/**
 * Limpia el cache antiguo (solo en Electron)
 */
export async function cleanCache(): Promise<number> {
  if (!isElectron() || !window.electronAPI) {
    return 0;
  }

  try {
    const result = await window.electronAPI.cache.clean();
    return result.success ? (result.deleted || 0) : 0;
  } catch (error) {
    console.error('Error cleaning cache:', error);
    return 0;
  }
}

/**
 * Obtiene información de la plataforma
 */
export function getPlatformInfo(): { platform: string; version: string; isElectron: boolean } {
  if (!isElectron() || !window.electronAPI) {
    return {
      platform: 'web',
      version: '1.0.0',
      isElectron: false
    };
  }

  return {
    platform: window.electronAPI.platform,
    version: window.electronAPI.version,
    isElectron: true
  };
}
