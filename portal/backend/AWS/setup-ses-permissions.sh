#!/bin/bash

# ============================================
# Script para configurar permisos SES en AWS
# ============================================

echo "🚀 Configurando permisos de AWS SES..."
echo ""

# Colores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# ============================================
# Paso 1: Verificar AWS CLI
# ============================================
echo -e "${YELLOW}Paso 1: Verificando AWS CLI...${NC}"
if ! command -v aws &> /dev/null
then
    echo -e "${RED}❌ AWS CLI no está instalado${NC}"
    echo "Instálalo con: brew install awscli"
    exit 1
fi
echo -e "${GREEN}✅ AWS CLI instalado${NC}"
echo ""

# ============================================
# Paso 2: Verificar credenciales de AWS
# ============================================
echo -e "${YELLOW}Paso 2: Verificando credenciales de AWS...${NC}"
if ! aws sts get-caller-identity &> /dev/null
then
    echo -e "${RED}❌ No hay credenciales de AWS configuradas${NC}"
    echo "Configúralas con: aws configure"
    exit 1
fi
echo -e "${GREEN}✅ Credenciales configuradas${NC}"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo "   Account ID: $ACCOUNT_ID"
echo ""

# ============================================
# Paso 3: Buscar rol de Elastic Beanstalk
# ============================================
echo -e "${YELLOW}Paso 3: Buscando rol de Elastic Beanstalk...${NC}"
EB_ROLE="aws-elasticbeanstalk-ec2-role"

if aws iam get-role --role-name "$EB_ROLE" &> /dev/null
then
    echo -e "${GREEN}✅ Rol encontrado: $EB_ROLE${NC}"
else
    echo -e "${YELLOW}⚠️  Rol $EB_ROLE no encontrado${NC}"
    echo "¿Cuál es el nombre de tu rol de EC2 para Elastic Beanstalk?"
    read -p "Nombre del rol: " EB_ROLE
    
    if ! aws iam get-role --role-name "$EB_ROLE" &> /dev/null
    then
        echo -e "${RED}❌ Rol $EB_ROLE no existe${NC}"
        exit 1
    fi
fi
echo ""

# ============================================
# Paso 4: Adjuntar política de SES
# ============================================
echo -e "${YELLOW}Paso 4: Adjuntando política de SES al rol...${NC}"

# Opción 1: Usar política AWS managed (más fácil)
POLICY_ARN="arn:aws:iam::aws:policy/AmazonSESFullAccess"

if aws iam attach-role-policy \
    --role-name "$EB_ROLE" \
    --policy-arn "$POLICY_ARN" 2>&1
then
    echo -e "${GREEN}✅ Política AmazonSESFullAccess adjuntada exitosamente${NC}"
else
    echo -e "${YELLOW}⚠️  La política ya está adjuntada o hubo un error${NC}"
fi
echo ""

# ============================================
# Paso 5: Verificar políticas adjuntas
# ============================================
echo -e "${YELLOW}Paso 5: Verificando políticas adjuntas al rol...${NC}"
echo "Políticas adjuntas a $EB_ROLE:"
aws iam list-attached-role-policies --role-name "$EB_ROLE" --query 'AttachedPolicies[*].PolicyName' --output table
echo ""

# ============================================
# Paso 6: Crear política custom (opcional)
# ============================================
echo -e "${YELLOW}¿Quieres crear una política custom con permisos mínimos? (s/n)${NC}"
read -p "Respuesta: " CREATE_CUSTOM

if [ "$CREATE_CUSTOM" = "s" ] || [ "$CREATE_CUSTOM" = "S" ]; then
    echo ""
    echo -e "${YELLOW}Creando política custom...${NC}"
    
    POLICY_NAME="SoftOne360-SES-SendEmail-Policy"
    
    # Crear política desde el archivo JSON
    aws iam create-policy \
        --policy-name "$POLICY_NAME" \
        --policy-document file://AWS/ses-policy-minimal.json \
        --description "Política mínima para enviar correos con AWS SES" 2>&1
    
    CUSTOM_POLICY_ARN="arn:aws:iam::$ACCOUNT_ID:policy/$POLICY_NAME"
    
    # Adjuntar política custom
    aws iam attach-role-policy \
        --role-name "$EB_ROLE" \
        --policy-arn "$CUSTOM_POLICY_ARN" 2>&1
    
    echo -e "${GREEN}✅ Política custom creada y adjuntada${NC}"
fi
echo ""

# ============================================
# Resumen final
# ============================================
echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║          ✅ CONFIGURACIÓN COMPLETADA                       ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "Resumen:"
echo "  • Rol: $EB_ROLE"
echo "  • Política: AmazonSESFullAccess"
echo "  • Estado: ✅ Activo"
echo ""
echo "Próximos pasos:"
echo "  1. Verifica dominios/correos en AWS SES"
echo "  2. Solicita salir del Sandbox (producción)"
echo "  3. Configura variables de entorno:"
echo "     - AWS_SES_REGION=us-east-1"
echo "     - EMAIL_FROM=noreply@tudominio.gov.co"
echo "  4. Reinicia tu aplicación en Elastic Beanstalk"
echo ""
echo -e "${GREEN}¡Listo para enviar correos! 🚀${NC}"
echo ""
