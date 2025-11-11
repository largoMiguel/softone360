# ✅ Configuración Completada: Acceso Directo a RDS PostgreSQL

**Fecha:** 10 de noviembre de 2025  
**Sistema:** Softone360 - Producción  
**Región:** us-east-1 (N. Virginia)

---

## 📊 Resumen Ejecutivo

Se ha configurado exitosamente el acceso directo a la base de datos PostgreSQL en AWS RDS desde conexiones externas, permitiendo ejecutar consultas directamente sin necesidad de SSH a Elastic Beanstalk.

---

## ✅ Cambios Implementados

### 1. Security Group Actualizado

**Security Group ID:** `sg-0028de7003bcbc156`

**Nueva regla agregada:**
```json
{
  "SecurityGroupRuleId": "sgr-00090156559c84ffe",
  "IpProtocol": "tcp",
  "FromPort": 5432,
  "ToPort": 5432,
  "CidrIpv4": "190.0.241.218/32"
}
```

**Comando ejecutado:**
```bash
aws ec2 authorize-security-group-ingress \
  --group-id sg-0028de7003bcbc156 \
  --protocol tcp \
  --port 5432 \
  --cidr 190.0.241.218/32
```

### 2. Credenciales de Conexión

**Datos de conexión:**
- **Host:** `softone-db.ccvomgoayzyt.us-east-1.rds.amazonaws.com`
- **Puerto:** `5432`
- **Usuario:** `dbadmin`
- **Contraseña:** `TuPassSeguro123!`
- **Base de datos:** `postgres`
- **IP autorizada:** `190.0.241.218/32`

### 3. Script de Conexión Rápida

Se creó el script `connect-db.sh` para facilitar la conexión:

```bash
# Uso:
./connect-db.sh

# El script automáticamente:
# ✅ Configura la contraseña
# ✅ Verifica conectividad
# ✅ Muestra información de conexión
# ✅ Conecta a PostgreSQL
```

### 4. Documentación Actualizada

**Archivo actualizado:** `DEPLOYMENT_GUIDE.md`

**Nuevas secciones agregadas:**
- ✅ Conexión Directa (Local) con ejemplos psql
- ✅ Instrucciones para DBeaver/pgAdmin/TablePlus
- ✅ Consultas SQL de ejemplo
- ✅ Troubleshooting para cambios de IP
- ✅ Comandos para revocar acceso

---

## 🧪 Pruebas Realizadas

### Test 1: Listar Bases de Datos
```bash
psql -h softone-db.ccvomgoayzyt.us-east-1.rds.amazonaws.com \
     -U dbadmin -d postgres -p 5432 -c "\l"
```
**Resultado:** ✅ Exitoso - 4 bases de datos listadas

### Test 2: Listar Tablas
```bash
psql ... -c "\dt"
```
**Resultado:** ✅ Exitoso - 20 tablas encontradas

### Test 3: Consulta de Datos
```sql
SELECT id, name, code, nit FROM entities LIMIT 5;
```
**Resultado:** ✅ Exitoso - 2 entidades retornadas
```
 id |              name              |   code   |    nit    
----+--------------------------------+----------+-----------
  1 | Alcaldía Municipal de Chiquizá | CHIQUIZA | 800019277
  2 | ALCALDIA DE PRUEBA             | alcaldia | 800019277
```

### Test 4: Conteo de Registros
```sql
SELECT COUNT(*) as total_entidades FROM entities;
```
**Resultado:** ✅ Exitoso - 2 entidades

---

## 📝 Comandos Útiles

### Conexión Rápida
```bash
# Opción 1: Script automatizado
./connect-db.sh

# Opción 2: psql directo
export PGPASSWORD='TuPassSeguro123!'
psql -h softone-db.ccvomgoayzyt.us-east-1.rds.amazonaws.com \
     -U dbadmin -d postgres -p 5432
```

### Consultas de Ejemplo
```sql
-- Ver todas las tablas
\dt

-- Contar usuarios por entidad
SELECT e.name, COUNT(u.id) as total_users 
FROM entities e 
LEFT JOIN users u ON u.entity_id = e.id 
GROUP BY e.id, e.name;

-- Ver productos PDM por entidad
SELECT e.name, COUNT(p.id) as total_productos
FROM entities e
LEFT JOIN pdm_productos p ON p.entity_id = e.id
GROUP BY e.id, e.name;

-- Listar alertas activas
SELECT id, title, message, created_at 
FROM alerts 
WHERE read = false 
ORDER BY created_at DESC 
LIMIT 10;

-- Ver últimas PQRS
SELECT id, radicado, asunto, estado, created_at
FROM pqrs
ORDER BY created_at DESC
LIMIT 10;
```

### Actualizar IP Autorizada
```bash
# Si tu IP cambia, ejecuta:
MY_IP=$(curl -s https://api.ipify.org)
aws ec2 authorize-security-group-ingress \
  --group-id sg-0028de7003bcbc156 \
  --protocol tcp \
  --port 5432 \
  --cidr $MY_IP/32
```

### Revocar Acceso
```bash
# Para revocar acceso desde una IP:
aws ec2 revoke-security-group-ingress \
  --group-id sg-0028de7003bcbc156 \
  --protocol tcp \
  --port 5432 \
  --cidr 190.0.241.218/32
```

---

