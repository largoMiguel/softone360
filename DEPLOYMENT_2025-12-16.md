# Deployment Manual - 15 de Diciembre 2025

## ✅ DEPLOYMENT COMPLETADO EXITOSAMENTE

### Fecha: 2025-12-16 02:12 UTC

---

## 📦 Backend Desplegado

**Plataforma:** AWS Elastic Beanstalk  
**Ambiente:** softone-backend-useast1  
**Versión:** app-251215_211049012505  
**Estado:** ✅ Ready (Health: Green)  
**URL:** http://softone-backend-useast1.eba-epvnmbmk.us-east-1.elasticbeanstalk.com

### Cambios Incluidos:
- ✅ Modelos: Funcionario, EquipoRegistro, RegistroAsistencia
- ✅ API endpoints para control de asistencia
- ✅ Validación de equipos por UUID
- ✅ Upload de fotos a S3
- ✅ Estadísticas en tiempo real
- ✅ Relaciones con Entity (tabla entities)

---

## 🌐 Frontend Desplegado

**Plataforma:** AWS S3 + CloudFront  
**Bucket:** s3://softone360.com  
**CloudFront ID:** E3OH65AY982GZ5  
**Estado:** ✅ Deployed  
**URL:** https://d39d4iayhy9x2w.cloudfront.net

### Cambios Incluidos:
- ✅ Componente VentanillaComponent con routing
- ✅ Dashboard de asistencia con estadísticas
- ✅ Gestión de funcionarios (CRUD completo)
- ✅ Visualización de registros con filtros
- ✅ Gestión de equipos autorizados
- ✅ Integración en menú lateral (sidebar)
- ✅ Permisos: Solo Admin/Secretario
- ✅ Lazy loading de rutas ventanilla

### Archivos Verificados:
- ✅ index.html (27.5 KB)
- ✅ main-C6UAVXT3.js (363 KB)
- ✅ chunk-RW4ZGL7U.js (31 KB) - **Rutas de Ventanilla**
- ✅ chunk-PQGJTAI2.js - Dashboard
- ✅ chunk-SGSNQJ53.js - PDM
- ✅ chunk-DVZWSZNF.js - Contratación

---

## 🔄 CloudFront Cache Invalidation

**Invalidation ID:** I7MBZWV17RRCZLOT9OG10QJIIB  
**Estado:** In Progress → Completed  
**Paths:** /* (todos los archivos)

---

## 🗄️ Base de Datos

**Estado:** ✅ No requiere migraciones adicionales  
**Nota:** Las tablas se crean automáticamente al iniciar el backend:
- `funcionarios`
- `equipos_registro`
- `registros_asistencia`

---

## 🎯 Rutas Disponibles (Producción)

### Backend API:
```
http://softone-backend-useast1.eba-epvnmbmk.us-east-1.elasticbeanstalk.com/api/asistencia/
```

**Endpoints:**
- `GET /api/asistencia/funcionarios` - Listar funcionarios
- `POST /api/asistencia/funcionarios` - Crear funcionario
- `GET /api/asistencia/equipos` - Listar equipos
- `POST /api/asistencia/equipos` - Crear equipo
- `POST /api/asistencia/equipos/validar` - Validar equipo
- `GET /api/asistencia/registros` - Listar registros
- `POST /api/asistencia/registros` - Crear registro (app escritorio)
- `GET /api/asistencia/estadisticas` - Estadísticas

### Frontend:
```
https://softone360.com/{slug}/ventanilla
```

**Secciones:**
- `/ventanilla/dashboard` - Dashboard con estadísticas
- `/ventanilla/funcionarios` - Gestión de funcionarios
- `/ventanilla/registros` - Historial de registros
- `/ventanilla/equipos` - Gestión de equipos

---

## 🔐 Permisos

**Acceso al Módulo:**
- ✅ SUPERADMIN - Acceso total
- ✅ ADMIN - Acceso a su entidad
- ✅ SECRETARIO - Acceso a su entidad
- ❌ CIUDADANO - Sin acceso

---

## ✅ Verificación Post-Deployment

### Backend:
```bash
# Health check
curl http://softone-backend-useast1.eba-epvnmbmk.us-east-1.elasticbeanstalk.com/

# Verificar endpoint de asistencia
curl http://softone-backend-useast1.eba-epvnmbmk.us-east-1.elasticbeanstalk.com/api/asistencia/equipos
```

### Frontend:
1. Acceder a https://softone360.com
2. Iniciar sesión con usuario Admin/Secretario
3. Verificar menú lateral: "CONTROL DE ASISTENCIA"
4. Navegar a cada sección

---

## 📊 Comandos Ejecutados

```bash
# 1. Deploy Backend
cd portal/backend
eb deploy softone-backend-useast1

# 2. Build Frontend
cd portal/frontend
npm run build

# 3. Upload to S3
aws s3 sync dist/pqrs-frontend/browser/ s3://softone360.com/ --delete

# 4. Invalidate CloudFront
aws cloudfront create-invalidation --distribution-id E3OH65AY982GZ5 --paths "/*"

# 5. Verify
eb status softone-backend-useast1
aws s3 ls s3://softone360.com/ --recursive | tail -5
```

---

## 🐛 Issues Conocidos

### Ninguno detectado ✅

---

## 📝 Notas

1. **App de Escritorio:** No requiere deployment - es ejecutable local de Windows
2. **Migraciones:** Se ejecutan automáticamente al iniciar el backend
3. **S3 Bucket:** Cambió de `softone360-frontend-useast1` a `softone360.com`
4. **CloudFront:** Invalidación toma ~5 minutos en completarse

---

## 🎉 Próximos Pasos

1. ✅ Probar en producción:
   - Crear funcionario
   - Registrar equipo
   - Probar app de escritorio en Windows
   - Verificar registros en el portal

2. ✅ Monitorear logs:
   ```bash
   eb logs softone-backend-useast1
   ```

3. ✅ Verificar métricas en AWS Console

---

## 📞 Contacto

En caso de problemas:
- Revisar logs de Elastic Beanstalk
- Verificar CloudWatch Logs
- Revisar consola del navegador (F12)

---

**Deployment realizado por:** Miguel Largo  
**Fecha:** 2025-12-16 02:12 UTC  
**Commit:** c0f5098 (feat: Integrar módulo de Control de Asistencia en la UI)
