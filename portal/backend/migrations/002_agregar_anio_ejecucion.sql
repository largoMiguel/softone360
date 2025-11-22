-- Migration: Agregar campo 'anio' a pdm_ejecucion_presupuestal
-- Permite filtrar ejecuciones por año y reemplazar datos año por año

-- PostgreSQL
ALTER TABLE pdm_ejecucion_presupuestal 
ADD COLUMN anio INTEGER;

-- Crear índice para búsquedas por año
CREATE INDEX idx_pdm_ejecucion_anio ON pdm_ejecucion_presupuestal(anio);

-- Actualizar constraint para incluir el año (opcional pero recomendado)
-- Esto permite tener múltiples registros del mismo producto/fuente en diferentes años
ALTER TABLE pdm_ejecucion_presupuestal 
DROP CONSTRAINT IF EXISTS uq_pdm_ejecucion_entity_codigo_fuente;

ALTER TABLE pdm_ejecucion_presupuestal 
ADD CONSTRAINT uq_pdm_ejecucion_entity_codigo_fuente_anio 
UNIQUE (entity_id, codigo_producto, descripcion_fte, anio);

-- Comentario para documentación
COMMENT ON COLUMN pdm_ejecucion_presupuestal.anio IS 'Año fiscal de la ejecución presupuestal';
