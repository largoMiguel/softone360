# 📊 AUDITORÍA - LÓGICA DE CÁLCULO DE AVANCE PDM

**Fecha:** 11 de noviembre de 2025  
**Status:** ✅ VALIDANDO IMPLEMENTACIÓN  

---

## 🎯 Lógica Requerida (Usuario)

### Escenario: Producto con Meta Anual = 200

```
PASO 1: Crear Actividad 1 (meta_ejecutar = 100)
├─ Meta Programada: 200
├─ Meta Asignada en Actividades: 100
├─ Progreso (Meta Asignada / Meta Programada): 50%
├─ Ejecución (Sin Evidencia): 0%
└─ Estado: EN_PROGRESO

PASO 2: Crear Actividad 2 (meta_ejecutar = 100)
├─ Meta Programada: 200
├─ Meta Asignada en Actividades: 100 + 100 = 200
├─ Progreso (Meta Asignada / Meta Programada): 100%
├─ Ejecución (Sin Evidencia): 0%
└─ Estado: EN_PROGRESO

PASO 3: Agregar Evidencia a Actividad 1
├─ Meta Programada: 200
├─ Meta Asignada: 200
├─ Meta Ejecutada (Con Evidencia): 100
├─ Progreso: 100% ✓
├─ Ejecución: 100 / 200 = 50%
└─ Estado: EN_PROGRESO

PASO 4: Agregar Evidencia a Actividad 2
├─ Meta Programada: 200
├─ Meta Asignada: 200
├─ Meta Ejecutada (Con Evidencia): 100 + 100 = 200
├─ Progreso: 100% ✓
├─ Ejecución: 200 / 200 = 100%
└─ Estado: COMPLETADO
```

---

## 📋 Definiciones

### Meta Programada
- **Definición:** La meta del producto para ese año (programacion_XXXX)
- **Fuente:** Excel PDM → PdmProducto.programacion_2024/2025/2026/2027
- **Ejemplo:** 200 (unidades a alcanzar en el año)

### Meta Asignada
- **Definición:** Suma de `meta_ejecutar` de TODAS las actividades del producto en ese año
- **Fórmula:** `SUM(actividad.meta_ejecutar WHERE producto_id = X AND anio = Y)`
- **Ejemplo:** 100 + 100 = 200
- **Propósito:** Indica cuánta meta se ha distribuido en actividades

### Meta Ejecutada
- **Definición:** Suma de `meta_ejecutar` de SOLO las actividades con evidencia
- **Fórmula:** `SUM(actividad.meta_ejecutar WHERE producto_id = X AND anio = Y AND evidencia IS NOT NULL)`
- **Ejemplo:** 100 (si solo una actividad tiene evidencia)
- **Propósito:** Indica cuánta meta realmente se ejecutó

### Progreso (Asignación)
- **Definición:** Porcentaje de meta distribuida en actividades
- **Fórmula:** `(meta_asignada / meta_programada) * 100`
- **Rango:** 0% a 100%
- **Ejemplo:**
  - Con 1 actividad: (100 / 200) * 100 = 50%
  - Con 2 actividades: (200 / 200) * 100 = 100%

### Ejecución (Cumplimiento)
- **Definición:** Porcentaje de meta realmente ejecutada con evidencia
- **Fórmula:** `(meta_ejecutada / meta_programada) * 100`
- **Rango:** 0% a 100%
- **Ejemplo:**
  - Sin evidencias: (0 / 200) * 100 = 0%
  - Con 1 evidencia: (100 / 200) * 100 = 50%
  - Con 2 evidencias: (200 / 200) * 100 = 100%

### Estado del Producto
- **PENDIENTE:** Sin actividades (meta_asignada = 0)
- **EN_PROGRESO:** Con actividades pero sin todas las evidencias (meta_asignada > 0 AND meta_ejecutada < meta_programada)
- **COMPLETADO:** Con todas las evidencias (meta_ejecutada = meta_programada)
- **POR_EJECUTAR:** Meta futura (año > año_actual)

---

## 🔍 Validación de Implementación Actual

### Backend (pdm.service.ts - obtenerResumenActividadesPorAnio)

```typescript
obtenerResumenActividadesPorAnio(producto: ResumenProducto, anio: number): ResumenActividadesPorAnio {
    const actividades = this.obtenerActividadesPorProductoYAnio(producto.codigo, anio);
    
    const metaProgramada = this.getMetaAnio(producto, anio);  // ✅ Correcto
    
    const metaAsignada = actividades.reduce((sum, a) => sum + a.meta_ejecutar, 0);
    // ✅ Suma de meta_ejecutar de TODAS las actividades
    
    const metaEjecutada = actividades
        .filter(a => a.evidencia !== undefined)
        .reduce((sum, a) => sum + a.meta_ejecutar, 0);
    // ✅ Suma de meta_ejecutar de actividades CON evidencia
    
    const porcentajeAvance = metaProgramada > 0 
        ? (metaEjecutada / metaProgramada) * 100 
        : 0;
    // ✅ Ejecución = meta_ejecutada / meta_programada
    
    return {
        anio,
        meta_programada: metaProgramada,
        meta_asignada: metaAsignada,
        meta_ejecutada: metaEjecutada,
        meta_disponible: Math.max(0, metaProgramada - metaAsignada),
        total_actividades: actividades.length,
        actividades_completadas: actividades.filter(a => a.evidencia !== undefined).length,
        porcentaje_avance: porcentajeAvance,
        actividades: actividades
    };
}
```

