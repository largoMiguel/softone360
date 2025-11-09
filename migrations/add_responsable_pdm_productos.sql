-- ============================================================
-- Migración: Agregar columnas de responsable a pdm_productos
-- Fecha: 2025-01-08
-- Descripción: Añade responsable_user_id FK y responsable legacy
-- Base de datos: PostgreSQL (Producción AWS RDS)
-- ============================================================

-- Paso 1: Agregar columna responsable (texto legacy)
ALTER TABLE pdm_productos 
ADD COLUMN IF NOT EXISTS responsable VARCHAR(256);

-- Paso 2: Agregar columna responsable_user_id (FK a users)
ALTER TABLE pdm_productos 
ADD COLUMN IF NOT EXISTS responsable_user_id INTEGER;

-- Paso 3: Crear índice para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_pdm_productos_responsable_user_id 
ON pdm_productos(responsable_user_id);

-- Paso 4: Agregar constraint de foreign key
ALTER TABLE pdm_productos 
ADD CONSTRAINT fk_pdm_productos_responsable_user 
FOREIGN KEY (responsable_user_id) 
REFERENCES users(id) 
ON DELETE SET NULL;

-- Verificación
SELECT 
    column_name, 
    data_type, 
    is_nullable 
FROM information_schema.columns 
WHERE table_name = 'pdm_productos' 
AND column_name IN ('responsable', 'responsable_user_id')
ORDER BY column_name;
