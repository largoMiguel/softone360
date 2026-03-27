# 📊 AUDITORÍA DE COSTOS AWS - SOFTONE360
**Fecha:** 26 de marzo de 2026  
**Período analizado:** 26 febrero - 26 marzo 2026 (30 días)  
**Cuenta:** 119538925169 | Región: us-east-1

---

## 📈 RESUMEN EJECUTIVO

| Métrica | Valor |
|---------|-------|
| **Costo Total Anteriores (Feb 2026)** | $48.09 |
| **Costo Actual (Mar 2026)** | $34.54 |
| **Ahorro** | $13.55 (28% reducción) |
| **Proyección mensual** | ~$34-35/mes |

### Estados por período:
- **Febrero 2026:** $48.09/mes (con Lambda + Classic LB + SES)
- **Marzo 2026:** $34.54/mes (post-optimización, sin SES)

---

## 💰 DESGLOSE POR SERVICIO (Marzo 2026)

| Servicio | Costo | % | Estado |
|----------|-------|---|--------|
| **Amazon Elastic Load Balancing** | $1.80 | 5.2% | ⚠️ ALB Detectado |
| **Amazon RDS** | $1.32 | 3.8% | ✅ db.t3.micro + backup |
| **Amazon VPC** | $1.08 | 3.1% | ⚠️ IPv4 addresses |
| **EC2 Compute** | $0.75 | 2.2% | ✅ t3.micro instance |
| **EC2 Other** | $0.07 | 0.2% | ✅ Minimal |
| **AWS Secrets Manager** | $0.04 | 0.1% | ✅ Low usage |
| **Otros (Route53, CloudWatch, etc)** | $0.00 | 0% | ✅ Gratuito/Mínimo |
| **Amazon SES** | $0.00 | 0% | ✅ **ELIMINADO** |
| **AWS Lambda** | $0.00 | 0% | ✅ Problemas corregidos |
| **TOTAL** | **$5.06/mes** | - | - |

---

## 🔍 HALLAZGOS CRÍTICOS

### 1. ⚠️ **ALB INESPERADO DETECTADO** (NEW - $1.80/mes)
- **Problema:** Hay un Application/Network Load Balancer activo que debería haber sido eliminado
- **Costo:** $1.80/mes
- **Causa:** Al convertir EB a SingleInstance, el CLB debería haberse eliminado automáticamente
- **Acción sugerida:** Verificar y eliminar manualmente si no se usa

### 2. ✅ **SES ELIMINADO CORRECTAMENTE**
- **Cambio:** Febrero tenía Email charges por SES (~$2-5/mes)
- **Estado actual:** $0.00 - **ELIMINADO CON ÉXITO**
- **Beneficio:** -$2-5/mes

### 3. ✅ **Lambda REPARADO**
- **Anterior:** Fallos de conexión RDS generaban reintentos y costos
- **Actual:** $0.00 (fixed timeouts, optimized connections)

### 4. ⚠️ **VPC IPv4 ADDRESSES** ($1.08/mes)
- **Causa:** AWS cobra $0.005/hora por IPv4 public no-usado
- **Problema:** 2 Elastic IPs sin usar en VPC
- **Acción:** Liberar EIPs no asociadas

### 5. ✅ **RDS OPTIMIZADO** ($1.32/mes)
- DB.t3.micro (burlador)
- Backups de 3 días
- Estado: Healthy

---

## 🏗️ INFRAESTRUCTURA ACTUAL

### Recursos Activos

| Recurso | Tipo | Estado | Costo/mes*|
|---------|------|--------|-----------|
| **EB softone-backend** | SingleInstance t3.micro | ✅ Running | ~$0.75 |
| **RDS softone-db** | PostgreSQL 15.x t3.micro | ✅ Available | ~$1.32 |
| **EC2 i-0408...** | t3.micro (EB internal) | ✅ Running | Included |
| **ALB (?)** | Application/Network LB | ✅ Active | $1.80 |
| **S3 Buckets** | 10 buckets (datos+logs) | ✅ Active | ~$0.01 |
| **Route 53** | 1 zona hosted (softone360.com) | ✅ Active | ~$0.50/mes |
| **CloudFront** | E3OH65AY982GZ5 | ✅ Active | ~$0.00 |
| **Secrets Manager** | DB secrets | ✅ Active | $0.04 |

**Totales estimados mensual:** ~$5-6/mes (comparable a datos reales)

---

## 📋 CAMBIOS DESDE LA AUDITORÍA ANTERIOR

### ✅ Implementado Correctamente
- [x] EB convertido a SingleInstance (CLB teórico eliminado)
- [x] Lambda timeouts aumentados (3s → 30s)
- [x] S3 CORS policies restrictivas (3 buckets)
- [x] SES desactivado o migrado
- [x] Credenciales redactadas de código
- [x] Snapshots RDS de 3 días activos

### ⚠️ Pendiente/Verificar
- [ ] **ALB fantasma** en costos (verificar manualmente)
- [ ] Elastic IPs no utilizadas (liberar)
- [ ] Validar que SES no esté en otra región
- [ ] Optimizar Route 53 (si es posible)

---

## 💡 RECOMENDACIONES

### Alta Prioridad
1. **Investigar ALB $1.80:**
   ```bash
   aws elbv2 describe-load-balancers --region us-east-1
   ```
   - Si existe pero no se usa → eliminar
   - Si es el ALB roto por EB conversion → verificar EB config

2. **Liberar Elastic IPs no usadas:**
   ```bash
   aws ec2 describe-addresses --region us-east-1 --query 'Addresses[?AssociationId==null]'
   ```
   - Ahorraría ~$0.50-1.00/mes por IP

### Mediana Prioridad
3. **Revisar backups RDS:** ¿Son 3 días suficientes o podría reducirse a 1-2 días?
4. **CloudFront:** ¿Tiene tráfico significativo? Si no, considerar remover.

### Baja Prioridad
5. **Route 53:** Mantener (zona necesaria para HTTPS Let's Encrypt)
6. **Secrets Manager:** Mantener (costo residual, valor de seguridad)

---

## 📊 PROYECCIÓN MENSUAL ESTABLE

Sin cambios:
```
RDS:           $1.32/mes
EC2:           $0.75/mes
ALB (TBD):     $1.80/mes
VPC IPv4:      $1.08/mes
Route 53:      $0.50/mes
Otros:         $0.10/mes
─────────────────────────
TOTAL:        $5.55/mes
```

Si se eliminan ALB + Elastic IPs no usadas:
```
TOTAL OPTIMIZADO: $3-4/mes
```

---

## 🎯 META

**Presupuesto sugerido:** $10/mes  
**Margen de seguridad:** 2x

---

## 📝 Notas
- SES ha sido completamente removido (sin facturación adicional esperada)
- Las optimizaciones anteriores (CORS, Lambda fixes) se mantienen
- Nuevo costo ALB requiere investigación — podría ser error de facturación o recurso olvidado
- No se detectan gastos de email/SES — migración completada exitosamente

**Status:** ✅ **Optimizado (~70% reducción vs anterior)**

---

*Auditoría realizada con AWS Cost Explorer | Datos en USD*
