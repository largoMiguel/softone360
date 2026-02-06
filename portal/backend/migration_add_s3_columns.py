"""
Script para agregar columnas S3 a evidencias existentes
Ejecutar en EC2 con acceso a RDS
"""
import psycopg2
import sys

DB_CONFIG = {
    'host': 'softone-db.ccvomgoayzyt.us-east-1.rds.amazonaws.com',
    'port': 5432,
    'database': 'softone360',
    'user': 'postgresuser',
    'password': 'Sistemas.2024'
}

def main():
    print("🔧 Agregando columnas S3 a pdm_actividades_evidencias...")
    
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        conn.autocommit = True
        cur = conn.cursor()
        
        # Agregar columna imagenes_s3_urls
        try:
            print("   Agregando imagenes_s3_urls...")
            cur.execute("""
                ALTER TABLE pdm_actividades_evidencias 
                ADD COLUMN IF NOT EXISTS imagenes_s3_urls JSON
            """)
            print("   ✅ imagenes_s3_urls agregada")
        except Exception as e:
            print(f"   ⚠️ imagenes_s3_urls: {e}")
        
        # Agregar columna migrated_to_s3
        try:
            print("   Agregando migrated_to_s3...")
            cur.execute("""
                ALTER TABLE pdm_actividades_evidencias 
                ADD COLUMN IF NOT EXISTS migrated_to_s3 BOOLEAN DEFAULT FALSE
            """)
            print("   ✅ migrated_to_s3 agregada")
        except Exception as e:
            print(f"   ⚠️ migrated_to_s3: {e}")
        
        # Verificar columnas
        cur.execute("""
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'pdm_actividades_evidencias'
            AND column_name IN ('imagenes_s3_urls', 'migrated_to_s3')
            ORDER BY column_name
        """)
        
        columnas = cur.fetchall()
        print(f"\n✅ Columnas verificadas:")
        for col in columnas:
            print(f"   - {col[0]}: {col[1]}")
        
        cur.close()
        conn.close()
        print("\n✅ Migración completada exitosamente")
        return 0
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return 1

if __name__ == "__main__":
    sys.exit(main())
