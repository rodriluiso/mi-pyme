#!/usr/bin/env python
"""
Script de prueba para verificar el sistema de UNDO.
Prueba las importaciones y la estructura básica del sistema.
"""

import os
import sys
import django

# Configurar Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings.dev')
django.setup()

from django.contrib.auth import get_user_model
from usuarios.models import UndoAction
from usuarios.services.undo_service import UndoService, UndoResult, NoUndoableActionException, CannotUndoException
from usuarios.services.handlers.venta import VentaUndoHandler
from usuarios.services.handlers.pago import PagoClienteUndoHandler
from usuarios.services.handlers.compra import CompraUndoHandler

def test_imports():
    """Test 1: Verificar que todos los módulos se importan correctamente"""
    print("=" * 60)
    print("TEST 1: Verificando importaciones...")
    print("=" * 60)

    try:
        from usuarios.services.venta_service import VentaService
        print("[OK] VentaService importado")

        from usuarios.services.pago_service import PagoService
        print("[OK] PagoService importado")

        from usuarios.services.compra_service import CompraService
        print("[OK] CompraService importado")

        print("\n[OK] TODAS LAS IMPORTACIONES EXITOSAS\n")
        return True
    except Exception as e:
        print(f"\n[FAIL] ERROR EN IMPORTACIONES: {e}\n")
        return False


def test_handler_registry():
    """Test 2: Verificar que los handlers están registrados"""
    print("=" * 60)
    print("TEST 2: Verificando registro de handlers...")
    print("=" * 60)

    handlers = UndoService._handlers
    print(f"Handlers registrados: {len(handlers)}")

    expected_handlers = {
        UndoAction.ActionType.CREATE_VENTA: VentaUndoHandler,
        UndoAction.ActionType.REGISTER_PAGO_CLIENTE: PagoClienteUndoHandler,
        UndoAction.ActionType.CREATE_COMPRA: CompraUndoHandler,
    }

    all_ok = True
    for action_type, expected_handler in expected_handlers.items():
        if action_type in handlers:
            handler_class = handlers[action_type]
            if handler_class == expected_handler:
                print(f"[OK] {action_type}: {handler_class.__name__}")
            else:
                print(f"[FAIL] {action_type}: esperado {expected_handler.__name__}, encontrado {handler_class.__name__}")
                all_ok = False
        else:
            print(f"[FAIL] {action_type}: NO REGISTRADO")
            all_ok = False

    if all_ok:
        print("\n[OK] TODOS LOS HANDLERS REGISTRADOS CORRECTAMENTE\n")
    else:
        print("\n[FAIL] ALGUNOS HANDLERS NO ESTÁN REGISTRADOS CORRECTAMENTE\n")

    return all_ok


def test_action_types():
    """Test 3: Verificar que los ActionTypes están definidos"""
    print("=" * 60)
    print("TEST 3: Verificando ActionTypes...")
    print("=" * 60)

    action_types = [
        ('CREATE_VENTA', 'Crear Venta'),
        ('REGISTER_PAGO_CLIENTE', 'Registrar Pago'),
        ('CREATE_COMPRA', 'Crear Compra'),
    ]

    all_ok = True
    for action_value, action_label in action_types:
        try:
            action = getattr(UndoAction.ActionType, action_value)
            print(f"[OK] {action_value}: {action.label}")
        except AttributeError:
            print(f"[FAIL] {action_value}: NO DEFINIDO")
            all_ok = False

    if all_ok:
        print("\n[OK] TODOS LOS ACTION TYPES DEFINIDOS\n")
    else:
        print("\n[FAIL] ALGUNOS ACTION TYPES NO ESTÁN DEFINIDOS\n")

    return all_ok


