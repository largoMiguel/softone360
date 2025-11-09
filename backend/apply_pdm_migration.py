#!/usr/bin/env python3
"""
Script para aplicar migraciones PDM V2 desde la instancia EC2
"""
import os
import psycopg2
from psycopg2 import sql

# Leer la migración
migration_sql = """
-- ============================================================================
-- MIGRACIÓN PDM V2
-- Sistema: SOFTONE360
-- Fecha: 8 de noviembre de 2025
-- Descripción: Migración de PDM antiguo a PDM V2 con nueva estructura
-- ============================================================================

BEGIN;

-- Eliminar tablas antiguas
DROP TABLE IF EXISTS pdm_actividades_evidencias CASCADE;
DROP TABLE IF EXISTS pdm_actividades_ejecuciones CASCADE;
DROP TABLE IF EXISTS pdm_actividades CASCADE;
DROP TABLE IF EXISTS pdm_avances CASCADE;
DROP TABLE IF EXISTS pdm_meta_assignments CASCADE;
DROP TABLE IF EXISTS pdm_archivos_excel CASCADE;

-- Crear tabla pdm_lineas_estrategicas
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

-- Crear tabla pdm_indicadores_resultado
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

-- Crear tabla pdm_iniciativas_sgr
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

-- Crear tabla pdm_productos
CREATE TABLE IF NOT EXISTS pdm_productos (
    id SERIAL PRIMARY KEY,
    entity_id INTEGER NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    linea_estrategica_id INTEGER NOT NULL REFERENCES pdm_lineas_estrategicas(id) ON DELETE CASCADE,
    codigo VARCHAR(100) NOT NULL,
    producto TEXT NOT NULL,
    bpin VARCHAR(50),
    unidad_medida VARCHAR(100),
    tipo_acumulacion VARCHAR(50),
    meta_cuatrienio DECIMAL(15,2),
    programacion_2024 DECIMAL(15,2),
    programacion_2025 DECIMAL(15,2),
    programacion_2026 DECIMAL(15,2),
    programacion_2027 DECIMAL(15,2),
    presupuesto_2024 DECIMAL(18,2),
    presupuesto_2025 DECIMAL(18,2),
    presupuesto_2026 DECIMAL(18,2),
    presupuesto_2027 DECIMAL(18,2),
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

-- Crear tabla pdm_actividades
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
    meta_programada DECIMAL(15,2),
    meta_ejecutada DECIMAL(15,2) DEFAULT 0,
    estado VARCHAR(50) DEFAULT 'PENDIENTE',
    porcentaje_avance DECIMAL(5,2) DEFAULT 0,
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

-- Crear tabla pdm_actividades_evidencias
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

COMMIT;

SELECT 'Migración PDM V2 completada correctamente' as status;
"""

def apply_migration():
    # Obtener DATABASE_URL del entorno
    database_url = os.environ.get('DATABASE_URL')
    
    if not database_url:
        print("❌ DATABASE_URL no está configurada")
        return False
    
    try:
        # Conectar a la base de datos
        print("📡 Conectando a la base de datos...")
        conn = psycopg2.connect(database_url)
        conn.autocommit = False
        cursor = conn.cursor()
        
        print("🔄 Aplicando migración PDM V2...")
        cursor.execute(migration_sql)
        
        print("✅ Migración aplicada correctamente")
        conn.close()
        return True
        
    except Exception as e:
        print(f"❌ Error al aplicar migración: {e}")
        if 'conn' in locals():
            conn.rollback()
            conn.close()
        return False

if __name__ == '__main__':
    success = apply_migration()
    exit(0 if success else 1)
