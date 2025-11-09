-- Aumentar el tamaño del campo consecutivo en pdm_indicadores_resultado
ALTER TABLE pdm_indicadores_resultado 
ALTER COLUMN consecutivo TYPE VARCHAR(50);

-- Aumentar el tamaño del campo consecutivo en pdm_iniciativas_sgr si existe
ALTER TABLE pdm_iniciativas_sgr 
ALTER COLUMN consecutivo TYPE VARCHAR(50);

-- Aumentar el tamaño del campo consecutivo en pdm_productos si existe
ALTER TABLE pdm_productos 
ALTER COLUMN consecutivo TYPE VARCHAR(50);
