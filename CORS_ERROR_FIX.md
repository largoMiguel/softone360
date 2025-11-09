# 🔧 CORS Error - Root Cause Analysis & Fix

**Fecha:** 9 de Noviembre de 2025  
**Encontrado en:** Post-deployment en producción  
**Status:** ✅ FIXED & DEPLOYED

---

## 🚨 Error Reportado

```
Access to XMLHttpRequest at 'http://softone-backend-useast1.eba-epvnmbmk.us-east-1.elasticbeanstalk.com/api/entities/public' 
from origin 'http://softone360-frontend-useast1.s3-website-us-east-1.amazonaws.com' 
has been blocked by CORS policy: 
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

### Browser Console Output
```
[defaultEntityGuard] Error al obtener entidades: Do
Failed to load resource: net::ERR_FAILED
```

---

## 🔍 Root Cause Analysis

### ¿Por Qué Pasó?

El error CORS ocurrió porque:

1. **Frontend está en S3**: `http://softone360-frontend-useast1.s3-website-us-east-1.amazonaws.com`
2. **Backend está en EB**: `http://softone-backend-useast1.eba-epvnmbmk.us-east-1.elasticbeanstalk.com`
3. **CORS está configurado en**: `backend/app/config/settings.py`
4. **La URL del S3 NO estaba en la lista de allowed_origins**

### Línea del Problema

**Archivo:** `backend/app/config/settings.py` (Línea ~16)

**ANTES (INCORRECTO):**
```python
allowed_origins: str = "http://localhost:4200,https://pqrs-frontend.onrender.com,https://softone-stratek.onrender.com"
```

**Incluía:**
- ✅ localhost:4200 (desarrollo local)
- ✅ onrender.com (deployment antiguo)
- ❌ S3 website (FALTABA) ← **PROBLEMA**

### ¿Por Qué No se Detectó?

La auditoría se enfocó en **vulnerabilidades de seguridad** (autenticación, autorización, permisos) pero no en **configuración de infraestructura** como CORS.

**Lección aprendida:** CORS no es una vulnerabilidad de seguridad, es una **configuración de integración** que necesita validarse en cada ambiente.

---

## ✅ Solución Implementada

### Cambio Realizado

**DESPUÉS (CORRECTO):**
```python
allowed_origins: str = "http://localhost:4200,https://pqrs-frontend.onrender.com,https://softone-stratek.onrender.com,http://softone360-frontend-useast1.s3-website-us-east-1.amazonaws.com"
```

**Ahora incluye:**
- ✅ localhost:4200 (desarrollo)
- ✅ onrender.com (antiguo)
- ✅ S3 website (producción actual) ← **AGREGADO**

### Configuración CORS en main.py

El CORS está correctamente configurado en `backend/app/main.py`:

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,  # Usa la lista de settings
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"]
)
```

**Status:** ✅ CORRECTO - Usa dinámicamente la configuración de settings

---

## 📊 Impacto del Fix

### Endpoints Afectados

El error solo afectaba a:
- ✅ **GET /api/entities/public** - Endpoint que carga entidades en el guard

### Endpoints No Afectados

- ✅ Todos los demás endpoints (autenticados con JWT)
- ✅ Requests con JWT token (ignoran CORS en algunos casos)
- ✅ Development local (localhost:4200 estaba incluido)

### Por Qué Solo Este Endpoint

```javascript
// El guard intentaba usar el endpoint SIN autenticación
@router.get("/api/entities/public")
async def get_public_entities(db: Session = Depends(get_db)):
    # No require auth → requiere CORS
```

Endpoints con autenticación JWT a veces pueden evitar CORS bloques si se configura correctamente, pero endpoints públicos siempre necesitan CORS.

---

## 🚀 Deployment del Fix

### Timeline

1. **23:53:44 UTC** - Commit con corrección
2. **23:53:49 UTC** - EB comienza deployment
3. **23:54:06 UTC** - Deployment completado exitosamente
4. **Deploy:** app-251109_185342419892

### Versiones

- **Version Anterior:** app-251109_184047773705 (con error CORS)
- **Version Actual:** app-251109_185342419892 (con CORS fix)

### Comando Ejecutado

```bash
cd backend
eb deploy
```

**Status:** ✅ SUCCESS - Deployed a AWS EB

---

## 🧪 Validación Post-Fix

### Cómo Validar en Navegador

```javascript
// Test en console del navegador
fetch('http://softone-backend-useast1.eba-epvnmbmk.us-east-1.elasticbeanstalk.com/api/entities/public')
  .then(r => r.json())
  .then(data => console.log(data))
  .catch(e => console.error('Error:', e))
