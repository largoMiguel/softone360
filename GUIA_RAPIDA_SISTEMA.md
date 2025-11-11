# 🚀 GUÍA RÁPIDA - SISTEMA PRODUCTIVO

**Última actualización:** 11 de noviembre de 2025  
**Deploy ID:** dd1babc  
**Status:** ✅ **EN PRODUCCIÓN**

---

## 📍 URLs Base

```
Backend API: http://softone-backend-useast1.eba-epvnmbmk.us-east-1.elasticbeanstalk.com
DB Host: softone-db.ccvomgoayzyt.us-east-1.rds.amazonaws.com:5432
DB Name: softone_db
```

---

## 👤 Credenciales de Acceso

### Superadmin (Sistema)
```
Username: superadmin
Email: contactenos@softone360.com
Password: softone***
Role: SUPERADMIN
Entity: NULL (Sin vinculación)
```

### Admin Demo (Entidad Demo)
```
Username: demo_admin
Email: admin@demo.gov.co
Password: AdminDemo123!
Role: ADMIN
Entity: 1 (Entidad Demo Municipio)
Modules: ["pqrs", "planes_institucionales", "pdm"]
```

### Secretario Demo (Entidad Demo)
```
Username: demo_secretario
Email: secretario@demo.gov.co
Password: Secretario123!
Role: SECRETARIO
Entity: 1 (Entidad Demo Municipio)
User Type: secretario
Modules: ["pqrs", "pdm"]
```

### Ciudadano Demo
```
Username: ciudadano_demo
Email: ciudadano@demo.gov.co
Password: Ciudadano123!
Role: CIUDADANO
Entity: 1 (Entidad Demo Municipio)
```

---

## 🔐 Endpoints Principales

### Autenticación
```
POST /api/auth/login
{
  "username": "superadmin",
  "password": "softone***"
}
→ Response: { access_token, token_type, user }
```

### Usuarios
```
POST /api/users/
Headers: Authorization: Bearer [TOKEN]
Body: {
  "username": "nuevo_usuario",
  "email": "user@example.com",
  "full_name": "Nombre Completo",
  "password": "Password123!",
  "role": "admin|secretario|ciudadano",
  "entity_id": 1,  # Requerido si role != ciudadano
  "user_type": "secretario|contratista",  # Opcional
  "allowed_modules": ["pqrs", "planes_institucionales"]  # Opcional
}
→ Response: { id, username, email, role, entity_id, ... }
```

```
GET /api/users/
Headers: Authorization: Bearer [TOKEN]
Query params: ?role=admin&entity_id=1&skip=0&limit=10
→ Response: [ { usuario1 }, { usuario2 }, ... ]
```

```
GET /api/users/{user_id}/
Headers: Authorization: Bearer [TOKEN]
→ Response: { usuario details }
```

---

## 🏢 Entidades

### Entidad Demo (ID=1)
```
Code: DEMO001
Name: Entidad Demo Municipio
Slug: municipio-demo
NIT: 900123456
Email: contacto@demo.gov.co
Modules:
  ✅ enable_pqrs: true
  ✅ enable_planes_institucionales: true
  ✅ enable_pdm: true
  ✅ enable_contratacion: true
  ✅ enable_users_admin: true
  ✅ enable_reports_pdf: true
  ✅ enable_ai_reports: true
```

### Para Crear Nueva Entidad
```
POST /api/entities/
Headers: Authorization: Bearer [SUPERADMIN_TOKEN]
Body: {
  "code": "MUN002",
  "name": "Municipio X",
  "slug": "municipio-x",
  "nit": "800456789",
  "phone": "2-123456",
  "email": "contacto@municipiox.gov.co",
  "enable_pqrs": true,
  "enable_planes_institucionales": true,
  "enable_pdm": true,
  "enable_contratacion": true,
  "enable_users_admin": true,
  "enable_reports_pdf": true,
  "enable_ai_reports": true
}
```

---

## 📋 Campos de Usuario

### Requeridos al Crear
```
✅ username (string, único)
✅ email (string email válido, único)
✅ full_name (string)
✅ password (string, mín 8 caracteres)
✅ role (enum: admin, secretario, ciudadano)
```

### Requeridos Condicionalmente
```
✅ entity_id → REQUERIDO si role != ciudadano
✅ user_type → Requerido si role == secretario
```

### Opcionales
```
❌ allowed_modules (array de strings)
❌ secretaria_id (FK a secretarias, solo si existe)
```

### ❌ NO USAR (Removidos)
```
❌ secretaria (string) - Usar secretaria_id (integer FK)
❌ cedula - Removido del modelo User
❌ telefono - Removido del modelo User
❌ direccion - Removido del modelo User
```

---

## 🔑 Módulos Disponibles

```
1. pqrs                        → Peticiones, Quejas, Reclamos, Sugerencias
2. planes_institucionales     → Planes de Desarrollo Municipal
3. pdm                         → Plan de Desarrollo (PDM)
4. contratacion               → Gestión de Contrataciones
5. users_admin                → Administración de Usuarios
6. reports_pdf                → Reportes en PDF
7. ai_reports                 → Reportes con IA
```

---

