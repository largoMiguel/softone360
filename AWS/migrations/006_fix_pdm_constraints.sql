-- Migración 006: Corregir constraints de PDM para soporte multi-entidad
-- Fecha: 2025-11-12
-- Descripción: 
--   1. Eliminar constraint único global en pdm_iniciativas_sgr.consecutivo
--   2. Crear constraint compuesto (entity_id + consecutivo) para permitir mismo consecutivo en diferentes entidades
--   3. Agregar constraint compuesto en pdm_ejecucion_presupuestal para evitar duplicados

BEGIN;

-- ============================================
-- 1. Tabla pdm_iniciativas_sgr
-- ============================================

-- Eliminar el constraint único global en consecutivo
DROP INDEX IF EXISTS ix_pdm_iniciativas_sgr_consecutivo;
ALTER TABLE pdm_iniciativas_sgr DROP CONSTRAINT IF EXISTS ix_pdm_iniciativas_sgr_consecutivo;

-- Crear índice simple (no único) para mejorar búsquedas
CREATE INDEX IF NOT EXISTS idx_pdm_iniciativas_sgr_consecutivo 
ON pdm_iniciativas_sgr(consecutivo);

-- Crear constraint compuesto único (entity_id + consecutivo)
-- Esto permite que diferentes entidades tengan el mismo consecutivo (ej: ISGR-17)
ALTER TABLE pdm_iniciativas_sgr 
ADD CONSTRAINT uq_pdm_iniciativas_sgr_entity_consecutivo 
UNIQUE (entity_id, consecutivo);

-- ============================================
-- 2. Tabla pdm_ejecucion_presupuestal
-- ============================================

-- Primero, eliminar duplicados manteniendo el registro más reciente
DELETE FROM pdm_ejecucion_presupuestal a USING (
    SELECT MIN(id) as id, entity_id, codigo_producto, descripcion_fte
    FROM pdm_ejecucion_presupuestal 
    GROUP BY entity_id, codigo_producto, descripcion_fte
    HAVING COUNT(*) > 1
) b
WHERE a.entity_id = b.entity_id 
  AND a.codigo_producto = b.codigo_producto 
  AND a.descripcion_fte = b.descripcion_fte 
  AND a.id <> b.id;

-- Crear constraint compuesto único (entity_id + codigo_producto + descripcion_fte)
-- Esto evita duplicados de la misma fuente presupuestal para el mismo producto en la misma entidad
ALTER TABLE pdm_ejecucion_presupuestal 
ADD CONSTRAINT uq_pdm_ejecucion_entity_codigo_fuente 
UNIQUE (entity_id, codigo_producto, descripcion_fte);

COMMIT;

-- Verificación
-- SELECT COUNT(*), consecutivo FROM pdm_iniciativas_sgr GROUP BY consecutivo HAVING COUNT(*) > 1;
-- SELECT COUNT(*), entity_id, codigo_producto, descripcion_fte FROM pdm_ejecucion_presupuestal GROUP BY entity_id, codigo_producto, descripcion_fte HAVING COUNT(*) > 1;
