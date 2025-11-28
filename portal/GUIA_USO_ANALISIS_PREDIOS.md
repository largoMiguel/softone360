# 📝 Guía de Uso - Análisis de Predios

## 🎯 Objetivo

Este componente permite analizar archivos CSV de propietarios de predios (formato DIAN - ReporteInfoBasicaRut) y generar visualizaciones profesionales con estadísticas detalladas.

## 📋 Paso a Paso

### 1. Preparar los Archivos CSV

Los archivos deben tener el siguiente formato (delimitador: punto y coma `;`):

```csv
Nit;Nombre/Razon Social;Tipo;Seccional;Estado;Pais;Departamento;Municipio;Direccion;Telefono;Telefono;Correo
390705;MONROY MORENO OSCAR CELIO;NATURAL;Dirección Seccional de Impuestos y Aduanas de Tunja;REGISTRO ACTIVO;COLOMBIA;Boyacá;Siachoque;CL 3   6     78;3143217856;3142999366;anamonroycastro@gmail.com
1143456;TIUSABA GUERRERO NELSON MARIA;NATURAL;Dirección Seccional de Impuestos de Bogotá;REGISTRO ACTIVO;COLOMBIA;Bogotá D.C.;Bogotá, D.C.;CR 70 C    2 SUR   20 IN 2 AP 305;4145135;;ele_tiusaba@hotmail.com
```

**Columnas esperadas:**
1. `Nit` - Número de identificación tributaria
2. `Nombre/Razon Social` - Nombre del propietario
3. `Tipo` - NATURAL o JURIDICA
4. `Seccional` - Dirección seccional DIAN
5. `Estado` - REGISTRO ACTIVO, SUSPENSION OFICIO, REGISTRO CANCELADO, etc.
6. `Pais` - País de residencia
7. `Departamento` - Departamento
8. `Municipio` - Municipio
9. `Direccion` - Dirección física
10. `Telefono` - Teléfono 1
11. `Telefono` (segunda columna) - Teléfono 2
12. `Correo` - Email de contacto

### 2. Acceder al Componente

**URL de acceso:**
```
http://localhost:4200/{slug-de-la-entidad}/analisis-predios
```

**Ejemplos:**
- `http://localhost:4200/chiquiza-boyaca/analisis-predios`
- `http://localhost:4200/siachoque-boyaca/analisis-predios`
- `http://localhost:4200/tunja-boyaca/analisis-predios`

### 3. Cargar Archivos

1. Click en el botón "Seleccionar archivos"
2. Seleccionar uno o más archivos CSV
3. Los archivos aparecerán listados con su tamaño
4. Click en "Analizar Archivos"

**Nota:** Puedes cargar múltiples archivos a la vez. El sistema los procesará todos juntos.

### 4. Interpretar Resultados

#### 📊 Tarjetas de Estadísticas

**Total Propietarios:**
- Cantidad total de registros cargados de todos los archivos

**Registros Activos:**
- Propietarios con estado "REGISTRO ACTIVO"
- Color verde indica buen estado

**Con Correo Electrónico:**
- Propietarios que tienen email registrado
- Útil para campañas de comunicación

**Departamentos:**
- Cantidad de departamentos únicos encontrados

#### 📈 Gráficos

**1. Distribución por Estado (Doughnut)**
- Verde: Registros activos
- Amarillo: Suspensiones de oficio
- Rojo: Registros cancelados
- Gris: Otros estados

**2. Personas Naturales vs Jurídicas (Pie)**
- Naranja: Personas naturales
- Verde: Personas jurídicas

**3. Top 10 Departamentos (Barras)**
- Muestra los 10 departamentos con más propietarios
- Orden descendente por cantidad

**4. Top 10 Municipios (Barras)**
- Muestra los 10 municipios con más propietarios
- Útil para focalizar acciones

**5. Contactabilidad por Email (Doughnut)**
- Verde: Con correo
- Rojo: Sin correo
- Indica qué porcentaje es localizable por email

**6. Resumen Estadístico (Tabla)**
- Desglose detallado de todas las métricas
- % de contactabilidad calculado
- Propietarios sin ningún medio de contacto

### 5. Filtrar Datos

**Filtros disponibles:**

1. **Estado:**
   - Seleccionar un estado específico (Activo, Suspendido, etc.)

2. **Departamento:**
   - Filtrar por departamento específico

3. **Municipio:**
   - Filtrar por municipio específico

4. **Búsqueda de texto:**
   - Buscar por NIT, nombre o correo
   - No sensible a mayúsculas/minúsculas

**Aplicar filtros:**
- Los filtros se aplican automáticamente al cambiar
- Se puede combinar múltiples filtros
- Click en "Limpiar Filtros" para resetear

### 6. Navegar la Tabla

**Características:**

- **Paginación:** 20 registros por página
- **Navegación:** Botones Anterior/Siguiente o número de página directo
- **Columnas:**
  - NIT
  - Nombre/Razón Social
  - Tipo (badge)
  - Estado (badge con color)
  - Departamento
  - Municipio
  - Correo (link clickeable)
  - Teléfono

