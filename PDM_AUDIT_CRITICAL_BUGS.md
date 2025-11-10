# 🔴 AUDITORÍA CRÍTICA - BUGS EN COMPONENTE PDM

## Resumen Ejecutivo
El componente PDM tiene **3 problemas críticos** que afectan la carga y visualización de datos:

1. **BUG #1**: Productos no muestra ejecución ni actividades inicialmente
2. **BUG #2**: Análisis y Dashboards - PDM aparece con todo en 0
3. **BUG #3**: Sincronización de datos incompleta entre vistas

---

## 🐛 BUG #1: Productos No Carga Datos Inicialmente

### Descripción del Problema
**Comportamiento esperado**: Cuando navegas a "Ver Todos los Productos", debe mostrar:
- Lista de productos con ejecución del año actual
- Actividades de cada producto

**Comportamiento actual**: 
- Los productos aparecen SIN ejecución/actividades
- Solo aparecen cuando ENTRAS al detalle del producto
- Luego vuelves a la lista y ¡AHORA SÍ aparecen!

### Causa Raíz
En `pdm.ts`, método `navegarA()` cuando se navega a vista 'productos':

```typescript
} else if (vista === 'productos') {
    console.log('📦 Navegando a productos, recargando lista...');
    this.recargarProductos();
```

**Problema**: `recargarProductos()` solo recarga `resumenProductos` pero **no recarga las actividades** de cada producto desde el backend.

La vista muestra el resultado de `productosFiltrados` que incluye actividades:
```typescript
get productosFiltrados(): ResumenProducto[] {
    let productos = this.resumenProductos;
    // ... filtros ...
    return productos;
}
```

Pero `resumenProductos` se generó desde `pdmData` que NO tiene actividades del backend.

### Línea Problemática
- **pdm.ts línea ~377**: `recargarProductos()` no llama a `cargarActividadesDesdeBackend()` para cada producto

### Código Problemático Actual
```typescript
private recargarProductos(): void {
    console.log('📦 Recargando lista de productos...');
    
    if (!this.datosEnBackend) {
        console.log('ℹ️ No hay datos en backend');
        this.productoSeleccionado = null;
        return;
    }
    
    this.cargandoDesdeBackend = true;
    this.pdmService.cargarDatosPDMDesdeBackend().subscribe({
        next: (data) => {
            console.log('✅ Lista de productos recargada');
            this.pdmData = data;
            this.resumenProductos = this.pdmService.generarResumenProductos(data);
            this.estadisticas = this.pdmService.calcularEstadisticas(data);
            this.productoSeleccionado = null;
            this.limpiarFiltros();
            this.cargandoDesdeBackend = false;
        },
        // ...
    });
}
```

**El problema**: Solo recarga el PDMData pero no sincroniza las actividades de CADA producto.

---

## 🐛 BUG #2: Análisis y Dashboards Muestra Todo en 0

### Descripción del Problema
**Comportamiento esperado**: Dashboard con gráficos mostrando:
- Distribución por estado (completados, en progreso, pendientes)
- Metas vs ejecutadas
- Presupuesto por año
- ODS
- Sectores

**Comportamiento actual**:
- Todos los gráficos aparecen vacíos (0 valores)
- No hay datos en los tooltip de los gráficos

### Causa Raíz
En `pdm.ts`, método `verAnalytics()`:

```typescript
verAnalytics(): void {
    console.log('📊 Abriendo analytics, recargando datos del servidor...');
    
    if (this.datosEnBackend) {
        this.cargandoDesdeBackend = true;
        this.pdmService.cargarDatosPDMDesdeBackend().subscribe({
            next: (data) => {
                // ... recarga datos
                this.generarAnalytics();  // ⬅️ AQUÍ EL PROBLEMA
```

El problema está en cómo `generarAnalytics()` se llama:

```typescript
generarAnalytics(): void {
    this.dashboardAnalytics = this.pdmService.generarDashboardAnalytics(
        this.resumenProductos,  // ⬅️ Usa resumenProductos que NO tiene actividades
        this.filtroAnio
    );
}
```

**El problema crítico**:
1. `resumenProductos` viene de `generarResumenProductos(data)` 
2. Este método crea objetos ResumenProducto CON los campos calculados
3. PERO al llamar a analytics, se usan para calcular:
   - Porcentajes de avance
   - Metas ejecutadas
   - Progreso por año
   
4. Estos cálculos dependen de las **actividades de cada producto**
5. Si no hay actividades sincronizadas, todo da 0

### Código Problemático

En `pdm.service.ts`, método `generarDashboardAnalytics()` recibe `resumenProductos`:

