"""
Migración 007: Añadir campo pdf_template_url a entities
Para almacenar template PDF con membrete institucional usado en informes de PQRS

Script adaptado para ejecución directa en EC2 con acceso a RDS
Creado: 20 de abril de 2026
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
    print("="*70)
    print("🔄 MIGRACIÓN 007: Añadir pdf_template_url a entities")
    print("="*70)
    print(f"📅 Fecha: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("="*70)
    
    try:
        print("🔌 Conectando a PostgreSQL RDS...\n")
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()
        
        # Verificar si ya existe el campo
        print("🔍 Verificando si la columna 'pdf_template_url' ya existe...")
        cursor.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'entities' 
            AND column_name = 'pdf_template_url'
        """)
        
        if cursor.fetchone():
            print("✅ El campo 'pdf_template_url' ya existe en la tabla 'entities'")
            print("   ℹ️  No se requieren cambios")
            cursor.close()
            conn.close()
            print("="*70)
            return True
        
        # Añadir columna
        print("📝 Añadiendo columna 'pdf_template_url' a tabla 'entities'...\n")
        cursor.execute("""
            ALTER TABLE entities 
            ADD COLUMN pdf_template_url VARCHAR(500) NULL
        """)
        
        conn.commit()
        print("   ✅ Columna añadida exitosamente\n")
        
        # Verificar resultado
        print("🔍 Verificando resultado de la migración...")
        cursor.execute("""
            SELECT column_name, data_type, character_maximum_length, is_nullable
            FROM information_schema.columns 
            WHERE table_name = 'entities' 
            AND column_name = 'pdf_template_url'
        """)
        
        result = cursor.fetchone()
        if result:
            col_name, data_type, max_length, is_nullable = result
            print(f"   ✅ Columna verificada:")
            print(f"      - Nombre: {col_name}")
            print(f"      - Tipo: {data_type}({max_length})")
            print(f"      - Nullable: {is_nullable}")
        
        # Verificar estructura completa de la tabla entities
        print("\n📋 Columnas actuales en tabla 'entities':")
        cursor.execute("""
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns 
            WHERE table_name = 'entities'
            ORDER BY ordinal_position
        """)
        
        for row in cursor.fetchall():
            nullable = "NULL" if row[2] == "YES" else "NOT NULL"
            print(f"   • {row[0]:30} {row[1]:20} {nullable}")
        
        cursor.close()
        conn.close()
        
        print("\n" + "="*70)
        print("✅ MIGRACIÓN 007 COMPLETADA EXITOSAMENTE")
        print("="*70)
        return True
        
    except Exception as e:
        print(f"\n❌ ERROR: {str(e)}")
        print("="*70)
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    import sys
    success = migrate()
    sys.exit(0 if success else 1)
