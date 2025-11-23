# Configuración de Envío de Correos con AWS SES

Este documento explica cómo configurar el envío automático de correos electrónicos cuando se radica o responde una PQRS.

## 📧 ¿Cuándo se envían correos?

El sistema envía correos automáticamente en dos momentos:

1. **Cuando se radica una PQRS**: Se envía un correo al ciudadano confirmando que su PQRS fue radicada exitosamente.
2. **Cuando se responde una PQRS**: Se envía un correo al ciudadano con la respuesta oficial.

## 🏛️ **Correos por Entidad**

**IMPORTANTE**: Cada entidad debe tener configurado su propio correo `@gov.co` en el sistema.

### ¿Cómo funciona?

- Cada entidad tiene un campo `email` en la base de datos (ej: `contacto@chiquiza-boyaca.gov.co`)
- Este correo se usa como **remitente** cuando se envían notificaciones de PQRS
- El ciudadano recibirá correos **desde el email de la entidad**, no desde un correo genérico

### Ejemplo:
```
Entidad: Alcaldía de Chiquiza
Email: contacto@chiquiza-boyaca.gov.co

Cuando un ciudadano radica una PQRS, recibe un correo desde:
"Alcaldía de Chiquiza <contacto@chiquiza-boyaca.gov.co>"
```

## 🔧 Configuración en AWS SES

### Opción 1: Verificar el dominio `gov.co` completo (RECOMENDADO)

Si todas tus entidades usan subdominios de `gov.co` (ej: `alcaldia.gov.co`, `chiquiza-boyaca.gov.co`), puedes verificar el dominio raíz o cada subdominio:

**Ventajas**:
- Una sola verificación para TODOS los subdominios (si verificas el dominio raíz)
- No necesitas verificar cada correo individual
- Puedes enviar desde cualquier correo del dominio verificado

**Pasos**:
1. Ir a AWS SES → **Verified identities** → **Create identity**
2. Seleccionar **Domain**
3. Ingresar tu dominio o subdominio:
   - Opción A: `gov.co` (requiere acceso a DNS del dominio raíz)
   - Opción B: `chiquiza-boyaca.gov.co` (requiere acceso a DNS del subdominio)
4. AWS te dará registros DNS (CNAME, TXT, DKIM, MX)
5. Agregar estos registros en tu proveedor de DNS
6. Esperar verificación (puede tomar hasta 72 horas)

Una vez verificado, podrás enviar desde:
- `contacto@chiquiza-boyaca.gov.co`
- `pqrs@chiquiza-boyaca.gov.co`
- `noreply@chiquiza-boyaca.gov.co`
- Cualquier otro correo del dominio verificado

### Opción 2: Verificar correos individuales por entidad

Si no tienes acceso al DNS o prefieres verificar correos específicos:

**Pasos**:
1. Ir a AWS SES → **Verified identities** → **Create identity**
2. Seleccionar **Email address**
3. Ingresar el correo de cada entidad (ej: `contacto@chiquiza-boyaca.gov.co`)
4. AWS enviará un correo de verificación a esa dirección
5. Hacer click en el enlace del correo para verificar
6. **Repetir para cada entidad**

**Desventajas**:
- Debes verificar cada correo manualmente
- Si una entidad cambia su correo, debes verificar el nuevo

### Paso 1: Verificar dominios/correos en AWS SES

Por defecto, AWS SES está en modo **Sandbox**, que solo permite:
- Enviar a correos verificados
- Máximo 200 correos/día
- 1 correo/segundo

Para producción, debes **solicitar salir del Sandbox**:

1. En AWS SES, ir a **Account dashboard**
2. En la sección **Sending statistics**, hacer click en **Request production access**
3. Llenar el formulario explicando tu caso de uso:
   - **Mail type**: Transactional
   - **Website URL**: URL de tu plataforma
   - **Use case description**: 
     ```
     Sistema de PQRS (Peticiones, Quejas, Reclamos y Sugerencias) para entidades 
     gubernamentales. Se envían correos transaccionales automáticos a ciudadanos 
     cuando radican una PQRS y cuando reciben respuesta oficial.
     ```
   - **Process for handling bounces/complaints**: 
     ```
     Monitoreamos bounces y complaints mediante SNS. Los correos con bounces 
     permanentes son removidos de nuestra base de datos automáticamente.
     ```
