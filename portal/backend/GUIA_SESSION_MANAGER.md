# GUÍA PASO A PASO: Ejecutar Migraciones PDM via AWS Console
# NO REQUIERE AWS CLI ni clave SSH

## PASO 1: Abrir Session Manager

1. Abre tu navegador
2. Ve a: https://console.aws.amazon.com/systems-manager/session-manager/start-session
3. Inicia sesión con tus credenciales de AWS
4. Selecciona la instancia con nombre que contenga "softone-backend-useast1"
5. Click "Start session"
6. Se abrirá una terminal web

---

## PASO 2: En la Terminal Web, ejecuta:

### 2.1 Activar entorno virtual

```bash
source /var/app/venv/*/bin/activate
cd /tmp
```

### 2.2 Crear script de migración 1

```bash
cat > migration_add_producto_fk.py << 'ENDOFFILE'
```

Ahora copia TODO el contenido del archivo:
`/Users/mlargo/Documents/softone360/portal/backend/migration_add_producto_fk.py`

Pégalo en la terminal y presiona Enter.

Luego escribe:
```bash
ENDOFFILE
```

### 2.3 Crear script de migración 2

```bash
cat > migration_prepare_s3_images.py << 'ENDOFFILE'
```

Copia TODO el contenido del archivo:
`/Users/mlargo/Documents/softone360/portal/backend/migration_prepare_s3_images.py`

Pégalo y luego:
```bash
ENDOFFILE
```

### 2.4 Ejecutar migraciones

```bash
echo "========================================"
echo "🚀 Ejecutando Migración 1"
echo "========================================"
python migration_add_producto_fk.py

echo ""
echo "========================================"
echo "🚀 Ejecutando Migración 2"
echo "========================================"
python migration_prepare_s3_images.py

echo ""
echo "✅ Migraciones completadas"
```

### 2.5 Limpiar

```bash
rm -f migration_*.py
cd ~
```

---

## ALTERNATIVA MÁS RÁPIDA: Una sola línea

Si prefieres, copia el contenido de los archivos y crea un mega-comando:

```bash
source /var/app/venv/*/bin/activate && cd /tmp && \
cat > m1.py << 'EOF'
[PEGAR CONTENIDO COMPLETO DE migration_add_producto_fk.py]
EOF
cat > m2.py << 'EOF'
[PEGAR CONTENIDO COMPLETO DE migration_prepare_s3_images.py]
EOF
python m1.py && python m2.py && rm -f m*.py && echo "✅ TODO COMPLETADO"
```

---

## VERIFICACIÓN POST-MIGRACIÓN

En la misma terminal de Session Manager:

```bash
# Conectar a PostgreSQL
PGPASSWORD='TuPassSeguro123!' psql \
  -h softone-db.ccvomgoayzyt.us-east-1.rds.amazonaws.com \
  -U dbadmin \
  -d postgres \
  -c "SELECT column_name FROM information_schema.columns WHERE table_name='pdm_actividades' AND column_name='producto_id';"

# Debería mostrar: producto_id
```

---

## NOTA IMPORTANTE

⚠️ Antes de pegar código largo en Session Manager, asegúrate de:
1. No tener límites de tiempo de sesión activos
2. Copiar TODO el contenido (no parcial)
3. Verificar que el delimitador EOF está en su propia línea

✅ Si ves errores de sintaxis al pegar, es porque el código no se pegó completo.
   Solución: Vuelve a copiar y pegar.

---

Fecha: 5 de febrero de 2026
