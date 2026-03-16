# 🔍 Auditoría de Costos y Activos AWS — Softone360
**Fecha:** 16 de marzo de 2026  
**Cuenta AWS:** `119538925169`  
**Región principal:** `us-east-1` (N. Virginia)

---

## 1. 📦 Inventario Completo de Activos AWS

### 1.1 Compute

| Recurso | ID / Nombre | Tipo | Estado | Costo Est./mes |
|---------|-------------|------|--------|----------------|
| Elastic Beanstalk App | `softone360` | Python/Flask | ✅ Activo | — |
| EB Environment (backend) | `softone-backend-useast1` | EC2 `t3.micro` | ✅ Activo | ~$7.49 |
| EB Environment (antiguo) | `softone-backend-prod` | EC2 (us-west-1) | ⚠️ A eliminar | +$7.49 si aún vive |

> URL backend: `https://api.softone360.com` → `softone-backend-useast1.eba-epvnmbmk.us-east-1.elasticbeanstalk.com`

---

### 1.2 Base de Datos (RDS)

| Recurso | Endpoint | Tipo | Estado | Costo Est./mes |
|---------|----------|------|--------|----------------|
| `softone-db` | `softone-db.ccvomgoayzyt.us-east-1.rds.amazonaws.com` | `db.t3.micro` PostgreSQL | ✅ Activo | ~$6.50 |
| Backups automáticos | Retención 7 días | — | ✅ Activo | incluido |
| Lambda RDS Controller | `softone-rds-controller` | Auto-shutdown 22:00–08:00 | ✅ Activo | ~$0 |

> **Ahorro obtenido por auto-shutdown**: ~50% del costo de RDS (~$7.00 ahorrado/mes)

---

### 1.3 Almacenamiento S3

| Bucket | Propósito | Acceso | Estado | Costo Est./mes |
|--------|-----------|--------|--------|----------------|
| `softone360.com` | Frontend principal (origen CloudFront) | Privado (via CF) | ✅ Activo | ~$0.05 |
| `softone360-frontend-useast1` | Frontend legacy (website hosting directo) | Público | ⚠️ Posible duplicado | ~$0.03 |
| `softone360-pqrs-archivos` | Archivos PQRS + fotos asistencia | Público parcial (`/asistencia/*`) | ✅ Activo | ~$0.10 |
| `softone360-humano-photos` | Fotos control de asistencia | Público parcial (`/asistencia/*`) | ✅ Activo | ~$0.10 |
| `softone-pdm-evidencias` | Evidencias PDM (imágenes migraciones) | ⚠️ Público total (`/*`) | ✅ Activo | ~$0.15 |
| `softone-pdm-informes` | Informes PDM generados | ⚠️ Público total (`/*`) | ✅ Activo | ~$0.10 |

> **Total S3 estimado:** ~$0.53/mes (storage + requets GET/PUT)

---

### 1.4 CDN / Entrega de Contenido

| Recurso | ID | Dominios | Estado | Costo Est./mes |
|---------|----|----------|--------|----------------|
| CloudFront Distribution | `E3OH65AY982GZ5` | `softone360.com`, `www.softone360.com` | ✅ Activo | ~$1.00 |
| ACM Certificate | `e71bcd46-...` | `softone360.com`, `www.softone360.com` | ✅ Activo | **$0** (gratuito con CF) |

---

### 1.5 DNS y Dominio

| Recurso | Detalles | Costo Est./mes |
|---------|----------|----------------|
| Route 53 Hosted Zone | `Z05593881FHTGORGS0VRF` — `softone360.com` | $0.50 |
| Route 53 DNS Queries | ~1M queries/mes est. | ~$0.40 |
| Dominio `softone360.com` | Registrado en Squarespace (DNS apunta a Route 53) | Ver factura Squarespace |

> **Total Route 53:** ~$0.90/mes

---

### 1.6 Seguridad e IAM

| Recurso | Detalle | Costo Est./mes |
|---------|---------|----------------|
| Secrets Manager | `softone/db/credentials` | $0.40 |
| Security Group RDS | `sg-0028de7003bcbc156` | $0 |
| Security Group EB | `sg-02c3c9aba42cda46e` | $0 |
| IAM Roles/Policies | EB instance role, OIDC CI/CD | $0 |

---

### 1.7 Monitoreo y Email

