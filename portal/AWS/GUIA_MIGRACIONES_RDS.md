# 📚 Guía Completa: Cómo Ejecutar Migraciones en PostgreSQL RDS

**Última actualización:** 15 de marzo de 2026  
**Contexto:** Sistema Softone360 con base de datos PostgreSQL en AWS RDS (us-east-1)  
**Método REAL (validado en producción):** EC2 Instance Connect + SSH con clave `~/.ssh/id_rsa`

---

> ⚠️ **IMPORTANTE — Leer primero:** El método original con `eb ssh` y `.pem` **NO FUNCIONA** en este proyecto.  
> El archivo `.pem` (`~/.ssh/softone-eb-mlargo-2026.pem`) está **vacío (0 bytes)** y el EB CLI busca una clave  
> llamada `softone-eb-20251122` que no existe. Tampoco está disponible SSM Session Manager.  
> El **único método que funciona** es **EC2 Instance Connect** descrito en esta guía.

---

## 🎯 Propósito

Esta guía documenta el proceso probado para ejecutar migraciones de base de datos en RDS PostgreSQL sin exponer acceso público directo. El método fue validado exitosamente en múltiples migraciones de producción.

---

## 📋 Tabla de Contenidos

1. [Arquitectura y Seguridad](#arquitectura-y-seguridad)
2. [Datos de Infraestructura](#datos-de-infraestructura)
3. [Cómo Funciona EC2 Instance Connect](#cómo-funciona-ec2-instance-connect)
4. [Paso 0: Obtener IP de la Instancia](#paso-0-obtener-ip-de-la-instancia)
5. [Paso 1: Preparar el Script de Migración](#paso-1-preparar-el-script-de-migración)
6. [Paso 2: Transferir Script al Servidor](#paso-2-transferir-script-al-servidor)
7. [Paso 3: Ejecutar la Migración](#paso-3-ejecutar-la-migración)
8. [Paso 4: Verificar los Cambios](#paso-4-verificar-los-cambios)
9. [Paso 5: Limpiar y Documentar](#paso-5-limpiar-y-documentar)
10. [Solución de Problemas](#solución-de-problemas)
11. [Casos de Uso Comunes](#casos-de-uso-comunes)

---

## 🏗️ Arquitectura y Seguridad

### Modelo de Red

```
┌─────────────────────────────────────────┐
│         Tu Máquina Local (Mac)          │
│  • Scripts de migración preparados      │
│  • AWS CLI configurado (deploy-admin)   │
│  • Clave SSH: ~/.ssh/id_rsa             │
└────────────────────┬────────────────────┘
                     │ EC2 Instance Connect
                     │ (inyecta clave pública
                     │  por 60 segundos)
                     │ + SSH/SCP con id_rsa
                     ↓
┌─────────────────────────────────────────┐
│   EC2 Instance (Elastic Beanstalk)      │
│   • ID: i-040873693a63f0023             │
│   • AZ: us-east-1c                      │
│   • IP: 13.220.55.112 (puede cambiar)   │
│   • sg-02c3c9aba42cda46e (EB SG)        │
│   • Tiene acceso a RDS internamente     │
└────────────────────┬────────────────────┘
                     │ TCP/5432 (Internal VPC)
                     ↓
┌─────────────────────────────────────────┐
│   RDS PostgreSQL (softone-db)           │
│   • sg-0028de7003bcbc156                │
│   • Acceso SOLO desde SG de EB          │
│   • Base de datos: postgres             │
│   • Usuario: dbadmin                    │
└─────────────────────────────────────────┘
```

### Por qué EC2 Instance Connect

✅ **Sin llaves .pem:** No necesitas gestionar archivos de clave permanentes  
✅ **Seguridad:** La clave pública solo exite en EC2 por 60 segundos  
✅ **Fiabilidad:** Usa red interna de AWS para acceder a RDS  
✅ **Sin SSM:** No requiere SSM Agent (que no está disponible)  
✅ **Sin EB CLI SSH:** Bypasea el problema del nombre de clave en EB CLI  

---

## 🗂️ Datos de Infraestructura

| Recurso | Valor |
|---------|-------|
| **Instancia EC2** | `i-040873693a63f0023` |
| **Zona disponibilidad** | `us-east-1c` |
| **IP pública actual** | `13.220.55.112` *(puede cambiar al reiniciar)* |
| **Usuario SSH** | `ec2-user` |
| **Clave SSH local** | `~/.ssh/id_rsa` + `~/.ssh/id_rsa.pub` |
| **Host RDS** | `softone-db.ccvomgoayzyt.us-east-1.rds.amazonaws.com` |
| **Puerto RDS** | `5432` |
| **Base de datos** | `postgres` |
| **Usuario DB** | `dbadmin` |
| **Contraseña DB** | `TuPassSeguro123!` |
| **EB Environment** | `softone-backend-useast1` |
| **AWS Account** | `119538925169` |
| **AWS Region** | `us-east-1` |

---

## 🔑 Cómo Funciona EC2 Instance Connect

EC2 Instance Connect es un servicio de AWS que inyecta temporalmente una clave pública SSH en la instancia EC2 por **60 segundos**. En esa ventana de tiempo, puedes usar tu clave `id_rsa` para conectarte por SSH o copiar archivos con SCP.

```
1. aws ec2-instance-connect send-ssh-public-key   ← Inyecta id_rsa.pub (60 seg)
2. scp -i ~/.ssh/id_rsa [...] ec2-user@IP:~/      ← Copia el script (en los 60 seg)
3. aws ec2-instance-connect send-ssh-public-key   ← Reinyecta para SSH
4. ssh -i ~/.ssh/id_rsa ec2-user@IP "comando"     ← Ejecuta el script
```

> 💡 **Truco:** Inyecta la clave y LUEGO ejecuta SCP/SSH en menos de 60 segundos.  
> Si se te acaba el tiempo, simplemente vuelve a ejecutar el comando `send-ssh-public-key`.

---

## 0️⃣ Paso 0: Obtener IP de la Instancia

La IP pública de la instancia puede cambiar. Antes de cada migración, verifica la IP actual:

```bash
# Obtener IP pública actual de la instancia EB
aws ec2 describe-instances \
  --instance-ids i-040873693a63f0023 \
  --query 'Reservations[0].Instances[0].PublicIpAddress' \
  --output text
# Ejemplo de salida: 13.220.55.112
```

Guarda esa IP en una variable para usarla en los siguientes pasos:

```bash
INSTANCE_IP=$(aws ec2 describe-instances \
  --instance-ids i-040873693a63f0023 \
  --query 'Reservations[0].Instances[0].PublicIpAddress' \
  --output text)
echo "IP de la instancia: $INSTANCE_IP"
```

---

## ✅ Requisitos Previos

### En tu máquina local

```bash
# 1. Verificar que tienes tus claves SSH
ls -la ~/.ssh/id_rsa ~/.ssh/id_rsa.pub
# Deben existir y tener contenido (no 0 bytes)

# 2. Verificar AWS CLI configurado
aws sts get-caller-identity
# Debe devolver: "UserId": "...", "Account": "119538925169", "Arn": "...deploy-admin..."

# 3. Verificar acceso a EC2 Instance Connect
aws ec2-instance-connect send-ssh-public-key \
  --instance-id i-040873693a63f0023 \
  --availability-zone us-east-1c \
  --instance-os-user ec2-user \
  --ssh-public-key file://~/.ssh/id_rsa.pub \
  --region us-east-1
# Debe responder: "Success": true
```

---

## 🔧 Paso 1: Preparar el Script de Migración

### 1.1 Estructura Base del Script

```python
"""
Script de migración para [descripción del cambio]
PostgreSQL Version
Creado: [fecha]
"""

import psycopg2
from datetime import datetime

# Configuración de conexión a RDS PostgreSQL
DB_CONFIG = {
    'host': 'softone-db.ccvomgoayzyt.us-east-1.rds.amazonaws.com',
    'port': 5432,
    'database': 'postgres',
    'user': 'dbadmin',
    'password': 'TuPassSeguro123!'
}

def migrate():
    """Función principal de migración"""
    try:
        print("🔌 Conectando a PostgreSQL RDS...\n")
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()
        
        print("🔄 Ejecutando migración: [descripción]...\n")
        
        # TU LÓGICA DE MIGRACIÓN AQUÍ
        # Ejemplo:
        # cursor.execute("ALTER TABLE usuarios ADD COLUMN nuevo_campo VARCHAR(256)")
        # conn.commit()
        
        print("✅ Migración completada\n")
        cursor.close()
        conn.close()
        return True
        
    except Exception as e:
        print(f"❌ ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    import sys
    success = migrate()
    sys.exit(0 if success else 1)
```

### 1.2 Ejemplo Real: Agregar Columna

```python
def migrate():
    try:
        print("🔌 Conectando a PostgreSQL RDS...\n")
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()
        
        print("🔄 Ejecutando migración: Agregar columna 'nuevo_campo' a tabla 'usuarios'...\n")
        
        # Verificar si la columna ya existe
        cursor.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'usuarios' 
            AND column_name = 'nuevo_campo'
        """)
        
        if cursor.fetchone():
            print("✅ La columna 'nuevo_campo' ya existe")
            cursor.close()
            conn.close()
            return True
        
        # Agregar columna
        cursor.execute("ALTER TABLE usuarios ADD COLUMN nuevo_campo VARCHAR(256)")
        conn.commit()
        print("   ✅ Columna agregada")
        
        # Verificar resultado
        cursor.execute("""
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'usuarios' 
            AND column_name = 'nuevo_campo'
        """)
        
        result = cursor.fetchone()
        if result:
            print(f"   ✅ Verificación: {result[0]} ({result[1]})")
        
        cursor.close()
        conn.close()
        print("\n✅ Migración completada exitosamente")
        return True
        
    except Exception as e:
        print(f"❌ ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        return False
```

### 1.3 Validaciones Importantes

```python
# ✅ SIEMPRE verificar si ya existe antes de CREATE/ALTER
cursor.execute("""
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'tu_tabla'
    )
""")
tabla_existe = cursor.fetchone()[0]

# ✅ SIEMPRE hacer commit después de cambios
conn.commit()

# ✅ SIEMPRE usar try/except
try:
    cursor.execute("...")
except Exception as e:
    conn.rollback()
    raise

# ✅ SIEMPRE cerrar conexiones
cursor.close()
conn.close()
```

---

## 📤 Paso 2: Transferir Script al Servidor

### 2.1 Inyectar clave SSH y Copiar Script a EC2

> **Recuerda:** La clave pública solo está activa **60 segundos**. Ejecuta el SCP inmediatamente después.

```bash
# Paso 1: Inyectar clave pública temporalmente
aws ec2-instance-connect send-ssh-public-key \
  --instance-id i-040873693a63f0023 \
  --availability-zone us-east-1c \
  --instance-os-user ec2-user \
  --ssh-public-key file://~/.ssh/id_rsa.pub \
  --region us-east-1

# Paso 2: Copiar el script INMEDIATAMENTE (en menos de 60 segundos)
scp -i ~/.ssh/id_rsa \
    -o StrictHostKeyChecking=no \
    -o IdentitiesOnly=yes \
    tu_script_migracion.py \
    ec2-user@$INSTANCE_IP:~/
```

```bash
# Copiar múltiples scripts (inyectar clave una vez, copiar todos)
aws ec2-instance-connect send-ssh-public-key \
  --instance-id i-040873693a63f0023 \
  --availability-zone us-east-1c \
  --instance-os-user ec2-user \
  --ssh-public-key file://~/.ssh/id_rsa.pub \
  --region us-east-1

scp -i ~/.ssh/id_rsa \
    -o StrictHostKeyChecking=no \
    -o IdentitiesOnly=yes \
    script1.py script2.py script3.py \
    ec2-user@$INSTANCE_IP:~/
```

### 2.2 Verificar que se Copió

```bash
# Inyectar clave y verificar
aws ec2-instance-connect send-ssh-public-key \
  --instance-id i-040873693a63f0023 \
  --availability-zone us-east-1c \
  --instance-os-user ec2-user \
  --ssh-public-key file://~/.ssh/id_rsa.pub \
  --region us-east-1

ssh -i ~/.ssh/id_rsa \
    -o StrictHostKeyChecking=no \
    -o IdentitiesOnly=yes \
    ec2-user@$INSTANCE_IP "ls -lh ~/tu_script_migracion.py"
```

---

## ⚙️ Paso 3: Ejecutar la Migración

### 3.1 Instalar Dependencias (primera vez)

```bash
# Inyectar clave y ejecutar instalación
aws ec2-instance-connect send-ssh-public-key \
  --instance-id i-040873693a63f0023 \
  --availability-zone us-east-1c \
  --instance-os-user ec2-user \
  --ssh-public-key file://~/.ssh/id_rsa.pub \
  --region us-east-1

ssh -i ~/.ssh/id_rsa \
    -o StrictHostKeyChecking=no \
    -o IdentitiesOnly=yes \
    ec2-user@$INSTANCE_IP \
    "source /var/app/venv/*/bin/activate && pip install psycopg2-binary"
```

**Nota:** psycopg2-binary ya debería estar instalado en el venv de la aplicación.

### 3.2 Ejecutar Script de Migración

```bash
# Inyectar clave
aws ec2-instance-connect send-ssh-public-key \
  --instance-id i-040873693a63f0023 \
  --availability-zone us-east-1c \
  --instance-os-user ec2-user \
  --ssh-public-key file://~/.ssh/id_rsa.pub \
  --region us-east-1

# Ejecutar script usando el venv de la aplicación (RECOMENDADO)
ssh -i ~/.ssh/id_rsa \
    -o StrictHostKeyChecking=no \
    -o IdentitiesOnly=yes \
    ec2-user@$INSTANCE_IP \
    "source /var/app/venv/*/bin/activate && python tu_script_migracion.py"
```

### 3.3 Ejemplo: Ejecutar Múltiples Migraciones

```bash
# Para cada migración: inyectar clave y ejecutar

# Migración 1
aws ec2-instance-connect send-ssh-public-key \
  --instance-id i-040873693a63f0023 \
  --availability-zone us-east-1c \
  --instance-os-user ec2-user \
  --ssh-public-key file://~/.ssh/id_rsa.pub \
  --region us-east-1
ssh -i ~/.ssh/id_rsa -o StrictHostKeyChecking=no -o IdentitiesOnly=yes \
    ec2-user@$INSTANCE_IP \
    "source /var/app/venv/*/bin/activate && python migrate_1_base.py"

# Migración 2 (solo si 1 fue exitosa)
aws ec2-instance-connect send-ssh-public-key \
  --instance-id i-040873693a63f0023 \
  --availability-zone us-east-1c \
  --instance-os-user ec2-user \
  --ssh-public-key file://~/.ssh/id_rsa.pub \
  --region us-east-1
ssh -i ~/.ssh/id_rsa -o StrictHostKeyChecking=no -o IdentitiesOnly=yes \
    ec2-user@$INSTANCE_IP \
    "source /var/app/venv/*/bin/activate && python migrate_2_fk.py"
```

### 3.4 Interpretar Output

```
🔌 Conectando a PostgreSQL RDS...          ← Iniciando conexión
🔄 Ejecutando migración: ...               ← Ejecutando cambios
✅ Columna 'xxx' agregada                  ← Cambio exitoso
📋 Columnas actuales en 'tabla':           ← Verificando resultado
   • columna1 (tipo_dato)
   • columna2 (tipo_dato)
✅ Migración completada exitosamente       ← Éxito total

❌ ERROR: ...                              ← Problema encontrado
Traceback (most recent call last):         ← Stack trace para depuración
```

---

## 🔍 Paso 4: Verificar los Cambios

### 4.1 Conectarse Directamente a RDS desde EC2

```bash
# Inyectar clave y consultar RDS

aws ec2-instance-connect send-ssh-public-key \
  --instance-id i-040873693a63f0023 \
  --availability-zone us-east-1c \
  --instance-os-user ec2-user \
  --ssh-public-key file://~/.ssh/id_rsa.pub \
  --region us-east-1

# Ver todas las tablas
ssh -i ~/.ssh/id_rsa -o StrictHostKeyChecking=no -o IdentitiesOnly=yes \
    ec2-user@$INSTANCE_IP \
    "PGPASSWORD='TuPassSeguro123!' psql \
     -h softone-db.ccvomgoayzyt.us-east-1.rds.amazonaws.com \
     -U dbadmin -d postgres -c '\dt'"

# Ver columnas de una tabla específica
aws ec2-instance-connect send-ssh-public-key \
  --instance-id i-040873693a63f0023 \
  --availability-zone us-east-1c \
  --instance-os-user ec2-user \
  --ssh-public-key file://~/.ssh/id_rsa.pub \
  --region us-east-1

ssh -i ~/.ssh/id_rsa -o StrictHostKeyChecking=no -o IdentitiesOnly=yes \
    ec2-user@$INSTANCE_IP \
    "PGPASSWORD='TuPassSeguro123!' psql \
     -h softone-db.ccvomgoayzyt.us-east-1.rds.amazonaws.com \
     -U dbadmin -d postgres \
     -c 'SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_name = '\''tu_tabla'\'' ORDER BY ordinal_position;'"
```

### 4.2 Queries de Verificación Comunes

```bash
# Patrón general: inyectar clave + ejecutar psql

aws ec2-instance-connect send-ssh-public-key \
  --instance-id i-040873693a63f0023 \
  --availability-zone us-east-1c \
  --instance-os-user ec2-user \
  --ssh-public-key file://~/.ssh/id_rsa.pub \
  --region us-east-1

# Verificar columna específica
ssh -i ~/.ssh/id_rsa -o StrictHostKeyChecking=no -o IdentitiesOnly=yes \
    ec2-user@$INSTANCE_IP \
    "PGPASSWORD='TuPassSeguro123!' psql \
     -h softone-db.ccvomgoayzyt.us-east-1.rds.amazonaws.com \
     -U dbadmin -d postgres \
     -c \"SELECT column_name, data_type FROM information_schema.columns \
         WHERE table_name='tu_tabla' AND column_name='tu_columna';\""

# Verificar constraints (Foreign Keys)
aws ec2-instance-connect send-ssh-public-key \
  --instance-id i-040873693a63f0023 \
  --availability-zone us-east-1c \
  --instance-os-user ec2-user \
  --ssh-public-key file://~/.ssh/id_rsa.pub \
  --region us-east-1

ssh -i ~/.ssh/id_rsa -o StrictHostKeyChecking=no -o IdentitiesOnly=yes \
    ec2-user@$INSTANCE_IP \
    "PGPASSWORD='TuPassSeguro123!' psql \
     -h softone-db.ccvomgoayzyt.us-east-1.rds.amazonaws.com \
     -U dbadmin -d postgres \
     -c \"SELECT conname, conrelid::regclass, confrelid::regclass \
         FROM pg_constraint WHERE conname = 'tu_constraint';\""
```

### 4.3 Verificar Datos no fueron Afectados

```bash
aws ec2-instance-connect send-ssh-public-key \
  --instance-id i-040873693a63f0023 \
  --availability-zone us-east-1c \
  --instance-os-user ec2-user \
  --ssh-public-key file://~/.ssh/id_rsa.pub \
  --region us-east-1

ssh -i ~/.ssh/id_rsa -o StrictHostKeyChecking=no -o IdentitiesOnly=yes \
    ec2-user@$INSTANCE_IP \
    "PGPASSWORD='TuPassSeguro123!' psql \
     -h softone-db.ccvomgoayzyt.us-east-1.rds.amazonaws.com \
     -U dbadmin -d postgres \
     -c \"SELECT COUNT(*) as total_registros FROM tu_tabla;\""
```
```

### 4.3 Verificar Datos no fueron Afectados

```bash
# Contar registros antes/después
eb ssh softone-backend-useast1 --command \
  "PGPASSWORD='TuPassSeguro123!' psql \
   -h softone-db.ccvomgoayzyt.us-east-1.rds.amazonaws.com \
   -U dbadmin \
   -d postgres \
   -c \"SELECT COUNT(*) as total_registros FROM tu_tabla;\""
```

---

## 🧹 Paso 5: Limpiar y Documentar

### 5.1 Eliminar Scripts del Servidor

```bash
aws ec2-instance-connect send-ssh-public-key \
  --instance-id i-040873693a63f0023 \
  --availability-zone us-east-1c \
  --instance-os-user ec2-user \
  --ssh-public-key file://~/.ssh/id_rsa.pub \
  --region us-east-1

# Eliminar un archivo
ssh -i ~/.ssh/id_rsa -o StrictHostKeyChecking=no -o IdentitiesOnly=yes \
    ec2-user@$INSTANCE_IP \
    "rm -f ~/tu_script_migracion.py && ls ~/\*.py 2>/dev/null || echo 'Limpio'"

# Eliminar múltiples archivos
ssh -i ~/.ssh/id_rsa -o StrictHostKeyChecking=no -o IdentitiesOnly=yes \
    ec2-user@$INSTANCE_IP \
    "rm -f ~/script1.py ~/script2.py ~/script3.py"
```

### 5.2 Documentar la Migración

Crear archivo `MIGRACION_FECHA.md` con:

```markdown
# Migración: [Descripción]

**Fecha:** [YYYY-MM-DD]
**Base de datos:** softone-db
**Ambiente:** Producción (us-east-1)

## Cambios

- Columna X agregada a tabla Y
- Constraint Z creado
- Índice W agregado

## Verificación

✅ Columna existe
✅ Constraint funciona
✅ Datos intactos

## Scripts Utilizados

- `migrate_xxxxx.py`

## Estado

✅ Exitosa
```

---

## 🆘 Solución de Problemas

### Problema 1: "ModuleNotFoundError: No module named 'psycopg2'"

**Causa:** psycopg2 no está en el Python que se está usando

**Solución:**
```bash
# Usar el venv de la aplicación
aws ec2-instance-connect send-ssh-public-key \
  --instance-id i-040873693a63f0023 \
  --availability-zone us-east-1c \
  --instance-os-user ec2-user \
  --ssh-public-key file://~/.ssh/id_rsa.pub \
  --region us-east-1

ssh -i ~/.ssh/id_rsa -o StrictHostKeyChecking=no -o IdentitiesOnly=yes \
    ec2-user@$INSTANCE_IP \
    "source /var/app/venv/*/bin/activate && python script.py"
```

### Problema 2: "Operation timed out" en conexión RDS

**Causa:** Intentas conectar desde tu máquina local directamente

**Solución:** Usa SIEMPRE la instancia EC2 como intermediaria — RDS solo acepta conexiones desde dentro de la VPC.

### Problema 3: "column "xxx" of relation "yyy" already exists"

**Causa:** La columna ya fue agregada en una migración anterior

**Solución:** Agregar verificación en el script:
```python
cursor.execute("""
    SELECT column_name FROM information_schema.columns 
    WHERE table_name = 'yyy' AND column_name = 'xxx'
""")

if cursor.fetchone():
    print("✅ La columna ya existe - saltando")
else:
    cursor.execute("ALTER TABLE yyy ADD COLUMN xxx VARCHAR")
    print("✅ Columna agregada")
```

### Problema 4: "Permission denied (publickey)" al hacer SSH/SCP

**Causa:** La ventana de 60 segundos de EC2 Instance Connect expiró

**Solución:** Volver a ejecutar `send-ssh-public-key` e intentar de nuevo inmediatamente:
```bash
aws ec2-instance-connect send-ssh-public-key \
  --instance-id i-040873693a63f0023 \
  --availability-zone us-east-1c \
  --instance-os-user ec2-user \
  --ssh-public-key file://~/.ssh/id_rsa.pub \
  --region us-east-1
# Ahora tienes 60 segundos — ejecuta SCP/SSH de inmediato
```

### Problema 5: "eb ssh" no funciona / pide clave desconocida

**Causa:** EB CLI busca la clave `softone-eb-20251122` que no existe. El archivo `.pem` local está vacío.

**Solución:** **NO uses `eb ssh`**. Usa siempre el método EC2 Instance Connect de esta guía.

### Problema 6: SSM Session Manager no está disponible

**Síntoma:** `aws ssm start-session` devuelve `TargetNotConnected` o lista `InstanceInformationList: []`

**Causa:** El SSM Agent no está instalado/corriendo en esta instancia (AL2 de EB).

**Solución:** Usar exclusivamente el método EC2 Instance Connect.

### Problema 7: "psql: command not found"

**Causa:** psql no está instalado en la instancia EC2

**Solución:**
```bash
aws ec2-instance-connect send-ssh-public-key \
  --instance-id i-040873693a63f0023 \
  --availability-zone us-east-1c \
  --instance-os-user ec2-user \
  --ssh-public-key file://~/.ssh/id_rsa.pub \
  --region us-east-1

ssh -i ~/.ssh/id_rsa -o StrictHostKeyChecking=no -o IdentitiesOnly=yes \
    ec2-user@$INSTANCE_IP "sudo yum install -y postgresql"
```

---

## 💡 Casos de Uso Comunes

### Caso 1: Agregar Columna Simple

```python
def migrate():
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()
        
        # Verificar si existe
        cursor.execute("""
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'usuarios' AND column_name = 'estado'
        """)
        
        if cursor.fetchone():
            print("✅ La columna ya existe")
            cursor.close()
            conn.close()
            return True
        
        # Agregar columna
        cursor.execute("""
            ALTER TABLE usuarios 
            ADD COLUMN estado VARCHAR(50) DEFAULT 'activo'
        """)
        conn.commit()
        print("✅ Columna agregada")
        
        cursor.close()
        conn.close()
        return True
        
    except Exception as e:
        print(f"❌ ERROR: {e}")
        return False
```

### Caso 2: Crear Foreign Key

```python
def migrate():
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()
        
        # Verificar si existe
        cursor.execute("""
            SELECT 1 FROM pg_constraint 
            WHERE conname = 'fk_usuarios_departamento'
        """)
        
        if cursor.fetchone():
            print("✅ FK ya existe")
            cursor.close()
            conn.close()
            return True
        
        # Crear FK
        cursor.execute("""
            ALTER TABLE usuarios 
            ADD CONSTRAINT fk_usuarios_departamento 
            FOREIGN KEY (departamento_id) 
            REFERENCES departamentos(id) 
            ON DELETE CASCADE
        """)
        conn.commit()
        print("✅ Foreign Key creado")
        
        cursor.close()
        conn.close()
        return True
        
    except Exception as e:
        print(f"❌ ERROR: {e}")
        return False
```

### Caso 3: Crear Índice

```python
def migrate():
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()
        
        # Crear índice
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_usuarios_email 
            ON usuarios(email)
        """)
        conn.commit()
        print("✅ Índice creado")
        
        cursor.close()
        conn.close()
        return True
        
    except Exception as e:
        print(f"❌ ERROR: {e}")
        return False
```

### Caso 4: Actualizar Datos Existentes

```python
def migrate():
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()
        
        print("🔄 Actualizando datos existentes...")
        
        # Actualizar columna para todos los registros
        cursor.execute("""
            UPDATE usuarios 
            SET estado = 'migrado' 
            WHERE estado IS NULL
        """)
        
        # Mostrar cuántos registros se actualizaron
        print(f"   ✅ {cursor.rowcount} registros actualizados")
        
        conn.commit()
        cursor.close()
        conn.close()
        return True
        
    except Exception as e:
        print(f"❌ ERROR: {e}")
        return False
```

### Caso 5: Migración Compleja con Múltiples Pasos

```python
def migrate():
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()
        
        print("🔄 Ejecutando migración compleja...\n")
        
        # Paso 1: Agregar nueva columna
        print("Paso 1: Agregando columna...")
        cursor.execute("""
            ALTER TABLE productos 
            ADD COLUMN categoria_id INTEGER
        """)
        conn.commit()
        print("✅ Columna agregada\n")
        
        # Paso 2: Crear tabla asociada
        print("Paso 2: Creando tabla categorías...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS categorias (
                id SERIAL PRIMARY KEY,
                nombre VARCHAR(256) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.commit()
        print("✅ Tabla creada\n")
        
        # Paso 3: Crear FK
        print("Paso 3: Creando foreign key...")
        cursor.execute("""
            ALTER TABLE productos 
            ADD CONSTRAINT fk_productos_categoria 
            FOREIGN KEY (categoria_id) 
            REFERENCES categorias(id)
        """)
        conn.commit()
        print("✅ Foreign key creado\n")
        
        # Paso 4: Crear índice
        print("Paso 4: Creando índice...")
        cursor.execute("""
            CREATE INDEX idx_productos_categoria_id 
            ON productos(categoria_id)
        """)
        conn.commit()
        print("✅ Índice creado\n")
        
        cursor.close()
        conn.close()
        print("✅ Migración completada exitosamente")
        return True
        
    except Exception as e:
        print(f"❌ ERROR en paso {paso}: {e}")
        conn.rollback()
        return False
```

---

## 📋 Checklist: Antes de Ejecutar Migración

- [ ] Script de migración probado localmente (sintaxis)
- [ ] DB_CONFIG tiene credenciales correctas
- [ ] Verificaciones de existencia en el script
- [ ] Try/except alrededor de operaciones críticas
- [ ] conn.commit() después de cambios
- [ ] Conexión cerrada al final
- [ ] Output con emojis para legibilidad
- [ ] Script copiado a EC2
- [ ] Todas las dependencias disponibles en venv
- [ ] Backup/snapshot de RDS creado (opcional pero recomendado)
- [ ] Script de rollback preparado (para cambios críticos)

---

## 🚀 Flujo Completo de Ejemplo

```bash
# ============================================================
# FLUJO COMPLETO: Agregar columna enable_nueva_feature a entities
# ============================================================

# 0. Obtener IP actual
INSTANCE_IP=$(aws ec2 describe-instances \
  --instance-ids i-040873693a63f0023 \
  --query 'Reservations[0].Instances[0].PublicIpAddress' \
  --output text)
echo "IP: $INSTANCE_IP"

# 1. Crear el script de migración localmente
cat > migration_add_nueva_feature.py << 'EOF'
import psycopg2

DB_CONFIG = {
    'host': 'softone-db.ccvomgoayzyt.us-east-1.rds.amazonaws.com',
    'port': 5432,
    'database': 'postgres',
    'user': 'dbadmin',
    'password': 'TuPassSeguro123!'
}

def migrate():
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()
        print("🔌 Conectando a RDS...")

        # Verificar si ya existe
        cursor.execute("""
            SELECT column_name FROM information_schema.columns 
            WHERE table_name = 'entities' AND column_name = 'enable_nueva_feature'
        """)
        if cursor.fetchone():
            print("✅ Columna ya existe - nada que hacer")
            cursor.close()
            conn.close()
            return True

        # Agregar columna
        print("🔄 Agregando columna enable_nueva_feature...")
        cursor.execute("""
            ALTER TABLE entities 
            ADD COLUMN enable_nueva_feature BOOLEAN NOT NULL DEFAULT TRUE
        """)
        conn.commit()
        print("✅ Columna agregada")

        # Verificar
        cursor.execute("""
            SELECT column_name, data_type, column_default 
            FROM information_schema.columns 
            WHERE table_name='entities' AND column_name='enable_nueva_feature'
        """)
        row = cursor.fetchone()
        print(f"OK: {row}")

        cursor.close()
        conn.close()
        return True
    except Exception as e:
        print(f"❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    import sys
    sys.exit(0 if migrate() else 1)
EOF

# 2. Inyectar clave y copiar script
aws ec2-instance-connect send-ssh-public-key \
  --instance-id i-040873693a63f0023 \
  --availability-zone us-east-1c \
  --instance-os-user ec2-user \
  --ssh-public-key file://~/.ssh/id_rsa.pub \
  --region us-east-1

scp -i ~/.ssh/id_rsa \
    -o StrictHostKeyChecking=no \
    -o IdentitiesOnly=yes \
    migration_add_nueva_feature.py \
    ec2-user@$INSTANCE_IP:~/

# 3. Inyectar clave y ejecutar migración
aws ec2-instance-connect send-ssh-public-key \
  --instance-id i-040873693a63f0023 \
  --availability-zone us-east-1c \
  --instance-os-user ec2-user \
  --ssh-public-key file://~/.ssh/id_rsa.pub \
  --region us-east-1

ssh -i ~/.ssh/id_rsa \
    -o StrictHostKeyChecking=no \
    -o IdentitiesOnly=yes \
    ec2-user@$INSTANCE_IP \
    "source /var/app/venv/*/bin/activate && python migration_add_nueva_feature.py"

# 4. Inyectar clave y limpiar
aws ec2-instance-connect send-ssh-public-key \
  --instance-id i-040873693a63f0023 \
  --availability-zone us-east-1c \
  --instance-os-user ec2-user \
  --ssh-public-key file://~/.ssh/id_rsa.pub \
  --region us-east-1

ssh -i ~/.ssh/id_rsa \
    -o StrictHostKeyChecking=no \
    -o IdentitiesOnly=yes \
    ec2-user@$INSTANCE_IP \
    "rm -f ~/migration_add_nueva_feature.py && echo 'Limpio'"

echo "✅ Migración completada"
```

---

## 📞 Referencia Rápida

```bash
# ── OBTENER IP DE LA INSTANCIA ─────────────────────────────
INSTANCE_IP=$(aws ec2 describe-instances \
  --instance-ids i-040873693a63f0023 \
  --query 'Reservations[0].Instances[0].PublicIpAddress' \
  --output text)

# ── INYECTAR CLAVE (válida 60 segundos) ───────────────────
aws ec2-instance-connect send-ssh-public-key \
  --instance-id i-040873693a63f0023 \
  --availability-zone us-east-1c \
  --instance-os-user ec2-user \
  --ssh-public-key file://~/.ssh/id_rsa.pub \
  --region us-east-1

# ── COPIAR SCRIPT ──────────────────────────────────────────
scp -i ~/.ssh/id_rsa -o StrictHostKeyChecking=no -o IdentitiesOnly=yes \
    script.py ec2-user@$INSTANCE_IP:~/

# ── EJECUTAR SCRIPT ────────────────────────────────────────
ssh -i ~/.ssh/id_rsa -o StrictHostKeyChecking=no -o IdentitiesOnly=yes \
    ec2-user@$INSTANCE_IP \
    "source /var/app/venv/*/bin/activate && python script.py"

# ── CONECTAR PSQL (verificar) ─────────────────────────────
ssh -i ~/.ssh/id_rsa -o StrictHostKeyChecking=no -o IdentitiesOnly=yes \
    ec2-user@$INSTANCE_IP \
    "PGPASSWORD='TuPassSeguro123!' psql \
     -h softone-db.ccvomgoayzyt.us-east-1.rds.amazonaws.com \
     -U dbadmin -d postgres -c 'QUERY_AQUI'"

# ── QUERIES PSQL ÚTILES ────────────────────────────────────
# Ver columnas de una tabla:
"SELECT column_name, data_type FROM information_schema.columns WHERE table_name='tabla'"

# Ver constraints:
"SELECT conname FROM pg_constraint WHERE conrelid::regclass::text = 'tabla'"

# Ver índices:
"SELECT indexname FROM pg_indexes WHERE tablename = 'tabla'"

# Contar registros:
"SELECT COUNT(*) FROM tabla"

# ── LIMPIAR ARCHIVOS ───────────────────────────────────────
ssh -i ~/.ssh/id_rsa -o StrictHostKeyChecking=no -o IdentitiesOnly=yes \
    ec2-user@$INSTANCE_IP "rm -f ~/script.py"
```

---

## ✨ Mejores Prácticas

1. **Idempotencia:** Siempre verifica que el cambio no exista antes de aplicarlo
2. **Transacciones:** Usa commit() para asegurar cambios, rollback() para errores
3. **Validación:** Verifica el resultado después de cada operación
4. **Logging:** Usa print() con emojis para claridad
5. **Documentación:** Documenta cada migración con un `.md`
6. **Testing:** Prueba la sintaxis SQL antes de ejecutar
7. **Backups:** Considera snapshot de RDS antes de cambios críticos
8. **Seguridad:** Nunca expongas credenciales en logs o commits
9. **Modularidad:** Divide migraciones complejas en pasos pequeños
10. **Rollback:** Ten un plan si algo sale mal

---

## 📚 Recursos Útiles

**PostgreSQL Documentation:**
- https://www.postgresql.org/docs/14/sql-altertable.html
- https://www.postgresql.org/docs/14/sql-createindex.html

**Python psycopg2:**
- https://www.psycopg.org/documentation/

**AWS RDS PostgreSQL:**
- https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Concepts.DBInstanceClass.html

**AWS Elastic Beanstalk:**
- https://docs.aws.amazon.com/elasticbeanstalk/latest/dg/

---

**Última actualización:** 15 de marzo de 2026  
**Probado en:** Softone360 - Producción (us-east-1)  
**Versiones:** PostgreSQL 14, Python 3.11, psycopg2 2.9.9  
**Método validado:** EC2 Instance Connect + `~/.ssh/id_rsa` (NO usar eb-ssh ni el archivo .pem vacío)

