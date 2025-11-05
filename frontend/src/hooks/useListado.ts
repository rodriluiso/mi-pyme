import { useCallback, useEffect, useState } from "react";
import type { ApiError } from "@/lib/api/types";
import { useApi } from "./useApi";

type EstadoListado<T> = {
  datos: T[];
  cargando: boolean;
  error: ApiError | null;
  recargar: () => Promise<void>;
};

export const useListado = <T>(endpoint: string): EstadoListado<T> => {
  const { request } = useApi();
  const [datos, setDatos] = useState<T[]>([]);
  const [cargando, setCargando] = useState<boolean>(true);
  const [error, setError] = useState<ApiError | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const respuesta = await request<T[]>({
        method: "GET",
        url: endpoint
      });
      // Asegurar que siempre sea un array, incluso si la respuesta es null/undefined
      setDatos(Array.isArray(respuesta) ? respuesta : []);
    } catch (err) {
      setError(err as ApiError);
      setDatos([]); // En caso de error, resetear a array vacío
    } finally {
      setCargando(false);
    }
  }, [endpoint, request]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  return {
    datos,
    cargando,
    error,
    recargar: cargar
  };
};
