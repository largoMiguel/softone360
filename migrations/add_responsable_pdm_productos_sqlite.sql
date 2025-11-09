-- ============================================================
-- Migración: Agregar columnas de responsable a pdm_productos
-- Fecha: 2025-01-08
-- Descripción: Añade responsable_user_id FK y responsable legacy
-- Base de datos: SQLite (Desarrollo local)
-- ============================================================

-- Nota: SQLite tiene limitaciones con ALTER TABLE
-- No soporta ADD CONSTRAINT después de crear la tabla
-- Por lo tanto, agregamos solo las columnas sin el FK inmediatamente

-- Paso 1: Agregar columna responsable (texto legacy)
ALTER TABLE pdm_productos 
ADD COLUMN responsable TEXT;

-- Paso 2: Agregar columna responsable_user_id (FK a users)
ALTER TABLE pdm_productos 
ADD COLUMN responsable_user_id INTEGER 
REFERENCES users(id) ON DELETE SET NULL;

-- Paso 3: Crear índice para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_pdm_productos_responsable_user_id 
ON pdm_productos(responsable_user_id);

-- Verificación
SELECT 
    name,
    type
FROM pragma_table_info('pdm_productos')
WHERE name IN ('responsable', 'responsable_user_id');

-- Lista todas las columnas para confirmar
SELECT sql FROM sqlite_master 
WHERE type='table' AND name='pdm_productos';
