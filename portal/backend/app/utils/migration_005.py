"""
Endpoint temporal para ejecutar migración 005
"""
from app.config.database import engine
from sqlalchemy import text

def run_migration_005():
    migration_sql = """
    -- Migración 005: Agregar campos tipo_persona, genero, dias_respuesta y archivo_adjunto a tabla pqrs
    
    -- Agregar columna tipo_persona (opcional para PQRS anónimas)
    ALTER TABLE pqrs ADD COLUMN IF NOT EXISTS tipo_persona VARCHAR(50);
    
    -- Agregar columna genero (opcional para PQRS anónimas)
    ALTER TABLE pqrs ADD COLUMN IF NOT EXISTS genero VARCHAR(50);
    
    -- Agregar columna dias_respuesta (días para responder, definido manualmente)
    ALTER TABLE pqrs ADD COLUMN IF NOT EXISTS dias_respuesta INTEGER;
    
    -- Agregar columna archivo_adjunto (ruta del archivo PDF escaneado)
    ALTER TABLE pqrs ADD COLUMN IF NOT EXISTS archivo_adjunto VARCHAR(255);
    
    -- Crear índices para mejorar búsquedas
    CREATE INDEX IF NOT EXISTS idx_pqrs_tipo_persona ON pqrs(tipo_persona);
    CREATE INDEX IF NOT EXISTS idx_pqrs_genero ON pqrs(genero);
    """
    
    with engine.begin() as connection:
        for statement in migration_sql.split(';'):
            statement = statement.strip()
            if statement and not statement.startswith('--'):
                connection.execute(text(statement))
    
    return {"message": "Migración 005 ejecutada exitosamente"}
