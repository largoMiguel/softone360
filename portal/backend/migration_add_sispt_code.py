"""
Migración: Asegurar columna 'codigo_indicador_producto' (SisPT) en pdm_productos
- Agrega la columna si no existe
- Idempotente y segura para producción

Ejecutar con:
    scp -i ~/.ssh/aws-eb -o IdentitiesOnly=yes migration_add_sispt_code.py ec2-user@184.72.234.103:~/
    ssh -i ~/.ssh/aws-eb -o IdentitiesOnly=yes ec2-user@184.72.234.103 "python3 migration_add_sispt_code.py"
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
    
    print("\n🔧 INICIANDO MIGRACIÓN: Agregar columna SisPT a pdm_productos")
    print("=" * 60)
    
    try:
        print("\n🔌 Conectando a PostgreSQL RDS...")
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()
        print("✅ Conexión exitosa\n")
        
        # Verificar si la tabla existe
        print("🔍 Verificando existencia de tabla 'pdm_productos'...")
        cursor.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'pdm_productos'
            )
        """)
        
        if not cursor.fetchone()[0]:
            print("❌ La tabla 'pdm_productos' no existe. Nada que migrar.")
            cursor.close()
            conn.close()
            return True
        
        print("✅ Tabla 'pdm_productos' existe\n")
        
        # Verificar si la columna ya existe
        print("🔍 Verificando existencia de columna 'codigo_indicador_producto'...")
        cursor.execute("""
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'pdm_productos' 
            AND column_name = 'codigo_indicador_producto'
        """)
        
        if cursor.fetchone():
            print("✅ La columna 'codigo_indicador_producto' ya existe en 'pdm_productos'")
            print("   ℹ️  Nada que hacer - migración ya aplicada\n")
        else:
            # Agregar columna
            print("🔨 Agregando columna 'codigo_indicador_producto' (VARCHAR(128)) a 'pdm_productos'...")
            cursor.execute("""
                ALTER TABLE pdm_productos
                ADD COLUMN codigo_indicador_producto VARCHAR(128)
            """)
            conn.commit()
            print("   ✅ Columna agregada correctamente\n")
            
            # Verificar resultado
            print("🔍 Verificando que la columna fue agregada...")
            cursor.execute("""
                SELECT column_name, data_type, character_maximum_length
                FROM information_schema.columns 
                WHERE table_name = 'pdm_productos' 
                AND column_name = 'codigo_indicador_producto'
            """)
            
            result = cursor.fetchone()
            if result:
                print(f"   ✅ Verificación exitosa: {result[0]} ({result[1]}({result[2]}))")
            else:
                print("   ⚠️  No se pudo verificar la columna, revise manualmente.")
        
        # Mostrar todas las columnas de la tabla
        print("\n📋 Columnas actuales en 'pdm_productos':")
        cursor.execute("""
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'pdm_productos' 
            ORDER BY ordinal_position
        """)
        
        for row in cursor.fetchall():
            symbol = "  🆕" if row[0] == 'codigo_indicador_producto' else "    "
            print(f"{symbol} {row[0]} ({row[1]})")
        
        print("\n" + "=" * 60)
        print("✅ MIGRACIÓN COMPLETADA EXITOSAMENTE")
        print("=" * 60)
        print("\nℹ️  La columna 'codigo_indicador_producto' (Código SisPT) está lista para usar.\n")
        
        cursor.close()
        conn.close()
        return True
        
    except Exception as e:
        print(f"\n❌ ERROR durante la migración: {e}")
        import traceback
        traceback.print_exc()
        if 'conn' in locals():
            try:
                conn.rollback()
                conn.close()
            except Exception:
                pass
        return False


if __name__ == "__main__":
    import sys
    success = migrate()
    sys.exit(0 if success else 1)
