# Fix: Fotos de Asistencia no se Muestran

**Fecha:** 14 de enero de 2026  
**Módulo:** Control de Asistencia  
**URL:** https://softone360.com/#/talento-humano/funcionarios

## 🐛 Problema Identificado

Las fotos de los registros de asistencia no se mostraban en el portal web porque:

1. **Credenciales AWS no configuradas**: Las variables de entorno `AWS_ACCESS_KEY_ID` y `AWS_SECRET_ACCESS_KEY` no estaban definidas en los archivos de configuración
2. **Bucket incorrecto**: El código usaba `AWS_S3_BUCKET` (softone360-pqrs-archivos) en lugar del bucket específico para fotos
3. **ACL no soportado**: El código intentaba usar `ACL='public-read'` pero el bucket tiene `BucketOwnerEnforced`

### Síntomas

- ✅ Los registros de asistencia se guardaban correctamente en la BD
- ❌ El campo `foto_url` quedaba como `NULL`
- ❌ Las fotos capturadas desde la app de ventanilla no se almacenaban
- ❌ En el portal web solo se mostraba el ícono de "sin foto"

## 🔧 Solución Implementada

### 1. Configuración de Credenciales AWS

**Archivo:** `env` y `env.production`

```bash
# Agregadas credenciales AWS
AWS_ACCESS_KEY_ID=<tu_access_key>
AWS_SECRET_ACCESS_KEY=<tu_secret_key>
AWS_S3_BUCKET_ASISTENCIA=softone360-humano-photos
```

### 2. Mejora del Código de Subida a S3

**Archivo:** `backend/app/routes/asistencia.py`

**Cambios:**
- Configurar bucket específico con fallback: `AWS_S3_BUCKET_ASISTENCIA` → `AWS_S3_BUCKET_PHOTOS` → `softone360-humano-photos`
- Soporte para credenciales del perfil AWS (~/.aws/credentials) como fallback
- Eliminado uso de ACL (incompatible con BucketOwnerEnforced)
- URL correcta con región: `https://{BUCKET}.s3.{REGION}.amazonaws.com/{KEY}`

```python
# Antes
BUCKET_NAME = os.getenv("AWS_S3_BUCKET", "softone360-pqrs-archivos")
s3_client.put_object(..., ACL='public-read')  # ❌ Error

# Después
BUCKET_NAME = os.getenv("AWS_S3_BUCKET_ASISTENCIA", 
                        os.getenv("AWS_S3_BUCKET_PHOTOS", "softone360-humano-photos"))
s3_client.put_object(...)  # ✅ Sin ACL, la política controla el acceso
```

### 3. Configuración del Bucket S3

**Bucket:** `softone360-humano-photos`

**Script:** `backend/configure-s3-asistencia.sh`

- ✅ Acceso público habilitado para `asistencia/*`
- ✅ Política de bucket configurada para lectura pública
- ✅ CORS configurado para softone360.com
- ✅ BucketOwnerEnforced (sin ACLs)

**Política del bucket:**
```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": "*",
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::softone360-humano-photos/asistencia/*"
  }]
}
```

## 📁 Archivos Modificados

1. ✅ `/env` - Credenciales y bucket configurados
2. ✅ `/env.production` - Credenciales y bucket configurados
3. ✅ `/backend/app/routes/asistencia.py` - Mejorado código de S3
4. ✅ `/backend/s3-asistencia-humano-photos-policy.json` - Política del bucket
5. ✅ `/backend/configure-s3-asistencia.sh` - Script de configuración
6. ✅ `/backend/test_s3_asistencia.py` - Script de prueba

## 🧪 Pruebas Realizadas

### Prueba Local
```bash
cd /Users/mlargo/Documents/softone360/portal/backend
python3 test_s3_asistencia.py
```

**Resultado:**
```
✅ Cliente S3 inicializado
✅ Imagen subida exitosamente
🔗 https://softone360-humano-photos.s3.us-east-1.amazonaws.com/asistencia/test/20260114/...
```

### Verificación de Acceso Público
```bash
curl -I "https://softone360-humano-photos.s3.us-east-1.amazonaws.com/asistencia/test/..."
```

**Resultado:**
```
HTTP/1.1 200 OK
Content-Type: image/jpeg
```

## 🚀 Deployment

### Script Automático
```bash
cd /Users/mlargo/Documents/softone360/portal
./deploy-fix-asistencia.sh
```

