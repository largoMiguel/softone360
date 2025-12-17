#!/usr/bin/env python3
"""
Script para eliminar secretarías obsoletas de la base de datos RDS
"""
import psycopg2
import os
import traceback

# Configuración de la base de datos desde variables de entorno
DB_CONFIG = {
    'host': os.environ.get('RDS_HOSTNAME', 'softone-db.ccvomgoayzyt.us-east-1.rds.amazonaws.com'),
    'port': int(os.environ.get('RDS_PORT', 5432)),
    'database': os.environ.get('RDS_DB_NAME', 'postgres'),
    'user': os.environ.get('RDS_USERNAME', 'dbadmin'),
    'password': os.environ.get('RDS_PASSWORD', 'TuPassSeguro123!'),
    'connect_timeout': 10
}

SECRETARIAS_A_ELIMINAR = [
    'Omaira.ramirez',
    'Fredy.l'
]

def migrate():
    try:
        print("🔌 Conectando a PostgreSQL RDS...\n")
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()
        
        print("🔍 Buscando secretarías a eliminar...\n")
        
        # Listar secretarías que coinciden con los nombres
        cursor.execute("""
            SELECT id, entity_id, nombre, is_active, created_at
            FROM secretarias 
            WHERE nombre IN %s
            ORDER BY id
        """, (tuple(SECRETARIAS_A_ELIMINAR),))
        
        secretarias = cursor.fetchall()
        
        if not secretarias:
            print("✅ No se encontraron secretarías con esos nombres")
            cursor.close()
            conn.close()
            return True
        
        print(f"📋 Secretarías encontradas ({len(secretarias)}):")
        for sec in secretarias:
            print(f"   ID: {sec[0]}, Entity: {sec[1]}, Nombre: {sec[2]}, Activo: {sec[3]}, Creado: {sec[4]}")
        
        print("\n⚠️  Estas secretarías serán eliminadas. Continuando...\n")
        
        # Eliminar secretarías
        ids_to_delete = [sec[0] for sec in secretarias]
        
        cursor.execute("""
            DELETE FROM secretarias 
            WHERE id IN %s
        """, (tuple(ids_to_delete),))
        
        deleted_count = cursor.rowcount
        conn.commit()
        
        print(f"✅ {deleted_count} secretarías eliminadas exitosamente")
        
        # Verificar que se eliminaron
        cursor.execute("""
            SELECT COUNT(*) 
            FROM secretarias 
            WHERE nombre IN %s
        """, (tuple(SECRETARIAS_A_ELIMINAR),))
        
        count = cursor.fetchone()[0]
        if count == 0:
            print("✅ Verificación: Todas las secretarías fueron eliminadas")
        else:
            print(f"⚠️  Advertencia: Aún quedan {count} secretarías")
        
        cursor.close()
        conn.close()
        
        print("\n✅ Migración completada exitosamente")
        return True
        
    except Exception as e:
        print(f"\n❌ Error durante la migración: {str(e)}")
        traceback.print_exc()
        return False

if __name__ == "__main__":
    import sys
    success = migrate()
    sys.exit(0 if success else 1)
