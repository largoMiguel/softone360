# 📊 Guía de Generación Asíncrona de Informes PDM

## 🎯 Resumen

Sistema de generación asíncrona de informes PDM con notificaciones. Los informes se generan en segundo plano y el usuario recibe una notificación 🔔 cuando está listo para descargar.

---

## ✨ Características

- ✅ **Generación en background**: No bloquea la interfaz
- ✅ **Notificaciones push**: Badge 🔔 se actualiza automáticamente
- ✅ **Descarga desde S3**: URLs públicas con expiración de 7 días
- ✅ **Tracking de progreso**: Estados (pending → processing → completed/failed)
- ✅ **Multi-formato**: PDF, Word (DOCX), Excel (XLSX)
- ✅ **Compatible con IA**: Mejora descripciones con Claude 3.5 Sonnet

---

## 🔄 Flujo Completo

### 1️⃣ Solicitar Informe
1. Usuario ingresa al módulo **PDM**
2. Click en botón **"Generar Informe"**
3. Selecciona filtros:
   - Año (2024, 2025, o "Todos")
   - Secretarías (una o varias)
   - Estados (En Ejecución, No Iniciado, etc.)
   - Formato (PDF, Word, Excel)
   - IA activada/desactivada
4. Click en **"Confirmar"**

**Resultado esperado:**
```
✅ INFORME PDF SOLICITADO

Año: 2025

Tu informe se está generando en segundo plano.

Recibirás una notificación 🔔 cuando esté listo para descargar.

Puedes seguir trabajando mientras tanto.
```

---

### 2️⃣ Generación en Background

**Backend (automático):**
- Thread inicia generación en background
- Estado: `pending` → `processing`
- Procesa productos y actividades según filtros
- Genera PDF/DOCX/Excel según formato
- Sube archivo a S3 bucket `softone-pdm-informes`
- Crea notificación tipo `INFORME_PDM_READY`
- Estado: `processing` → `completed`

**Tiempo estimado:**
- Pequeño (1-5 productos): 30 segundos - 1 minuto
- Mediano (5-20 productos): 1-3 minutos
- Grande (20+ productos): 3-5 minutos
- Con IA activada: +50% tiempo

---

### 3️⃣ Recibir Notificación

**Sistema de notificaciones:**
- Polling automático cada **60 segundos**
- Badge 🔔 se actualiza con contador
- Notificación aparece en panel superior derecho

**Mensaje de notificación:**
```
📊 Informe PDM Listo
Tu informe de año 2025 está disponible
Haz clic para descargar
```

**Datos en notificación:**
```json
{
  "informe_id": 123,
  "anio": 2025,
  "formato": "pdf",
  "filename": "Informe_PDM_2025_20260206_140530.pdf",
  "file_size": 524288
}
```

---

### 4️⃣ Descargar Informe

**Opción A: Click en notificación**
1. Usuario hace click en notificación 🔔
2. Handler detecta tipo `INFORME_PDM_READY`
3. Extrae `informe_id` del JSON
4. Llama `pdmService.descargarInformeAsync(informe_id)`
5. Backend hace redirect a URL S3
6. Navegador inicia descarga automática

**Opción B: Desde bandeja de notificaciones**
- Click en campana 🔔
- Click en notificación específica
- Descarga se inicia automáticamente

**Resultado:**
- Archivo se descarga con nombre original
- Formato preservado (PDF/DOCX/XLSX)
- Se abre con aplicación predeterminada

---

## 🛠️ Endpoints Backend

### POST `/api/pdm/informes/{slug}/solicitar/{anio}`
Solicita generación asíncrona de informe.

**Parámetros:**
- `slug`: Slug de entidad (UNC, GobHuila, etc.)
- `anio`: Año del informe (0 = todos)

**Body:**
```json
{
  "secretaria_ids": [1, 2, 3],
  "estados": ["En Ejecución", "No Iniciado"],
  "fecha_inicio": "2025-01-01",
  "fecha_fin": "2025-12-31",
  "formato": "pdf",
  "usar_ia": true
}
```

**Response 202 Accepted:**
```json
{
  "message": "Informe solicitado correctamente",
  "informe_id": 123,
  "estado": "pending",
  "estimado_minutos": 3
}
```

---

### GET `/api/pdm/informes/estado/{informe_id}`
Consulta estado de generación.

**Response durante generación:**
```json
{
  "id": 123,
  "estado": "processing",
  "progreso": 65,
  "created_at": "2025-02-06T14:05:30Z",
  "started_at": "2025-02-06T14:05:31Z"
}
```

