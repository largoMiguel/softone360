-- Migración: Unificación de Actividades y Evidencias en PDM
-- Descripción: Esta migración asegura que las tablas pdm_actividades y pdm_actividades_evidencias
--              estén correctamente configuradas para el flujo unificado de creación de actividades con evidencia opcional.
--              La evidencia ahora puede registrarse al crear la actividad o posteriormente.
-- Fecha: 2025

-- ==============================================
-- 1. Verificar y crear tabla pdm_actividades si no existe
-- ==============================================
CREATE TABLE IF NOT EXISTS pdm_actividades (
    id SERIAL PRIMARY KEY,
    entity_id INTEGER NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    codigo_producto VARCHAR(128) NOT NULL,
    anio INTEGER NOT NULL,
    nombre VARCHAR(512) NOT NULL,
    descripcion TEXT,
    responsable_secretaria_id INTEGER REFERENCES secretarias(id) ON DELETE SET NULL,
    fecha_inicio TIMESTAMP,
    fecha_fin TIMESTAMP,
    meta_ejecutar FLOAT NOT NULL DEFAULT 0.0,
    estado VARCHAR(64) NOT NULL DEFAULT 'PENDIENTE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE
);

-- Índices para pdm_actividades
CREATE INDEX IF NOT EXISTS idx_pdm_actividades_entity ON pdm_actividades(entity_id);
CREATE INDEX IF NOT EXISTS idx_pdm_actividades_codigo ON pdm_actividades(codigo_producto);
CREATE INDEX IF NOT EXISTS idx_pdm_actividades_anio ON pdm_actividades(anio);
CREATE INDEX IF NOT EXISTS idx_pdm_actividades_responsable ON pdm_actividades(responsable_secretaria_id);

-- ==============================================
-- 2. Verificar y crear tabla pdm_actividades_evidencias si no existe
-- ==============================================
CREATE TABLE IF NOT EXISTS pdm_actividades_evidencias (
    id SERIAL PRIMARY KEY,
    actividad_id INTEGER NOT NULL UNIQUE REFERENCES pdm_actividades(id) ON DELETE CASCADE,
    entity_id INTEGER NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    descripcion TEXT NOT NULL,
    url_evidencia VARCHAR(1024),
    imagenes JSON,
    fecha_registro TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE
);

-- Índices para pdm_actividades_evidencias
CREATE INDEX IF NOT EXISTS idx_pdm_evidencias_actividad ON pdm_actividades_evidencias(actividad_id);
CREATE INDEX IF NOT EXISTS idx_pdm_evidencias_entity ON pdm_actividades_evidencias(entity_id);

-- ==============================================
-- 3. Asegurar valores válidos para el campo estado
-- ==============================================
-- Comentario: Los valores permitidos son: PENDIENTE, EN_PROGRESO, COMPLETADA, CANCELADA
-- No usamos CHECK constraint para mantener flexibilidad con SQLite/PostgreSQL

-- ==============================================
-- 4. Migración de datos (si existieran tablas antiguas)
-- ==============================================
-- Si existía una tabla separada de evidencias sin relación 1:1, migrar aquí
-- (En este caso, el diseño ya estaba correcto desde el inicio)

-- ==============================================
-- 5. Trigger para actualizar updated_at automáticamente (solo PostgreSQL)
-- ==============================================
-- Función para actualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para pdm_actividades
DROP TRIGGER IF EXISTS trigger_update_pdm_actividades ON pdm_actividades;
CREATE TRIGGER trigger_update_pdm_actividades
    BEFORE UPDATE ON pdm_actividades
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger para pdm_actividades_evidencias
DROP TRIGGER IF EXISTS trigger_update_pdm_evidencias ON pdm_actividades_evidencias;
CREATE TRIGGER trigger_update_pdm_evidencias
    BEFORE UPDATE ON pdm_actividades_evidencias
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ==============================================
-- 6. Comentarios sobre lógica de negocio
-- ==============================================
COMMENT ON TABLE pdm_actividades IS 'Actividades del PDM asociadas a productos por año. El estado COMPLETADA se asigna automáticamente cuando se registra evidencia.';
COMMENT ON TABLE pdm_actividades_evidencias IS 'Evidencias de cumplimiento de actividades (1:1). La evidencia puede registrarse al crear la actividad o posteriormente.';
COMMENT ON COLUMN pdm_actividades.estado IS 'Estados: PENDIENTE (inicial), EN_PROGRESO (en ejecución), COMPLETADA (con evidencia), CANCELADA (no se realizará)';
COMMENT ON COLUMN pdm_actividades.responsable_secretaria_id IS 'Secretaría responsable de ejecutar la actividad. Permite NULL para actividades sin asignar.';

-- ==============================================
-- FIN DE MIGRACIÓN
-- ==============================================
