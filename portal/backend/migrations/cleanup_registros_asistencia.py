"""
Migración: Limpiar columnas obsoletas de registros_asistencia
PostgreSQL Version
Creado: 2025-12-19
Razón: Eliminar columnas duplicadas y hacer nullable las que corresponde
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
    """Limpiar columnas obsoletas de registros_asistencia"""
    try:
        print("🔌 Conectando a PostgreSQL RDS...\n")
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()
        
        print("🔄 Ejecutando migración: Limpiar registros_asistencia...\n")
        
        # 1. Eliminar columnas obsoletas
        columnas_obsoletas = ['cedula_funcionario', 'timestamp', 'fotografia_base64']
        
        for columna in columnas_obsoletas:
            cursor.execute(f"""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'registros_asistencia' 
                AND column_name = '{columna}'
            """)
            
            if cursor.fetchone():
                print(f"🗑️  Eliminando columna obsoleta '{columna}'...")
                cursor.execute(f"ALTER TABLE registros_asistencia DROP COLUMN {columna}")
                conn.commit()
                print(f"   ✅ Columna '{columna}' eliminada")
            else:
                print(f"   ℹ️  Columna '{columna}' no existe")
        
        # 2. Hacer equipo_id NOT NULL (es requerido)
        print("\n📌 Haciendo equipo_id NOT NULL...")
        cursor.execute("ALTER TABLE registros_asistencia ALTER COLUMN equipo_id SET NOT NULL")
        conn.commit()
        print("   ✅ equipo_id ahora es NOT NULL")
        
        # 3. Verificar estructura final
        cursor.execute("""
            SELECT column_name, is_nullable 
            FROM information_schema.columns 
            WHERE table_name = 'registros_asistencia'
            ORDER BY ordinal_position
        """)
        
        print("\n📋 Estructura final de registros_asistencia:")
        for row in cursor.fetchall():
            print(f"   • {row[0]:<25} nullable={row[1]}")
        
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
