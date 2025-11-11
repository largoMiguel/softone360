# 🔍 Auditoría de Endpoints y Requerimientos de Base de Datos

**Fecha:** 11 de noviembre de 2025  
**Objetivo:** Validar todos los endpoints y requerimientos de datos en la BD

---

## 📊 Tabla de Modelos y Campos Requeridos

### 1. **User (usuarios)**

| Campo | Tipo | Requerido | Constraints | Notas |
|-------|------|-----------|------------|-------|
| `id` | Integer | ✅ | PRIMARY KEY | Auto-generado |
| `username` | String | ✅ | UNIQUE, NOT NULL | Nombre único del usuario |
| `email` | String | ✅ | UNIQUE, NOT NULL | Email único y válido (EmailStr) |
| `full_name` | String | ✅ | NOT NULL | Nombre completo del usuario |
| `hashed_password` | String | ✅ | NOT NULL | Contraseña hasheada con bcrypt |
| `role` | Enum(UserRole) | ✅ | NOT NULL | Valores: `superadmin`, `admin`, `secretario`, `ciudadano` |
| `entity_id` | Integer (FK) | ❌ | FK → entities.id CASCADE | NULL para SUPERADMIN, ADMIN = su entidad |
| `secretaria_id` | Integer (FK) | ❌ | FK → secretarias.id SET NULL | Solo para SECRETARIO |
| `user_type` | Enum(UserType) | ❌ | Nullable | Valores: `secretario`, `contratista` (NULL para ADMIN/SUPERADMIN) |
| `allowed_modules` | JSON | ❌ | JSON array | Ejemplo: `["pqrs", "planes_institucionales"]` |
| `is_active` | Boolean | ✅ | DEFAULT TRUE | Usuarios activos/inactivos |
| `created_at` | DateTime | ✅ | DEFAULT NOW | Timestamp creación |
| `updated_at` | DateTime | ❌ | DEFAULT NOW | Timestamp actualización |

**❌ ERRORES ENCONTRADOS:**
- Campo `secretaria` (String) está siendo usado en routes pero NO existe en modelo
- Campo `cedula` está siendo usado pero NO existe en modelo
- Campo `telefono` está siendo usado pero NO existe en modelo
- Campo `direccion` está siendo usado pero NO existe en modelo

---

### 2. **Entity (entidades)**

| Campo | Tipo | Requerido | Constraints | Notas |
|-------|------|-----------|------------|-------|
| `id` | Integer | ✅ | PRIMARY KEY | Auto-generado |
| `code` | String | ✅ | UNIQUE | Código único (DEMO001) |
| `name` | String | ✅ | UNIQUE | Nombre entidad |
| `slug` | String | ✅ | UNIQUE | URL-friendly (municipio-demo) |
| `nit` | String | ❌ | Nullable | NIT para consultas SECOP |
| `phone` | String | ❌ | Nullable | Teléfono entidad |
| `email` | String | ❌ | Nullable | Email contacto |
| `address` | String | ❌ | Nullable | Dirección |
| `description` | Text | ❌ | Nullable | Descripción |
| `logo_url` | String | ❌ | Nullable | URL del logo |
| `horario_atencion` | String | ❌ | Nullable | Ej: "Lunes a Viernes 8-5" |
| `tiempo_respuesta` | String | ❌ | Nullable | Ej: "24 horas" |
| `enable_pqrs` | Boolean | ✅ | DEFAULT TRUE | PQRS habilitado |
| `enable_planes_institucionales` | Boolean | ✅ | DEFAULT TRUE | Planes habilitado |
| `enable_pdm` | Boolean | ✅ | DEFAULT TRUE | PDM habilitado |
| `enable_contratacion` | Boolean | ✅ | DEFAULT TRUE | Contratación habilitado |
| `enable_users_admin` | Boolean | ✅ | DEFAULT TRUE | Gestión usuarios |
| `enable_reports_pdf` | Boolean | ✅ | DEFAULT TRUE | Reportes PDF |
| `enable_ai_reports` | Boolean | ✅ | DEFAULT TRUE | IA en reportes |
| `is_active` | Boolean | ✅ | DEFAULT TRUE | Entidad activa |
| `created_at` | DateTime | ✅ | DEFAULT NOW | Timestamp |
| `updated_at` | DateTime | ❌ | DEFAULT NOW | Timestamp |

