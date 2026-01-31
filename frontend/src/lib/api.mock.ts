/**
 * Mock API para testing del sistema de undo sin backend
 */

import { UndoAvailability, UndoResponse } from './api';

/**
 * Simula que hay una acción disponible para deshacer
 */
export async function checkUndoAvailability(): Promise<UndoAvailability> {
  // Simular delay de red
  await new Promise(resolve => setTimeout(resolve, 200));

  return {
    available: true,
    description: "Crear venta #001234 - $15000",
    action_type: "CREATE_VENTA",
    created_at: new Date().toISOString(),
  };
}

/**
 * Simula undo exitoso
 */
export async function undoLastAction(): Promise<UndoResponse> {
  // Simular delay de red
  await new Promise(resolve => setTimeout(resolve, 500));

  return {
    success: true,
    action_undone: "Crear venta #001234 - $15000",
    message: "Se deshizo: Crear venta #001234 - $15000",
  };
}
