// Service Worker para funcionalidad offline
const CACHE_NAME = 'mipyme-offline-v1';
const OFFLINE_URL = '/offline.html';

// Recursos estáticos para cachear
const STATIC_RESOURCES = [
  '/',
  '/offline.html',
  '/manifest.json',
  // Se agregarán automáticamente durante el build
];

// APIs críticas para funcionamiento offline
const CRITICAL_API_PATTERNS = [
  '/api/ventas/',
  '/api/productos/',
  '/api/clientes/',
  '/api/finanzas/movimientos/',
];

// Datos que se pueden consultar offline
const CACHEABLE_API_PATTERNS = [
  '/api/productos/',
  '/api/clientes/',
  '/api/proveedores/',
  '/api/ventas/',
  '/api/compras/',
];

self.addEventListener('install', event => {
  console.log('[SW] Installing...');

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Caching static resources');
        return cache.addAll(STATIC_RESOURCES);
      })
      .then(() => {
        console.log('[SW] Static resources cached');
        return self.skipWaiting();
      })
  );
});

self.addEventListener('activate', event => {
  console.log('[SW] Activating...');

  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[SW] Claiming clients');
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Solo manejar requests del mismo origen
  if (url.origin !== location.origin) {
    return;
  }

  // Estrategia para páginas HTML
  if (request.mode === 'navigate') {
    event.respondWith(handlePageRequest(request));
    return;
  }

  // Estrategia para API calls
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleApiRequest(request));
    return;
  }

  // Estrategia para recursos estáticos
  event.respondWith(handleStaticRequest(request));
});

// Manejo de páginas (HTML)
async function handlePageRequest(request) {
  try {
    // Intentar obtener de la red
    const response = await fetch(request);

    // Si es exitoso, actualizar cache
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }

    return response;
  } catch (error) {
    console.log('[SW] Network failed for page, serving from cache');

    // Si falla la red, intentar desde cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    // Si no hay cache, mostrar página offline
    return caches.match(OFFLINE_URL);
  }
}

