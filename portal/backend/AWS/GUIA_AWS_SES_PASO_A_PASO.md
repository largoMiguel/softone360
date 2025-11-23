# 🚀 Guía Paso a Paso: Configurar AWS SES

Esta guía te lleva de la mano para configurar AWS SES desde cero.

---

## 📍 Paso 1: Acceder a AWS SES

### Opción 1: Desde la barra de búsqueda (MÁS FÁCIL)

1. **Inicia sesión** en la consola de AWS: https://console.aws.amazon.com/
2. En la **barra de búsqueda superior** (donde dice "Search"), escribe: `SES`
3. Click en **Simple Email Service** (aparecerá en los resultados)

```
┌─────────────────────────────────────────────────────┐
│  🔍 Search  [SES                            ]  🔎   │
├─────────────────────────────────────────────────────┤
│  📧 Simple Email Service (SES)                      │
│  📧 Amazon SES - Get started                        │
│  📧 SES - Verified identities                       │
└─────────────────────────────────────────────────────┘
```

### Opción 2: Desde el menú Services

1. Click en **Services** (esquina superior izquierda)
2. En la categoría **Customer Engagement**, busca **Simple Email Service**
3. Click en **Simple Email Service**

### Opción 3: URL directa

Ve directamente a:
```
https://console.aws.amazon.com/ses/home?region=us-east-1
```

---

## 🌍 Paso 2: Verificar la región correcta

**IMPORTANTE**: AWS SES debe estar en la misma región que tu aplicación.

1. En la esquina superior derecha, verifica que diga: **US East (N. Virginia) us-east-1**
2. Si dice otra región, haz click y selecciona **US East (N. Virginia)**

```
┌────────────────────────────────┐
│  US East (N. Virginia) ▼       │  ← Debe decir esto
└────────────────────────────────┘
```

---

## ✅ Paso 3: Verificar un dominio o correo

### 3A. Verificar un DOMINIO COMPLETO (RECOMENDADO)

**Ventaja**: Una vez verificado, puedes enviar desde CUALQUIER correo de ese dominio.

1. En el menú lateral izquierdo, click en **Configuration** → **Verified identities**
2. Click en el botón naranja **Create identity**
3. Selecciona **Domain**
4. Ingresa tu dominio o subdominio:
   - Ejemplo 1: `chiquiza-boyaca.gov.co` (subdominio específico)
   - Ejemplo 2: `gov.co` (dominio raíz - requiere acceso DNS completo)
5. (Opcional) Deja marcado **Assign a default configuration set**
6. (Opcional) Marca **Use a custom MAIL FROM domain** solo si sabes lo que haces
7. Click en **Create identity**

**AWS te mostrará registros DNS que debes agregar**:

```
┌───────────────────────────────────────────────────────────────┐
│  CNAME Records to add to your DNS:                            │
├───────────────────────────────────────────────────────────────┤
│  Name: _amazonses.chiquiza-boyaca.gov.co                      │
│  Value: abc123xyz.dkim.amazonses.com                          │
│                                                                │
│  Name: abc123._domainkey.chiquiza-boyaca.gov.co               │
│  Value: abc123.dkim.amazonses.com                             │
│                                                                │
│  Name: def456._domainkey.chiquiza-boyaca.gov.co               │
│  Value: def456.dkim.amazonses.com                             │
│                                                                │
│  Name: ghi789._domainkey.chiquiza-boyaca.gov.co               │
│  Value: ghi789.dkim.amazonses.com                             │
└───────────────────────────────────────────────────────────────┘
```

8. **COPIA ESTOS REGISTROS** y agrégalos en tu proveedor de DNS (GoDaddy, Cloudflare, etc.)
9. Espera de **15 minutos a 72 horas** para que AWS verifique
10. Verás **Status: Verified** cuando esté listo ✅

---

### 3B. Verificar un CORREO INDIVIDUAL

**Desventaja**: Debes verificar CADA correo manualmente.

