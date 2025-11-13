#!/bin/bash

# Script para ejecutar el frontend Angular

# Verificar si está en el directorio correcto
if [ ! -f "angular.json" ]; then
    echo "Error: Ejecuta este script desde el directorio frontend/pqrs-frontend/"
    exit 1
fi

# Instalar dependencias si no existen
if [ ! -d "node_modules" ]; then
    echo "Instalando dependencias de Node.js..."
    npm install
fi

# Ejecutar la aplicación
echo "Iniciando servidor de desarrollo Angular..."
echo "Aplicación disponible en: http://localhost:4200"
echo ""
echo "Presiona Ctrl+C para detener el servidor"

npm start