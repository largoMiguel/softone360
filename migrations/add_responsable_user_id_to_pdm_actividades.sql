-- Agregar campo responsable_user_id a la tabla pdm_actividades
-- Este campo vincula la actividad con el usuario responsable

-- Agregar campo responsable_user_id a la tabla pdm_actividades
-- Este campo vincula la actividad con el usuario responsable

-- Agregar columna responsable_user_id si no existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='pdm_actividades' AND column_name='responsable_user_id'
    ) THEN
        ALTER TABLE pdm_actividades 
        ADD COLUMN responsable_user_id INTEGER;
    END IF;
END $$;

-- Agregar constraint de foreign key si no existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name='fk_pdm_actividades_responsable_user'
    ) THEN
        ALTER TABLE pdm_actividades 
        ADD CONSTRAINT fk_pdm_actividades_responsable_user
        FOREIGN KEY (responsable_user_id) 
        REFERENCES users(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Agregar índice para mejorar performance en consultas
CREATE INDEX IF NOT EXISTS idx_pdm_actividades_responsable_user_id 
ON pdm_actividades(responsable_user_id);

-- Comentarios
COMMENT ON COLUMN pdm_actividades.responsable_user_id IS 'ID del usuario responsable de la actividad';
