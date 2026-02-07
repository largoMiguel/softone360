-- Script SQL para limpiar informes de la base de datos

-- Ver todos los informes actuales
SELECT 
    id,
    estado,
    anio,
    formato,
    filename,
    created_at,
    user_id
FROM informes_estado 
ORDER BY created_at DESC;

-- NOTA: Para eliminar todos los informes, descomenta la siguiente línea:
-- DELETE FROM informes_estado;

-- O para eliminar solo los fallidos/pendientes (dejar completados):
-- DELETE FROM informes_estado WHERE estado IN ('failed', 'pending', 'processing');
