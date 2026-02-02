# 🚀 Guía de Despliegue Manual - Contratos RPS PDM

## 📦 Cambios Realizados

### Backend (Python/FastAPI)
1. ✅ Nuevo endpoint: `/api/pdm/contratos/{slug}/upload` (POST)
   - Procesa Excel EN MEMORIA
   - Agrupa por NO CDP
   - Filtra por producto y año
   - NO guarda en base de datos

2. ✅ Nuevos modelos: `pdm_contratos.py` (NO USADOS - solo definidos)

3. ✅ Nueva ruta: `app/routes/pdm_contratos.py`

### Frontend (Angular)
1. ✅ Nuevo servicio: `pdm-contratos.service.ts`
2. ✅ Nuevo modelo: `pdm-contratos.model.ts`
3. ✅ Integración en componente PDM
4. ✅ Modal de carga de contratos
5. ✅ Vista de contratos en "Información Adicional"

---

## 🔧 Despliegue Manual

### 1️⃣ BACKEND (API Python)

```bash
# Conectar al servidor de producción
ssh usuario@servidor-produccion

# Navegar al directorio del backend
cd /ruta/al/portal/backend

# Activar entorno virtual
source venv/bin/activate

# Copiar nuevos archivos (desde tu máquina local)
```

**Archivos a subir al backend:**
```
backend/app/routes/pdm_contratos.py          → app/routes/
backend/app/models/pdm_contratos.py          → app/models/ (OPCIONAL - no usado)
```

**Modificar archivo existente:**
```
backend/app/main.py
```

**Cambio en main.py (línea ~180):**
```python
# Agregar después de pdm_informes:
from app.routes import pdm_contratos
app.include_router(pdm_contratos.router, prefix="/api", tags=["PDM Contratos RPS"])
```

**Reiniciar servicio:**
```bash
# Si usas systemd
sudo systemctl restart backend-api

# O si usas supervisor
sudo supervisorctl restart backend-api

# O si usas pm2
pm2 restart backend-api

# Verificar logs
tail -f /var/log/backend-api/error.log
```

---

### 2️⃣ FRONTEND (Angular S3/CloudFront)

```bash
# En tu máquina local, dentro del directorio frontend
cd portal/frontend

# Instalar dependencias si es necesario
npm install

# Build de producción
ng build --configuration production

# Verificar que se generaron los archivos
ls -lh dist/
```

**Archivos nuevos generados:**
- `pdm-contratos.service.ts` (compilado en main.js)
- `pdm-contratos.model.ts` (compilado en main.js)
- Cambios en `pdm.component.ts` y `pdm.component.html`

**Subir a S3:**

**Opción A: AWS CLI**
```bash
# Configurar AWS CLI si no está configurado
aws configure

# Sync a S3 (reemplaza con tu bucket)
aws s3 sync dist/ s3://tu-bucket-frontend/ --delete

# Invalidar caché de CloudFront (reemplaza con tu distribution ID)
aws cloudfront create-invalidation \
  --distribution-id TU_DISTRIBUTION_ID \
  --paths "/*"
```

**Opción B: AWS Console**
1. Ve a AWS S3 Console
2. Abre tu bucket (ej: `portal-frontend-prod`)
3. Sube todos los archivos de `dist/`
4. Ve a CloudFront
5. Selecciona tu distribución
6. Crea invalidación para `/*`

---

### 3️⃣ VERIFICACIÓN

**Backend:**
```bash
# Verificar que el endpoint existe
curl https://api.tudominio.com/docs

# Buscar el endpoint: POST /api/pdm/contratos/{slug}/upload
```

**Frontend:**
```bash
# Abrir navegador
https://portal.tudominio.com

# 1. Login como admin
# 2. Ir a PDM → Abrir un producto
# 3. Buscar botón "Cargar Contratos" en header o menú
# 4. Subir Excel de prueba
# 5. Verificar que aparecen en "Información Adicional"
```

---

## 📝 Excel de Prueba

Crear archivo `contratos_prueba.xlsx` con estas columnas:

| PRODUCTO | NO CDP | CONCEPTO | VALOR | AÑO |
|----------|--------|----------|-------|-----|
| 4003018 | CDP-001 | Suministro materiales | 50000000 | 2025 |
| 4003018 | CDP-001 | Adicional suministro | 25000000 | 2025 |
| 4003018 | CDP-002 | Consultoría | 30000000 | 2025 |

**Resultado esperado:**
- CDP-001: $75,000,000 (agrupado)
- CDP-002: $30,000,000

---

## 🔍 Troubleshooting

### Backend no responde
```bash
# Ver logs
tail -f /var/log/backend-api/error.log

# Verificar que el módulo pandas está instalado
pip list | grep pandas

# Si no está:
pip install pandas openpyxl
```

### Frontend no muestra cambios
```bash
# Limpiar caché del navegador (Ctrl+Shift+R)
# O abrir en modo incógnito

# Verificar invalidación de CloudFront
aws cloudfront get-invalidation \
  --distribution-id TU_DISTRIBUTION_ID \
  --id ID_INVALIDACION
```

### Error CORS
```bash
# Verificar que el endpoint está en el CORS del backend
# En backend/app/config/settings.py debe incluir tu dominio frontend
```

---

## ⚠️ IMPORTANTE

1. **NO crear la tabla en base de datos** - Los contratos solo se procesan en memoria
2. **NO ejecutar** `migration_add_contratos_rps.py`
3. Los datos desaparecen al refrescar la página (es temporal)
4. Solo admin/superadmin puede cargar archivos

---

## 📊 Comandos Rápidos

```bash
# Backend - Build y Deploy
cd portal/backend
source venv/bin/activate
# Copiar archivos modificados
sudo systemctl restart backend-api

# Frontend - Build y Deploy
cd portal/frontend
npm run build:prod
aws s3 sync dist/ s3://tu-bucket/ --delete
aws cloudfront create-invalidation --distribution-id XXX --paths "/*"
```

---

## ✅ Checklist de Despliegue

### Backend
- [ ] Archivo `pdm_contratos.py` subido a `app/routes/`
- [ ] `main.py` modificado con el import
- [ ] Dependencias instaladas (pandas, openpyxl)
- [ ] Servicio reiniciado
- [ ] Endpoint visible en `/docs`

### Frontend
- [ ] Build de producción ejecutado
- [ ] Archivos subidos a S3
- [ ] CloudFront invalidado
- [ ] Modal de contratos visible
- [ ] Upload funcional
- [ ] Datos se muestran en "Información Adicional"

---

¡Listo! 🎉