| Recurso | Detalle | Costo Est./mes |
|---------|---------|----------------|
| CloudWatch Logs | Logs EB: `/aws/elasticbeanstalk/...` | ~$0.50 |
| AWS Budgets | Límite $24/mes, alertas 80%/100% | $0 |
| AWS SES (Producción) | Email desde `sistemas@chiquiza-boyaca.gov.co` | ~$0.10 |

---

## 2. 💰 Costos Reales (Factura AWS Febrero 2026)

> ⚠️ **Datos obtenidos directamente de AWS Billing — Febrero 2026**

### 2.1 Factura Real vs Estimado

| Servicio AWS | Costo Real (Feb 2026) | Costo Estimado | Diferencia |
|--------------|----------------------|----------------|------------|
| **Amazon Elastic Load Balancing** | **$16.81** | $0 | 🔴 +$16.81 |
| **Amazon RDS** | **$12.30** | $6.50 | 🔴 +$5.80 |
| **Amazon VPC (NAT Gateway)** | **$10.16** | $0 | 🔴 +$10.16 |
| **Amazon EC2 - Compute** | **$7.00** | $7.49 | ✅ -$0.49 |
| **Amazon Route 53** | **$0.51** | $0.90 | ✅ -$0.39 |
| **Otros** (S3, CF, SES, CW) | **$1.31** | $2.53 | ✅ -$1.22 |
| | **TOTAL REAL: $48.09** | **Estimado: $17.87** | **🔴 +$30.22** |

### 2.2 Exceso vs Presupuesto

```
Presupuesto mensual:         $24.00
Costo real (febrero 2026):   $48.09
────────────────────────────────────
EXCESO SOBRE PRESUPUESTO:   +$24.09  (200% del presupuesto — DOBLE)
```

### 2.3 Análisis de los 3 Costos Inesperados

#### 🔴 1. Elastic Load Balancer — $16.81/mes (MAYOR PROBLEMA)
El entorno Elastic Beanstalk `softone-backend-useast1` está configurado como **Multi-Instance con Application Load Balancer**, no como Single Instance. Para una aplicación con tráfico bajo, esto es innecesario.
- ALB idle: ~$16/mes solo por existir
- **Solución**: Convertir a Single Instance (sin LB)
- **Ahorro**: ~$16.81/mes

#### 🔴 2. Amazon VPC — $10.16/mes (IPv4 PÚBLICAS EN USO)
El costo VPC de $10.16 ha sido identificado exactamente:
- **Tipo de uso:** `USE1-PublicIPv4:InUseAddress` — AWS cobra $0.005/hora por **cada dirección IPv4 pública en uso** desde el 1 de febrero de 2024
- Un Classic Load Balancer + la instancia EC2 del backend usan al menos **2 IPs públicas** = ~$3.60/IP/mes × 2 = $7.20 (más IPs adicionales por Multi-AZ)
- Esto está directamente ligado al CLB en modo LoadBalanced

**La solución es la misma que para el CLB:** Convertir a **Single Instance** elimina el LB y reduce las IPs públicas a 1 (solo la instancia), reduciendo este costo de $10.16 a ~$3.60/mes.

> **Ahorro combinado al pasar a Single Instance:** ALB $16.81 + VPC $10.16 = **~$26.97/mes**

#### 🔴 3. RDS — $12.30/mes (AUTO-SHUTDOWN NO FUNCIONA)
El valor esperado con auto-shutdown 12h/día era ~$6.50. El costo real $12.30 sugiere que:
- La Lambda `softone-rds-controller` puede estar fallando silenciosamente
- O el RDS fue iniciado manualmente y no se volvió a apagar
- **Solución**: Verificar logs de la Lambda y forzar el auto-shutdown

---

## 3. ⚠️ Alertas de Costos — Recursos a Eliminar Urgente

### 3.1 Application Load Balancer (ALB) — ELIMINAR
El ALB está corriendo aunque el tráfico no lo justifica. Para convertir a Single Instance:
```bash
# Opción A: Desde AWS Console
# EB Console → softone-backend-useast1 → Configuration → Capacity
# → Environment type: Single instance

# Opción B: Desde CLI
eb config softone-backend-useast1
# Cambiar EnvironmentType: SingleInstance
```
> **Ahorro: ~$16.81/mes**

