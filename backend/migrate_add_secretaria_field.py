"""
Script de migración para agregar el campo 'secretaria' a la tabla 'users'
PostgreSQL Version
"""

import psycopg2
from datetime import datetime
import os

# Configuración de conexión a RDS PostgreSQL
DB_CONFIG = {
    'host': 'softone-db.ccvomgoayzyt.us-east-1.rds.amazonaws.com',
    'port': 5432,
    'database': 'postgres',
    'user': 'dbadmin',
    'password': 'TuPassSeguro123!'
}

def migrate():
    try:
        print("🔌 Conectando a PostgreSQL RDS...\n")
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()
        
        print("🔄 Ejecutando migración: Agregar columna 'secretaria' a tabla 'users'...\n")
        
        # Verificar si la columna ya existe
        cursor.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'users' AND column_name = 'secretaria'
        """)
        
        if cursor.fetchone():
            print("✅ La columna 'secretaria' ya existe")
            cursor.close()
            conn.close()
            return True
        
        # Agregar columna
        cursor.execute("ALTER TABLE users ADD COLUMN secretaria VARCHAR(256)")
        conn.commit()
        
        print("✅ Columna 'secretaria' agregada exitosamente\n")
        
        # Listar columnas de users
        print("📋 Columnas actuales en tabla 'users':")
        cursor.execute("""
            SELECT column_name, data_type, character_maximum_length
            FROM information_schema.columns 
            WHERE table_name = 'users'
            ORDER BY ordinal_position
        """)
        for row in cursor.fetchall():
            length = f"({row[2]})" if row[2] else ""
            print(f"   • {row[0]} ({row[1]}{length})")
        
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
