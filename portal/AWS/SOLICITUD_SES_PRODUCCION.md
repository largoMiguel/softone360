# 📧 Solicitud de Acceso a Producción AWS SES

**Fecha:** 12 de diciembre de 2025  
**Servicio:** Amazon Simple Email Service (SES)  
**Región:** us-east-1

---

## 🎯 Objetivo

Solicitar la salida del **modo sandbox** de AWS SES para poder enviar correos electrónicos a cualquier dirección sin restricciones.

---

## 📝 Pasos para Solicitar Acceso

### **Opción 1: Desde la Consola de AWS (Recomendado)**

1. **Acceder a AWS SES Console**
   ```
   https://console.aws.amazon.com/ses/home?region=us-east-1
   ```

2. **Ir a "Account dashboard"**
   - En el menú lateral izquierdo, click en **"Account dashboard"**
   - Verás el estado actual: **"Sandbox"**

3. **Solicitar Acceso a Producción**
   - Click en el botón **"Request production access"**
   - Se abrirá un formulario de solicitud

4. **Completar el Formulario**

   **Mail type (Tipo de correo):**
   - ☑️ **Transactional** (Correos transaccionales)
   
   **Website URL:**
   ```
   https://softone360.com (o tu dominio de producción)
   ```
   
   **Use case description (Descripción del caso de uso):**
   ```
   Sistema PQRS (Peticiones, Quejas, Reclamos y Sugerencias) para entidades 
   gubernamentales en Colombia.
   
   Enviamos correos transaccionales automáticos para:
   - Confirmación de radicación de PQRS
   - Notificaciones de cambios de estado
   - Respuestas oficiales a solicitudes ciudadanas
   - Alertas administrativas al personal
   
   Volumen estimado: 1,000-5,000 correos mensuales
   Solo correos solicitados explícitamente por los usuarios
   Cumplimiento de normativa colombiana de datos personales
   ```
   
   **Additional contacts (opcional):**
   ```
   Correos de administradores que recibirán notificaciones de SES
   ```
   
   **Acknowledge (Reconocimiento):**
   - ☑️ Acepto que seguiré las políticas de AWS SES
   - ☑️ Acepto mantener listas de bounce y complaint actualizadas

5. **Enviar Solicitud**
   - Click en **"Submit request"**
   - AWS generará un caso en **AWS Support Center**

---

### **Opción 2: Desde AWS CLI**

```bash
# Crear solicitud de acceso a producción
aws sesv2 put-account-details \
  --region us-east-1 \
  --production-access-enabled \
  --mail-type TRANSACTIONAL \
  --website-url "https://softone360.com" \
  --use-case-description "Sistema PQRS para entidades gubernamentales. Enviamos correos transaccionales de confirmación, notificaciones y respuestas oficiales. Volumen: 1000-5000 correos/mes." \
  --additional-contact-email-addresses "admin@softone360.com"
```

---

## ⏱️ Tiempo de Respuesta

- **Típicamente:** 24-48 horas
- **Máximo:** 7 días hábiles
- Recibirás respuesta por email y en el Support Center

---

## 📊 Información de tu Cuenta Actual

### **Verificar Estado Actual:**

```bash
# Ver estado del sandbox
aws sesv2 get-account --region us-east-1

# Ver límites actuales
aws ses get-send-quota --region us-east-1
```

**Estado Sandbox:**
- ✉️ Solo envío a direcciones verificadas
- 📊 Límite: 200 correos/día
- 🚀 Tasa: 1 correo/segundo

**Estado Producción (después de aprobación):**
- ✉️ Envío a cualquier dirección
- 📊 Límite inicial: 50,000 correos/día
- 🚀 Tasa inicial: 14 correos/segundo
- 📈 Límites se pueden aumentar posteriormente

---

## ✅ Qué Hacer Mientras Esperas

### **1. Verificar Dominios**

```bash
# Verificar el dominio de envío
aws ses verify-domain-identity --domain softone360.com --region us-east-1

# Agregar registros DNS SPF y DKIM
# (Ver guía en AWS/CONFIGURACION_EMAIL_AWS_SES.md)
```

### **2. Configurar Bounces y Complaints**

