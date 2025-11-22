"""
Script de migración: Agregar campo 'anio' a pdm_ejecucion_presupuestal
PostgreSQL RDS Version
Fecha: 22 de noviembre de 2025
Descripción: Permite filtrar ejecuciones presupuestales por año y reemplazar datos año por año
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
    """Agrega el campo 'anio' a la tabla pdm_ejecucion_presupuestal"""
    try:
        print("🔌 Conectando a PostgreSQL RDS...\n")
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()
        
        print("🔄 Ejecutando migración: Agregar campo 'anio' a pdm_ejecucion_presupuestal...\n")
        
        # Paso 1: Verificar si la columna ya existe
        print("Paso 1: Verificando si la columna 'anio' ya existe...")
        cursor.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'pdm_ejecucion_presupuestal' 
            AND column_name = 'anio'
        """)
        
        if cursor.fetchone():
            print("✅ La columna 'anio' ya existe - migración no necesaria\n")
            cursor.close()
            conn.close()
            return True
        
        # Paso 2: Agregar columna
        print("Paso 2: Agregando columna 'anio' INTEGER...")
        cursor.execute("""
            ALTER TABLE pdm_ejecucion_presupuestal 
            ADD COLUMN anio INTEGER
        """)
        conn.commit()
        print("✅ Columna agregada\n")
        
        # Paso 3: Crear índice
        print("Paso 3: Creando índice para búsquedas por año...")
        cursor.execute("""
            CREATE INDEX idx_pdm_ejecucion_anio 
            ON pdm_ejecucion_presupuestal(anio)
        """)
        conn.commit()
        print("✅ Índice creado\n")
        
        # Paso 4: Actualizar constraint único
        print("Paso 4: Actualizando constraint único para incluir año...")
        
        # Verificar si existe el constraint antiguo
        cursor.execute("""
            SELECT conname 
            FROM pg_constraint 
            WHERE conname = 'uq_pdm_ejecucion_entity_codigo_fuente'
        """)
        
        if cursor.fetchone():
            cursor.execute("""
                ALTER TABLE pdm_ejecucion_presupuestal 
                DROP CONSTRAINT uq_pdm_ejecucion_entity_codigo_fuente
            """)
            print("   ✅ Constraint antiguo eliminado")
        
        # Crear nuevo constraint
        cursor.execute("""
            ALTER TABLE pdm_ejecucion_presupuestal 
            ADD CONSTRAINT uq_pdm_ejecucion_entity_codigo_fuente_anio 
            UNIQUE (entity_id, codigo_producto, descripcion_fte, anio)
        """)
        conn.commit()
        print("   ✅ Nuevo constraint creado\n")
        
        # Paso 5: Agregar comentario
        print("Paso 5: Agregando comentario a la columna...")
        cursor.execute("""
            COMMENT ON COLUMN pdm_ejecucion_presupuestal.anio 
            IS 'Año fiscal de la ejecución presupuestal'
        """)
        conn.commit()
        print("✅ Comentario agregado\n")
        
        # Paso 6: Verificar resultado
        print("Paso 6: Verificando cambios...")
        cursor.execute("""
            SELECT column_name, data_type, is_nullable 
            FROM information_schema.columns 
            WHERE table_name = 'pdm_ejecucion_presupuestal' 
            AND column_name = 'anio'
        """)
        
        result = cursor.fetchone()
        if result:
            print(f"   ✅ Columna verificada: {result[0]} ({result[1]}) nullable={result[2]}")
        
        # Verificar índice
        cursor.execute("""
            SELECT indexname 
            FROM pg_indexes 
            WHERE tablename = 'pdm_ejecucion_presupuestal' 
            AND indexname = 'idx_pdm_ejecucion_anio'
        """)
        
        if cursor.fetchone():
            print("   ✅ Índice verificado")
        
        # Verificar constraint
        cursor.execute("""
            SELECT conname 
            FROM pg_constraint 
            WHERE conname = 'uq_pdm_ejecucion_entity_codigo_fuente_anio'
        """)
        
        if cursor.fetchone():
            print("   ✅ Constraint verificado\n")
        
        cursor.close()
        conn.close()
        print("✅ Migración completada exitosamente\n")
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
