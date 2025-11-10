# 🔍 Auditoría - Componente PDM (Frontend)

**Fecha de Auditoría:** 10 de noviembre de 2025  
**Componente:** `frontend/src/app/components/pdm/pdm.ts`  
**Objetivo:** Validar que se recarguen datos desde el backend cuando cambia de vista y al ingresar  
**Estado:** ⚠️ REQUIERE MEJORAS

---

## 📊 Resumen de Hallazgos

| Categoría | Hallazgo | Estado |
|-----------|----------|--------|
| **Carga Inicial** | Se verifica BD al entrar | ✅ OK |
| **Cambio de Vistas** | Recarga parcial de datos | ⚠️ CRÍTICO |
| **Actividades** | Recarga solo si está en backend | ✅ OK |
| **Filtros** | No recarga datos | ❌ FALTA |
| **Cambio de Año** | No recarga del backend | ⚠️ INCOMPLETO |
| **Analytics** | No recarga datos | ⚠️ INCOMPLETO |

---

## 🔴 Problemas Identificados

### 1. **CRÍTICO: vistas no recargan datos del backend**

**Ubicación:** Línea 391 (`navegarA()`)

```typescript
navegarA(vista: 'dashboard' | 'productos' | 'detalle' | 'analisis-producto', 
         producto?: ResumenProducto) {
    const vistaAnterior = this.vistaActual;
    this.vistaActual = vista;
    
    // ❌ PROBLEMA: Solo carga actividades al detalle, pero NO recarga:
    // - Productos cuando vuelve a productos
    // - Estadísticas cuando vuelve a dashboard
    // - Analytics cuando cambia de filtro
    
    if (producto) {
        this.productoSeleccionado = producto;
        this.actualizarResumenActividades(true);  // Solo aquí
    }
}
```

**Impacto:** 
- Si el usuario crea un producto nuevo en el backend, no lo verá al navegar
- Los números pueden estar desactualizados
- No hay sincronización real con el servidor

---

### 2. **FALTA: Recarga al cambiar filtros**

**Ubicación:** No existe

Cuando el usuario cambia:
- ❌ Línea de Estratégica
- ❌ Sector  
- ❌ Búsqueda

NO se recarga desde el backend, solo filtra datos en memoria.

---

### 3. **INCOMPLETO: Cambio de año**

**Ubicación:** Línea 599 (`seleccionarAnio()`)

```typescript
seleccionarAnio(anio: number) {
    this.anioSeleccionado = anio;
    this.actualizarResumenActividades();  // ✅ Carga actividades
    // ❌ PERO: No recarga estadísticas, metas, presupuestos del backend
}
```

---

### 4. **INCOMPLETO: Analytics no se actualiza**

**Ubicación:** Línea 1438 (`verAnalytics()`)

```typescript
verAnalytics(): void {
    this.generarAnalytics();  // ✅ Genera analytics
    // ❌ PERO: Usa datos en memoria, no recarga del backend
}
```

---

## ✅ Lo que SÍ funciona

### 1. Carga inicial (ngOnInit)
```typescript
✅ Verificar datos en backend al entrar
✅ Cargar PDM si existe en servidor
✅ Sincronizar con datos locales
```

### 2. Actividades
```typescript
✅ Al abrir detalle del producto, carga actividades del backend
✅ Cambio de año recarga actividades
✅ Crear/editar/eliminar sincroniza con servidor
```

---

## 🛠️ Mejoras Recomendadas

### 1. **Recargar datos al cambiar de vista**

