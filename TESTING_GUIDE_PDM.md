# 🧪 GUÍA DE TESTING - VERIFICAR CORRECCIONES PDM

**Última actualización:** 10 de Noviembre de 2025  
**URL de Prueba:** http://softone360-frontend-useast1.s3-website-us-east-1.amazonaws.com

---

## ⚡ PREPARACIÓN PREVIA

### 1. Limpiar Cache del Navegador
Es **CRÍTICO** limpiar el cache para asegurar que cargas la versión nueva.

#### Opción A: Hard Refresh (Más rápido)
```
Windows/Linux: Ctrl + Shift + R
Mac:          Cmd + Shift + R
```

#### Opción B: Limpiar Cache Completo
1. Abre DevTools: `F12`
2. Click derecho en el ícono de refresh (arriba a la izquierda)
3. Selecciona: "Empty cache and hard reload"
4. Espera a que se recargue todo

#### Opción C: Limpiar Desde Storage
1. Abre DevTools: `F12`
2. Pestaña: "Application"
3. Sección: "Storage"
4. Click: "Clear site data"
5. Recarga la página

### 2. Abrir DevTools para Ver Logs
1. Presiona `F12` (Windows/Linux) o `Cmd + Option + I` (Mac)
2. Irá a la pestaña "Console"
3. Los logs deberían verse claramente

---

## ✅ TEST #1: Verificar Que Productos Carga Ejecución

### Objetivo
Verificar que cuando abres "Ver Todos los Productos", muestra **inmediatamente** la ejecución de cada producto.

### Pasos

1. **Abre la aplicación**
   - URL: http://softone360-frontend-useast1.s3-website-us-east-1.amazonaws.com
   - Inicia sesión si es necesario

2. **Navega a PDM**
   - Lado izquierdo: "Plan de Desarrollo Municipal (PDM)"
   - Si está en otra sección, haz click allí

3. **Haz click en "Ver Todos los Productos"**
   - Deberías ver un botón grande en el dashboard
   - Click en él

4. **Observa la lista de productos**
   - Cada producto debe mostrar:
     - ✅ **Código** del producto
     - ✅ **Nombre** del producto
     - ✅ **% de ejecución** (barra de progreso)
     - ✅ **Color** (rojo/amarillo/verde según estado)
   - **NO debe aparecer "Cargando..."** por mucho tiempo

5. **Verifica en la consola**
   - Abre DevTools (F12)
   - Pestaña "Console"
   - Busca estos logs (en orden):
   ```
   📦 Recargando lista de productos...
   ✅ Datos base de productos recargados
   📦 Iniciando carga de actividades para X productos...
     ✅ PROD001: 5 actividades
     ✅ PROD002: 8 actividades
     ... (más productos)
   ✅ ✅ Todas las actividades sincronizadas - Vista de productos lista
   ```

### ✅ Criterios de Éxito
- [ ] Los productos se cargan rápido (< 5 segundos)
- [ ] Cada producto muestra % de ejecución
- [ ] La barra de progreso tiene color
- [ ] Los logs muestran actividades sincronizadas
- [ ] NO hay errores en la consola

### ❌ Si Falla
```
Síntomas:
- Productos sin % de ejecución
- Barra vacía o gris
- Logs no aparecen

Solución:
1. Hard refresh: Ctrl+Shift+R
2. Abre DevTools y mira los errores en Console
3. Verifica que el backend está disponible
4. Si persiste, reporta el error
```

---

## ✅ TEST #2: Verificar que Analytics Carga Gráficos con Datos

### Objetivo
Verificar que al abrir "Ver Análisis", los gráficos muestran **datos correctos** (NO todo en 0).

### Pasos

1. **Estando en el Dashboard**
   - Click en botón "Ver Análisis" (arriba a la derecha)
   - Espera a que cargue (debe decir "Cargando datos desde el servidor...")