def test_models():
    """Test 4: Verificar que los modelos tienen los campos necesarios"""
    print("=" * 60)
    print("TEST 4: Verificando modelos...")
    print("=" * 60)

    from ventas.models import Venta
    from finanzas_reportes.models import PagoCliente
    from compras.models import Compra

    models_to_check = [
        (Venta, ['anulada', 'fecha_anulacion', 'motivo_anulacion', 'anulada_por']),
        (PagoCliente, ['anulado', 'fecha_anulacion', 'anulado_por']),
        (Compra, ['anulada', 'fecha_anulacion', 'motivo_anulacion', 'anulada_por']),
    ]

    all_ok = True
    for model, fields in models_to_check:
        print(f"\n{model.__name__}:")
        for field in fields:
            if hasattr(model, field):
                print(f"  [OK] {field}")
            else:
                print(f"  [FAIL] {field} NO ENCONTRADO")
                all_ok = False

        # Verificar manager personalizado
        if hasattr(model.objects, 'activas'):
            print(f"  [OK] Manager personalizado (activas/anuladas)")
        else:
            print(f"  [FAIL] Manager personalizado NO ENCONTRADO")
            all_ok = False

    if all_ok:
        print("\n[OK] TODOS LOS MODELOS TIENEN LOS CAMPOS NECESARIOS\n")
    else:
        print("\n[FAIL] ALGUNOS MODELOS NO TIENEN LOS CAMPOS NECESARIOS\n")

    return all_ok


def test_undo_service_methods():
    """Test 5: Verificar que UndoService tiene los métodos necesarios"""
    print("=" * 60)
    print("TEST 5: Verificando métodos de UndoService...")
    print("=" * 60)

    methods = ['register_handler', 'get_handler', 'undo_last', 'get_availability', 'register_action']

    all_ok = True
    for method in methods:
        if hasattr(UndoService, method):
            print(f"[OK] {method}")
        else:
            print(f"[FAIL] {method} NO ENCONTRADO")
            all_ok = False

    if all_ok:
        print("\n[OK] TODOS LOS METODOS DE UNDOSERVICE DISPONIBLES\n")
    else:
        print("\n[FAIL] ALGUNOS METODOS DE UNDOSERVICE NO ESTAN DISPONIBLES\n")

    return all_ok


def test_feature_flag():
    """Test 6: Verificar configuración del feature flag"""
    print("=" * 60)
    print("TEST 6: Verificando feature flag...")
    print("=" * 60)

    from django.conf import settings

    if hasattr(settings, 'ENABLE_UNDO_SYSTEM'):
        status = settings.ENABLE_UNDO_SYSTEM
        print(f"[OK] ENABLE_UNDO_SYSTEM definido: {status}")
        if status:
            print("   [WARNING] Sistema de undo ACTIVADO")
        else:
            print("   [INFO] Sistema de undo DESACTIVADO (usar para activar)")
        print("\n[OK] FEATURE FLAG CONFIGURADO\n")
        return True
    else:
        print("[FAIL] ENABLE_UNDO_SYSTEM NO DEFINIDO")
        print("\n[FAIL] FEATURE FLAG NO CONFIGURADO\n")
        return False


def main():
    """Ejecutar todas las pruebas"""
    print("\n")
    print("[TEST] INICIANDO PRUEBAS DEL SISTEMA DE UNDO")
    print("=" * 60)
    print()

    results = {
        'Importaciones': test_imports(),
        'Registro de Handlers': test_handler_registry(),
        'ActionTypes': test_action_types(),
        'Modelos': test_models(),
        'Métodos de UndoService': test_undo_service_methods(),
        'Feature Flag': test_feature_flag(),
    }

    print("=" * 60)
    print("RESUMEN DE PRUEBAS")
    print("=" * 60)

    for test_name, result in results.items():
        status = "[PASS]" if result else "[FAIL]"
        print(f"{status} - {test_name}")

    print()

    total_tests = len(results)
    passed_tests = sum(results.values())

    print(f"Total: {passed_tests}/{total_tests} pruebas exitosas")

    if passed_tests == total_tests:
        print("\n[SUCCESS] TODOS LOS TESTS PASARON! El sistema esta listo para usar.")
        print("\nPara activar el sistema de undo:")
        print("1. Editar backend/core/settings/base.py")
        print("2. Cambiar: ENABLE_UNDO_SYSTEM = True")
        print("3. Reiniciar el servidor Django")
        return 0
    else:
        print(f"\n[WARNING] {total_tests - passed_tests} prueba(s) fallaron. Revisar errores arriba.")
        return 1


if __name__ == '__main__':
    sys.exit(main())
