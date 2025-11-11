# AUDITORÍA DE RUTAS: FRONTEND vs BACKEND

## 📊 ANÁLISIS COMPLETO

**Fecha:** 10 de noviembre de 2025  
**Objetivo:** Validar que todas las rutas usadas por el frontend existan en el backend

---

## ✅ RUTAS VALIDADAS (FUNCIONAN CORRECTAMENTE)

### **1. Autenticación (`/auth`)**
| Frontend | Backend | Estado |
|----------|---------|--------|
| `POST /auth/login` | ✅ `@router.post("/login")` | ✅ OK |
| `POST /auth/register` | ✅ `@router.post("/register")` | ✅ OK |
| `POST /auth/register-ciudadano` | ✅ `@router.post("/register-ciudadano")` | ✅ OK |
| `GET /auth/me` | ✅ `@router.get("/me")` | ✅ OK |
| `GET /auth/users` | ✅ `@router.get("/users")` | ✅ OK |

---

### **2. Entidades (`/entities`)**
| Frontend | Backend | Estado |
|----------|---------|--------|
| `GET /entities/` | ✅ `@router.get("/")` | ✅ OK |
| `GET /entities/public` | ✅ `@router.get("/public")` | ✅ OK |
| `GET /entities/{id}` | ✅ `@router.get("/{entity_id}")` | ✅ OK |
| `GET /entities/by-slug/{slug}` | ✅ `@router.get("/by-slug/{slug}")` | ✅ OK |
| `POST /entities/` | ✅ `@router.post("/")` | ✅ OK |
| `PUT /entities/{id}` | ✅ `@router.put("/{entity_id}")` | ✅ OK |
| `DELETE /entities/{id}` | ✅ `@router.delete("/{entity_id}")` | ✅ OK |
| `PATCH /entities/{id}/toggle-status` | ✅ `@router.patch("/{entity_id}/toggle-status")` | ✅ OK |
| `GET /entities/{id}/users` | ✅ `@router.get("/{entity_id}/users")` | ✅ OK |

---

### **3. Usuarios (`/users`)**
| Frontend | Backend | Estado |
|----------|---------|--------|
| `GET /users/` | ✅ `@router.get("/users/")` | ✅ OK |
| `GET /users/{id}/` | ✅ `@router.get("/users/{user_id}/")` | ✅ OK |
| `POST /users/` | ✅ `@router.post("/users/")` | ✅ OK |
| `PUT /users/{id}/` | ✅ `@router.put("/users/{user_id}/")` | ✅ OK |
| `DELETE /users/{id}/` | ✅ `@router.delete("/users/{user_id}/")` | ✅ OK |
| `PATCH /users/{id}/toggle-status/` | ✅ `@router.patch("/users/{user_id}/toggle-status/")` | ✅ OK |
| `GET /users/?role=secretario` | ✅ Soportado por `@router.get("/users/")` con params | ✅ OK |
| `POST /users/{id}/change-password/` | ✅ `@router.post("/users/{user_id}/change-password/")` | ✅ OK |
| `PATCH /users/{id}/modules/` | ✅ `@router.patch("/users/{user_id}/modules/")` | ✅ OK |
| `GET /users/secretarias/` | ✅ `@router.get("/users/secretarias/")` | ⚠️ **DEPRECATED** |

**Nota:** La ruta `/users/secretarias/` usa el campo `user.secretaria` que fue eliminado.

---

### **4. Secretarías (`/secretarias`)**
| Frontend | Backend | Estado |
|----------|---------|--------|
| `GET /secretarias/` | ✅ `@router.get("/secretarias/")` | ✅ OK |
| `POST /secretarias/` | ✅ `@router.post("/secretarias/")` | ✅ OK |
| `PATCH /secretarias/{id}/toggle/` | ✅ `@router.patch("/secretarias/{id}/toggle/")` | ✅ OK |

---

### **5. PQRS (`/pqrs`)**
| Frontend | Backend | Estado |
|----------|---------|--------|
| `POST /pqrs/` | ✅ `@router.post("/")` | ✅ OK |
| `GET /pqrs/` | ✅ `@router.get("/")` | ✅ OK |
| `GET /pqrs/{id}` | ✅ `@router.get("/{pqrs_id}")` | ✅ OK |
| `PUT /pqrs/{id}` | ✅ `@router.put("/{pqrs_id}")` | ✅ OK |
| `POST /pqrs/{id}/assign` | ✅ `@router.post("/{pqrs_id}/assign")` | ✅ OK |
| `POST /pqrs/{id}/respond` | ✅ `@router.post("/{pqrs_id}/respond")` | ✅ OK |
| `DELETE /pqrs/{id}` | ✅ `@router.delete("/{pqrs_id}")` | ✅ OK |
| `GET /pqrs/public/consultar/{radicado}` | ✅ `@router.get("/public/consultar/{numero_radicado}")` | ✅ OK |