2. **Observa los gráficos**

   **Gráfico 1: Distribución de Productos por Estado (Torta/Pie)**
   - Debe mostrar colores diferentes
   - Tiene etiqueta como: "Completado: 12 productos", "En Progreso: 8 productos", etc.
   - **NO debe ser todo gris o vacío**
   - **Números NO deben ser 0**

   **Gráfico 2: Top 10 Sectores (Barras Agrupadas)**
   - Debe mostrar diferentes sectores
   - Colores verde, azul, amarillo para estados
   - Al pasar el mouse debe mostrar tooltips con números
   - **NO debe ser todo 0**

   **Gráfico 3: Metas Totales vs Ejecutadas (Barras)**
   - Dos conjuntos de barras: "Meta Total Programada" y "Meta Ejecutada"
   - Ambas con valores
   - **NO deben ser todas 0**

   **Gráfico 4: Análisis Presupuestal por Año (Barras)**
   - Debe mostrar presupuesto en pesos
   - Formato: $XXX.XXX.XXX
   - Valores positivos para cada año
   - **NO deben ser $0**

   **Gráfico 5: Top 10 ODS (Dona)**
   - Colores vibrantes
   - Leyenda con nombres de ODS
   - Números de productos
   - **NO vacío**

   **Gráfico 6: Análisis por Sector (Barras Horizontales)**
   - Muestra % de avance por sector
   - Colores gradientes (rojo/amarillo/verde)
   - Valores entre 0-100%
   - Tooltips con detalles

3. **Verifica en la consola**
   - Abre DevTools (F12)
   - Busca estos logs:
   ```
   📊 Abriendo analytics, recargando datos del servidor...
   ✅ Datos base cargados para analytics
   📦 Iniciando carga de actividades para X productos...
     ✅ PROD001: 5 actividades
     ✅ PROD002: 8 actividades
     ... (más productos)
   ✅ ✅ Todas las actividades sincronizadas - Vista de productos lista
   ✅ Generando gráficos con datos sincronizados...
   ```

4. **Prueba interactividad**
   - Pasa el mouse sobre los gráficos
   - Debe mostrar tooltips con valores
   - Prueba hacer click en leyendas
   - Intenta cambiar el año (si hay selector)

### ✅ Criterios de Éxito
- [ ] Los 6 gráficos aparecen
- [ ] Ninguno está vacío (todos muestran datos)
- [ ] Los números no son 0
- [ ] Los tooltips funcionan
- [ ] No hay errores en consola
- [ ] Carga en menos de 5 segundos

### ❌ Si Falla (TODO EN 0)
```
Síntomas:
- Gráficos vacíos o solo leyendas
- Todos los números son 0
- Logs no muestran actividades sincronizadas

Causa Probable:
- Las actividades no se sincronizaron correctamente
- Falta el paso de espera (1.5 segundos)

Solución:
1. Hard refresh: Ctrl+Shift+R
2. Abre DevTools → Console
3. Mira exactamente dónde fallan los logs
4. Si ves error 403/500, el backend tiene un problema
5. Si no ves los logs, cache corrupto → borra todo
```

---

## ✅ TEST #3: Verificar que los Filtros Funcionan

### Objetivo
Verificar que los filtros aplican correctamente sobre datos sincronizados.

### Pasos

1. **Estando en "Ver Todos los Productos"**
   - Deberías ver la lista completa

2. **Prueba el filtro de Línea Estratégica**
   - Arriba hay un dropdown que dice "Filtrar por Línea"
   - Selecciona una línea
   - Los productos deben filtrar inmediatamente
   - Cada producto debe seguir mostrando % de ejecución
   - **Ejecución NO debe cambiar**, solo la lista

3. **Prueba el filtro de Sector**
   - Dropdown "Filtrar por Sector"
   - Selecciona un sector
   - Verifica que:
     - Solo aparecen productos de ese sector
     - Siguen mostrando % correcto
     - Es rápido (< 2 segundos)

4. **Prueba el filtro de Búsqueda**
   - Campo de texto "Buscar producto"
   - Escribe parte del nombre de un producto
   - Verifica que:
     - Filtra mientras escribes
     - Los productos coincidentes aparecen
     - Mantienen % de ejecución

5. **Limpiar Filtros**
   - Debe haber un botón "Limpiar Filtros" o similar
   - Click
   - Debe volver a mostrar todos los productos

### ✅ Criterios de Éxito
- [ ] Los filtros funcionan sin refrescar
- [ ] Los productos siguen mostrando ejecución
- [ ] Es rápido (< 2 segundos)
- [ ] Búsqueda funciona en tiempo real
- [ ] Limpiar filtros restaura la lista completa