```typescript
// ANTES
navegarA(vista: string, producto?: ResumenProducto) {
    this.vistaActual = vista;
    if (producto) {
        this.actualizarResumenActividades(true);
    }
}

// DESPUÉS
navegarA(vista: 'dashboard' | 'productos' | 'detalle' | 'analisis-producto', 
         producto?: ResumenProducto) {
    this.vistaActual = vista;
    
    // ✅ NUEVA: Recargar datos según la vista
    if (vista === 'dashboard') {
        this.recargarDashboard();
    } else if (vista === 'productos') {
        this.recargarProductos();
    } else if (vista === 'detalle' && producto) {
        this.productoSeleccionado = producto;
        this.actualizarResumenActividades(true);
    } else if (vista === 'analisis-producto') {
        this.recargarAnalisisProducto();
    }
    
    // Agregar al historial
    window.history.pushState(
        { vista, productoCodigo: producto?.codigo },
        '',
        window.location.href
    );
}
```

### 2. **Recargar al cambiar filtros**

```typescript
// NUEVA FUNCIÓN
private recargarSegunFiltros(): void {
    if (!this.datosEnBackend) return;
    
    console.log('🔄 Recargando datos por cambio de filtros...');
    this.cargarDatosDesdeBackend();
}

// En el template, llamar cuando cambia filtro:
onFiltroLinea(linea: string) {
    this.filtroLinea = linea;
    this.recargarSegunFiltros();
}

onFiltroSector(sector: string) {
    this.filtroSector = sector;
    this.recargarSegunFiltros();
}

onFiltroBusqueda(busqueda: string) {
    this.filtroBusqueda = busqueda;
    this.recargarSegunFiltros();
}
```

### 3. **Recargar Analytics completo**

```typescript
// MEJORADO
verAnalytics(): void {
    console.log('📊 Recargando analytics desde backend...');
    
    // Recargar datos completos primero
    if (this.datosEnBackend) {
        this.cargarDatosDesdeBackend().then(() => {
            this.generarAnalytics();
            this.vistaActual = 'analytics';
            setTimeout(() => this.crearGraficos(), 100);
        });
    } else {
        this.generarAnalytics();
        this.vistaActual = 'analytics';
        setTimeout(() => this.crearGraficos(), 100);
    }
}
```

### 4. **Recargar dashboard con estadísticas frescas**

```typescript
// NUEVA FUNCIÓN
private recargarDashboard(): void {
    console.log('📈 Recargando dashboard...');
    
    if (this.datosEnBackend) {
        this.cargandoDesdeBackend = true;
        this.cargarDatosDesdeBackend();
    } else {
        // Si no hay datos en backend, mostrar opción de cargar Excel
        console.log('ℹ️ No hay datos en backend');
    }
}
```

### 5. **Recargar productos con lista actualizada**

```typescript
// NUEVA FUNCIÓN
private recargarProductos(): void {
    console.log('📦 Recargando lista de productos...');
    
    if (this.datosEnBackend) {
        this.cargarDatosDesdeBackend();
    }
    
    this.productoSeleccionado = null;
    this.limpiarFiltros();
}
```

---

## 📋 Checklist de Implementación

- [ ] **recargarDashboard()** - Función para recargar dashboard con datos frescos
- [ ] **recargarProductos()** - Función para recargar lista de productos
- [ ] **recargarAnalisisProducto()** - Función para recargar análisis del producto
- [ ] **recargarSegunFiltros()** - Recarga al cambiar filtros
- [ ] **Modificar navegarA()** - Llamar funciones según vista
- [ ] **Modificar seleccionarAnio()** - Recargar datos del año del backend
- [ ] **Modificar verAnalytics()** - Recargar datos antes de generar analytics
- [ ] **Agregar indicadores visuales** - Mostrar "Cargando del servidor..."
- [ ] **Agregar manejo de errores** - Si falla recarga, usar datos en caché
- [ ] **Probar en browser** - Validar que se recarga en cada cambio de vista

---

## 🔄 Flujo Propuesto (Con Mejoras)