---

### **6. Alertas (`/alerts`)**
| Frontend | Backend | Estado |
|----------|---------|--------|
| `GET /alerts/` | ✅ `@router.get("/")` | ✅ OK |
| `POST /alerts/{id}/read` | ✅ `@router.post("/{alert_id}/read")` | ✅ OK |
| `POST /alerts/read-all` | ✅ `@router.post("/read-all")` | ✅ OK |

---

### **7. PDM v2 (`/pdm/v2`)**
| Frontend | Backend | Estado |
|----------|---------|--------|
| `GET /pdm/v2/{slug}/status` | ✅ `@router.get("/{slug}/status")` | ✅ OK |
| `GET /pdm/v2/{slug}/data` | ✅ `@router.get("/{slug}/data")` | ⚠️ **ERRORES** |
| `POST /pdm/v2/{slug}/upload` | ✅ `@router.post("/{slug}/upload")` | ⚠️ **ERRORES** |
| `GET /pdm/v2/{slug}/actividades/{codigo}` | ✅ `@router.get("/{slug}/actividades/{codigo_producto}")` | ✅ OK |
| `POST /pdm/v2/{slug}/actividades` | ✅ `@router.post("/{slug}/actividades")` | ✅ OK |
| `PUT /pdm/v2/{slug}/actividades/{id}` | ✅ `@router.put("/{slug}/actividades/{actividad_id}")` | ✅ OK |
| `DELETE /pdm/v2/{slug}/actividades/{id}` | ✅ `@router.delete("/{slug}/actividades/{actividad_id}")` | ✅ OK |
| `POST /pdm/v2/{slug}/actividades/{id}/evidencia` | ✅ `@router.post("/{slug}/actividades/{actividad_id}/evidencia")` | ✅ OK |
| `GET /pdm/v2/{slug}/actividades/{id}/evidencia` | ✅ `@router.get("/{slug}/actividades/{actividad_id}/evidencia")` | ✅ OK |
| `PATCH /pdm/v2/{slug}/productos/{codigo}/responsable` | ✅ `@router.patch("/{slug}/productos/{codigo_producto}/responsable")` | ⚠️ **USA CAMPO LEGACY** |
| `GET /pdm/v2/{slug}/mis-actividades` | ✅ `@router.get("/{slug}/mis-actividades")` | ✅ OK |

**⚠️ Problemas detectados:**
- Las rutas `upload` y `data` usan las tablas `PdmLineaEstrategica`, `PdmIndicadorResultado`, `PdmIniciativaSGR` que fueron **eliminadas**
- La ruta `responsable` asigna al campo `producto.responsable` (String) que fue **eliminado**

---

### **8. Planes Institucionales (`/planes`)**
| Frontend | Backend | Estado |
|----------|---------|--------|
| `GET /planes/` | ✅ `@router.get("/")` | ✅ OK |
| `GET /planes/{id}` | ✅ `@router.get("/{plan_id}")` | ✅ OK |
| `GET /planes/{id}/completo` | ✅ `@router.get("/{plan_id}/completo")` | ✅ OK |
| `POST /planes/` | ✅ `@router.post("/")` | ✅ OK |
| `PUT /planes/{id}` | ✅ `@router.put("/{plan_id}")` | ✅ OK |
| `DELETE /planes/{id}` | ✅ `@router.delete("/{plan_id}")` | ✅ OK |
| `GET /planes/{id}/estadisticas` | ✅ `@router.get("/{plan_id}/estadisticas")` | ✅ OK |
| `GET /planes/{id}/componentes` | ✅ `@router.get("/{plan_id}/componentes")` | ✅ OK |
| `POST /planes/{id}/componentes` | ✅ `@router.post("/{plan_id}/componentes")` | ✅ OK |
| `PUT /planes/componentes/{id}` | ✅ `@router.put("/componentes/{componente_id}")` | ✅ OK |
| `DELETE /planes/componentes/{id}` | ✅ `@router.delete("/componentes/{componente_id}")` | ✅ OK |
| `GET /planes/componentes/{id}/actividades` | ✅ `@router.get("/componentes/{componente_id}/actividades")` | ⚠️ **USA user.secretaria** |
| `POST /planes/componentes/{id}/actividades` | ✅ `@router.post("/componentes/{componente_id}/actividades")` | ⚠️ **USA user.secretaria** |
| `GET /planes/actividades/{id}` | ✅ `@router.get("/actividades/{actividad_id}")` | ✅ OK |
| `GET /planes/actividades/{id}/completa` | ✅ `@router.get("/actividades/{actividad_id}/completa")` | ✅ OK |
| `PUT /planes/actividades/{id}` | ✅ `@router.put("/actividades/{actividad_id}")` | ✅ OK |
| `DELETE /planes/actividades/{id}` | ✅ `@router.delete("/actividades/{actividad_id}")` | ✅ OK |
| `GET /planes/actividades/{id}/ejecuciones` | ✅ `@router.get("/actividades/{actividad_id}/ejecuciones")` | ✅ OK |
| `POST /planes/actividades/{id}/ejecuciones` | ✅ `@router.post("/actividades/{actividad_id}/ejecuciones")` | ⚠️ **USA user.secretaria** |
| `PUT /planes/ejecuciones/{id}` | ✅ `@router.put("/ejecuciones/{ejecucion_id}")` | ✅ OK |
| `DELETE /planes/ejecuciones/{id}` | ✅ `@router.delete("/ejecuciones/{ejecucion_id}")` | ✅ OK |
| `POST /planes/actividades/ejecuciones/{id}/evidencias` | ✅ `@router.post("/actividades/ejecuciones/{ejecucion_id}/evidencias")` | ✅ OK |
| `GET /planes/actividades/ejecuciones/{id}/evidencias` | ✅ `@router.get("/actividades/ejecuciones/{ejecucion_id}/evidencias")` | ✅ OK |
| `DELETE /planes/evidencias/{id}` | ✅ `@router.delete("/evidencias/{evidencia_id}")` | ✅ OK |

