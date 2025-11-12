-- Migración 007: Limpiar duplicados existentes en ejecución presupuestal
-- Fecha: 2025-11-12
-- Propósito: Eliminar todos los registros duplicados que violan el constraint
--            uq_pdm_ejecucion_entity_codigo_fuente

BEGIN;

-- Paso 1: Verificar cuántos duplicados hay
SELECT COUNT(*) as total_duplicados
FROM (
    SELECT entity_id, codigo_producto, descripcion_fte, COUNT(*) as cnt
    FROM pdm_ejecucion_presupuestal
    GROUP BY entity_id, codigo_producto, descripcion_fte
    HAVING COUNT(*) > 1
) duplicados;

-- Paso 2: Eliminar duplicados manteniendo el registro más reciente (mayor id)
DELETE FROM pdm_ejecucion_presupuestal a
USING pdm_ejecucion_presupuestal b
WHERE a.entity_id = b.entity_id
  AND a.codigo_producto = b.codigo_producto
  AND a.descripcion_fte = b.descripcion_fte
  AND a.id < b.id;

-- Paso 3: Verificar que no quedan duplicados
SELECT entity_id, codigo_producto, descripcion_fte, COUNT(*) as cnt
FROM pdm_ejecucion_presupuestal
GROUP BY entity_id, codigo_producto, descripcion_fte
HAVING COUNT(*) > 1;

COMMIT;

-- Verificación final
SELECT COUNT(*) as total_registros_despues FROM pdm_ejecucion_presupuestal;
