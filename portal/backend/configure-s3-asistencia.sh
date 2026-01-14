#!/bin/bash

# Script para configurar el bucket S3 para fotos de asistencia
# Permite lectura pública de las fotos

BUCKET_NAME="softone360-humano-photos"
REGION="us-east-1"
POLICY_FILE="s3-asistencia-humano-photos-policy.json"

echo "🔧 Configurando bucket S3 para asistencia: ${BUCKET_NAME}"
echo ""

# Verificar que el bucket existe
echo "1️⃣ Verificando que el bucket existe..."
aws s3 ls s3://${BUCKET_NAME} --region ${REGION} > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✅ Bucket ${BUCKET_NAME} existe"
else
    echo "❌ Error: El bucket ${BUCKET_NAME} no existe"
    exit 1
fi

# Desbloquear acceso público (si está bloqueado)
echo ""
echo "2️⃣ Configurando permisos de acceso público..."
aws s3api put-public-access-block \
    --bucket ${BUCKET_NAME} \
    --public-access-block-configuration \
    "BlockPublicAcls=false,IgnorePublicAcls=false,BlockPublicPolicy=false,RestrictPublicBuckets=false" \
    --region ${REGION}

if [ $? -eq 0 ]; then
    echo "✅ Permisos de acceso público configurados"
else
    echo "⚠️ Advertencia: No se pudieron configurar los permisos de acceso público"
fi

# Aplicar política del bucket
echo ""
echo "3️⃣ Aplicando política del bucket..."
aws s3api put-bucket-policy \
    --bucket ${BUCKET_NAME} \
    --policy file://${POLICY_FILE} \
    --region ${REGION}

if [ $? -eq 0 ]; then
    echo "✅ Política del bucket aplicada correctamente"
else
    echo "❌ Error: No se pudo aplicar la política del bucket"
    exit 1
fi

# Configurar CORS (para que el frontend pueda acceder a las imágenes)
echo ""
echo "4️⃣ Configurando CORS..."
cat > /tmp/cors-config.json << 'EOF'
{
  "CORSRules": [
    {
      "AllowedOrigins": [
        "https://softone360.com",
        "https://www.softone360.com",
        "https://d39d4iayhy9x2w.cloudfront.net",
        "http://localhost:4200"
      ],
      "AllowedMethods": ["GET", "HEAD"],
      "AllowedHeaders": ["*"],
      "MaxAgeSeconds": 3000
    }
  ]
}
EOF

aws s3api put-bucket-cors \
    --bucket ${BUCKET_NAME} \
    --cors-configuration file:///tmp/cors-config.json \
    --region ${REGION}

if [ $? -eq 0 ]; then
    echo "✅ CORS configurado correctamente"
    rm /tmp/cors-config.json
else
    echo "⚠️ Advertencia: No se pudo configurar CORS"
fi

echo ""
echo "✅ ¡Configuración completada!"
echo ""
echo "📝 Resumen:"
echo "   - Bucket: ${BUCKET_NAME}"
echo "   - Región: ${REGION}"
echo "   - Acceso público habilitado para: asistencia/*"
echo "   - CORS configurado para softone360.com"
echo ""
echo "🔗 URL base de las fotos:"
echo "   https://${BUCKET_NAME}.s3.${REGION}.amazonaws.com/asistencia/"
