#!/bin/bash
set -e

echo "🔧 Configurando S3 bucket para SPA (Single Page Application) routing"
echo ""

BUCKET_NAME="softone360-frontend-useast1"
AWS_REGION="us-east-1"

# 1. Configurar el bucket como website hosting
echo "1️⃣  Configurando bucket como website hosting..."
aws s3 website s3://$BUCKET_NAME/ \
  --index-document index.html \
  --error-document index.html \
  --region $AWS_REGION

echo "✅ Bucket configurado para website hosting"
echo ""

# 2. Verificar la configuración actual
echo "2️⃣  Verificando configuración actual..."
aws s3api get-bucket-website --bucket $BUCKET_NAME --region $AWS_REGION

echo ""
echo "✅ Configuración aplicada correctamente"
echo ""

# 3. Información de acceso
echo "🌐 URLs disponibles:"
echo "   Website Endpoint: http://$BUCKET_NAME.s3-website-$AWS_REGION.amazonaws.com"
echo "   S3 Endpoint: https://$BUCKET_NAME.s3.$AWS_REGION.amazonaws.com"
echo ""

# 4. IMPORTANTE: Política pública del bucket
echo "⚠️  IMPORTANTE: Asegurar que el bucket permite acceso público (GetObject)"
echo ""
echo "Ejecutar también si es primera vez:"
echo "  aws s3api put-bucket-policy --bucket $BUCKET_NAME --policy file://bucket-policy.json"
echo ""
