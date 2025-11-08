-- ============================================================================
-- SCRIPT DE MIGRACIÓN: Agregar Constraints y Validaciones
-- Sistema: SOFTONE360
-- Fecha: 8 de noviembre de 2025
-- Descripción: Agrega constraints a nivel de base de datos para prevenir datos inválidos
-- ============================================================================

-- IMPORTANTE: Hacer backup antes de ejecutar este script
-- IMPORTANTE: Ejecutar en entorno de desarrollo primero

BEGIN;

-- ============================================================================
-- 1. PDM - Tabla pdm_actividades
-- ============================================================================

-- Validar que meta_ejecutar sea no negativa
ALTER TABLE pdm_actividades
ADD CONSTRAINT IF NOT EXISTS check_meta_ejecutar_positive 
CHECK (meta_ejecutar >= 0);

-- Validar que valor_ejecutado sea no negativo
ALTER TABLE pdm_actividades
ADD CONSTRAINT IF NOT EXISTS check_valor_ejecutado_positive 
CHECK (valor_ejecutado >= 0);

-- Validar que valor_ejecutado no exceda meta_ejecutar
ALTER TABLE pdm_actividades
ADD CONSTRAINT IF NOT EXISTS check_valor_no_excede_meta
CHECK (valor_ejecutado <= meta_ejecutar);

-- Validar rango de año
ALTER TABLE pdm_actividades
ADD CONSTRAINT IF NOT EXISTS check_anio_valid_range 
CHECK (anio >= 2000 AND anio <= 2100);

-- Validar que nombre no esté vacío
ALTER TABLE pdm_actividades
ADD CONSTRAINT IF NOT EXISTS check_nombre_not_empty 
CHECK (LENGTH(TRIM(nombre)) > 0);

-- Validar longitud máxima de nombre
ALTER TABLE pdm_actividades
ADD CONSTRAINT IF NOT EXISTS check_nombre_max_length 
CHECK (LENGTH(nombre) <= 512);

-- Validar estados permitidos
ALTER TABLE pdm_actividades
ADD CONSTRAINT IF NOT EXISTS check_estado_valid 
CHECK (estado IN ('pendiente', 'en_progreso', 'completada', 'cancelada'));

-- Validar coherencia de fechas (si ambas existen)
ALTER TABLE pdm_actividades
ADD CONSTRAINT IF NOT EXISTS check_fechas_coherentes 
CHECK (fecha_inicio IS NULL OR fecha_fin IS NULL OR fecha_inicio <= fecha_fin);

COMMENT ON CONSTRAINT check_meta_ejecutar_positive ON pdm_actividades IS 
'Previene metas negativas';
COMMENT ON CONSTRAINT check_valor_ejecutado_positive ON pdm_actividades IS 
'Previene valores ejecutados negativos';
COMMENT ON CONSTRAINT check_valor_no_excede_meta ON pdm_actividades IS 
'Previene que el valor ejecutado exceda la meta';
COMMENT ON CONSTRAINT check_anio_valid_range ON pdm_actividades IS 
'Asegura que el año esté en un rango válido (2000-2100)';
COMMENT ON CONSTRAINT check_nombre_not_empty ON pdm_actividades IS 
'Previene nombres vacíos o solo espacios';
COMMENT ON CONSTRAINT check_nombre_max_length ON pdm_actividades IS 
'Limita longitud del nombre a 512 caracteres';
COMMENT ON CONSTRAINT check_estado_valid ON pdm_actividades IS 
'Valida que el estado sea uno de los permitidos';
COMMENT ON CONSTRAINT check_fechas_coherentes ON pdm_actividades IS 
'Asegura que fecha_inicio <= fecha_fin cuando ambas existen';

-- ============================================================================
-- 2. PDM - Tabla pdm_avances
-- ============================================================================

-- Validar que valor_ejecutado sea no negativo
ALTER TABLE pdm_avances
ADD CONSTRAINT IF NOT EXISTS check_avance_valor_positive 
CHECK (valor_ejecutado >= 0);

-- Validar rango de año
ALTER TABLE pdm_avances
ADD CONSTRAINT IF NOT EXISTS check_avance_anio_valid 
CHECK (anio >= 2000 AND anio <= 2100);

