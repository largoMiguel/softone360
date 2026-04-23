from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File
from pydantic import BaseModel
import asyncio
import gc
import json
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from datetime import datetime
import pytz
import boto3
from botocore.exceptions import ClientError
import os
import sys
import logging

# Configurar logger
logger = logging.getLogger(__name__)
from app.config.database import get_db
from app.models.pqrs import PQRS, EstadoPQRS, AsignacionAuditoria
from app.models.user import User, UserRole
from app.models.entity import Entity
from app.schemas.pqrs import PQRSCreate, PQRSUpdate, PQRS as PQRSSchema, PQRSWithDetails, PQRSResponse
from app.models.alert import Alert
from app.utils.auth import get_current_active_user, require_admin
from app.utils.helpers import generate_radicado
from app.utils.email_service import email_service
from app.config.settings import settings

router = APIRouter(prefix="/pqrs", tags=["PQRS"])

# Función helper para obtener hora de Colombia
def get_colombia_time():
    """Retorna la hora actual en zona horaria de Colombia (UTC-5)"""
    colombia_tz = pytz.timezone(settings.timezone)
    return datetime.now(colombia_tz)

def format_colombia_datetime(dt: datetime) -> str:
    """Formatea un datetime UTC a string en hora de Colombia"""
    if dt is None:
        return ""
    # Si dt ya tiene timezone, convertir a Colombia, sino asumir UTC
    colombia_tz = pytz.timezone(settings.timezone)
    if dt.tzinfo is None:
        # Asumir que es UTC
        dt = pytz.utc.localize(dt)
    dt_colombia = dt.astimezone(colombia_tz)
    return dt_colombia.strftime("%Y-%m-%d %H:%M:%S")

@router.post("/", response_model=PQRSSchema)
async def create_pqrs(
    pqrs_data: PQRSCreate,
    skip_email: bool = Query(False, description="Si True, no envía el email de radicación (el email se enviará desde el endpoint de upload cuando incluya archivo adjunto)"),
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_active_user)
):
    """Crear nueva PQRS (personal o anónima)"""
    
    try:
        # Validar según tipo de identificación
        from app.models.pqrs import TipoIdentificacion
        
        # Normalizar campos vacíos/null
        if not pqrs_data.nombre_ciudadano:
            pqrs_data.nombre_ciudadano = None
        if not pqrs_data.cedula_ciudadano:
            pqrs_data.cedula_ciudadano = None
        
        if pqrs_data.tipo_identificacion == TipoIdentificacion.PERSONAL:
            # PQRS Personal: requiere nombre y cédula
            # Si no se proporcionan, usar datos del usuario autenticado
            if not pqrs_data.nombre_ciudadano:
                pqrs_data.nombre_ciudadano = current_user.full_name or "Usuario Registrado"
            if not pqrs_data.cedula_ciudadano:
                pqrs_data.cedula_ciudadano = current_user.username
        else:
            # PQRS Anónima: asignar valores por defecto
            if not pqrs_data.nombre_ciudadano:
                pqrs_data.nombre_ciudadano = "Anónimo"
            if not pqrs_data.cedula_ciudadano:
                pqrs_data.cedula_ciudadano = "N/A"
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error validando PQRS: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error validando datos: {str(e)}"
        )
    
    # Generar número de radicado único (ignorar el del frontend para evitar duplicados)
    try:
        # Siempre generar un nuevo radicado único con formato ENT-YYYYMMDDNNN
        numero_radicado = generate_radicado(db, entity_id=current_user.entity_id)
        # Verificar unicidad por si acaso (aunque la función ya maneja esto)
        max_intentos = 10
        intentos = 0
        while db.query(PQRS).filter(PQRS.numero_radicado == numero_radicado).first() and intentos < max_intentos:
            numero_radicado = generate_radicado(db, entity_id=current_user.entity_id)
            intentos += 1
        
        # Determinar asignación automática:
        # - Si el creador es SECRETARIO, asignar automáticamente a él y fijar fecha_delegacion.
        # - Si es ADMIN o CIUDADANO, dejar sin asignar.
        assigned_to_id = None
        fecha_delegacion = None
        if current_user.role == UserRole.SECRETARIO:
            assigned_to_id = current_user.id
            fecha_delegacion = datetime.utcnow()

        # Crear PQRS con datos finales
        db_pqrs = PQRS(
            numero_radicado=numero_radicado,
            canal_llegada=pqrs_data.canal_llegada,
            tipo_identificacion=pqrs_data.tipo_identificacion,
            medio_respuesta=pqrs_data.medio_respuesta,
            nombre_ciudadano=pqrs_data.nombre_ciudadano,
            cedula_ciudadano=pqrs_data.cedula_ciudadano,
            telefono_ciudadano=pqrs_data.telefono_ciudadano,
            email_ciudadano=pqrs_data.email_ciudadano,
            direccion_ciudadano=pqrs_data.direccion_ciudadano,
            tipo_solicitud=pqrs_data.tipo_solicitud,
            asunto=pqrs_data.asunto or "Sin asunto",
            descripcion=pqrs_data.descripcion,
            created_by_id=current_user.id,
            assigned_to_id=assigned_to_id,
            fecha_delegacion=fecha_delegacion,
            entity_id=pqrs_data.entity_id,
            tipo_persona=pqrs_data.tipo_persona,
            genero=pqrs_data.genero,
            dias_respuesta=pqrs_data.dias_respuesta or 15,
            archivo_adjunto=pqrs_data.archivo_adjunto
        )
        
        db.add(db_pqrs)
        db.commit()
        db.refresh(db_pqrs)

        # Enviar correo de confirmación al ciudadano si tiene email y no se indicó skip_email
        if pqrs_data.email_ciudadano and not skip_email:
            try:
                # Obtener información de la entidad para el correo
                entity = db.query(Entity).filter(Entity.id == pqrs_data.entity_id).first()
                entity_name = entity.name if entity else "Sistema PQRS"
                entity_email = entity.email if entity and entity.email else None
                entity_slug = entity.slug if entity else "portal"

                # Enviar correo de radicación (sin archivo adjunto, se sube después)
                email_service.send_pqrs_radicada_notification(
                    to_email=pqrs_data.email_ciudadano,
                    numero_radicado=numero_radicado,
                    tipo_solicitud=pqrs_data.tipo_solicitud.value,
                    asunto=pqrs_data.asunto or "Sin asunto",
                    nombre_ciudadano=pqrs_data.nombre_ciudadano or "Ciudadano",
                    entity_name=entity_name,
                    entity_slug=entity_slug,
                    fecha_radicacion=format_colombia_datetime(db_pqrs.fecha_solicitud),
                    archivo_adjunto_url=None,
                    entity_email=entity_email
                )
                print(f"✅ Correo de radicación enviado a {pqrs_data.email_ciudadano}")
            except Exception as email_error:
                # No interrumpir el flujo si falla el envío del correo
                import traceback
                print(f"⚠️ Error enviando correo de radicación: {email_error}")
                print(f"Traceback completo: {traceback.format_exc()}")

        # Crear alertas: nueva PQRS para admins de la entidad
        try:
            admins = db.query(User).filter(User.role == UserRole.ADMIN, User.entity_id == pqrs_data.entity_id).all()
            for admin in admins:
                db.add(Alert(
                    entity_id=pqrs_data.entity_id,
                    recipient_user_id=admin.id,
                    type="NEW_PQRS",
                    title=f"Nueva PQRS {db_pqrs.numero_radicado}",
                    message=f"Asunto: {db_pqrs.asunto}",
                    data=json.dumps({"pqrs_id": db_pqrs.id}),
                ))
            # Si se auto-asignó al secretario creador
            if assigned_to_id:
                db.add(Alert(
                    entity_id=pqrs_data.entity_id,
                    recipient_user_id=assigned_to_id,
                    type="PQRS_ASSIGNED",
                    title=f"Te asignaron la PQRS {db_pqrs.numero_radicado}",
                    message=f"Asunto: {db_pqrs.asunto}",
                    data=json.dumps({"pqrs_id": db_pqrs.id}),
                ))
            db.commit()
        except Exception as _:
            db.rollback()
            # no interrumpir el flujo por alertas
        
        return db_pqrs
    
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"❌ Error creando PQRS: {e}")
        import traceback
        print(traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creando PQRS: {str(e)}"
        )