El script:
1. Commitea los cambios
2. Push al repositorio
3. Configura variables de entorno en Elastic Beanstalk
4. Despliega el backend
5. Verifica el endpoint de salud

### Configuración Manual en AWS

Si prefieres configurar manualmente:

```bash
cd /Users/mlargo/Documents/softone360/portal/backend

# Configurar variables de entorno (usar tus propias credenciales)
eb setenv \
    AWS_ACCESS_KEY_ID=<tu_access_key> \
    AWS_SECRET_ACCESS_KEY=<tu_secret_key> \
    AWS_S3_BUCKET_ASISTENCIA=softone360-humano-photos

# Desplegar
eb deploy softone-backend-useast1 --timeout 10
```

## 🔍 Verificación Post-Deployment

### 1. Verificar que el backend responde
```bash
curl http://softone-backend-useast1.eba-epvnmbmk.us-east-1.elasticbeanstalk.com/health
```

### 2. Registrar asistencia desde la app de ventanilla
1. Abrir app de escritorio
2. Ingresar cédula de un funcionario
3. Capturar foto
4. Registrar entrada/salida

### 3. Verificar en el portal web
1. Ir a https://softone360.com/#/talento-humano/funcionarios
2. Verificar que la foto se muestra en la tabla
3. Hacer clic en el tiempo para ver el detalle con la foto grande

### 4. Ver logs del backend (si hay problemas)
```bash
cd /Users/mlargo/Documents/softone360/portal/backend
eb logs
```

Buscar líneas:
```
[INFO] S3 client inicializado con credenciales explícitas
[DEBUG] Foto decodificada: XXXX bytes
[DEBUG] URL generada: https://softone360-humano-photos.s3...
```

## 📊 Estructura de Archivos en S3

```
s3://softone360-humano-photos/
└── asistencia/
    ├── 20260114/
    │   ├── uuid1.jpg
    │   ├── uuid2.jpg
    │   └── ...
    ├── 20260115/
    │   └── ...
    └── test/
        └── (imágenes de prueba)
```

## 🔗 URLs Importantes

- **Portal Web:** https://softone360.com/#/talento-humano/funcionarios
- **Backend API:** http://softone-backend-useast1.eba-epvnmbmk.us-east-1.elasticbeanstalk.com
- **Bucket S3:** https://softone360-humano-photos.s3.us-east-1.amazonaws.com/
- **Endpoint Registros:** `GET /api/asistencia/registros`

## 📝 Notas Adicionales

### Flujo de Subida de Fotos

1. **App Ventanilla** captura foto con cámara
2. Convierte foto a base64
3. Envía POST a `/api/asistencia/registros` con `foto_base64`
4. **Backend** recibe la foto:
   - Decodifica base64
   - Genera nombre único: `asistencia/YYYYMMDD/uuid.jpg`
   - Sube a S3
   - Guarda URL en `registros_asistencia.foto_url`
5. **Frontend** muestra la foto desde la URL de S3

### Compatibilidad

- ✅ La app de ventanilla no requiere cambios
- ✅ El frontend no requiere cambios
- ✅ Solo cambios en backend y configuración

### Seguridad

- Las credenciales están en variables de entorno
- El bucket solo permite lectura pública de `asistencia/*`
- Las fotos tienen nombres UUID aleatorios (no adivinables)

## ✅ Checklist de Deployment

- [x] Credenciales AWS configuradas en env files
- [x] Bucket S3 configurado con política pública
- [x] Código de backend actualizado
- [x] Pruebas locales exitosas
- [x] Script de deployment creado
- [ ] Deployment a producción ejecutado
- [ ] Verificación post-deployment completada
- [ ] Prueba end-to-end exitosa

## 🆘 Troubleshooting

### Las fotos siguen sin aparecer

1. Verificar variables de entorno en EB:
   ```bash
   eb printenv
   ```

2. Ver logs del backend:
   ```bash
   eb logs | grep -i "foto\|s3"
   ```

3. Verificar que el bucket está configurado:
   ```bash
   aws s3api get-bucket-policy --bucket softone360-humano-photos
   ```

### Error 403 al acceder a las fotos

- Verificar la política del bucket
- Ejecutar `configure-s3-asistencia.sh` nuevamente

### Error al subir fotos

- Verificar credenciales AWS
- Verificar permisos del IAM user
- Ver logs del backend con `eb logs`
