#!/bin/bash

# Script para eliminar el componente temporal de análisis de predios
# Ejecutar desde la raíz del proyecto: ./portal/remove-predio-analysis.sh

echo "🗑️  Eliminando componente temporal de análisis de predios..."
echo ""

# Verificar que estamos en la carpeta correcta
if [ ! -d "frontend" ] || [ ! -d "backend" ]; then
    echo "❌ Error: Ejecutar desde la carpeta 'portal'"
    exit 1
fi

# Frontend
echo "📁 Eliminando archivos del frontend..."
rm -rf frontend/src/app/components/predio-analysis/
rm -f frontend/src/app/models/predio-analysis.model.ts
rm -f frontend/src/app/services/predio-analysis.service.ts
echo "   ✅ Archivos de frontend eliminados"

# Backend
echo "📁 Eliminando archivos del backend..."
rm -f backend/app/routes/predio_analysis.py
echo "   ✅ Archivos de backend eliminados"

echo ""
echo "⚠️  IMPORTANTE: Debes realizar manualmente los siguientes pasos:"
echo ""
echo "1. Editar frontend/src/app/app.routes.ts"
echo "   Eliminar la línea:"
echo "   { path: 'analisis-predios', loadComponent: ... }"
echo ""
echo "2. Editar backend/app/main.py"
echo "   Eliminar del import:"
echo "   ..., predio_analysis"
echo "   Eliminar del router:"
echo "   app.include_router(predio_analysis.router, ...)"
echo ""
echo "✅ Componente temporal eliminado exitosamente"
echo "   Recuerda hacer commit de los cambios"
