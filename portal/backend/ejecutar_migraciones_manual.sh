#!/bin/bash
# Ejecución MANUAL de migraciones PDM - Paso a paso
# No requiere AWS CLI funcionando

echo "========================================================================"
echo "🔧 MIGRACIONES PDM - MÉTODO MANUAL"
echo "========================================================================"
echo ""

# PASO 0: Obtener IP del servidor EC2
echo "PASO 0: Obtener IP del servidor EC2"
echo "----------------------------------------"
echo ""
echo "Opciones para obtener la IP:"
echo "1. AWS Console:"
echo "   - Ve a: https://console.aws.amazon.com/ec2/"        
echo "   - Busca instancias con tag: elasticbeanstalk:environment-name=softone-backend-useast1"
echo "   - Copia la 'Public IPv4 address'"
echo ""
echo "2. Desde logs anteriores del terminal"
echo ""
echo "3. Si tienes acceso a Elastic Beanstalk Console:"
echo "   - Ve a: https://console.aws.amazon.com/elasticbeanstalk/"
echo "   - Selecciona: softone-backend-useast1"
echo "   - Ve a 'Configuration' > 'Instances'"
echo ""

read -p "Ingresa la IP pública del servidor EC2: " EC2_IP

if [ -z "$EC2_IP" ]; then
    echo "❌ ERROR: IP no puede estar vacía"
    exit 1
fi

echo "📝 IP del servidor: $EC2_IP"
echo ""

# Configuración
BACKEND_DIR="/Users/mlargo/Documents/softone360/portal/backend"
EC2_USER="ec2-user"
SSH_KEY="$HOME/.ssh/softone-eb-mlargo-2026.pem"

# Verificar clave SSH
if [ ! -f "$SSH_KEY" ]; then
    echo "❌ ERROR: Clave SSH no encontrada: $SSH_KEY"
    echo ""
    echo "Verifica que la clave existe y tiene permisos correctos:"
    echo "  chmod 400 $SSH_KEY"
    exit 1
fi

echo "✅ Clave SSH encontrada: $SSH_KEY"
echo ""

# Verificar conectividad
echo "🔍 Verificando conectividad SSH..."
if ssh -i "$SSH_KEY" -o IdentitiesOnly=yes -o ConnectTimeout=10 -o StrictHostKeyChecking=no "$EC2_USER@$EC2_IP" "echo OK" &>/dev/null; then
    echo "✅ Conexión SSH exitosa"
else
    echo "❌ ERROR: No se puede conectar al servidor"
    echo ""
    echo "Verifica:"
    echo "  1. La IP es correcta"
    echo "  2. La clave SSH es la correcta"   
    echo "  3. El security group permite SSH (puerto 22)"
    exit 1
fi

cd "$BACKEND_DIR" || exit 1

echo ""
echo "========================================================================"
echo "📤 PASO 1: Copiando scripts al servidor"
echo "========================================================================"
echo ""

# Copiar scripts
SCRIPTS=(
    "migration_add_producto_fk.py"
    "migration_prepare_s3_images.py"
)

for script in "${SCRIPTS[@]}"; do
    echo "📤 Copiando: $script"
    scp -i "$SSH_KEY" -o IdentitiesOnly=yes -o StrictHostKeyChecking=no "$script" "$EC2_USER@$EC2_IP:~/"
    
    if [ $? -eq 0 ]; then
        echo "   ✅ OK"
    else
        echo "   ❌ ERROR"
        exit 1
    fi
done

echo ""
echo "✅ Todos los scripts copiados"

echo ""
echo "========================================================================"
echo "⚙️  PASO 2: Ejecutando migraciones"
echo "========================================================================"
echo ""

# Ejecutar cada migración
for i in "${!SCRIPTS[@]}"; do
    script="${SCRIPTS[$i]}"
    num=$((i+1))
    total="${#SCRIPTS[@]}"
    
    echo ""
    echo "----------------------------------------"
    echo "🚀 Migración $num/$total: $script"
    echo "----------------------------------------"
    echo ""
    
    # Ejecutar en el servidor
    ssh -i "$SSH_KEY" -o IdentitiesOnly=yes -o StrictHostKeyChecking=no "$EC2_USER@$EC2_IP" \
        "source /var/app/venv/*/bin/activate && python ~/$script"
    
    exit_code=$?
    
    if [ $exit_code -eq 0 ]; then
        echo ""
        echo "✅ $script completada exitosamente"
    else
        echo ""
        echo "❌ $script falló (exit code: $exit_code)"
        
        read -p "¿Continuar con las siguientes migraciones? (y/N): " -n 1 -r
        echo ""
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "Abortando..."
            exit 1
        fi
    fi
done

echo ""
echo "========================================================================"
echo "🧹 PASO 3: Limpiando scripts del servidor"
echo "========================================================================"
echo ""

for script in "${SCRIPTS[@]}"; do
    echo "🗑️ Eliminando: $script"
    ssh -i "$SSH_KEY" -o IdentitiesOnly=yes -o StrictHostKeyChecking=no "$EC2_USER@$EC2_IP" \
        "rm -f ~/$script"
done

echo "✅ Limpieza completada"

echo ""
echo "========================================================================"
echo "🎉 PROCESO COMPLETADO"
echo "========================================================================"
echo ""
echo "✅ Las migraciones PDM fueron ejecutadas exitosamente"
echo ""
echo "📝 Próximos pasos recomendados:"
echo "   1. Verificar logs de la aplicación"
echo "   2. Probar endpoints PDM desde el frontend"
echo "   3. Ejecutar test de rendimiento (opcional):"
echo "      ./ejecutar_test_rendimiento.sh $EC2_IP"
echo ""
echo "📊 Para verificar los cambios en la base de datos:"
echo "   ssh -i $SSH_KEY $EC2_USER@$EC2_IP"
echo "   source /var/app/venv/*/bin/activate"
echo "   python -c 'import psycopg2; conn = psycopg2.connect(...); # ejecutar queries'"
echo ""
