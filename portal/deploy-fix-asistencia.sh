#!/bin/bash

# Script de Deployment - Fix Fotos de Asistencia
# Fecha: 14 de enero de 2026
# Cambios:
# - Configurar credenciales AWS para subida de fotos a S3
# - Usar bucket softone360-humano-photos para fotos de asistencia
# - Mejorar código de subida para soportar BucketOwnerEnforced
# - Política de bucket configurada para acceso público a asistencia/*

set -e

echo "=========================================="
echo "🚀 DEPLOYMENT FIX FOTOS DE ASISTENCIA"
echo "=========================================="
echo ""

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

PROJECT_DIR="/Users/mlargo/Documents/softone360/portal"
BACKEND_DIR="$PROJECT_DIR/backend"

echo -e "${YELLOW}📍 Directorio del proyecto: $PROJECT_DIR${NC}"
echo ""

cd "$PROJECT_DIR"

echo "=========================================="
echo "PASO 1: VERIFICAR CAMBIOS EN GIT"
echo "=========================================="
echo ""

git status

echo ""
echo -e "${YELLOW}¿Los cambios se ven correctos? (s/n)${NC}"
read -r respuesta

if [ "$respuesta" != "s" ]; then
    echo -e "${RED}❌ Deployment cancelado${NC}"
    exit 1
fi

echo ""
echo "=========================================="
echo "PASO 2: COMMIT DE CAMBIOS"
echo "=========================================="
echo ""

git add .
git commit -m "fix(asistencia): Configurar S3 para subida de fotos

- Agregar credenciales AWS a archivos env
- Usar bucket softone360-humano-photos para fotos de asistencia
- Mejorar código para soportar BucketOwnerEnforced (sin ACL)
- Configurar política de bucket para acceso público
- Agregar scripts de configuración y prueba de S3" || echo "Sin cambios para commit"

echo -e "${GREEN}✅ Cambios commiteados${NC}"

echo ""
echo "=========================================="
echo "PASO 3: PUSH A REPOSITORIO"
echo "=========================================="
echo ""

git push origin main

echo -e "${GREEN}✅ Push completado${NC}"

echo ""
echo "=========================================="
echo "PASO 4: DEPLOY BACKEND A ELASTIC BEANSTALK"
echo "=========================================="
echo ""

cd "$BACKEND_DIR"

# Verificar que existe la configuración de EB
if [ ! -d ".elasticbeanstalk" ]; then
    echo -e "${RED}❌ Error: No se encontró configuración de Elastic Beanstalk${NC}"
    exit 1
fi

# Verificar variables de entorno en EB
echo -e "${YELLOW}📋 Verificando variables de entorno en EB...${NC}"
echo ""
echo "Variables de entorno requeridas:"
echo "  - AWS_ACCESS_KEY_ID"
echo "  - AWS_SECRET_ACCESS_KEY"
echo "  - AWS_S3_BUCKET_ASISTENCIA o AWS_S3_BUCKET_PHOTOS"
echo ""

# Configurar variables de entorno en EB
echo -e "${YELLOW}🔧 Configurando variables de entorno en EB...${NC}"
echo -e "${YELLOW}⚠️  Usando credenciales desde archivo env local${NC}"

# Leer credenciales del archivo env
AWS_KEY=$(grep AWS_ACCESS_KEY_ID "$PROJECT_DIR/../env" | cut -d '=' -f2)
AWS_SECRET=$(grep AWS_SECRET_ACCESS_KEY "$PROJECT_DIR/../env" | cut -d '=' -f2)

if [ -z "$AWS_KEY" ] || [ -z "$AWS_SECRET" ]; then
    echo -e "${RED}❌ Error: No se encontraron credenciales AWS en el archivo env${NC}"
    exit 1
fi

eb setenv \
    AWS_ACCESS_KEY_ID="$AWS_KEY" \
    AWS_SECRET_ACCESS_KEY="$AWS_SECRET" \
    AWS_S3_BUCKET_ASISTENCIA=softone360-humano-photos

echo -e "${GREEN}✅ Variables configuradas${NC}"

echo ""
echo -e "${YELLOW}🚀 Desplegando backend a Elastic Beanstalk...${NC}"

eb deploy softone-backend-useast1 --timeout 10

echo -e "${GREEN}✅ Backend desplegado${NC}"

echo ""
echo "=========================================="
echo "PASO 5: VERIFICACIÓN POST-DEPLOYMENT"
echo "=========================================="
echo ""

echo -e "${YELLOW}⏳ Esperando 30 segundos para que el servicio se estabilice...${NC}"
sleep 30

echo ""
echo -e "${YELLOW}🔍 Verificando endpoint de salud...${NC}"
BACKEND_URL="http://softone-backend-useast1.eba-epvnmbmk.us-east-1.elasticbeanstalk.com"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BACKEND_URL/health" || echo "000")

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✅ Backend está respondiendo correctamente (HTTP $HTTP_CODE)${NC}"
else
    echo -e "${RED}⚠️  Backend responde con código HTTP $HTTP_CODE${NC}"
    echo -e "${YELLOW}Verifica los logs con: eb logs${NC}"
fi

echo ""
echo "=========================================="
echo "✅ DEPLOYMENT COMPLETADO"
echo "=========================================="
echo ""
echo "📝 Resumen:"
echo "  ✅ Código commiteado y pusheado"
echo "  ✅ Variables de entorno configuradas en EB"
echo "  ✅ Backend desplegado"
echo ""
echo "🧪 Para probar:"
echo "  1. Registra una asistencia desde la app de ventanilla"
echo "  2. Verifica que la foto se muestra en el portal web:"
echo "     https://softone360.com/#/talento-humano/funcionarios"
echo ""
echo "📊 Ver logs del backend:"
echo "  cd $BACKEND_DIR"
echo "  eb logs"
echo ""
echo "🔗 URLs:"
echo "  Backend: $BACKEND_URL"
echo "  Frontend: https://softone360.com"
echo "  Bucket S3: https://softone360-humano-photos.s3.us-east-1.amazonaws.com/"
echo ""