**⚠️ Problemas detectados:**
- Varias rutas usan `user.secretaria` y `actividad.responsable` (String) para autorización - **campos eliminados**

---

### **9. BPIN (Banco de Proyectos)**
| Frontend | Backend | Estado |
|----------|---------|--------|
| `GET /bpin/{bpin}` | ✅ `@router.get("/{bpin}")` | ✅ OK |

---

### **10. Contratación**
| Frontend | Backend | Estado |
|----------|---------|--------|
| `GET /contratacion/proxy` | ✅ `@router.get("/proxy")` | ✅ OK |
| `POST /contratacion/summary` | ✅ `@router.post("/summary")` | ✅ OK |

---

### **11. Showcase**
| Frontend | Backend | Estado |
|----------|---------|--------|
| `GET /showcase` | ✅ `@router.get("")` | ✅ OK |

---

### **12. IA/Reportes**
| Frontend | Backend | Estado |
|----------|---------|--------|
| `POST /ai/generate-report` | ❌ **NO ENCONTRADA** | 🔴 ERROR |

**⚠️ Problema:** El frontend llama a `/ai/generate-report` pero no existe en el backend.

---

## 🔴 RUTAS CON ERRORES CRÍTICOS

### **1. PDM - Tablas eliminadas**

**Rutas afectadas:**
- `GET /pdm/v2/{slug}/data` (líneas 226-246 en pdm_v2.py)
- `POST /pdm/v2/{slug}/upload` (líneas 143-187 en pdm_v2.py)

**Error:** Intentan usar `PdmLineaEstrategica`, `PdmIndicadorResultado`, `PdmIniciativaSGR` que fueron eliminadas.

**Impacto:** 🔴 **RUNTIME ERROR** - La aplicación crasheará al llamar estas rutas.

**Solución:**
```python
# Eliminar líneas 143-187 (upsert de tablas eliminadas)
# Simplificar líneas 226-246:
@router.get("/{slug}/data", response_model=schemas.PDMDataResponse)
async def get_pdm_data(slug: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    entity = get_entity_or_404(db, slug)
    ensure_user_can_manage_entity(current_user, entity)
    
    productos = db.query(PdmProducto).filter(PdmProducto.entity_id == entity.id).all()
    
    return schemas.PDMDataResponse(
        productos_plan_indicativo=[schemas.ProductoResponse.model_validate(p) for p in productos]
    )
```

---

### **2. PDM - Campo responsable eliminado**

**Ruta afectada:**
- `PATCH /pdm/v2/{slug}/productos/{codigo}/responsable` (línea 567 en pdm_v2.py)

**Error:** Asigna a `producto.responsable` (String) que fue eliminado.

**Código problemático:**
```python
producto.responsable = usuario.full_name or usuario.name  # ❌ Campo no existe
```

**Solución:**
```python
# Eliminar la línea 567, solo mantener:
producto.responsable_user_id = responsable_user_id
```

---

### **3. Planes - Campo user.secretaria eliminado**

**Rutas afectadas:**
- `GET /planes/componentes/{id}/actividades` (líneas 546-547)
- `POST /planes/componentes/{id}/actividades` (línea 641)
- `POST /planes/actividades/{id}/ejecuciones` (línea 880)

