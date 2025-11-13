#!/bin/bash

# Script para probar el endpoint de carga de ejecución presupuestal

# Variables
BACKEND_URL="http://localhost:8000"
CSV_FILE="/Users/largo/Downloads/Ejecucion Gastos_Septiembre 1.csv"

# Token de prueba (necesario para autenticación)
# Para esto, primero necesitamos obtener un token válido

# 1. Verificar que el archivo existe
if [ ! -f "$CSV_FILE" ]; then
    echo "❌ Archivo no encontrado: $CSV_FILE"
    exit 1
fi

echo "✅ Archivo encontrado: $CSV_FILE"
echo "📊 Tamaño: $(du -h "$CSV_FILE" | cut -f1)"

# 2. Probar el endpoint sin autenticación (debería fallar)
echo ""
echo "🧪 Probando endpoint sin autenticación..."
curl -X POST "$BACKEND_URL/api/pdm/ejecucion/upload" \
  -F "file=@$CSV_FILE" \
  -v 2>&1 | head -30

echo ""
echo "✅ Prueba completada"
