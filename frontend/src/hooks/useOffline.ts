import { useState, useEffect, useCallback } from 'react';

interface OfflineState {
  isOnline: boolean;
  isOfflineCapable: boolean;
  pendingOperations: number;
  lastSyncTime: Date | null;
}

interface PendingOperation {
  id: string;
  type: string;
  data: any;
  timestamp: number;
  retryCount: number;
}

export const useOffline = () => {
  const isServiceWorkerSupported = typeof navigator !== 'undefined' && 'serviceWorker' in navigator;
  const [state, setState] = useState<OfflineState>({
    isOnline: navigator.onLine,
    isOfflineCapable: isServiceWorkerSupported && import.meta.env.PROD,
    pendingOperations: 0,
    lastSyncTime: null,
  });

  const [pendingOps, setPendingOps] = useState<PendingOperation[]>([]);

  // Actualizar estado de conexión
  const updateOnlineStatus = useCallback(() => {
    setState(prev => ({
      ...prev,
      isOnline: navigator.onLine
    }));
  }, []);

  // Escuchar cambios de conectividad
  useEffect(() => {
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
    };
  }, [updateOnlineStatus]);

  // Configurar Service Worker
  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      return;
    }

    // Nunca registrar SW en entorno no seguro (file:// o http no local)
    const isSecure = typeof window !== 'undefined' && window.isSecureContext;
    const isFileProtocol = typeof location !== 'undefined' && location.protocol === 'file:';

    if (import.meta.env.DEV || !isSecure || isFileProtocol) {
      // Limpiar cualquier registro previo y deshabilitar modo offline
      navigator.serviceWorker
        .getRegistrations()
        .then(registros => {
          registros.forEach(registro => registro.unregister());
        })
        .catch(error => {
          console.warn('No fue posible limpiar los service workers previos', error);
        });
      setState(prev => ({ ...prev, isOfflineCapable: false }));
      return;
    }

    void registerServiceWorker();
  }, []);

  const registerServiceWorker = async () => {
    if (!import.meta.env.PROD) {
      return;
    }

    // Registrar solo en contextos seguros (https/localhost), nunca en file://
    if (!window.isSecureContext || location.protocol === 'file:') {
      return;
    }

    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('Service Worker registrado:', registration);

      // Escuchar mensajes del Service Worker
      navigator.serviceWorker.addEventListener('message', handleSWMessage);

      // Solicitar estado inicial de operaciones pendientes
      if (registration.active) {
        registration.active.postMessage({ type: 'GET_PENDING_COUNT' });
      }

    } catch (error) {
      console.error('Error registrando Service Worker:', error);
      setState(prev => ({ ...prev, isOfflineCapable: false }));
    }
  };
  const handleSWMessage = (event: MessageEvent) => {
    const { type, data } = event.data;

    switch (type) {
      case 'PENDING_COUNT_UPDATE':
        setState(prev => ({
          ...prev,
          pendingOperations: data.count
        }));
        break;

      case 'SYNC_SUCCESS':
        setState(prev => ({
          ...prev,
          lastSyncTime: new Date(),
          pendingOperations: Math.max(0, prev.pendingOperations - 1)
        }));
        break;

      case 'OPERATION_QUEUED':
        setState(prev => ({
          ...prev,
          pendingOperations: prev.pendingOperations + 1
        }));
        break;
    }
  };

  // Verificar si una URL es cacheable offline
  const isCacheableUrl = useCallback((url: string): boolean => {
    const cacheablePatterns = [
      '/api/productos/',
      '/api/clientes/',
      '/api/proveedores/',
      '/api/ventas/',
      '/api/compras/',
    ];

    return cacheablePatterns.some(pattern => url.includes(pattern));
  }, []);

  // Realizar request con soporte offline
  const offlineRequest = useCallback(async (
    url: string,
    options: RequestInit = {}
  ): Promise<Response> => {
    try {
      const response = await fetch(url, options);

      // Si la respuesta viene del cache, agregar indicador
      if (response.headers.get('X-From-Cache') === 'true') {
        console.log('Datos cargados desde cache offline:', url);
      }

      return response;
    } catch (error) {
      // Si es un GET request cacheable, intentar desde cache
      if (options.method === 'GET' && isCacheableUrl(url)) {
        console.log('Red no disponible, intentando cache para:', url);

        // El Service Worker manejarÃ¡ esto automÃ¡ticamente
        throw error;
      }

      // Para otros requests, manejar segÃºn el tipo
      if (['POST', 'PUT', 'DELETE'].includes(options.method || 'GET')) {
        console.log('OperaciÃ³n guardada para sincronizaciÃ³n:', url);

        // El Service Worker ya guardÃ³ la operaciÃ³n
        return new Response(JSON.stringify({
          message: 'OperaciÃ³n guardada. Se sincronizarÃ¡ cuando haya conexiÃ³n.',
          offline: true,
          queued: true
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      throw error;
    }
  }, [isCacheableUrl]);

  // Agregar operaciÃ³n a la cola offline
  const queueOperation = useCallback(async (
    type: string,
    data: any
  ): Promise<void> => {
    const operation: PendingOperation = {
      id: Date.now().toString(),
      type,
      data,
      timestamp: Date.now(),
      retryCount: 0
    };

    setPendingOps(prev => [...prev, operation]);

    // Guardar en localStorage como backup
    const stored = localStorage.getItem('mipyme-pending-ops') || '[]';
    const operations = JSON.parse(stored);
    operations.push(operation);
    localStorage.setItem('mipyme-pending-ops', JSON.stringify(operations));

    setState(prev => ({
      ...prev,
      pendingOperations: prev.pendingOperations + 1
    }));
  }, []);

  // Sincronizar operaciones pendientes manualmente
  const syncPendingOperations = useCallback(async (): Promise<void> => {
    if (!state.isOnline) {
      console.log('No hay conexiÃ³n para sincronizar');
      return;
    }

    // Solicitar sincronizaciÃ³n al Service Worker
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready;
      if (registration.active) {
        registration.active.postMessage({
          type: 'FORCE_SYNC'
        });
      }
    }
  }, [state.isOnline]);

  // Limpiar cache de la aplicaciÃ³n
  const clearOfflineCache = useCallback(async (): Promise<void> => {
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map(cacheName => caches.delete(cacheName))
      );
      console.log('Cache offline limpiado');
    }
  }, []);

  // Obtener tamaÃ±o del cache
  const getCacheSize = useCallback(async (): Promise<number> => {
    if (!('navigator' in window) || !('storage' in navigator)) {
      return 0;
    }

    try {
      const estimate = await navigator.storage.estimate();
      return estimate.usage || 0;
    } catch (error) {
      console.error('Error obteniendo tamaÃ±o del cache:', error);
      return 0;
    }
  }, []);

  // Verificar si la app puede trabajar offline
  const checkOfflineCapability = useCallback(async (): Promise<boolean> => {
    if (!state.isOfflineCapable) return false;

    try {
      // Verificar que el Service Worker estÃ© activo
      const registration = await navigator.serviceWorker.ready;
      if (!registration.active) return false;

      // Verificar que hay datos en cache
      const cacheNames = await caches.keys();
      if (cacheNames.length === 0) return false;

      return true;
    } catch (error) {
      console.error('Error verificando capacidad offline:', error);
      return false;
    }
  }, [state.isOfflineCapable]);

  return {
    // Estado
    isOnline: state.isOnline,
    isOfflineCapable: state.isOfflineCapable,
    pendingOperations: state.pendingOperations,
    lastSyncTime: state.lastSyncTime,
    pendingOps,

    // Funciones
    offlineRequest,
    queueOperation,
    syncPendingOperations,
    clearOfflineCache,
    getCacheSize,
    checkOfflineCapability,
    isCacheableUrl,
  };
};