### 3.2 IPv4 Públicas en Uso — ELIMINAR con el LB
El costo VPC **confirmado** viene de `USE1-PublicIPv4:InUseAddress`. Al eliminar el CLB y pasar a Single Instance, el número de IPs públicas cae de ~3 a 1.
- No hay NAT Gateways activos (verificado ✅)
- No hay Elastic IPs sin uso (verificado ✅)
- El costo es inherente al modo Load-Balanced: **se resuelve al pasar a Single Instance**

> **Este punto NO requiere acción independiente — se resuelve con el punto 3.1**

### 3.3 Lambda RDS Auto-Shutdown — VERIFICAR
```bash
# Ver últimas ejecuciones de la Lambda
aws logs tail /aws/lambda/softone-rds-controller --since 7d --region us-east-1

# Ver estado actual de RDS
aws rds describe-db-instances \
  --db-instance-identifier softone-db \
  --query 'DBInstances[0].DBInstanceStatus' \
  --region us-east-1

# Forzar apagado manual si está ON fuera de horario
aws rds stop-db-instance --db-instance-identifier softone-db --region us-east-1
```
> **Ahorro si se corrige: ~$5-6/mes adicional**

### 3.4 EB Environment us-west-1 (Legacy)
Si `softone-backend-prod` en us-west-1 sigue activo, agregar al plan de eliminación.

### 3.5 Proyección Post-Correcciones

| Corrección | Ahorro/mes |
|-----------|-----------|
| Pasar EB a Single Instance (elimina CLB + IPs extras) | -$26.97 |
| Corregir Lambda auto-shutdown | -$5.80 |
| **Total potencial ahorro** | **-$32.77** |
| **Costo proyectado** | **~$15.32/mes** |

> ✅ Costo proyectado post-corrección: **$15.32/mes** (dentro del presupuesto $24)

---

## 4. 🚨 Hallazgos de Seguridad (Con Impacto Potencial en Costos)

### 🔴 CRÍTICO — Credenciales Expuestas en Repositorio

**Archivo:** `portal/env.production`

Se encontraron credenciales AWS en texto plano:
```
AWS_ACCESS_KEY_ID=[REDACTED_KEY_ID]
AWS_SECRET_ACCESS_KEY=[REDACTED_SECRET_KEY]
```

**Riesgo:** Si este archivo está en el repositorio Git (incluso en historia), un actor malicioso puede:
- Crear recursos AWS costosos (minar criptomonedas, etc.)
- Acceder a todos los datos del sistema
- Generar costos de miles de dólares sin saberlo

**Acción inmediata requerida:**
1. Rotar esas claves AWS AHORA en IAM Console
2. Revocar las claves actuales
3. Eliminar el archivo del historial Git con `git filter-repo`
4. Usar AWS Secrets Manager o variables de entorno del sistema en lugar de archivos

---

### 🔴 CRÍTICO — Contraseña de BD en Texto Plano

**Archivos:** `DEPLOYMENT_GUIDE.md`, `MIGRATION_USEAST1_COMPLETE.md`, `CONFIGURACION_RDS_ACCESO_DIRECTO.md`, `env.production`

```
DATABASE_URL=postgresql://dbadmin:TuPassSeguro123!@...
```

**Acción:**
1. Cambiar la contraseña de RDS inmediatamente
2. Actualizar solo en Secrets Manager (`softone/db/credentials`)
3. Eliminar de todos los archivos Markdown y del historial Git

---

### 🟠 ALTO — S3 CORS Demasiado Permisivo

**Archivo:** `s3-cors-config.json`
```json
"AllowedOrigins": ["*"],
"AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"]
```
Cualquier sitio web puede hacer PUT/DELETE a los buckets desde el navegador.

**Acción:** Restringir `AllowedOrigins` a `["https://softone360.com", "https://www.softone360.com"]`

---

### 🟠 ALTO — Buckets S3 con Acceso Público Total

Los buckets `softone-pdm-evidencias` y `softone-pdm-informes` tienen política `Principal: "*"` sin restricción de prefijo. Cualquier URL de objeto es accesible sin autenticación.

**Acción:** Evaluar si los informes PDM deben ser públicos o generarse como URLs pre-firmadas (signed URLs) con expiración.

---

## 5. 🗑️ Recursos a Eliminar (Ahorro Potencial)

| Recurso | Región | Ahorro Est./mes |
|---------|--------|-----------------|
| EB Environment `softone-backend-prod` | us-west-1 | ~$7.49 |
| S3 Bucket `softone360-frontend-useast1` | us-east-1 | ~$0.03 |
| (Opcional) EBS Snapshots huérfanos | us-east-1 | Variable |

