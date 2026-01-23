"""
Handlers para el sistema de Undo.

Cada handler implementa la lógica específica para deshacer un tipo de acción.
"""

from .base import BaseUndoHandler
from .venta import VentaUndoHandler
from .pago import PagoClienteUndoHandler
from .compra import CompraUndoHandler

# Registrar handlers automáticamente
from ..undo_service import UndoService
from usuarios.models import UndoAction

# Registrar VentaUndoHandler para acciones de tipo CREATE_VENTA
UndoService.register_handler(
    UndoAction.ActionType.CREATE_VENTA,
    VentaUndoHandler
)

# Registrar PagoClienteUndoHandler para acciones de tipo REGISTER_PAGO_CLIENTE
UndoService.register_handler(
    UndoAction.ActionType.REGISTER_PAGO_CLIENTE,
    PagoClienteUndoHandler
)

# Registrar CompraUndoHandler para acciones de tipo CREATE_COMPRA
UndoService.register_handler(
    UndoAction.ActionType.CREATE_COMPRA,
    CompraUndoHandler
)

__all__ = [
    'BaseUndoHandler',
    'VentaUndoHandler',
    'PagoClienteUndoHandler',
    'CompraUndoHandler',
]
