# 🚨 SOLUCIÓN CORS - Deployment Urgente

## Problema Identificado
El backend AWS solo permite CORS desde:
- `http://softone360-frontend-useast1.s3-website-us-east-1.amazonaws.com`

Pero tu frontend real está en:
- `https://softone360.com`
- `https://www.softone360.com`

**Por eso el navegador bloquea las peticiones con error CORS.**

---

## ✅ SOLUCIÓN APLICADA

### 1. Archivos Actualizados

#### `.ebextensions/02-env.config`
```yaml
ALLOWED_ORIGINS: "http://localhost:4200,http://softone360-frontend-useast1.s3-website-us-east-1.amazonaws.com,https://softone360-frontend-useast1.s3-website-us-east-1.amazonaws.com,https://softone360.com,https://www.softone360.com"
```

#### `.env`
```bash
ALLOWED_ORIGINS=http://localhost:4200,http://softone360-frontend-useast1.s3-website-us-east-1.amazonaws.com,https://softone360.com,https://www.softone360.com
```

---

## 🚀 DEPLOYMENT - EJECUTAR AHORA

### Opción 1: Deployment Completo (Recomendado)

```bash
cd /Users/mlargo/Documents/softone360/portal/backend

# Desplegar a AWS Elastic Beanstalk
eb deploy

# Esperar confirmación
eb status

# Ver logs para confirmar CORS
eb logs
```

### Opción 2: Solo Actualizar Variables de Entorno (Más Rápido)

```bash
cd /Users/mlargo/Documents/softone360/portal/backend

# Configurar variable directamente en AWS
eb setenv ALLOWED_ORIGINS="http://localhost:4200,http://softone360-frontend-useast1.s3-website-us-east-1.amazonaws.com,https://softone360-frontend-useast1.s3-website-us-east-1.amazonaws.com,https://softone360.com,https://www.softone360.com"

# Reiniciar ambiente (aplica cambios inmediatamente)
eb restart
```

---

## 🧪 VERIFICACIÓN POST-DEPLOYMENT

### 1. Verificar Configuración CORS en AWS

```bash
eb ssh

# Dentro del servidor EC2
env | grep ALLOWED_ORIGINS

# Deberías ver:
# ALLOWED_ORIGINS=http://localhost:4200,http://softone360-frontend-useast1.s3-website-us-east-1.amazonaws.com,https://softone360-frontend-useast1.s3-website-us-east-1.amazonaws.com,https://softone360.com,https://www.softone360.com

exit
```

### 2. Test desde el Navegador

```bash
# Abrir consola del navegador en https://softone360.com
# Ejecutar:
fetch('https://api.softone360.com/api/pdm/v2/sora-boyaca/data', {
  headers: { 'Authorization': 'Bearer TU_TOKEN_AQUI' }
})
.then(r => r.json())
.then(d => console.log('✅ CORS Fixed:', d))
.catch(e => console.error('❌ Error:', e))
```

### 3. Verificar Logs

```bash
eb logs | grep "CORS Origins permitidos"

# Deberías ver:
# ✅ CORS Origins permitidos: ['http://localhost:4200', 'http://softone360-frontend-useast1.s3-website-us-east-1.amazonaws.com', 'https://softone360-frontend-useast1.s3-website-us-east-1.amazonaws.com', 'https://softone360.com', 'https://www.softone360.com']
```

---

## 🔄 ERRORES DE ARCHIVOS JS (Menor Prioridad)

Los errores `ERR_FILE_NOT_FOUND` para:
- `extensionState.js`
- `utils.js`
- `heuristicsRedefinitions.js`

**Causas Posibles:**
1. **Cache del navegador**: Intenta Ctrl+Shift+R (hard refresh)
2. **Archivos no incluidos en build**: Verificar `angular.json` y proceso de build
3. **Sourcemap references**: Pueden ser warnings, no críticos

**Solución Rápida:**
```bash
cd /Users/mlargo/Documents/softone360/portal/frontend

# Rebuild completo
rm -rf dist/ node_modules/.cache
npm run build

# Si usas deploy script
./deploy-to-s3.sh
```

---

## ⏱️ TIEMPO ESTIMADO DE DEPLOYMENT

- **Opción 1 (eb deploy)**: ~5-8 minutos
- **Opción 2 (eb setenv + restart)**: ~2-3 minutos ⚡

---

## 🎯 RESULTADO ESPERADO

Después del deployment:
- ✅ Sin errores CORS en consola del navegador
- ✅ PDM carga datos correctamente
- ✅ Los reintentos (1/3, 2/3, 3/3) desaparecen
- ✅ API responde desde `https://softone360.com`

---

## 🆘 SI EL PROBLEMA PERSISTE

### Verificar DNS/Proxy

```bash
# Verificar que el dominio apunta correctamente
nslookup api.softone360.com

# Hacer request directo
curl -I https://api.softone360.com/health
```

### Verificar CloudFront/CDN

Si usas CloudFront u otro CDN:
1. Invalidar caché
2. Verificar configuración de CORS headers pass-through
3. Asegurar que el CDN no está bloqueando headers

---

## 📝 NOTAS IMPORTANTES

1. **SIEMPRE** incluye `https://softone360.com` y `https://www.softone360.com` en CORS
2. **NO** uses `allow_origins=["*"]` en producción (riesgo de seguridad)
3. El backend ya tiene manejo correcto de preflight requests (OPTIONS)
4. La configuración actual en `main.py` es correcta, solo faltaba agregar los dominios

---

**¡EJECUTA EL DEPLOYMENT AHORA!** 🚀
