# 🔧 AUDITORÍA - Error Actividades PDM

**Fecha:** 11 de noviembre de 2025  
**Errores Encontrados:**
1. ❌ CORS bloqueado en endpoint de actividades
2. ❌ 500 Internal Server Error al GET actividades
3. ❌ Evidencias endpoint no existe o tiene problemas

---

## 🐛 Error 1: CORS Bloqueado

### Síntoma
```
Access to XMLHttpRequest at 'http://softone-backend-useast1.eba-epvnmbmk.us-east-1.elasticbeanstalk.com/api/pdm/v2/alcaldia-de-prueba/actividades/2201029' 
from origin 'http://softone360-frontend-useast1.s3-website-us-east-1.amazonaws.com' 
has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header
```

### Causa
El origen S3 no está en la lista blanca de CORS del backend.

### Solución
Necesitamos agregar el origen S3 a los CORS.

---

## 🐛 Error 2: 500 Internal Server Error

### Síntoma
```
GET http://softone-backend-useast1.eba-epvnmbmk.us-east-1.elasticbeanstalk.com/api/pdm/v2/alcaldia-de-prueba/actividades/2201029 
net::ERR_FAILED 500 (Internal Server Error)
```

### Causa Probable
El schema `ActividadResponse` tiene un campo `updated_at` obligatorio, pero cuando se valida con Pydantic y falla, o hay otro problema de serialización.

### Solución Recomendada
```python
# Hacer updated_at opcional en ActividadResponse
class ActividadResponse(ActividadResponseBase):
    id: int
    entity_id: int
    evidencia: Optional[EvidenciaResponse] = None
    created_at: datetime
    updated_at: Optional[datetime] = None  # ← Hacer opcional
```

---

## 🔍 Análisis de Rutas

### Rutas Existentes en Backend
✅ GET `/{slug}/data` - Retorna productos (FUNCIONA)
✅ GET `/{slug}/actividades/{codigo_producto}` - Obtiene actividades
✅ GET `/{slug}/mis-actividades` - Actividades del usuario
✅ POST `/{slug}/actividades` - Crear actividad
✅ PUT `/{slug}/actividades/{actividad_id}` - Actualizar actividad
✅ DELETE `/{slug}/actividades/{actividad_id}` - Eliminar actividad

### Rutas de Evidencias
⚠️ NO ENCONTRADAS - Necesita crear endpoints para evidencias

---

## ✅ Plan de Fixes

1. **Fix CORS:**
   - Agregar origen S3 a CORS configuración
   
2. **Fix Actividades Schema:**
   - Hacer `updated_at` opcional en ActividadResponse
   - Agregar try-catch en endpoint

3. **Crear Endpoints de Evidencias:**
   - POST `/{slug}/actividades/{actividad_id}/evidencias`
   - GET `/{slug}/actividades/{actividad_id}/evidencias`
   - PUT `/{slug}/actividades/{actividad_id}/evidencias`
   - DELETE `/{slug}/actividades/{actividad_id}/evidencias`

---

## 📋 Checklist

- [ ] Fix CORS
- [ ] Fix Schema ActividadResponse
- [ ] Crear endpoints de evidencias
- [ ] Test actividades endpoint
- [ ] Test evidencias endpoint
- [ ] Deploy backend
