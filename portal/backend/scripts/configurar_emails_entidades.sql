-- ============================================
-- Script para configurar correos de entidades
-- ============================================

-- Ejemplo 1: Actualizar el correo de una entidad específica
UPDATE entities 
SET email = 'contacto@chiquiza-boyaca.gov.co' 
WHERE code = 'chiquiza-boyaca';

-- Ejemplo 2: Actualizar múltiples entidades
UPDATE entities 
SET email = 'pqrs@tunja-boyaca.gov.co' 
WHERE code = 'tunja-boyaca';

UPDATE entities 
SET email = 'contacto@duitama-boyaca.gov.co' 
WHERE code = 'duitama-boyaca';

-- ============================================
-- Consultar entidades sin correo configurado
-- ============================================
SELECT id, name, code, email 
FROM entities 
WHERE email IS NULL OR email = '';

-- ============================================
-- Ver todas las entidades con sus correos
-- ============================================
SELECT 
    id,
    name,
    code,
    email,
    is_active,
    CASE 
        WHEN email IS NOT NULL AND email != '' THEN '✅ Configurado'
        ELSE '❌ Sin configurar'
    END as estado_email
FROM entities
ORDER BY name;

-- ============================================
-- Formato recomendado para correos @gov.co
-- ============================================

-- Opción 1: contacto@nombre-entidad.gov.co
-- Ejemplo: contacto@chiquiza-boyaca.gov.co

-- Opción 2: pqrs@nombre-entidad.gov.co
-- Ejemplo: pqrs@chiquiza-boyaca.gov.co

-- Opción 3: ventanillaunica@nombre-entidad.gov.co
-- Ejemplo: ventanillaunica@chiquiza-boyaca.gov.co

-- ============================================
-- IMPORTANTE:
-- ============================================
-- 1. TODOS los correos deben estar verificados en AWS SES
-- 2. Si verificas el dominio completo en SES, puedes usar cualquier 
--    correo de ese dominio sin verificación individual
-- 3. El correo de la entidad aparecerá como remitente en los correos
--    enviados a los ciudadanos