@router.get("/", response_model=List[PQRSWithDetails])
async def get_pqrs(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=10000),
    estado: Optional[EstadoPQRS] = None,
    assigned_to_me: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Obtener lista de PQRS"""
    query = db.query(PQRS).options(
        joinedload(PQRS.created_by),
        joinedload(PQRS.assigned_to)
    )
    
    # Filtrar según rol
    if current_user.role == UserRole.ADMIN:
        # Admin ve solo las PQRS de su entidad
        query = query.filter(PQRS.entity_id == current_user.entity_id)
        if assigned_to_me:
            query = query.filter(PQRS.assigned_to_id == current_user.id)
    elif current_user.role == UserRole.SECRETARIO:
        # Secretarios solo ven PQRS asignadas a ellos
        query = query.filter(PQRS.assigned_to_id == current_user.id)
    elif current_user.role == UserRole.CIUDADANO:
        # Ciudadanos ven PQRS que ellos crearon (basándose en created_by_id o email)
        query = query.filter(
            (PQRS.created_by_id == current_user.id) |
            (PQRS.email_ciudadano == current_user.email)
        )
    
    # Filtrar por estado si se especifica
    if estado:
        query = query.filter(PQRS.estado == estado)
    
    # Ordenar por fecha de creación (más recientes primero)
    query = query.order_by(PQRS.created_at.desc())
    
    pqrs_list = query.offset(skip).limit(limit).all()
    
    # Convertir a formato con detalles
    result = []
    for pqrs in pqrs_list:
        pqrs_dict = {
            **pqrs.__dict__,
            "created_by": {
                "id": pqrs.created_by.id,
                "username": pqrs.created_by.username,
                "full_name": pqrs.created_by.full_name
            } if pqrs.created_by else None,
            "assigned_to": {
                "id": pqrs.assigned_to.id,
                "username": pqrs.assigned_to.username,
                "full_name": pqrs.assigned_to.full_name
            } if pqrs.assigned_to else None
        }
        result.append(pqrs_dict)
    
    return result

@router.get("/mis-pqrs", response_model=List[PQRSWithDetails])
async def get_mis_pqrs(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Obtener PQRS del ciudadano autenticado"""
    # Solo ciudadanos pueden usar este endpoint
    if current_user.role != UserRole.CIUDADANO:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Este endpoint es solo para ciudadanos"
        )
    
    # Obtener PQRS creadas por el ciudadano
    query = db.query(PQRS).options(
        joinedload(PQRS.created_by),
        joinedload(PQRS.assigned_to),
        joinedload(PQRS.entity)
    ).filter(
        (PQRS.created_by_id == current_user.id) |
        (PQRS.email_ciudadano == current_user.email)
    ).order_by(PQRS.created_at.desc())
    
    pqrs_list = query.offset(skip).limit(limit).all()
    
    # Convertir a formato con detalles
    result = []
    for pqrs in pqrs_list:
        pqrs_dict = {
            **pqrs.__dict__,
            "created_by": {
                "id": pqrs.created_by.id,
                "username": pqrs.created_by.username,
                "full_name": pqrs.created_by.full_name
            } if pqrs.created_by else None,
            "assigned_to": {
                "id": pqrs.assigned_to.id,
                "username": pqrs.assigned_to.username,
                "full_name": pqrs.assigned_to.full_name
            } if pqrs.assigned_to else None,
            "entity": {
                "id": pqrs.entity.id,
                "name": pqrs.entity.name,
                "slug": pqrs.entity.slug
            } if pqrs.entity else None
        }
        result.append(pqrs_dict)
    
    return result

