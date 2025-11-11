# 🎯 PLAN DE VALIDACIÓN Y CORRECCIÓN - LÓGICA PDM

**Fecha:** 11 de noviembre de 2025  
**Status:** EN EJECUCIÓN  

---

## 📋 CHECKLIST DE VALIDACIÓN

### ✅ Backend - Verificación

- [x] Endpoint GET /{slug}/data retorna productos con estructura completa
- [x] Endpoint GET /{slug}/data incluye lineas_estrategicas, iniciativas_sgr
- [x] Schema PDMDataResponse tiene todos los campos
- [x] Schema ActividadResponse correcto (updated_at opcional)
- [x] CORS configurado para S3 frontend
- [ ] Endpoint POST /{slug}/actividades funciona sin error 500
- [ ] Endpoint GET /{slug}/actividades/{codigo_producto} retorna array de actividades
- [ ] Endpoint POST /actividades/{id}/evidencias crea evidencias correctamente

### ✅ Frontend - Validación

- [x] Stat-cards clickeables implementadas
- [x] Más campos de filtro agregados (ODS, Tipo Acumulación, Estado, Año)
- [ ] Componente de actividades carga correctamente
- [ ] Formulario para crear actividad funciona
- [ ] Formulario para crear evidencia funciona
- [ ] Cálculo de progreso vs ejecución distinguidos correctamente
- [ ] Estado del producto actualiza correctamente

### 📊 Lógica - Validación

- [ ] Meta Programada se calcula correctamente (programacion_XXXX)
- [ ] Meta Asignada se calcula correctamente (SUM meta_ejecutar)
- [ ] Meta Ejecutada se calcula correctamente (SUM meta_ejecutar WITH evidencia)
- [ ] Progreso = (meta_asignada / meta_programada) * 100
- [ ] Ejecución = (meta_ejecutada / meta_programada) * 100
- [ ] Estado es PENDIENTE si meta_asignada = 0
- [ ] Estado es EN_PROGRESO si 0 < meta_ejecutada < meta_programada
- [ ] Estado es COMPLETADO si meta_ejecutada = meta_programada

---

## 🔧 PROBLEMAS A CORREGIR

### 1. CORS Error en Endpoint de Actividades

**Error actual:**
```
Access to XMLHttpRequest at 'http://softone-backend-useast1.eba-epvnmbmk.us-east-1.elasticbeanstalk.com/api/pdm/v2/alcaldia-de-prueba/actividades/2201029'
from origin 'http://softone360-frontend-useast1.s3-website-us-east-1.amazonaws.com' 
has been blocked by CORS policy
```

**Solución:** CORS ya está configurado. Reintentar después de deploy.

### 2. Estado Incorrecto (Mostrado como "Completado")

**Problema:** Con 2 actividades (100 + 50 = 150 de meta programada 150) pero SIN evidencias, muestra "Completado"

**Causa:** Lógica de estado está calculando progreso (asignación) como ejecución

**Fix requerido:**
```typescript
// ANTERIOR (incorrecto):
if (meta_ejecutada === meta_programada) estado = 'COMPLETADO'

// NUEVO (correcto):
if (meta_ejecutada === 0) estado = 'PENDIENTE'
else if (meta_ejecutada < meta_programada) estado = 'EN_PROGRESO'  
else if (meta_ejecutada === meta_programada) estado = 'COMPLETADO'
```

### 3. Progreso Mostrado como "100.0%" (Sin Evidencia)

**Problema:** Muestra 100% de progreso pero sin ejecutar

**Causa:** Confusión entre progreso (asignación) y ejecución

**Fix requerido:**
- Mostrar 2 barras: Una de progreso (asignación) y otra de ejecución
- O cambiar el nombre de la métrica en UI
- O aclarar en tooltip

---

## 🚀 PASOS DE IMPLEMENTACIÓN

### Paso 1: Validar Endpoint de Actividades (5 min)

