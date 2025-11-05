import axios from 'axios';
import type { ApiError } from './types';

export const normalizeApiError = (error: unknown): ApiError => {
  if (axios.isAxiosError(error)) {
    return {
      message: error.response?.data?.message ?? error.message,
      status: error.response?.status,
      data: error.response?.data,
      isNetworkError: Boolean(error.code === 'ECONNABORTED' || !error.response)
    };
  }

  return {
    message: error instanceof Error ? error.message : 'Unexpected error',
    status: undefined,
    data: undefined,
    isNetworkError: false
  };
};
