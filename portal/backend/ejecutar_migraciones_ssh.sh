#!/bin/bash
# Script para ejecutar migraciones PDM usando método SSH via EC2
# Basado en: /Users/mlargo/Documents/softone360/portal/AWS/GUIA_MIGRACIONES_RDS.md

set -e

echo "========================================================================"
echo "🚀 EJECUTAR MIGRACIONES PDM VIA EC2 (Método SSH)"
echo "========================================================================"
echo ""

BACKEND_DIR="/Users/mlargo/Documents/softone360/portal/backend"
EC2_USER="ec2-user"
EC2_HOST="54.152.146.98"  # Obtener con: eb status softone-backend-useast1
SSH_KEY="$HOME/.ssh/aws-eb"
EB_ENV="softone-backend-useast1"

# Verificar que estamos en el directorio correcto
if [ ! -d "$BACKEND_DIR" ]; then
    echo "❌ ERROR: Directorio no encontrado: $BACKEND_DIR"
    exit 1
fi

cd "$BACKEND_DIR"
echo "📁 Directorio de trabajo: $(pwd)"
echo ""

# Lista de scripts a ejecutar
MIGRATIONS=(
    "migration_add_producto_fk.py"
    "migration_prepare_s3_images.py"
)

echo "📋 Migraciones a ejecutar:"
for i in "${!MIGRATIONS[@]}"; do
    echo "   $((i+1)). ${MIGRATIONS[$i]}"
done
echo ""

echo "⚠️  IMPORTANTE:"
echo "   - Se conectará via SSH a EC2"
echo "   - Se ejecutarán las migraciones en el servidor"
echo "   - Los cambios afectarán la base de datos en producción"
echo ""

read -p "¿Desea continuar? (y/N): " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Ejecución cancelada"
    exit 1
fi

echo ""
echo "========================================================================"
echo "MÉTODO 1: Usando 'eb ssh' (RECOMENDADO)"
echo "========================================================================"
echo ""

# Opción 1: Verificar si eb ssh funciona
echo "🔍 Verificando conectividad con eb ssh..."
if eb ssh "$EB_ENV" --command "echo 'OK'" &>/dev/null; then
    echo "✅ eb ssh funciona correctamente"
    echo ""
    
    USE_EB_SSH=true
else
    echo "⚠️ eb ssh no disponible (problema con credenciales AWS CLI)"
    echo ""
    echo "========================================================================"
    echo "MÉTODO 2: Usando SSH directo con IP"
    echo "========================================================================"
    echo ""
    
    # Verificar si tenemos la clave SSH
    if [ ! -f "$SSH_KEY" ]; then
        echo "❌ ERROR: Clave SSH no encontrada: $SSH_KEY"
        exit 1
    fi
    
    echo "🔍 Verificando conectividad SSH directa..."
    if ssh -i "$SSH_KEY" -o IdentitiesOnly=yes -o ConnectTimeout=5 "$EC2_USER@$EC2_HOST" "echo 'OK'" &>/dev/null; then
        echo "✅ SSH directo funciona"
        echo ""
        USE_EB_SSH=false
    else
        echo "❌ ERROR: No se puede conectar via SSH"
        echo ""
        echo "💡 Soluciones:"
        echo "   1. Configurar AWS CLI: aws configure"
        echo "   2. Verificar clave SSH existe: $SSH_KEY"
        echo "   3. Obtener IP actual: aws ec2 describe-instances --filters 'Name=tag:elasticbeanstalk:environment-name,Values=$EB_ENV'"
        exit 1
    fi
fi

# Paso 1: Copiar scripts al servidor
echo "========================================================================"
echo "📤 PASO 1: Copiando scripts al servidor"
echo "========================================================================"
echo ""

for script in "${MIGRATIONS[@]}"; do
    if [ ! -f "$script" ]; then
        echo "❌ ERROR: Script no encontrado: $script"
        exit 1
    fi
    
    echo "📤 Copiando: $script"
    
    if [ "$USE_EB_SSH" = true ]; then
        # Usar método con eb ssh (necesita scp manual)
        scp -i "$SSH_KEY" -o IdentitiesOnly=yes "$script" "$EC2_USER@$(eb status "$EB_ENV" 2>/dev/null | grep 'Running instances' | awk '{print $3}'):~/"
    else
        # SSH directo
        scp -i "$SSH_KEY" -o IdentitiesOnly=yes "$script" "$EC2_USER@$EC2_HOST:~/"
    fi
    
    if [ $? -eq 0 ]; then
        echo "   ✅ Copiado"
    else
        echo "   ❌ Error al copiar"
        exit 1
    fi
