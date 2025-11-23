-- Actualizar el email de la entidad Chiquiza
-- Ejecuta esto en tu base de datos RDS

-- Ver entidades actuales y sus correos
SELECT id, name, code, email, is_active 
FROM entities
ORDER BY id;

-- Actualizar el email de la entidad
UPDATE entities 
SET email = 'sistemas@chiquiza-boyaca.gov.co' 
WHERE code LIKE '%chiquiza%' OR name LIKE '%Chiquiza%';

-- Verificar el cambio
SELECT id, name, code, email 
FROM entities 
WHERE code LIKE '%chiquiza%' OR name LIKE '%Chiquiza%';