```bash
# Login
TOKEN=$(curl -s -X POST "http://softone-backend-useast1.eba-epvnmbmk.us-east-1.elasticbeanstalk.com/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Admin123!"}' | jq -r '.access_token')

# Obtener actividades del producto 2201029
curl -X GET "http://softone-backend-useast1.eba-epvnmbmk.us-east-1.elasticbeanstalk.com/api/pdm/v2/alcaldia-de-prueba/actividades/2201029" \
  -H "Authorization: Bearer $TOKEN"

# Crear nueva actividad
curl -X POST "http://softone-backend-useast1.eba-epvnmbmk.us-east-1.elasticbeanstalk.com/api/pdm/v2/alcaldia-de-prueba/actividades" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "codigo_producto": "2201029",
    "anio": 2025,
    "nombre": "Test Actividad",
    "descripcion": "Test",
    "meta_ejecutar": 50,
    "estado": "PENDIENTE",
    "fecha_inicio": "2025-11-11T00:00:00Z",
    "fecha_fin": "2025-12-11T00:00:00Z"
  }'
```

### Paso 2: Corregir Estado en Frontend (10 min)

Ubicación: `frontend/src/app/components/pdm/pdm.ts`

```typescript
// Método getEstadoProductoAnio()
getEstadoProductoAnio(producto: ResumenProducto, anio: number): string {
    const meta = this.getMetaAnio(producto, anio);
    if (meta === 0) return 'POR_EJECUTAR';
    
    const resumen = this.pdmService.obtenerResumenActividadesPorAnio(producto, anio);
    
    // NUEVO LOGIC CORRECTO:
    if (resumen.meta_asignada === 0) return 'PENDIENTE';
    if (resumen.meta_ejecutada < resumen.meta_programada) return 'EN_PROGRESO';
    if (resumen.meta_ejecutada === resumen.meta_programada) return 'COMPLETADO';
    
    return 'EN_PROGRESO';
}
```

### Paso 3: Actualizar UI para Mostrar Ambas Métricas (15 min)

Crear componente de resumen que muestre:
- **Progreso (Asignación):** Meta asignada en actividades / Meta programada
- **Ejecución:** Meta ejecutada con evidencias / Meta programada

```html
<div class="resumen-producto">
    <div class="metrica">
        <label>Progreso (Asignación)</label>
        <div class="progress">
            <div class="progress-bar" [style.width.%]="(150/150)*100"></div>
        </div>
        <small>150 de 150 distribuidos en actividades</small>
    </div>
    
    <div class="metrica">
        <label>Ejecución (Cumplimiento)</label>
        <div class="progress">
            <div class="progress-bar bg-success" [style.width.%]="(0/150)*100"></div>
        </div>
        <small>0 de 150 ejecutados con evidencia</small>
    </div>
</div>
```

### Paso 4: Validar Flujo Completo (20 min)

1. Crear actividad 1 (meta = 100)
   - Verificar: Progreso = 50%, Ejecución = 0%, Estado = EN_PROGRESO

2. Crear actividad 2 (meta = 50)
   - Verificar: Progreso = 100%, Ejecución = 0%, Estado = EN_PROGRESO

3. Agregar evidencia a actividad 1
   - Verificar: Progreso = 100%, Ejecución = 50%, Estado = EN_PROGRESO

4. Agregar evidencia a actividad 2
   - Verificar: Progreso = 100%, Ejecución = 100%, Estado = COMPLETADO

---

## 📊 FÓRMULAS FINALES

```
meta_programada = programacion_XXXX (del producto)

meta_asignada = SUM(actividad.meta_ejecutar 
                     WHERE codigo_producto = X 
                     AND anio = XXXX)

meta_ejecutada = SUM(actividad.meta_ejecutar 
                     WHERE codigo_producto = X 
                     AND anio = XXXX 
                     AND evidencia IS NOT NULL)

progreso = (meta_asignada / meta_programada) * 100

ejecucion = (meta_ejecutada / meta_programada) * 100

estado = 
  IF meta_asignada = 0: 'PENDIENTE'
  ELSE IF meta_ejecutada < meta_programada: 'EN_PROGRESO'
  ELSE IF meta_ejecutada = meta_programada: 'COMPLETADO'
  ELSE: 'EN_PROGRESO'
```

---

## ✅ VALIDACIÓN FINAL

Una vez completados los pasos anteriores, el sistema debe cumplir:

- ✅ Crear múltiples actividades distribuye la meta correctamente
- ✅ Progreso y ejecución se calculan independientemente
- ✅ Estado cambia correctamente según cumplimiento
- ✅ Evidencias se guardan correctamente
- ✅ UI muestra ambas métricas de forma clara
- ✅ No hay errores CORS
- ✅ No hay errores 500 en backend

---

**Plan de validación creado por:** AI Assistant  
**Timestamp:** 2025-11-11 05:50:00 UTC  
**Próximo paso:** Implementar correcciones según pasos 2-4