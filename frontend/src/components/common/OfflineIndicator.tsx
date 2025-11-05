import React from 'react';
import { useOfflineContext } from '@/contexts/OfflineContext';

const OfflineIndicator: React.FC = () => {
  const {
    isOnline,
    isOfflineCapable,
    pendingOperations,
    lastSyncTime,
    syncPendingOperations
  } = useOfflineContext();

  if (isOnline && pendingOperations === 0) {
    return null;
  }

  return (
    <div className={`fixed top-4 right-4 z-50 p-3 rounded-lg shadow-lg max-w-sm ${
      isOnline ? 'bg-blue-500 text-white' : 'bg-red-500 text-white'
    }`}>
      <div className="flex items-center space-x-2">
        <div className={`w-2 h-2 rounded-full ${
          isOnline ? 'bg-green-300' : 'bg-red-300'
        }`} />
        <span className="text-sm font-medium">
          {isOnline ? 'En línea' : 'Sin conexión'}
        </span>
      </div>

      {pendingOperations > 0 && (
        <div className="mt-2">
          <p className="text-xs">
            {pendingOperations} operación{pendingOperations > 1 ? 'es' : ''} pendiente{pendingOperations > 1 ? 's' : ''}
          </p>
          {isOnline && (
            <button
              onClick={syncPendingOperations}
              className="mt-1 text-xs underline hover:no-underline"
            >
              Sincronizar ahora
            </button>
          )}
        </div>
      )}

      {lastSyncTime && (
        <p className="text-xs mt-1 opacity-75">
          Última sync: {lastSyncTime.toLocaleTimeString()}
        </p>
      )}

      {!isOfflineCapable && !isOnline && (
        <p className="text-xs mt-1 opacity-75">
          Modo offline no disponible
        </p>
      )}
    </div>
  );
};

export default OfflineIndicator;