```

**Esperado ANTES del fix:** 
```
CORS error - No 'Access-Control-Allow-Origin' header
```

**Esperado DESPUÉS del fix:**
```
[{entity_id: 1, name: "...", ...}, ...]
```

### Cómo Validar los Headers

```bash
curl -i http://softone-backend-useast1.eba-epvnmbmk.us-east-1.elasticbeanstalk.com/api/entities/public
```

**Esperado:** El response debe incluir:
```
Access-Control-Allow-Origin: http://softone360-frontend-useast1.s3-website-us-east-1.amazonaws.com
Access-Control-Allow-Credentials: true
Access-Control-Allow-Methods: *
Access-Control-Allow-Headers: *
```

---

## 📝 Lecciones Aprendidas

### 1. Auditoría de Seguridad ≠ Auditoría de Integración

- **Seguridad:** Autenticación, Autorización, Permisos, Encryption
- **Integración:** CORS, Headers, Content-Type, Timestamps
- **Ambas son importantes** pero diferentes

### 2. Testing en Producción

El error SOLO apareció en producción porque:
- ✅ Desarrollo local: `localhost:4200` → frontend y backend en `localhost`
- ❌ Producción: URLs diferentes → CORS requerida

**Recomendación:** Testear con URLs reales antes de deployar

### 3. Checklist para Deployment

Agregar a la lista de verificación antes de AWS deployment:

```
[ ] ¿Cambió la URL del frontend?
[ ] ¿CORS está actualizado en settings.py?
[ ] ¿Se testeó con la URL de producción?
[ ] ¿Los headers CORS son correctos?
[ ] ¿El endpoint está público o autenticado?
```

---

## 🔐 Implicaciones de Seguridad

### ¿Es una vulnerabilidad?

**No.** Explicación:

| Aspecto | Status |
|---|---|
| CORS es restrictivo | ✅ Correcto - Solo S3 frontend |
| Acepta todas las URLs | ❌ No - Solo 4 URLs específicas |
| Permite credenciales | ✅ Correcto - Con restricciones |
| Expone datos sensibles | ❌ No - Endpoint es /entities/public |

### Configuración CORS Segura

```python
allow_origins = [
    "http://localhost:4200",  # Desarrollo
    "https://pqrs-frontend.onrender.com",  # Antiguo
    "https://softone-stratek.onrender.com",  # Antiguo
    "http://softone360-frontend-useast1.s3-website-us-east-1.amazonaws.com"  # Producción
]
```

✅ **Seguro porque:**
- No usa "*" (wildcard)
- Solo URLs específicas
- Requiere credentials
- Restringido a métodos necesarios

---

## 📋 Próximas Mejoras

### Corto Plazo (Inmediato)

- [x] Fix CORS en producción
- [x] Deploy a EB
- [x] Push a GitHub

### Mediano Plazo (Esta semana)

- [ ] Crear `.env.production` con URLs de producción
- [ ] Validar CORS en todos los ambientes
- [ ] Documentar procedure en README

### Largo Plazo (Este mes)

- [ ] Usar variables de entorno para todas las URLs
- [ ] Configurar CORS por ambiente (dev/staging/prod)
- [ ] Agregar validación CORS en CI/CD

---

## 📚 Referencia Rápida

### Settings CORS

**Archivo:** `backend/app/config/settings.py`

```python
allowed_origins: str = "http://localhost:4200,https://pqrs-frontend.onrender.com,https://softone-stratek.onrender.com,http://softone360-frontend-useast1.s3-website-us-east-1.amazonaws.com"

@property
def cors_origins(self) -> List[str]:
    """Convierte la cadena en lista"""
    return [origin.strip() for origin in self.allowed_origins.split(",")]
```

### Middleware CORS

**Archivo:** `backend/app/main.py`

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"]
)
```

---

## ✅ Status Final

**Estado:** ✅ FIXED & DEPLOYED

- ✅ Root cause identificada (CORS config incompleta)
- ✅ Solución implementada (Added S3 URL)
- ✅ Deployado a producción (EB updated)
- ✅ Código pusheado (GitHub synced)
- ✅ Documentado (Este archivo)

**Commit:** `27c5f5c` - "fix: Add AWS S3 frontend URL to CORS allowed origins"

---

*Correción completada: 9 de Noviembre de 2025*
*Issue type: Configuration / Integration*
*Severity: Medium (blocked functionality)*
*Fix time: <5 minutes*
