"""
Script de migración para agregar campo enable_asistencia a la tabla entities
PostgreSQL Version
Creado: 7 de enero de 2026
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
    """Agregar columna enable_asistencia a entities"""
    try:
        print("🔌 Conectando a PostgreSQL RDS...\n")
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()
        
        print("🔄 Ejecutando migración: Agregar campo enable_asistencia...\n")
        
        # Verificar si la columna ya existe
        cursor.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'entities' 
            AND column_name = 'enable_asistencia'
        """)
        
        if cursor.fetchone():
            print("✅ La columna 'enable_asistencia' ya existe")
            cursor.close()
            conn.close()
            return True
        
        # Agregar columna enable_asistencia
        print("   📝 Agregando columna enable_asistencia...")
        cursor.execute("""
            ALTER TABLE entities 
            ADD COLUMN enable_asistencia BOOLEAN NOT NULL DEFAULT TRUE
        """)
        conn.commit()
        print("   ✅ Columna agregada")
        
        # Verificar resultado
        cursor.execute("""
            SELECT column_name, data_type, column_default
            FROM information_schema.columns 
            WHERE table_name = 'entities' 
            AND column_name = 'enable_asistencia'
        """)
        
        result = cursor.fetchone()
        if result:
            print(f"\n📋 Verificación: {result[0]} ({result[1]}, default={result[2]})")
        
        # Contar entidades con el módulo activo
        cursor.execute("""
            SELECT COUNT(*) 
            FROM entities 
            WHERE enable_asistencia = TRUE
        """)
        
        count = cursor.fetchone()[0]
        print(f"\n📊 Entidades con Control de Asistencia activo: {count}")
        
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
