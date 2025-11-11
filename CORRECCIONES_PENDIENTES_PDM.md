# CORRECCIONES PENDIENTES - RUTAS PDM

## ⚠️ ADVERTENCIA
Se eliminaron los modelos `PdmLineaEstrategica`, `PdmIndicadorResultado`, `PdmIniciativaSGR` de la base de datos, pero aún hay **referencias en el código** que causarán errores en runtime.

## 🔴 ARCHIVOS CON REFERENCIAS A MODELOS ELIMINADOS

### 1. `backend/app/routes/pdm_v2.py`

**Ubicaciones:**
- **Línea 146-158**: Upsert de líneas estratégicas (en `upload_pdm_data()`)
- **Línea 162-173**: Upsert de indicadores resultado
- **Línea 176-187**: Upsert de iniciativas SGR
- **Línea 226-228**: Query líneas estratégicas (en `get_pdm_data()`)
- **Línea 230-232**: Query indicadores resultado
- **Línea 234-236**: Query iniciativas SGR
- **Línea 243-246**: Construcción del response con las 3 tablas eliminadas

**Solución:**
```python
# ELIMINAR TODO EL BLOQUE DE UPSERT (líneas 143-187)
# Dejar solo el upsert de productos (líneas 189-206)

# SIMPLIFICAR get_pdm_data() (líneas 218-246):
@router.get("/{slug}/data", response_model=schemas.PDMDataResponse)
async def get_pdm_data(
    slug: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Obtiene todos los datos del PDM cargados"""
    entity = get_entity_or_404(db, slug)
    ensure_user_can_manage_entity(current_user, entity)
    
    productos = db.query(PdmProducto).filter(
        PdmProducto.entity_id == entity.id
    ).all()
    
    return schemas.PDMDataResponse(
        productos_plan_indicativo=[schemas.ProductoResponse.model_validate(p) for p in productos]
    )
```

---

### 2. `backend/app/routes/pdm_v2.py` - Línea 567

**Problema:**
```python
producto.responsable = usuario.full_name or usuario.name  # Campo eliminado
```

**Solución:**
```python
# ELIMINAR esta línea - el campo responsable ya no existe
# Solo asignar responsable_user_id:
producto.responsable_user_id = responsable_user_id
```

---

## 🟠 REFERENCIAS A user.secretaria (eliminado)

### 1. `backend/app/routes/planes.py`

**Líneas afectadas:**
- **103, 144**: `actividad.responsable == user.secretaria`
- **546-547**: `if current_user.secretaria: query.filter(Actividad.responsable == current_user.secretaria)`
- **641**: `User.secretaria == nueva_actividad.responsable`
- **880**: Mensaje de error usando `current_user.secretaria`

**Contexto:** Sistema de planes institucionales usa `secretaria` (String) para autorización, pero ese campo fue eliminado.

**Soluciones posibles:**
1. **Opción A (recomendada)**: Cambiar a usar `secretaria_id` (FK)
   ```python
   # En vez de:
   actividad.responsable == user.secretaria
   # Usar:
   actividad.responsable_secretaria_id == user.secretaria_id
   ```
   
2. **Opción B**: Agregar campo `responsable_secretaria_id` en modelo `Actividad` y relacionar con tabla `secretarias`

**PROBLEMA:** El modelo `Actividad` (plan.py) usa `responsable: str` en vez de FK. Requiere migración del esquema.

---

### 2. `backend/app/routes/users.py` - Líneas 29-31

**Código:**
```python
query = db.query(User.secretaria).filter(
    User.secretaria.isnot(None),
    User.secretaria != ""
)
```

**Solución:**
```python
# Cambiar a usar la tabla secretarias con JOIN:
query = db.query(Secretaria.nombre).join(
    User, User.secretaria_id == Secretaria.id
).filter(
    Secretaria.is_active == True
).distinct()
```

---

### 3. `backend/app/routes/auth.py` - Líneas 109, 123

**Código:**
```python
(User.cedula == user_data.cedula)  # Línea 109
elif existing_user.cedula == user_data.cedula:  # Línea 123
```

**Problema:** Campo `cedula` eliminado de User.

**Contexto:** Validación de usuarios duplicados en registro.