```bash
# Configurar SNS para notificaciones
aws ses set-identity-notification-topic \
  --identity tu-dominio.com \
  --notification-type Bounce \
  --sns-topic arn:aws:sns:us-east-1:ACCOUNT_ID:ses-bounces \
  --region us-east-1

aws ses set-identity-notification-topic \
  --identity tu-dominio.com \
  --notification-type Complaint \
  --sns-topic arn:aws:sns:us-east-1:ACCOUNT_ID:ses-complaints \
  --region us-east-1
```

### **3. Mientras en Sandbox: Verificar Correos de Prueba**

Para probar durante el desarrollo, verifica correos individuales:

```bash
# Verificar un correo individual
aws ses verify-email-identity \
  --email-address usuario@ejemplo.com \
  --region us-east-1

# El usuario recibirá un correo con link de verificación
```

**O desde la consola:**
1. Ir a **"Verified identities"**
2. Click en **"Create identity"**
3. Seleccionar **"Email address"**
4. Ingresar el correo y click **"Create identity"**
5. El usuario debe hacer click en el link recibido

---

## 📋 Checklist de Buenas Prácticas

Antes de solicitar acceso a producción, asegúrate de:

- ✅ Tener un dominio verificado
- ✅ Configurar SPF, DKIM y DMARC
- ✅ Implementar manejo de bounces
- ✅ Implementar manejo de complaints (spam reports)
- ✅ Tener proceso de unsubscribe (para correos marketing)
- ✅ Documentar el caso de uso claramente
- ✅ Tener un volumen realista estimado

---

## 🚨 Factores que AWS Evalúa

**Aprobarán si:**
- ✅ Caso de uso legítimo y claro
- ✅ Website funcional y profesional
- ✅ Historial de cuenta AWS limpio
- ✅ Implementación correcta de bounces/complaints
- ✅ Volumen razonable y justificado

**Pueden rechazar si:**
- ❌ Caso de uso vago o sospechoso
- ❌ Website no funcional o spam-like
- ❌ No hay manejo de bounces
- ❌ Historial de abuso en AWS
- ❌ Intento de email marketing masivo sin permiso

---

## 📞 Si tu Solicitud es Rechazada

1. **Revisa la razón del rechazo** (llega por email)
2. **Corrige los problemas mencionados**
3. **Espera 7 días** antes de volver a aplicar
4. **Reaplica con más detalles** y evidencia

---

## 💡 Alternativas Temporales

Mientras esperas aprobación:

### **Opción 1: Verificar Correos Individuales**
```bash
# Verificar los correos de tus clientes principales
aws ses verify-email-identity --email-address cliente@domain.com --region us-east-1
```

### **Opción 2: Usar SendGrid o Mailgun**
Servicios third-party que tienen planes gratuitos para desarrollo:
- SendGrid: 100 correos/día gratis
- Mailgun: 5,000 correos/mes primeros 3 meses

### **Opción 3: Ambiente de Testing**
Mantener SES en sandbox para development y testing, usar otro servicio para producción temporalmente.

---

## 📚 Recursos Adicionales

**Documentación AWS:**
- [Moving out of SES Sandbox](https://docs.aws.amazon.com/ses/latest/dg/request-production-access.html)
- [SES Best Practices](https://docs.aws.amazon.com/ses/latest/dg/best-practices.html)
- [Email Sending Best Practices](https://docs.aws.amazon.com/ses/latest/dg/sending-email-best-practices.html)

**Archivos de configuración local:**
- `AWS/CONFIGURACION_EMAIL_AWS_SES.md` - Configuración detallada
- `AWS/GUIA_AWS_SES_PASO_A_PASO.md` - Guía paso a paso
- `backend/app/utils/email_service.py` - Implementación actual

---

## ✅ Próximos Pasos

1. ⬜ Solicitar acceso a producción (seguir pasos arriba)
2. ⬜ Configurar dominio verificado con DNS
3. ⬜ Implementar SNS para bounces/complaints
4. ⬜ Esperar respuesta de AWS (24-48 hrs)
5. ⬜ Una vez aprobado, actualizar límites si es necesario
6. ⬜ Monitorear métricas de envío

---

**Nota:** La aprobación es casi automática si tu caso de uso es legítimo y tienes la configuración correcta. El sistema PQRS es un caso de uso válido y típicamente aprobado rápidamente.

**Contacto AWS Support si hay problemas:**
- Console: https://console.aws.amazon.com/support/home
- Teléfono: Disponible para cuentas Business/Enterprise
