"""
Migración: Eliminar columna uuid_equipo_registrado de registros_asistencia
PostgreSQL Version
Creado: 2025-12-19
Razón: La columna no es necesaria, ya tenemos equipo_id como FK
"""

import psycopg2

DB_CONFIG = {
    'host': 'softone-db.ccvomgoayzyt.us-east-1.rds.amazonaws.com',
    'port': 5432,
    'database': 'postgres',
    'user': 'dbadmin',
    'password': 'TuPassSeguro123!'
}

def migrate():
    """Eliminar columna uuid_equipo_registrado de registros_asistencia"""
    try:
        print("🔌 Conectando a PostgreSQL RDS...\n")
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()
        
        print("🔄 Ejecutando migración: Eliminar uuid_equipo_registrado...\n")
        
        # Verificar si la columna existe
        cursor.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'registros_asistencia' 
            AND column_name = 'uuid_equipo_registrado'
        """)
        
        if not cursor.fetchone():
            print("ℹ️  La columna 'uuid_equipo_registrado' no existe")
            cursor.close()
            conn.close()
            return True
        
        print("📋 Columna encontrada, procediendo a eliminar...")
        
        # Eliminar la columna
        cursor.execute("ALTER TABLE registros_asistencia DROP COLUMN uuid_equipo_registrado")
        conn.commit()
        print("   ✅ Columna uuid_equipo_registrado eliminada")
        
        # Verificar
        cursor.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'registros_asistencia' 
            AND column_name = 'uuid_equipo_registrado'
        """)
        
        if not cursor.fetchone():
            print("   ✅ Verificación: Columna eliminada correctamente")
        
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