**Response completado:**
```json
{
  "id": 123,
  "estado": "completed",
  "progreso": 100,
  "s3_url": "https://softone-pdm-informes.s3.us-east-1.amazonaws.com/...",
  "filename": "Informe_PDM_2025_20260206_140530.pdf",
  "file_size": 524288,
  "completed_at": "2025-02-06T14:08:15Z",
  "expires_at": "2025-02-13T14:08:15Z"
}
```

---

### GET `/api/pdm/informes/descargar/{informe_id}`
Redirige a URL S3 para descarga directa.

**Response 302 Redirect:**
```
Location: https://softone-pdm-informes.s3.us-east-1.amazonaws.com/entidad_123/Informe_PDM_2025_20260206_140530.pdf
```

---

### GET `/api/pdm/informes/mis-informes?limite=10`
Lista últimos informes del usuario.

**Response:**
```json
{
  "informes": [
    {
      "id": 123,
      "anio": 2025,
      "formato": "pdf",
      "estado": "completed",
      "filename": "Informe_PDM_2025_20260206_140530.pdf",
      "file_size": 524288,
      "created_at": "2025-02-06T14:05:30Z",
      "completed_at": "2025-02-06T14:08:15Z"
    }
  ]
}
```

---

## 📦 Configuración S3

**Bucket:** `softone-pdm-informes`  
**Región:** `us-east-1`  
**Acceso:** Lectura pública

**Estructura de keys:**
```
entidad_{entity_id}/Informe_PDM_{anio}_{timestamp}.{formato}
```

**Ejemplo:**
```
entidad_5/Informe_PDM_2025_20260206_140530.pdf
```

**CORS configurado:**
```json
{
  "CORSRules": [
    {
      "AllowedOrigins": ["*"],
      "AllowedMethods": ["GET", "HEAD"],
      "AllowedHeaders": ["*"],
      "MaxAgeSeconds": 3600
    }
  ]
}
```

**Expiración:**
- Archivos expiran después de **7 días**
- Campo `expires_at` en base de datos
- Cleanup manual (por ahora)

---

## 🔍 Testing Manual

### Test Case 1: Informe PDF Simple
1. Login en https://www.softone360.com
2. Ir a PDM → Generar Informe
3. Seleccionar:
   - Año: 2025
   - Formato: PDF
   - Sin IA
4. Click Confirmar
5. ✅ Mensaje "Tu informe se está generando..."
6. Esperar ~1-2 minutos
7. ✅ Badge 🔔 debe incrementar
8. Click en campana
9. ✅ Ver notificación "Informe PDM Listo"
10. Click en notificación
11. ✅ Descarga debe iniciar automáticamente
12. ✅ PDF debe abrirse correctamente

---

### Test Case 2: Informe Word con IA
1. Generar Informe
2. Seleccionar:
   - Año: 2025
   - Formato: Word
   - IA activada ✓
3. Click Confirmar
4. Esperar ~2-4 minutos (IA es más lento)
5. ✅ Badge 🔔 debe incrementar
6. Click en notificación
7. ✅ Descarga DOCX
8. ✅ Verificar descripciones mejoradas con IA

---

### Test Case 3: Informe Excel Multi-Año
1. Generar Informe
2. Seleccionar:
   - Año: Todos los años
   - Formato: Excel
   - Secretarías: Varias seleccionadas
3. Click Confirmar
4. Esperar ~3-5 minutos
5. ✅ Badge 🔔 debe incrementar
6. Click en notificación
7. ✅ Descarga XLSX
8. ✅ Verificar hojas por año

---

### Test Case 4: Manejo de Errores
1. Generar Informe con filtros que no retornen datos
2. ✅ Debe recibir notificación de error
3. ✅ Mensaje debe indicar "No hay productos para los filtros especificados"

---

## 🐛 Troubleshooting

### Problema: No recibo notificación
**Causa:** Polling deshabilitado o error en backend  
**Solución:**
```bash
# Verificar logs backend
eb logs --cw-log-group /aws/elasticbeanstalk/PDMPortal-env/var/log/eb-engine.log

# Verificar endpoint manualmente
curl https://api.softone360.com/api/pdm/informes/estado/123
```

---

### Problema: Descarga no se inicia
**Causa:** URL S3 expirada o bucket no público  
**Solución:**
```bash
# Verificar bucket policy
aws s3api get-bucket-policy --bucket softone-pdm-informes

# Verificar que archivo existe
aws s3 ls s3://softone-pdm-informes/entidad_5/
```

