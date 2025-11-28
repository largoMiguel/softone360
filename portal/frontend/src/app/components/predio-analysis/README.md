# 📊 Componente de Análisis de Predios y Propietarios

## ⚠️ COMPONENTE TEMPORAL

Este componente es **temporal** y será **eliminado** posteriormente. Se creó únicamente para realizar un análisis específico de archivos CSV.

## 📁 Archivos Creados

### Frontend
- `/frontend/src/app/models/predio-analysis.model.ts` - Modelos de datos
- `/frontend/src/app/services/predio-analysis.service.ts` - Servicio de análisis
- `/frontend/src/app/components/predio-analysis/predio-analysis.ts` - Componente TypeScript
- `/frontend/src/app/components/predio-analysis/predio-analysis.html` - Template HTML
- `/frontend/src/app/components/predio-analysis/predio-analysis.scss` - Estilos CSS

### Backend
- `/backend/app/routes/predio_analysis.py` - Endpoint API (opcional)

### Configuración
- Ruta agregada en `/frontend/src/app/app.routes.ts`
- Router registrado en `/backend/app/main.py`

## 🚀 Cómo Usar

### 1. Acceder al Componente

Una vez autenticado en el sistema, navegar a:

```
http://localhost:4200/{slug-entidad}/analisis-predios
```

Por ejemplo:
```
http://localhost:4200/chiquiza-boyaca/analisis-predios
```

### 2. Cargar Archivos CSV

1. Hacer clic en el botón de selección de archivos
2. Seleccionar uno o más archivos CSV (formato: ReporteInfoBasicaRut)
3. Los archivos deben tener el siguiente formato:

```csv
Nit;Nombre/Razon Social;Tipo;Seccional;Estado;Pais;Departamento;Municipio;Direccion;Telefono;Telefono;Correo
390705;MONROY MORENO OSCAR CELIO;NATURAL;Dirección Seccional...;REGISTRO ACTIVO;COLOMBIA;Boyacá;Siachoque;CL 3...;3143217856;3142999366;email@example.com
```

### 3. Analizar Datos

1. Click en "Analizar Archivos"
2. El sistema procesará los CSV y generará:
   - 📊 **Estadísticas generales**: Total propietarios, activos, con correo, etc.
   - 📈 **Gráficos profesionales**:
     - Distribución por Estado (Doughnut Chart)
     - Personas Naturales vs Jurídicas (Pie Chart)
     - Top 10 Departamentos (Bar Chart)
     - Top 10 Municipios (Bar Chart)
     - Contactabilidad por Email (Doughnut Chart)
     - Resumen Estadístico (Tabla)
   - 📋 **Tabla de propietarios** con filtros y paginación

### 4. Filtrar y Exportar

- **Filtros disponibles**: Estado, Departamento, Municipio, Búsqueda de texto
- **Exportar**: Descargar resultados filtrados en CSV
- **Paginación**: 20 registros por página

## 📊 Características

### Visualizaciones Profesionales

- ✅ Gráficos interactivos con Chart.js
- ✅ Diseño responsive
- ✅ Animaciones suaves
- ✅ Colores codificados por categoría
- ✅ Leyendas y títulos descriptivos

### Análisis de Datos

- ✅ Total de propietarios cargados
- ✅ Distribución por estados (Activo, Suspendido, Cancelado)
- ✅ Distribución por tipo (Natural, Jurídica)
- ✅ Análisis geográfico (Departamentos, Municipios)
- ✅ Análisis de contactabilidad (Con/Sin email, teléfonos)
- ✅ Estadísticas de registros sin contacto

### Funcionalidades

- ✅ Carga múltiple de archivos CSV
- ✅ Procesamiento del lado del cliente (rápido)
- ✅ Filtros dinámicos
- ✅ Paginación eficiente
- ✅ Exportación a CSV
- ✅ Diseño profesional y moderno

## 🗑️ Eliminación del Componente

Cuando ya no se necesite, eliminar los siguientes archivos:

### Frontend
```bash
rm -rf frontend/src/app/components/predio-analysis/
rm frontend/src/app/models/predio-analysis.model.ts
rm frontend/src/app/services/predio-analysis.service.ts
```

### Backend
```bash
rm backend/app/routes/predio_analysis.py
```

### Limpiar Configuración

1. **app.routes.ts**: Eliminar la línea:
```typescript
{ path: 'analisis-predios', loadComponent: () => import('./components/predio-analysis/predio-analysis').then(m => m.PredioAnalysisComponent), canActivate: [adminPortalGuard, enforceUserEntityGuard] },
```

2. **main.py**: Eliminar las líneas:
```python
# En imports
from app.routes import ..., predio_analysis

# En routers
app.include_router(predio_analysis.router, prefix="/api", tags=["Predios Analysis (Temporal)"])
```

## 📝 Notas Técnicas

- El análisis se realiza principalmente en el **frontend** (mejor rendimiento)
- El endpoint backend es **opcional** y puede omitirse
- Compatible con archivos CSV grandes (procesamiento eficiente)
- Manejo de errores robusto
- Parseo CSV respeta comillas y delimitadores

## 🎨 Tecnologías Utilizadas

- **Angular 17+** - Framework frontend
- **Chart.js** - Visualizaciones
- **ng2-charts** - Wrapper de Chart.js para Angular
- **Bootstrap 5** - Estilos y layout
- **SCSS** - Preprocesador CSS
- **FastAPI** - Backend (opcional)
- **Python CSV** - Procesamiento backend (opcional)

---

**Creado**: Noviembre 2025  
**Estado**: ⚠️ Temporal - Para eliminar después del análisis