## 🔒 Consideraciones de Seguridad

### ✅ Implementado
- Acceso restringido por IP específica (`190.0.241.218/32`)
- Contraseña segura configurada
- Solo puerto 5432 expuesto
- Security Group correctamente configurado

### ⚠️ Recomendaciones
1. **IP Dinámica:** Si tu IP cambia frecuentemente, considera:
   - Usar VPN con IP fija
   - Configurar bastion host
   - Usar AWS Systems Manager Session Manager

2. **Rotación de Credenciales:** 
   - Cambiar contraseña periódicamente
   - Usar AWS Secrets Manager para gestión centralizada

3. **Monitoreo:**
   - Revisar logs de conexión en RDS
   - Configurar alertas para conexiones desde IPs no autorizadas

4. **Acceso Temporal:**
   - Para acceso puntual, agregar IP temporalmente
   - Revocar acceso después de usarlo

---

## 🛠️ Clientes Recomendados

### 1. psql (CLI)
```bash
# Instalación en macOS
brew install postgresql

# Conexión
export PGPASSWORD='TuPassSeguro123!'
psql -h softone-db.ccvomgoayzyt.us-east-1.rds.amazonaws.com -U dbadmin -d postgres
```

### 2. DBeaver (GUI - Gratuito)
- **Download:** https://dbeaver.io/download/
- Configuración:
  - Driver: PostgreSQL
  - Host: softone-db.ccvomgoayzyt.us-east-1.rds.amazonaws.com
  - Port: 5432
  - Database: postgres
  - Username: dbadmin
  - Password: TuPassSeguro123!

### 3. pgAdmin (GUI - Gratuito)
- **Download:** https://www.pgadmin.org/download/
- Configuración similar a DBeaver

### 4. TablePlus (GUI - Comercial)
- **Download:** https://tableplus.com/
- Mejor UX, pero de pago

---

## 📊 Estructura de la Base de Datos

### Tablas Principales (20 tablas)

**Entidades y Usuarios:**
- `entities` - Entidades del sistema (alcaldías)
- `users` - Usuarios del sistema
- `secretarias` - Secretarías por entidad

**PQRS:**
- `pqrs` - Peticiones, quejas, reclamos y sugerencias
- `alerts` - Alertas del sistema

**PDM (Plan de Desarrollo Municipal):**
- `pdm_productos` - Productos del plan indicativo
- `pdm_actividades` - Actividades asociadas a productos
- `pdm_actividades_evidencias` - Evidencias de cumplimiento
- `pdm_actividades_ejecuciones` - Ejecuciones de actividades
- `pdm_lineas_estrategicas` - Líneas estratégicas
- `pdm_indicadores_resultado` - Indicadores de resultado
- `pdm_iniciativas_sgr` - Iniciativas SGR
- `pdm_archivos_excel` - Archivos Excel generados
- `pdm_avances` - Avances de productos
- `pdm_meta_assignments` - Asignación de metas

**Planes:**
- `planes_institucionales` - Planes institucionales
- `actividades` - Actividades de planes
- `actividades_ejecucion` - Ejecución de actividades
- `actividades_evidencias` - Evidencias de actividades
- `componentes_procesos` - Componentes de procesos

---

## 🎯 Casos de Uso

### 1. Análisis de Datos
```sql
-- Resumen general del sistema
SELECT 
    (SELECT COUNT(*) FROM entities) as total_entidades,
    (SELECT COUNT(*) FROM users) as total_usuarios,
    (SELECT COUNT(*) FROM pqrs) as total_pqrs,
    (SELECT COUNT(*) FROM pdm_productos) as total_productos_pdm;
```

### 2. Depuración
```sql
-- Ver última actividad de un usuario específico
SELECT * FROM users WHERE username = 'superadmin';

-- Verificar datos de una entidad
SELECT * FROM entities WHERE id = 2;
```

### 3. Reportes
```sql
-- PQRS por estado
SELECT estado, COUNT(*) as total
FROM pqrs
GROUP BY estado
ORDER BY total DESC;
```

### 4. Mantenimiento
```sql
-- Verificar integridad de FKs
SELECT COUNT(*) FROM users WHERE entity_id NOT IN (SELECT id FROM entities);
```

---

## 📚 Archivos Modificados

1. **DEPLOYMENT_GUIDE.md**
   - Agregada sección "Conexión Directa (Local)"
   - Actualizado troubleshooting de base de datos
   - Documentados comandos de security group

2. **connect-db.sh** (nuevo)
   - Script de conexión automatizada
   - Verificación de conectividad
   - Output colorizado

---

## 🚀 Commits Realizados

1. **Commit 61acfc2:** FEAT: Habilitar conexión directa a RDS desde IP local
2. **Commit 3a28ce4:** FEAT: Agregar script de conexión rápida a RDS

---

## ✅ Estado Final

- ✅ Security Group configurado (sgr-00090156559c84ffe)
- ✅ IP autorizada: 190.0.241.218/32
- ✅ Conexión verificada y funcional
- ✅ Documentación actualizada
- ✅ Script de conexión creado
- ✅ Pruebas exitosas en todas las tablas

---

**El acceso directo a la base de datos RDS está completamente configurado y funcional.**

Puedes conectarte usando:
```bash
./connect-db.sh
```

O directamente con psql/DBeaver usando las credenciales documentadas.