**Error:** Usan `current_user.secretaria` y `User.secretaria` que fueron eliminados.

**Código problemático:**
```python
# Línea 546-547
if current_user.role == UserRole.SECRETARIO and current_user.secretaria:
    query = query.filter(Actividad.responsable == current_user.secretaria)

# Línea 641
User.secretaria == nueva_actividad.responsable

# Línea 880
detail=f"Solo puedes registrar avances en actividades asignadas a tu secretaría ({current_user.secretaria})..."
```

**Solución:** Migrar a usar `secretaria_id` (FK):
```python
# Opción 1: Usar secretaria_id si existe
if current_user.role == UserRole.SECRETARIO and current_user.secretaria_id:
    query = query.filter(Actividad.responsable_secretaria_id == current_user.secretaria_id)

# Opción 2: Cambiar modelo Actividad para usar FK en vez de String
```

**⚠️ Requiere:** Cambiar `Actividad.responsable` (String) a `Actividad.responsable_secretaria_id` (FK).

---

### **4. PQRS - Campo user.cedula eliminado**

**Rutas afectadas:**
- `POST /pqrs/` (línea 41)
- `GET /pqrs/` (línea 170)

**Error:** Usan `current_user.cedula` que fue eliminado.

**Código problemático:**
```python
# Línea 41
pqrs_data.cedula_ciudadano = current_user.cedula or current_user.username

# Línea 170
(PQRS.cedula_ciudadano == current_user.cedula) |
```

**Solución:**
```python
# Línea 41: Usar solo username
pqrs_data.cedula_ciudadano = current_user.username

# Línea 170: Eliminar condición
.filter(
    (PQRS.created_by_id == current_user.id) |
    (PQRS.email_ciudadano == current_user.email)
)
```

---

### **5. Auth - Campo user.cedula eliminado**

**Rutas afectadas:**
- `POST /auth/register` (líneas 109, 123)

**Error:** Valida duplicados por `cedula` que no existe.

**Código problemático:**
```python
# Línea 109
existing_user = db.query(User).filter(
    (User.username == user_data.username) |
    (User.email == user_data.email) |
    (User.cedula == user_data.cedula)  # ❌ Campo no existe
).first()
```

**Solución:**
```python
# Eliminar validación de cedula
existing_user = db.query(User).filter(
    (User.username == user_data.username) |
    (User.email == user_data.email)
).first()
```

---

### **6. Ruta IA faltante**

**Ruta faltante:** `POST /ai/generate-report`

**Usado en:** `frontend/src/app/services/ai.service.ts` línea 142

**Error:** El frontend llama a esta ruta pero **no existe en el backend**.

**Solución:** Crear la ruta o eliminar la llamada del frontend.

---

## 📊 RESUMEN DE ESTADO

| Categoría | Total Rutas | ✅ OK | ⚠️ Warnings | 🔴 Errores |
|-----------|-------------|-------|-------------|-----------|
| Auth | 5 | 5 | 0 | 0 |
| Entities | 9 | 9 | 0 | 0 |
| Users | 9 | 8 | 1 | 0 |
| Secretarías | 3 | 3 | 0 | 0 |
| PQRS | 8 | 6 | 0 | 2 |
| Alertas | 3 | 3 | 0 | 0 |
| PDM v2 | 11 | 8 | 0 | 3 |
| Planes | 23 | 20 | 0 | 3 |
| BPIN | 1 | 1 | 0 | 0 |
| Contratación | 2 | 2 | 0 | 0 |
| Showcase | 1 | 1 | 0 | 0 |
| IA | 1 | 0 | 0 | 1 |
| **TOTAL** | **76** | **66** | **1** | **9** |

**Tasa de éxito:** 87% (66/76)  
**Rutas con problemas:** 13% (10/76)

---

## 🚨 ACCIONES REQUERIDAS

### **CRÍTICO (Previene despliegue)**
1. ✅ Corregir rutas PDM que usan tablas eliminadas (líneas 143-187, 226-246)
2. ✅ Eliminar asignación a `producto.responsable` (línea 567)
3. ✅ Corregir rutas PQRS que usan `user.cedula` (líneas 41, 170)
4. ✅ Corregir auth que valida `user.cedula` (líneas 109, 123)

### **IMPORTANTE (Causa errores en runtime)**
5. ⚠️ Migrar planes a usar `secretaria_id` en vez de `user.secretaria` (3 rutas)
6. ⚠️ Crear ruta `/ai/generate-report` o eliminar del frontend

### **OPCIONAL (Deprecación)**
7. 🔵 Deprecar `/users/secretarias/` (usa campo eliminado)

---

## ✅ PLAN DE CORRECCIÓN INMEDIATA

Ver archivo: `CORRECCIONES_PENDIENTES_PDM.md`