// Manejo de llamadas API
async function handleApiRequest(request) {
  const url = new URL(request.url);
  const isReadRequest = request.method === 'GET';
  const isCriticalAPI = CRITICAL_API_PATTERNS.some(pattern =>
    url.pathname.startsWith(pattern)
  );
  const isCacheableAPI = CACHEABLE_API_PATTERNS.some(pattern =>
    url.pathname.startsWith(pattern)
  );

  // Para requests de escritura (POST, PUT, DELETE)
  if (!isReadRequest) {
    return handleWriteApiRequest(request);
  }

  // Para requests de lectura cacheable
  if (isCacheableAPI) {
    return handleCacheableApiRequest(request);
  }

  // Para otros requests, solo intentar red
  try {
    return await fetch(request);
  } catch (error) {
    return new Response(JSON.stringify({
      error: 'No hay conexión a internet',
      offline: true
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Manejo de APIs de solo lectura con cache
async function handleCacheableApiRequest(request) {
  try {
    // Intentar red primero
    const response = await fetch(request);

    if (response.ok) {
      // Guardar en cache si es exitoso
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
      return response;
    }

    throw new Error('Network response not ok');
  } catch (error) {
    console.log('[SW] API network failed, trying cache');

    // Si falla la red, usar cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      // Agregar header para indicar que viene del cache
      const response = cachedResponse.clone();
      response.headers.set('X-From-Cache', 'true');
      return response;
    }

    // Si no hay cache, retornar error
    return new Response(JSON.stringify({
      error: 'Datos no disponibles offline',
      offline: true
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Manejo de APIs de escritura (POST, PUT, DELETE)
async function handleWriteApiRequest(request) {
  try {
    // Intentar enviar a la red
    const response = await fetch(request);

    if (response.ok) {
      // Si es exitoso, limpiar cache relacionado para forzar refresh
      await invalidateRelatedCache(request);
    }

    return response;
  } catch (error) {
    console.log('[SW] Write API failed, storing for sync');

    // Guardar para sincronización posterior
    await storeForBackgroundSync(request);

    // Retornar respuesta simulada
    return new Response(JSON.stringify({
      message: 'Operación guardada. Se sincronizará cuando haya conexión.',
      offline: true,
      queued: true
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Manejo de recursos estáticos
async function handleStaticRequest(request) {
  // Cache first para recursos estáticos
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.log('[SW] Static resource not available offline');
    return new Response('Resource not available offline', { status: 404 });
  }
}

// Invalidar cache relacionado después de operaciones de escritura
async function invalidateRelatedCache(request) {
  const url = new URL(request.url);
  const cache = await caches.open(CACHE_NAME);

  // Determinar qué caches invalidar basado en la operación
  const pathsToInvalidate = [];

  if (url.pathname.includes('/ventas/')) {
    pathsToInvalidate.push('/api/ventas/', '/api/finanzas/movimientos/');
  }

  if (url.pathname.includes('/productos/')) {
    pathsToInvalidate.push('/api/productos/');
  }

  if (url.pathname.includes('/clientes/')) {
    pathsToInvalidate.push('/api/clientes/');
  }

  // Eliminar entradas del cache
  const keys = await cache.keys();
  for (const key of keys) {
    const keyUrl = new URL(key.url);
    if (pathsToInvalidate.some(path => keyUrl.pathname.startsWith(path))) {
      await cache.delete(key);
    }
  }
}

// Guardar operaciones para sincronización posterior
async function storeForBackgroundSync(request) {
  try {
    const requestData = {
      url: request.url,
      method: request.method,
      headers: Object.fromEntries(request.headers.entries()),
      body: request.method !== 'GET' ? await request.text() : null,
      timestamp: Date.now()
    };

    // Guardar en IndexedDB para persistencia
    const db = await openSyncDB();
    const transaction = db.transaction(['pendingRequests'], 'readwrite');
    const store = transaction.objectStore('pendingRequests');
    await store.add(requestData);

    console.log('[SW] Request stored for sync:', requestData.url);
  } catch (error) {
    console.error('[SW] Error storing request for sync:', error);
  }
}

// Abrir base de datos para sincronización
function openSyncDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('MiPymeSync', 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('pendingRequests')) {
        const store = db.createObjectStore('pendingRequests', {
          keyPath: 'id',
          autoIncrement: true
        });
        store.createIndex('timestamp', 'timestamp');
      }
    };
  });
}

// Background Sync para cuando vuelve la conexión
self.addEventListener('sync', event => {
  if (event.tag === 'mipyme-background-sync') {
    console.log('[SW] Background sync triggered');
    event.waitUntil(syncPendingRequests());
  }
});

// Sincronizar requests pendientes
async function syncPendingRequests() {
  try {
    const db = await openSyncDB();
    const transaction = db.transaction(['pendingRequests'], 'readwrite');
    const store = transaction.objectStore('pendingRequests');
    const requests = await store.getAll();

    for (const requestData of requests) {
      try {
        // Recrear request
        const request = new Request(requestData.url, {
          method: requestData.method,
          headers: requestData.headers,
          body: requestData.body
        });

        // Intentar enviar
        const response = await fetch(request);

        if (response.ok) {
          // Si es exitoso, eliminar de la cola
          await store.delete(requestData.id);
          console.log('[SW] Synced request:', requestData.url);

          // Notificar a los clientes
          self.clients.matchAll().then(clients => {
            clients.forEach(client => {
              client.postMessage({
                type: 'SYNC_SUCCESS',
                url: requestData.url
              });
            });
          });
        }
      } catch (error) {
        console.error('[SW] Failed to sync request:', requestData.url, error);
      }
    }
  } catch (error) {
    console.error('[SW] Error in background sync:', error);
  }
}

// Notificación de cambio de estado de conexión
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'CONNECTIVITY_CHANGED') {
    if (event.data.online) {
      console.log('[SW] Connection restored, triggering sync');
      // Intentar sincronizar inmediatamente
      syncPendingRequests();
    }
  }
});

console.log('[SW] Service Worker loaded');