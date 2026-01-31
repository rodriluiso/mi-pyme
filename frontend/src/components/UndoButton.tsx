import { Undo2, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { useUndo } from '../hooks/useUndo';
import { toast } from 'sonner';

/**
 * Botón de Deshacer que se muestra cuando hay una acción disponible para deshacer.
 *
 * Características:
 * - Se oculta automáticamente cuando no hay acciones disponibles
 * - Muestra un tooltip con la descripción de la acción a deshacer
 * - Muestra feedback visual con toast después de ejecutar el undo
 * - Refresca automáticamente el estado cada 5 segundos
 */
export function UndoButton() {
  const { availability, isLoading, executeUndo } = useUndo();

  const handleUndo = async () => {
    const result = await executeUndo();

    if (result.success) {
      toast.success(result.message, {
        description: 'La página se actualizará automáticamente',
        duration: 3000,
      });

      // Refrescar la página después de 1 segundo para que el usuario vea el toast
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } else {
      toast.error('No se pudo deshacer', {
        description: result.message,
        duration: 4000,
      });
    }
  };

  // No mostrar el botón si no hay acciones disponibles
  if (!availability.available) {
    return null;
  }

  const tooltipText = availability.description || 'Deshacer última acción';

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            onClick={handleUndo}
            disabled={isLoading}
            className="gap-2 shadow-sm hover:shadow-md transition-shadow"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Undo2 className="h-4 w-4" />
            )}
            <span className="hidden sm:inline">Deshacer</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <p className="font-medium">Deshacer:</p>
          <p className="text-xs text-muted-foreground mt-1">{tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