---

### Problema: Error 504 Timeout
**Causa:** Usando endpoint síncrono antiguo  
**Solución:** Verificar que frontend está usando `/solicitar/` y no `/generar/`

---

### Problema: Notificación no desaparece
**Causa:** Handler no marca como leída  
**Solución:** Click derecho → "Marcar como leída"

---

## 📊 Monitoreo

### Logs Backend
```bash
# Ver logs en vivo
eb logs --stream

# Buscar errores en generación
eb logs | grep "Error generando informe"

# Ver informes completados
eb logs | grep "Informe generado exitosamente"
```

---

### Consultas Base de Datos
```sql
-- Ver informes recientes
SELECT id, user_id, anio, formato, estado, progreso, created_at, completed_at
FROM informes_estado
ORDER BY created_at DESC
LIMIT 20;

-- Ver informes en progreso
SELECT * FROM informes_estado 
WHERE estado IN ('pending', 'processing');

-- Ver informes fallidos
SELECT * FROM informes_estado 
WHERE estado = 'failed'
ORDER BY created_at DESC;

-- Estadísticas de tiempo de generación
SELECT 
  formato,
  AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) as promedio_segundos,
  MAX(EXTRACT(EPOCH FROM (completed_at - started_at))) as maximo_segundos
FROM informes_estado
WHERE estado = 'completed'
GROUP BY formato;
```

---

### Estadísticas S3
```bash
# Listar archivos en bucket
aws s3 ls s3://softone-pdm-informes/ --recursive --human-readable

# Ver tamaños totales por entidad
aws s3 ls s3://softone-pdm-informes/ --recursive | awk '{sum+=$3} END {print sum/1024/1024" MB"}'

# Contar archivos
aws s3 ls s3://softone-pdm-informes/ --recursive | wc -l
```

---

## 🚀 Mejoras Futuras

### Corto Plazo
- [ ] Interfaz "Mis Informes" en frontend
- [ ] Progress bar en panel de notificaciones
- [ ] Poder cancelar generación en progreso
- [ ] Mostrar tiempo estimado de completitud

### Mediano Plazo
- [ ] Cronjob para limpiar archivos expirados
- [ ] Descargas con firma temporal en vez de público
- [ ] Cache de informes duplicados (mismo filtro)
- [ ] Compresión ZIP para múltiples formatos

### Largo Plazo
- [ ] WebSockets para actualizaciones en tiempo real
- [ ] Sistema de colas (Celery/RabbitMQ)
- [ ] Versionamiento de informes
- [ ] Plantillas personalizadas por entidad

---

## 📝 Checklist Deploy

- [x] Backend: Modelo `InformeEstado` creado
- [x] Backend: Servicio `InformeGeneratorService` implementado
- [x] Backend: 4 endpoints nuevos `/solicitar`, `/estado`, `/descargar`, `/mis-informes`
- [x] Backend: Integración con notificaciones (`Alert` tipo `INFORME_PDM_READY`)
- [x] Backend: Desplegado a Elastic Beanstalk
- [x] S3: Bucket `softone-pdm-informes` creado
- [x] S3: Public access configurado
- [x] S3: CORS habilitado
- [x] Frontend: `pdm.service.ts` métodos async agregados
- [x] Frontend: `pdm.ts` componente actualizado
- [x] Frontend: `global-navbar.ts` handler agregado
- [x] Frontend: Compilado y desplegado a S3
- [x] Frontend: CloudFront cache invalidado
- [ ] Testing: Test Case 1 (PDF simple)
- [ ] Testing: Test Case 2 (Word con IA)
- [ ] Testing: Test Case 3 (Excel multi-año)
- [ ] Testing: Test Case 4 (Manejo errores)

---

## ✅ Resumen Final

**Problema Original:**
- Error 504 timeout al generar informes
- CORS bloqueado
- Interfaz congelada durante generación

**Solución Implementada:**
- Generación asíncrona en background thread
- Notificaciones push automáticas
- Descarga desde S3 cuando está listo
- Usuario puede seguir trabajando

**Estado Actual:**
✅ Backend desplegado  
✅ S3 configurado  
✅ Frontend desplegado  
⏳ Testing end-to-end pendiente  

**Próximo Paso:**
Realizar testing manual siguiendo los Test Cases descritos en esta guía.

---

**📅 Última actualización:** 2025-02-06  
**👤 Autor:** GitHub Copilot  
**📧 Soporte:** Verificar logs en Elastic Beanstalk y S3
