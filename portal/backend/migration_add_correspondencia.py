"""
Migración para crear la tabla de correspondencia
Ejecutar en producción para agregar la tabla y los ENUMs necesarios

python portal/backend/migration_add_correspondencia.py
"""

import psycopg2
from psycopg2 import sql
import os
from datetime import datetime

# Configuración de la base de datos
DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'softone-db.ccvomgoayzyt.us-east-1.rds.amazonaws.com'),
    'port': int(os.getenv('DB_PORT', 5432)),
    'database': os.getenv('DB_NAME', 'postgres'),
    'user': os.getenv('DB_USER', 'dbadmin'),
    'password': os.getenv('DB_PASSWORD', 'TuPassSeguro123!')
}

def run_migration():
    print("\n" + "="*80)
    print("MIGRACIÓN: Agregar tabla de Correspondencia")
    print("="*80 + "\n")
    
    try:
        # Conectar a la base de datos
        print("📡 Conectando a PostgreSQL...")
        conn = psycopg2.connect(**DB_CONFIG)
        cur = conn.cursor()
        print("✅ Conexión exitosa\n")
        
        # 1. Crear ENUMs si no existen
        print("📋 Creando ENUMs de correspondencia...")
        
        # Enum TipoRadicacion
        cur.execute("""
            DO $$ BEGIN
                CREATE TYPE tiporadicacion AS ENUM ('fisico', 'correo');
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        """)
        print("   ✓ TipoRadicacion")
        
        # Enum TipoSolicitudCorrespondencia
        cur.execute("""
            DO $$ BEGIN
                CREATE TYPE tiposolicitudcorrespondencia AS ENUM (
                    'sugerencia', 'peticion', 'queja', 'reclamo', 
                    'felicitacion', 'solicitud_informacion', 'otro'
                );
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        """)
        print("   ✓ TipoSolicitudCorrespondencia")
        
        # Enum EstadoCorrespondencia
        cur.execute("""
            DO $$ BEGIN
                CREATE TYPE estadocorrespondencia AS ENUM (
                    'enviada', 'en_proceso', 'resuelta', 'cerrada'
                );
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        """)
        print("   ✓ EstadoCorrespondencia\n")
        
        # 2. Crear tabla de correspondencia
        print("📋 Creando tabla correspondencia...")
        cur.execute("""
            CREATE TABLE IF NOT EXISTS correspondencia (
                id SERIAL PRIMARY KEY,
                numero_radicado VARCHAR UNIQUE NOT NULL,
                fecha_envio DATE NOT NULL,
                procedencia VARCHAR NOT NULL DEFAULT 'PERSONERIA MUNICIPAL',
                destinacion VARCHAR NOT NULL,
                numero_folios INTEGER NOT NULL DEFAULT 1,
                tipo_radicacion tiporadicacion NOT NULL DEFAULT 'correo',
                correo_electronico VARCHAR,
                direccion_radicacion VARCHAR,
                tipo_solicitud tiposolicitudcorrespondencia NOT NULL,
                archivo_solicitud VARCHAR,
                archivo_respuesta VARCHAR,
                estado estadocorrespondencia NOT NULL DEFAULT 'enviada',
                tiempo_respuesta_dias INTEGER,
                observaciones TEXT,
                respuesta TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE,
                fecha_respuesta TIMESTAMP WITH TIME ZONE,
                created_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                assigned_to_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                entity_id INTEGER NOT NULL REFERENCES entities(id) ON DELETE CASCADE
            );
        """)
        print("   ✓ Tabla correspondencia creada\n")
        
        # 3. Crear índices
        print("📋 Creando índices...")
        cur.execute("""
            CREATE INDEX IF NOT EXISTS idx_correspondencia_radicado 
            ON correspondencia(numero_radicado);
        """)
        print("   ✓ Índice en numero_radicado")
        
        cur.execute("""
            CREATE INDEX IF NOT EXISTS idx_correspondencia_entity 
            ON correspondencia(entity_id);
        """)
        print("   ✓ Índice en entity_id")
        
        cur.execute("""
            CREATE INDEX IF NOT EXISTS idx_correspondencia_estado 
            ON correspondencia(estado);
        """)
        print("   ✓ Índice en estado")
        
        cur.execute("""
            CREATE INDEX IF NOT EXISTS idx_correspondencia_tipo_solicitud 
            ON correspondencia(tipo_solicitud);
        """)
        print("   ✓ Índice en tipo_solicitud")
        
        cur.execute("""
            CREATE INDEX IF NOT EXISTS idx_correspondencia_assigned_to 
            ON correspondencia(assigned_to_id);
        """)
        print("   ✓ Índice en assigned_to_id\n")
        
        # Commit de los cambios
        conn.commit()
        print("✅ Migración completada exitosamente\n")
        
        # Verificar que la tabla se creó correctamente
        cur.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_name = 'correspondencia';
        """)
        if cur.fetchone():
            print("✅ Verificación: Tabla correspondencia existe en la base de datos\n")
        else:
            print("⚠️  Advertencia: No se pudo verificar la tabla\n")
        
        # Cerrar conexión
        cur.close()
        conn.close()
        
        print("="*80)
        print("MIGRACIÓN COMPLETADA")
        print("="*80 + "\n")
        
    except Exception as e:
        print(f"\n❌ ERROR durante la migración: {e}")
        if 'conn' in locals():
            conn.rollback()
            conn.close()
        raise

if __name__ == "__main__":
    run_migration()
