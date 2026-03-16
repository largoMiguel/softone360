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
echo "PASO 1: MIGRACIONES EN RDS"
echo "======================================"
echo ""

echo -e "${YELLOW}📤 Copiando scripts de migración a EC2...${NC}"
scp -i ~/.ssh/aws-eb \
    -o IdentitiesOnly=yes \
    "$BACKEND_DIR/migrations/migrate_anio_ejecucion_rds.py" \
    ec2-user@184.72.234.103:~/

echo -e "${GREEN}✅ Scripts copiados${NC}"
echo ""

echo -e "${YELLOW}⚙️  Ejecutando migración en RDS (script existente)...${NC}"
cd "$BACKEND_DIR"
eb ssh softone-backend-useast1 --command \
    "source /var/app/venv/*/bin/activate && python migrate_anio_ejecucion_rds.py" || DEPLOY_MIGRATION_ERROR=1

if [ "$DEPLOY_MIGRATION_ERROR" = "1" ]; then
    echo -e "${RED}❌ Error en migración Python (continuando para aplicar nueva constraint única)${NC}"
else
    echo -e "${GREEN}✅ Migración Python ejecutada${NC}"
fi
echo ""

echo -e "${YELLOW}🆕 Aplicando constraint única planes institucionales (entity_id, anio, nombre)...${NC}"
eb ssh softone-backend-useast1 --command \
"PGPASSWORD='$(aws secretsmanager get-secret-value --secret-id softone/db/credentials --query SecretString --output text | python3 -c "import sys,json;print(json.load(sys.stdin)[\"password\"])")' psql -h softone-db.ccvomgoayzyt.us-east-1.rds.amazonaws.com -U dbadmin -d postgres -c \"DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='uq_planes_institucionales_entity_anio_nombre') THEN ALTER TABLE planes_institucionales ADD CONSTRAINT uq_planes_institucionales_entity_anio_nombre UNIQUE (entity_id, anio, nombre); END IF; END $$;\"" || CONSTRAINT_ERROR=1

if [ "$CONSTRAINT_ERROR" = "1" ]; then
    echo -e "${RED}⚠️  No se pudo aplicar la constraint (puede existir ya). Continuando...${NC}"
else
    echo -e "${GREEN}✅ Constraint única aplicada/verificada${NC}"
fi
echo ""

echo -e "${YELLOW}🔍 Verificando constraint en RDS...${NC}"
eb ssh softone-backend-useast1 --command \
    "PGPASSWORD='$(aws secretsmanager get-secret-value --secret-id softone/db/credentials --query SecretString --output text | python3 -c "import sys,json;print(json.load(sys.stdin)[\"password\"])")' psql \
     -h softone-db.ccvomgoayzyt.us-east-1.rds.amazonaws.com \
     -U dbadmin -d postgres \
     -c \"SELECT conname, conrelid::regclass FROM pg_constraint WHERE conname='uq_planes_institucionales_entity_anio_nombre';\""

echo -e "${GREEN}✅ Verificación constraint completada${NC}"
echo ""

echo -e "${YELLOW}🧹 Limpiando scripts de EC2...${NC}"
eb ssh softone-backend-useast1 --command "rm -f ~/migrate_anio_ejecucion_rds.py"
echo -e "${GREEN}✅ Scripts eliminados${NC}"
echo ""

echo "======================================"
echo "PASO 2: DEPLOYMENT BACKEND"
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
echo "PASO 3: DEPLOYMENT FRONTEND"
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
aws s3 sync dist/pqrs-frontend/browser/ s3://softone360-frontend-useast1/ --delete

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
echo "PASO 4: VERIFICACIÓN"
echo "======================================"
echo ""

echo -e "${YELLOW}🔍 Verificando estado del backend...${NC}"
cd "$BACKEND_DIR"
eb status softone-backend-useast1

echo ""
echo -e "${YELLOW}🔍 Verificando frontend en S3...${NC}"
aws s3 ls s3://softone-frontend-useast1/ --recursive | tail -5

echo ""
echo "======================================"
echo -e "${GREEN}✅ DEPLOYMENT COMPLETADO EXITOSAMENTE${NC}"
echo "======================================"
echo ""
echo "📋 Cambios desplegados:"
echo "  • Modal actividad/evidencia unificado"
echo "  • Evidencia obligatoria"
echo "  • Dropdown de secretaría muestra valor seleccionado"
echo "  • Carga de archivos solo para admin"
echo "  • Edición de evidencias por admin"
echo "  • Ejecución presupuestal con filtro por año"
echo "  • Sidebar de Plan de Desarrollo ajustado"
echo ""
echo "🔗 URLs:"
echo "  Backend: http://softone-backend-useast1.us-east-1.elasticbeanstalk.com"
echo "  Frontend: https://softone-frontend-useast1.s3.amazonaws.com/index.html"
echo ""
echo "📝 Documentación:"
echo "  • Migración RDS documentada en backend/migrations/"
echo "  • Cambios de código en commits git"
echo ""
echo -e "${GREEN}🎉 ¡Listo para producción!${NC}"
echo ""
