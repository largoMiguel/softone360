-- ============================================================================
-- SCRIPT DE MIGRACIÓN: Agregar Constraints y Validaciones (SQLite)
-- Sistema: SOFTONE360
-- Fecha: 8 de noviembre de 2025
-- Base de datos: SQLite (backend/pqrs_alcaldia.db)
-- ============================================================================

-- IMPORTANTE: SQLite tiene limitaciones con ALTER TABLE
-- No se pueden agregar constraints CHECK a tablas existentes directamente
-- Este script agrega índices y documenta los constraints para nuevas tablas

BEGIN TRANSACTION;

-- ============================================================================
-- ÍNDICES PARA MEJORAR PERFORMANCE
-- ============================================================================

-- PDM Actividades
CREATE INDEX IF NOT EXISTS idx_pdm_actividades_estado ON pdm_actividades(estado);
CREATE INDEX IF NOT EXISTS idx_pdm_actividades_anio ON pdm_actividades(anio);
CREATE INDEX IF NOT EXISTS idx_pdm_actividades_entity_codigo ON pdm_actividades(entity_id, codigo_indicador_producto);

-- PDM Avances
CREATE INDEX IF NOT EXISTS idx_pdm_avances_anio ON pdm_avances(anio);
CREATE INDEX IF NOT EXISTS idx_pdm_avances_entity_codigo_anio ON pdm_avances(entity_id, codigo_indicador_producto, anio);

-- PDM Ejecuciones
CREATE INDEX IF NOT EXISTS idx_pdm_ejecuciones_actividad ON pdm_actividades_ejecuciones(actividad_id);
CREATE INDEX IF NOT EXISTS idx_pdm_evidencias_ejecucion ON pdm_actividades_evidencias(ejecucion_id);

-- Planes Institucionales
CREATE INDEX IF NOT EXISTS idx_planes_estado ON planes_institucionales(estado);
CREATE INDEX IF NOT EXISTS idx_planes_anio ON planes_institucionales(anio);
CREATE INDEX IF NOT EXISTS idx_planes_entity ON planes_institucionales(entity_id);
CREATE INDEX IF NOT EXISTS idx_planes_fecha_inicio ON planes_institucionales(fecha_inicio);

-- Componentes y Procesos
CREATE INDEX IF NOT EXISTS idx_componentes_plan ON componentes_procesos(plan_id);
CREATE INDEX IF NOT EXISTS idx_componentes_estado ON componentes_procesos(estado);

-- Actividades
CREATE INDEX IF NOT EXISTS idx_actividades_componente ON actividades(componente_id);
CREATE INDEX IF NOT EXISTS idx_actividades_responsable ON actividades(responsable);
CREATE INDEX IF NOT EXISTS idx_actividades_fecha_inicio ON actividades(fecha_inicio_prevista);

-- Actividades de Ejecución
CREATE INDEX IF NOT EXISTS idx_actividades_ejecucion_actividad ON actividades_ejecucion(actividad_id);
CREATE INDEX IF NOT EXISTS idx_actividades_ejecucion_fecha ON actividades_ejecucion(fecha_registro);

-- Evidencias de Actividades
CREATE INDEX IF NOT EXISTS idx_actividades_evidencias_ejecucion ON actividades_evidencias(actividad_ejecucion_id);

-- PQRS
CREATE INDEX IF NOT EXISTS idx_pqrs_estado ON pqrs(estado);
CREATE INDEX IF NOT EXISTS idx_pqrs_tipo_solicitud ON pqrs(tipo_solicitud);
CREATE INDEX IF NOT EXISTS idx_pqrs_entity ON pqrs(entity_id);
CREATE INDEX IF NOT EXISTS idx_pqrs_created_by ON pqrs(created_by_id);
CREATE INDEX IF NOT EXISTS idx_pqrs_assigned_to ON pqrs(assigned_to_id);
CREATE INDEX IF NOT EXISTS idx_pqrs_fecha_solicitud ON pqrs(fecha_solicitud);
CREATE INDEX IF NOT EXISTS idx_pqrs_numero_radicado ON pqrs(numero_radicado);

-- Usuarios
CREATE INDEX IF NOT EXISTS idx_users_entity ON users(entity_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_secretaria ON users(secretaria);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);

-- Secretarías
CREATE INDEX IF NOT EXISTS idx_secretarias_entity ON secretarias(entity_id);
CREATE INDEX IF NOT EXISTS idx_secretarias_is_active ON secretarias(is_active);

-- Alertas
CREATE INDEX IF NOT EXISTS idx_alerts_entity ON alerts(entity_id);
CREATE INDEX IF NOT EXISTS idx_alerts_recipient ON alerts(recipient_user_id);
CREATE INDEX IF NOT EXISTS idx_alerts_read_at ON alerts(read_at);
CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON alerts(created_at);

-- Meta Assignments PDM
CREATE INDEX IF NOT EXISTS idx_pdm_meta_entity_codigo ON pdm_meta_assignments(entity_id, codigo_indicador_producto);

COMMIT;

-- ============================================================================
-- VERIFICACIÓN DE ÍNDICES CREADOS
-- ============================================================================

-- Ver todos los índices creados
SELECT 
    name as index_name,
    tbl_name as table_name,
    sql as definition
FROM sqlite_master 
WHERE type = 'index' 
  AND name LIKE 'idx_%'
ORDER BY tbl_name, name;

-- ============================================================================
-- NOTA IMPORTANTE SOBRE CONSTRAINTS EN SQLITE
-- ============================================================================

-- SQLite NO permite agregar constraints CHECK a tablas existentes con ALTER TABLE.
-- Para agregar constraints CHECK, necesitarías:
-- 1. Crear una nueva tabla con los constraints
-- 2. Copiar los datos
-- 3. Eliminar la tabla antigua
-- 4. Renombrar la nueva tabla

-- Los constraints se validarán a nivel de aplicación (ya implementado en backend)
-- Los índices agregados mejorarán significativamente el performance

-- Para nuevas tablas, usar este template con constraints:
/*
CREATE TABLE IF NOT EXISTS nueva_tabla (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL CHECK(LENGTH(TRIM(nombre)) > 0),
    anio INTEGER CHECK(anio >= 2000 AND anio <= 2100),
    meta_ejecutar REAL CHECK(meta_ejecutar >= 0),
    valor_ejecutado REAL CHECK(valor_ejecutado >= 0 AND valor_ejecutado <= meta_ejecutar),
    estado TEXT CHECK(estado IN ('pendiente', 'en_progreso', 'completada', 'cancelada')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP
);
*/

-- ============================================================================
-- ANÁLISIS DE TABLAS Y REGISTROS
-- ============================================================================

-- Contar registros en tablas principales
SELECT 'pdm_actividades' as tabla, COUNT(*) as registros FROM pdm_actividades
UNION ALL
SELECT 'pdm_avances', COUNT(*) FROM pdm_avances
UNION ALL
SELECT 'planes_institucionales', COUNT(*) FROM planes_institucionales
UNION ALL
SELECT 'componentes_procesos', COUNT(*) FROM componentes_procesos
UNION ALL
SELECT 'actividades', COUNT(*) FROM actividades
UNION ALL
SELECT 'pqrs', COUNT(*) FROM pqrs
UNION ALL
SELECT 'users', COUNT(*) FROM users
UNION ALL
SELECT 'entities', COUNT(*) FROM entities;

-- ============================================================================
-- FIN DEL SCRIPT
-- ============================================================================
