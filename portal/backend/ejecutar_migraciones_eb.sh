#!/bin/bash
set -e

echo "=== Activando entorno virtual de Elastic Beanstalk ==="
# Buscar el directorio del entorno virtual
VENV_DIR=$(find /var/app/venv -type d -name "staging-*" 2>/dev/null | head -1)

if [ -n "$VENV_DIR" ] && [ -f "$VENV_DIR/bin/activate" ]; then
  echo "Usando entorno: $VENV_DIR"
  source "$VENV_DIR/bin/activate"
else
  echo "No se encontró entorno virtual, usando Python del sistema"
fi

echo ""
echo "=== Verificando módulos disponibles ==="
python3 -c "import psycopg2; print('✓ psycopg2')" || { echo "✗ psycopg2 no disponible"; exit 1; }
python3 -c "import sqlalchemy; print('✓ sqlalchemy')" || { echo "✗ sqlalchemy no disponible"; exit 1; }

echo ""
echo "======================================================================================"
echo "=== MIGRACIÓN 1: Agregar Foreign Key producto_id a pdm_actividades ==="
echo "======================================================================================"
python3 /tmp/migration_add_producto_fk.py

echo ""
echo "======================================================================================"
echo "=== MIGRACIÓN 2: Preparar columnas para migración a S3 ==="
echo "======================================================================================"
python3 /tmp/migration_prepare_s3_images.py

echo ""
echo "✅ ========================================="
echo "✅ TODAS LAS MIGRACIONES SE COMPLETARON CON ÉXITO"
echo "✅ ========================================="
