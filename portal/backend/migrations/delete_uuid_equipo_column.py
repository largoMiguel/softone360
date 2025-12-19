"""
Migración: Eliminar columna uuid_equipo de la tabla funcionarios
PostgreSQL Version
Creado: 2025-12-19
Razón: La columna uuid_equipo no es necesaria en el modelo de funcionarios
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
    """Eliminar columna uuid_equipo de funcionarios"""
    try:
        print("🔌 Conectando a PostgreSQL RDS...\n")
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()
        
        print("🔄 Ejecutando migración: Eliminar columna uuid_equipo de funcionarios...\n")
        
        # Verificar si la columna existe
        cursor.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'funcionarios' 
            AND column_name = 'uuid_equipo'
        """)
        
        if not cursor.fetchone():
            print("ℹ️  La columna 'uuid_equipo' no existe en la tabla funcionarios")
            print("   No se requieren cambios")
            cursor.close()
            conn.close()
            return True
        
        print("📋 Columna encontrada, procediendo a eliminar...")
        
        # Eliminar la columna
        cursor.execute("ALTER TABLE funcionarios DROP COLUMN uuid_equipo")
        conn.commit()
        print("   ✅ Columna uuid_equipo eliminada")
        
        # Verificar que se eliminó
        cursor.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'funcionarios' 
            AND column_name = 'uuid_equipo'
        """)
        
        if not cursor.fetchone():
            print("   ✅ Verificación: Columna eliminada correctamente")
        else:
            print("   ⚠️  Advertencia: La columna aún existe después de eliminar")
        
        cursor.close()
        conn.close()
        print("\n✅ Migración completada exitosamente")
        return True
        
    except Exception as e:
        print(f"❌ ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        if 'conn' in locals():
            conn.rollback()
        return False

if __name__ == "__main__":
    import sys
    success = migrate()
    sys.exit(0 if success else 1)
