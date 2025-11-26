"""
Script de migración para crear tabla pdm_ejecucion_presupuestal
PostgreSQL Version
Creado: 12 de noviembre de 2025
Descripción: Tabla para almacenar ejecución presupuestal de productos PDM
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
        
        print("🔄 Ejecutando migración: Crear tabla pdm_ejecucion_presupuestal...\n")
        
        # Verificar si la tabla ya existe
        cursor.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'pdm_ejecucion_presupuestal'
            )
        """)
        
        if cursor.fetchone()[0]:
            print("✅ La tabla 'pdm_ejecucion_presupuestal' ya existe\n")
            
            # Verificar columnas existentes
            cursor.execute("""
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = 'pdm_ejecucion_presupuestal' 
                ORDER BY ordinal_position
            """)
            
            columnas = cursor.fetchall()
            print("📋 Columnas actuales en la tabla:")
            for col in columnas:
                print(f"   • {col[0]} ({col[1]})")

            # Asegurar columna 'anio' si no existe
            has_anio = any(col[0] == 'anio' for col in columnas)
            if not has_anio:
                print("🔨 Agregando columna faltante 'anio' (INTEGER)...")
                cursor.execute("""
                    ALTER TABLE pdm_ejecucion_presupuestal
                    ADD COLUMN anio INTEGER;
                """)
                conn.commit()
                print("   ✅ Columna 'anio' agregada\n")

            # Asegurar índice por 'anio'
            try:
                cursor.execute("""
                    CREATE INDEX IF NOT EXISTS idx_pdm_ejecucion_anio
                    ON pdm_ejecucion_presupuestal(anio)
                """)
                conn.commit()
                print("   ✅ Índice en 'anio' creado")
            except Exception as e:
                print(f"   ⚠️ No se pudo crear índice en 'anio': {e}")
            
            cursor.close()
            conn.close()
            return True
        
        # Crear la tabla
        print("🔨 Creando tabla pdm_ejecucion_presupuestal...")
        cursor.execute("""
            CREATE TABLE pdm_ejecucion_presupuestal (
                id SERIAL PRIMARY KEY,
                codigo_producto VARCHAR(20) NOT NULL,
                descripcion_fte VARCHAR(500) NOT NULL,
                pto_inicial NUMERIC(18, 2) DEFAULT 0,
                adicion NUMERIC(18, 2) DEFAULT 0,
                reduccion NUMERIC(18, 2) DEFAULT 0,
                credito NUMERIC(18, 2) DEFAULT 0,
                contracredito NUMERIC(18, 2) DEFAULT 0,
                pto_definitivo NUMERIC(18, 2) DEFAULT 0,
                pagos NUMERIC(18, 2) DEFAULT 0,
                entity_id INTEGER NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                sector VARCHAR(100),
                dependencia VARCHAR(200),
                bpin VARCHAR(50),
                anio INTEGER,
                CONSTRAINT fk_pdm_ejecucion_entity 
                    FOREIGN KEY (entity_id) 
                    REFERENCES entities(id) 
                    ON DELETE CASCADE
            )
        """)
        conn.commit()
        print("   ✅ Tabla creada\n")
        
        # Crear índices
        print("🔨 Creando índices...")
        
        # Índice en codigo_producto
        cursor.execute("""
            CREATE INDEX idx_pdm_ejecucion_codigo_producto 
            ON pdm_ejecucion_presupuestal(codigo_producto)
        """)
        print("   ✅ Índice en codigo_producto creado")
        
        # Índice en entity_id
        cursor.execute("""
            CREATE INDEX idx_pdm_ejecucion_entity_id 
            ON pdm_ejecucion_presupuestal(entity_id)
        """)
        print("   ✅ Índice en entity_id creado")
        
        # Índice compuesto
        cursor.execute("""
            CREATE INDEX idx_pdm_ejecucion_codigo_entity 
            ON pdm_ejecucion_presupuestal(codigo_producto, entity_id)
        """)
        print("   ✅ Índice compuesto creado\n")
        
        conn.commit()
        
        # Verificar resultado final
        print("🔍 Verificando estructura final...")
        cursor.execute("""
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns 
            WHERE table_name = 'pdm_ejecucion_presupuestal' 
            ORDER BY ordinal_position
        """)
        
        columnas = cursor.fetchall()
        print("\n📋 Columnas creadas:")
        for col in columnas:
            nullable = "NULL" if col[2] == 'YES' else "NOT NULL"
            print(f"   • {col[0]:20} {col[1]:20} {nullable}")
        
        # Verificar índices
        cursor.execute("""
            SELECT indexname 
            FROM pg_indexes 
            WHERE tablename = 'pdm_ejecucion_presupuestal'
        """)
        
        indices = cursor.fetchall()
        print("\n📋 Índices creados:")
        for idx in indices:
            print(f"   • {idx[0]}")
        
        # Verificar foreign key
        cursor.execute("""
            SELECT conname 
            FROM pg_constraint 
            WHERE conrelid = 'pdm_ejecucion_presupuestal'::regclass 
            AND contype = 'f'
        """)
        
        fks = cursor.fetchall()
        print("\n📋 Foreign Keys:")
        for fk in fks:
            print(f"   • {fk[0]}")
        
        cursor.close()
        conn.close()
        
        print("\n✅ Migración completada exitosamente\n")
        return True
        
    except Exception as e:
        print(f"\n❌ ERROR: {str(e)}\n")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    import sys
    success = migrate()
    sys.exit(0 if success else 1)