## 👥 Roles y Permisos

### SUPERADMIN
- ✅ Puede ver todos los usuarios de todas las entidades
- ✅ Puede crear cualquier tipo de usuario
- ✅ Puede asignar a cualquier entidad
- ✅ No pertenece a ninguna entidad
- ❌ No tiene módulos asignados

### ADMIN
- ✅ Puede crear SECRETARIO y CIUDADANO
- ✅ Limitado a su propia entidad
- ✅ Puede ver usuarios de su entidad
- ❌ No puede crear otros ADMIN
- ❌ No puede crear SUPERADMIN
- ✅ Heredan módulos de entity.enable_*

### SECRETARIO
- ❌ No puede crear usuarios
- ✅ Puede ver PQRS de su secretaría
- ✅ Puede resolver PQRS asignadas
- ✅ Acceso limitado a entidad

### CIUDADANO
- ❌ No puede crear usuarios
- ❌ No tiene acceso admin
- ✅ Puede crear PQRS propias
- ✅ Puede ver estado de sus PQRS

---

## 🧪 Test de Creación Rápida

```bash
# 1. Login como superadmin
TOKEN=$(curl -s -X POST \
  "http://softone-backend-useast1.eba-epvnmbmk.us-east-1.elasticbeanstalk.com/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"superadmin","password":"softone***"}' | jq -r '.access_token')

# 2. Crear nuevo usuario admin
curl -X POST \
  "http://softone-backend-useast1.eba-epvnmbmk.us-east-1.elasticbeanstalk.com/api/users/" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "username":"new_admin",
    "email":"new_admin@example.com",
    "full_name":"Nuevo Admin",
    "password":"NewPass123!",
    "role":"admin",
    "entity_id":1,
    "allowed_modules":["pqrs","pdm"]
  }'

# 3. Listar usuarios
curl -X GET \
  "http://softone-backend-useast1.eba-epvnmbmk.us-east-1.elasticbeanstalk.com/api/users/" \
  -H "Authorization: Bearer $TOKEN"
```

---

## 🐛 Solución de Problemas

### Error 422 Unprocessable Entity
**Causa:** Campos inválidos o removidos siendo enviados  
**Solución:** Verificar que NO se envían:
- ❌ `secretaria` (usar `secretaria_id` o no enviar)
- ❌ `cedula`, `telefono`, `direccion`
- ❌ Campos no listados en la guía

### Error 401 Unauthorized
**Causa:** Token inválido o expirado  
**Solución:**
- Obtener nuevo token con `/api/auth/login`
- Verificar que token está en header `Authorization: Bearer [TOKEN]`

### Error 403 Forbidden
**Causa:** Rol sin permisos  
**Solución:**
- Verificar que usuario es ADMIN o SUPERADMIN
- Si ADMIN, verificar que está creando usuario de su entidad

### Error 400 Bad Request
**Causa:** Datos inválidos  
**Solución:**
- Email debe ser formato válido
- Username debe ser único
- Entity debe existir y estar activa

---

## 📊 Estado de Módulos

### Habilitados en Entidad Demo
```
✅ PQRS
✅ Planes Institucionales
✅ PDM
✅ Contratación
✅ Administración de Usuarios
✅ Reportes PDF
✅ Reportes con IA
```

---

## 🔄 Base de Datos

### Tablas Principales
```
1. users              → Usuarios del sistema
2. entities           → Municipios/Entidades
3. secretarias        → Secretarías de entidades
4. pqrs               → Peticiones, Quejas, Reclamos
5. planes             → Planes de desarrollo
6. pdm                → Plan de desarrollo municipal
7. pqrs_respuestas    → Respuestas a PQRS
... (7 más con constraints CASCADE)
```

### Constraints de Integridad
```
✅ CASCADE on DELETE para entidad → usuarios, secretarias, pqrs, etc.
✅ SET NULL on DELETE para usuarios (asignaciones)
✅ UNIQUE constraints en username, email, code, slug
```

---

## 📝 Tareas Pendientes (Recomendado)

- [ ] Crear CRUD completo de Secretarías
- [ ] Implementar endpoint PUT para actualizar usuarios
- [ ] Implementar endpoint DELETE para usuarios (soft delete?)
- [ ] Agregar endpoint de cambio de contraseña
- [ ] Auditoría de otros módulos (PQRS, Planes, PDM)
- [ ] Testing de permisos más exhaustivo
- [ ] Implementar rate limiting en login
- [ ] Agregar logging de auditoría

---

## 📞 Soporte

**Documentación disponible:**
- `AUDITORIA_ENDPOINTS_BD.md` - Especificación completa de campos
- `VALIDACION_USUARIO_CREATION_FIXED.md` - Tests realizados
- `RESUMEN_SESION_11NOV_FINAL.md` - Detalles completos del fix

**Sistema activo:**
- Backend: ✅ Elastic Beanstalk (softone-backend-useast1)
- Database: ✅ AWS RDS PostgreSQL
- API Status: ✅ Operacional

---

**Última verificación:** 11 de noviembre de 2025, 05:00 UTC  
**Deploy ID:** dd1babc  
**Versión API:** 1.0.0  