@router.get("/next-radicado", response_model=dict)
async def get_next_radicado(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Obtener el próximo número de radicado que se asignará a una nueva PQRS.
    Este es solo un preview - el radicado real se genera al crear la PQRS.
    """
    try:
        next_radicado = generate_radicado(db, entity_id=current_user.entity_id)
        return {
            "next_radicado": next_radicado,
            "format": "YYYYMMDDNNN",
            "description": "Próximo número de radicado (puede variar si se crean otras PQRS antes)"
        }
    except Exception as e:
        print(f"❌ Error generando preview de radicado: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al generar preview: {str(e)}"
        )

@router.get("/{pqrs_id}", response_model=PQRSWithDetails)
async def get_pqrs_by_id(
    pqrs_id: int, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_active_user)
):
    """Obtener PQRS por ID"""
    pqrs = db.query(PQRS).options(
        joinedload(PQRS.created_by),
        joinedload(PQRS.assigned_to)
    ).filter(PQRS.id == pqrs_id).first()
    
    if not pqrs:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="PQRS no encontrada"
        )
    
    # Verificar permisos
    if current_user.role != UserRole.ADMIN and pqrs.assigned_to_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permisos para ver esta PQRS"
        )
    
    return {
        **pqrs.__dict__,
        "created_by": {
            "id": pqrs.created_by.id,
            "username": pqrs.created_by.username,
            "full_name": pqrs.created_by.full_name
        } if pqrs.created_by else None,
        "assigned_to": {
            "id": pqrs.assigned_to.id,
            "username": pqrs.assigned_to.username,
            "full_name": pqrs.assigned_to.full_name
        } if pqrs.assigned_to else None
    }

@router.put("/{pqrs_id}", response_model=PQRSSchema)
async def update_pqrs(
    pqrs_id: int,
    pqrs_update: PQRSUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Actualizar PQRS"""
    pqrs = db.query(PQRS).filter(PQRS.id == pqrs_id).first()
    
    if not pqrs:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="PQRS no encontrada"
        )
    
    # Verificar permisos
    if current_user.role != UserRole.ADMIN and pqrs.assigned_to_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permisos para editar esta PQRS"
        )
    
    # Actualizar campos
    update_data = pqrs_update.dict(exclude_unset=True)
    original_assigned_to_id = pqrs.assigned_to_id
    
    # Manejar cambios de estado
    if "estado" in update_data:
        # Validar que si se cambia a cerrado, debe tener respuesta
        if update_data["estado"] == EstadoPQRS.CERRADO and not pqrs.respuesta:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No se puede cerrar la PQRS sin haber enviado una respuesta al ciudadano"
            )
        # Validar que si el medio de respuesta es email y el correo falló, no se puede cerrar
        if (update_data["estado"] == EstadoPQRS.CERRADO
                and pqrs.medio_respuesta == MedioRespuesta.EMAIL
                and pqrs.email_enviado == False):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No se puede cerrar: el correo de respuesta no fue entregado al ciudadano. Reintente el envío primero."
            )
        if update_data["estado"] == EstadoPQRS.CERRADO and not pqrs.fecha_cierre:
            pqrs.fecha_cierre = datetime.utcnow()
        if update_data["estado"] == EstadoPQRS.RESUELTO and not pqrs.fecha_respuesta:
            pqrs.fecha_respuesta = datetime.utcnow()
    
    # Solo admin puede asignar PQRS
    if "assigned_to_id" in update_data and current_user.role != UserRole.ADMIN:
        del update_data["assigned_to_id"]
    elif "assigned_to_id" in update_data and not pqrs.fecha_delegacion:
        pqrs.fecha_delegacion = datetime.utcnow()
    
    for field, value in update_data.items():
        setattr(pqrs, field, value)
    
    db.commit()
    db.refresh(pqrs)

    # Si se cambió la asignación, crear alerta para el nuevo asignado
    try:
        if "assigned_to_id" in update_data:
            new_assigned = update_data.get("assigned_to_id")
            if new_assigned and new_assigned != original_assigned_to_id:
                db.add(Alert(
                    entity_id=pqrs.entity_id,
                    recipient_user_id=new_assigned,
                    type="PQRS_ASSIGNED",
                    title=f"Te asignaron la PQRS {pqrs.numero_radicado}",
                    message=f"Asunto: {pqrs.asunto}",
                    data=json.dumps({"pqrs_id": pqrs.id}),
                ))
                db.commit()
    except Exception:
        db.rollback()
    
    return pqrs

class AssignPayload(BaseModel):
    assigned_to_id: int
    justificacion: Optional[str] = None


@router.post("/{pqrs_id}/assign")
async def assign_pqrs(
    pqrs_id: int,
    payload: AssignPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)  # Cambiado para permitir secretarios
):
    """Asignar PQRS a un usuario (admin o secretario asignado) - Registra justificación y crea auditoria"""
    pqrs = db.query(PQRS).filter(PQRS.id == pqrs_id).first()
    
    if not pqrs:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="PQRS no encontrada"
        )
    
    # Validar permisos: Admin puede asignar cualquiera, Secretario solo las asignadas a él
    if current_user.role != UserRole.ADMIN:
        if current_user.role != UserRole.SECRETARIO or pqrs.assigned_to_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permiso para reasignar esta PQRS"
            )
    
    # Verificar que el usuario existe
    assigned_user = db.query(User).filter(User.id == payload.assigned_to_id).first()
    if not assigned_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado"
        )
    
    # Guardar usuario anterior para auditoria
    usuario_anterior_id = pqrs.assigned_to_id
    
    # Es reasignación si ya tenía alguien asignado O si es un secretario quien asigna
    es_reasignacion = usuario_anterior_id is not None or current_user.role == UserRole.SECRETARIO
    
    # Validar justificación obligatoria para reasignaciones
    if es_reasignacion and not payload.justificacion:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La justificación es obligatoria para reasignaciones"
        )
    
    # Actualizar asignación
    pqrs.assigned_to_id = payload.assigned_to_id
    pqrs.justificacion_asignacion = payload.justificacion
    if not pqrs.fecha_delegacion:
        pqrs.fecha_delegacion = datetime.utcnow()
    
    # Crear registro de auditoría
    auditoria = AsignacionAuditoria(
        pqrs_id=pqrs_id,
        usuario_anterior_id=usuario_anterior_id,
        usuario_nuevo_id=payload.assigned_to_id,
        justificacion=payload.justificacion
    )
    db.add(auditoria)
    db.commit()

    # Crear alerta para el usuario asignado
    try:
        db.add(Alert(
            entity_id=pqrs.entity_id,
            recipient_user_id=payload.assigned_to_id,
            type="PQRS_ASSIGNED",
            title=f"Te asignaron la PQRS {pqrs.numero_radicado}",
            message=f"Asunto: {pqrs.asunto}",
            data=json.dumps({"pqrs_id": pqrs.id}),
        ))
        db.commit()
    except Exception as _:
        db.rollback()
    
    return {"message": f"PQRS asignada a {assigned_user.full_name}"}

