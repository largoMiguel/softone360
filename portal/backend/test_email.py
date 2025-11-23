#!/usr/bin/env python3
"""
Script de prueba para verificar envío de correos con AWS SES
"""
import boto3
from botocore.exceptions import ClientError
import os
from dotenv import load_dotenv

# Cargar variables de entorno
load_dotenv()

# Configuración
AWS_REGION = os.getenv('AWS_SES_REGION', 'us-east-1')
FROM_EMAIL = os.getenv('EMAIL_FROM', 'sistemas@chiquiza-boyaca.gov.co')
FROM_NAME = os.getenv('EMAIL_FROM_NAME', 'Sistema PQRS')
TO_EMAIL = 'amadolargo@gmail.com'  # Tu correo verificado

print("🚀 PRUEBA DE ENVÍO DE CORREO CON AWS SES")
print("=" * 60)
print(f"Región AWS: {AWS_REGION}")
print(f"Desde: {FROM_NAME} <{FROM_EMAIL}>")
print(f"Para: {TO_EMAIL}")
print("=" * 60)
print()

# Crear cliente SES
try:
    ses_client = boto3.client('ses', region_name=AWS_REGION)
    print("✅ Cliente SES creado exitosamente")
except Exception as e:
    print(f"❌ Error creando cliente SES: {e}")
    exit(1)

# Verificar identidades verificadas
print("\n📧 Verificando identidades en AWS SES...")
try:
    response = ses_client.list_identities(IdentityType='EmailAddress')
    verified_emails = response.get('Identities', [])
    
    print(f"\n✅ Correos verificados en SES ({len(verified_emails)}):")
    for email in verified_emails:
        # Verificar estado de verificación
        verify_status = ses_client.get_identity_verification_attributes(
            Identities=[email]
        )
        status = verify_status['VerificationAttributes'].get(email, {}).get('VerificationStatus', 'Unknown')
        print(f"   • {email} - Estado: {status}")
        
    print()
    
    # Verificar que los correos necesarios estén verificados
    if FROM_EMAIL not in verified_emails:
        print(f"⚠️  WARNING: El correo remitente '{FROM_EMAIL}' NO está verificado")
        print(f"   Ve a AWS SES y verifica este correo primero")
        print()
    
    if TO_EMAIL not in verified_emails:
        print(f"⚠️  WARNING: El correo destinatario '{TO_EMAIL}' NO está verificado")
        print(f"   En Sandbox mode, debes verificar también el destinatario")
        print()
        
except Exception as e:
    print(f"❌ Error verificando identidades: {e}")

# Verificar cuota de envío
print("📊 Verificando cuota de envío...")
try:
    quota = ses_client.get_send_quota()
    print(f"   • Enviados en 24h: {quota['SentLast24Hours']}")
    print(f"   • Máximo por 24h: {quota['Max24HourSend']}")
    print(f"   • Tasa de envío: {quota['MaxSendRate']}/segundo")
    
    # Verificar si está en Sandbox
    if quota['Max24HourSend'] == 200:
        print(f"\n⚠️  Tu cuenta está en SANDBOX MODE")
        print(f"   Solo puedes enviar a correos verificados")
        print(f"   Solicita salir del Sandbox para producción")
    print()
except Exception as e:
    print(f"❌ Error obteniendo cuota: {e}")

# Intentar enviar correo de prueba
print("📤 Intentando enviar correo de prueba...")
try:
    response = ses_client.send_email(
        Source=f"{FROM_NAME} <{FROM_EMAIL}>",
        Destination={
            'ToAddresses': [TO_EMAIL],
        },
        Message={
            'Subject': {
                'Charset': 'UTF-8',
                'Data': '✅ Prueba AWS SES - Sistema PQRS',
            },
            'Body': {
                'Html': {
                    'Charset': 'UTF-8',
                    'Data': '''
                    <html>
                    <body>
                        <h2>✅ ¡Correo de prueba exitoso!</h2>
                        <p>Si estás leyendo esto, significa que AWS SES está configurado correctamente.</p>
                        <p><strong>Configuración:</strong></p>
                        <ul>
                            <li>Región: us-east-1</li>
                            <li>Remitente: sistemas@chiquiza-boyaca.gov.co</li>
                            <li>Sistema: PQRS</li>
                        </ul>
                        <p>Ya puedes enviar correos desde tu aplicación.</p>
                    </body>
                    </html>
                    ''',
                },
                'Text': {
                    'Charset': 'UTF-8',
                    'Data': 'Prueba exitosa de AWS SES. El sistema está funcionando correctamente.',
                },
            },
        },
    )
    
    message_id = response['MessageId']
    print(f"\n✅ ¡CORREO ENVIADO EXITOSAMENTE!")
    print(f"   Message ID: {message_id}")
    print(f"\n   Revisa tu bandeja: {TO_EMAIL}")
    print(f"   (Puede tardar 1-2 minutos en llegar)")
    print()
    
except ClientError as e:
    error_code = e.response['Error']['Code']
    error_message = e.response['Error']['Message']
    
    print(f"\n❌ ERROR AL ENVIAR CORREO:")
    print(f"   Código: {error_code}")
    print(f"   Mensaje: {error_message}")
    print()
    
    # Diagnóstico según el error
    if 'Email address is not verified' in error_message:
        print("🔍 DIAGNÓSTICO:")
        print("   El correo no está verificado en AWS SES")
        print()
        print("   SOLUCIÓN:")
        print("   1. Ve a AWS SES → Verified identities")
        print(f"   2. Verifica: {FROM_EMAIL}")
        print(f"   3. Verifica: {TO_EMAIL}")
        print()
    elif 'not authorized' in error_message.lower():
        print("🔍 DIAGNÓSTICO:")
        print("   No tienes permisos de SES")
        print()
        print("   SOLUCIÓN:")
        print("   1. Ejecuta: ./AWS/setup-ses-permissions.sh")
        print("   2. O adjunta manualmente AmazonSESFullAccess al rol de EB")
        print()
    
except Exception as e:
    print(f"\n❌ Error inesperado: {e}")

print("=" * 60)
print("FIN DE LA PRUEBA")
print("=" * 60)
