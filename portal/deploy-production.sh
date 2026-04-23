#!/bin/bash

# Script de Deployment a Producción - Softone360
# Fecha: 22 de noviembre de 2025
# Cambios: 
# - Unificación modal actividad/evidencia
# - Evidencia obligatoria
# - Permisos de carga de archivos solo admin
# - Edición de evidencias por admin
# - Ejecución presupuestal por año

set -e  # Salir si hay error

echo "======================================"
echo "🚀 DEPLOYMENT SOFTONE360 A PRODUCCIÓN"
echo "======================================"
echo ""

# Colores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Directorio del proyecto
PROJECT_DIR="/Users/mlargo/Documents/softone360/portal"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"

echo -e "${YELLOW}📍 Directorio del proyecto: $PROJECT_DIR${NC}"
echo ""

# Verificar que estamos en el directorio correcto
if [ ! -d "$PROJECT_DIR" ]; then
    echo -e "${RED}❌ Error: Directorio del proyecto no encontrado${NC}"
    exit 1
fi

echo "======================================"
echo "PASO 1: DEPLOYMENT BACKEND"
echo "======================================"
echo ""

echo -e "${YELLOW}📦 Desplegando backend a Elastic Beanstalk...${NC}"
cd "$BACKEND_DIR"

# Verificar que estamos en el ambiente correcto
eb list

echo -e "${YELLOW}🚀 Iniciando deployment...${NC}"
eb deploy softone-backend-useast1

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Backend desplegado exitosamente${NC}"
else
    echo -e "${RED}❌ Error en el deployment del backend${NC}"
    exit 1
fi
echo ""

echo "======================================"
echo "PASO 2: DEPLOYMENT FRONTEND"
echo "======================================"
echo ""

echo -e "${YELLOW}🏗️  Compilando frontend...${NC}"
cd "$FRONTEND_DIR"
npm run build

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Error en la compilación del frontend${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Frontend compilado${NC}"
echo ""

echo -e "${YELLOW}📤 Subiendo a S3...${NC}"
aws s3 sync dist/pqrs-frontend/browser/ s3://softone360.com/ --delete

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Frontend subido a S3${NC}"
else
    echo -e "${RED}❌ Error al subir a S3${NC}"
    exit 1
fi
echo ""

echo -e "${YELLOW}🔄 Invalidando caché de CloudFront...${NC}"
DISTRIBUTION_ID=$(aws cloudfront list-distributions --query "DistributionList.Items[?Aliases.Items[?contains(@, 'softone')]].Id | [0]" --output text)

if [ -n "$DISTRIBUTION_ID" ]; then
    aws cloudfront create-invalidation --distribution-id "$DISTRIBUTION_ID" --paths "/*"
    echo -e "${GREEN}✅ Caché invalidado${NC}"
else
    echo -e "${YELLOW}⚠️  No se encontró distribución de CloudFront - saltando invalidación${NC}"
fi
echo ""

echo "======================================"
echo "PASO 3: VERIFICACIÓN"
echo "======================================"
echo ""

echo -e "${YELLOW}🔍 Verificando estado del backend...${NC}"
cd "$BACKEND_DIR"
eb status softone-backend-useast1

echo ""
echo -e "${YELLOW}🔍 Verificando frontend en S3...${NC}"
aws s3 ls s3://www.softone360.com/ --recursive | tail -5

echo ""
echo "======================================"
echo -e "${GREEN}✅ DEPLOYMENT COMPLETADO EXITOSAMENTE${NC}"
echo "======================================"
echo ""
echo "📋 Cambios desplegados:"
echo "  • Eliminado botón 'Generar en Navegador' de informes PQRS"
echo "  • Nueva portada personalizada para informes PQRS"
echo "  • Cálculo automático de trimestre en informes"
echo "  • Diseño mejorado de portada con cajas verdes"
echo ""
echo "🔗 URLs:"
echo "  Backend: http://softone-backend-useast1.us-east-1.elasticbeanstalk.com"
echo "  Frontend: https://softone360.com"
echo ""
echo "📝 Documentación:"
echo "  • Informe PQRS ahora genera solo en servidor"
echo "  • Portada automática con periodo trimestral"
echo ""
echo -e "${GREEN}🎉 ¡Listo para producción!${NC}"
echo ""
