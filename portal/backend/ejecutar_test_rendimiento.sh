#!/bin/bash
# Ejecutar test de rendimiento PDM

EC2_IP="$1"

if [ -z "$EC2_IP" ]; then
    read -p "Ingresa la IP del servidor EC2: " EC2_IP
fi

BACKEND_DIR="/Users/mlargo/Documents/softone360/portal/backend"
EC2_USER="ec2-user"
SSH_KEY="$HOME/.ssh/softone-eb-mlargo-2026.pem"

cd "$BACKEND_DIR" || exit 1

echo "========================================================================"
echo "🧪 EJECUTANDO TEST DE RENDIMIENTO PDM"
echo "========================================================================"
echo ""

echo "📤 Copiando script..."
scp -i "$SSH_KEY" -o IdentitiesOnly=yes -o StrictHostKeyChecking=no \
    "test_pdm_performance.py" "$EC2_USER@$EC2_IP:~/"

if [ $? -ne 0 ]; then
    echo "❌ Error al copiar script"
    exit 1
fi

echo "✅ Script copiado"
echo ""

echo "⚙️  Ejecutando test..."
echo ""

ssh -i "$SSH_KEY" -o IdentitiesOnly=yes -o StrictHostKeyChecking=no "$EC2_USER@$EC2_IP" \
    "source /var/app/venv/*/bin/activate && python ~/test_pdm_performance.py"

echo ""
echo "🗑️ Limpiando..."
ssh -i "$SSH_KEY" -o IdentitiesOnly=yes -o StrictHostKeyChecking=no "$EC2_USER@$EC2_IP" \
    "rm -f ~/test_pdm_performance.py"

echo "✅ Test completado"