**Comandos para eliminar:**
```bash
# Terminar EB antiguo en us-west-1
eb terminate softone-backend-prod --region us-west-1

# Eliminar bucket S3 legacy (si ya no se usa)
aws s3 rb s3://softone360-frontend-useast1 --force
```

---

## 6. 💡 Recomendaciones de Optimización

### 6.1 Optimizaciones Ya Activas ✅
- ✅ RDS auto-shutdown (Lambda) — ahorro ~$7/mes
- ✅ AWS Budget alerta $24/mes
- ✅ Todo centralizado en us-east-1 (sin costos cross-region)
- ✅ ACM gratuito (SSL via CloudFront y EB)
- ✅ Lambda bajo free tier

### 6.2 Optimizaciones Pendientes Recomendadas

| Optimización | Ahorro Est. | Dificultad |
|--------------|------------|------------|
| Verificar tipo de EB (Single vs Load-Balanced) | $0 o $16 ahorrado | Baja |
| Eliminar recursos us-west-1 | ~$7.49/mes | Baja |
| S3 Lifecycle Rules (mover a Glacier después de 90 días) | ~$0.20/mes | Media |
| Habilitar S3 Intelligent-Tiering en `softone-pdm-evidencias` | ~$0.10/mes | Baja |
| CloudWatch Log Retention (limitar a 30 días) | ~$0.20/mes | Baja |
| Signed URLs para informes PDM (seguridad + menor exposición) | Seguridad | Media |
| Rotar claves AWS y usar IAM Roles en vez de access keys | Seguridad crítica | Media |

### 6.3 Escenario de Crecimiento

Si el número de usuarios/entidades aumenta significativamente, considerar:
- **t3.small para RDS** si hay lentitud: +$8/mes
- **Múltiples instancias EB** con Auto Scaling: +$16/mes (LB) + EC2 adicional
- **CloudFront Cache optimizado** para reducir origin hits a S3

---

## 7. 📊 Proyección de Costos 2026

| Mes | Estimado | Estado |
|-----|----------|--------|
| Febrero 2026 | **$48.09** | 🔴 Factura real — 200% del presupuesto |
| Marzo 2026 (sin cambios) | ~$48 | 🔴 Seguirá igual |
| Marzo 2026 (con correcciones) | **~$15-17** | ✅ Objetivo alcanzable |
| Abril 2026+ | ~$15-18 | ✅ Estable |

> **Acción urgente**: Eliminar ALB y NAT Gateway antes del cierre de marzo para evitar otra factura de $48.

---

## 8. ✅ Plan de Acción Prioritizado

### 🔴 URGENTE — Esta semana (detener el sangrado de $48/mes)
- [ ] **Convertir EB a Single Instance**: elimina CLB ($16.81) y reduce IPs públicas ($10.16) → **ahorra ~$26.97/mes** — Ver sección 3.1
- [ ] **Verificar Lambda auto-shutdown RDS**: ver logs CloudWatch y forzar apagado nocturno → **ahorra ~$5.80/mes**
- [ ] **CRÍTICO SEGURIDAD**: Rotar claves AWS en IAM Console — las antiguas han sido redactadas; crear nuevas y actualizar en EB (`eb setenv`)
- [ ] **CRÍTICO SEGURIDAD**: Cambiar contraseña de RDS en AWS Console — actualizar solo en Secrets Manager y en EB environment variables
- [ ] Verificar y terminar `softone-backend-prod` en us-west-1

### 🟠 Corto Plazo — Próximas 2 semanas
- [ ] Limpiar historial Git de credenciales con `git filter-repo`
- [ ] Migrar a IAM Roles en EB para acceder a S3 (eliminar `AWS_ACCESS_KEY_ID` del código)
- [ ] Configurar CloudWatch Log Retention a 30 días
- [ ] Eliminar bucket `softone360-frontend-useast1` (duplicado de `softone360.com`)

### 🟡 Mediano Plazo — Próximo mes
- [ ] S3 Lifecycle Rules (mover a Glacier después de 90 días en evidencias)
- [ ] Implementar Signed URLs para `softone-pdm-informes` (seguridad)
- [ ] Activar alerta de presupuesto adicional al 50% ($12) como aviso temprano

---

*Auditoría generada el 16 de marzo de 2026 — Softone360 / SOLUCTIONS*