-- Validar longitud de comentario
ALTER TABLE pdm_avances
ADD CONSTRAINT IF NOT EXISTS check_comentario_max_length 
CHECK (comentario IS NULL OR LENGTH(comentario) <= 512);

COMMENT ON CONSTRAINT check_avance_valor_positive ON pdm_avances IS 
'Previene valores de avance negativos';
COMMENT ON CONSTRAINT check_avance_anio_valid ON pdm_avances IS 
'Valida rango de año para avances';
COMMENT ON CONSTRAINT check_comentario_max_length ON pdm_avances IS 
'Limita longitud del comentario';

-- ============================================================================
-- 3. PDM - Tabla pdm_actividades_ejecuciones
-- ============================================================================

-- Validar que valor_ejecutado_incremento sea no negativo
ALTER TABLE pdm_actividades_ejecuciones
ADD CONSTRAINT IF NOT EXISTS check_incremento_positive 
CHECK (valor_ejecutado_incremento >= 0);

-- Validar longitud de descripción
ALTER TABLE pdm_actividades_ejecuciones
ADD CONSTRAINT IF NOT EXISTS check_ejecucion_descripcion_max 
CHECK (descripcion IS NULL OR LENGTH(descripcion) <= 2048);

-- Validar longitud de URL
ALTER TABLE pdm_actividades_ejecuciones
ADD CONSTRAINT IF NOT EXISTS check_url_evidencia_max 
CHECK (url_evidencia IS NULL OR LENGTH(url_evidencia) <= 512);

COMMENT ON CONSTRAINT check_incremento_positive ON pdm_actividades_ejecuciones IS 
'Previene incrementos negativos en ejecuciones';

-- ============================================================================
-- 4. PLANES - Tabla planes_institucionales
-- ============================================================================

-- Validar que porcentaje_avance esté entre 0 y 100
ALTER TABLE planes_institucionales
ADD CONSTRAINT IF NOT EXISTS check_porcentaje_avance_range 
CHECK (porcentaje_avance >= 0 AND porcentaje_avance <= 100);

-- Validar que nombre no esté vacío
ALTER TABLE planes_institucionales
ADD CONSTRAINT IF NOT EXISTS check_plan_nombre_not_empty 
CHECK (LENGTH(TRIM(nombre)) > 0);

-- Validar longitud de nombre
ALTER TABLE planes_institucionales
ADD CONSTRAINT IF NOT EXISTS check_plan_nombre_max_length 
CHECK (LENGTH(nombre) <= 300);

-- Validar coherencia de fechas
ALTER TABLE planes_institucionales
ADD CONSTRAINT IF NOT EXISTS check_plan_fechas_coherentes 
CHECK (fecha_inicio < fecha_fin);

-- Validar año
ALTER TABLE planes_institucionales
ADD CONSTRAINT IF NOT EXISTS check_plan_anio_valid 
CHECK (anio >= 2000 AND anio <= 2100);

-- Validar estados permitidos
ALTER TABLE planes_institucionales
ADD CONSTRAINT IF NOT EXISTS check_plan_estado_valid 
CHECK (estado IN ('formulacion', 'aprobado', 'en_ejecucion', 'finalizado', 'suspendido', 'cancelado'));

COMMENT ON CONSTRAINT check_porcentaje_avance_range ON planes_institucionales IS 
'Asegura que el porcentaje de avance esté entre 0 y 100';
COMMENT ON CONSTRAINT check_plan_fechas_coherentes ON planes_institucionales IS 
'Asegura que fecha_inicio < fecha_fin';
COMMENT ON CONSTRAINT check_plan_estado_valid ON planes_institucionales IS 
'Valida estados permitidos para planes';

-- ============================================================================
-- 5. PLANES - Tabla componentes_procesos
-- ============================================================================

-- Validar que porcentaje_avance esté entre 0 y 100
ALTER TABLE componentes_procesos
ADD CONSTRAINT IF NOT EXISTS check_componente_porcentaje_range 
CHECK (porcentaje_avance >= 0 AND porcentaje_avance <= 100);

