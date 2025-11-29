# 📊 Guía Rápida - Análisis de Predios CSV

## Acceso Rápido

1. Inicia el servidor de desarrollo:
   ```bash
   cd frontend
   npm start
   ```

2. Abre en el navegador:
   ```
   http://localhost:4200/analisis-csv
   ```

## Uso Rápido

### 1️⃣ Preparar los Archivos
- **Archivo Principal**: El CSV "Archivo lgac 2025.csv" con predios y NITs
- **Archivos RUT**: Los 4-5 CSV "ReporteInfoBasicaRut..." con datos de propietarios

### 2️⃣ Cargar en la Aplicación
1. **Primera caja morada**: Sube el archivo principal (LGAC 2025)
2. **Segunda caja morada**: Sube TODOS los archivos RUT a la vez (selección múltiple)

### 3️⃣ Ver Resultados
El sistema mostrará automáticamente:
- ✅ Estadísticas en tarjetas coloridas
- 📊 4 gráficos profesionales
- 📋 Tabla completa de datos
- 💾 Botón para exportar a Excel

## Características Destacadas

### 📈 Gráficos Incluidos
1. **Estados de Registro** (Pie Chart) - Distribución ACTIVO/SUSPENSIÓN/CANCELADO
2. **Tipos de Propietario** (Doughnut) - NATURAL vs JURÍDICO
3. **Por Departamento** (Barras) - Distribución geográfica
4. **Top 10 Municipios** (Barras horizontales) - Concentración urbana

### 🎯 Funciones Principales
- ⚡ Procesamiento automático de múltiples archivos
- 🔍 Búsqueda y cruce de NITs entre archivos
- 📊 Visualización profesional con Chart.js
- 💾 Exportación a Excel con un clic
- 📱 Diseño responsive y animado

## Estructura de Datos Esperada

### Archivo Principal (Columnas mínimas)
```
Columna 1: Número Predio
Columna 2: NITs (separados por coma)
```

### Archivos RUT (Columnas esperadas)
```
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
```

## Formato de los Archivos

Los archivos pueden ser:
- ✅ `.csv` - Separados por coma o punto y coma
- ✅ `.xlsx` - Excel moderno
- ✅ `.xls` - Excel antiguo

## Ejemplo de Uso

```
1. Hago clic en "Archivo Principal"
2. Selecciono "Archivo lgac 2025.csv"
3. Hago clic en "Archivos RUT"
4. Selecciono todos los "ReporteInfoBasicaRut (X).csv"
   (Ctrl+Click o Shift+Click para múltiple selección)
5. El sistema procesa automáticamente
6. ¡Listo! Veo gráficos y datos
```

## Exportar Resultados

Al final de la página encontrarás el botón verde:
```
🟢 Exportar Excel
```

Esto descargará un archivo `analisis-propietarios.xlsx` con todos los datos procesados.

## Notas Importantes

⚠️ **Este componente es temporal** - Creado solo para este análisis específico

🗑️ **Para eliminar después**:
```bash
# Eliminar carpeta del componente
rm -rf frontend/src/app/components/analisis-csv

# Luego editar manualmente:
# - frontend/src/app/app.routes.ts (quitar ruta)
# - frontend/src/index.html (opcional: quitar bootstrap-icons)
```

## Solución Rápida de Problemas

| Problema | Solución |
|----------|----------|
| No carga archivos | Verifica que sean CSV/Excel válidos |
| Sin resultados | Asegúrate de cargar ambos tipos de archivos |
| NITs no coinciden | Verifica formato sin puntos ni comas |
| Gráficos vacíos | Revisa estructura de columnas en RUT |

## Vista del Componente

El componente tiene:
```
┌─────────────────────────────────────┐
│  📊 Análisis de Predios            │
├─────────────────────────────────────┤
│  [Cargar Principal] [Cargar RUT]   │
├─────────────────────────────────────┤
│  📦 123  👥 456  ✅ 400  ⚠️ 56    │
│  Predios Propiet. Con     Sin      │
│                  Info     Info      │
├─────────────────────────────────────┤
│  📊 Estados    📊 Tipos            │
│  📊 Deptos     📊 Municipios       │
├─────────────────────────────────────┤
│  📋 Tabla con todos los datos      │
│     [Exportar Excel]               │
└─────────────────────────────────────┘
```

## Tecnología

- Framework: Angular 20
- Gráficos: Chart.js + ng2-charts
- Procesamiento: XLSX library
- Estilos: SCSS con gradientes y animaciones

---

**¿Necesitas ayuda?** Contacta al equipo de desarrollo.

**Última actualización:** Noviembre 2024
