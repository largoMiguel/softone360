"""
Migración 008: Añadir campos representante_legal y cargo_representante a entities
Para almacenar información del firmante de informes de PQRS

Script adaptado para ejecución directa en EC2 con acceso a RDS
Creado: 23 de abril de 2026
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
    print("🔄 MIGRACIÓN 008: Añadir campos de representante legal a entities")
    print("="*70)
    print(f"📅 Fecha: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("="*70)
    
    try:
        print("🔌 Conectando a PostgreSQL RDS...\n")
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()
        
        campos_a_agregar = [
            ('representante_legal', 'VARCHAR(300) NULL', 'Nombre completo del representante legal'),
            ('cargo_representante', 'VARCHAR(300) NULL', 'Cargo del representante legal')
        ]
        
        for campo, tipo_dato, descripcion in campos_a_agregar:
            print(f"🔍 Verificando si la columna '{campo}' ya existe...")
            cursor.execute("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'entities' 
                AND column_name = %s
            """, (campo,))
            
            if cursor.fetchone():
                print(f"✅ El campo '{campo}' ya existe en la tabla 'entities'")
                print(f"   ℹ️  No se requieren cambios\n")
            else:
                print(f"📝 Añadiendo columna '{campo}' a tabla 'entities'...")
                print(f"   📋 Descripción: {descripcion}")
                
                cursor.execute(f"""
                    ALTER TABLE entities 
                    ADD COLUMN {campo} {tipo_dato}
                """)
                
                conn.commit()
                print(f"   ✅ Columna '{campo}' añadida exitosamente\n")
        
        # Verificar resultado
        print("🔍 Verificando resultado de la migración...")
        cursor.execute("""
            SELECT column_name, data_type, character_maximum_length, is_nullable
            FROM information_schema.columns 
            WHERE table_name = 'entities' 
            AND column_name IN ('representante_legal', 'cargo_representante')
            ORDER BY ordinal_position
        """)
        
        results = cursor.fetchall()
        if results:
            print("   ✅ Columnas verificadas:")
            for col_name, data_type, max_length, is_nullable in results:
                print(f"      • {col_name:25} {data_type}({max_length or 'N/A'}) - Nullable: {is_nullable}")
        
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
            print(f"   • {row[0]:35} {row[1]:20} {nullable}")
        
        cursor.close()
        conn.close()
        
        print("\n" + "="*70)
        print("✅ MIGRACIÓN 008 COMPLETADA EXITOSAMENTE")
        print("="*70)
        print("\n💡 NOTA: Puedes actualizar los datos de representante legal con:")
        print("   UPDATE entities SET")
        print("     representante_legal = 'BRYAN DANILO MEJÍA SIERRA',")
        print("     cargo_representante = 'Secretario General y de Gobierno con Funciones de Control Interno'")
        print("   WHERE slug = 'tu-entidad';")
        print("="*70)
        return True
        
    except Exception as e:
        print(f"\n❌ ERROR durante la migración: {e}")
        print("="*70)
        return False


if __name__ == "__main__":
    success = migrate()
    exit(0 if success else 1)
