-- ============================================================================
-- MIGRACIÓN PDM V2
-- Sistema: SOFTONE360
-- Fecha: 8 de noviembre de 2025
-- Descripción: Migración de PDM antiguo a PDM V2 con nueva estructura
-- ============================================================================

-- IMPORTANTE: Hacer backup completo antes de ejecutar
-- pg_dump -h HOST -U USER -d softone_db > backup_$(date +%Y%m%d_%H%M%S).sql

BEGIN;

-- ============================================================================
-- PASO 1: ELIMINAR TABLAS ANTIGUAS DEL PDM
-- ============================================================================

DROP TABLE IF EXISTS pdm_actividades_evidencias CASCADE;
DROP TABLE IF EXISTS pdm_actividades_ejecuciones CASCADE;
DROP TABLE IF EXISTS pdm_actividades CASCADE;
DROP TABLE IF EXISTS pdm_avances CASCADE;
DROP TABLE IF EXISTS pdm_meta_assignments CASCADE;
DROP TABLE IF EXISTS pdm_archivos_excel CASCADE;

-- ============================================================================
-- PASO 2: CREAR NUEVAS TABLAS PDM V2
-- ============================================================================

-- Tabla: pdm_lineas_estrategicas
CREATE TABLE IF NOT EXISTS pdm_lineas_estrategicas (
    id SERIAL PRIMARY KEY,
    entity_id INTEGER NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    linea_estrategica VARCHAR(500) NOT NULL,
    sector VARCHAR(300),
    programa_mga VARCHAR(300),
    ods VARCHAR(200),
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(entity_id, linea_estrategica)
);

CREATE INDEX idx_pdm_lineas_entity ON pdm_lineas_estrategicas(entity_id);

COMMENT ON TABLE pdm_lineas_estrategicas IS 'Líneas estratégicas del Plan de Desarrollo Municipal';
COMMENT ON COLUMN pdm_lineas_estrategicas.linea_estrategica IS 'Nombre de la línea estratégica';
COMMENT ON COLUMN pdm_lineas_estrategicas.sector IS 'Sector al que pertenece';
COMMENT ON COLUMN pdm_lineas_estrategicas.programa_mga IS 'Programa MGA asociado';
COMMENT ON COLUMN pdm_lineas_estrategicas.ods IS 'Objetivos de Desarrollo Sostenible relacionados';

