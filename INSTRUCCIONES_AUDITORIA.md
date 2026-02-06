# 🔍 Instrucciones de Auditoría - Imágenes S3 vs Base64

## Problema
Las imágenes de evidencias PDM deberían mostrarse desde S3, pero están mostrando desde Base64.

## ✅ Backend - FUNCIONANDO CORRECTAMENTE
El backend YA está devolviendo correctamente:
- `imagenes`: [] (vacío)
- `imagenes_s3_urls`: [URLs de S3]
- `migrated_to_s3`: true

Confirmado con endpoint debug: `/api/admin/debug/evidencia-raw/201`

## 🔍 Frontend - REQUIERE AUDITORÍA

### Paso 1: Limpiar TODO el caché del navegador
1. Presiona **Cmd + Shift + Delete** (Mac) o **Ctrl + Shift + Delete** (Windows)
2. Selecciona "Todo el tiempo" o "Desde siempre"
3. Marca TODAS las opciones:
   - ✅ Historial de navegación
   - ✅ Cookies y otros datos de sitios
   - ✅ **Imágenes y archivos en caché** ← CRÍTICO
4. Haz clic en "Borrar datos"
5. Cierra TODAS las pestañas de softone360.com
6. Cierra el navegador completamente
7. Abre el navegador de nuevo

### Paso 2: Abrir DevTools ANTES de cargar la página
1. Presiona **F12** o **Cmd + Option + I** (Mac)
2. Ve a la pestaña **Console**
3. Marca la opción **"Preserve log"** (para no perder logs al navegar)
4. Ve a la pestaña **Network**
5. Marca la opción **"Disable cache"** ← CRÍTICO

### Paso 3: Cargar la página del PDM
1. Navega a: https://www.softone360.com/sora-boyaca/pdm
2. Inicia sesión si es necesario
3. Busca el producto **4102052**

### Paso 4: Ver los logs de depuración

Cuando cargues la evidencia (haz clic en "Tiene evidencia - Clic para cargar"), deberías ver en la consola:

```
🔄 Cargando evidencia para actividad 201...
📥 Evidencia recibida del backend para actividad 201: {...}
🔍 obtenerImagenesParaMostrar llamado con: {...}
```

#### ✅ Si funciona correctamente, verás:
```
✅ DECISIÓN: Mostrando imágenes desde S3: [
  "https://softone-pdm-evidencias.s3.us-east-1.amazonaws.com/entity_4/evidencia_191/imagen_0_c445e953.jpg",
  ...
]
```

#### ❌ Si sigue fallando, verás:
```
⚠️ DECISIÓN: Mostrando imágenes Base64 (legacy), cantidad: 4
```

### Paso 5: Auditar la respuesta del API en Network

1. Ve a la pestaña **Network** del DevTools
2. Filtra por: `evidencia`
3. Busca la petición: `GET .../actividades/201/evidencia`
4. Haz clic en ella
5. Ve a la pestaña **Response**
6. **VERIFICA**:
   - ¿`imagenes` está vacío `[]`?
   - ¿`imagenes_s3_urls` tiene 4 URLs?
   - ¿Las URLs empiezan con `https://softone-pdm-evidencias.s3.us-east-1.amazonaws.com`?

## 🔬 Diagnóstico según resultados

### Caso A: Backend devuelve S3 pero frontend muestra Base64
**Síntoma**: En Network ves `imagenes: []` y `imagenes_s3_urls: [...]`, pero las imágenes se muestran desde Base64.

**Causa**: Cache del navegador tiene una versión vieja de la evidencia.

**Solución**: 
```javascript
// Pega esto en la consola del navegador:
localStorage.clear();
sessionStorage.clear();
location.reload(true);
```

### Caso B: Backend devuelve Base64
**Síntoma**: En Network ves `imagenes: ["/9j/4AAQSkZJRgABAQAAAQ..."]` (Base64 largo).

**Causa**: El endpoint del backend NO está limpiando el Base64.

**Solución**: Verificar que el código en `pdm_v2.py` líneas 1000-1030 esté desplegado.

### Caso C: Frontend no encuentra imagenes_s3_urls
**Síntoma**: En console ves `tiene_imagenes_s3: 0` cuando debería ser 4.

**Causa**: El objeto evidencia no tiene la propiedad `imagenes_s3_urls`.

**Solución**: Verificar que el modelo `EvidenciaActividad` en el frontend incluya esta propiedad.

## 📋 Información para reportar

Si después de todos estos pasos sigue fallando, reporta:

1. **Captura de pantalla de Console** mostrando los logs `🔍` y `✅/⚠️`
2. **Captura de pantalla de Network → Response** de la petición de evidencia
3. **Versión del JavaScript cargado**:
   - En la pestaña Network, busca `main-*.js`
   - Debería ser: `main-F4MUJ3CU.js` (desplegado 03:11 UTC)
4. **Estado del caché**:
   - ¿"Disable cache" está marcado en Network?
   - ¿Qué dice el header `Cache-Control` en la respuesta del API?

## 🚀 Última versión desplegada

- **Backend**: Deployed 03:08 UTC (con debug endpoint)
- **Frontend**: Deployed 03:11 UTC (con logs detallados)
  - Bundle: `main-F4MUJ3CU.js`
- **CloudFront**: Invalidación iniciada 03:11 UTC (ID: I80M4QRQNCWAH4L28O819YNHI3)

## 🔗 Enlaces útiles

- Debug producto: http://softone-backend-useast1.eba-epvnmbmk.us-east-1.elasticbeanstalk.com/api/admin/debug/producto/4102052
- Debug evidencia raw: http://softone-backend-useast1.eba-epvnmbmk.us-east-1.elasticbeanstalk.com/api/admin/debug/evidencia-raw/201
- Frontend: https://www.softone360.com/sora-boyaca/pdm