---

### 3. **Secretaria**

| Campo | Tipo | Requerido | Constraints | Notas |
|-------|------|-----------|------------|-------|
| `id` | Integer | ✅ | PRIMARY KEY | Auto-generado |
| `entity_id` | Integer (FK) | ✅ | FK → entities.id CASCADE | Debe existir entidad |
| `nombre` | String | ✅ | UNIQUE per entity | Nombre de secretaría |
| `is_active` | Boolean | ✅ | DEFAULT TRUE | Activa/Inactiva |
| `created_at` | DateTime | ✅ | DEFAULT NOW | Timestamp |
| `updated_at` | DateTime | ❌ | DEFAULT NOW | Timestamp |

---

## 🔴 PROBLEMA IDENTIFICADO: Error 422 al crear usuario

### Síntoma
```
POST /api/users/ 422 (Unprocessable Entity)
Error: [object Object]
```

### Root Cause
En `backend/app/routes/users.py` línea ~245-250:
```python
db_user = User(
    username=user_data.username,
    email=user_data.email,
    full_name=user_data.full_name,
    hashed_password=hashed_password,
    role=user_data.role,
    entity_id=user_data.entity_id,
    user_type=normalized_user_type,
    allowed_modules=user_data.allowed_modules or [],
    secretaria=secretaria_nombre,  # ❌ CAMPO NO EXISTE EN MODELO
    is_active=True
)
```

El modelo User NO tiene campo `secretaria` (es un String). Tiene `secretaria_id` (FK a Secretaria).

### Schema vs Model Mismatch

**Schema (Pydantic) acepta:**
```python
secretaria: Optional[str] = None
cedula: Optional[str] = None
telefono: Optional[str] = None
direccion: Optional[str] = None
```

**Model (SQLAlchemy) tiene:**
```python
secretaria_id: Integer FK
# NO tiene: secretaria, cedula, telefono, direccion
```

---

## ✅ SOLUCIÓN: Datos Correctos para Crear Usuario

### Endpoint: `POST /api/users/`

**Payload correcto:**
```json
{
  "username": "juan.diaz",
  "email": "juan.diaz@municipio.gov.co",
  "full_name": "Juan Díaz García",
  "password": "SecurePass123!",
  "role": "admin",
  "entity_id": 1,
  "user_type": null,
  "allowed_modules": ["pqrs", "planes_institucionales", "pdm"]
}
```

**Campos requeridos:**
- ✅ `username` (string, único)
- ✅ `email` (string, email válido, único)
- ✅ `full_name` (string)
- ✅ `password` (string, mín 8 caracteres)
- ✅ `role` (enum: `admin`, `secretario`, `ciudadano` - NO superadmin)
- ❌ `entity_id` (requerido SOLO si role != `ciudadano`)
- ❌ `user_type` (opcional: `secretario` o `contratista`)
- ❌ `allowed_modules` (opcional: array de strings)

**NUNCA enviar:**
- ❌ `secretaria` (string)
- ❌ `cedula`
- ❌ `telefono`
- ❌ `direccion`

---

## 📋 Auditoría de Todos los Endpoints de Usuarios

### 1. Crear Usuario
**Endpoint:** `POST /api/users/`  
**Rol requerido:** ADMIN o SUPERADMIN  
**Validaciones:**
- [ ] username único
- [ ] email único y válido
- [ ] role válido (admin, secretario, ciudadano)
- [ ] entity_id existe (si se proporciona)
- [ ] entity activa (si se proporciona)
- [ ] módulos válidos para la entidad
- [x] password hasheado

**Datos requeridos:**
```
username, email, full_name, password, role
+ (entity_id si role != ciudadano)
```

---

### 2. Actualizar Usuario
**Endpoint:** `PUT /api/users/{user_id}/`  
**Rol requerido:** SUPERADMIN o ADMIN (su entidad)  
**Datos opcionales:**
```
username, email, full_name, role, entity_id, user_type, allowed_modules, password
```

---

