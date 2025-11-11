#!/bin/bash

# 🗄️ Script de Conexión Rápida a RDS - Softone360
# Uso: ./connect-db.sh

# Colores para output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}🗄️  Conectando a RDS PostgreSQL - Softone360${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Credenciales
export PGPASSWORD='TuPassSeguro123!'
HOST="softone-db.ccvomgoayzyt.us-east-1.rds.amazonaws.com"
USER="dbadmin"
DB="postgres"
PORT="5432"

echo -e "\n${YELLOW}📍 Host:${NC} $HOST"
echo -e "${YELLOW}👤 Usuario:${NC} $USER"
echo -e "${YELLOW}💾 Base de datos:${NC} $DB"
echo -e "${YELLOW}🔌 Puerto:${NC} $PORT\n"

# Verificar que psql esté instalado
if ! command -v psql &> /dev/null; then
    echo -e "${YELLOW}⚠️  psql no está instalado.${NC}"
    echo -e "Instálalo con: ${GREEN}brew install postgresql${NC}"
    exit 1
fi

# Verificar conectividad
echo -e "${BLUE}🔍 Verificando conectividad...${NC}"
if timeout 10 bash -c "cat < /dev/null > /dev/tcp/$HOST/$PORT" 2>/dev/null; then
    echo -e "${GREEN}✅ Puerto 5432 accesible${NC}\n"
else
    echo -e "${YELLOW}❌ No se puede conectar. Verifica:${NC}"
    echo -e "   1. Tu IP actual: $(curl -s https://api.ipify.org)"
    echo -e "   2. Security Group permite tu IP"
    echo -e "   3. RDS está activo (no stopped)\n"
    exit 1
fi

# Conectar
echo -e "${GREEN}🚀 Conectando...${NC}\n"
psql -h $HOST -U $USER -d $DB -p $PORT

# Limpiar variable de contraseña
unset PGPASSWORD
