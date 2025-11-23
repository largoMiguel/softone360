"""
Migración 006: Agregar tabla asignacion_auditoria y campos justificacion_asignacion y archivo_respuesta
"""
from app.config.database import engine
from sqlalchemy import text

def run_migration_006():
    migration_sql = """
    -- Migración 006: Historial de asignaciones y campos adicionales
    
    -- Verificar y agregar columna justificacion_asignacion
    DO $$ 
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'pqrs' 
            AND column_name = 'justificacion_asignacion'
        ) THEN
            ALTER TABLE pqrs ADD COLUMN justificacion_asignacion TEXT;
        END IF;
    END $$;
    
    -- Verificar y agregar columna archivo_respuesta
    DO $$ 
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'pqrs' 
            AND column_name = 'archivo_respuesta'
        ) THEN
            ALTER TABLE pqrs ADD COLUMN archivo_respuesta VARCHAR(255);
        END IF;
    END $$;
    
    -- Crear tabla de auditoría de asignaciones
    CREATE TABLE IF NOT EXISTS asignacion_auditoria (
        id SERIAL PRIMARY KEY,
        pqrs_id INTEGER NOT NULL REFERENCES pqrs(id) ON DELETE CASCADE,
        usuario_anterior_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        usuario_nuevo_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        justificacion TEXT,
        fecha_asignacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    
    -- Crear índices para mejorar búsquedas (con manejo de IF NOT EXISTS)
    CREATE INDEX IF NOT EXISTS idx_asignacion_pqrs_id ON asignacion_auditoria(pqrs_id);
    CREATE INDEX IF NOT EXISTS idx_asignacion_fecha ON asignacion_auditoria(fecha_asignacion DESC);
    """
    
    with engine.begin() as connection:
        connection.execute(text(migration_sql))
    
    return {"message": "Migración 006 ejecutada exitosamente"}