4. Enviar la solicitud
5. AWS suele aprobar en 24-48 horas

### Paso 3: Configurar credenciales SMTP (Opcional)

Si prefieres usar SMTP en lugar del SDK de boto3:

1. En AWS SES, ir a **SMTP settings**
2. Click en **Create SMTP credentials**
3. Guardar el **SMTP username** y **SMTP password**
4. Anotar el **SMTP endpoint** (ej: `email-smtp.us-east-1.amazonaws.com`)

## 📨 Correo por defecto (fallback)

Si una entidad **NO tiene** correo configurado, el sistema usa el correo por defecto configurado en `.env`:

```bash
EMAIL_FROM=noreply@sistema-pqrs.gov.co
EMAIL_FROM_NAME=Sistema PQRS
```

Este correo también debe estar verificado en AWS SES.

## 🔐 Configuración en tu aplicación

### 1. Variables de entorno (.env)

Agregar las siguientes variables en tu archivo `.env`:

```bash
# AWS SES Configuration
AWS_SES_REGION=us-east-1
EMAIL_FROM=noreply@tudominio.com
EMAIL_FROM_NAME=Sistema PQRS

# AWS Credentials (si no usas IAM roles)
AWS_ACCESS_KEY_ID=tu-access-key-id
AWS_SECRET_ACCESS_KEY=tu-secret-access-key
```

### 2. Configuración en Elastic Beanstalk

Si despliegas en AWS Elastic Beanstalk:

```bash
# Configurar variables de entorno
eb setenv AWS_SES_REGION=us-east-1 \
         EMAIL_FROM=noreply@tudominio.com \
         EMAIL_FROM_NAME="Sistema PQRS"
```

**IMPORTANTE**: No configures `AWS_ACCESS_KEY_ID` y `AWS_SECRET_ACCESS_KEY` en EB. En su lugar, usa **IAM Roles** (ver siguiente sección).

### 3. Configurar IAM Role para Elastic Beanstalk (Recomendado)

En lugar de usar credenciales hardcodeadas, usa un IAM Role:

1. Ir a **IAM** → **Roles**
2. Buscar el rol de tu Elastic Beanstalk (ej: `aws-elasticbeanstalk-ec2-role`)
3. Click en **Add permissions** → **Attach policies**
4. Buscar y agregar la política: `AmazonSESFullAccess` (o crear una custom con permisos mínimos)
5. Guardar cambios

Política custom mínima (más segura):
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ses:SendEmail",
        "ses:SendRawEmail"
      ],
      "Resource": "*"
    }
  ]
}
```

Con esto, tu aplicación en EB podrá enviar correos sin necesidad de credenciales explícitas.

## 📨 Correo de la entidad para respuestas

### Cómo vincular el correo de cada entidad

El modelo `Entity` ya tiene un campo `email` que se usa para:
- **Remitente oficial** de las respuestas de PQRS
- Correo de contacto visible para ciudadanos
- Identificación de la entidad en comunicaciones

### Configurar el correo de una entidad

**Opción 1: Desde la base de datos**
```sql
UPDATE entities 
SET email = 'contacto@chiquiza-boyaca.gov.co' 
WHERE code = 'chiquiza-boyaca';
```

**Opción 2: Desde el Admin Panel** (si tienes interfaz de gestión de entidades)

**Opción 3: Desde la API** (endpoint de actualización de entidades)

### ⚠️ Importante

1. **El correo DEBE estar verificado en AWS SES** antes de poder enviar desde él
2. **Formato recomendado**: `contacto@nombre-entidad.gov.co` o `pqrs@nombre-entidad.gov.co`
3. Si una entidad **NO tiene** correo configurado, se usa el correo por defecto del sistema

### Ejemplo completo

```plaintext
Entidad 1: Alcaldía de Chiquiza
  - Code: chiquiza-boyaca
  - Email: contacto@chiquiza-boyaca.gov.co
  - Verificado en SES: ✅