```typescript
generarDashboardAnalytics(productos: ResumenProducto[], filtroAnio: number): DashboardAnalytics {
    // Calcula por estado
    const porEstado = this.calcularPorEstado(productos, filtroAnio);
    
    // Calcula por sector
    const porSector = this.calcularPorSector(productos, filtroAnio);
    
    // ... más cálculos
    
    // El problema: estos cálculos usan valores de ResumenProducto
    // que dependen de actividades del backend
}
```

---

## 🐛 BUG #3: Sincronización Incompleta de Datos

### Descripción del Problema
Los datos no se sincronizan correctamente entre:
1. Backend (`/pdm/v2/datos`)
2. `pdmService` (BehaviorSubject de actividades)
3. Vistas de componente
4. Cálculos de estadísticas

### Causa Raíz
Dos caminos de carga de datos sin sincronización:

**Camino 1** (Actual - PARCIAL):
```
Backend → cargarDatosPDMDesdeBackend() 
  → PDMData (tiene productos pero SIN actividades completas)
  → resumenProductos
  → Componente
```

**Camino 2** (Especial para detalle):
```
Backend → cargarActividadesDesdeBackend(codigoProducto)
  → ActividadPDM[]
  → sincronizarActividadesProducto()
  → PdmService.actividadesSubject
```

**El problema**: El Camino 2 solo se ejecuta cuando **entra al detalle de un producto**. No se ejecuta automáticamente en `recargarProductos()` o `verAnalytics()`.

---

## 📊 Matriz de Impacto

| Aspecto | Estado | Impacto |
|--------|--------|--------|
| Dashboard inicial | ✅ Funciona | Bajo |
| Lista de Productos | ❌ Sin actividades | **CRÍTICO** |
| Detalle de Producto | ✅ Funciona | Bajo (después de entrar) |
| Análisis y Dashboards | ❌ Todo en 0 | **CRÍTICO** |
| Filtros | ⚠️ Parcial | Medio (solo filtran títulos) |
| Analytics | ❌ Sin datos | **CRÍTICO** |

---

## 🔧 Soluciones Propuestas

### SOLUCIÓN #1: Cargar Actividades en `recargarProductos()`

Modificar `recargarProductos()` para sincronizar actividades:

```typescript
private recargarProductos(): void {
    console.log('📦 Recargando lista de productos...');
    
    if (!this.datosEnBackend) {
        this.productoSeleccionado = null;
        return;
    }
    
    this.cargandoDesdeBackend = true;
    
    // PASO 1: Cargar datos base
    this.pdmService.cargarDatosPDMDesdeBackend().subscribe({
        next: (data) => {
            this.pdmData = data;
            this.resumenProductos = this.pdmService.generarResumenProductos(data);
            this.estadisticas = this.pdmService.calcularEstadisticas(data);
            this.productoSeleccionado = null;
            
            // ✅ PASO 2: Cargar actividades de TODOS los productos
            this.cargarActividadesTodosProductos();
            
            this.limpiarFiltros();
            this.cargandoDesdeBackend = false;
        },
        error: (error) => {
            console.warn('⚠️ Error al recargar productos:', error);
            this.cargandoDesdeBackend = false;
        }
    });
}

// ✅ NUEVA FUNCIÓN
private cargarActividadesTodosProductos(): void {
    if (!this.resumenProductos.length) return;
    
    console.log(`📦 Cargando actividades de ${this.resumenProductos.length} productos...`);
    
    // Cargar actividades en paralelo para todos los productos
    const peticiones = this.resumenProductos.map(producto =>
        this.pdmService.cargarActividadesDesdeBackend(producto.codigo)
            .pipe(
                tap(actividades => {
                    this.pdmService.sincronizarActividadesProducto(producto.codigo, actividades);
                    console.log(`✅ Actividades cargadas para ${producto.codigo}: ${actividades.length}`);
                }),
                catchError(error => {
                    console.warn(`⚠️ Error cargando actividades para ${producto.codigo}:`, error);
                    return of([]);
                })
            )
    );
    
    // Ejecutar todas en paralelo con forkJoin
    forkJoin(peticiones).subscribe({
        next: () => {
            console.log('✅ Todas las actividades sincronizadas');
            // Los gráficos se actualizarán automáticamente
        },
        error: (error) => {
            console.error('❌ Error sincronizando actividades:', error);
        }
    });
}
```

### SOLUCIÓN #2: Cargar Actividades en `verAnalytics()`

Modificar `verAnalytics()` para sincronizar antes de generar analytics:

```typescript
verAnalytics(): void {
    console.log('📊 Abriendo analytics, recargando datos del servidor...');
    
    if (this.datosEnBackend) {
        this.cargandoDesdeBackend = true;
        this.pdmService.cargarDatosPDMDesdeBackend().subscribe({
            next: (data) => {
                console.log('✅ Datos recargados del backend para analytics');
                this.pdmData = data;
                this.resumenProductos = this.pdmService.generarResumenProductos(data);
                this.estadisticas = this.pdmService.calcularEstadisticas(data);
                
                // ✅ PASO CRÍTICO: Cargar actividades de TODOS los productos
                this.cargarActividadesTodosProductos();
                
                // ESPERAR a que se sincronicen actividades antes de generar analytics
                setTimeout(() => {
                    this.generarAnalytics();
                    this.vistaActual = 'analytics';
                    setTimeout(() => this.crearGraficos(), 100);
                    this.cargandoDesdeBackend = false;
                }, 1000); // Esperar a que terminen las peticiones
            },
            error: (error) => {
                console.warn('⚠️ Error al recargar datos para analytics:', error);
                this.cargandoDesdeBackend = false;
                this.generarAnalytics();
                this.vistaActual = 'analytics';
                setTimeout(() => this.crearGraficos(), 100);
            }
        });
    } else {
        this.generarAnalytics();
        this.vistaActual = 'analytics';
        setTimeout(() => this.crearGraficos(), 100);
    }
}
```

### SOLUCIÓN #3: Agregar Método de Carga Completa de Datos

Crear un método reutilizable que cargue datos + actividades:

```typescript
/**
 * Carga completa: datos base + actividades de todos los productos
 * Este es el nuevo flujo estándar para cualquier vista que muestre datos
 */
private cargarDatosCompletos(): Promise<void> {
    return new Promise((resolve) => {
        this.cargandoDesdeBackend = true;
        
        this.pdmService.cargarDatosPDMDesdeBackend().subscribe({
            next: (data) => {
                console.log('✅ Datos base cargados');
                this.pdmData = data;
                this.resumenProductos = this.pdmService.generarResumenProductos(data);
                this.estadisticas = this.pdmService.calcularEstadisticas(data);
                
                // Cargar actividades de todos los productos
                this.cargarActividadesTodosProductos();
                
                // Resolver después de 1 segundo (tiempo para sincronizar)
                setTimeout(() => {
                    console.log('✅ Datos completos listos');
                    this.cargandoDesdeBackend = false;
                    resolve();
                }, 1000);
            },
            error: (error) => {
                console.error('❌ Error cargando datos:', error);
                this.cargandoDesdeBackend = false;
                resolve(); // Resolver de todas formas
            }
        });
    });
}
```

---

## 📋 Checklist de Implementación

- [ ] Agregar import de `forkJoin` y `catchError` en pdm.ts
- [ ] Agregar método `cargarActividadesTodosProductos()`
- [ ] Agregar método `cargarDatosCompletos()`
- [ ] Actualizar `recargarProductos()` para usar `cargarActividadesTodosProductos()`
- [ ] Actualizar `verAnalytics()` para usar `cargarDatosCompletos()`
- [ ] Actualizar `navegarA('productos')` si es necesario
- [ ] Testear en navegador cada vista
- [ ] Verificar console para logs de sincronización
- [ ] Desplegar a S3

---

## 🧪 Testing Manual

### Prueba #1: Verificar Productos Carga Datos
1. Ir a dashboard
2. Click "Ver Todos los Productos"
3. **Esperado**: Ver ejecución/progreso en los productos
4. **Verificar**: Console debe mostrar "✅ Actividades cargadas para [código]"

### Prueba #2: Verificar Analytics Carga Datos
1. Ir a dashboard
2. Click "Ver Análisis"
3. **Esperado**: Gráficos muestran datos (NO todo en 0)
4. **Verificar**: Console debe mostrar "✅ Todas las actividades sincronizadas"

### Prueba #3: Verificar Consistencia
1. Abrir lista de productos - ver ejecución X
2. Entrar al detalle del producto
3. Salir y volver a lista
4. **Esperado**: Misma ejecución X (sin cambios)

---

## 📝 Notas Técnicas

### Por qué sucede esto:
1. El backend devuelve productos CON actividades en `/pdm/v2/datos`
2. PERO el frontend NO sincroniza esas actividades al PdmService
3. Los cálculos de ejecución dependen de actividades sincronizadas
4. Solo al entrar a detalle se sincroniza explícitamente

### La solución central:
**Sincronizar actividades de TODOS los productos automáticamente cuando:**
- Se navega a la vista de productos
- Se abre el análisis/dashboards
- Se cambian los filtros

Esto asegura que `generarDashboardAnalytics()` y `getAvanceAnio()` tengan datos correctos.

