#!/bin/bash
# Hook postdeploy de Elastic Beanstalk para ejecutar migraciones de BD desde la instancia (sin acceso directo desde local)
# Descarga un script público y lo ejecuta con el Python del venv de EB.

set -euo pipefail

LOG_TAG="[postdeploy:migracion-anio]"
echo "$LOG_TAG Iniciando hook de migración..."

SCRIPT_URL="https://softone360-frontend-useast1.s3.amazonaws.com/temp/migrate.py"
TMP_SCRIPT="/tmp/migrate_anio.py"

echo "$LOG_TAG Verificando disponibilidad del script de migración..."
HTTP_CODE=0
if command -v curl >/dev/null 2>&1; then
	HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$SCRIPT_URL" || echo 0)
elif command -v wget >/dev/null 2>&1; then
	HTTP_CODE=$(wget -q --spider "$SCRIPT_URL" >/dev/null 2>&1 && echo 200 || echo 0)
else
	echo "$LOG_TAG WARN: No hay curl/wget disponible; se omite migración" >&2
	exit 0
fi

if [ "$HTTP_CODE" != "200" ]; then
	echo "$LOG_TAG No hay script de migración disponible (HTTP $HTTP_CODE). Continuando sin ejecutar migración."
	exit 0
fi

echo "$LOG_TAG Descargando script de migración desde: $SCRIPT_URL"
curl -fsSL "$SCRIPT_URL" -o "$TMP_SCRIPT"

if [ ! -s "$TMP_SCRIPT" ]; then
	echo "$LOG_TAG WARN: El script descargado está vacío; se omite migración"
	exit 0
fi

echo "$LOG_TAG Ejecutando migración con Python del venv..."
set +e
source /var/app/venv/*/bin/activate 2>/dev/null
PYTHON_BIN="python"
command -v python >/dev/null 2>&1 || PYTHON_BIN="python3"
$PYTHON_BIN "$TMP_SCRIPT"
EXIT_CODE=$?
set -e

if [ $EXIT_CODE -ne 0 ]; then
	echo "$LOG_TAG ERROR: La migración falló con código $EXIT_CODE" >&2
	exit $EXIT_CODE
fi

echo "$LOG_TAG Migración completada exitosamente"

# Limpieza
rm -f "$TMP_SCRIPT" || true

exit 0