-- Validar que nombre no esté vacío
ALTER TABLE componentes_procesos
ADD CONSTRAINT IF NOT EXISTS check_componente_nombre_not_empty 
CHECK (LENGTH(TRIM(nombre)) > 0);

-- Validar longitud de nombre
ALTER TABLE componentes_procesos
ADD CONSTRAINT IF NOT EXISTS check_componente_nombre_max 
CHECK (LENGTH(nombre) <= 300);

-- Validar estados permitidos
ALTER TABLE componentes_procesos
ADD CONSTRAINT IF NOT EXISTS check_componente_estado_valid 
CHECK (estado IN ('no_iniciado', 'en_progreso', 'completado', 'en_riesgo', 'retrasado'));

-- ============================================================================
-- 6. PLANES - Tabla actividades
-- ============================================================================

-- Validar coherencia de fechas
ALTER TABLE actividades
ADD CONSTRAINT IF NOT EXISTS check_actividad_fechas_coherentes 
CHECK (fecha_inicio_prevista < fecha_fin_prevista);

-- Validar que responsable no esté vacío
ALTER TABLE actividades
ADD CONSTRAINT IF NOT EXISTS check_responsable_not_empty 
CHECK (LENGTH(TRIM(responsable)) > 0);

-- Validar longitud de responsable
ALTER TABLE actividades
ADD CONSTRAINT IF NOT EXISTS check_responsable_max_length 
CHECK (LENGTH(responsable) <= 200);

COMMENT ON CONSTRAINT check_actividad_fechas_coherentes ON actividades IS 
'Asegura que fecha_inicio_prevista < fecha_fin_prevista';

-- ============================================================================
-- 7. PQRS - Tabla pqrs
-- ============================================================================

-- Validar que tipo_solicitud sea válido
ALTER TABLE pqrs
ADD CONSTRAINT IF NOT EXISTS check_pqrs_tipo_solicitud_valid 
CHECK (tipo_solicitud IN ('peticion', 'queja', 'reclamo', 'sugerencia'));

-- Validar que tipo_identificacion sea válido
ALTER TABLE pqrs
ADD CONSTRAINT IF NOT EXISTS check_pqrs_tipo_identificacion_valid 
CHECK (tipo_identificacion IN ('personal', 'anonima'));

-- Validar que medio_respuesta sea válido
ALTER TABLE pqrs
ADD CONSTRAINT IF NOT EXISTS check_pqrs_medio_respuesta_valid 
CHECK (medio_respuesta IN ('email', 'fisica', 'telefono', 'ticket'));

-- Validar que estado sea válido
ALTER TABLE pqrs
ADD CONSTRAINT IF NOT EXISTS check_pqrs_estado_valid 
CHECK (estado IN ('pendiente', 'en_proceso', 'resuelto', 'cerrado'));

-- Validar que asunto no esté vacío
ALTER TABLE pqrs
ADD CONSTRAINT IF NOT EXISTS check_pqrs_asunto_not_empty 
CHECK (LENGTH(TRIM(asunto)) > 0);

-- Validar que descripcion no esté vacía
ALTER TABLE pqrs
ADD CONSTRAINT IF NOT EXISTS check_pqrs_descripcion_not_empty 
CHECK (LENGTH(TRIM(descripcion)) > 0);

-- Validar email si es personal
-- Nota: Este constraint puede fallar con datos existentes si no cumplen la regla
-- ALTER TABLE pqrs
-- ADD CONSTRAINT IF NOT EXISTS check_pqrs_email_if_personal 
-- CHECK (tipo_identificacion != 'personal' OR email_ciudadano IS NOT NULL);

COMMENT ON CONSTRAINT check_pqrs_tipo_solicitud_valid ON pqrs IS 
'Valida tipos de solicitud permitidos';
COMMENT ON CONSTRAINT check_pqrs_tipo_identificacion_valid ON pqrs IS 
'Valida tipos de identificación permitidos';
COMMENT ON CONSTRAINT check_pqrs_medio_respuesta_valid ON pqrs IS 
'Valida medios de respuesta permitidos';
COMMENT ON CONSTRAINT check_pqrs_estado_valid ON pqrs IS 
'Valida estados permitidos para PQRS';

-- ============================================================================
-- 8. ÍNDICES PARA MEJORAR PERFORMANCE
-- ============================================================================

