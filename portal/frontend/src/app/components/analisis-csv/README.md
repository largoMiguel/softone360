# Componente de Análisis CSV - Predios y Propietarios

## 📋 Descripción

Componente temporal creado para el análisis visual y estadístico de datos catastrales. Permite cargar archivos CSV con información de predios y propietarios, cruzar los datos y visualizarlos mediante gráficos profesionales.

## 🚀 Acceso

Accede al componente a través de la ruta:
```
http://localhost:4200/analisis-csv
```

## 📂 Estructura de Archivos Necesarios

### 1. Archivo Principal (LGAC 2025)
- Contiene la información de predios
- Debe tener al menos 2 columnas:
  - **Columna 1**: Número de identificación del predio
  - **Columna 2**: NITs de los propietarios (separados por coma o punto y coma)

### 2. Archivos RUT (Múltiples)
- Contienen información detallada de los propietarios
- Estructura esperada (columnas):
  1. NIT
  2. Nombre/Razón Social
  3. Tipo
  4. Seccional
  5. Estado
  6. País
  7. Departamento
  8. Municipio
  9. Dirección
  10. Teléfono 1
  11. Teléfono 2
  12. Correo

## 🎨 Características

### Visualizaciones Incluidas:

1. **Estadísticas Generales**
   - Total de predios
   - Total de propietarios
   - Propietarios con información completa
   - Propietarios sin información

2. **Gráficos Profesionales**
   - 📊 **Gráfico de Estados**: Distribución por estado de registro (Pie Chart)
   - 👥 **Gráfico de Tipos**: Tipos de propietarios (Doughnut Chart)
   - 📍 **Gráfico de Departamentos**: Propietarios por departamento (Bar Chart)
   - 🏘️ **Gráfico de Municipios**: Top 10 municipios con más propietarios (Horizontal Bar)

3. **Tabla de Datos**
   - Vista detallada de todos los propietarios encontrados
   - Información completa: NIT, nombre, estado, ubicación, contacto
   - Exportación a Excel con un clic

## 💡 Cómo Usar

### Paso 1: Cargar Archivo Principal
1. Haz clic en el recuadro morado "Archivo Principal (LGAC 2025)"
2. Selecciona tu archivo CSV/Excel con los predios
3. Espera la confirmación de carga

### Paso 2: Cargar Archivos RUT
1. Haz clic en el recuadro morado "Archivos RUT (Múltiples)"
2. Selecciona **todos** los archivos RUT (puedes seleccionar múltiples)
3. El sistema procesará automáticamente todos los archivos

### Paso 3: Visualizar Resultados
- Los gráficos se generarán automáticamente
- Revisa las estadísticas en las tarjetas superiores
- Explora los diferentes gráficos
- Consulta la tabla de datos al final

### Paso 4: Exportar Resultados
- Haz clic en el botón "Exportar Excel" para descargar los datos procesados

## 🔧 Formatos Soportados

- `.csv` (Comma Separated Values)
- `.xlsx` (Excel moderno)
- `.xls` (Excel antiguo)

## ⚡ Rendimiento

El componente puede procesar:
- ✅ Miles de predios
- ✅ Múltiples archivos RUT simultáneamente
- ✅ Cruce automático de datos por NIT

## 🎯 Tecnologías Utilizadas

- **Angular 20**: Framework principal
- **Chart.js**: Librería de gráficos
- **ng2-charts**: Wrapper Angular para Chart.js
- **XLSX**: Procesamiento de archivos Excel/CSV
- **Bootstrap Icons**: Iconografía

## 🗑️ Nota Importante

Este componente es **temporal** y está diseñado únicamente para análisis de datos. Puede ser eliminado después de completar el análisis sin afectar otras funcionalidades del sistema.

Para eliminar:
1. Borrar carpeta: `src/app/components/analisis-csv/`
2. Remover ruta en: `src/app/app.routes.ts`
3. Remover import de Bootstrap Icons en: `src/index.html` (opcional)

## 📸 Vista Previa

El componente muestra:
- 📊 Dashboard con 4 tarjetas de estadísticas coloridas
- 📈 4 gráficos interactivos profesionales
- 📋 Tabla responsive con todos los datos
- 🎨 Diseño moderno con gradientes y animaciones

## 🐛 Solución de Problemas

### Los datos no aparecen
- Verifica que los archivos CSV tengan la estructura correcta
- Asegúrate de cargar primero el archivo principal y luego los RUT
- Revisa la consola del navegador (F12) para errores

### Los NITs no coinciden
- Verifica que los NITs en el archivo principal coincidan exactamente con los del RUT
- Los NITs deben estar sin puntos ni comas (solo números)

### Gráficos vacíos
- Asegúrate de que los archivos RUT tengan datos válidos
- Verifica que la estructura de columnas sea correcta

## 📞 Soporte

Para dudas o problemas, contacta al equipo de desarrollo.

---

**Versión**: 1.0.0  
**Fecha**: Noviembre 2024  
**Estado**: Temporal - Solo para análisis
