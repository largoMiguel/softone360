-- Migración: Unificación de Actividades y Evidencias en PDM (SQLite)
-- Descripción: Versión SQLite de la migración para desarrollo local
-- Fecha: 2025

-- ==============================================
-- 1. Tabla pdm_actividades
-- ==============================================
CREATE TABLE IF NOT EXISTS pdm_actividades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_id INTEGER NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    codigo_producto VARCHAR(128) NOT NULL,
    anio INTEGER NOT NULL,
    nombre VARCHAR(512) NOT NULL,
    descripcion TEXT,
    responsable_secretaria_id INTEGER REFERENCES secretarias(id) ON DELETE SET NULL,
    fecha_inicio DATETIME,
    fecha_fin DATETIME,
    meta_ejecutar REAL NOT NULL DEFAULT 0.0,
    estado VARCHAR(64) NOT NULL DEFAULT 'PENDIENTE',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME
);

-- Índices para pdm_actividades
CREATE INDEX IF NOT EXISTS idx_pdm_actividades_entity ON pdm_actividades(entity_id);
CREATE INDEX IF NOT EXISTS idx_pdm_actividades_codigo ON pdm_actividades(codigo_producto);
CREATE INDEX IF NOT EXISTS idx_pdm_actividades_anio ON pdm_actividades(anio);
CREATE INDEX IF NOT EXISTS idx_pdm_actividades_responsable ON pdm_actividades(responsable_secretaria_id);

-- ==============================================
-- 2. Tabla pdm_actividades_evidencias
-- ==============================================
CREATE TABLE IF NOT EXISTS pdm_actividades_evidencias (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    actividad_id INTEGER NOT NULL UNIQUE REFERENCES pdm_actividades(id) ON DELETE CASCADE,
    entity_id INTEGER NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    descripcion TEXT NOT NULL,
    url_evidencia VARCHAR(1024),
    imagenes TEXT,
    fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME
);

-- Índices para pdm_actividades_evidencias
CREATE INDEX IF NOT EXISTS idx_pdm_evidencias_actividad ON pdm_actividades_evidencias(actividad_id);
CREATE INDEX IF NOT EXISTS idx_pdm_evidencias_entity ON pdm_actividades_evidencias(entity_id);

-- ==============================================
-- 3. Triggers para updated_at (SQLite)
-- ==============================================
-- Trigger para pdm_actividades
DROP TRIGGER IF EXISTS trigger_update_pdm_actividades;
CREATE TRIGGER trigger_update_pdm_actividades
    AFTER UPDATE ON pdm_actividades
    FOR EACH ROW
    BEGIN
        UPDATE pdm_actividades SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

-- Trigger para pdm_actividades_evidencias
DROP TRIGGER IF EXISTS trigger_update_pdm_evidencias;
CREATE TRIGGER trigger_update_pdm_evidencias
    AFTER UPDATE ON pdm_actividades_evidencias
    FOR EACH ROW
    BEGIN
        UPDATE pdm_actividades_evidencias SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

-- ==============================================
-- FIN DE MIGRACIÓN SQLite
-- ==============================================
