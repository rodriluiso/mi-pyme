import { useCallback } from 'react';
import type { AxiosRequestConfig } from 'axios';
import { apiClient } from '@/lib/api/client';
import type { ApiError } from '@/lib/api/types';

export const useApi = () => {
  const request = useCallback(async <TResponse>(config: AxiosRequestConfig) => {
    try {
      const response = await apiClient.request<TResponse>(config);
      return response.data;
    } catch (error) {
      throw error as ApiError;
    }
  }, []);

  return { request };
};

export type UseApiReturn = ReturnType<typeof useApi>;
