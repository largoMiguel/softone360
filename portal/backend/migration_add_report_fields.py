"""
Script de migración para agregar campos de personalización de informes PDM
PostgreSQL Version
Creado: 3 de diciembre de 2025
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
    """Función principal de migración"""
    try:
        print("🔌 Conectando a PostgreSQL RDS...\n")
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()
        
        print("🔄 Ejecutando migración: Agregar campos de personalización de informes a tabla 'entities'...\n")
        
        # Lista de columnas a agregar
        columnas = [
            ("plan_name", "VARCHAR(500)", "Nombre del plan de desarrollo"),
            ("report_code", "VARCHAR(50)", "Código del formulario de reporte"),
            ("report_version", "VARCHAR(20)", "Versión del reporte"),
            ("header_text", "TEXT", "Texto personalizado del encabezado"),
            ("footer_text", "TEXT", "Texto personalizado del pie de página"),
        ]
        
        for columna, tipo, descripcion in columnas:
            # Verificar si la columna ya existe
            cursor.execute("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'entities' 
                AND column_name = %s
            """, (columna,))
            
            if cursor.fetchone():
                print(f"   ✅ La columna '{columna}' ya existe - saltando")
            else:
                # Agregar columna
                cursor.execute(f"ALTER TABLE entities ADD COLUMN {columna} {tipo}")
                conn.commit()
                print(f"   ✅ Columna '{columna}' agregada ({descripcion})")
        
        # Establecer valores por defecto para report_code y report_version
        print("\n🔄 Estableciendo valores por defecto...\n")
        
        cursor.execute("""
            UPDATE entities 
            SET report_code = 'FM-0172', 
                report_version = '1.0' 
            WHERE report_code IS NULL OR report_version IS NULL
        """)
        conn.commit()
        print(f"   ✅ {cursor.rowcount} entidad(es) actualizada(s) con valores por defecto")
        
        # Verificar resultado
        print("\n📋 Columnas actuales en tabla 'entities':")
        cursor.execute("""
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'entities' 
            AND column_name IN ('plan_name', 'report_code', 'report_version', 'header_text', 'footer_text')
            ORDER BY column_name
        """)
        
        resultados = cursor.fetchall()
        for col_name, col_type in resultados:
            print(f"   • {col_name} ({col_type})")
        
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
