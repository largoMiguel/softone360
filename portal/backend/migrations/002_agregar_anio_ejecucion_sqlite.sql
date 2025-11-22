-- Migration SQLite: Agregar campo 'anio' a pdm_ejecucion_presupuestal
-- SQLite no soporta ALTER TABLE de constraints, así que recreamos la tabla

-- Paso 1: Renombrar tabla existente
ALTER TABLE pdm_ejecucion_presupuestal RENAME TO pdm_ejecucion_presupuestal_old;

-- Paso 2: Crear nueva tabla con el campo anio y constraint actualizado
CREATE TABLE pdm_ejecucion_presupuestal (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo_producto VARCHAR(20) NOT NULL,
    descripcion_fte VARCHAR(500) NOT NULL,
    pto_inicial NUMERIC(18, 2) DEFAULT 0,
    adicion NUMERIC(18, 2) DEFAULT 0,
    reduccion NUMERIC(18, 2) DEFAULT 0,
    credito NUMERIC(18, 2) DEFAULT 0,
    contracredito NUMERIC(18, 2) DEFAULT 0,
    pto_definitivo NUMERIC(18, 2) DEFAULT 0,
    pagos NUMERIC(18, 2) DEFAULT 0,
    entity_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    sector VARCHAR(100),
    dependencia VARCHAR(200),
    bpin VARCHAR(50),
    anio INTEGER,
    FOREIGN KEY (entity_id) REFERENCES entities(id),
    UNIQUE (entity_id, codigo_producto, descripcion_fte, anio)
);

-- Paso 3: Copiar datos de la tabla antigua
INSERT INTO pdm_ejecucion_presupuestal 
    (id, codigo_producto, descripcion_fte, pto_inicial, adicion, reduccion, 
     credito, contracredito, pto_definitivo, pagos, entity_id, created_at, 
     updated_at, sector, dependencia, bpin, anio)
SELECT 
    id, codigo_producto, descripcion_fte, pto_inicial, adicion, reduccion,
    credito, contracredito, pto_definitivo, pagos, entity_id, created_at,
    updated_at, sector, dependencia, bpin, NULL as anio
FROM pdm_ejecucion_presupuestal_old;

-- Paso 4: Eliminar tabla antigua
DROP TABLE pdm_ejecucion_presupuestal_old;

-- Paso 5: Crear índices
CREATE INDEX idx_pdm_ejecucion_codigo_producto ON pdm_ejecucion_presupuestal(codigo_producto);
CREATE INDEX idx_pdm_ejecucion_anio ON pdm_ejecucion_presupuestal(anio);

-- Verificación
SELECT COUNT(*) as total_registros FROM pdm_ejecucion_presupuestal;
