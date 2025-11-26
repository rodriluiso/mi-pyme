import { useCallback, useEffect, useState } from "react";
import type { ApiError } from "@/lib/api/types";
import { useApi } from "./useApi";

type EstadoListado<T> = {
  datos: T[];
  cargando: boolean;
  error: ApiError | null;
  recargar: () => Promise<void>;
};

export const useListado = <T>(endpoint: string | null): EstadoListado<T> => {
  const { request } = useApi();
  const [datos, setDatos] = useState<T[]>([]);
  const [cargando, setCargando] = useState<boolean>(true);
  const [error, setError] = useState<ApiError | null>(null);

  const cargar = useCallback(async () => {
    // Si no hay endpoint (null), no hacer nada
    if (!endpoint) {
      setCargando(false);
      setDatos([]);
      return;
    }

    setCargando(true);
    setError(null);
    try {
      const respuesta = await request<T[] | { results: T[] }>({
        method: "GET",
        url: endpoint
      });
      console.log(`[useListado] ${endpoint} respuesta:`, respuesta);

      // Manejar respuestas paginadas (con results) y respuestas directas (array)
      let nuevoDatos: T[];
      if (Array.isArray(respuesta)) {
        // Respuesta directa como array
        nuevoDatos = respuesta;
      } else if (respuesta && typeof respuesta === 'object' && 'results' in respuesta) {
        // Respuesta paginada con formato { count, next, previous, results }
        nuevoDatos = Array.isArray(respuesta.results) ? respuesta.results : [];
      } else {
        // Fallback a array vacío
        nuevoDatos = [];
      }

      console.log(`[useListado] ${endpoint} estableciendo datos:`, nuevoDatos);
      setDatos(nuevoDatos);
    } catch (err) {
      console.error(`[useListado] ${endpoint} error:`, err);
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
