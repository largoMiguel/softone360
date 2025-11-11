"""
Script de migración para cambiar responsable de usuario a secretaría en PDM
PostgreSQL Version
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
    try:
        print("🔌 Conectando a PostgreSQL RDS...\n")
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()
        
        print("🔄 Ejecutando migración: Cambiar responsable de usuario a secretaría en PDM...\n")
        
        # Verificar si la tabla existe
        cursor.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'pdm_productos'
            )
        """)
        
        if not cursor.fetchone()[0]:
            print("✅ Tabla pdm_productos no existe - migración no necesaria")
            cursor.close()
            conn.close()
            return True
        
        # Verificar si la columna responsable_secretaria_id ya existe
        cursor.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'pdm_productos' 
            AND column_name = 'responsable_secretaria_id'
        """)
        
        if cursor.fetchone():
            print("✅ Las columnas de secretaría ya existen")
            cursor.close()
            conn.close()
            return True
        
        print("📝 Agregando columnas de secretaría...\n")
        
        # Agregar las nuevas columnas
        try:
            cursor.execute("ALTER TABLE pdm_productos ADD COLUMN responsable_secretaria_id INTEGER")
            print("   ✅ Columna 'responsable_secretaria_id' agregada")
        except Exception as e:
            print(f"   ⚠️ Error agregando responsable_secretaria_id: {e}")
        
        try:
            cursor.execute("ALTER TABLE pdm_productos ADD COLUMN responsable_secretaria_nombre VARCHAR(256)")
            print("   ✅ Columna 'responsable_secretaria_nombre' agregada")
        except Exception as e:
            print(f"   ⚠️ Error agregando responsable_secretaria_nombre: {e}")
        
        conn.commit()
        
        # Agregar constraint de FK (PostgreSQL permite esto directamente)
        print("\n📝 Agregando constraint de clave foránea...\n")
        try:
            cursor.execute("""
                ALTER TABLE pdm_productos 
                ADD CONSTRAINT fk_pdm_productos_secretaria 
                FOREIGN KEY (responsable_secretaria_id) 
                REFERENCES secretarias(id) 
                ON DELETE SET NULL
            """)
            conn.commit()
            print("   ✅ Constraint de FK agregado correctamente")
        except Exception as e:
            print(f"   ⚠️ Error al agregar FK (puede ser que no exista tabla secretarias): {e}")
            conn.rollback()
        
        # Crear índice para mejor performance
        print("\n📝 Creando índice...\n")
        try:
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_pdm_productos_responsable_secretaria_id 
                ON pdm_productos(responsable_secretaria_id)
            """)
            conn.commit()
            print("   ✅ Índice creado")
        except Exception as e:
            print(f"   ⚠️ Error al crear índice: {e}")
        
        print("\n✅ Migración completada\n")
        
        # Listar columnas de pdm_productos
        print("📋 Columnas actuales en 'pdm_productos':")
        cursor.execute("""
            SELECT column_name, data_type, character_maximum_length
            FROM information_schema.columns 
            WHERE table_name = 'pdm_productos'
            ORDER BY ordinal_position
        """)
        for row in cursor.fetchall():
            length = f"({row[2]})" if row[2] else ""
            print(f"   • {row[0]} ({row[1]}{length})")
        
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