**Estado:** ✅ IMPLEMENTADO CORRECTAMENTE

---

## 📊 Validación con Producto Real

### Datos del Producto 2201029

```
Código: 2201029
Nombre: Beneficiarios de transporte escolar
Meta 2025: 150 (unidades)
```

### Estado Actual (del screenshot)

```
Meta Programada 2025: 150
Meta Asignada: 100 (una actividad de "Validacion de nueva actividad")
Progreso: 100.0% ✅ (mostrado en tarjeta verde)
Estado: Completado ✅

Actividades:
1. "Validacion de nueva actividad"
   - Estado: En Progreso (azul)
   - Meta: 100 Número
   - Fechas: 05/11/2025 - 21/11/2025
   - Responsable: (sin asignar)
   - Evidencia: NO tiene (sin foto)

2. "en progreso 2 funcionalidad"
   - Estado: Pendiente (amarillo)
   - Meta: 50 Número
   - Fechas: 06/11/2025 - 04/12/2025
   - Responsable: (sin asignar)
   - Evidencia: NO tiene (sin foto)
```

### Cálculos Esperados

```
Meta Programada: 150
Meta Asignada: 100 + 50 = 150
Meta Ejecutada: 0 (sin evidencias)

Progreso (Asignación): (150 / 150) * 100 = 100% ✅
Ejecución: (0 / 150) * 100 = 0%

Estado Correcto: EN_PROGRESO (no COMPLETADO)
```

---

## 🐛 PROBLEMAS IDENTIFICADOS

### Problema 1: Estado Incorrecto
**Encontrado:** Estado muestra "Completado" pero debería ser "En Progreso"  
**Causa:** Las actividades NO tienen evidencias aún, pero el estado dice completado  
**Impacto:** UI engañosa al usuario  

### Problema 2: Progreso vs Ejecución Confundidos
**Encontrado:** El "100.0%" mostrado podría ser progreso (asignación) no ejecución  
**Causa:** Falta claridad en qué métrica se muestra  
**Impacto:** Usuario puede pensar que está 100% ejecutado cuando en realidad está 0% ejecutado  

---

## ✅ REQUISITOS PARA FUNCIONAMIENTO CORRECTO

### 1. Backend - Endpoint GET /{slug}/data
- ✅ Retorna productos con actividades
- ✅ Calcula estadísticas correctamente
- **VALIDACIÓN:** curl test exitoso

### 2. Backend - Endpoint POST /{slug}/actividades
- ✅ Crea actividades
- ⚠️ CORS puede necesitar validación
- **VALIDACIÓN:** Pendiente de prueba en frontend

### 3. Backend - Endpoint POST /actividades/{id}/evidencias
- ✅ Crea evidencias
- ⚠️ Serialización de base64 puede tener problemas
- **VALIDACIÓN:** Pendiente de prueba en frontend

### 4. Frontend - Cálculo de Porcentaje
- ⚠️ Necesita distinguir entre:
  - **Progreso/Asignación:** % de meta distribuida en actividades
  - **Ejecución:** % de meta realmente ejecutada con evidencia
- **ACCIÓN:** Actualizar UI para mostrar ambas métricas

### 5. Frontend - Estado del Producto
- ⚠️ Lógica de estado debe ser:
  ```typescript
  if (meta_asignada === 0) estado = 'PENDIENTE'
  else if (meta_ejecutada < meta_programada) estado = 'EN_PROGRESO'
  else if (meta_ejecutada === meta_programada) estado = 'COMPLETADO'
  else estado = 'POR_EJECUTAR'
  ```

---

## 🚀 PLAN DE VALIDACIÓN

### Phase 1: Backend
- [ ] Validar endpoint GET /{slug}/data retorna correctamente
- [ ] Validar endpoint POST /{slug}/actividades funciona
- [ ] Validar endpoint POST /actividades/{id}/evidencias funciona
- [ ] Validar CORS no bloquea requests

### Phase 2: Frontend
- [ ] Crear actividad desde UI
- [ ] Verificar que progreso calcula correctamente
- [ ] Agregar evidencia a actividad
- [ ] Verificar que ejecución calcula correctamente
- [ ] Verificar estado cambia correctamente

### Phase 3: UI/UX
- [ ] Mostrar claramente "Progreso" vs "Ejecución"
- [ ] Mostrar meta_asignada en resumen
- [ ] Mostrar meta_ejecutada en resumen
- [ ] Actualizar estado visual del producto

---

## 📝 PRÓXIMAS ACCIONES

1. **Verificar Endpoints Actividades:**
   - GET /{slug}/actividades/{codigo_producto}
   - POST /{slug}/actividades
   - POST /actividades/{id}/evidencias

2. **Actualizar UI para mostrar:**
   - Meta Programada
   - Meta Asignada (Progreso)
   - Meta Ejecutada (Ejecución)
   - Estado correcto

3. **Validar Cálculos con datos reales**

---

**Auditoría completada por:** AI Assistant  
**Timestamp:** 2025-11-11 05:45:00 UTC  
**Status:** REQUIERE VALIDACIÓN EN FRONTEND