# ✅ Migración Completa a us-east-1 (Optimizado para Colombia)

## 🎯 Resumen de la Migración

Toda la infraestructura ha sido consolidada en **us-east-1 (N. Virginia)** para:
- ✅ Reducir latencia desde Colombia (~30-50ms vs ~80-120ms)
- ✅ Eliminar costos de transferencia cross-region
- ✅ Simplificar operaciones y troubleshooting
- ✅ Mantener costos bajo control (≤ $24/mes con optimizaciones)

---

## 📍 Nueva Infraestructura (us-east-1)

| Componente | URL/Endpoint | Estado |
|------------|--------------|--------|
| **Backend API** | http://softone-backend-useast1.eba-epvnmbmk.us-east-1.elasticbeanstalk.com | ✅ Activo |
| **Frontend** | http://softone360-frontend-useast1.s3-website-us-east-1.amazonaws.com | ✅ Activo |
| **Base de Datos** | softone-db.ccvomgoayzyt.us-east-1.rds.amazonaws.com:5432 | ✅ Activo |
| **CloudFront** | Pendiente verificación de cuenta | ⏳ Pendiente |

---

## 🔧 Configuración Aplicada

### Backend (Elastic Beanstalk)
- **Environment**: softone-backend-useast1
- **Región**: us-east-1
- **Instancia**: t3.micro (Free Tier)
- **Variables**:
  ```bash
  DATABASE_URL=postgresql://dbadmin:TuPassSeguro123!@softone-db.ccvomgoayzyt.us-east-1.rds.amazonaws.com:5432/postgres
  ALLOWED_ORIGINS=http://localhost:4200,http://softone360-frontend-useast1.s3-website-us-east-1.amazonaws.com
  ```

### Frontend (S3)
- **Bucket**: softone360-frontend-useast1
- **Región**: us-east-1
- **Website Hosting**: Habilitado
- **API URL**: http://softone-backend-useast1.eba-epvnmbmk.us-east-1.elasticbeanstalk.com

### Base de Datos (RDS)
- **Instancia**: softone-db
- **Acceso**: Privado (solo desde SG del backend sg-02c3c9aba42cda46e)
- **Seguridad**: ✅ Acceso público 0.0.0.0/0 **eliminado**

---

## 💰 Control de Costos Implementado

### 1. Presupuesto Mensual
- **Límite**: $24 USD/mes
- **Alertas**: 
  - 80% forecast → amadolargo@gmail.com
  - 100% real → amadolargo@gmail.com

### 2. Apagado Automático de RDS
- **Lambda**: softone-rds-controller (us-east-1)
- **Horarios**:
  - 🌙 **STOP**: 03:00 UTC (22:00 Colombia) - Todos los días
  - 🌅 **START**: 13:00 UTC (08:00 Colombia) - Todos los días
- **Ahorro estimado**: ~50% del costo de RDS (~$7.50/mes)

### 3. Estimación de Costos Mensuales

| Servicio | Config | Primer Año | Después |
|----------|--------|------------|---------|
| EC2 (EB) | t3.micro | $0 | ~$8 |
| RDS (con apagado) | db.t3.micro 12h/día | $0 | ~$7.50 |
| S3 | <1GB | $0.03 | $0.03 |
| Lambda | <1M invocaciones | $0 | $0 |
| Secrets Manager | 1 secreto | $0.40 | $0.40 |
| Data Transfer | ~5GB/mes | $0.45 | $0.45 |
| **TOTAL** | | **~$0.88/mes** | **~$16.38/mes** |

✅ **Meta de $24/mes alcanzada**

---

## 🔒 Mejoras de Seguridad

1. ✅ RDS solo accesible desde VPC (security group del backend)
2. ✅ Acceso público a RDS eliminado
3. ✅ Base de datos y backend en la misma región/VPC
4. ⏳ CloudFront con HTTPS (pendiente verificación de cuenta)

---

## 📋 Recursos Antiguos (us-west-1) - Para Eliminar

Estos recursos ya NO se usan y deben eliminarse para evitar costos:

### Backend
```bash
cd /Users/largo/Documents/SOLUCTIONS/backend
eb terminate softone-backend-prod --region us-west-1
```

### Frontend
```bash
aws s3 rb s3://softone360-frontend-prod --region us-west-1 --force
```

### Application (opcional, si no hay otros environments)
```bash
aws elasticbeanstalk delete-application \
  --application-name softone360 \
  --region us-west-1
```

