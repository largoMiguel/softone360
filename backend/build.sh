#!/usr/bin/env bash
# Script de build para Render.com

set -o errexit  # Salir si hay error

echo "→ Instalando dependencias..."
python -m pip install --upgrade pip
python -m pip install -r requirements.txt

echo "→ Validando conexión a base de datos..."
python -c "from app.config.database import engine; engine.connect(); print('✓ Conexión exitosa')"

echo "→ Build completado exitosamente!"
echo "→ Ejecuta las migraciones con: POST /api/migrations/run"
