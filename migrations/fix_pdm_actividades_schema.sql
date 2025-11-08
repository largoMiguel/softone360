-- ===================================================================
-- MIGRACIÓN: Corregir esquema de pdm_actividades
-- Fecha: 8 de noviembre de 2025
-- Descripción: 
--   1. Eliminar constraint UNIQUE problemático
--   2. Eliminar columna porcentaje_avance que no existe en frontend
-- ===================================================================

-- SQLite no soporta DROP CONSTRAINT ni DROP COLUMN directamente
-- Necesitamos recrear la tabla sin el constraint y sin la columna

BEGIN TRANSACTION;

-- 1. Crear tabla temporal con el esquema correcto
CREATE TABLE pdm_actividades_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_id INTEGER NOT NULL,
    codigo_indicador_producto VARCHAR(128) NOT NULL,
    nombre VARCHAR(512) NOT NULL,
    descripcion VARCHAR(1024),
    responsable VARCHAR(256),
    fecha_inicio DATETIME,
    fecha_fin DATETIME,
    anio INTEGER,
    meta_ejecutar FLOAT NOT NULL DEFAULT 0.0,
    valor_ejecutado FLOAT NOT NULL DEFAULT 0.0,
    estado VARCHAR(64) NOT NULL DEFAULT 'pendiente',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE CASCADE
);

-- 2. Copiar datos existentes (sin porcentaje_avance)
INSERT INTO pdm_actividades_new (
    id, 
    entity_id, 
    codigo_indicador_producto, 
    nombre, 
    descripcion, 
    responsable, 
    fecha_inicio, 
    fecha_fin, 
    anio, 
    meta_ejecutar, 
    valor_ejecutado, 
    estado, 
    created_at, 
    updated_at
)
SELECT 
    id, 
    entity_id, 
    codigo_indicador_producto, 
    nombre, 
    descripcion, 
    responsable, 
    fecha_inicio, 
    fecha_fin, 
    anio, 
    meta_ejecutar, 
    valor_ejecutado, 
    estado, 
    created_at, 
    updated_at
FROM pdm_actividades;

-- 3. Eliminar tabla antigua
DROP TABLE pdm_actividades;

-- 4. Renombrar tabla nueva
ALTER TABLE pdm_actividades_new RENAME TO pdm_actividades;

-- 5. Recrear índices necesarios (sin el unique constraint problemático)
CREATE INDEX idx_pdm_actividades_entity_id ON pdm_actividades(entity_id);
CREATE INDEX idx_pdm_actividades_codigo ON pdm_actividades(codigo_indicador_producto);
CREATE INDEX idx_pdm_actividades_estado ON pdm_actividades(estado);
CREATE INDEX idx_pdm_actividades_anio ON pdm_actividades(anio);
CREATE INDEX idx_pdm_actividades_entity_codigo ON pdm_actividades(entity_id, codigo_indicador_producto);

-- 6. Verificar que la migración fue exitosa
SELECT 
    'Migración completada exitosamente' as status,
    COUNT(*) as total_actividades
FROM pdm_actividades;

COMMIT;

-- ===================================================================
-- NOTAS IMPORTANTES:
-- ===================================================================
-- 1. Se eliminó el constraint UNIQUE (entity_id, codigo_indicador_producto, nombre)
--    que impedía crear múltiples actividades con el mismo nombre para el mismo producto
-- 2. Se eliminó la columna porcentaje_avance que no existe en el frontend
-- 3. Ahora se pueden crear actividades duplicadas para el mismo producto
--    (esto es correcto ya que pueden ser diferentes tareas con el mismo nombre)
-- 4. Los campos finales coinciden exactamente con el frontend:
--    - id, entity_id, codigo_indicador_producto, nombre, descripcion
--    - responsable, fecha_inicio, fecha_fin, estado
--    - anio, meta_ejecutar, valor_ejecutado
--    - created_at, updated_at
-- ===================================================================