done

echo ""
echo "✅ Todos los scripts copiados"
echo ""

# Paso 2: Ejecutar cada migración
echo "========================================================================"
echo "⚙️  PASO 2: Ejecutando migraciones"
echo "========================================================================"
echo ""

for i in "${!MIGRATIONS[@]}"; do
    script="${MIGRATIONS[$i]}"
    num=$((i+1))
    
    echo "----------------------------------------"
    echo "🚀 Migración $num/$${#MIGRATIONS[@]}: $script"
    echo "----------------------------------------"
    echo ""
    
    if [ "$USE_EB_SSH" = true ]; then
        # Método eb ssh
        eb ssh "$EB_ENV" --command "source /var/app/venv/*/bin/activate && python ~/$script"
    else
        # SSH directo
        ssh -i "$SSH_KEY" -o IdentitiesOnly=yes "$EC2_USER@$EC2_HOST" \
            "source /var/app/venv/*/bin/activate && python ~/$script"
    fi
    
    if [ $? -eq 0 ]; then
        echo ""
        echo "✅ $script completada"
    else
        echo ""
        echo "❌ $script falló"
        read -p "¿Continuar con las siguientes migraciones? (y/N): " -n 1 -r
        echo ""
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
    
    echo ""
done

# Paso 3: Limpiar scripts del servidor
echo "========================================================================"
echo "🧹 PASO 3: Limpiando archivos del servidor"
echo "========================================================================"
echo ""

for script in "${MIGRATIONS[@]}"; do
    echo "🗑️ Eliminando: $script"
    
    if [ "$USE_EB_SSH" = true ]; then
        eb ssh "$EB_ENV" --command "rm -f ~/$script"
    else
        ssh -i "$SSH_KEY" -o IdentitiesOnly=yes "$EC2_USER@$EC2_HOST" "rm -f ~/$script"
    fi
done

echo "✅ Limpieza completada"
echo ""

# Paso 4: Ejecutar test de rendimiento (opcional)
echo "========================================================================"
echo "🧪 PASO 4: Test de rendimiento (opcional)"
echo "========================================================================"
echo ""

read -p "¿Desea ejecutar test_pdm_performance.py? (y/N): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "📤 Copiando test_pdm_performance.py..."
    
    if [ "$USE_EB_SSH" = true ]; then
        scp -i "$SSH_KEY" -o IdentitiesOnly=yes "test_pdm_performance.py" \
            "$EC2_USER@$(eb status "$EB_ENV" 2>/dev/null | grep 'Running instances' | awk '{print $3}'):~/"
        eb ssh "$EB_ENV" --command "source /var/app/venv/*/bin/activate && python ~/test_pdm_performance.py"
        eb ssh "$EB_ENV" --command "rm -f ~/test_pdm_performance.py"
    else
        scp -i "$SSH_KEY" -o IdentitiesOnly=yes "test_pdm_performance.py" "$EC2_USER@$EC2_HOST:~/"
        ssh -i "$SSH_KEY" -o IdentitiesOnly=yes "$EC2_USER@$EC2_HOST" \
            "source /var/app/venv/*/bin/activate && python ~/test_pdm_performance.py"
        ssh -i "$SSH_KEY" -o IdentitiesOnly=yes "$EC2_USER@$EC2_HOST" "rm -f ~/test_pdm_performance.py"
    fi
fi

echo ""
echo "========================================================================"
echo "🎉 MIGRACIONES COMPLETADAS"
echo "========================================================================"
echo ""
echo "✅ Todas las migraciones PDM fueron ejecutadas"
echo ""
echo "📝 Próximos pasos:"
echo "   1. Verificar logs de aplicación"
echo "   2. Probar endpoints PDM en el frontend"
echo "   3. Monitorear rendimiento de queries"
echo ""