Entidad 2: Alcaldía de Tunja  
  - Code: tunja-boyaca
  - Email: pqrs@tunja-boyaca.gov.co
  - Verificado en SES: ✅

Cuando un ciudadano recibe respuesta:
  - De Chiquiza → Remitente: "Alcaldía de Chiquiza <contacto@chiquiza-boyaca.gov.co>"
  - De Tunja → Remitente: "Alcaldía de Tunja <pqrs@tunja-boyaca.gov.co>"
```

## 📨 Correo por defecto (fallback)

## 🧪 Pruebas

### Probar envío en desarrollo (Sandbox)

Mientras estés en Sandbox, solo puedes enviar a correos verificados:

1. Verificar tu correo personal en AWS SES
2. Crear una PQRS con ese correo
3. Verificar que recibas el correo de confirmación
4. Responder la PQRS
5. Verificar que recibas el correo de respuesta

### Probar envío en producción

Una vez salgas del Sandbox:

1. Crear PQRS con cualquier correo válido
2. Los correos se enviarán automáticamente

## 📊 Monitoreo

### Ver estadísticas de envío

1. Ir a AWS SES → **Account dashboard**
2. Ver:
   - Emails enviados
   - Bounces (rebotes)
   - Complaints (quejas de spam)
   - Delivery rate

### Configurar notificaciones de bounces

Es importante monitorear bounces para mantener tu reputación:

1. Crear un SNS Topic para bounces
2. En AWS SES → **Verified identities** → tu dominio → **Notifications**
3. Configurar SNS topics para:
   - Bounces
   - Complaints
   - Deliveries (opcional)

## ⚠️ Troubleshooting

### Error: "Email address is not verified"

**Causa**: Estás en Sandbox y el correo destino no está verificado.

**Solución**:
1. Verificar el correo destino en AWS SES, O
2. Solicitar salir del Sandbox (producción)

### Error: "Access Denied"

**Causa**: No tienes permisos de SES.

**Solución**:
- Si usas credenciales: Verificar que tengan permisos de SES
- Si usas IAM Role: Agregar política `AmazonSESFullAccess` al rol de EB

### Los correos llegan a spam

**Causa**: Falta configuración SPF/DKIM/DMARC.

**Solución**:
1. Verificar que hayas agregado TODOS los registros DNS que AWS SES te dio
2. Agregar registros SPF, DKIM y DMARC en tu dominio
3. AWS SES te proporciona estos registros automáticamente al verificar el dominio

### Error: "Daily sending quota exceeded"

**Causa**: Estás en Sandbox (límite de 200/día).

**Solución**: Solicitar salir del Sandbox.

## 💰 Costos esperados

Para una plataforma con 100-200 entidades:

| Volumen mensual | Costo estimado |
|----------------|----------------|
| 1,000 correos  | $0.10          |
| 10,000 correos | $1.00          |
| 100,000 correos| $10.00         |
| 500,000 correos| $50.00         |

**Prácticamente gratuito** para tu caso de uso.

## 🎨 Templates de correo

Los templates HTML están definidos en `app/utils/email_service.py`:

- `send_pqrs_radicada_notification()`: Correo de confirmación de radicación
- `send_pqrs_respuesta_notification()`: Correo de respuesta oficial

Puedes personalizar los templates editando ese archivo.

## 📚 Recursos adicionales

- [Documentación AWS SES](https://docs.aws.amazon.com/ses/)
- [Salir del Sandbox](https://docs.aws.amazon.com/ses/latest/dg/request-production-access.html)
- [Best Practices](https://docs.aws.amazon.com/ses/latest/dg/best-practices.html)
