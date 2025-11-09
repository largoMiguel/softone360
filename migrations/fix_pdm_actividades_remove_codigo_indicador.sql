-- Migración: Eliminar columna codigo_indicador_producto de pdm_actividades
-- Fecha: 2025-11-09
-- Razón: La columna no existe en el modelo actual y causa errores NOT NULL

-- Para PostgreSQL (Producción)
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

-- Verificar la estructura final
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'pdm_actividades' 
ORDER BY ordinal_position;