```
Usuario Abre App
    ↓
[ngOnInit]
    ↓
✅ Verifica si hay datos en backend
    ↓
✅ Carga datos del backend (si existen)
    ↓
Mostrar Dashboard
    ↓
Usuario Cambia Vista (productos, detalle, analytics)
    ↓
🔄 [NUEVO] Recargar datos según vista
    ↓
Mostrar vista con datos frescos
    ↓
Usuario Cambia Filtro (línea, sector, búsqueda)
    ↓
🔄 [NUEVO] Recargar datos según filtros
    ↓
Mostrar productos filtrados (frescos del backend)
    ↓
Usuario Selecciona Año
    ↓
🔄 [MEJORADO] Recargar actividades AND estadísticas del backend
    ↓
Mostrar datos del año (frescos)
```

---

## 💡 Recomendaciones Adicionales

### 1. **Agregar BehaviorSubject para sincronización**

```typescript
// En pdm.service.ts
private datosRefrescadoSubject = new BehaviorSubject<boolean>(false);
datosRefrescado$ = this.datosRefrescadoSubject.asObservable();

recargarDatos(): Observable<PDMData> {
    return this.cargarDatosPDMDesdeBackend().pipe(
        tap(() => this.datosRefrescadoSubject.next(true))
    );
}
```

### 2. **Agregar caché con TTL (Time To Live)**

```typescript
private cacheTimestamp = 0;
private CACHE_TTL = 5 * 60 * 1000; // 5 minutos

private necesitaRecargar(): boolean {
    const ahora = Date.now();
    return (ahora - this.cacheTimestamp) > this.CACHE_TTL;
}

private actualizarTimestampCache(): void {
    this.cacheTimestamp = Date.now();
}
```

### 3. **Agregar indicadores visuales de carga**

```typescript
// En el template
<div *ngIf="cargandoDesdeBackend" class="alert alert-info">
    <i class="spinner-border spinner-border-sm me-2"></i>
    Actualizando datos desde servidor...
</div>
```

---

## 🧪 Casos de Prueba

| Caso | Acción | Resultado Esperado | Estado Actual |
|------|--------|-------------------|--------------|
| 1 | Entrar a PDM | Cargar datos del backend | ✅ OK |
| 2 | Cambiar a "Productos" | Recargar lista de productos | ❌ FALLA |
| 3 | Cambiar a "Analytics" | Recargar datos y gráficos | ❌ FALLA |
| 4 | Cambiar filtro de línea | Recargar productos según filtro | ❌ FALLA |
| 5 | Cambiar año | Recargar actividades y estadísticas | ⚠️ PARCIAL |
| 6 | Abrir detalle producto | Cargar actividades del backend | ✅ OK |
| 7 | Crear nueva actividad | Sincronizar con servidor | ✅ OK |
| 8 | Editar actividad | Sincronizar con servidor | ✅ OK |
| 9 | Cambiar responsable | Sincronizar con servidor | ✅ OK |
| 10 | Volver atrás | Mostrar datos actuales | ⚠️ PUEDE ESTAR DESACTUALIZADO |

---

## 📝 Notas Importantes

### No es un error crítico porque:
1. ✅ Los datos iniciales SÍ se cargan del backend
2. ✅ Las actividades SÍ se recargan
3. ✅ Las creaciones/ediciones SÍ se sincronizan

### Pero es importante mejorar porque:
1. ❌ Si otro usuario modifica datos, el usuario actual no los verá
2. ❌ Los análisis pueden estar desactualizados
3. ❌ No hay garantía de datos frescos en cada acción

---

## 🎯 Prioridad

| Tarea | Impacto | Complejidad | Prioridad |
|-------|---------|-------------|-----------|
| Recargar al cambiar vista | Alto | Media | 🔴 ALTA |
| Recargar analytics | Medio | Baja | 🟡 MEDIA |
| Recargar al cambiar filtros | Medio | Baja | 🟡 MEDIA |
| Indicadores visuales | Bajo | Baja | 🟢 BAJA |

---

**Próxima revisión:** Después de implementar mejoras

