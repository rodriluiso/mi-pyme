#!/usr/bin/env python3
"""
Script para probar el flujo completo de reseteo de contraseña seguro
"""
import requests
import json

BASE_URL = "http://127.0.0.1:8000/api"

def print_step(step, message):
    print(f"\n{'='*60}")
    print(f"PASO {step}: {message}")
    print('='*60)

def test_password_reset_flow():
    session = requests.Session()

    # Paso 1: Login como admin
    print_step(1, "Login como administrador")

    # Obtener CSRF token
    csrf_response = session.get(f"{BASE_URL}/auth/csrf/")
    csrf_token = csrf_response.json()['csrfToken']
    print(f"CSRF Token obtenido: {csrf_token[:20]}...")

    # Login
    login_data = {
        'username': 'admin',
        'password': 'admin123'
    }
    headers = {
        'X-CSRFToken': csrf_token,
        'Content-Type': 'application/json'
    }

    login_response = session.post(
        f"{BASE_URL}/auth/login/",
        json=login_data,
        headers=headers
    )

    if login_response.status_code == 200:
        print("Login exitoso como admin")
        admin_data = login_response.json()
        print(f"Admin: {admin_data['usuario']['username']} - {admin_data['usuario']['nombre_completo']}")
    else:
        print(f"ERROR en login: {login_response.status_code}")
        print(login_response.text)
        return

    # Paso 2: Resetear contraseña del usuario test_user
    print_step(2, "Resetear contraseña de test_user (ID: 2)")

    reset_response = session.post(
        f"{BASE_URL}/usuarios/2/resetear_password/",
        headers=headers
    )

    if reset_response.status_code == 200:
        reset_data = reset_response.json()
        print("Contraseña reseteada exitosamente")
        print(f"Mensaje: {reset_data['mensaje']}")
        print(f"Email enviado: {reset_data['email_enviado']}")
        print(f"Nota: {reset_data['nota']}")
        print("\nREVISA LA CONSOLA DEL SERVIDOR para ver la contraseña temporal")
    else:
        print(f"ERROR al resetear: {reset_response.status_code}")
        print(reset_response.text)
        return

    # Paso 3: Verificar estado del usuario
    print_step(3, "Verificar estado del usuario test_user")

    user_response = session.get(f"{BASE_URL}/usuarios/2/", headers=headers)
    if user_response.status_code == 200:
        user_data = user_response.json()
        print(f"Username: {user_data['username']}")
        print(f"Email: {user_data['email']}")
        print(f"Debe cambiar password: {user_data['debe_cambiar_password']}")
        print(f"Password reset at: {user_data['password_reset_at']}")

    # Paso 4: Logout admin
    print_step(4, "Logout del administrador")
    session.post(f"{BASE_URL}/auth/logout/", headers=headers)
    print("Logout exitoso")

    # Crear nueva sesión para test_user
    user_session = requests.Session()

    # Paso 5: Intentar login con contraseña temporal
    print_step(5, "Intentar login como test_user con contraseña temporal")
    print("\nPara completar este paso, necesitas copiar la contraseña temporal")
    print("de la consola del servidor Django y ejecutar:")
    print("\n  temp_password = 'PEGAR_AQUI_LA_CONTRASEÑA_TEMPORAL'")
    print("\nLuego, prueba manualmente:")
    print("  1. POST /api/auth/login con username='test_user' y password=temp_password")
    print("  2. Deberías recibir HTTP 403 con 'debe_cambiar_password': True")
    print("  3. POST /api/auth/cambiar_password con la nueva contraseña")
    print("  4. Luego podrás hacer login normalmente")

    print("\n" + "="*60)
    print("PRUEBA COMPLETADA - Revisa la consola del servidor")
    print("="*60)

if __name__ == "__main__":
    test_password_reset_flow()
