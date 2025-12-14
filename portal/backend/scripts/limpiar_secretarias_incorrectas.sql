-- Script para limpiar secretarías con nombres de usuario incorrectos
-- Identificar y eliminar secretarías que parecen ser nombres de usuario en lugar de departamentos

-- Ver las secretarías actuales que parecen ser nombres de usuario (contienen punto o son lowercase sin espacios)
SELECT id, entity_id, nombre, is_active 
FROM secretaria 
WHERE nombre LIKE '%.%' 
   OR (nombre = LOWER(nombre) AND nombre NOT LIKE '% %')
ORDER BY entity_id, nombre;

-- NOTA: Revisar los resultados antes de ejecutar el DELETE
-- Si confirmas que son datos incorrectos, ejecuta:

-- Desactivar las secretarías incorrectas (en lugar de eliminarlas para no perder relaciones)
UPDATE secretaria 
SET is_active = false 
WHERE nombre LIKE '%.%' 
   OR (nombre = LOWER(nombre) AND nombre NOT LIKE '% %' AND LENGTH(nombre) < 30);

-- O si prefieres eliminarlas directamente (CUIDADO: verificar que no haya PQRS asignadas):
-- DELETE FROM secretaria 
-- WHERE nombre LIKE '%.%' 
--    OR (nombre = LOWER(nombre) AND nombre NOT LIKE '% %' AND LENGTH(nombre) < 30);

-- Verificar que las secretarías correctas permanezcan activas
SELECT id, entity_id, nombre, is_active 
FROM secretaria 
WHERE is_active = true
ORDER BY entity_id, nombre;
