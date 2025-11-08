import { useCallback } from 'react';
import type { AxiosRequestConfig } from 'axios';
import { apiClient } from '@/lib/api/client';
import type { ApiError } from '@/lib/api/types';
import { isElectron, getFromCache, saveToCache, checkOnlineStatus } from '@/lib/electron';

export const useApi = () => {
  const request = useCallback(async <TResponse>(config: AxiosRequestConfig) => {
    try {
      const response = await apiClient.request<TResponse>(config);

      // Si estamos en Electron y es un GET, guardar en cache para uso offline
      if (isElectron() && config.method?.toUpperCase() === 'GET' && config.url) {
        await saveToCache(config.url, response.data);
      }

      return response.data;
    } catch (error) {
      // Si estamos en Electron y offline, intentar usar cache
      if (isElectron() && config.method?.toUpperCase() === 'GET' && config.url) {
        const isOnline = await checkOnlineStatus();

        if (!isOnline) {
          const cachedData = await getFromCache(config.url);
          if (cachedData) {
            console.log('[Offline Mode] Using cached data for:', config.url);
            return cachedData as TResponse;
          }
        }
      }

      throw error as ApiError;
    }
  }, []);

  return { request };
};

export type UseApiReturn = ReturnType<typeof useApi>;
