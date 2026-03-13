"""
Migración: Ampliar columnas codigo_sector y codigo_programa en pdm_productos
PostgreSQL Version

Problema: Las columnas estaban definidas como VARCHAR(50) pero los datos del Excel
contienen valores mucho más largos (ej: líneas estratégicas de 100+ caracteres).
Esto causaba un error silencioso StringDataRightTruncation que resultaba en que
la carga del Excel aparentemente tenía éxito pero los datos no se guardaban.

Creado: 13 de marzo de 2026
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
    """Ampliar columnas VARCHAR(50) → TEXT en pdm_productos"""
    try:
        print("🔌 Conectando a PostgreSQL RDS...\n")
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()

        # Todas las columnas de contenido libre que pueden tener valores largos del Excel
        columnas = [
            "codigo_sector",
            "codigo_programa",
            "codigo_indicador_producto_mga",
            "unidad_medida",
            "codigo_indicador_producto",
            "sector_mga",
            "programa_mga",
            "codigo_producto_mga",
            "producto_mga",
            "indicador_producto_mga",
            "personalizacion_indicador",
            "ods",
            "tipo_acumulacion",
            "linea_estrategica",
            "codigo_producto",
        ]

        for col in columnas:
            # Verificar tipo actual
            cursor.execute("""
                SELECT data_type, character_maximum_length
                FROM information_schema.columns
                WHERE table_name = 'pdm_productos'
                AND column_name = %s
            """, (col,))
            row = cursor.fetchone()

            if not row:
                print(f"⚠️  Columna '{col}' no encontrada en pdm_productos — omitiendo")
                continue

            data_type, max_length = row
            if data_type == "text":
                print(f"✅ Columna '{col}' ya es TEXT — sin cambios")
                continue

            print(f"🔄 Alterando '{col}': {data_type}({max_length}) → TEXT ...")
            cursor.execute(f"ALTER TABLE pdm_productos ALTER COLUMN {col} TYPE TEXT")
            print(f"   ✓ '{col}' cambiada a TEXT")

        # También migrar pdm_actividades.codigo_producto
        print("\n📋 Verificando pdm_actividades.codigo_producto ...")
        cursor.execute("""
            SELECT data_type, character_maximum_length
            FROM information_schema.columns
            WHERE table_name = 'pdm_actividades'
            AND column_name = 'codigo_producto'
        """)
        row = cursor.fetchone()
        if row:
            data_type, max_length = row
            if data_type == "text":
                print(f"✅ pdm_actividades.codigo_producto ya es TEXT — sin cambios")
            else:
                print(f"🔄 Alterando pdm_actividades.codigo_producto: {data_type}({max_length}) → TEXT ...")
                cursor.execute("ALTER TABLE pdm_actividades ALTER COLUMN codigo_producto TYPE TEXT")
                print(f"   ✓ pdm_actividades.codigo_producto cambiada a TEXT")

        conn.commit()
        print("\n✅ Migración completada exitosamente")
        cursor.close()
        conn.close()
        return True

    except Exception as e:
        print(f"\n❌ Error en migración: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    success = migrate()
    sys.exit(0 if success else 1)
