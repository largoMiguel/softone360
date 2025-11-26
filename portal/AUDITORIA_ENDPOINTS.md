# 📊 AUDITORÍA DE ENDPOINTS - SoftOne360

**Fecha:** $(date +%Y-%m-%d)
**Total endpoints encontrados:** 95

---

## 🚨 **HALLAZGOS CRÍTICOS**

### ❌ **ENDPOINTS OBSOLETOS PARA ELIMINAR**

#### 1. **`/setup/run-migration-005`** y **`/setup/run-migration-006`**
**Archivo:** `backend/app/routes/setup.py` (líneas 211-244)
**Razón:**
- Migraciones ya ejecutadas en producción
- No deben estar expuestas en API production
- Riesgo de seguridad: pueden ser invocadas accidentalmente
- **RECOMENDACIÓN:** Eliminar estos endpoints. Las migraciones se ejecutan vía scripts SSH siguiendo la guía de AWS.

**Impacto:** 🔴 **ALTO** - Riesgo de seguridad

---

#### 2. **`/setup/create-initial-data`**
**Archivo:** `backend/app/routes/setup.py` (línea 20)
**Razón:**
- Endpoint de desarrollo/setup inicial
- Innecesario en producción con datos reales
- Sin autenticación robusta
- **RECOMENDACIÓN:** Mover a scripts administrativos o agregar autenticación SUPERADMIN

**Impacto:** 🟠 **MEDIO** - Puede crear datos duplicados

---

#### 3. **`/setup/fix-superadmin`**
**Archivo:** `backend/app/routes/setup.py` (línea 129)
**Razón:**
- Endpoint de mantenimiento temporal
- Ya cumplió su función
- **RECOMENDACIÓN:** Eliminar o proteger con autenticación SUPERADMIN + secret key

**Impacto:** 🟠 **MEDIO**

---

### ⚠️ **ENDPOINTS DUPLICADOS O REDUNDANTES**

#### 4. **`/auth/users` vs `/users/`**
**Archivos:** 
- `backend/app/routes/auth.py` (línea 133)
- `backend/app/routes/users.py` (línea 75)

**Problema:**
- Ambos retornan lista de usuarios
- Funcionalidad duplicada
- **RECOMENDACIÓN:** Eliminar `/auth/users` y usar solo `/users/` (más específico, mejor filtrado)

**Impacto:** 🟡 **BAJO** - Confusión en API

---

#### 5. **Múltiples proxies de datos.gov.co sin consolidación**
**Archivo:** `backend/app/routes/contratacion.py`
- `/contratacion/proxy` (SECOP II - contratos)
- `/contratacion/proxy-secop1` (SECOP I)
- `/contratacion/proxy-secop2-procesos` (SECOP II - procesos)

**Problema:**
- 3 endpoints con lógica casi idéntica (solo cambia URL base)
- Código repetido ~200 líneas

**Solución propuesta:**
```python
@router.get("/proxy/{dataset}")
async def proxy_datos_gov_unified(
    dataset: Literal["secop1", "secop2", "secop2-procesos"],
    query: Optional[str] = None,
    ...
):
    # Mapeo de datasets a URLs
    DATASET_URLS = {
        "secop1": "https://www.datos.gov.co/resource/f789-7hwg.json",
        "secop2": "https://www.datos.gov.co/resource/jbjy-vk9h.json",
        "secop2-procesos": "https://www.datos.gov.co/resource/p6dx-8zbt.json"
    }
    url = DATASET_URLS[dataset]
    # ... resto de lógica compartida
```

**Impacto:** 🟠 **MEDIO** - Mantenibilidad y DRY principle

---

### 🐌 **CUELLOS DE BOTELLA IDENTIFICADOS**

#### 6. **`/pqrs/` (GET) - Lista completa sin paginación obligatoria**
**Archivo:** `backend/app/routes/pqrs.py` (línea 199)

**Problema:**
- Puede retornar miles de registros sin límite
- No tiene paginación obligatoria
- Joins con Entity, User, Secretaria (N+1 potencial)

**Solución:**
```python
@router.get("/", response_model=List[PQRSWithDetails])
async def get_pqrs(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),  # ← OBLIGATORIO
    ...
):
    query = query.offset(skip).limit(limit)
```

**Impacto:** 🔴 **ALTO** - Performance con >1000 PQRS

