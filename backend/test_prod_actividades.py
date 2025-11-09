#!/usr/bin/env python3
"""
Script para probar el CRUD completo de actividades PDM en PRODUCCIÓN
"""
import requests
import json
from datetime import datetime

# Usar producción
BASE_URL = "http://softone-backend-useast1.eba-epvnmbmk.us-east-1.elasticbeanstalk.com"
ENTITY_SLUG = "alcaldia-prueba"

print("🌐 TESTING EN PRODUCCIÓN AWS")
print(f"   URL: {BASE_URL}")
print("=" * 80)

# Autenticación
print("\n1. AUTENTICACIÓN")
print("=" * 80)
login_response = requests.post(
    f"{BASE_URL}/api/auth/login",
    json={"username": "admin", "password": "miguel"}
)
if login_response.status_code == 200:
    token = login_response.json()["access_token"]
    print(f"✅ Login exitoso en producción")
    headers = {"Authorization": f"Bearer {token}"}
else:
    print(f"❌ Error en login: {login_response.status_code}")
    print(login_response.text)
    exit(1)

# CREATE - Crear nueva actividad
print("\n2. CREATE - Crear Actividad")
print("=" * 80)
nueva_actividad = {
    "codigo_producto": "4001030",
    "anio": 2025,
    "nombre": f"Test PROD - {datetime.now().strftime('%H:%M:%S')}",
    "descripcion": "Actividad creada en producción AWS",
    "responsable": "Admin AWS",
    "responsable_user_id": 2,
    "fecha_inicio": "2025-11-10T00:00:00.000Z",
    "fecha_fin": "2025-11-20T00:00:00.000Z",
    "meta_ejecutar": 100.0,
    "estado": "PENDIENTE"
}

create_response = requests.post(
    f"{BASE_URL}/api/pdm/v2/{ENTITY_SLUG}/actividades",
    headers=headers,
    json=nueva_actividad
)

if create_response.status_code == 201:
    actividad_creada = create_response.json()
    actividad_id = actividad_creada["id"]
    print(f"✅ Actividad creada en AWS")
    print(f"   ID: {actividad_id}")
    print(f"   Nombre: {actividad_creada['nombre']}")
    print(f"   Fechas: {actividad_creada.get('fecha_inicio')} → {actividad_creada.get('fecha_fin')}")
else:
    print(f"❌ Error al crear: {create_response.status_code}")
    print(create_response.text)
    exit(1)

# READ - Listar actividades
print("\n3. READ - Listar Actividades")
print("=" * 80)
list_response = requests.get(
    f"{BASE_URL}/api/pdm/v2/{ENTITY_SLUG}/actividades/4001030",
    headers=headers,
    params={"anio": 2025}
)

if list_response.status_code == 200:
    actividades = list_response.json()
    print(f"✅ {len(actividades)} actividades en producción")
    for act in actividades[-3:]:
        print(f"   - ID {act['id']}: {act['nombre'][:50]}")
else:
    print(f"❌ Error al listar: {list_response.status_code}")

# UPDATE - Actualizar actividad
print("\n4. UPDATE - Actualizar Actividad")
print("=" * 80)
update_response = requests.put(
    f"{BASE_URL}/api/pdm/v2/{ENTITY_SLUG}/actividades/{actividad_id}",
    headers=headers,
    json={
        "nombre": f"Test PROD ACTUALIZADO - {datetime.now().strftime('%H:%M:%S')}",
        "estado": "EN_PROGRESO"
    }
)

if update_response.status_code == 200:
    print(f"✅ Actividad actualizada en AWS")
else:
    print(f"❌ Error al actualizar: {update_response.status_code}")
    print(update_response.text)

# DELETE - Eliminar actividad
print("\n5. DELETE - Eliminar Actividad")
print("=" * 80)
delete_response = requests.delete(
    f"{BASE_URL}/api/pdm/v2/{ENTITY_SLUG}/actividades/{actividad_id}",
    headers=headers
)

if delete_response.status_code == 204:
    print(f"✅ Actividad eliminada de AWS (ID: {actividad_id})")
else:
    print(f"❌ Error al eliminar: {delete_response.status_code}")

print("\n" + "=" * 80)
print("✅ PRUEBAS EN PRODUCCIÓN COMPLETADAS")
print("=" * 80)
