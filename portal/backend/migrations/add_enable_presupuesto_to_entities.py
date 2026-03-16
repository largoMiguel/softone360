"""
Script de migración para agregar campo enable_presupuesto a la tabla entities
PostgreSQL Version
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
    """Agregar columna enable_presupuesto a entities"""
    try:
        print("🔌 Conectando a PostgreSQL RDS...\n")
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()

        print("🔄 Ejecutando migración: Agregar campo enable_presupuesto...\n")

        # Verificar si la columna ya existe
        cursor.execute("""
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'entities'
            AND column_name = 'enable_presupuesto'
        """)

        if cursor.fetchone():
            print("✅ La columna 'enable_presupuesto' ya existe")
            cursor.close()
            conn.close()
            return True

        # Agregar columna enable_presupuesto
        print("   📝 Agregando columna enable_presupuesto...")
        cursor.execute("""
            ALTER TABLE entities
            ADD COLUMN enable_presupuesto BOOLEAN NOT NULL DEFAULT TRUE
        """)
        conn.commit()
        print("   ✅ Columna 'enable_presupuesto' agregada exitosamente")

        cursor.close()
        conn.close()
        print("\n✅ Migración completada exitosamente")
        return True

    except Exception as e:
        print(f"\n❌ Error durante migración: {e}")
        return False


if __name__ == "__main__":
    success = migrate()
    exit(0 if success else 1)
