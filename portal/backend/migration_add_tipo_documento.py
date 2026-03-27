"""
Script de migración para agregar campo tipo_documento a la tabla pqrs
PostgreSQL Version
Creado: 27 de marzo de 2026
"""

import psycopg2

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

        print("🔄 Ejecutando migración: Agregar campo 'tipo_documento' a tabla 'pqrs'...\n")

        # Verificar si la columna ya existe
        cursor.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'pqrs' 
            AND column_name = 'tipo_documento'
        """)

        if cursor.fetchone():
            print("   ✅ La columna 'tipo_documento' ya existe - saltando")
        else:
            cursor.execute("ALTER TABLE pqrs ADD COLUMN tipo_documento VARCHAR(50)")
            print("   ✅ Columna 'tipo_documento' agregada exitosamente")

        conn.commit()
        print("\n✅ Migración completada exitosamente")

    except Exception as e:
        print(f"\n❌ Error durante la migración: {e}")
        if 'conn' in locals():
            conn.rollback()
        raise
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'conn' in locals():
            conn.close()

if __name__ == "__main__":
    migrate()
