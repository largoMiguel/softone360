#!/usr/bin/env bash
# Script de inicialización de base de datos

set -o errexit  # Salir si hay error

echo "→ Validando configuración de base de datos..."
python -c "from app.config.database import engine; engine.connect(); print('✓ Conexión a base de datos exitosa')"

echo "→ Creando tablas base..."
python -c "from app.config.database import Base, engine; from app.models import user, pqrs, plan, entity, pdm, secretaria; Base.metadata.create_all(bind=engine); print('✓ Tablas base creadas')"

echo "→ Inicialización completada"
echo "→ Para migraciones adicionales, ejecuta: POST /api/migrations/run"