**Badges de estado:**
- 🟢 Verde: ACTIVO
- 🟡 Amarillo: SUSPENSION
- 🔴 Rojo: CANCELADO

### 7. Exportar Resultados

**Exportar a CSV:**

1. Aplicar los filtros deseados (opcional)
2. Click en "Exportar CSV" o "Descargar Datos"
3. Se descargará un archivo con:
   - Solo los registros filtrados (si hay filtros)
   - Todos los registros (si no hay filtros)
   - Formato CSV estándar (comas)

**Nombre del archivo:**
```
analisis_propietarios_[timestamp].csv
```

Ejemplo: `analisis_propietarios_1701196800000.csv`

### 8. Realizar Nuevo Análisis

**Para analizar otros archivos:**

1. Click en "Nuevo Análisis"
2. Se limpiarán todos los datos y filtros
3. Volver al paso 3 (Cargar Archivos)

## 🎯 Casos de Uso

### Caso 1: Analizar Contactabilidad

**Objetivo:** Determinar cuántos propietarios son contactables por email

**Pasos:**
1. Cargar archivos CSV
2. Ver tarjeta "Con Correo Electrónico"
3. Ver gráfico "Contactabilidad por Email"
4. Filtrar por "Con Correo" (buscar en tabla propietarios con email)
5. Exportar lista de contactables

### Caso 2: Analizar Distribución Geográfica

**Objetivo:** Identificar zonas con más propietarios

**Pasos:**
1. Cargar archivos CSV
2. Ver gráfico "Top 10 Departamentos"
3. Ver gráfico "Top 10 Municipios"
4. Filtrar por departamento de interés
5. Ver distribución en municipios de ese departamento

### Caso 3: Identificar Propietarios Sin Contacto

**Objetivo:** Encontrar propietarios sin medios de contacto

**Pasos:**
1. Cargar archivos CSV
2. Ver métrica "Sin Contacto" en resumen estadístico
3. Filtrar manualmente en búsqueda (propietarios sin teléfono ni email)
4. Exportar lista para actualización de datos

### Caso 4: Analizar Estado de Registros

**Objetivo:** Verificar estados de los registros

**Pasos:**
1. Cargar archivos CSV
2. Ver gráfico "Distribución por Estado"
3. Filtrar por estado específico (ej: "SUSPENSION OFICIO")
4. Analizar casos en tabla
5. Exportar para seguimiento

## 💡 Tips y Mejores Prácticas

### ✅ Recomendaciones

1. **Archivos grandes:**
   - El procesamiento es del lado del cliente
   - Si el navegador se pone lento, cargar archivos más pequeños

2. **Codificación:**
   - Asegurar que los CSV estén en UTF-8
   - Caracteres especiales (tildes, ñ) deben verse correctamente

3. **Datos faltantes:**
   - El sistema maneja campos vacíos correctamente
   - No es necesario limpiar manualmente

4. **Performance:**
   - Hasta 10,000 registros: Excelente performance
   - 10,000 - 50,000: Buen performance
   - +50,000: Considerar dividir en múltiples sesiones

### ❌ Evitar

1. **No mezclar formatos:**
   - Todos los archivos deben tener el mismo formato
   - Mismo delimitador (punto y coma)
   - Mismas columnas

2. **No archivos corruptos:**
   - Verificar que los CSV abran correctamente en Excel
   - Sin caracteres raros o líneas rotas

3. **No perder el trabajo:**
   - Exportar resultados antes de hacer "Nuevo Análisis"
   - No hay función "Guardar sesión"

## 🔧 Solución de Problemas

### Problema: "Error al procesar archivos"

**Soluciones:**
- Verificar que el archivo sea .csv
- Verificar que tenga las 12 columnas
- Abrir en editor de texto y verificar delimitadores (`;`)
- Verificar codificación UTF-8

### Problema: "No aparecen datos en los gráficos"

**Soluciones:**
- Verificar que los archivos tengan datos (más de 1 línea)
- Verificar que la primera línea sea el encabezado
- Revisar consola del navegador (F12) para errores

### Problema: "Los filtros no funcionan"

**Soluciones:**
- Click en "Limpiar Filtros" y reintentar
- Recargar la página
- Verificar que los datos cargados tengan esos valores

### Problema: "La exportación está vacía"

**Soluciones:**
- Verificar que haya datos después de aplicar filtros
- Si todos los filtros están activos, puede no haber coincidencias
- Limpiar filtros y exportar nuevamente

## 📞 Soporte

Este es un **componente temporal** creado para análisis específico. 

**Para más información:**
- Ver archivo `README.md` en la carpeta del componente
- Ver archivo `ANALISIS_PREDIOS_RESUMEN.md` en la raíz del portal

---

**Última actualización:** 28 de noviembre de 2025
