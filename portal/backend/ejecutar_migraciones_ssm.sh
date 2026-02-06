#!/bin/bash
# Ejecutar migraciones PDM usando AWS Systems Manager (SSM)
# No requiere clave SSH, usa AWS CLI

set -e

echo "========================================================================"
echo "🚀 MIGRACIONES PDM - MÉTODO AWS SSM"
echo "========================================================================"
echo ""

BACKEND_DIR="/Users/mlargo/Documents/softone360/portal/backend"
EB_ENV="softone-backend-useast1"

cd "$BACKEND_DIR" || exit 1

# Obtener instance ID del servidor EB
echo "🔍 Buscando instancia EC2..."
INSTANCE_ID=$(aws ec2 describe-instances \
    --filters "Name=tag:elasticbeanstalk:environment-name,Values=$EB_ENV" \
              "Name=instance-state-name,Values=running" \
    --query 'Reservations[0].Instances[0].InstanceId' \
    --output text 2>&1)

if [ "$INSTANCE_ID" == "None" ] || [ -z "$INSTANCE_ID" ] || echo "$INSTANCE_ID" | grep -q "error"; then
    echo "❌ ERROR: No se pudo obtener la instancia EC2"
    echo ""
    echo "Salida de AWS CLI:"
    echo "$INSTANCE_ID"
    echo ""
    echo "💡 Soluciones:"
    echo "   1. Configurar AWS CLI: aws configure"
    echo "   2. Verificar permisos IAM"
    echo "   3. Usar método manual con IP: ./ejecutar_migraciones_manual.sh"
    exit 1
fi

echo "✅ Instancia encontrada: $INSTANCE_ID"
echo ""

# Verificar que SSM está disponible
echo "🔍 Verificando SSM Agent..."
SSM_STATUS=$(aws ssm describe-instance-information \
    --instance-information-filter-list "key=InstanceIds,valueSet=$INSTANCE_ID" \
    --query 'InstanceInformationList[0].PingStatus' \
    --output text 2>&1)

if [ "$SSM_STATUS" != "Online" ]; then
    echo "❌ ERROR: SSM Agent no está disponible en la instancia"
    echo "   Status: $SSM_STATUS"
    echo ""
    echo "💡 Usar método manual: ./ejecutar_migraciones_manual.sh"
    exit 1
fi

echo "✅ SSM Agent online"
echo ""

# Scripts a ejecutar
SCRIPTS=(
    "migration_add_producto_fk.py"
    "migration_prepare_s3_images.py"
)

echo "========================================================================"
echo "📤 PASO 1: Copiando scripts al servidor via S3"
echo "========================================================================"
echo ""

# Crear bucket temporal si no existe
BUCKET_NAME="softone-temp-migrations"
aws s3 mb "s3://$BUCKET_NAME" 2>/dev/null || echo "Bucket ya existe"

for script in "${SCRIPTS[@]}"; do
    echo "📤 Subiendo: $script"
    aws s3 cp "$script" "s3://$BUCKET_NAME/$script"
    
    if [ $? -eq 0 ]; then
        echo "   ✅ OK"
    else
        echo "   ❌ ERROR"
        exit 1
    fi
done

echo ""
echo "========================================================================"
echo "⚙️  PASO 2: Ejecutando migraciones"
echo "========================================================================"
echo ""

for i in "${!SCRIPTS[@]}"; do
    script="${SCRIPTS[$i]}"
    num=$((i+1))
    total="${#SCRIPTS[@]}"
    
    echo ""
    echo "----------------------------------------"
    echo "🚀 Migración $num/$total: $script"
    echo "----------------------------------------"
    echo ""
    
    # Descargar y ejecutar script via SSM
    COMMAND="cd /tmp && \
        aws s3 cp s3://$BUCKET_NAME/$script ./$script && \
        source /var/app/venv/*/bin/activate && \
        python /tmp/$script && \
        rm -f /tmp/$script"
    
    COMMAND_ID=$(aws ssm send-command \
        --instance-ids "$INSTANCE_ID" \
        --document-name "AWS-RunShellScript" \
        --parameters "commands=[\"$COMMAND\"]" \
        --query 'Command.CommandId' \
        --output text)
    
    echo "📋 Command ID: $COMMAND_ID"
    echo "⏳ Esperando resultado..."
    
    # Esperar resultado
    sleep 5
    
    aws ssm wait command-executed \
        --command-id "$COMMAND_ID" \
        --instance-id "$INSTANCE_ID" \
        --timeout 300
    
    # Obtener output
    OUTPUT=$(aws ssm get-command-invocation \
        --command-id "$COMMAND_ID" \
        --instance-id "$INSTANCE_ID" \
        --query 'StandardOutputContent' \
        --output text)
    
    echo "$OUTPUT"
    
    # Verificar status
    STATUS=$(aws ssm get-command-invocation \
        --command-id "$COMMAND_ID" \
        --instance-id "$INSTANCE_ID" \
        --query 'Status' \
        --output text)
    
    if [ "$STATUS" == "Success" ]; then
        echo "✅ $script completada exitosamente"
    else
        echo "❌ $script falló (status: $STATUS)"
        
        read -p "¿Continuar con las siguientes migraciones? (y/N): " -n 1 -r
        echo ""
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
done

echo ""
echo "========================================================================"
echo "🧹 PASO 3: Limpiando archivos temporales"
echo "========================================================================"
echo ""

for script in "${SCRIPTS[@]}"; do
    echo "🗑️ Eliminando: s3://$BUCKET_NAME/$script"
    aws s3 rm "s3://$BUCKET_NAME/$script"
done

echo ""
echo "========================================================================"
echo "🎉 PROCESO COMPLETADO"
echo "========================================================================"
echo ""
echo "✅ Las migraciones PDM fueron ejecutadas exitosamente"
echo ""
