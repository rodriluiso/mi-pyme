import { useState, useEffect, useCallback } from 'react';
import { checkUndoAvailability, undoLastAction, UndoAvailability } from '../lib/api';

/**
 * Hook personalizado para manejar el sistema de undo
 *
 * Verifica automáticamente cada 5 segundos si hay acciones disponibles para deshacer
 * y proporciona funciones para ejecutar el undo.
 */
export function useUndo() {
  const [availability, setAvailability] = useState<UndoAvailability>({ available: false });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Verifica si hay una acción disponible para deshacer
   */
  const checkAvailability = useCallback(async () => {
    try {
      const data = await checkUndoAvailability();
      setAvailability(data);
      setError(null);
    } catch (err) {
      console.error('Error al verificar disponibilidad de undo:', err);
      // No establecer error aquí para no molestar al usuario con errores de red
      setAvailability({ available: false });
    }
  }, []);

  /**
   * Ejecuta el undo de la última acción
   */
  const executeUndo = useCallback(async (): Promise<{ success: boolean; message: string }> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await undoLastAction();

      if (response.success) {
        // Verificar de nuevo la disponibilidad después de deshacer
        await checkAvailability();
        return { success: true, message: response.message };
      } else {
        setError(response.message);
        return { success: false, message: response.message };
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al deshacer la acción';
      setError(errorMessage);
      return { success: false, message: errorMessage };
    } finally {
      setIsLoading(false);
    }
  }, [checkAvailability]);

  /**
   * Efecto para verificar disponibilidad periódicamente
   */
  useEffect(() => {
    // Verificar inmediatamente al montar
    checkAvailability();

    // Verificar cada 5 segundos
    const interval = setInterval(checkAvailability, 5000);

    return () => clearInterval(interval);
  }, [checkAvailability]);

  return {
    availability,
    isLoading,
    error,
    executeUndo,
    refreshAvailability: checkAvailability,
  };
}
