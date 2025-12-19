"""
Migración: Hacer campos nullable y eliminar secretaria_id obsoleto
PostgreSQL Version
Creado: 2025-12-19
Razón: Alinear la estructura de la BD con el modelo actual
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
    """Arreglar campos de funcionarios para que coincidan con el modelo"""
    try:
        print("🔌 Conectando a PostgreSQL RDS...\n")
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()
        
        print("🔄 Ejecutando migración: Arreglar campos de funcionarios...\n")
        
        # 1. Hacer cargo nullable
        print("1️⃣ Haciendo 'cargo' nullable...")
        cursor.execute("ALTER TABLE funcionarios ALTER COLUMN cargo DROP NOT NULL")
        conn.commit()
        print("   ✅ Campo 'cargo' ahora es nullable")
        
        # 2. Verificar si secretaria_id tiene datos
        cursor.execute("SELECT COUNT(*) FROM funcionarios WHERE secretaria_id IS NOT NULL")
        count = cursor.fetchone()[0]
        print(f"\n2️⃣ Verificando 'secretaria_id': {count} registros con datos")
        
        if count > 0:
            print("   ⚠️  Hay datos en secretaria_id, haciendo nullable en lugar de eliminar")
            cursor.execute("ALTER TABLE funcionarios ALTER COLUMN secretaria_id DROP NOT NULL")
            conn.commit()
            print("   ✅ Campo 'secretaria_id' ahora es nullable")
        else:
            print("   🗑️ No hay datos, eliminando columna 'secretaria_id'")
            cursor.execute("ALTER TABLE funcionarios DROP COLUMN secretaria_id")
            conn.commit()
            print("   ✅ Columna 'secretaria_id' eliminada")
        
        # 3. Hacer entity_id NOT NULL (debe tener valor siempre)
        print("\n3️⃣ Asegurando que 'entity_id' sea NOT NULL...")
        cursor.execute("ALTER TABLE funcionarios ALTER COLUMN entity_id SET NOT NULL")
        conn.commit()
        print("   ✅ Campo 'entity_id' configurado como NOT NULL")
        
        # 4. Verificar resultados
        cursor.execute("""
            SELECT column_name, is_nullable 
            FROM information_schema.columns 
            WHERE table_name = 'funcionarios' 
            AND column_name IN ('cargo', 'entity_id', 'secretaria_id')
            ORDER BY column_name
        """)
        
        print("\n📋 Verificación final:")
        for row in cursor.fetchall():
            print(f"   • {row[0]:<20} nullable={row[1]}")
        
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
