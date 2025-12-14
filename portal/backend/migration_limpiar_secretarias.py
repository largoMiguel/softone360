"""
Script de migración para limpiar secretarías con nombres incorrectos
PostgreSQL Version
Creado: 13 de diciembre de 2025
Descripción: Desactiva secretarías que tienen formato de nombre de usuario (Fredy.l, Omaira.ramirez)
"""

import psycopg2
from datetime import datetime

# Configuración de conexión a RDS PostgreSQL
DB_CONFIG = {
    'host': 'softone-db.ccvomgoayzyt.us-east-1.rds.amazonaws.com',
    'port': 5432,
    'database': 'postgres',
    'user': 'dbadmin',
    'password': 'TuPassSeguro123!'
}

def migrate():
    """Función principal de migración"""
    try:
        print("🔌 Conectando a PostgreSQL RDS...\n")
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()
        
        print("🔄 Identificando secretarías incorrectas (formato de usuario)...\n")
        
        # Ver las secretarías que parecen ser nombres de usuario
        cursor.execute("""
            SELECT id, entity_id, nombre, is_active 
            FROM secretarias 
            WHERE nombre LIKE '%.%' 
               OR (nombre = LOWER(nombre) AND nombre NOT LIKE '% %' AND LENGTH(nombre) < 30)
            ORDER BY entity_id, nombre
        """)
        
        incorrectas = cursor.fetchall()
        
        if not incorrectas:
            print("✅ No se encontraron secretarías incorrectas")
            cursor.close()
            conn.close()
            return True
        
        print(f"📋 Se encontraron {len(incorrectas)} secretarías con formato incorrecto:")
        for sec in incorrectas:
            print(f"   • ID: {sec[0]}, Entity: {sec[1]}, Nombre: '{sec[2]}', Activa: {sec[3]}")
        
        print("\n🔄 Desactivando secretarías incorrectas...\n")
        
        # Desactivar las secretarías incorrectas
        cursor.execute("""
            UPDATE secretarias 
            SET is_active = false 
            WHERE nombre LIKE '%.%' 
               OR (nombre = LOWER(nombre) AND nombre NOT LIKE '% %' AND LENGTH(nombre) < 30)
        """)
        
        filas_afectadas = cursor.rowcount
        conn.commit()
        
        print(f"   ✅ {filas_afectadas} secretarías desactivadas")
        
        # Verificar las secretarías activas restantes
        print("\n📋 Secretarías activas después de la limpieza:")
        cursor.execute("""
            SELECT id, entity_id, nombre, is_active 
            FROM secretarias 
            WHERE is_active = true
            ORDER BY entity_id, nombre
        """)
        
        activas = cursor.fetchall()
        if activas:
            for sec in activas:
                print(f"   ✅ ID: {sec[0]}, Entity: {sec[1]}, Nombre: '{sec[2]}'")
        else:
            print("   ⚠️ No quedan secretarías activas")
        
        cursor.close()
        conn.close()
        print("\n✅ Migración completada exitosamente")
        return True
        
    except Exception as e:
        print(f"❌ ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    import sys
    success = migrate()
    sys.exit(0 if success else 1)
