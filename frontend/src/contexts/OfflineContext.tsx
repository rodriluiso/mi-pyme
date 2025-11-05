import React, { createContext, useContext, ReactNode } from 'react';
import { useOffline } from '@/hooks/useOffline';

interface OfflineContextType {
  isOnline: boolean;
  isOfflineCapable: boolean;
  pendingOperations: number;
  lastSyncTime: Date | null;
  offlineRequest: (url: string, options?: RequestInit) => Promise<Response>;
  queueOperation: (type: string, data: any) => Promise<void>;
  syncPendingOperations: () => Promise<void>;
  clearOfflineCache: () => Promise<void>;
  getCacheSize: () => Promise<number>;
  checkOfflineCapability: () => Promise<boolean>;
  isCacheableUrl: (url: string) => boolean;
}

const OfflineContext = createContext<OfflineContextType | null>(null);

interface OfflineProviderProps {
  children: ReactNode;
}

export const OfflineProvider: React.FC<OfflineProviderProps> = ({ children }) => {
  const offlineHook = useOffline();

  return (
    <OfflineContext.Provider value={offlineHook}>
      {children}
    </OfflineContext.Provider>
  );
};

export const useOfflineContext = () => {
  const context = useContext(OfflineContext);
  if (!context) {
    throw new Error('useOfflineContext must be used within an OfflineProvider');
  }
  return context;
};

export default OfflineContext;