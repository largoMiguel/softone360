#!/bin/bash
# ============================================================
# Script de configuración de secretos en AWS para Softone360
# Ejecutar UNA SOLA VEZ después de un deploy limpio o cuando
# cambien credenciales.
#
# Requisitos:
#   - AWS CLI configurado (aws configure)
#   - EB CLI instalado (pip install awsebcli)
#   - jq instalado (brew install jq)
#   - Permisos: secretsmanager:*, elasticbeanstalk:UpdateEnvironment
#
# Uso:
#   chmod +x setup-secrets-and-env.sh
#   ./setup-secrets-and-env.sh
# ============================================================

set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

EB_ENV="softone-backend-useast1"
SECRET_NAME="softone/db/credentials"
REGION="us-east-1"
BACKEND_DIR="$(dirname "$0")/backend"

echo -e "${YELLOW}======================================"
echo "  SOFTONE360 – Configuración de secretos"
echo "======================================${NC}"
echo ""

# ── 1. Leer valores sensibles por consola (no quedan en historial) ──────────
read -rsp "DATABASE_URL (ej: postgresql://user:pass@host:5432/db): " DB_URL
echo ""
read -rsp "SECRET_KEY (clave JWT, mínimo 32 chars): " SECRET_KEY
echo ""
read -rsp "SUPERADMIN_PASSWORD: " SUPERADMIN_PASS
echo ""
read -rsp "MIGRATION_SECRET_KEY: " MIGRATION_KEY
echo ""

# Validaciones básicas
if [[ -z "$DB_URL" || -z "$SECRET_KEY" || -z "$SUPERADMIN_PASS" || -z "$MIGRATION_KEY" ]]; then
    echo -e "${RED}❌ Todos los valores son obligatorios.${NC}"
    exit 1
fi
if [[ ${#SECRET_KEY} -lt 32 ]]; then
    echo -e "${RED}❌ SECRET_KEY debe tener al menos 32 caracteres.${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}── Paso 1: Crear/actualizar secreto en AWS Secrets Manager ──${NC}"

SECRET_PAYLOAD=$(jq -n \
    --arg db  "$DB_URL" \
    --arg sk  "$SECRET_KEY" \
    --arg sp  "$SUPERADMIN_PASS" \
    --arg mk  "$MIGRATION_KEY" \
    '{DATABASE_URL: $db, SECRET_KEY: $sk, SUPERADMIN_PASSWORD: $sp, MIGRATION_SECRET_KEY: $mk}')

# Crear si no existe, actualizar si ya existe
if aws secretsmanager describe-secret --secret-id "$SECRET_NAME" --region "$REGION" &>/dev/null; then
    aws secretsmanager update-secret \
        --secret-id "$SECRET_NAME" \
        --secret-string "$SECRET_PAYLOAD" \
        --region "$REGION" \
        --output text --query "Name"
    echo -e "${GREEN}✅ Secreto actualizado: $SECRET_NAME${NC}"
else
    aws secretsmanager create-secret \
        --name "$SECRET_NAME" \
        --description "Credenciales de base de datos y claves de Softone360" \
        --secret-string "$SECRET_PAYLOAD" \
        --region "$REGION" \
        --output text --query "Name"
    echo -e "${GREEN}✅ Secreto creado: $SECRET_NAME${NC}"
fi

echo ""
echo -e "${YELLOW}── Paso 2: Configurar variables en Elastic Beanstalk (sin credenciales en archivos) ──${NC}"

cd "$BACKEND_DIR"
eb setenv \
    DATABASE_URL="$DB_URL" \
    SECRET_KEY="$SECRET_KEY" \
    SUPERADMIN_PASSWORD="$SUPERADMIN_PASS" \
    MIGRATION_SECRET_KEY="$MIGRATION_KEY" \
    -e "$EB_ENV"

echo -e "${GREEN}✅ Variables configuradas en EB environment${NC}"

echo ""
echo -e "${YELLOW}── Paso 3: Verificar que la política IAM ec2-role incluye acceso a Secrets Manager ──${NC}"

POLICY_ARN="arn:aws:iam::119538925169:policy/softone-eb-secrets-policy"
if aws iam get-policy --policy-arn "$POLICY_ARN" --region "$REGION" &>/dev/null; then
    echo -e "${GREEN}✅ Política de secretos IAM ya existe: $POLICY_ARN${NC}"
else
    echo -e "${YELLOW}⚠️  Política no encontrada. Creándola desde eb-secrets-policy.json...${NC}"
    aws iam create-policy \
        --policy-name "softone-eb-secrets-policy" \
        --policy-document file://"$(dirname "$0")/eb-secrets-policy.json" \
        --region "$REGION" \
        --output text --query "Policy.PolicyName"
    echo -e "${GREEN}✅ Política creada. Adjúntala manualmente al rol: aws-elasticbeanstalk-ec2-role${NC}"
    echo -e "${YELLOW}   aws iam attach-role-policy --role-name aws-elasticbeanstalk-ec2-role --policy-arn $POLICY_ARN${NC}"
fi

echo ""
echo -e "${GREEN}======================================"
echo "  ✅ Configuración completada"
echo "======================================"
echo ""
echo "Próximos pasos:"
echo "  1. Ejecutar:  eb deploy $EB_ENV  (en la carpeta backend)"
echo "  2. Verificar: eb health $EB_ENV"
echo "  3. Verificar: curl https://api.softone360.com/health"
echo -e "======================================${NC}"