@router.get("/{pqrs_id}/historial-asignaciones")
async def get_asignacion_historial(
    pqrs_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Obtener historial de asignaciones de una PQRS"""
    pqrs = db.query(PQRS).filter(PQRS.id == pqrs_id).first()
    
    if not pqrs:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="PQRS no encontrada"
        )
    
    # Verificar permisos
    if current_user.role != UserRole.ADMIN and pqrs.assigned_to_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permisos para ver esta información"
        )
    
    historial = db.query(AsignacionAuditoria).filter(
        AsignacionAuditoria.pqrs_id == pqrs_id
    ).order_by(AsignacionAuditoria.fecha_asignacion.desc()).all()
    
    return [{
        "id": h.id,
        "pqrs_id": h.pqrs_id,
        "usuario_anterior": {
            "id": h.usuario_anterior.id,
            "full_name": h.usuario_anterior.full_name
        } if h.usuario_anterior else None,
        "usuario_nuevo": {
            "id": h.usuario_nuevo.id,
            "full_name": h.usuario_nuevo.full_name
        } if h.usuario_nuevo else None,
        "justificacion": h.justificacion,
        "fecha_asignacion": h.fecha_asignacion
    } for h in historial]

@router.post("/{pqrs_id}/respond", response_model=PQRSSchema)
async def respond_pqrs(
    pqrs_id: int,
    response_data: PQRSResponse,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Responder PQRS"""
    pqrs = db.query(PQRS).filter(PQRS.id == pqrs_id).first()
    
    if not pqrs:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="PQRS no encontrada"
        )
    
    # Verificar permisos
    is_admin = current_user.role in (UserRole.ADMIN, UserRole.SUPERADMIN)
    if not is_admin and pqrs.assigned_to_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permisos para responder esta PQRS"
        )
    
    pqrs.respuesta = response_data.respuesta
    pqrs.estado = EstadoPQRS.RESUELTO
    pqrs.fecha_respuesta = datetime.utcnow()
    
    db.commit()
    db.refresh(pqrs)
    
    # Enviar correo de respuesta al ciudadano si tiene email
    if pqrs.email_ciudadano:
        try:
            # Obtener información de la entidad
            entity = db.query(Entity).filter(Entity.id == pqrs.entity_id).first()
            entity_name = entity.name if entity else "Sistema PQRS"
            entity_email = entity.email if entity and entity.email else None
            entity_slug = entity.slug if entity else "portal"
            
            # Generar URL pre-firmada para archivo de respuesta si existe
            archivo_url = None
            if pqrs.archivo_respuesta:
                try:
                    file_key = pqrs.archivo_respuesta.split(f"{S3_BUCKET}.s3.{S3_REGION}.amazonaws.com/")[1]
                    archivo_url = s3_client.generate_presigned_url(
                        'get_object',
                        Params={'Bucket': S3_BUCKET, 'Key': file_key},
                        ExpiresIn=604800  # 7 días en segundos
                    )
                    print(f"📎 URL pre-firmada generada para archivo de respuesta (válida por 7 días)")
                except Exception as e:
                    print(f"⚠️ Error generando URL pre-firmada: {e}")
                    archivo_url = pqrs.archivo_respuesta
            
            # Enviar correo y registrar resultado
            sent = email_service.send_pqrs_respuesta_notification(
                to_email=pqrs.email_ciudadano,
                numero_radicado=pqrs.numero_radicado,
                asunto=pqrs.asunto,
                nombre_ciudadano=pqrs.nombre_ciudadano or "Ciudadano",
                respuesta=response_data.respuesta,
                entity_name=entity_name,
                entity_slug=entity_slug,
                fecha_respuesta=format_colombia_datetime(pqrs.fecha_respuesta),
                archivo_adjunto_url=archivo_url,
                entity_email=entity_email
            )
            if sent:
                pqrs.email_enviado = True
                pqrs.email_error = None
                print(f"✅ Correo de respuesta enviado a {pqrs.email_ciudadano}")
            else:
                pqrs.email_enviado = False
                pqrs.email_error = "El proveedor de correo rechazó el envío. Verifique el correo del ciudadano."
                print(f"⚠️ El proveedor rechazó el correo a {pqrs.email_ciudadano}")
        except Exception as email_exc:
            import traceback
            pqrs.email_enviado = False
            pqrs.email_error = str(email_exc)[:500]
            print(f"⚠️ Error enviando correo de respuesta: {email_exc}")
            print(f"Traceback completo: {traceback.format_exc()}")
        db.commit()
        db.refresh(pqrs)
    else:
        # Sin email de ciudadano: no aplica seguimiento de correo
        pqrs.email_enviado = None
        pqrs.email_error = None
        db.commit()
        db.refresh(pqrs)
    
    return pqrs


@router.post("/{pqrs_id}/retry-email", response_model=dict)
async def retry_email_pqrs(
    pqrs_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Reintentar el envío del correo de respuesta a un ciudadano cuando falló previamente."""
    pqrs = db.query(PQRS).filter(PQRS.id == pqrs_id, PQRS.entity_id == current_user.entity_id).first()
    if not pqrs:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="PQRS no encontrada")
    if not pqrs.respuesta:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="La PQRS no tiene respuesta registrada")
    if not pqrs.email_ciudadano:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="La PQRS no tiene correo del ciudadano")

    is_admin = current_user.role in (UserRole.ADMIN, UserRole.SUPERADMIN)
    if not is_admin and pqrs.assigned_to_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tienes permisos para reintentar el envío")

    try:
        entity = db.query(Entity).filter(Entity.id == pqrs.entity_id).first()
        entity_name = entity.name if entity else "Sistema PQRS"
        entity_email = entity.email if entity and entity.email else None
        entity_slug = entity.slug if entity else "portal"

        archivo_url = None
        if pqrs.archivo_respuesta:
            try:
                file_key = pqrs.archivo_respuesta.split(f"{S3_BUCKET}.s3.{S3_REGION}.amazonaws.com/")[1]
                archivo_url = s3_client.generate_presigned_url(
                    'get_object',
                    Params={'Bucket': S3_BUCKET, 'Key': file_key},
                    ExpiresIn=604800
                )
            except Exception:
                archivo_url = pqrs.archivo_respuesta

        sent = email_service.send_pqrs_respuesta_notification(
            to_email=pqrs.email_ciudadano,
            numero_radicado=pqrs.numero_radicado,
            asunto=pqrs.asunto,
            nombre_ciudadano=pqrs.nombre_ciudadano or "Ciudadano",
            respuesta=pqrs.respuesta,
            entity_name=entity_name,
            entity_slug=entity_slug,
            fecha_respuesta=format_colombia_datetime(pqrs.fecha_respuesta),
            archivo_adjunto_url=archivo_url,
            entity_email=entity_email
        )
        pqrs.email_enviado = sent
        pqrs.email_error = None if sent else "Reintento fallido. Verifique el correo del ciudadano."
        db.commit()
        return {"success": sent, "message": "Correo enviado exitosamente" if sent else "Error al reenviar el correo"}
    except Exception as e:
        pqrs.email_enviado = False
        pqrs.email_error = str(e)[:500]
        db.commit()
        return {"success": False, "message": f"Error al reenviar: {str(e)[:200]}"}

@router.delete("/{pqrs_id}")
async def delete_pqrs(
    pqrs_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Eliminar PQRS (solo admin) - también elimina el archivo adjunto de S3 si existe"""
    pqrs = db.query(PQRS).filter(PQRS.id == pqrs_id).first()
    
    if not pqrs:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="PQRS no encontrada"
        )
    
    # Eliminar archivo de S3 si existe
    if pqrs.archivo_adjunto:
        try:
            # Extraer la key del archivo de la URL
            file_key = pqrs.archivo_adjunto.split(f"{S3_BUCKET}.s3.{S3_REGION}.amazonaws.com/")[1]
            s3_client.delete_object(Bucket=S3_BUCKET, Key=file_key)
            print(f"✅ Archivo eliminado de S3: {file_key}")
        except Exception as e:
            print(f"⚠️ Error eliminando archivo de S3: {e}")
            # Continuar con la eliminación de la PQRS aunque falle la eliminación del archivo
    
    db.delete(pqrs)
    db.commit()
    
    return {"message": "PQRS eliminada exitosamente"}

# ENDPOINT PÚBLICO - No requiere autenticación
@router.get("/public/consultar/{numero_radicado}", response_model=PQRSSchema)
async def consultar_pqrs_public(
    numero_radicado: str,
    db: Session = Depends(get_db)
):
    """
    Consultar PQRS por número de radicado (endpoint público para ventanilla).
    No requiere autenticación.
    """
    pqrs = db.query(PQRS).filter(PQRS.numero_radicado == numero_radicado.strip()).first()
    
    if not pqrs:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No se encontró ninguna PQRS con el número de radicado: {numero_radicado}"
        )
    
    return pqrs


# Configuración S3
S3_BUCKET = "softone360-pqrs-archivos"
S3_REGION = "us-east-1"
s3_client = boto3.client('s3', region_name=S3_REGION)


