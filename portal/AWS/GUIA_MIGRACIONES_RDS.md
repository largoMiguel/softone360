# 📚 Guía Completa: Cómo Ejecutar Migraciones en PostgreSQL RDS

**Fecha:** 11 de noviembre de 2025  
**Contexto:** Sistema Softone360 con base de datos PostgreSQL en AWS RDS (us-east-1)  
**Método:** Ejecución segura desde instancia EC2 de Elastic Beanstalk

---

## 🎯 Propósito

Esta guía documenta el proceso probado para ejecutar migraciones de base de datos en RDS PostgreSQL sin exponer acceso público directo. El método fue validado exitosamente con las migraciones del 11 de noviembre de 2025.

---

## 📋 Tabla de Contenidos

1. [Arquitectura y Seguridad](#arquitectura-y-seguridad)
2. [Requisitos Previos](#requisitos-previos)
3. [Paso 1: Preparar el Script de Migración](#paso-1-preparar-el-script-de-migración)
4. [Paso 2: Transferir Script al Servidor](#paso-2-transferir-script-al-servidor)
5. [Paso 3: Ejecutar la Migración](#paso-3-ejecutar-la-migración)
6. [Paso 4: Verificar los Cambios](#paso-4-verificar-los-cambios)
7. [Paso 5: Limpiar y Documentar](#paso-5-limpiar-y-documentar)
8. [Solución de Problemas](#solución-de-problemas)
9. [Casos de Uso Comunes](#casos-de-uso-comunes)

---

## 🏗️ Arquitectura y Seguridad

### Modelo de Red

```
┌─────────────────────────────────────────┐
│         Tu Máquina Local (Mac)          │
│  • Scripts de migración preparados      │
│  • SSH con clave AWS                    │
└────────────────────┬────────────────────┘
                     │ SSH + SCP
                     ↓
┌─────────────────────────────────────────┐
│   EC2 Instance (Elastic Beanstalk)      │
│   • sg-02c3c9aba42cda46e (EB SG)        │
│   • Tiene acceso a RDS internamente     │
│   • Ejecuta migraciones aquí            │
└────────────────────┬────────────────────┘
                     │ TCP/5432 (Internal)
                     ↓
┌─────────────────────────────────────────┐
│   RDS PostgreSQL (softone-db)           │
│   • sg-0028de7003bcbc156                │
│   • Acceso SOLO desde SG de EB          │
│   • Base de datos: postgres             │
│   • Usuario: dbadmin                    │
└─────────────────────────────────────────┘
```

### Por qué este Método

✅ **Seguridad:** RDS no está expuesto públicamente  
✅ **Fiabilidad:** Usa red interna de AWS  
✅ **Facilidad:** EC2 ya tiene psycopg2 instalado  
✅ **Velocidad:** No necesitas cambiar security groups  

---

## ✅ Requisitos Previos

### En tu máquina local

```bash
# 1. Verificar que tienes acceso SSH a EB
ls ~/.ssh/aws-eb

# 2. Instalar EB CLI
brew install awsebcli

# 3. Verifica que estás en el ambiente correcto
cd /ruta/a/SOLUCTIONS/backend
eb list
```

### En AWS

```bash
# Security group de EB debe tener acceso a RDS
aws ec2 describe-security-groups \
  --group-ids sg-02c3c9aba42cda46e \
  --query 'SecurityGroups[0].IpPermissions' | grep 5432
```

**Credenciales necesarias:**

| Variable | Valor |
|----------|-------|
| Host RDS | softone-db.ccvomgoayzyt.us-east-1.rds.amazonaws.com |
| Puerto | 5432 |
| Usuario | dbadmin |
| Contraseña | TuPassSeguro123! |
| Base de datos | postgres |
| Environment EB | softone-backend-useast1 |

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

### 2.1 Copiar Script a EC2

```bash
# Desde tu máquina local, en la carpeta del proyecto
cd /Users/largo/Documents/SOLUCTIONS/backend

# Copiar un script
scp -i ~/.ssh/aws-eb \
    -o IdentitiesOnly=yes \
    tu_script_migracion.py \
    ec2-user@184.72.234.103:~/

# Copiar múltiples scripts
scp -i ~/.ssh/aws-eb \
    -o IdentitiesOnly=yes \
    script1.py script2.py script3.py \
    ec2-user@184.72.234.103:~/

# Copiar carpeta completa
scp -r -i ~/.ssh/aws-eb \
    -o IdentitiesOnly=yes \
    migrations/ \
    ec2-user@184.72.234.103:~/
```

### 2.2 Verificar que se Copió

```bash
# Conectar por SSH y verificar
cd /Users/largo/Documents/SOLUCTIONS/backend
eb ssh softone-backend-useast1 --command "ls -lh ~/tu_script_migracion.py"

# Verificar contenido
eb ssh softone-backend-useast1 --command "head -10 ~/tu_script_migracion.py"
```

---

## ⚙️ Paso 3: Ejecutar la Migración

### 3.1 Instalar Dependencias (primera vez)

```bash
# Desde tu máquina, ejecutar comando en EC2
cd /Users/largo/Documents/SOLUCTIONS/backend

eb ssh softone-backend-useast1 --command \
  "source /var/app/venv/*/bin/activate && pip install psycopg2-binary"
```

**Nota:** psycopg2-binary ya debería estar instalado en el venv de la aplicación.

### 3.2 Ejecutar Script de Migración

```bash
# Opción 1: Usando el venv de la aplicación (RECOMENDADO)
cd /Users/largo/Documents/SOLUCTIONS/backend

eb ssh softone-backend-useast1 --command \
  "source /var/app/venv/*/bin/activate && python tu_script_migracion.py"

# Opción 2: Usando Python del sistema
cd /Users/largo/Documents/SOLUCTIONS/backend

eb ssh softone-backend-useast1 --command "python3 tu_script_migracion.py"
```

### 3.3 Ejemplo: Ejecutar Múltiples Migraciones

```bash
# En orden secuencial (recomendado)
cd /Users/largo/Documents/SOLUCTIONS/backend

# Migración 1
eb ssh softone-backend-useast1 --command \
  "source /var/app/venv/*/bin/activate && python migrate_1_base.py"

# Migración 2 (solo si 1 fue exitosa)
eb ssh softone-backend-useast1 --command \
  "source /var/app/venv/*/bin/activate && python migrate_2_fk.py"

# Migración 3
eb ssh softone-backend-useast1 --command \
  "source /var/app/venv/*/bin/activate && python migrate_3_indices.py"
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
cd /Users/largo/Documents/SOLUCTIONS/backend

# Ver todas las tablas
eb ssh softone-backend-useast1 --command \
  "PGPASSWORD='TuPassSeguro123!' psql \
   -h softone-db.ccvomgoayzyt.us-east-1.rds.amazonaws.com \
   -U dbadmin \
   -d postgres \
   -c '\dt'"

# Ver columnas de una tabla
eb ssh softone-backend-useast1 --command \
  "PGPASSWORD='TuPassSeguro123!' psql \
   -h softone-db.ccvomgoayzyt.us-east-1.rds.amazonaws.com \
   -U dbadmin \
   -d postgres \
   -c 'SELECT column_name, data_type FROM information_schema.columns WHERE table_name = \"tu_tabla\" ORDER BY ordinal_position;'"
```

### 4.2 Queries de Verificación Comunes

```bash
# Verificar que una columna fue agregada
eb ssh softone-backend-useast1 --command \
  "PGPASSWORD='TuPassSeguro123!' psql \
   -h softone-db.ccvomgoayzyt.us-east-1.rds.amazonaws.com \
   -U dbadmin \
   -d postgres \
   -c \"SELECT column_name, data_type FROM information_schema.columns \
       WHERE table_name='tu_tabla' AND column_name='tu_columna';\""

# Verificar constraints (Foreign Keys)
eb ssh softone-backend-useast1 --command \
  "PGPASSWORD='TuPassSeguro123!' psql \
   -h softone-db.ccvomgoayzyt.us-east-1.rds.amazonaws.com \
   -U dbadmin \
   -d postgres \
   -c \"SELECT conname, conrelid::regclass, confrelid::regclass \
       FROM pg_constraint \
       WHERE conname = 'tu_constraint';\""

# Verificar índices
eb ssh softone-backend-useast1 --command \
  "PGPASSWORD='TuPassSeguro123!' psql \
   -h softone-db.ccvomgoayzyt.us-east-1.rds.amazonaws.com \
   -U dbadmin \
   -d postgres \
   -c \"SELECT indexname, tablename FROM pg_indexes \
       WHERE indexname = 'tu_indice';\""
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
cd /Users/largo/Documents/SOLUCTIONS/backend

# Eliminar un archivo
eb ssh softone-backend-useast1 --command \
  "rm -f ~/tu_script_migracion.py"

# Eliminar múltiples archivos
eb ssh softone-backend-useast1 --command \
  "rm -f ~/script1.py ~/script2.py ~/script3.py"

# Verificar que se eliminó
eb ssh softone-backend-useast1 --command \
  "ls -la ~/*.py"
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
eb ssh softone-backend-useast1 --command \
  "source /var/app/venv/*/bin/activate && python script.py"

# O instalar en el sistema
eb ssh softone-backend-useast1 --command \
  "pip3 install psycopg2-binary && python3 script.py"
```

### Problema 2: "Operation timed out" en conexión RDS

**Causa:** Intentas conectar desde tu máquina local directamente

**Solución:** Usa SIEMPRE la instancia EC2 como intermediaria
```bash
# ❌ INCORRECTO: Conectar directamente
python3 script.py  # Fail - timeout

# ✅ CORRECTO: Ejecutar desde EC2
eb ssh softone-backend-useast1 --command "python script.py"
```

### Problema 3: "column "xxx" of relation "yyy" already exists"

**Causa:** La columna ya fue agregada en una migración anterior

**Solución:** Agregar verificación en el script
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

### Problema 4: "psql: command not found"

**Causa:** psql no está instalado en la instancia EC2

**Solución:** Instalar PostgreSQL client
```bash
eb ssh softone-backend-useast1 --command \
  "sudo yum install -y postgresql"
```

### Problema 5: "FATAL: password authentication failed"

**Causa:** Contraseña incorrecta en DB_CONFIG

**Solución:** Verificar credenciales en el script
```python
DB_CONFIG = {
    'host': 'softone-db.ccvomgoayzyt.us-east-1.rds.amazonaws.com',
    'port': 5432,
    'database': 'postgres',
    'user': 'dbadmin',
    'password': 'TuPassSeguro123!'  # ← Verificar que sea correcto
}
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
# 1. Crear el script
cat > migrate_add_email_column.py << 'EOF'
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
        print("🔄 Agregando columna email_backup...\n")
        
        cursor.execute("""
            ALTER TABLE usuarios 
            ADD COLUMN email_backup VARCHAR(256)
        """)
        conn.commit()
        print("✅ Columna agregada")
        
        cursor.close()
        conn.close()
        return True
    except Exception as e:
        print(f"❌ ERROR: {e}")
        return False

if __name__ == "__main__":
    import sys
    success = migrate()
    sys.exit(0 if success else 1)
EOF

# 2. Copiar script a EC2
scp -i ~/.ssh/aws-eb -o IdentitiesOnly=yes \
    migrate_add_email_column.py \
    ec2-user@184.72.234.103:~/

# 3. Ejecutar migración
cd /Users/largo/Documents/SOLUCTIONS/backend
eb ssh softone-backend-useast1 --command \
    "source /var/app/venv/*/bin/activate && python migrate_add_email_column.py"

# 4. Verificar resultado
eb ssh softone-backend-useast1 --command \
    "PGPASSWORD='TuPassSeguro123!' psql \
     -h softone-db.ccvomgoayzyt.us-east-1.rds.amazonaws.com \
     -U dbadmin -d postgres \
     -c \"SELECT column_name FROM information_schema.columns WHERE table_name='usuarios' AND column_name='email_backup';\""

# 5. Limpiar
eb ssh softone-backend-useast1 --command "rm -f ~/migrate_add_email_column.py"

# 6. Documentar
echo "✅ Migración completada - email_backup agregado a usuarios"
```

---

## 📞 Referencia Rápida

```bash
# Copiar script
scp -i ~/.ssh/aws-eb -o IdentitiesOnly=yes script.py ec2-user@IP:~/

# Ejecutar con venv
eb ssh softone-backend-useast1 --command \
    "source /var/app/venv/*/bin/activate && python script.py"

# Conectar psql
eb ssh softone-backend-useast1 --command \
    "PGPASSWORD='TuPassSeguro123!' psql \
     -h softone-db.ccvomgoayzyt.us-east-1.rds.amazonaws.com \
     -U dbadmin -d postgres -c 'QUERY_AQUI'"

# Ver columnas tabla
-c "SELECT column_name, data_type FROM information_schema.columns WHERE table_name='tabla'"

# Ver constraints
-c "SELECT conname FROM pg_constraint WHERE conrelid::regclass::text = 'tabla'"

# Ver índices
-c "SELECT indexname FROM pg_indexes WHERE tablename = 'tabla'"

# Limpiar archivos
eb ssh softone-backend-useast1 --command "rm -f ~/script.py"
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

**Última actualización:** 11 de noviembre de 2025  
**Probado en:** Softone360 - Producción (us-east-1)  
**Versiones:** PostgreSQL 14, Python 3.11, psycopg2 2.9.9

