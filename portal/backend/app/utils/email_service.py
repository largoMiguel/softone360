"""
Servicio de envío de correos electrónicos usando Zeptomail (Zoho).
Incluye templates HTML para notificaciones de PQRS.
"""
import requests
from typing import Optional, List
from app.config.settings import settings
import urllib.parse


class EmailService:
    """Servicio para enviar correos electrónicos con Zeptomail"""

    ZEPTOMAIL_API_URL = "https://api.zeptomail.com/v1.1/email"

    def __init__(self):
        self.api_token = settings.zeptomail_api_token
        self.default_from_email = settings.email_from
        self.default_from_name = settings.email_from_name

    def send_email(
        self,
        to_emails: List[str],
        subject: str,
        html_body: str,
        text_body: Optional[str] = None,
        from_email: Optional[str] = None,
        from_name: Optional[str] = None,
        reply_to: Optional[str] = None
    ) -> bool:
        """
        Enviar correo electrónico usando Zeptomail.

        Args:
            to_emails: Lista de correos destino
            subject: Asunto del correo
            html_body: Cuerpo del correo en HTML
            text_body: Cuerpo del correo en texto plano (opcional)
            from_email: Email del remitente (debe ser de dominio verificado en Zeptomail)
            from_name: Nombre del remitente (nombre de la entidad)
            reply_to: Correo institucional de la entidad para respuestas (opcional)

        Returns:
            True si se envió exitosamente, False en caso contrario
        """
        sender_name = from_name or self.default_from_name
        # Siempre enviar desde el dominio verificado (softone360.com)
        sender_email = self.default_from_email

        print(f"📧 Intentando enviar correo:")
        print(f"   Desde: {sender_name} <{sender_email}>")
        print(f"   Para: {to_emails}")
        print(f"   Reply-To: {reply_to}")
        print(f"   Asunto: {subject}")

        payload = {
            "from": {
                "address": sender_email,
                "name": sender_name
            },
            "to": [
                {"email_address": {"address": addr}} for addr in to_emails
            ],
            "subject": subject,
            "htmlbody": html_body,
        }

        if reply_to:
            payload["reply_to"] = [{"address": reply_to}]

        if text_body:
            payload["textbody"] = text_body

        headers = {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Authorization": f"Zoho-enczapikey {self.api_token}",
        }

        try:
            response = requests.post(
                self.ZEPTOMAIL_API_URL,
                json=payload,
                headers=headers,
                timeout=15
            )
            response.raise_for_status()
            data = response.json()
            message_id = data.get("data", [{}])[0].get("message_id", "N/A") if data.get("data") else "N/A"
            print(f"✅ Correo enviado exitosamente desde {sender_email} a {to_emails}. MessageId: {message_id}")
            return True
        except requests.exceptions.HTTPError as e:
            print(f"❌ Error HTTP enviando correo: {e.response.status_code} - {e.response.text}")
            return False
        except Exception as e:
            print(f"❌ Error inesperado enviando correo: {str(e)}")
            return False
    
    def send_pqrs_radicada_notification(
        self,
        to_email: str,
        numero_radicado: str,
        tipo_solicitud: str,
        asunto: str,
        nombre_ciudadano: str,
        entity_name: str,
        entity_slug: str,
        fecha_radicacion: str,
        archivo_adjunto_url: Optional[str] = None,
        entity_email: Optional[str] = None
    ) -> bool:
        """
        Enviar notificación de PQRS radicada al ciudadano.
        
        Args:
            to_email: Correo(s) del ciudadano (puede ser múltiples separados por comas o punto y coma)
            numero_radicado: Número de radicado de la PQRS
            tipo_solicitud: Tipo de solicitud (petición, queja, etc.)
            asunto: Asunto de la PQRS
            nombre_ciudadano: Nombre del ciudadano
            entity_name: Nombre de la entidad
            entity_slug: Slug de la entidad para el link
            fecha_radicacion: Fecha de radicación
            entity_email: Email de la entidad (opcional, se usa como remitente)
        """
        # Dividir múltiples correos si existen (separados por comas o punto y coma)
        import re
        email_list = [email.strip() for email in re.split(r'[,;]\s*', to_email) if email.strip()]
        subject = f"PQRS Radicada - {numero_radicado}"
        
        html_body = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background-color: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }}
                .content {{ background-color: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-radius: 0 0 8px 8px; }}
                .info-box {{ background-color: white; padding: 15px; margin: 15px 0; border-left: 4px solid #2563eb; border-radius: 4px; }}
                .footer {{ text-align: center; margin-top: 20px; font-size: 12px; color: #6b7280; }}
                .radicado {{ font-size: 24px; font-weight: bold; color: #2563eb; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>PQRS Radicada Exitosamente</h1>
                </div>
                <div class="content">
                    <p>Estimado/a <strong>{nombre_ciudadano}</strong>,</p>
                    
                    <p>Su solicitud ha sido radicada exitosamente en el sistema de PQRS de <strong>{entity_name}</strong>.</p>
                    
                    <div class="info-box">
                        <p><strong>Número de Radicado:</strong></p>
                        <p class="radicado">
                            <a href="{settings.frontend_url}/#/{entity_slug}?radicado={urllib.parse.quote(numero_radicado)}" 
                               style="color: #2563eb; text-decoration: none;">
                                {numero_radicado}
                            </a>
                        </p>
                    </div>
                    
                    <div class="info-box">
                        <p><strong>Tipo de Solicitud:</strong> {tipo_solicitud.title()}</p>
                        <p><strong>Asunto:</strong> {asunto}</p>
                        <p><strong>Fecha de Radicación:</strong> {fecha_radicacion}</p>
                    </div>
                    
                    {f'<div class="info-box" style="background-color: #ecfdf5; border-left-color: #10b981;"><p><strong>📎 Documento adjunto:</strong></p><p><a href="{archivo_adjunto_url}" style="color: #2563eb;">Descargar documento adjunto</a></p></div>' if archivo_adjunto_url else ''}

                    <p>Puede consultar el estado de su solicitud en cualquier momento utilizando su número de radicado.</p>
                    
                    <p>Recibirá un correo de notificación cuando su solicitud sea respondida.</p>
                    
                    <p>Gracias por utilizar nuestro sistema.</p>
                </div>
                <div class="footer">
                    <p>Este es un correo automático, por favor no responder.</p>
                    <p>{entity_name} - Sistema de PQRS</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        text_body = f"""
        PQRS Radicada Exitosamente
        
        Estimado/a {nombre_ciudadano},
        
        Su solicitud ha sido radicada exitosamente en el sistema de PQRS de {entity_name}.
        
        Número de Radicado: {numero_radicado}
        Tipo de Solicitud: {tipo_solicitud.title()}
        Asunto: {asunto}
        Fecha de Radicación: {fecha_radicacion}
        
        Puede consultar el estado de su solicitud en cualquier momento utilizando su número de radicado.
        {f"Documento adjunto: {archivo_adjunto_url}" if archivo_adjunto_url else ""}
        Recibirá un correo de notificación cuando su solicitud sea respondida.
        
        Gracias por utilizar nuestro sistema.
        
        ---
        Este es un correo automático, por favor no responder.
        {entity_name} - Sistema de PQRS
        """
        
        return self.send_email(
            to_emails=email_list,
            subject=subject,
            html_body=html_body,
            text_body=text_body,
            from_name=entity_name,
            reply_to=entity_email
        )

    def send_pqrs_respuesta_notification(
        self,
        to_email: str,
        numero_radicado: str,
        asunto: str,
        nombre_ciudadano: str,
        respuesta: str,
        entity_name: str,
        entity_slug: str,
        fecha_respuesta: str,
        archivo_adjunto_url: Optional[str] = None,
        entity_email: Optional[str] = None
    ) -> bool:
        """
        Enviar notificación de respuesta de PQRS al ciudadano.
        
        Args:
            to_email: Correo(s) del ciudadano (puede ser múltiples separados por comas o punto y coma)
            numero_radicado: Número de radicado de la PQRS
            asunto: Asunto de la PQRS
            nombre_ciudadano: Nombre del ciudadano
            respuesta: Texto de la respuesta
            entity_name: Nombre de la entidad
            entity_slug: Slug de la entidad para el link
            fecha_respuesta: Fecha de respuesta
            archivo_adjunto_url: URL del archivo adjunto (opcional)
            entity_email: Email de la entidad (opcional, se usa como remitente)
        """
        # Dividir múltiples correos si existen (separados por comas o punto y coma)
        import re
        email_list = [email.strip() for email in re.split(r'[,;]\s*', to_email) if email.strip()]
        subject = f"Respuesta a su PQRS - {numero_radicado}"
        
        # Sección de archivo adjunto si existe
        archivo_section = ""
        if archivo_adjunto_url:
            archivo_section = f"""
            <div class="info-box" style="background-color: #ecfdf5; border-left-color: #10b981;">
                <p><strong>📎 Archivo Adjunto:</strong></p>
                <p><a href="{archivo_adjunto_url}" style="color: #2563eb; text-decoration: none;">Descargar documento de respuesta</a></p>
            </div>
            """
        
        html_body = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background-color: #10b981; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }}
                .content {{ background-color: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-radius: 0 0 8px 8px; }}
                .info-box {{ background-color: white; padding: 15px; margin: 15px 0; border-left: 4px solid #10b981; border-radius: 4px; }}
                .footer {{ text-align: center; margin-top: 20px; font-size: 12px; color: #6b7280; }}
                .radicado {{ font-size: 20px; font-weight: bold; color: #10b981; }}
                .respuesta {{ background-color: white; padding: 20px; margin: 15px 0; border-radius: 4px; border: 1px solid #e5e7eb; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>✅ Su PQRS ha sido Respondida</h1>
                </div>
                <div class="content">
                    <p>Estimado/a <strong>{nombre_ciudadano}</strong>,</p>
                    
                    <p>Hemos dado respuesta a su solicitud radicada en <strong>{entity_name}</strong>.</p>
                    
                    <div class="info-box">
                        <p><strong>Número de Radicado:</strong></p>
                        <p class="radicado">
                            <a href="{settings.frontend_url}/#/{entity_slug}?radicado={urllib.parse.quote(numero_radicado)}" 
                               style="color: #10b981; text-decoration: none;">
                                {numero_radicado}
                            </a>
                        </p>
                    </div>
                    
                    <div class="info-box">
                        <p><strong>Asunto:</strong> {asunto}
                        <p><strong>Fecha de Respuesta:</strong> {fecha_respuesta}</p>
                    </div>
                    
                    <div class="respuesta">
                        <p><strong>Respuesta:</strong></p>
                        <p>{respuesta}</p>
                    </div>
                    
                    {archivo_section}
                    
                    <p>Si tiene alguna pregunta adicional, puede radicar una nueva solicitud.</p>
                    
                    <p>Gracias por utilizar nuestro sistema.</p>
                </div>
                <div class="footer">
                    <p>Este es un correo automático, por favor no responder.</p>
                    <p>{entity_name} - Sistema de PQRS</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        archivo_text = f"\n\nArchivo Adjunto: {archivo_adjunto_url}" if archivo_adjunto_url else ""
        
        text_body = f"""
        Su PQRS ha sido Respondida
        
        Estimado/a {nombre_ciudadano},
        
        Hemos dado respuesta a su solicitud radicada en {entity_name}.
        
        Número de Radicado: {numero_radicado}
        Asunto: {asunto}
        Fecha de Respuesta: {fecha_respuesta}
        
        Respuesta:
        {respuesta}
        {archivo_text}
        
        Si tiene alguna pregunta adicional, puede radicar una nueva solicitud.
        
        Gracias por utilizar nuestro sistema.
        
        ---
        Este es un correo automático, por favor no responder.
        {entity_name} - Sistema de PQRS
        """
        
        return self.send_email(
            to_emails=email_list,
            subject=subject,
            html_body=html_body,
            text_body=text_body,
            from_name=entity_name,
            reply_to=entity_email
        )


# Instancia global del servicio de email
email_service = EmailService()
