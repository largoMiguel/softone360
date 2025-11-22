#!/bin/bash

# Script de Deployment Backend (Sin SSH)
# Usa AWS CLI y EB CLI para deployment
# No requiere acceso SSH directo a la instancia

set -e

echo "======================================"
echo "🚀 DEPLOYMENT BACKEND - SOFTONE360"
echo "======================================"
echo ""

# Colores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

BACKEND_DIR="/Users/mlargo/Documents/softone360/portal/backend"

# Verificar que estamos en el directorio correcto
if [ ! -d "$BACKEND_DIR" ]; then
    echo -e "${RED}❌ Error: Directorio backend no encontrado${NC}"
    exit 1
fi

echo -e "${YELLOW}📍 Directorio: $BACKEND_DIR${NC}"
cd "$BACKEND_DIR"
echo ""

# Verificar que EB CLI está instalado
if ! command -v eb &> /dev/null; then
    echo -e "${RED}❌ EB CLI no está instalado${NC}"
    echo "Instalar con: brew install awsebcli"
    exit 1
fi

# Inicializar EB si es necesario
if [ ! -d ".elasticbeanstalk" ]; then
    echo -e "${YELLOW}🔧 Inicializando Elastic Beanstalk...${NC}"
    eb init --region us-east-1 --platform python-3.11 softone360
fi

echo "======================================"
echo "PASO 1: PREPARAR DEPLOYMENT"
echo "======================================"
echo ""

echo -e "${YELLOW}📦 Creando paquete de deployment...${NC}"

# Limpiar archivos innecesarios
find . -type d -name "__pycache__" -exec rm -r {} + 2>/dev/null || true
find . -type f -name "*.pyc" -delete 2>/dev/null || true
find . -type f -name "*.pyo" -delete 2>/dev/null || true
find . -type d -name "*.egg-info" -exec rm -r {} + 2>/dev/null || true

echo -e "${GREEN}✅ Archivos limpiados${NC}"
echo ""

echo "======================================"
echo "PASO 2: DEPLOY A ELASTIC BEANSTALK"
echo "======================================"
echo ""

echo -e "${YELLOW}🚀 Desplegando a softone-backend-useast1...${NC}"

# Deploy usando EB CLI
eb use softone-backend-useast1
eb deploy

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Backend desplegado exitosamente${NC}"
else
    echo -e "${RED}❌ Error en el deployment${NC}"
    exit 1
fi
echo ""

echo "======================================"
echo "PASO 3: VERIFICAR DEPLOYMENT"
echo "======================================"
echo ""

echo -e "${YELLOW}🔍 Estado del ambiente...${NC}"
eb status

echo ""
echo -e "${YELLOW}🔍 Health del backend...${NC}"
eb health

echo ""
echo "======================================"
echo -e "${GREEN}✅ DEPLOYMENT COMPLETADO${NC}"
echo "======================================"
echo ""
echo "📋 Próximos pasos:"
echo "  1. Verificar que el backend responde:"
echo "     eb open"
echo ""
echo "  2. Ver logs si hay problemas:"
echo "     eb logs"
echo ""
echo "  3. Ejecutar migraciones (ver instrucciones abajo)"
echo ""
echo "🔗 Para ejecutar migraciones SIN SSH:"
echo "  cd $BACKEND_DIR"
echo "  ./run-migration-remote.sh"
echo ""
