#!/usr/bin/env python3
"""
Script para probar el CRUD completo de actividades PDM
"""
import requests
import json
from datetime import datetime

BASE_URL = "http://127.0.0.1:8000"
ENTITY_SLUG = "alcaldia-prueba"

# Autenticación
print("=" * 60)
print("1. AUTENTICACIÓN")
print("=" * 60)
login_response = requests.post(
    f"{BASE_URL}/api/auth/login",
    json={"username": "admin", "password": "miguel"}
)
if login_response.status_code == 200:
    token = login_response.json()["access_token"]
    print(f"✅ Login exitoso. Token obtenido.")
    headers = {"Authorization": f"Bearer {token}"}
else:
    print(f"❌ Error en login: {login_response.status_code}")
    print(login_response.text)
    exit(1)

# CREATE - Crear nueva actividad
print("\n" + "=" * 60)
print("2. CREATE - Crear Actividad")
print("=" * 60)
nueva_actividad = {
    "codigo_producto": "4001030",
    "anio": 2025,
    "nombre": f"Test CRUD - {datetime.now().strftime('%H:%M:%S')}",
    "descripcion": "Actividad creada mediante script de prueba",
    "responsable": "Admin Test",
    "responsable_user_id": 2,
    "fecha_inicio": "2025-11-10T00:00:00.000Z",
    "fecha_fin": "2025-11-20T00:00:00.000Z",
    "meta_ejecutar": 15.0,
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
    print(f"✅ Actividad creada exitosamente")
    print(f"   ID: {actividad_id}")
    print(f"   Nombre: {actividad_creada['nombre']}")
    print(f"   Estado: {actividad_creada['estado']}")
    print(f"   Fecha inicio: {actividad_creada.get('fecha_inicio', 'N/A')}")
    print(f"   Fecha fin: {actividad_creada.get('fecha_fin', 'N/A')}")
else:
    print(f"❌ Error al crear: {create_response.status_code}")
    print(create_response.text)
    exit(1)

# READ - Listar actividades
print("\n" + "=" * 60)
print("3. READ - Listar Actividades")
print("=" * 60)
list_response = requests.get(
    f"{BASE_URL}/api/pdm/v2/{ENTITY_SLUG}/actividades/4001030",
    headers=headers,
    params={"anio": 2025}
)

if list_response.status_code == 200:
    actividades = list_response.json()
    print(f"✅ Listado exitoso: {len(actividades)} actividades encontradas")
    for act in actividades[:5]:
        print(f"   - ID {act['id']}: {act['nombre']} ({act['estado']})")
else:
    print(f"❌ Error al listar: {list_response.status_code}")
    print(list_response.text)

# UPDATE - Actualizar actividad
print("\n" + "=" * 60)
print("4. UPDATE - Actualizar Actividad")
print("=" * 60)
update_data = {
    "nombre": f"Test CRUD - ACTUALIZADO {datetime.now().strftime('%H:%M:%S')}",
    "descripcion": "Descripción actualizada mediante script",
    "estado": "EN_PROGRESO",
    "meta_ejecutar": 20.0
}

update_response = requests.put(
    f"{BASE_URL}/api/pdm/v2/{ENTITY_SLUG}/actividades/{actividad_id}",
    headers=headers,
    json=update_data
)

if update_response.status_code == 200:
    actividad_actualizada = update_response.json()
    print(f"✅ Actividad actualizada exitosamente")
    print(f"   ID: {actividad_actualizada['id']}")
    print(f"   Nuevo nombre: {actividad_actualizada['nombre']}")
    print(f"   Nuevo estado: {actividad_actualizada['estado']}")
    print(f"   Nueva meta: {actividad_actualizada['meta_ejecutar']}")
else:
    print(f"❌ Error al actualizar: {update_response.status_code}")
    print(update_response.text)

# CREATE EVIDENCIA - Registrar evidencia
print("\n" + "=" * 60)
print("5. CREATE EVIDENCIA - Registrar Evidencia")
print("=" * 60)
evidencia_data = {
    "descripcion": "Evidencia de prueba - Script automatizado de testing",
    "url_evidencia": "https://ejemplo.com/evidencia.pdf",
    "imagenes": []
}

evidencia_response = requests.post(
    f"{BASE_URL}/api/pdm/v2/{ENTITY_SLUG}/actividades/{actividad_id}/evidencia",
    headers=headers,
    json=evidencia_data
)

if evidencia_response.status_code == 201:
    evidencia_creada = evidencia_response.json()
    print(f"✅ Evidencia registrada exitosamente")
    print(f"   ID Evidencia: {evidencia_creada['id']}")
    print(f"   Descripción: {evidencia_creada['descripcion']}")
    print(f"   Fecha registro: {evidencia_creada.get('fecha_registro', 'N/A')}")
else:
    print(f"❌ Error al registrar evidencia: {evidencia_response.status_code}")
    print(evidencia_response.text)

# READ - Verificar evidencia en actividad
print("\n" + "=" * 60)
print("6. VERIFICAR - Leer Actividad con Evidencia")
print("=" * 60)
get_actividad_response = requests.get(
    f"{BASE_URL}/api/pdm/v2/{ENTITY_SLUG}/actividades/4001030",
    headers=headers,
    params={"anio": 2025}
)

if get_actividad_response.status_code == 200:
    actividades = get_actividad_response.json()
    actividad_con_evidencia = next((a for a in actividades if a['id'] == actividad_id), None)
    if actividad_con_evidencia:
        print(f"✅ Actividad encontrada")
        if actividad_con_evidencia.get('evidencia'):
            print(f"   ✅ Tiene evidencia registrada")
            print(f"      Descripción: {actividad_con_evidencia['evidencia']['descripcion']}")
        else:
            print(f"   ⚠️  No tiene evidencia")
else:
    print(f"❌ Error: {get_actividad_response.status_code}")

# DELETE - Eliminar actividad
print("\n" + "=" * 60)
print("7. DELETE - Eliminar Actividad")
print("=" * 60)
delete_response = requests.delete(
    f"{BASE_URL}/api/pdm/v2/{ENTITY_SLUG}/actividades/{actividad_id}",
    headers=headers
)

if delete_response.status_code == 204:
    print(f"✅ Actividad eliminada exitosamente (ID: {actividad_id})")
else:
    print(f"❌ Error al eliminar: {delete_response.status_code}")
    print(delete_response.text)

# Verificar eliminación
print("\n" + "=" * 60)
print("8. VERIFICAR - Confirmar Eliminación")
print("=" * 60)
verify_response = requests.get(
    f"{BASE_URL}/api/pdm/v2/{ENTITY_SLUG}/actividades/4001030",
    headers=headers,
    params={"anio": 2025}
)

if verify_response.status_code == 200:
    actividades = verify_response.json()
    existe = any(a['id'] == actividad_id for a in actividades)
    if existe:
        print(f"❌ La actividad aún existe (no se eliminó)")
    else:
        print(f"✅ Confirmado: La actividad fue eliminada correctamente")
        print(f"   Total actividades restantes: {len(actividades)}")

print("\n" + "=" * 60)
print("✅ PRUEBAS COMPLETADAS")
print("=" * 60)