### 3. Listar Usuarios
**Endpoint:** `GET /api/users/`  
**Rol requerido:** SUPERADMIN o ADMIN  
**Filtros disponibles:**
- `entity_id`: Entidad específica
- `role`: Filtrar por rol
- `skip`: Paginación (default 0)
- `limit`: Límite resultados (default 10)

---

### 4. Obtener Usuario
**Endpoint:** `GET /api/users/{user_id}/`  
**Datos retornados:**
```json
{
  "id": 2,
  "username": "juan.diaz",
  "email": "juan.diaz@municipio.gov.co",
  "full_name": "Juan Díaz García",
  "role": "admin",
  "entity_id": 1,
  "user_type": null,
  "allowed_modules": ["pqrs", "planes_institucionales"],
  "is_active": true,
  "created_at": "2025-11-11T04:40:00Z",
  "updated_at": null
}
```

---

## 🔧 FIXEOS REQUERIDOS

### Fix 1: Remover campos legacy en routes/users.py

**Línea ~245** - Cambiar:
```python
# ❌ MAL
db_user = User(
    username=user_data.username,
    ...
    secretaria=secretaria_nombre,  # NO EXISTE
    is_active=True
)

# ✅ BIEN
db_user = User(
    username=user_data.username,
    ...
    secretaria_id=None,  # O asignar ID si existe
    is_active=True
)
```

### Fix 2: Limpiar schema de usuario

**Remover del schema:**
```python
secretaria: Optional[str] = None  # ❌ ELIMINAR
cedula: Optional[str] = None      # ❌ ELIMINAR
telefono: Optional[str] = None    # ❌ ELIMINAR
direccion: Optional[str] = None   # ❌ ELIMINAR
```

### Fix 3: Validación de secretaria_id

Si se quiere asignar secretaria, debe ser por `secretaria_id` (FK), NO `secretaria` (string):
```python
# Buscar secretaría
if user_data.secretaria_id:
    secretaria = db.query(Secretaria).filter(
        Secretaria.id == user_data.secretaria_id,
        Secretaria.entity_id == user_data.entity_id  # Verificar que pertenece a la entidad
    ).first()
    if not secretaria:
        raise HTTPException(status_code=400, detail="Secretaría no válida")
```

---

## 📊 Tabla de Validaciones por Endpoint

| Endpoint | Método | Auth | entity_id | role | Validaciones Clave |
|----------|--------|------|-----------|------|-------------------|
| `/users/` | POST | ADMIN+ | ✅ | ✅ | username/email únicos, entidad existe, módulos válidos |
| `/users/` | GET | ADMIN+ | ❌ | ❌ | Filtrar por entidad del user |
| `/users/{id}` | GET | ADMIN+ | ❌ | ❌ | Permiso sobre entidad |
| `/users/{id}` | PUT | ADMIN+ | ❌ | ❌ | No puede cambiar entity_id si ADMIN |
| `/users/{id}` | DELETE | ADMIN+ | ❌ | ❌ | Soft delete? Hard delete? |

---

## 🎯 Resumen de Errores Encontrados

| # | Error | Ubicación | Severidad | Fix |
|---|-------|-----------|-----------|-----|
| 1 | Campo `secretaria` (string) no existe | routes/users.py:248 | 🔴 CRÍTICO | Remover línea |
| 2 | Campos legacy (cedula, telefono) | schemas/user.py | 🔴 CRÍTICO | Remover del schema |
| 3 | Schema aceptacepte campos que no existen en modelo | schemas vs models | 🟠 ALTO | Sincronizar |
| 4 | Falta validación de secretaria_id | routes/users.py | 🟡 MEDIO | Agregar validación |

---

## ✅ Checklist para Fix Completo

- [ ] Remover línea `secretaria=secretaria_nombre,` de routes/users.py
- [ ] Remover campos del schema: secretaria, cedula, telefono, direccion
- [ ] Agregar validación de secretaria_id si se va a usar
- [ ] Prueba crear usuario ADMIN
- [ ] Prueba crear usuario SECRETARIO
- [ ] Prueba crear usuario CIUDADANO
- [ ] Verificar respuesta 422 desaparece
- [ ] Commit con mensaje: "fix: eliminar campos legacy y sincronizar schema-model"
- [ ] Deploy a producción

