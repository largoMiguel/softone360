# 🚨 Estado Actual y Opciones para Ejecutar Migraciones PDM

## Problema Detectado

1. ❌ **AWS CLI**: Credenciales inválidas → `eb` commands fallan
2. ❌ **Clave SSH**: `/Users/mlargo/.ssh/softone-eb-mlargo-2026.pem` está vacía (0 bytes)
3. ❌ **Conexión directa**: RDS está en VPC privada → no accesible desde local

## ✅ Soluciones Disponibles (en orden de preferencia)

### Opción 1: Configurar AWS CLI (RECOMENDADO)

```bash
# Configurar credenciales
aws configure

# Verificar que funciona
aws sts get-caller-identity

# Ejecutar migraciones via SSM
cd /Users/mlargo/Documents/softone360/portal/backend
./ejecutar_migraciones_ssm.sh
```

**Ventajas:**
- ✅ No requiere clave SSH
- ✅ Más seguro (usa IAM)
- ✅ Automático

---

### Opción 2: Obtener Clave SSH Válida

#### 2a. Descargar desde AWS Secrets Manager

```bash
# Buscar si la clave está en Secrets Manager
aws secretsmanager list-secrets --query 'SecretList[?Name contains `softone`]'

# Descargar clave
aws secretsmanager get-secret-value \ 
    --secret-id softone-eb-key \
    --query SecretString \
    --output text > ~/.ssh/softone-eb-mlargo-2026.pem

chmod 400 ~/.ssh/softone-eb-mlargo-2026.pem
```

#### 2b. Descargar desde AWS Console

1. Ve a: https://console.aws.amazon.com/secretsmanager/
2. Busca: "softone" o "eb-key"
3. Copia el valor
4. Guarda en: `~/.ssh/softone-eb-mlargo-2026.pem`
5. `chmod 400 ~/.ssh/softone-eb-mlargo-2026.pem`

#### 2c. Generar nueva clave (si no existe)

1. AWS Console → EC2 → Key Pairs
2. Actions → Import Key Pair o Create Key Pair
3. Si creas nueva, debes actualizar el EC2 instance

Una vez tengas la clave:

```bash
cd /Users/mlargo/Documents/softone360/portal/backend
./ejecutar_migraciones_manual.sh
# Cuando te pregunte IP, usa: 54.87.9.77
```

---

### Opción 3: Ejecutar Directamente en AWS Console

Si ninguna opción anterior funciona:

#### 3a. Via AWS Systems Manager (SSM) Session Manager

1. Ve a: https://console.aws.amazon.com/systems-manager/session-manager
2. Click "Start session"
3. Selecciona la instancia de softone-backend-useast1
4. En la terminal web que se abre:

```bash
# Activar venv
source /var/app/venv/*/bin/activate

# Crear scripts (copiar contenido desde archivos locales)
cat > /tmp/migration_add_producto_fk.py << 'EOF'
# [COPIAR CONTENIDO COMPLETO DEL ARCHIVO]
EOF

cat > /tmp/migration_prepare_s3_images.py << 'EOF'
# [COPIAR CONTENIDO COMPLETO DEL ARCHIVO]
EOF

# Ejecutar
python /tmp/migration_add_producto_fk.py
python /tmp/migration_prepare_s3_images.py

# Limpiar
rm /tmp/migration_*.py
```

#### 3b. Via EC2 Instance Connect

1. AWS Console → EC2 → Instances
2. Selecciona instancia de softone-backend-useast1
3. Click "Connect" → "EC2 Instance Connect"
4. Ejecuta los mismos comandos del paso 3a

---

## 📋 Scripts Preparados

Todos están en: `/Users/mlargo/Documents/softone360/portal/backend/`

| Script | Método | Estado |
|--------|--------|--------|
| `ejecutar_migraciones_ssm.sh` | AWS SSM (requiere AWS CLI configurado) | ⚠️ Requiere credenciales |
| `ejecutar_migraciones_manual.sh` | SSH directo (requiere clave válida) | ⚠️ Requiere clave |
| `ejecutar_migraciones_pdm.py` | Python local (requiere VPN/acceso directo) | ❌ Sin acceso RDS |
| `ejecutar_test_rendimiento.sh` | Test post-migración via SSH | ⚠️ Requiere clave |

---

## 🎯 Recomendación Inmediata

### Paso 1: Configurar AWS CLI

```bash
aws configure
# AWS Access Key ID: [Tu Access Key]
# AWS Secret Access Key: [Tu Secret Key]
# Default region name: us-east-1
# Default output format: json

# Verificar
aws sts get-caller-identity
```

### Paso 2: Ejecutar Migraciones

```bash
cd /Users/mlargo/Documents/softone360/portal/backend
chmod +x ejecutar_migraciones_ssm.sh
./ejecutar_migraciones_ssm.sh
```

---

## 💡 Si Nada Funciona

Como última opción, puedes ejecutar las migraciones **manualmente query por query** conectándote a RDS desde una instancia EC2:

### Opción Manual Completa

1. Conectarse a EC2 (via Console Session Manager)

2. Conectarse a RDS:
```bash
PGPASSWORD='TuPassSeguro123!' psql \
  -h softone-db.ccvomgoayzyt.us-east-1.rds.amazonaws.com \
  -U dbadmin \
  -d postgres
```

3. Ejecutar queries manualmente (ver contenido de scripts)

---

## 📞 Soporte

Si tienes problemas:

1. Verifica logs de AWS CLI: `aws configure list`
2. Verifica conectividad: `aws ec2 describe-instances --instance-ids i-xxxxx`
3. Contacta al administrador de AWS para:
   - Obtener credenciales IAM válidas
   - Obtener clave SSH válida
   - Configurar acceso a RDS

---

## ✅ Una Vez Funcionando

```bash
# Ejecutar migraciones
./ejecutar_migraciones_ssm.sh

# O si tienes SSH
./ejecutar_migraciones_manual.sh

# Verificar con test
./ejecutar_test_rendimiento.sh
```

**Fecha:** 5 de febrero de 2026
**Usuario:** mlargo
**Servidor EC2:** 54.87.9.77
**RDS:** softone-db.ccvomgoayzyt.us-east-1.rds.amazonaws.com
