#!/bin/bash

# Script de Deployment Frontend a S3 + CloudFront
# Fecha: 17 de diciembre de 2025

set -e

echo "=========================================="
echo "🚀 DEPLOYMENT FRONTEND - SOFTONE360"
echo "=========================================="
echo ""

# Colores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

FRONTEND_DIR="/Users/mlargo/Documents/softone360/portal/frontend"
S3_BUCKET="s3://softone360.com"
CLOUDFRONT_ID="E3OH65AY982GZ5"

echo -e "${YELLOW}📍 Directorio: $FRONTEND_DIR${NC}"
cd "$FRONTEND_DIR"
echo ""

# Verificar que estamos en el directorio correcto
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Error: No se encuentra package.json${NC}"
    exit 1
fi

echo "=========================================="
echo "PASO 1: BUILD DE PRODUCCIÓN"
echo "=========================================="
echo ""

echo -e "${YELLOW}📦 Ejecutando build...${NC}"
npm run build

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Build completado exitosamente${NC}"
else
    echo -e "${RED}❌ Error en el build${NC}"
    exit 1
fi
echo ""

echo "=========================================="
echo "PASO 2: SINCRONIZAR CON S3"
echo "=========================================="
echo ""

echo -e "${YELLOW}☁️ Sincronizando archivos con S3...${NC}"
aws s3 sync dist/pqrs-frontend/browser/ $S3_BUCKET --delete --region us-east-1

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Sincronización completada${NC}"
else
    echo -e "${RED}❌ Error en la sincronización${NC}"
    exit 1
fi
echo ""

echo "=========================================="
echo "PASO 3: CONFIGURAR HEADERS DE CACHE"
echo "=========================================="
echo ""

echo -e "${YELLOW}🔧 Configurando headers del index.html...${NC}"
aws s3 cp $S3_BUCKET/index.html $S3_BUCKET/index.html \
    --metadata-directive REPLACE \
    --cache-control "no-cache, no-store, must-revalidate" \
    --content-type "text/html" \
    --region us-east-1

echo -e "${GREEN}✅ Headers configurados${NC}"
echo ""

echo "=========================================="
echo "PASO 4: INVALIDAR CACHE DE CLOUDFRONT"
echo "=========================================="
echo ""

echo -e "${YELLOW}🔄 Invalidando cache de CloudFront...${NC}"
INVALIDATION_OUTPUT=$(aws cloudfront create-invalidation \
    --distribution-id $CLOUDFRONT_ID \
    --paths "/*" \
    --query "Invalidation.Id" \
    --output text)

echo -e "${GREEN}✅ Invalidación creada: $INVALIDATION_OUTPUT${NC}"
echo ""

echo -e "${YELLOW}⏳ Esperando que se complete la invalidación...${NC}"

# Esperar a que se complete (opcional)
for i in {1..30}; do
    STATUS=$(aws cloudfront get-invalidation \
        --distribution-id $CLOUDFRONT_ID \
        --id $INVALIDATION_OUTPUT \
        --query "Invalidation.Status" \
        --output text)
    
    if [ "$STATUS" = "Completed" ]; then
        echo -e "${GREEN}✅ Invalidación completada${NC}"
        break
    fi
    
    echo -e "${YELLOW}   Estado: $STATUS (intento $i/30)${NC}"
    sleep 2
done

echo ""
echo "=========================================="
echo -e "${GREEN}✅ DEPLOYMENT COMPLETADO${NC}"
echo "=========================================="
echo ""
echo "🌐 URLs:"
echo "  • Frontend: https://www.softone360.com"
echo "  • CloudFront: https://d39d4iayhy9x2w.cloudfront.net"
echo ""
echo "📋 Próximos pasos:"
echo "  1. Verificar que el sitio carga correctamente"
echo "  2. Limpiar cache del navegador (Cmd+Shift+R en Mac)"
echo "  3. Probar en modo incógnito"
echo ""
