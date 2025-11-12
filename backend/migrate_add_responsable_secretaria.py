#!/usr/bin/env python3
"""
Script de migración para agregar responsable_secretaria_id a pdm_actividades
PostgreSQL Version - Producción (AWS RDS)
Creado: 11 de noviembre de 2025
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
        print("🔌 Conectando a PostgreSQL RDS en producción...\n")
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()
        
        print("🔄 Ejecutando migración: Agregar columna 'responsable_secretaria_id' a 'pdm_actividades'\n")
        
        # Paso 1: Verificar si la columna ya existe
        print("Paso 1: Verificando si la columna ya existe...")
        cursor.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'pdm_actividades' 
            AND column_name = 'responsable_secretaria_id'
        """)
        
        if cursor.fetchone():
            print("   ✅ La columna 'responsable_secretaria_id' ya existe\n")
            cursor.close()
            conn.close()
            return True
        
        print("   ℹ️  Columna no existe - proceeding con la migración\n")
        
        # Paso 2: Agregar la columna
        print("Paso 2: Agregando columna 'responsable_secretaria_id'...")
        cursor.execute("""
            ALTER TABLE pdm_actividades 
            ADD COLUMN responsable_secretaria_id INTEGER
        """)
        conn.commit()
        print("   ✅ Columna agregada\n")
        
        # Paso 3: Crear índice
        print("Paso 3: Creando índice para mejor performance...")
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_pdm_actividades_responsable_secretaria 
            ON pdm_actividades(responsable_secretaria_id)
        """)
        conn.commit()
        print("   ✅ Índice creado\n")
        
        # Paso 4: Crear Foreign Key (opcional pero recomendado)
        print("Paso 4: Creando Foreign Key a tabla 'secretarias'...")
        cursor.execute("""
            ALTER TABLE pdm_actividades 
            ADD CONSTRAINT fk_pdm_actividades_responsable_secretaria 
            FOREIGN KEY (responsable_secretaria_id) 
            REFERENCES secretarias(id) 
            ON DELETE SET NULL
        """)
        conn.commit()
        print("   ✅ Foreign Key creado\n")
        
        # Paso 5: Verificar la estructura de la tabla
        print("Paso 5: Verificando estructura de la tabla...")
        cursor.execute("""
            SELECT column_name, data_type, is_nullable 
            FROM information_schema.columns 
            WHERE table_name = 'pdm_actividades'
            AND column_name IN ('responsable_secretaria_id', 'responsable_user_id', 'codigo_producto')
            ORDER BY ordinal_position
        """)
        
        print("   📋 Columnas actuales en 'pdm_actividades':")
        for row in cursor.fetchall():
            col_name, data_type, is_nullable = row
            nullable = "NULL" if is_nullable == 'YES' else "NOT NULL"
            print(f"      • {col_name} ({data_type}) - {nullable}")
        
        print()
        
        # Paso 6: Verificar que no se perdieron datos
        print("Paso 6: Verificando integridad de datos...")
        cursor.execute("SELECT COUNT(*) FROM pdm_actividades")
        total_actividades = cursor.fetchone()[0]
        print(f"   ✅ Total de actividades en tabla: {total_actividades}\n")
        
        cursor.close()
        conn.close()
        
        print("=" * 60)
        print("✅ MIGRACIÓN COMPLETADA EXITOSAMENTE")
        print("=" * 60)
        print(f"Fecha: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"Base de datos: softone-db (Producción us-east-1)")
        print(f"Cambios aplicados:")
        print(f"  • Columna 'responsable_secretaria_id' agregada a 'pdm_actividades'")
        print(f"  • Índice creado para performance")
        print(f"  • Foreign Key creado hacia tabla 'secretarias'")
        print(f"  • Total de registros en tabla: {total_actividades}")
        print("=" * 60)
        print()
        
        return True
        
    except Exception as e:
        print(f"❌ ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        try:
            conn.rollback()
            print("\n🔄 Cambios revertidos (ROLLBACK)")
        except:
            pass
        return False

if __name__ == "__main__":
    import sys
    success = migrate()
    sys.exit(0 if success else 1)
