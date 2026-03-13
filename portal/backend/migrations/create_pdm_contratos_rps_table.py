"""
Migración: Crear tabla pdm_contratos_rps (con el esquema correcto)

- Elimina la tabla anterior si existía (tenía campo no_cdp incorrecto)
- Crea la tabla con:
  * no_crp (el campo correcto según el Excel "NO CRP")
  * codigo_producto TEXT (productos pueden tener códigos largos)
  * entity_id con FK CASCADE (cascada al eliminar entidad)
  * anio INTEGER para organizar por año fiscal
  * concepto, valor, contratista

Creado: 2026
"""

import sys
import psycopg2

DB_CONFIG = {
    'host': 'softone-db.ccvomgoayzyt.us-east-1.rds.amazonaws.com',
    'port': 5432,
    'database': 'postgres',
    'user': 'dbadmin',
    'password': 'TuPassSeguro123!'
}


def migrate():
    """Crear tabla pdm_contratos_rps con esquema correcto"""
    try:
        print("🔌 Conectando a PostgreSQL RDS...\n")
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()

        # Verificar si ya existe la tabla con el esquema correcto
        cursor.execute("""
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'pdm_contratos_rps'
            ORDER BY ordinal_position
        """)
        columnas_actuales = [row[0] for row in cursor.fetchall()]

        if columnas_actuales:
            print(f"📋 Tabla pdm_contratos_rps ya existe con columnas: {columnas_actuales}")

            if 'no_crp' in columnas_actuales:
                print("✅ La tabla ya tiene el esquema correcto (no_crp). Sin cambios.")
                conn.close()
                return True

            if 'no_cdp' in columnas_actuales:
                print("⚠️  La tabla tiene el campo viejo 'no_cdp'. Eliminando y recreando...")
                cursor.execute("DROP TABLE IF EXISTS pdm_contratos_rps CASCADE")
                conn.commit()
                print("🗑️  Tabla antigua eliminada")

        print("🔨 Creando tabla pdm_contratos_rps...")
        cursor.execute("""
            CREATE TABLE pdm_contratos_rps (
                id          SERIAL PRIMARY KEY,
                codigo_producto TEXT NOT NULL,
                no_crp      VARCHAR(100) NOT NULL,
                concepto    TEXT,
                valor       NUMERIC(18, 2) NOT NULL DEFAULT 0,
                entity_id   INTEGER NOT NULL
                                REFERENCES entities(id) ON DELETE CASCADE,
                anio        INTEGER NOT NULL,
                contratista VARCHAR(500),
                created_at  TIMESTAMP DEFAULT NOW(),
                updated_at  TIMESTAMP DEFAULT NOW()
            )
        """)
        print("✅ Tabla pdm_contratos_rps creada")

        print("🔨 Creando índices...")
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_pdm_contratos_entity_anio
            ON pdm_contratos_rps(entity_id, anio)
        """)
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_pdm_contratos_entity_producto
            ON pdm_contratos_rps(entity_id, codigo_producto)
        """)
        print("✅ Índices creados")

        conn.commit()
        cursor.close()
        conn.close()
        print("\n🎉 Migración completada exitosamente")
        return True

    except Exception as e:
        print(f"\n❌ Error en migración: {str(e)}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    success = migrate()
    sys.exit(0 if success else 1)
