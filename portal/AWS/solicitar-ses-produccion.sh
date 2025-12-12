#!/bin/bash

# Script para Solicitar Acceso a Producción en AWS SES
# Fecha: 12 de diciembre de 2025

set -e

echo "======================================"
echo "📧 SOLICITUD SES PRODUCCIÓN - AWS"
echo "======================================"
echo ""

# Colores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

REGION="us-east-1"

echo -e "${BLUE}ℹ️  Este script te ayudará a solicitar acceso a producción en AWS SES${NC}"
echo ""

# Verificar estado actual
echo "======================================"
echo "PASO 1: VERIFICAR ESTADO ACTUAL"
echo "======================================"
echo ""

echo -e "${YELLOW}📊 Consultando estado actual de SES...${NC}"
ACCOUNT_STATUS=$(aws sesv2 get-account --region $REGION 2>/dev/null || echo "ERROR")

if [ "$ACCOUNT_STATUS" == "ERROR" ]; then
    echo -e "${RED}❌ Error al consultar AWS SES. Verifica tus credenciales.${NC}"
    exit 1
fi

echo "$ACCOUNT_STATUS" | grep -q "ProductionAccessEnabled.*false" && SANDBOX=true || SANDBOX=false

if [ "$SANDBOX" = true ]; then
    echo -e "${YELLOW}⚠️  Tu cuenta está en MODO SANDBOX${NC}"
    echo "   - Solo puedes enviar a correos verificados"
    echo "   - Límite: 200 correos/día"
    echo ""
else
    echo -e "${GREEN}✅ Tu cuenta ya está en MODO PRODUCCIÓN${NC}"
    echo "   - Puedes enviar a cualquier correo"
    echo ""
    
    # Mostrar límites actuales
    echo -e "${YELLOW}📊 Límites actuales:${NC}"
    aws ses get-send-quota --region $REGION
    echo ""
    exit 0
fi

# Ver límites actuales
echo -e "${YELLOW}📊 Límites actuales (Sandbox):${NC}"
aws ses get-send-quota --region $REGION
echo ""

# Solicitar información al usuario
echo "======================================"
echo "PASO 2: INFORMACIÓN PARA SOLICITUD"
echo "======================================"
echo ""

echo -e "${BLUE}Por favor proporciona la siguiente información:${NC}"
echo ""

read -p "🌐 URL de tu sitio web (ej: https://softone360.com): " WEBSITE_URL
if [ -z "$WEBSITE_URL" ]; then
    WEBSITE_URL="https://softone360.com"
fi

read -p "📧 Correo de contacto adicional (opcional, Enter para omitir): " CONTACT_EMAIL

echo ""
echo -e "${YELLOW}📝 Descripción del caso de uso:${NC}"
echo ""

USE_CASE="Sistema PQRS (Peticiones, Quejas, Reclamos y Sugerencias) para entidades gubernamentales en Colombia.

Enviamos correos transaccionales automáticos para:
- Confirmación de radicación de PQRS
- Notificaciones de cambios de estado
- Respuestas oficiales a solicitudes ciudadanas
- Alertas administrativas al personal

Volumen estimado: 1,000-5,000 correos mensuales
Solo correos solicitados explícitamente por los usuarios
Cumplimiento de normativa colombiana de datos personales (Ley 1581 de 2012)"

echo "$USE_CASE"
echo ""

read -p "¿Deseas usar esta descripción? (S/n): " USE_DEFAULT
if [[ "$USE_DEFAULT" =~ ^[Nn]$ ]]; then
    echo "Por favor edita el archivo temporal que se abrirá..."
    echo "$USE_CASE" > /tmp/ses_use_case.txt
    ${EDITOR:-nano} /tmp/ses_use_case.txt
    USE_CASE=$(cat /tmp/ses_use_case.txt)
    rm /tmp/ses_use_case.txt
fi

# Confirmar antes de enviar
echo ""
echo "======================================"
echo "PASO 3: CONFIRMAR SOLICITUD"
echo "======================================"
echo ""

echo -e "${BLUE}📋 Resumen de la solicitud:${NC}"
echo ""
echo "Tipo de correo: Transaccional"
echo "Sitio web: $WEBSITE_URL"
echo "Contacto adicional: ${CONTACT_EMAIL:-N/A}"
echo "Región: $REGION"
echo ""
echo "Descripción:"
echo "$USE_CASE"
echo ""

read -p "¿Enviar solicitud? (S/n): " CONFIRM
if [[ "$CONFIRM" =~ ^[Nn]$ ]]; then
    echo -e "${YELLOW}⚠️  Solicitud cancelada${NC}"
    exit 0
fi

# Enviar solicitud
echo ""
echo "======================================"
echo "PASO 4: ENVIAR SOLICITUD"
echo "======================================"
echo ""

echo -e "${YELLOW}📤 Enviando solicitud a AWS...${NC}"

# Construir comando
CMD="aws sesv2 put-account-details \
  --region $REGION \
  --production-access-enabled \
  --mail-type TRANSACTIONAL \
  --website-url \"$WEBSITE_URL\" \
  --use-case-description \"$USE_CASE\""

if [ -n "$CONTACT_EMAIL" ]; then
    CMD="$CMD --additional-contact-email-addresses \"$CONTACT_EMAIL\""
fi

# Ejecutar
eval $CMD

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ ¡Solicitud enviada exitosamente!${NC}"
    echo ""
    echo "======================================"
    echo "PRÓXIMOS PASOS"
    echo "======================================"
    echo ""
    echo "1. ⏱️  Espera respuesta de AWS (24-48 horas típicamente)"
    echo "2. 📧 Recibirás un email de AWS con el resultado"
    echo "3. 🔍 Puedes verificar el estado en AWS Support Center:"
    echo "   https://console.aws.amazon.com/support/home"
    echo ""
    echo "4. 📊 Una vez aprobado, verifica con:"
    echo "   aws sesv2 get-account --region $REGION"
    echo ""
    echo -e "${BLUE}💡 Mientras esperas:${NC}"
    echo "   - Configura tu dominio verificado (SPF, DKIM, DMARC)"
    echo "   - Implementa manejo de bounces y complaints"
    echo "   - Verifica correos individuales si necesitas hacer pruebas"
    echo ""
    echo -e "${GREEN}📚 Más información en: AWS/SOLICITUD_SES_PRODUCCION.md${NC}"
    echo ""
else
    echo ""
    echo -e "${RED}❌ Error al enviar solicitud${NC}"
    echo "Verifica tu configuración de AWS CLI y permisos"
    echo ""
    exit 1
fi
