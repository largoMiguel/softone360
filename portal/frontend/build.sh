#!/usr/bin/env bash
# Script de build para Frontend en Render

set -o errexit  # Salir si hay error

echo "→ Instalando dependencias de Node..."
npm install

echo "→ Compilando Angular para producción..."
npm run build:prod

echo "→ Build del frontend completado exitosamente!"

# Copiar reglas de reescritura para Render Static Sites (SPA fallback)
if [ -f "static.json" ]; then
	echo "→ Copiando static.json al directorio de publicación..."
	mkdir -p dist/pqrs-frontend/browser
	cp static.json dist/pqrs-frontend/browser/
fi