1. En el menú lateral izquierdo, click en **Configuration** → **Verified identities**
2. Click en el botón naranja **Create identity**
3. Selecciona **Email address**
4. Ingresa el correo: `contacto@chiquiza-boyaca.gov.co`
5. Click en **Create identity**
6. AWS enviará un correo a esa dirección con el asunto: **"Amazon SES Email Verification Request"**
7. **Abre ese correo** y haz click en el enlace de verificación
8. Verás **Status: Verified** ✅

**Repite esto para cada entidad**:
```
✅ contacto@chiquiza-boyaca.gov.co
✅ pqrs@tunja-boyaca.gov.co
✅ atencion@duitama-boyaca.gov.co
...
```

---

## 🚀 Paso 4: Salir del Sandbox (Modo Producción)

**Por defecto, AWS SES está en "Sandbox Mode"** que tiene limitaciones:
- ❌ Solo puedes enviar a correos verificados
- ❌ Máximo 200 correos/día
- ❌ Máximo 1 correo/segundo

Para **producción**, debes salir del Sandbox:

1. En el menú lateral izquierdo, click en **Account dashboard**
2. En la sección **Sending statistics**, busca el mensaje:
   ```
   Your account is currently in the Amazon SES sandbox
   ```
3. Click en el botón **Request production access**
4. Llena el formulario:

```
┌─────────────────────────────────────────────────────────────┐
│  Mail type:                                                  │
│  ○ Marketing     ● Transactional     ○ Subscription          │
│                                                               │
│  Website URL:                                                │
│  [https://tudominio.gov.co                           ]       │
│                                                               │
│  My use case description:                                    │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ Sistema de PQRS (Peticiones, Quejas, Reclamos y        ││
│  │ Sugerencias) para entidades gubernamentales en Colombia.││
│  │ Enviamos correos transaccionales automáticos a          ││
│  │ ciudadanos cuando:                                       ││
│  │ 1. Radican una PQRS (confirmación de radicación)       ││
│  │ 2. Reciben respuesta oficial de su solicitud           ││
│  │                                                          ││
│  │ Los correos contienen:                                  ││
│  │ - Número de radicado                                    ││
│  │ - Estado de la solicitud                                ││
│  │ - Respuestas oficiales de las entidades                ││
│  │                                                          ││
│  │ Volumen estimado: 1,000-10,000 correos/mes             ││
│  └─────────────────────────────────────────────────────────┘│
│                                                               │
│  Process for handling bounces and complaints:                │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ Monitoreamos bounces y complaints mediante:             ││
│  │ 1. Configuración de SNS topics para notificaciones     ││
│  │ 2. Procesamiento automático de bounces permanentes     ││
│  │ 3. Eliminación de correos inválidos de nuestra BD      ││
│  │ 4. Seguimiento de métricas en CloudWatch               ││
│  │                                                          ││
│  │ Mantenemos una lista limpia validando correos antes    ││
│  │ de enviar y removiendo direcciones con bounces hard.   ││
│  └─────────────────────────────────────────────────────────┘│
│                                                               │
│  Will you comply with AWS Service Terms and AUP:             │
│  ☑ Yes, I agree                                              │
│                                                               │
│  [Cancel]                          [Submit request]          │
└─────────────────────────────────────────────────────────────┘
```

5. Click en **Submit request**
6. **Espera la respuesta de AWS** (generalmente 24-48 horas)
7. Recibirás un correo confirmando la aprobación ✅

---

## 🔐 Paso 5: Configurar permisos IAM

### 5A. Si usas Elastic Beanstalk (RECOMENDADO)

1. Ve a **IAM** en la consola de AWS (busca "IAM" en la barra superior)
2. Click en **Roles** en el menú lateral
3. Busca el rol: `aws-elasticbeanstalk-ec2-role`
4. Click en el nombre del rol
5. Click en **Add permissions** → **Attach policies**
6. En la barra de búsqueda, escribe: `AmazonSESFullAccess`
7. Marca la casilla de **AmazonSESFullAccess**
8. Click en **Add permissions**

✅ **Listo**: Tu aplicación en EB ahora puede enviar correos sin credenciales hardcodeadas.

---

