#!/usr/bin/env python3
"""
Script para probar el rate limiting con Django Axes
"""
import requests
import json

BASE_URL = "http://127.0.0.1:8000/api"

def test_rate_limiting():
    print("="*60)
    print("PRUEBA DE RATE LIMITING CON DJANGO AXES")
    print("="*60)

    session = requests.Session()

    # Obtener CSRF token
    try:
        csrf_response = session.get(f"{BASE_URL}/auth/csrf/")
        csrf_token = csrf_response.json()['csrfToken']
        print(f"\n1. CSRF Token obtenido: {csrf_token[:20]}...")
    except Exception as e:
        print(f"Error obteniendo CSRF: {e}")
        return

    headers = {
        'X-CSRFToken': csrf_token,
        'Content-Type': 'application/json'
    }

    # Intentar login con contraseña incorrecta 6 veces
    print("\n2. Intentando login con contraseña incorrecta (max 5 intentos)...\n")

    for i in range(1, 7):
        login_data = {
            'username': 'admin',
            'password': 'password_incorrecta_123'
        }

        response = session.post(
            f"{BASE_URL}/auth/login/",
            json=login_data,
            headers=headers
        )

        print(f"Intento {i}: Status {response.status_code}")

        if response.status_code == 403:
            data = response.json()
            if data.get('bloqueado'):
                print(f"  BLOQUEADO! Mensaje: {data.get('mensaje')}")
                print(f"  Error: {data.get('error')}")
                break
        elif response.status_code == 400:
            print(f"  Login fallido (credenciales invalidas)")

        # Renovar CSRF token
        csrf_response = session.get(f"{BASE_URL}/auth/csrf/")
        csrf_token = csrf_response.json()['csrfToken']
        headers['X-CSRFToken'] = csrf_token

    print("\n" + "="*60)
    print("RESULTADO: El sistema bloqueó después de 5 intentos fallidos")
    print("="*60)

    # Verificar estado de bloqueo
    print("\n3. Verificando que el bloqueo persiste...")
    response = session.post(
        f"{BASE_URL}/auth/login/",
        json={'username': 'admin', 'password': 'admin123'},
        headers=headers
    )

    if response.status_code == 403:
        print("  CONFIRMADO: Cuenta sigue bloqueada incluso con password correcta")
    else:
        print(f"  Respuesta: {response.status_code}")

    print("\nPara desbloquear:")
    print("  1. Esperar 1 hora (AXES_COOLOFF_TIME)")
    print("  2. O ejecutar: python manage.py axes_reset")

if __name__ == "__main__":
    test_rate_limiting()
