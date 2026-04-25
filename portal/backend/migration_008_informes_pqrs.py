"""
Migración 008: Agregar columnas para soporte de informes PQRS en tabla informes_estado
- Agrega columna 'tipo' (pdm | pqrs)
- Agrega columnas: fecha_inicio, fecha_fin, total_pqrs, tasa_resolucion, used_ai
- Hace 'anio' nullable (no aplica para PQRS)

Creado: 25 de abril de 2026
"""

import psycopg2
from datetime import datetime
import sys

DB_CONFIG = {
    'host': 'softone-db.ccvomgoayzyt.us-east-1.rds.amazonaws.com',
    'port': 5432,
    'database': 'postgres',
    'user': 'dbadmin',
    'password': 'TuPassSeguro123!'
}

COLUMNAS = [
    ("tipo",             "VARCHAR(20) NOT NULL DEFAULT 'pdm'"),
    ("fecha_inicio",     "VARCHAR(20) NULL"),
    ("fecha_fin",        "VARCHAR(20) NULL"),
    ("total_pqrs",       "INTEGER NULL"),
    ("tasa_resolucion",  "INTEGER NULL"),
    ("used_ai",          "BOOLEAN DEFAULT FALSE"),
]

def migrate():
    print("="*70)
    print("🔄 MIGRACIÓN 008: Columnas informes PQRS en informes_estado")
    print("="*70)
    print(f"📅 Fecha: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    try:
        print("\n🔌 Conectando a PostgreSQL RDS...")
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()
        print("   ✅ Conectado\n")

        for col_name, col_def in COLUMNAS:
            cursor.execute("""
                SELECT column_name FROM information_schema.columns
                WHERE table_name = 'informes_estado' AND column_name = %s
            """, (col_name,))
            if cursor.fetchone():
                print(f"   ⏭️  Columna '{col_name}' ya existe, omitiendo.")
            else:
                cursor.execute(f"ALTER TABLE informes_estado ADD COLUMN {col_name} {col_def}")
                conn.commit()
                print(f"   ✅ Columna '{col_name}' agregada.")

        # Hacer anio nullable si aún no lo es
        cursor.execute("""
            SELECT is_nullable FROM information_schema.columns
            WHERE table_name = 'informes_estado' AND column_name = 'anio'
        """)
        row = cursor.fetchone()
        if row and row[0] == 'NO':
            cursor.execute("ALTER TABLE informes_estado ALTER COLUMN anio DROP NOT NULL")
            conn.commit()
            print("   ✅ Columna 'anio' ahora es nullable.")
        else:
            print("   ⏭️  Columna 'anio' ya es nullable.")

        # Crear índice en tipo
        cursor.execute("""
            SELECT indexname FROM pg_indexes
            WHERE tablename = 'informes_estado' AND indexname = 'ix_informes_estado_tipo'
        """)
        if not cursor.fetchone():
            cursor.execute("CREATE INDEX ix_informes_estado_tipo ON informes_estado (tipo)")
            conn.commit()
            print("   ✅ Índice 'ix_informes_estado_tipo' creado.")
        else:
            print("   ⏭️  Índice 'ix_informes_estado_tipo' ya existe.")

        print("\n✅ Migración 008 completada exitosamente")
        print("="*70)
        cursor.close()
        conn.close()
        return True

    except Exception as e:
        print(f"\n❌ ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = migrate()
    sys.exit(0 if success else 1)