---

## 🚀 Comandos de Despliegue

### Backend
```bash
cd /Users/largo/Documents/SOLUCTIONS/backend
eb deploy  # Ya apunta a softone-backend-useast1
```

### Frontend
```bash
cd /Users/largo/Documents/SOLUCTIONS/frontend

# Opción 1: Script automatizado
./deploy-to-s3.sh

# Opción 2: Manual
npm run build -- --configuration=production
cd dist/pqrs-frontend/browser
aws s3 sync . s3://softone360-frontend-useast1/ --delete
```

---

## 🔄 Ajustar Horarios de Apagado RDS (Opcional)

Si deseas cambiar las ventanas de apagado/encendido:

```bash
# Ejemplo: Apagar a las 21:00 Colombia (02:00 UTC)
aws events put-rule \
  --name stop-softone-db-nightly \
  --schedule-expression "cron(0 2 * * ? *)" \
  --region us-east-1

# Ejemplo: Encender a las 07:00 Colombia (12:00 UTC)
aws events put-rule \
  --name start-softone-db-morning \
  --schedule-expression "cron(0 12 * * ? *)" \
  --region us-east-1
```

O para apagar SOLO en fines de semana:
```bash
# Apagar viernes 22:00 Colombia (sábado 03:00 UTC)
aws events put-rule \
  --name stop-softone-db-weekend \
  --schedule-expression "cron(0 3 ? * SAT *)" \
  --region us-east-1

# Encender lunes 06:00 Colombia (11:00 UTC)
aws events put-rule \
  --name start-softone-db-monday \
  --schedule-expression "cron(0 11 ? * MON *)" \
  --region us-east-1
```

---

## 📊 Monitoreo

### Ver estado del presupuesto
```bash
aws budgets describe-budget \
  --account-id 119538925169 \
  --budget-name softone360-monthly
```

### Ver logs de Lambda (RDS controller)
```bash
aws logs tail /aws/lambda/softone-rds-controller \
  --region us-east-1 \
  --follow
```

### Ver estado de RDS
```bash
aws rds describe-db-instances \
  --db-instance-identifier softone-db \
  --region us-east-1 \
  --query 'DBInstances[0].[DBInstanceStatus,Endpoint.Address]'
```

---

## ⏭️ Próximos Pasos

1. **CloudFront (cuando AWS habilite la cuenta)**:
   ```bash
   aws cloudfront create-distribution \
     --distribution-config file:///tmp/cloudfront-useast1.json
   ```
   - Agrega el dominio CloudFront a CORS del backend
   - Actualiza `environment.prod.ts` con https://d*.cloudfront.net
   - Rebuild y redeploy frontend

2. **Eliminar recursos de us-west-1**:
   - Terminar `softone-backend-prod`
   - Eliminar bucket `softone360-frontend-prod`

3. **Dominio propio (opcional)**:
   - Registrar dominio en Route 53
   - Solicitar certificado ACM en us-east-1
   - Configurar alias A en Route 53 → CloudFront

4. **Monitoreo avanzado**:
   - CloudWatch Alarms para CPU, memoria, errores 5XX
   - CloudWatch Logs Insights para analizar peticiones
   - AWS Cost Explorer para tracking de costos diarios

---

## ✅ Checklist de Verificación

- [x] Backend funcionando en us-east-1
- [x] Frontend funcionando en us-east-1
- [x] Base de datos accesible solo desde backend
- [x] Acceso público a RDS eliminado
- [x] Presupuesto de $24/mes configurado
- [x] Apagado automático de RDS programado
- [x] Alertas de costos a amadolargo@gmail.com
- [ ] CloudFront habilitado (pendiente verificación AWS)
- [ ] Recursos antiguos de us-west-1 eliminados
- [ ] Dominio propio configurado (opcional)

---

## 🆘 Soporte

**URLs de Prueba**:
- Backend Health: http://softone-backend-useast1.eba-epvnmbmk.us-east-1.elasticbeanstalk.com/health
- Backend Docs: http://softone-backend-useast1.eba-epvnmbmk.us-east-1.elasticbeanstalk.com/docs
- Frontend: http://softone360-frontend-useast1.s3-website-us-east-1.amazonaws.com

**Contacto**:
- Alertas de presupuesto: amadolargo@gmail.com
- Región principal: us-east-1
- Cuenta AWS: 119538925169