@router.post("/{pqrs_id}/upload", response_model=dict)
async def upload_archivo_pqrs(
    pqrs_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Subir archivo PDF adjunto a una PQRS.
    El archivo se almacena en S3 y se guarda la URL en la base de datos.
    """
    # Validar que la PQRS existe
    pqrs = db.query(PQRS).filter(PQRS.id == pqrs_id).first()
    if not pqrs:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"PQRS con ID {pqrs_id} no encontrada"
        )
    
    # Validar permisos: admin, usuario de la misma entidad, o creador de la PQRS (ciudadano)
    is_creator = (pqrs.created_by_id == current_user.id)
    is_same_entity = (current_user.entity_id == pqrs.entity_id)
    is_admin = (current_user.role == UserRole.ADMIN or current_user.role == UserRole.SUPERADMIN)
    
    if not (is_creator or is_same_entity or is_admin):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permisos para subir archivos a esta PQRS"
        )
    
    # Validar tipo de archivo (permitir varios tipos MIME de PDF y documentos)
    allowed_types = [
        "application/pdf",
        "application/x-pdf",
        "application/octet-stream",  # Algunos navegadores usan esto
        "image/jpeg",
        "image/jpg",
        "image/png",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Tipo de archivo no permitido: {file.content_type}. Permitidos: PDF, imágenes, Word"
        )
    
    # Validar tamaño (10MB máximo)
    file_content = await file.read()
    if len(file_content) > 10 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El archivo no debe superar 10 MB"
        )
    
    try:
        # Generar nombre único para el archivo
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        # Obtener extensión del archivo original
        file_extension = file.filename.split('.')[-1] if '.' in file.filename else 'pdf'
        file_key = f"pqrs/{pqrs.entity_id}/{pqrs.numero_radicado}_{timestamp}.{file_extension}"
        
        # Subir a S3
        s3_client.put_object(
            Bucket=S3_BUCKET,
            Key=file_key,
            Body=file_content,
            ContentType=file.content_type,
            Metadata={
                "pqrs_id": str(pqrs_id),
                "numero_radicado": pqrs.numero_radicado,
                "uploaded_by": current_user.username
            }
        )
        
        # Actualizar PQRS con la URL del archivo
        file_url = f"https://{S3_BUCKET}.s3.{S3_REGION}.amazonaws.com/{file_key}"
        archivo_adjunto_previo = pqrs.archivo_adjunto  # guardar antes de actualizar
        pqrs.archivo_adjunto = file_url
        db.commit()

        # Si es el primer archivo adjunto en una PQRS PENDIENTE con email, enviar el correo con el link
        if archivo_adjunto_previo is None and pqrs.estado == EstadoPQRS.PENDIENTE and pqrs.email_ciudadano:
            try:
                entity = db.query(Entity).filter(Entity.id == pqrs.entity_id).first()
                entity_name = entity.name if entity else "Sistema PQRS"
                entity_email = entity.email if entity and entity.email else None
                entity_slug = entity.slug if entity else "portal"
                archivo_adjunto_url = s3_client.generate_presigned_url(
                    'get_object',
                    Params={'Bucket': S3_BUCKET, 'Key': file_key},
                    ExpiresIn=604800  # 7 días
                )
                email_service.send_pqrs_radicada_notification(
                    to_email=pqrs.email_ciudadano,
                    numero_radicado=pqrs.numero_radicado,
                    tipo_solicitud=pqrs.tipo_solicitud.value,
                    asunto=pqrs.asunto or "Sin asunto",
                    nombre_ciudadano=pqrs.nombre_ciudadano or "Ciudadano",
                    entity_name=entity_name,
                    entity_slug=entity_slug,
                    fecha_radicacion=format_colombia_datetime(pqrs.fecha_solicitud),
                    archivo_adjunto_url=archivo_adjunto_url,
                    entity_email=entity_email
                )
                print(f"✅ Correo de radicación (con adjunto) enviado a {pqrs.email_ciudadano}")
            except Exception as email_error:
                import traceback
                print(f"⚠️ Error enviando correo con adjunto: {email_error}")
                print(f"Traceback completo: {traceback.format_exc()}")

        return {
            "message": "Archivo subido exitosamente",
            "archivo_url": file_url,
            "file_url": file_url,
            "file_key": file_key
        }
        
    except ClientError as e:
        print(f"❌ Error subiendo archivo a S3: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al subir el archivo: {str(e)}"
        )
    except Exception as e:
        print(f"❌ Error inesperado: {e}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error procesando el archivo: {str(e)}"
        )


@router.post("/{pqrs_id}/upload-respuesta", response_model=dict)
async def upload_archivo_respuesta(
    pqrs_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Subir archivo adjunto para la respuesta oficial de una PQRS.
    Solo admin y secretario asignado pueden subir.
    """
    try:
        print(f"📎 Iniciando upload de archivo de respuesta para PQRS ID: {pqrs_id}")
        print(f"   Usuario: {current_user.username}")
        print(f"   Archivo: {file.filename}, Content-Type: {file.content_type}")
        
        # Validar que la PQRS existe
        pqrs = db.query(PQRS).filter(PQRS.id == pqrs_id).first()
        if not pqrs:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"PQRS con ID {pqrs_id} no encontrada"
            )
        
        # Validar permisos: admin, superadmin o secretario asignado
        is_admin = current_user.role in (UserRole.ADMIN, UserRole.SUPERADMIN)
        if not is_admin and pqrs.assigned_to_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permisos para subir archivos de respuesta a esta PQRS"
            )
        
        # Validar tipo de archivo
        allowed_types = [
            "application/pdf",
            "application/x-pdf",
            "application/octet-stream",
            "image/jpeg",
            "image/jpg",
            "image/png",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        ]
        if file.content_type not in allowed_types:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Tipo de archivo no permitido: {file.content_type}"
            )
        
        # Validar tamaño (10MB máximo)
        file_content = await file.read()
        file_size_mb = len(file_content) / (1024 * 1024)
        print(f"   Tamaño del archivo: {file_size_mb:.2f} MB")
        
        if len(file_content) > 10 * 1024 * 1024:
            print(f"❌ Archivo muy grande: {file_size_mb:.2f} MB > 10 MB")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El archivo no debe superar 10 MB"
            )
        
        # Generar nombre único para el archivo de respuesta
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        file_extension = file.filename.split('.')[-1] if '.' in file.filename else 'pdf'
        file_key = f"pqrs/{pqrs.entity_id}/respuesta_{pqrs.numero_radicado}_{timestamp}.{file_extension}"
        
        print(f"   Subiendo a S3: {file_key}")
        
        # Subir a S3
        s3_client.put_object(
            Bucket=S3_BUCKET,
            Key=file_key,
            Body=file_content,
            ContentType=file.content_type,
            Metadata={
                "pqrs_id": str(pqrs_id),
                "numero_radicado": pqrs.numero_radicado,
                "tipo": "respuesta",
                "uploaded_by": current_user.username
            }
        )
        
        # Actualizar PQRS con la URL del archivo de respuesta
        file_url = f"https://{S3_BUCKET}.s3.{S3_REGION}.amazonaws.com/{file_key}"
        pqrs.archivo_respuesta = file_url
        db.commit()
        
        print(f"✅ Archivo de respuesta subido exitosamente: {file_url}")
        
        return {
            "message": "Archivo de respuesta subido exitosamente",
            "archivo_url": file_url,
            "file_key": file_key
        }
        
    except ClientError as e:
        print(f"❌ Error subiendo archivo de respuesta a S3: {e}")
        import traceback
        print(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al subir el archivo: {str(e)}"
        )
    except Exception as e:
        print(f"❌ Error inesperado en upload-respuesta: {e}")
        import traceback
        print(f"Traceback: {traceback.format_exc()}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error procesando el archivo: {str(e)}"
        )


