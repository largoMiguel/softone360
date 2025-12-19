#!/bin/bash
set -e

echo "🚀 Iniciando despliegue del frontend a S3..."

# Cambiar al directorio del frontend
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Variables
BUCKET_NAME="softone360.com"
DISTRIBUTION_PATH="dist/pqrs-frontend/browser"
CLOUDFRONT_DISTRIBUTION_ID="E3OH65AY982GZ5"

# 1. Build de producción
echo "📦 Compilando frontend para producción..."
npm run build -- --configuration=production

# 2. Verificar que el build existe
if [ ! -d "$DISTRIBUTION_PATH" ]; then
    echo "❌ Error: El directorio $DISTRIBUTION_PATH no existe"
    exit 1
fi

# 3. Sincronizar con S3 (excluir _redirects que es solo para Netlify)
echo "☁️  Subiendo archivos a S3..."
cd $DISTRIBUTION_PATH

# Subir assets inmutables (cache forever)
aws s3 sync . s3://$BUCKET_NAME/ \
  --delete \
  --cache-control "public,max-age=31536000,immutable" \
  --exclude "*.html" \
  --exclude "_redirects" \
  --exclude "config.json"

# Subir HTML files (no cache - siempre obtener la versión más fresca)
aws s3 cp . s3://$BUCKET_NAME/ \
  --exclude "*" \
  --include "*.html" \
  --cache-control "no-cache" \
  --recursive

# Remover _redirects si existe (no needed en S3, es para Netlify)
aws s3 rm s3://$BUCKET_NAME/_redirects 2>/dev/null || true

echo ""
echo "✅ Despliegue completado en ambos buckets!"
echo "🌐 URLs:"
echo "   - https://www.softone360.com"
echo "   - https://softone360.com"
echo ""

# Invalidar caché de CloudFront
if [ ! -z "$CLOUDFRONT_DISTRIBUTION_ID" ]; then
    echo "📝 Invalidando caché de CloudFront..."
    aw✅ Despliegue completado!"
echo "🌐 URL: https://softone360.com (www.softone360.com redirige aquí)nvalidado"
fi

echo ""
echo "ℹ️  SPA Routing está habilitado:"
echo "   - Error Document: index.html"
echo "   - Todos los 404s redirigen a index.html para SPA routing"
