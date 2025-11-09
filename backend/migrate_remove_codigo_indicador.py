"""
Script de migración para eliminar columna codigo_indicador_producto
Ejecutar en el entorno de Elastic Beanstalk
"""
import os
from sqlalchemy import create_engine, text

# Obtener DATABASE_URL del entorno
DATABASE_URL = os.getenv('DATABASE_URL')

if not DATABASE_URL:
    print("❌ ERROR: DATABASE_URL no está configurada")
    exit(1)

print(f"🔌 Conectando a la base de datos...")
engine = create_engine(DATABASE_URL)

migration_sql = """
-- Migración: Eliminar columna codigo_indicador_producto de pdm_actividades
BEGIN;

-- Verificar si la columna existe antes de eliminarla
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'pdm_actividades' 
        AND column_name = 'codigo_indicador_producto'
    ) THEN
        ALTER TABLE pdm_actividades 
        DROP COLUMN codigo_indicador_producto;
        
        RAISE NOTICE 'Columna codigo_indicador_producto eliminada exitosamente';
    ELSE
        RAISE NOTICE 'La columna codigo_indicador_producto no existe, no es necesario eliminarla';
    END IF;
END $$;

COMMIT;
"""

try:
    with engine.connect() as conn:
        print("✅ Conectado a la base de datos")
        print("🔧 Ejecutando migración...")
        
        conn.execute(text(migration_sql))
        conn.commit()
        
        print("✅ Migración ejecutada exitosamente")
        
        # Verificar estructura final
        print("\n📋 Verificando estructura de la tabla pdm_actividades:")
        result = conn.execute(text("""
            SELECT column_name, data_type, is_nullable 
            FROM information_schema.columns 
            WHERE table_name = 'pdm_actividades' 
            ORDER BY ordinal_position
        """))
        
        for row in result:
            print(f"  - {row.column_name}: {row.data_type} (nullable={row.is_nullable})")
            
except Exception as e:
    print(f"❌ Error durante la migración: {e}")
    exit(1)

print("\n🎉 Migración completada con éxito")