@router.get("/{pqrs_id}/archivo/download-url", response_model=dict)
async def get_archivo_download_url(
    pqrs_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Generar URL de descarga temporal (presigned URL) para el archivo adjunto de una PQRS.
    La URL es válida por 1 hora.
    """
    # Buscar PQRS
    pqrs = db.query(PQRS).filter(PQRS.id == pqrs_id).first()
    if not pqrs:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"PQRS con ID {pqrs_id} no encontrada"
        )
    
    # Validar que tiene archivo adjunto
    if not pqrs.archivo_adjunto:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Esta PQRS no tiene archivo adjunto"
        )
    
    # Validar permisos
    if current_user.role != UserRole.ADMIN and current_user.entity_id != pqrs.entity_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permisos para acceder a este archivo"
        )
    
    try:
        # Extraer la key del archivo de la URL
        file_key = pqrs.archivo_adjunto.split(f"{S3_BUCKET}.s3.{S3_REGION}.amazonaws.com/")[1]
        
        # Generar presigned URL válida por 1 hora
        presigned_url = s3_client.generate_presigned_url(
            'get_object',
            Params={
                'Bucket': S3_BUCKET,
                'Key': file_key
            },
            ExpiresIn=3600  # 1 hora
        )
        
        return {
            "download_url": presigned_url,
            "expires_in": 3600,
            "filename": file_key.split('/')[-1]
        }
        
    except ClientError as e:
        print(f"❌ Error generando presigned URL: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al generar URL de descarga: {str(e)}"
        )
    except Exception as e:
        print(f"❌ Error inesperado: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error procesando la solicitud: {str(e)}"
        )


# Schema para request de generación de informe
class GenerarInformeRequest(BaseModel):
    fecha_inicio: str  # YYYY-MM-DD
    fecha_fin: str  # YYYY-MM-DD
    estado: Optional[str] = None  # Filtro por estado
    tipo: Optional[str] = None  # Filtro por tipo
    usar_ia: bool = True  # Usar análisis de IA
    usuario_firmante_id: Optional[int] = None  # ID del usuario que firma el informe


@router.post("/generar-informe-pdf", response_model=dict)
async def generar_informe_pdf(
    request: GenerarInformeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Genera informe PDF de PQRS con gráficos estadísticos en backend.
    
    Características:
    - Generación de gráficos con matplotlib (backend)
    - Análisis con IA opcional (OpenAI)
    - Overlay de template PDF institucional si existe
    - Almacenamiento en S3
    - URL pre-firmada para descarga (válida 7 días)
    
    Permisos: Admin y Superadmin
    """
    # Validar permisos
    if current_user.role not in [UserRole.ADMIN, UserRole.SUPERADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permisos para generar informes"
        )
    
    try:
        print(f"\n{'='*70}")
        print(f"📊 GENERANDO INFORME PDF DE PQRS")
        print(f"{'='*70}")
        print(f"Usuario: {current_user.username}")
        print(f"Entidad: {current_user.entity_id}")
        print(f"Período: {request.fecha_inicio} - {request.fecha_fin}")
        print(f"Usar IA: {request.usar_ia}")
        
        # Obtener entidad
        entity = db.query(Entity).filter(Entity.id == current_user.entity_id).first()
        if not entity:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Entidad no encontrada"
            )
        
        # Parsear fechas
        try:
            fecha_inicio_dt = datetime.strptime(request.fecha_inicio, '%Y-%m-%d')
            fecha_fin_dt = datetime.strptime(request.fecha_fin, '%Y-%m-%d')
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Formato de fecha inválido. Use YYYY-MM-DD"
            )
        
        # Construir query de PQRS
        query = db.query(PQRS).filter(
            PQRS.entity_id == current_user.entity_id,
            PQRS.fecha_solicitud >= fecha_inicio_dt,
            PQRS.fecha_solicitud <= fecha_fin_dt
        )
        
        # Aplicar filtros opcionales
        if request.estado:
            query = query.filter(PQRS.estado == request.estado)
        if request.tipo:
            query = query.filter(PQRS.tipo_solicitud == request.tipo)
        
        # Obtener PQRS
        pqrs_query_result = query.order_by(PQRS.fecha_solicitud.desc()).all()
        
        if not pqrs_query_result:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No se encontraron PQRS en el rango de fechas seleccionado"
            )
        
        print(f"✅ PQRS encontradas: {len(pqrs_query_result)}")
        
        # Convertir a diccionarios para el generador
        pqrs_list = []
        for pqrs in pqrs_query_result:
            # Calcular días de respuesta si existe fecha_respuesta
            dias_respuesta = None
            if pqrs.fecha_respuesta and pqrs.fecha_solicitud:
                dias_respuesta = (pqrs.fecha_respuesta - pqrs.fecha_solicitud).days
            
            pqrs_dict = {
                'id': pqrs.id,
                'numero_radicado': pqrs.numero_radicado,
                'tipo_solicitud': pqrs.tipo_solicitud.value if hasattr(pqrs.tipo_solicitud, 'value') else str(pqrs.tipo_solicitud),
                'estado': pqrs.estado.value if hasattr(pqrs.estado, 'value') else str(pqrs.estado),
                'fecha_solicitud': pqrs.fecha_solicitud.isoformat() if pqrs.fecha_solicitud else None,
                'fecha_respuesta': pqrs.fecha_respuesta.isoformat() if pqrs.fecha_respuesta else None,
                'dias_respuesta': dias_respuesta,
                'asunto': pqrs.asunto,
                'assigned_to': {
                    'full_name': pqrs.assigned_to.full_name
                } if pqrs.assigned_to else None
            }
            pqrs_list.append(pqrs_dict)
        
        # Calcular analytics
        total = len(pqrs_list)
        pendientes = len([p for p in pqrs_list if p['estado'] == 'pendiente'])
        en_proceso = len([p for p in pqrs_list if p['estado'] == 'en_proceso'])
        resueltas = len([p for p in pqrs_list if p['estado'] == 'resuelto'])
        cerradas = len([p for p in pqrs_list if p['estado'] == 'cerrado'])
        
        # Tipos de PQRS
        tipos_pqrs = {}
        for pqrs in pqrs_list:
            tipo = pqrs['tipo_solicitud']
            tipos_pqrs[tipo] = tipos_pqrs.get(tipo, 0) + 1
        
        # Tiempo promedio de respuesta
        pqrs_con_respuesta = [p for p in pqrs_list if p['fecha_respuesta']]
        tiempo_promedio = 0
        if pqrs_con_respuesta:
            tiempos = []
            for p in pqrs_con_respuesta:
                inicio = datetime.fromisoformat(p['fecha_solicitud'])
                fin = datetime.fromisoformat(p['fecha_respuesta'])
                dias = (fin - inicio).days
                tiempos.append(dias)
            tiempo_promedio = round(sum(tiempos) / len(tiempos))
        
        analytics = {
            'totalPqrs': total,
            'pendientes': pendientes,
            'enProceso': en_proceso,
            'resueltas': resueltas,
            'cerradas': cerradas,
            'tasaResolucion': round(((resueltas + cerradas) / total * 100), 1) if total > 0 else 0,
            'tiempoPromedioRespuesta': tiempo_promedio,
            'tiposPqrs': tipos_pqrs
        }
        
        logger.info(f"📈 Analytics calculadas: {analytics['totalPqrs']} total, {analytics['tasaResolucion']}% resolución")
        
        # Obtener análisis de IA si está habilitado (Bedrock + Claude 3)
        logger.info(f"🔍 DEBUG - request.usar_ia: {request.usar_ia}")
        logger.info(f"🔍 DEBUG - entity.enable_ai_reports: {entity.enable_ai_reports}")
        logger.info(f"🔍 DEBUG - entity.name: {entity.name}")
        
        ai_analysis = None
        if request.usar_ia and entity.enable_ai_reports:
            try:
                logger.info(f"🤖 Solicitando análisis de IA con Bedrock (Claude 3)...")
                from app.services.bedrock_ai_service import get_bedrock_service
                
                bedrock_service = get_bedrock_service()
                ai_analysis = bedrock_service.analizar_pqrs(
                    analytics=analytics,
                    entity_name=entity.name,
                    fecha_inicio=request.fecha_inicio,
                    fecha_fin=request.fecha_fin,
                    pqrs_list=pqrs_list
                )
                logger.info(f"✅ Análisis IA con Bedrock completado")
                logger.info(f"🔍 Usando respuesta de IA - Introducción: {ai_analysis.get('introduccion', '')[:100]}...")
            except Exception as e:
                logger.error(f"⚠️ Error generando análisis de IA: {e}")
                import traceback
                logger.error(f"Traceback: {traceback.format_exc()}")
                # Fallback a análisis genérico si Bedrock falla
                ai_analysis = None
        
        # Si no hay IA o falló, usar análisis por defecto
        if not ai_analysis:
            logger.warning(f"⚠️ Usando análisis por defecto (IA no disponible)")
            
            # Calcular métricas adicionales para análisis más rico
            tipos_ordenados = sorted(analytics['tiposPqrs'].items(), key=lambda x: x[1], reverse=True)
            tipo_principal = tipos_ordenados[0] if tipos_ordenados else ('N/A', 0)
            
            ai_analysis = {
                'introduccion': (
                    f"El presente informe corresponde a la gestión de Peticiones, Quejas, Reclamos, Solicitudes y Denuncias (PQRS) "
                    f"del {entity.name} durante el período comprendido entre {request.fecha_inicio} y {request.fecha_fin}. "
                    f"Durante este período se registró un total de {total} solicitudes ciudadanas, las cuales han sido atendidas "
                    f"a través de los diferentes canales de atención dispuestos por la entidad. "
                    f"Este informe presenta un análisis detallado de los indicadores de gestión, tiempos de respuesta, "
                    f"distribución por tipo y estado, así como recomendaciones orientadas a la mejora continua del servicio. "
                    f"La gestión de PQRS constituye un mecanismo fundamental para garantizar el derecho fundamental de petición "
                    f"consagrado en la Constitución Política y desarrollado en la Ley 1755 de 2015."
                ),
                'analisisGeneral': (
                    f"Durante el período analizado se registraron {total} PQRS, alcanzando una tasa de resolución del "
                    f"{analytics['tasaResolucion']:.1f}%, lo que refleja un desempeño "
                    f"{'satisfactorio y acorde con los estándares de calidad esperados' if analytics['tasaResolucion'] >= 70 else 'que requiere fortalecimiento para alcanzar niveles óptimos de gestión'}. "
                    f"Del total de solicitudes, {pendientes} se encuentran pendientes, {en_proceso} en proceso de atención, "
                    f"{resueltas} han sido resueltas satisfactoriamente y {cerradas} fueron cerradas. "
                    f"Estos indicadores permiten evidenciar el compromiso institucional con la atención oportuna y eficaz de las "
                    f"solicitudes ciudadanas. La distribución por estado refleja el flujo operativo del proceso de gestión de PQRS "
                    f"y permite identificar las etapas que requieren mayor atención o recursos. Es fundamental mantener un equilibrio "
                    f"adecuado entre las solicitudes en proceso y las resueltas para garantizar tiempos de respuesta óptimos. "
                    f"La gestión eficiente de PQRS no solo cumple con el marco normativo vigente, sino que además fortalece "
                    f"la confianza ciudadana en las instituciones públicas."
                ),
                'analisisTendencias': (
                    f"El análisis del período muestra un total de {total} solicitudes distribuidas en {len(analytics['tiposPqrs'])} "
                    f"tipos diferentes de PQRS. El tipo de solicitud más frecuente corresponde a "
                    f"{tipo_principal[0].replace('_', ' ').title()} con {tipo_principal[1]} casos, representando el "
                    f"{(tipo_principal[1]/total*100):.1f}% del total. Esta distribución permite identificar las principales "
                    f"necesidades y preocupaciones de la ciudadanía, orientando la toma de decisiones institucionales. "
                    f"Los tipos más frecuentes reflejan las prioridades y problemáticas que requieren atención por parte de la entidad. "
                    f"Es importante analizar si estos patrones son consistentes con períodos anteriores o si representan nuevas "
                    f"tendencias que requieran respuestas específicas. El comportamiento temporal de las solicitudes permite "
                    f"identificar posibles estacionalidades o eventos específicos que incrementan la demanda en determinados momentos. "
                    f"Este análisis debe orientar la planificación de recursos humanos y técnicos para garantizar una atención "
                    f"oportuna y de calidad en todo momento."
                ),
                'analisisTiempos': (
                    f"El tiempo promedio de respuesta registrado durante el período fue de {tiempo_promedio:.1f} días. "
                    f"De acuerdo con la Ley 1755 de 2015, el término legal general para responder PQRS es de 15 días hábiles, "
                    f"pudiendo prorrogarse por 10 días más cuando existan circunstancias excepcionales debidamente justificadas. "
                    f"{'El tiempo promedio se encuentra dentro de los parámetros legales establecidos, lo que evidencia el cumplimiento normativo de la entidad' if tiempo_promedio <= 15 else 'Se recomienda implementar acciones de mejora para optimizar los tiempos de respuesta y garantizar el cumplimiento de los plazos legales establecidos'}. "
                    f"Los tiempos de respuesta constituyen un indicador crítico de la eficiencia operativa y del compromiso "
                    f"institucional con la satisfacción ciudadana. Es fundamental mantener un monitoreo constante de este indicador "
                    f"e identificar oportunamente aquellos casos que puedan estar próximos al vencimiento de términos. "
                    f"La implementación de alertas tempranas y la asignación eficiente de responsables son estrategias clave "
                    f"para mantener y mejorar los tiempos de respuesta. Adicionalmente, es importante analizar las causas "
                    f"de demoras cuando estas se presenten, con el fin de implementar acciones correctivas específicas."
                ),
                'recomendaciones': [
                    "FORTALECIMIENTO DEL SEGUIMIENTO: Implementar un sistema de seguimiento periódico y automatizado de las PQRS para garantizar el cumplimiento de términos legales establecidos en la Ley 1755 de 2015. Este sistema debe incluir alertas tempranas para casos próximos al vencimiento, asignación clara de responsables y mecanismos de escalamiento cuando sea necesario. El seguimiento debe ser documentado y reportado mensualmente a la alta dirección.",
                    
                    "OPTIMIZACIÓN DE PROCESOS: Realizar una revisión exhaustiva de los procesos internos de gestión de PQRS con el objetivo de identificar cuellos de botella, tiempos muertos y actividades redundantes. Implementar mejoras basadas en principios de eficiencia operativa, simplificación de trámites y automatización de tareas repetitivas. Esta optimización debe buscar reducir los tiempos de respuesta sin comprometer la calidad de las mismas.",
                    
                    "FORTALECIMIENTO DE CANALES: Ampliar y fortalecer los canales de atención ciudadana (presencial, virtual, telefónico y escrito) para mejorar la accesibilidad al sistema de PQRS. Garantizar que todos los canales cuenten con personal capacitado, infraestructura tecnológica adecuada y procedimientos estandarizados. Implementar mecanismos de medición de satisfacción ciudadana en cada canal de atención.",
                    
                    "SISTEMA DE INDICADORES: Desarrollar e implementar un tablero integral de indicadores de gestión que permita el monitoreo continuo y en tiempo real del proceso de PQRS. Este debe incluir métricas de volumen, tiempos de respuesta, tasas de resolución, satisfacción ciudadana y cumplimiento normativo. Los indicadores deben ser revisados periódicamente en comités de gestión y desempeño.",
                    
                    "CAPACITACIÓN Y CULTURA: Diseñar e implementar un programa permanente de capacitación para funcionarios y contratistas sobre la normativa vigente (Ley 1755/2015, Decreto 1166/2016, Resolución 001519/2020) y mejores prácticas en atención ciudadana. Fomentar una cultura institucional orientada al servicio, la transparencia y el respeto por los derechos de los ciudadanos. La capacitación debe ser continua y evaluada en su efectividad."
                ],
                'conclusiones': (
                    f"La gestión de PQRS del {entity.name} durante el período analizado demuestra el compromiso institucional "
                    f"con la atención oportuna y eficaz de las solicitudes ciudadanas. Con un total de {total} PQRS gestionadas "
                    f"y una tasa de resolución del {analytics['tasaResolucion']:.1f}%, se evidencia un sistema funcional que "
                    f"responde a las necesidades de los ciudadanos. Sin embargo, como en todo proceso de mejora continua, existen "
                    f"oportunidades de fortalecimiento que han sido identificadas en este análisis. "
                    f"Es fundamental mantener el enfoque en la calidad de las respuestas, no solo en su oportunidad, garantizando "
                    f"que cada solicitud reciba una atención integral que resuelva efectivamente la situación planteada. "
                    f"La implementación de las recomendaciones formuladas permitirá elevar los estándares de gestión y consolidar "
                    f"un sistema de PQRS que sea referente de buenas prácticas en la administración pública. "
                    f"Se recomienda continuar con el monitoreo constante de los indicadores y la evaluación periódica del proceso, "
                    f"así como la socialización de resultados con todos los actores involucrados."
                )
            }
        
        # Generar PDF en executor (no bloquea el event loop)
        print(f"📄 Generando PDF...")
        from app.services.pqrs_report_generator import PQRSReportGenerator
        
        # Cargar usuario firmante si se especificó
        usuario_firmante = None
        if request.usuario_firmante_id:
            usuario_firmante = db.query(User).filter(
                User.id == request.usuario_firmante_id,
                User.entity_id == current_user.entity_id
            ).first()
            if usuario_firmante:
                print(f"✍️ Firmante: {usuario_firmante.full_name} - {usuario_firmante.secretaria or usuario_firmante.role.value}")
        
        generator = PQRSReportGenerator(
            entity=entity,
            pqrs_list=pqrs_list,
            analytics=analytics,
            ai_analysis=ai_analysis,
            fecha_inicio=request.fecha_inicio,
            fecha_fin=request.fecha_fin,
            usuario_firmante=usuario_firmante
        )
        
        loop = asyncio.get_event_loop()
        pdf_buffer = await loop.run_in_executor(None, generator.generate_pdf)
        pdf_content = pdf_buffer.read()
        pdf_size_mb = len(pdf_content) / (1024 * 1024)
        del pdf_buffer
        del generator
        gc.collect()
        
        print(f"✅ PDF generado: {pdf_size_mb:.2f} MB")
        
        # Subir a S3 en executor (no bloquea el event loop)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        file_key = f"informes-pqrs/{entity.slug}/informe_{request.fecha_inicio}_{request.fecha_fin}_{timestamp}.pdf"
        
        print(f"📤 Subiendo a S3: {file_key}")
        
        s3_put_kwargs = dict(
            Bucket=S3_BUCKET,
            Key=file_key,
            Body=pdf_content,
            ContentType='application/pdf',
            Metadata={
                "entity_id": str(entity.id),
                "entity_slug": entity.slug,
                "fecha_inicio": request.fecha_inicio,
                "fecha_fin": request.fecha_fin,
                "total_pqrs": str(total),
                "generated_by": current_user.username,
                "timestamp": timestamp
            }
        )
        await loop.run_in_executor(None, lambda: s3_client.put_object(**s3_put_kwargs))
        
        file_url = f"https://{S3_BUCKET}.s3.{S3_REGION}.amazonaws.com/{file_key}"
        
        # Generar URL pre-firmada (válida 7 días)
        download_url = s3_client.generate_presigned_url(
            'get_object',
            Params={'Bucket': S3_BUCKET, 'Key': file_key},
            ExpiresIn=604800  # 7 días
        )
        
        print(f"✅ Informe generado exitosamente")
        print(f"{'='*70}\n")
        
        return {
            "success": True,
            "message": "Informe generado exitosamente",
            "file_url": file_url,
            "download_url": download_url,
            "file_key": file_key,
            "file_size_mb": round(pdf_size_mb, 2),
            "total_pqrs": total,
            "tasa_resolucion": analytics['tasaResolucion'],
            "expires_in_days": 7,
            "used_template": entity.pdf_template_url is not None,
            "used_ai": ai_analysis is not None
        }
        
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"❌ Error generando informe: {e}")
        print(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generando informe: {str(e)}"
        )