### 5B. Si NO usas Elastic Beanstalk (credenciales directas)

Necesitas crear un usuario IAM con permisos de SES:

1. Ve a **IAM** → **Users**
2. Click en **Create user**
3. Nombre: `ses-email-sender`
4. Click **Next**
5. Selecciona **Attach policies directly**
6. Busca y marca: `AmazonSESFullAccess` (o crea una política custom con el archivo `ses-policy-minimal.json`)
7. Click **Next** → **Create user**
8. Click en el usuario creado → **Security credentials** → **Create access key**
9. Selecciona **Application running outside AWS**
10. Click **Next** → **Create access key**
11. **COPIA Y GUARDA**:
    - Access Key ID: `AKIAIOSFODNN7EXAMPLE`
    - Secret Access Key: `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY`

12. Agrégalas a tu `.env`:
```bash
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
```

---

## 🧪 Paso 6: Probar envío de correo

### Desde la consola de AWS (Test rápido):

1. Ve a **SES** → **Account dashboard**
2. En la sección **Send test email**, llena:
   - **From**: `contacto@chiquiza-boyaca.gov.co` (debe estar verificado)
   - **Scenario**: Custom
   - **To**: tu correo personal
   - **Subject**: Prueba SES
   - **Body**: Este es un correo de prueba
3. Click en **Send test email**
4. Revisa tu bandeja de entrada ✅

---

### Desde tu aplicación:

1. Asegúrate de tener configuradas las variables de entorno:
```bash
AWS_SES_REGION=us-east-1
EMAIL_FROM=noreply@sistema-pqrs.gov.co
EMAIL_FROM_NAME=Sistema PQRS
```

2. Reinicia tu aplicación

3. Crea una PQRS con tu correo personal

4. Verifica que llegue el correo de radicación ✅

---

## 📊 Paso 7: Monitorear estadísticas

1. Ve a **SES** → **Account dashboard**
2. Verás gráficas con:
   - **Emails sent**: Total enviados
   - **Delivery rate**: Tasa de entrega
   - **Bounce rate**: Tasa de rebote
   - **Complaint rate**: Tasa de quejas de spam

**Métricas saludables**:
- ✅ Delivery rate > 95%
- ✅ Bounce rate < 5%
- ✅ Complaint rate < 0.1%

---

## ⚠️ Troubleshooting Común

### ❌ Error: "Email address is not verified"
**Causa**: El correo no está verificado en AWS SES  
**Solución**: Verificar el correo o dominio en SES

### ❌ Error: "Daily sending quota exceeded"
**Causa**: Estás en Sandbox Mode (límite 200/día)  
**Solución**: Solicitar salir del Sandbox

### ❌ Los correos llegan a SPAM
**Causa**: Falta configuración DKIM/SPF  
**Solución**: Verificar el dominio completo (AWS agrega DKIM automáticamente)

### ❌ Error: "Access Denied"
**Causa**: El IAM Role no tiene permisos  
**Solución**: Agregar política `AmazonSESFullAccess` al rol

### ❌ No encuentro los registros DNS
**Causa**: No los guardaste al crear la identidad  
**Solución**: 
1. Ve a **Verified identities**
2. Click en tu dominio
3. Tab **DKIM** → Copia los registros CNAME

---

## 📋 Checklist Final

Antes de ir a producción, verifica:

- [ ] Dominio o correos verificados en AWS SES ✅
- [ ] Saliste del Sandbox Mode ✅
- [ ] Configuraste IAM Role con permisos SES ✅
- [ ] Variables de entorno configuradas en `.env` ✅
- [ ] Todas las entidades tienen email configurado en BD ✅
- [ ] Probaste el envío de correos ✅
- [ ] Métricas de entrega son saludables (>95%) ✅

---

## 🆘 Soporte AWS

Si tienes problemas:

1. **AWS Support Center**: https://console.aws.amazon.com/support/
2. **SES Documentation**: https://docs.aws.amazon.com/ses/
3. **Foros de AWS**: https://repost.aws/

---

**¡Listo! Ahora tienes AWS SES configurado correctamente.** 🎉