-- Tabla: pdm_indicadores_resultado
CREATE TABLE IF NOT EXISTS pdm_indicadores_resultado (
    id SERIAL PRIMARY KEY,
    entity_id INTEGER NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    linea_estrategica_id INTEGER NOT NULL REFERENCES pdm_lineas_estrategicas(id) ON DELETE CASCADE,
    indicador_resultado TEXT NOT NULL,
    unidad_medida VARCHAR(100),
    linea_base DECIMAL(15,2),
    meta_cuatrienio DECIMAL(15,2),
    meta_2024 DECIMAL(15,2),
    meta_2025 DECIMAL(15,2),
    meta_2026 DECIMAL(15,2),
    meta_2027 DECIMAL(15,2),
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_pdm_indicadores_entity ON pdm_indicadores_resultado(entity_id);
CREATE INDEX idx_pdm_indicadores_linea ON pdm_indicadores_resultado(linea_estrategica_id);

COMMENT ON TABLE pdm_indicadores_resultado IS 'Indicadores de resultado del PDM';

-- Tabla: pdm_iniciativas_sgr
CREATE TABLE IF NOT EXISTS pdm_iniciativas_sgr (
    id SERIAL PRIMARY KEY,
    entity_id INTEGER NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    linea_estrategica_id INTEGER NOT NULL REFERENCES pdm_lineas_estrategicas(id) ON DELETE CASCADE,
    nombre_proyecto TEXT NOT NULL,
    bpin VARCHAR(50),
    tipo_proyecto VARCHAR(100),
    fase VARCHAR(100),
    valor_total DECIMAL(18,2),
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_pdm_iniciativas_entity ON pdm_iniciativas_sgr(entity_id);
CREATE INDEX idx_pdm_iniciativas_linea ON pdm_iniciativas_sgr(linea_estrategica_id);
CREATE INDEX idx_pdm_iniciativas_bpin ON pdm_iniciativas_sgr(bpin);

COMMENT ON TABLE pdm_iniciativas_sgr IS 'Iniciativas del Sistema General de Regalías';

-- Tabla: pdm_productos
CREATE TABLE IF NOT EXISTS pdm_productos (
    id SERIAL PRIMARY KEY,
    entity_id INTEGER NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    linea_estrategica_id INTEGER NOT NULL REFERENCES pdm_lineas_estrategicas(id) ON DELETE CASCADE,
    codigo VARCHAR(100) NOT NULL,
    producto TEXT NOT NULL,
    bpin VARCHAR(50),
    unidad_medida VARCHAR(100),
    tipo_acumulacion VARCHAR(50),
    
    -- Metas
    meta_cuatrienio DECIMAL(15,2),
    programacion_2024 DECIMAL(15,2),
    programacion_2025 DECIMAL(15,2),
    programacion_2026 DECIMAL(15,2),
    programacion_2027 DECIMAL(15,2),
    
    -- Presupuesto
    presupuesto_2024 DECIMAL(18,2),
    presupuesto_2025 DECIMAL(18,2),
    presupuesto_2026 DECIMAL(18,2),
    presupuesto_2027 DECIMAL(18,2),
    
    -- Totales
    total_2024 DECIMAL(18,2),
    total_2025 DECIMAL(18,2),
    total_2026 DECIMAL(18,2),
    total_2027 DECIMAL(18,2),
    total_cuatrienio DECIMAL(18,2),
    
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(entity_id, codigo)
);

CREATE INDEX idx_pdm_productos_entity ON pdm_productos(entity_id);
CREATE INDEX idx_pdm_productos_linea ON pdm_productos(linea_estrategica_id);
CREATE INDEX idx_pdm_productos_codigo ON pdm_productos(codigo);
CREATE INDEX idx_pdm_productos_bpin ON pdm_productos(bpin);

COMMENT ON TABLE pdm_productos IS 'Productos del Plan Indicativo del PDM';
COMMENT ON COLUMN pdm_productos.codigo IS 'Código único del producto';
COMMENT ON COLUMN pdm_productos.tipo_acumulacion IS 'Tipo de acumulación de la meta (acumulado, no_acumulado)';

-- Tabla: pdm_actividades
CREATE TABLE IF NOT EXISTS pdm_actividades (
    id SERIAL PRIMARY KEY,
    entity_id INTEGER NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    producto_id INTEGER NOT NULL REFERENCES pdm_productos(id) ON DELETE CASCADE,
    producto_codigo VARCHAR(100) NOT NULL,
    
    nombre TEXT NOT NULL,
    descripcion TEXT,
    responsable VARCHAR(300),
    anio INTEGER NOT NULL,
    trimestre INTEGER,
    
    -- Metas
    meta_programada DECIMAL(15,2),
    meta_ejecutada DECIMAL(15,2) DEFAULT 0,
    
    -- Estado
    estado VARCHAR(50) DEFAULT 'PENDIENTE',
    porcentaje_avance DECIMAL(5,2) DEFAULT 0,
    
    -- Fechas
    fecha_inicio DATE,
    fecha_fin DATE,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT check_pdm_actividad_anio CHECK (anio BETWEEN 2024 AND 2027),
    CONSTRAINT check_pdm_actividad_trimestre CHECK (trimestre BETWEEN 1 AND 4),
    CONSTRAINT check_pdm_actividad_estado CHECK (estado IN ('PENDIENTE', 'EN_PROGRESO', 'COMPLETADA', 'CANCELADA')),
    CONSTRAINT check_pdm_actividad_meta_positiva CHECK (meta_programada >= 0),
    CONSTRAINT check_pdm_actividad_meta_ejecutada_positiva CHECK (meta_ejecutada >= 0),
    CONSTRAINT check_pdm_actividad_porcentaje CHECK (porcentaje_avance BETWEEN 0 AND 100)
);

CREATE INDEX idx_pdm_actividades_entity ON pdm_actividades(entity_id);
CREATE INDEX idx_pdm_actividades_producto ON pdm_actividades(producto_id);
CREATE INDEX idx_pdm_actividades_codigo ON pdm_actividades(producto_codigo);
CREATE INDEX idx_pdm_actividades_anio ON pdm_actividades(anio);
CREATE INDEX idx_pdm_actividades_estado ON pdm_actividades(estado);
CREATE INDEX idx_pdm_actividades_responsable ON pdm_actividades(responsable);

COMMENT ON TABLE pdm_actividades IS 'Actividades asociadas a productos del PDM';
COMMENT ON COLUMN pdm_actividades.estado IS 'PENDIENTE, EN_PROGRESO, COMPLETADA, CANCELADA';

-- Tabla: pdm_actividades_evidencias
CREATE TABLE IF NOT EXISTS pdm_actividades_evidencias (
    id SERIAL PRIMARY KEY,
    actividad_id INTEGER NOT NULL REFERENCES pdm_actividades(id) ON DELETE CASCADE,
    
    tipo_evidencia VARCHAR(50) NOT NULL,
    url_archivo TEXT,
    descripcion TEXT,
    nombre_archivo VARCHAR(500),
    
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    registrado_por INTEGER REFERENCES users(id),
    
    CONSTRAINT check_pdm_evidencia_tipo CHECK (tipo_evidencia IN ('imagen', 'documento', 'url', 'otro'))
);

CREATE INDEX idx_pdm_evidencias_actividad ON pdm_actividades_evidencias(actividad_id);
CREATE INDEX idx_pdm_evidencias_fecha ON pdm_actividades_evidencias(fecha_registro DESC);

COMMENT ON TABLE pdm_actividades_evidencias IS 'Evidencias de ejecución de actividades del PDM';

-- ============================================================================
-- PASO 3: APLICAR CONSTRAINTS ADICIONALES
-- ============================================================================

-- Validar coherencia de fechas en actividades
ALTER TABLE pdm_actividades
ADD CONSTRAINT IF NOT EXISTS check_pdm_actividades_fechas_coherentes
CHECK (fecha_inicio IS NULL OR fecha_fin IS NULL OR fecha_inicio <= fecha_fin);

-- Validar que meta ejecutada no exceda meta programada
ALTER TABLE pdm_actividades
ADD CONSTRAINT IF NOT EXISTS check_pdm_actividades_meta_no_excede
CHECK (meta_ejecutada <= meta_programada);

-- Validar que el nombre no esté vacío
ALTER TABLE pdm_actividades
ADD CONSTRAINT IF NOT EXISTS check_pdm_actividades_nombre_not_empty
CHECK (LENGTH(TRIM(nombre)) > 0);

-- ============================================================================
-- PASO 4: CREAR FUNCIÓN PARA ACTUALIZAR fecha_actualizacion
-- ============================================================================

CREATE OR REPLACE FUNCTION update_pdm_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.fecha_actualizacion = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger a todas las tablas PDM
DROP TRIGGER IF EXISTS trigger_pdm_lineas_updated_at ON pdm_lineas_estrategicas;
CREATE TRIGGER trigger_pdm_lineas_updated_at
    BEFORE UPDATE ON pdm_lineas_estrategicas
    FOR EACH ROW
    EXECUTE FUNCTION update_pdm_updated_at();

DROP TRIGGER IF EXISTS trigger_pdm_indicadores_updated_at ON pdm_indicadores_resultado;
CREATE TRIGGER trigger_pdm_indicadores_updated_at
    BEFORE UPDATE ON pdm_indicadores_resultado
    FOR EACH ROW
    EXECUTE FUNCTION update_pdm_updated_at();

DROP TRIGGER IF EXISTS trigger_pdm_iniciativas_updated_at ON pdm_iniciativas_sgr;
CREATE TRIGGER trigger_pdm_iniciativas_updated_at
    BEFORE UPDATE ON pdm_iniciativas_sgr
    FOR EACH ROW
    EXECUTE FUNCTION update_pdm_updated_at();

DROP TRIGGER IF EXISTS trigger_pdm_productos_updated_at ON pdm_productos;
CREATE TRIGGER trigger_pdm_productos_updated_at
    BEFORE UPDATE ON pdm_productos
    FOR EACH ROW
    EXECUTE FUNCTION update_pdm_updated_at();

DROP TRIGGER IF EXISTS trigger_pdm_actividades_updated_at ON pdm_actividades;
CREATE TRIGGER trigger_pdm_actividades_updated_at
    BEFORE UPDATE ON pdm_actividades
    FOR EACH ROW
    EXECUTE FUNCTION update_pdm_updated_at();

-- ============================================================================
-- COMMIT
-- ============================================================================

COMMIT;

-- ============================================================================
-- VERIFICACIÓN POST-MIGRACIÓN
-- ============================================================================

-- Verificar que las tablas se crearon correctamente
SELECT 
    table_name,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
  AND table_name LIKE 'pdm_%'
ORDER BY table_name;

-- Verificar constraints
SELECT
    tc.table_name,
    tc.constraint_name,
    tc.constraint_type
FROM information_schema.table_constraints tc
WHERE tc.table_schema = 'public'
  AND tc.table_name LIKE 'pdm_%'
ORDER BY tc.table_name, tc.constraint_type, tc.constraint_name;

-- Verificar índices
SELECT
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename LIKE 'pdm_%'
ORDER BY tablename, indexname;

-- ============================================================================
-- NOTAS
-- ============================================================================

-- 1. Este script elimina completamente las tablas antiguas del PDM
-- 2. Crea la nueva estructura PDM V2 desde cero
-- 3. No migra datos antiguos (si se necesita, crear script separado)
-- 4. Asegurarse de tener backup antes de ejecutar en producción
-- 5. El frontend y backend deben estar actualizados para usar PDM V2

-- ============================================================================
-- ROLLBACK EN CASO DE ERROR
-- ============================================================================

-- Si algo falla durante la ejecución, el BEGIN/COMMIT hará rollback automático
-- Para rollback manual:
-- ROLLBACK;

