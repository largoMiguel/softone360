#!/bin/bash
# Hook postdeploy de Elastic Beanstalk para ejecutar migraciones de BD.
# Ejecuta directamente los scripts de migración desde el bundle desplegado.

set -euo pipefail

LOG_TAG="[postdeploy:migracion]"
echo "$LOG_TAG Iniciando hook de migración..."

APP_DIR="/var/app/current"
source /var/app/venv/*/bin/activate 2>/dev/null
command -v python >/dev/null 2>&1 && PYTHON_BIN="python" || PYTHON_BIN="python3"

run_migration() {
    local script="$APP_DIR/migrations/$1"
    if [ ! -f "$script" ]; then
        echo "$LOG_TAG Migración '$1' no encontrada — omitiendo"
        return 0
    fi
    echo "$LOG_TAG Ejecutando: $1"
    set +e
    $PYTHON_BIN "$script"
    local code=$?
    set -e
    if [ $code -ne 0 ]; then
        echo "$LOG_TAG ERROR: '$1' falló con código $code" >&2
        exit $code
    fi
    echo "$LOG_TAG '$1' completada"
}

# Migraciones a ejecutar en orden
run_migration "fix_pdm_productos_column_sizes.py"
run_migration "create_pdm_contratos_rps_table.py"

echo "$LOG_TAG Todas las migraciones completadas exitosamente"
exit 0