-- PDM
CREATE INDEX IF NOT EXISTS idx_pdm_actividades_estado ON pdm_actividades(estado);
CREATE INDEX IF NOT EXISTS idx_pdm_actividades_anio ON pdm_actividades(anio);
CREATE INDEX IF NOT EXISTS idx_pdm_actividades_entity_codigo ON pdm_actividades(entity_id, codigo_indicador_producto);
CREATE INDEX IF NOT EXISTS idx_pdm_avances_anio ON pdm_avances(anio);
CREATE INDEX IF NOT EXISTS idx_pdm_avances_entity_codigo_anio ON pdm_avances(entity_id, codigo_indicador_producto, anio);

-- Planes
CREATE INDEX IF NOT EXISTS idx_planes_estado ON planes_institucionales(estado);
CREATE INDEX IF NOT EXISTS idx_planes_anio ON planes_institucionales(anio);
CREATE INDEX IF NOT EXISTS idx_planes_entity ON planes_institucionales(entity_id);
CREATE INDEX IF NOT EXISTS idx_componentes_plan ON componentes_procesos(plan_id);
CREATE INDEX IF NOT EXISTS idx_actividades_componente ON actividades(componente_id);
CREATE INDEX IF NOT EXISTS idx_actividades_responsable ON actividades(responsable);
CREATE INDEX IF NOT EXISTS idx_actividades_ejecucion_actividad ON actividades_ejecucion(actividad_id);

-- PQRS
CREATE INDEX IF NOT EXISTS idx_pqrs_estado ON pqrs(estado);
CREATE INDEX IF NOT EXISTS idx_pqrs_tipo_solicitud ON pqrs(tipo_solicitud);
CREATE INDEX IF NOT EXISTS idx_pqrs_entity ON pqrs(entity_id);
CREATE INDEX IF NOT EXISTS idx_pqrs_created_by ON pqrs(created_by_id);
CREATE INDEX IF NOT EXISTS idx_pqrs_assigned_to ON pqrs(assigned_to_id);
CREATE INDEX IF NOT EXISTS idx_pqrs_fecha_solicitud ON pqrs(fecha_solicitud DESC);

-- ============================================================================
-- COMMIT
-- ============================================================================

-- Si todo salió bien, hacer commit
COMMIT;

-- Si algo falló, hacer rollback manualmente con:
-- ROLLBACK;

-- ============================================================================
-- VERIFICACIÓN POST-MIGRACIÓN
-- ============================================================================

-- Verificar constraints agregados:
SELECT
    tc.table_name,
    tc.constraint_name,
    tc.constraint_type,
    pg_get_constraintdef(c.oid) as definition,
    obj_description(c.oid) as comment
FROM information_schema.table_constraints tc
JOIN pg_constraint c ON c.conname = tc.constraint_name
WHERE tc.table_schema = 'public'
  AND tc.constraint_type = 'CHECK'
  AND tc.table_name IN (
    'pdm_actividades',
    'pdm_avances',
    'pdm_actividades_ejecuciones',
    'planes_institucionales',
    'componentes_procesos',
    'actividades',
    'pqrs'
  )
ORDER BY tc.table_name, tc.constraint_name;

-- Verificar índices agregados:
SELECT
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN (
    'pdm_actividades',
    'pdm_avances',
    'planes_institucionales',
    'componentes_procesos',
    'actividades',
    'pqrs'
  )
ORDER BY tablename, indexname;

-- ============================================================================
-- NOTAS IMPORTANTES
-- ============================================================================

-- 1. Este script asume PostgreSQL. Para otras bases de datos, ajustar sintaxis.
-- 2. Algunos constraints pueden fallar si hay datos existentes que los violan.
-- 3. En ese caso, primero limpiar/corregir los datos antes de agregar el constraint.
-- 4. El script usa IF NOT EXISTS para ser idempotente (se puede ejecutar varias veces).
-- 5. Hacer siempre backup antes de ejecutar migraciones en producción.
-- 6. Probar en desarrollo primero.
-- 7. Algunos constraints están comentados porque pueden requerir limpieza de datos previa.

-- ============================================================================
-- FIN DEL SCRIPT
-- ============================================================================