---

#### 7. **`/planes/` (GET) - Sin eager loading**
**Archivo:** `backend/app/routes/planes.py` (línea 177)

**Problema:**
- Retorna lista de planes sin `joinedload()`
- Frontend puede necesitar datos relacionados (componentes, actividades)
- Genera queries adicionales (N+1)

**Solución:**
```python
from sqlalchemy.orm import joinedload

planes = db.query(Plan).options(
    joinedload(Plan.componentes)
).filter(...).all()
```

**Impacto:** 🟠 **MEDIO** - Escalabilidad

---

#### 8. **`/contratacion/summary` - Sin timeout en OpenAI**
**Archivo:** `backend/app/routes/contratacion.py` (línea 256)

**Problema:**
- Llamada a OpenAI sin timeout explícito
- Si OpenAI se demora >30s, puede bloquear el worker
- No hay fallback si quota excedida

**Solución:**
```python
resp = client.chat.completions.create(
    ...,
    timeout=10  # ← AGREGAR
)
```

**Impacto:** 🟡 **BAJO** - UX (ya tiene try/except)

---

### 📦 **OPTIMIZACIONES IMPLEMENTADAS** ✅

#### Ya optimizado: `/pdm/{slug}/data`
- ✅ Bulk loading de actividades
- ✅ Payload reducido 80% (sin presupuesto JSON)
- ✅ Índices compuestos en DB
- ✅ Cálculo de porcentaje_ejecucion en backend

---

## 📋 **RECOMENDACIONES PRIORITARIAS**

### 🔴 **Prioridad ALTA** (Implementar esta semana)

1. **Eliminar endpoints de migraciones** (`/setup/run-migration-*`)
   - Script: Comentar o eliminar líneas 211-244 en `setup.py`
   - Testing: Verificar que no se usan en frontend

2. **Agregar paginación obligatoria a `/pqrs/`**
   - Evitar cargas completas de +1000 registros
   - Límite máximo: 500 por request

3. **Proteger `/setup/*` con autenticación SUPERADMIN**
   - Agregar dependencia `Depends(get_current_superadmin)`

---

### 🟠 **Prioridad MEDIA** (Próximo sprint)

4. **Consolidar proxies de datos.gov.co**
   - Reducir de 3 endpoints a 1 con parámetro `dataset`
   - Eliminar ~150 líneas de código duplicado

5. **Agregar eager loading en `/planes/`**
   - Usar `joinedload()` para relaciones frecuentes
   - Medir mejora con profiling

6. **Eliminar `/auth/users` duplicado**
   - Usar solo `/users/` con filtros

---

### 🟡 **Prioridad BAJA** (Backlog)

7. **Agregar timeout a OpenAI calls**
8. **Documentar endpoints con OpenAPI tags mejorados**
9. **Agregar health check endpoint (`/health`)**

---

## 📊 **MÉTRICAS DE LA AUDITORÍA**

| Categoría | Cantidad |
|-----------|----------|
| Total endpoints | 95 |
| Obsoletos detectados | 3 |
| Duplicados detectados | 4 |
| Cuellos de botella | 3 |
| Optimizados previamente | 1 (PDM) |
| **Endpoints a eliminar** | **3** |
| **Endpoints a refactorizar** | **4** |

---

## 🎯 **IMPACTO ESTIMADO**

| Acción | Líneas eliminadas | Mejora performance | Riesgo reducido |
|--------|-------------------|-------------------|-----------------|
| Eliminar `/setup/run-migration-*` | ~35 | - | ✅ Alto |
| Paginación `/pqrs/` | +5 | ⚡ 10-50x | ✅ Medio |
| Consolidar proxies | -150 | - | ✅ Bajo |
| Eager loading `/planes/` | +3 | ⚡ 2-5x | ✅ Bajo |

**Total líneas reducidas:** ~180  
**Mejora estimada en performance crítica:** 10-50x en endpoints de lista

---

## 🔧 **PRÓXIMOS PASOS**

1. ✅ Revisar este documento con el equipo
2. ⏳ Priorizar eliminación de endpoints obsoletos
3. ⏳ Implementar paginación en PQRS
4. ⏳ Testing en staging antes de deploy
5. ⏳ Actualizar documentación de API

---

**Generado por:** GitHub Copilot  
**Versión:** 2025-01-23