---

## ✅ TEST #4: Verificar Navegación Entre Vistas

### Objetivo
Verificar que la navegación mantiene datos correctos.

### Pasos

1. **Empieza en Dashboard**
   - Observa los números de estadísticas

2. **Click "Ver Todos los Productos"**
   - Verifica que cargan correctamente

3. **Click en un producto**
   - Debe abrir el detalle
   - Click en "Ver Análisis Detallado"
   - Deben aparecer gráficos del producto

4. **Regresa a Productos**
   - Click "Volver"
   - Verifica que los datos se mantienen
   - Click en otro producto
   - Datos correctos para este producto

5. **Ve a Analytics General**
   - Click "Ver Análisis" desde Dashboard
   - Verifica que muestra datos correctos

6. **Vuelve a Dashboard**
   - Los números deben ser iguales que al principio

### ✅ Criterios de Éxito
- [ ] No hay pérdida de datos al navegar
- [ ] Los números son consistentes
- [ ] No hay carga doble/innecesaria
- [ ] "Volver" funciona correctamente
- [ ] No hay errores de navegación

---

## 🔍 VERIFICACIÓN AVANZADA (DevTools Console)

### Copiar y Pegar Estos Comandos

**Ver todos los logs de PDM:**
```javascript
// Abre la consola (F12) y pega esto
console.log('%c=== PDM LOGS ===%c', 'font-size: 16px; color: blue; font-weight: bold', '');
// Luego recarga la página
// Verás todos los logs de sincronización
```

**Verificar si hay errores:**
```javascript
// En la consola, busca cualquier línea que diga "❌" o "Error"
// Anótalo exactamente
```

**Medir tiempo de carga de actividades:**
```javascript
// Busca el tiempo entre estos logs:
// "📦 Iniciando carga de actividades para X productos..."
// "✅ ✅ Todas las actividades sincronizadas"
// El tiempo debería ser 2-5 segundos
```

---

## 📋 Checklist de Validación Final

### Antes de Reportar "Funciona"
- [ ] Test #1: Productos cargan ejecución
- [ ] Test #2: Analytics muestra gráficos con datos
- [ ] Test #3: Filtros funcionan
- [ ] Test #4: Navegación mantiene datos
- [ ] Console sin errores
- [ ] Hard refresh hecho
- [ ] Todos los gráficos muestran datos
- [ ] Ningún número es 0 (cuando no debería serlo)

### Si Algo Falla
- [ ] Hacer hard refresh: Ctrl+Shift+R
- [ ] Limpiar cache completo
- [ ] Cerrar y abrir navegador
- [ ] Probar en navegador diferente
- [ ] Copiar error exacto de consola
- [ ] Reportar con screenshot

---

## 🚀 Testing Rápido (5 Minutos)

Si no tienes tiempo, sigue esto:

1. **Hard Refresh**: Ctrl+Shift+R
2. **Ir a PDM** → Click "Ver Todos los Productos"
3. **Verificar**: ¿Ves % de ejecución en los productos?
   - ✅ SÍ → TEST OK
   - ❌ NO → Cache problema, intenta paso 1 de nuevo
4. **Click "Ver Análisis"**
5. **Verificar**: ¿Ves gráficos con datos?
   - ✅ SÍ → TEST OK
   - ❌ NO → Backend problema

---

## 📞 Reportar Problemas

Si encuentras errores, reporta:

1. **Qué sucedió**: Descripción clara
2. **Qué esperabas**: El comportamiento esperado
3. **Screenshot**: Captura de pantalla
4. **Console error**: Copia el error exacto de la consola
5. **Navegador**: Nombre y versión
6. **Pasos para reproducir**: Paso a paso
7. **Hard refresh**: Confirma que lo hiciste

---

## ✅ CONCLUSIÓN

Si todos los tests pasan ✅, entonces:
- ✅ BUG #1 CORREGIDO: Productos cargan ejecución
- ✅ BUG #2 CORREGIDO: Analytics muestra datos
- ✅ BUG #3 CORREGIDO: Sincronización completa

**¡La auditoría fue exitosa!** 🎉

