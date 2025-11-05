export type ApiError = {
  message: string;
  status?: number;
  data?: unknown;
  isNetworkError?: boolean;
};
