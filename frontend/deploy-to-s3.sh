#!/bin/bash
set -e

echo "🚀 Iniciando despliegue del frontend a S3..."

# Variables
BUCKET_NAME="softone360-frontend-useast1"
DISTRIBUTION_PATH="dist/pqrs-frontend/browser"

# 1. Build de producción
echo "📦 Compilando frontend para producción..."
npm run build -- --configuration=production

# 2. Verificar que el build existe
if [ ! -d "$DISTRIBUTION_PATH" ]; then
    echo "❌ Error: El directorio $DISTRIBUTION_PATH no existe"
    exit 1
fi

# 3. Sincronizar con S3
echo "☁️  Subiendo archivos a S3..."
cd $DISTRIBUTION_PATH
aws s3 sync . s3://$BUCKET_NAME/ --delete --cache-control "public,max-age=31536000,immutable" --exclude "*.html"
aws s3 cp . s3://$BUCKET_NAME/ --exclude "*" --include "*.html" --cache-control "no-cache" --recursive

echo "✅ Despliegue completado!"
echo "🌐 URL: http://$BUCKET_NAME.s3-website-us-east-1.amazonaws.com"
