# 🚀 Guía de Despliegue - Softone360

**Última actualización:** 10 de noviembre de 2025  
**Región AWS:** us-east-1 (N. Virginia)  
**Entorno:** Producción

---

## 📋 Tabla de Contenidos

1. [Comandos Rápidos](#comandos-rápidos)
2. [Despliegue Completo](#despliegue-completo)
3. [Gestión del Backend](#gestión-del-backend)
4. [Gestión del Frontend](#gestión-del-frontend)
5. [Base de Datos](#base-de-datos)
6. [Monitoreo y Logs](#monitoreo-y-logs)
7. [Troubleshooting](#troubleshooting)
8. [Costos y Optimización](#costos-y-optimización)

---

## ⚡ Comandos Rápidos

### Redesplegar Frontend
```bash
cd frontend && ./deploy-to-s3.sh
```

### Redesplegar Backend  
```bash
cd backend && eb deploy softone-backend-useast1
```

### Reiniciar Backend (sin redesplegar)
```bash
cd backend && eb ssh --command "sudo systemctl restart web.service"
```

### Ver Logs del Backend
```bash
cd backend && eb logs softone-backend-useast1
```

### Ver Logs en Tiempo Real (si está habilitado)
```bash
cd backend && eb logs softone-backend-useast1 --stream
```

---

## 🌐 Despliegue Completo

### Pre-requisitos
- AWS CLI configurado (`aws configure`)
- EB CLI instalado (`pip install awsebcli`)
- Node.js 18+ y npm
- Python 3.11+

### 1. Desplegar Frontend a S3

```bash
cd /Users/largo/Documents/SOLUCTIONS/frontend

# Opción A: Script automatizado (recomendado)
./deploy-to-s3.sh

# Opción B: Paso a paso manual
npm run build:prod
cd dist/pqrs-frontend/browser
aws s3 sync . s3://softone360-frontend-useast1/ --delete \
  --cache-control "public,max-age=31536000,immutable" --exclude "*.html"
aws s3 cp . s3://softone360-frontend-useast1/ --exclude "*" \
  --include "*.html" --cache-control "no-cache" --recursive
```

**URL Frontend:** http://softone360-frontend-useast1.s3-website-us-east-1.amazonaws.com

### 2. Desplegar Backend a Elastic Beanstalk

```bash
cd /Users/largo/Documents/SOLUCTIONS/backend

# Deploy automático
eb deploy softone-backend-useast1

# Verificar estado
eb status softone-backend-useast1

# Verificar health
curl https://softone-backend-useast1.eba-epvnmbmk.us-east-1.elasticbeanstalk.com/api/health
```

**URL Backend:** http://softone-backend-useast1.eba-epvnmbmk.us-east-1.elasticbeanstalk.com

---

## 🖥️ Gestión del Backend

### Reiniciar Servicio (rápido)
```bash
cd backend
eb ssh --command "sudo systemctl restart web.service"
```

### Escalado de Instancias
```bash
# Ver configuración actual
eb config softone-backend-useast1

# Escalar manualmente (editar autoscaling en AWS Console)
# Environment > Configuration > Capacity
```

### Variables de Entorno
```bash
# Ver variables actuales
eb printenv softone-backend-useast1

# Configurar nueva variable
eb setenv DATABASE_URL="postgresql://..." -e softone-backend-useast1
```

### Acceso SSH a Instancia
```bash
cd backend
eb ssh softone-backend-useast1
```

### Comandos Útiles en la Instancia
```bash
# Ver logs de aplicación
sudo tail -f /var/log/web.stdout.log

# Ver logs de Nginx
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# Estado del servicio
sudo systemctl status web.service

# Reiniciar manualmente
sudo systemctl restart web.service
```

---

## 🎨 Gestión del Frontend

### Configuración S3 para SPA

El bucket `softone360-frontend-useast1` debe tener:

**Static Website Hosting:**
- Index document: `index.html`
- Error document: `index.html` (para rutas de Angular)

**Política del Bucket:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::softone360-frontend-useast1/*"
    }
  ]
}
```

### Limpiar Caché del Navegador

Después de un deploy, los usuarios pueden necesitar:
- `Ctrl + F5` (Windows/Linux)
- `Cmd + Shift + R` (Mac)

O configurar un CloudFront para invalidación automática.

### Build Local para Pruebas

```bash
cd frontend

# Development
npm start

# Production build local
npm run build:prod

# Servir build localmente
npx http-server dist/pqrs-frontend/browser -p 8080
```

---

## 🗄️ Base de Datos

### Conexión Directa (Local)

**Credenciales:**
- **Host:** `softone-db.ccvomgoayzyt.us-east-1.rds.amazonaws.com`
- **Puerto:** `5432`
- **Usuario:** `dbadmin`
- **Contraseña:** `TuPassSeguro123!`
- **Base de datos:** `postgres`

**Opción 1: PostgreSQL Client (psql)**
```bash
# Configurar variable de entorno para contraseña
export PGPASSWORD='TuPassSeguro123!'

# Conectar a la base de datos
psql -h softone-db.ccvomgoayzyt.us-east-1.rds.amazonaws.com \
     -U dbadmin \
     -d postgres \
     -p 5432

# O usar URL de conexión completa (escapar caracteres especiales)
psql "postgresql://dbadmin:TuPassSeguro123\!@softone-db.ccvomgoayzyt.us-east-1.rds.amazonaws.com:5432/postgres"
```

**Opción 2: DBeaver / pgAdmin / TablePlus**
```
Host: softone-db.ccvomgoayzyt.us-east-1.rds.amazonaws.com
Port: 5432
Database: postgres
Username: dbadmin
Password: TuPassSeguro123!
SSL: Prefer (opcional)
```

**Consultas de ejemplo:**
```sql
-- Listar tablas
\dt

-- Ver entidades
SELECT id, name, code, nit FROM entities;

-- Contar usuarios por entidad
SELECT e.name, COUNT(u.id) as total_users 
FROM entities e 
LEFT JOIN users u ON u.entity_id = e.id 
GROUP BY e.id, e.name;

-- Ver datos PDM
SELECT COUNT(*) FROM pdm_productos;
SELECT COUNT(*) FROM pdm_actividades;
```

**Security Group configurado:**
- IP autorizada: `190.0.241.218/32`
- Security Group ID: `sg-0028de7003bcbc156`

**⚠️ Nota de seguridad:** Si tu IP pública cambia, deberás actualizar el Security Group:
```bash
# Obtener tu IP actual
MY_IP=$(curl -s https://api.ipify.org)

# Actualizar Security Group
aws ec2 authorize-security-group-ingress \
  --group-id sg-0028de7003bcbc156 \
  --protocol tcp \
  --port 5432 \
  --cidr $MY_IP/32
```

### Conexión desde Backend (Elastic Beanstalk)
```bash
cd backend
eb ssh softone-backend-useast1

# Dentro de la instancia
export PGPASSWORD='TuPassSeguro123!'
psql -h softone-db.ccvomgoayzyt.us-east-1.rds.amazonaws.com -U dbadmin -d postgres
```

### Backups

Los backups automáticos están configurados en RDS:
- Retención: 7 días
- Ventana: 05:00-06:00 UTC (00:00-01:00 Colombia)

```bash
# Crear snapshot manual
aws rds create-db-snapshot \
  --db-instance-identifier softone-db \
  --db-snapshot-identifier softone-manual-$(date +%Y%m%d-%H%M%S)

# Listar snapshots
aws rds describe-db-snapshots \
  --db-instance-identifier softone-db
```

### Auto-Shutdown RDS (ahorro de costos)

Lambda configurada para:
- **Apagar:** 22:00 hora Colombia (03:00 UTC siguiente día)
- **Encender:** 08:00 hora Colombia (13:00 UTC)

**Gestión manual:**
```bash
# Detener RDS
aws rds stop-db-instance --db-instance-identifier softone-db

# Iniciar RDS
aws rds start-db-instance --db-instance-identifier softone-db
```

---

## 📊 Monitoreo y Logs

### CloudWatch Logs

Backend logs están en:
- `/aws/elasticbeanstalk/softone-backend-useast1/var/log/web.stdout.log`
- `/aws/elasticbeanstalk/softone-backend-useast1/var/log/nginx/access.log`

```bash
# Ver logs desde CLI
eb logs softone-backend-useast1

# Logs de las últimas 2 horas
eb logs softone-backend-useast1 --log-group /aws/elasticbeanstalk/... --stream
```

### Métricas

Desde AWS Console > CloudWatch > Dashboards, monitorear:
- CPU Utilization
- Network In/Out
- Request Count
- HTTP 4xx/5xx
- Database Connections

### Alertas Configuradas

**Budget Alert:**
- $24/mes con notificaciones al 80% ($19.20) y 100%
- Email: configurado en AWS Budgets

**RDS Auto-Shutdown:**
- Ahorro estimado: ~50% en costos de RDS
- Cron: 22:00-08:00 Colombia (UTC-5)

---

## 🔧 Troubleshooting

### Backend no responde

```bash
# 1. Verificar estado del ambiente
cd backend
eb status softone-backend-useast1

# 2. Ver logs recientes
eb logs softone-backend-useast1 | tail -100

# 3. Health check
curl https://softone-backend-useast1.eba-epvnmbmk.us-east-1.elasticbeanstalk.com/api/health

# 4. Reiniciar servicio
eb ssh --command "sudo systemctl restart web.service"

# 5. Si persiste, redesplegar
eb deploy softone-backend-useast1
```

### Frontend con 404 en rutas

Verificar configuración S3:
```bash
aws s3api get-bucket-website --bucket softone360-frontend-useast1
```

Debe mostrar:
```json
{
  "IndexDocument": {
    "Suffix": "index.html"
  },
  "ErrorDocument": {
    "Key": "index.html"
  }
}
```

Si no está configurado:
```bash
aws s3 website s3://softone360-frontend-useast1/ \
  --index-document index.html \
  --error-document index.html
```

### Base de datos no conecta

```bash
# 1. Verificar estado RDS
aws rds describe-db-instances --db-instance-identifier softone-db \
  --query 'DBInstances[0].DBInstanceStatus'

# 2. Si está "stopped", iniciar
aws rds start-db-instance --db-instance-identifier softone-db

# 3. Verificar security group (debe permitir 5432 desde EB y tu IP)
aws ec2 describe-security-groups --group-ids sg-0028de7003bcbc156 \
  --query 'SecurityGroups[0].IpPermissions'

# 4. Verificar tu IP actual
curl -s https://api.ipify.org

# 5. Agregar tu IP si cambió
MY_IP=$(curl -s https://api.ipify.org)
aws ec2 authorize-security-group-ingress \
  --group-id sg-0028de7003bcbc156 \
  --protocol tcp \
  --port 5432 \
  --cidr $MY_IP/32

# 6. Test de conexión con timeout
timeout 5 bash -c "cat < /dev/null > /dev/tcp/softone-db.ccvomgoayzyt.us-east-1.rds.amazonaws.com/5432" \
  && echo "✅ Puerto 5432 accesible" \
  || echo "❌ No se puede conectar al puerto 5432"

# 7. Test desde backend
cd backend
eb ssh softone-backend-useast1
nc -zv softone-db.ccvomgoayzyt.us-east-1.rds.amazonaws.com 5432
```

### Eliminar acceso desde IP específica

Si necesitas revocar acceso desde una IP:
```bash
# Listar reglas actuales
aws ec2 describe-security-groups --group-ids sg-0028de7003bcbc156 \
  --query 'SecurityGroups[0].IpPermissions[?FromPort==`5432`]'

# Revocar acceso desde IP específica
aws ec2 revoke-security-group-ingress \
  --group-id sg-0028de7003bcbc156 \
  --protocol tcp \
  --port 5432 \
  --cidr 190.0.241.218/32
```

### Error 500 en endpoint específico

```bash
# Ver logs en tiempo real
cd backend
eb logs softone-backend-useast1 | grep -A 5 -B 5 "ERROR"

# O acceder por SSH y ver directamente
eb ssh softone-backend-useast1
sudo tail -f /var/log/web.stdout.log | grep ERROR
```

### CORS errors en frontend

Verificar configuración CORS en `backend/app/main.py`:
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://softone360-frontend-useast1.s3-website-us-east-1.amazonaws.com",
        "http://localhost:4200"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

## 💰 Costos y Optimización

### Costos Actuales Estimados

#### Año 1 (Free Tier activo)
- **EC2 (t3.micro/t4g.micro):** Free Tier (750 hrs/mes)
- **RDS (db.t3.micro):** Free Tier (750 hrs/mes) + Auto-shutdown 50% = ~$0
- **S3:** Free Tier (5 GB storage, 20k GET) + ~$0.50/mes
- **Data Transfer:** Free Tier (15 GB) + ~$0.38/mes
- **Total:** ~$0.88/mes

#### Post-Free Tier (año 2+)
- **EC2:** $6.52/mes (t3.micro 24/7)
- **RDS:** $7.67/mes con auto-shutdown (~50% ahorro)
- **S3 + Transfer:** ~$2.19/mes
- **Total:** ~$16.38/mes

**Presupuesto:** $24/mes con margen del 46%

### Optimizaciones Activas

1. **Auto-Shutdown RDS:** Ahorra ~$7.67/mes (50% del costo RDS)
2. **S3 Static Hosting:** Sin EC2 adicional para frontend
3. **Compresión Gzip:** Reduce transferencia de datos
4. **Cache-Control Headers:** Reduce requests repetidas
5. **Single AZ:** No multi-AZ innecesario

### Optimizaciones Futuras (opcional)

```bash
# 1. Cambiar a instancias ARM (Graviton)
# t4g.micro es 20% más barato que t3.micro
# Requiere actualizar AMI y redeploy

# 2. Reserved Instances (compromiso 1 año)
# Ahorro del 30-40% en EC2 y RDS
aws ec2 describe-reserved-instances-offerings \
  --instance-type t4g.micro

# 3. S3 Intelligent-Tiering
# Mueve automáticamente objetos antiguos a tier más barato
aws s3api put-bucket-intelligent-tiering-configuration \
  --bucket softone360-frontend-useast1 \
  --id "OptimizeCosts" \
  --intelligent-tiering-configuration file://tiering-config.json

# 4. CloudFront (opcional, añade costo pero mejora performance)
# ~$1/mes para bajo tráfico
# Mejora latencia global y permite HTTPS custom
```

### Monitoreo de Costos

```bash
# Ver costos del mes actual
aws ce get-cost-and-usage \
  --time-period Start=$(date -u +%Y-%m-01),End=$(date -u +%Y-%m-%d) \
  --granularity MONTHLY \
  --metrics UnblendedCost

# Ver budget actual
aws budgets describe-budget \
  --account-id $(aws sts get-caller-identity --query Account --output text) \
  --budget-name SoftoneMonthlyBudget
```

---

## 📚 Recursos Adicionales

### URLs del Sistema
- **Frontend:** http://softone360-frontend-useast1.s3-website-us-east-1.amazonaws.com
- **Backend:** http://softone-backend-useast1.eba-epvnmbmk.us-east-1.elasticbeanstalk.com
- **API Docs:** http://softone-backend-useast1.eba-epvnmbmk.us-east-1.elasticbeanstalk.com/docs

### Documentación Relacionada
- [MIGRATION_USEAST1_COMPLETE.md](./MIGRATION_USEAST1_COMPLETE.md) - Detalles de migración
- [README.md](./README.md) - Arquitectura del proyecto
- [AWS Elastic Beanstalk Docs](https://docs.aws.amazon.com/elasticbeanstalk/)
- [AWS S3 Static Website Hosting](https://docs.aws.amazon.com/AmazonS3/latest/userguide/WebsiteHosting.html)

### Contactos y Soporte
- **Repositorio:** https://github.com/largoMiguel/softone360
- **AWS Account ID:** (ver `aws sts get-caller-identity`)
- **Región:** us-east-1

---

## 🔐 Seguridad

### Variables Sensibles
Nunca commitear:
- `DATABASE_URL`
- `JWT_SECRET_KEY`
- AWS credentials
- Passwords

Usar AWS Secrets Manager o EB Environment Properties.

### Acceso a Producción
```bash
# Verificar identidad actual
aws sts get-caller-identity

# Listar ambientes EB disponibles
eb list

# Asegurarse de estar en el ambiente correcto antes de deploy
eb use softone-backend-useast1
```

### Backups Críticos
- **Código:** GitHub (main branch protegida)
- **Base de datos:** RDS automated backups (7 días) + snapshots manuales
- **Configuración:** `.ebextensions/` y scripts de deploy versionados

---

**Última revisión:** 2025-11-07  
**Próxima revisión:** 2025-12-07 (mensual)
