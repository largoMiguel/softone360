# 🚀 Guía Rápida: Implementación de Correos por Entidad

## ✅ ¿Qué se implementó?

El sistema ahora envía correos **desde el email específico de cada entidad** cuando:
1. Se radica una PQRS
2. Se responde una PQRS

## 📋 Pasos para activar

### 1️⃣ Configurar correos en AWS SES

**Opción A: Verificar dominio completo (Recomendado)**
```
Si tienes acceso al DNS de gov.co o subdominios:
1. Ve a AWS SES → Verified identities → Create identity
2. Selecciona "Domain"
3. Ingresa: chiquiza-boyaca.gov.co (o tu subdominio)
4. Agrega los registros DNS que AWS te proporcione
5. Espera la verificación (hasta 72 horas)

✅ Ventaja: Puedes enviar desde CUALQUIER correo de ese dominio
```

**Opción B: Verificar correos individuales**
```
Si NO tienes acceso al DNS:
1. Ve a AWS SES → Verified identities → Create identity
2. Selecciona "Email address"
3. Ingresa: contacto@chiquiza-boyaca.gov.co
4. Revisa el correo de verificación y haz click en el enlace
5. Repite para cada entidad

⚠️ Desventaja: Debes verificar cada correo manualmente
```

### 2️⃣ Salir del Sandbox (Producción)

```
1. AWS SES → Account dashboard → Request production access
2. Llenar formulario:
   - Mail type: Transactional
   - Use case: Sistema de PQRS para entidades gubernamentales
3. Enviar solicitud
4. Esperar aprobación (24-48 horas)
```

### 3️⃣ Configurar variables de entorno

Edita tu archivo `.env`:

```bash
# AWS SES Configuration
AWS_SES_REGION=us-east-1
EMAIL_FROM=noreply@sistema-pqrs.gov.co  # Correo por defecto (fallback)
EMAIL_FROM_NAME=Sistema PQRS

# AWS Credentials (solo si NO usas IAM Roles)
# AWS_ACCESS_KEY_ID=tu-key
# AWS_SECRET_ACCESS_KEY=tu-secret
```

Si despliegas en Elastic Beanstalk:
```bash
eb setenv AWS_SES_REGION=us-east-1 \
         EMAIL_FROM=noreply@sistema-pqrs.gov.co \
         EMAIL_FROM_NAME="Sistema PQRS"
```

### 4️⃣ Configurar IAM Role (si usas Elastic Beanstalk)

```
1. Ve a IAM → Roles
2. Busca: aws-elasticbeanstalk-ec2-role
3. Adjunta la política: AmazonSESFullAccess
   O crea una custom con permisos mínimos:
   {
     "Effect": "Allow",
     "Action": ["ses:SendEmail", "ses:SendRawEmail"],
     "Resource": "*"
   }
```

### 5️⃣ Vincular correos a cada entidad

**Opción 1: SQL directo**
```sql
UPDATE entities 
SET email = 'contacto@chiquiza-boyaca.gov.co' 
WHERE code = 'chiquiza-boyaca';

UPDATE entities 
SET email = 'pqrs@tunja-boyaca.gov.co' 
WHERE code = 'tunja-boyaca';
```

**Opción 2: Desde la API**
```bash
PUT /api/entities/{entity_id}
{
  "email": "contacto@chiquiza-boyaca.gov.co"
}
```

**Opción 3: Desde el Admin Panel** (si existe interfaz)

### 6️⃣ Verificar configuración

```sql
-- Ver entidades con sus correos
SELECT name, code, email 
FROM entities;

-- Ver entidades SIN correo configurado
SELECT name, code 
FROM entities 
WHERE email IS NULL OR email = '';
```

## 🧪 Probar el sistema

### En desarrollo (Sandbox):
```
1. Verifica tu correo personal en AWS SES
2. Crea una PQRS de prueba con tu email
3. Verifica que llegue el correo de radicación
4. Responde la PQRS
5. Verifica que llegue el correo de respuesta
```

### En producción:
```
Una vez salgas del Sandbox, los correos se enviarán 
automáticamente a cualquier dirección válida.
```

## 📧 Cómo funciona

```
1. Ciudadano radica PQRS:
   → Sistema obtiene el email de la entidad
   → Envía correo DESDE: "Alcaldía de Chiquiza <contacto@chiquiza-boyaca.gov.co>"
   → Ciudadano recibe notificación de radicación

2. Secretario responde PQRS:
   → Sistema obtiene el email de la entidad
   → Envía correo DESDE: "Alcaldía de Chiquiza <contacto@chiquiza-boyaca.gov.co>"
   → Ciudadano recibe la respuesta oficial
```

## ⚠️ Importante

1. **TODOS** los correos de entidades deben estar verificados en AWS SES
2. Si una entidad NO tiene correo configurado, se usa el correo por defecto
3. El correo por defecto también debe estar verificado en SES
4. Formato recomendado: `contacto@nombre-entidad.gov.co` o `pqrs@nombre-entidad.gov.co`

## 💰 Costos

```
1,000 correos/mes   = $0.10
10,000 correos/mes  = $1.00
100,000 correos/mes = $10.00
```

Prácticamente gratis para tu caso de uso.

## 🆘 Troubleshooting

**Error: "Email address is not verified"**
→ El correo de la entidad no está verificado en AWS SES
→ Solución: Verificar el correo o dominio en AWS SES

**Los correos llegan a spam**
→ Falta configuración SPF/DKIM/DMARC
→ Solución: Verificar el dominio completo (AWS agrega automáticamente DKIM)

**Error: "Daily sending quota exceeded"**
→ Estás en Sandbox (límite 200/día)
→ Solución: Solicitar salir del Sandbox

## 📚 Documentación completa

Ver: `CONFIGURACION_EMAIL_AWS_SES.md`