**Solución:**
```python
# Si cedula ya no está en User, eliminar esta validación:
# ANTES:
existing_user = db.query(User).filter(
    (User.username == user_data.username) |
    (User.email == user_data.email) |
    (User.cedula == user_data.cedula)
).first()

# DESPUÉS:
existing_user = db.query(User).filter(
    (User.username == user_data.username) |
    (User.email == user_data.email)
).first()
```

---

### 4. `backend/app/routes/pqrs.py` - Líneas 41, 170

**Código:**
```python
pqrs_data.cedula_ciudadano = current_user.cedula or current_user.username  # Línea 41
(PQRS.cedula_ciudadano == current_user.cedula) |  # Línea 170
```

**Problema:** `current_user.cedula` no existe.

**Solución:**
```python
# Línea 41: Usar solo username
pqrs_data.cedula_ciudadano = current_user.username

# Línea 170: Eliminar condición de cedula
# ANTES:
.filter(
    (PQRS.created_by_id == current_user.id) |
    (PQRS.cedula_ciudadano == current_user.cedula) |
    (PQRS.email_ciudadano == current_user.email)
)
# DESPUÉS:
.filter(
    (PQRS.created_by_id == current_user.id) |
    (PQRS.email_ciudadano == current_user.email)
)
```

---

## 📊 RESUMEN DE CORRECCIONES NECESARIAS

| Archivo | Líneas | Acción | Prioridad |
|---------|--------|--------|-----------|
| `routes/pdm_v2.py` | 143-187, 226-246, 567 | Eliminar lógica de tablas PDM eliminadas | 🔴 CRÍTICA |
| `routes/planes.py` | 103, 144, 546-547, 641, 880 | Migrar de `user.secretaria` a `secretaria_id` | 🟠 ALTA |
| `routes/users.py` | 29-31 | Cambiar query a tabla secretarias | 🟠 ALTA |
| `routes/auth.py` | 109, 123 | Eliminar validación de `cedula` | 🟡 MEDIA |
| `routes/pqrs.py` | 41, 170 | Eliminar referencias a `user.cedula` | 🟡 MEDIA |

---

## 🎯 DECISIÓN ARQUITECTURAL REQUERIDA

### **Planes Institucionales - Sistema de autorización**

**Problema actual:**
- `Actividad.responsable` es String (nombre de secretaría)
- `User.secretaria` era String (eliminado)
- No hay FK entre User → Secretaria en contexto de planes

**Opciones:**

1. **Mantener String** (menos cambios, pero menos robusto)
   - Re-agregar `User.secretaria` como campo opcional
   - Mantener `Actividad.responsable` como String
   - ✅ Pro: Menos cambios
   - ❌ Contra: Inconsistencia, sin integridad referencial

2. **Migrar a FK** (correcto arquitecturalmente)
   - Agregar `User.secretaria_id` → `Secretaria.id`
   - Agregar `Actividad.responsable_secretaria_id` → `Secretaria.id`
   - ✅ Pro: Integridad, consistencia
   - ❌ Contra: Requiere migración de datos, más cambios

**Recomendación:** Opción 2 - Migrar a FK para tener un sistema robusto.

---

## ✅ CORRECCIONES YA APLICADAS

- ✅ `models/user.py`: Eliminados campos `secretaria`, `cedula`, `telefono`, `direccion`
- ✅ `models/pdm.py`: Eliminado campo `responsable` (String) de `PdmProducto` y `PdmActividad`
- ✅ `models/pdm.py`: Eliminadas tablas `PdmLineaEstrategica`, `PdmIndicadorResultado`, `PdmIniciativaSGR`
- ✅ `models/pdm.py`: Corregido timezone en todos los DateTime (8 tablas)
- ✅ `models/pqrs.py`: Agregado CASCADE en `created_by_id` y `assigned_to_id`
- ✅ `models/pqrs.py`: Agregados índices en `tipo_solicitud` y `estado`
- ✅ `schemas/pdm_v2.py`: Eliminadas clases de schemas para tablas PDM eliminadas

---

## 🚀 PRÓXIMOS PASOS

1. ⏸️ **NO DESPLEGAR** hasta corregir referencias en rutas
2. 🔧 Aplicar correcciones de este documento
3. ✅ Probar localmente antes de deploy
4. 🚀 Desplegar a producción
5. ✔️ Verificar tablas creadas con CASCADE correcto

