from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from datetime import datetime
import pytz
import boto3
from botocore.exceptions import ClientError
import os
import uuid

from app.config.database import get_db
from app.models.correspondencia import Correspondencia, EstadoCorrespondencia
from app.models.user import User, UserRole
from app.models.entity import Entity
from app.schemas.correspondencia import (
    CorrespondenciaCreate, 
    CorrespondenciaUpdate, 
    CorrespondenciaResponse,
    CorrespondenciaWithDetails
)
from app.utils.auth import get_current_active_user, require_admin
from app.utils.helpers import generate_radicado
from app.config.settings import settings

router = APIRouter(prefix="/correspondencia", tags=["Correspondencia"])


def get_colombia_time():
    """Retorna la hora actual en zona horaria de Colombia (UTC-5)"""
    colombia_tz = pytz.timezone(settings.timezone)
    return datetime.now(colombia_tz)


@router.post("/", response_model=CorrespondenciaResponse)
async def create_correspondencia(
    correspondencia_data: CorrespondenciaCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Crear nueva correspondencia"""
    
    try:
        # Generar número de radicado único
        numero_radicado = generate_radicado(db, entity_id=current_user.entity_id, prefix="CORR")
        
        # Verificar unicidad
        max_intentos = 10
        intentos = 0
        while db.query(Correspondencia).filter(
            Correspondencia.numero_radicado == numero_radicado
        ).first() and intentos < max_intentos:
            numero_radicado = generate_radicado(db, entity_id=current_user.entity_id, prefix="CORR")
            intentos += 1
        
        if intentos >= max_intentos:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="No se pudo generar un número de radicado único"
            )
        
        # Validar campos según tipo de radicación
        from app.models.correspondencia import TipoRadicacion
        if correspondencia_data.tipo_radicacion == TipoRadicacion.CORREO:
            if not correspondencia_data.correo_electronico:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="El correo electrónico es obligatorio para radicación por correo"
                )
        elif correspondencia_data.tipo_radicacion == TipoRadicacion.FISICO:
            if not correspondencia_data.direccion_radicacion:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="La dirección es obligatoria para radicación física"
                )
        
        # Crear correspondencia
        nueva_correspondencia = Correspondencia(
            numero_radicado=numero_radicado,
            fecha_envio=correspondencia_data.fecha_envio,
            procedencia=correspondencia_data.procedencia,
            destinacion=correspondencia_data.destinacion,
            numero_folios=correspondencia_data.numero_folios,
            tipo_radicacion=correspondencia_data.tipo_radicacion,
            correo_electronico=correspondencia_data.correo_electronico,
            direccion_radicacion=correspondencia_data.direccion_radicacion,
            tipo_solicitud=correspondencia_data.tipo_solicitud,
            archivo_solicitud=correspondencia_data.archivo_solicitud,
            archivo_respuesta=correspondencia_data.archivo_respuesta,
            estado=correspondencia_data.estado,
            tiempo_respuesta_dias=correspondencia_data.tiempo_respuesta_dias,
            observaciones=correspondencia_data.observaciones,
            respuesta=correspondencia_data.respuesta,
            created_by_id=current_user.id,
            entity_id=current_user.entity_id
        )
        
        db.add(nueva_correspondencia)
        db.commit()
        db.refresh(nueva_correspondencia)
        
        return nueva_correspondencia
    
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"❌ Error creando correspondencia: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creando correspondencia: {str(e)}"
        )


@router.get("/", response_model=List[CorrespondenciaWithDetails])
async def get_correspondencias(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    estado: Optional[str] = Query(None),
    tipo_solicitud: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000)
):
    """Obtener lista de correspondencias"""
    
    query = db.query(Correspondencia).filter(
        Correspondencia.entity_id == current_user.entity_id
    )
    
    # Filtros
    if estado:
        query = query.filter(Correspondencia.estado == estado)
    if tipo_solicitud:
        query = query.filter(Correspondencia.tipo_solicitud == tipo_solicitud)
    
    # Si es secretario, solo ver las asignadas a él
    if current_user.role == UserRole.SECRETARIO:
        query = query.filter(Correspondencia.assigned_to_id == current_user.id)
    
    # Ordenar por fecha de creación descendente
    correspondencias = query.order_by(
        Correspondencia.created_at.desc()
    ).offset(skip).limit(limit).all()
    
    # Enriquecer con detalles de usuarios
    result = []
    for corr in correspondencias:
        corr_dict = {
            "id": corr.id,
            "numero_radicado": corr.numero_radicado,
            "fecha_envio": corr.fecha_envio,
            "procedencia": corr.procedencia,
            "destinacion": corr.destinacion,
            "numero_folios": corr.numero_folios,
            "tipo_radicacion": corr.tipo_radicacion,
            "correo_electronico": corr.correo_electronico,
            "direccion_radicacion": corr.direccion_radicacion,
            "tipo_solicitud": corr.tipo_solicitud,
            "archivo_solicitud": corr.archivo_solicitud,
            "archivo_respuesta": corr.archivo_respuesta,
            "estado": corr.estado,
            "tiempo_respuesta_dias": corr.tiempo_respuesta_dias,
            "observaciones": corr.observaciones,
            "respuesta": corr.respuesta,
            "created_at": corr.created_at,
            "updated_at": corr.updated_at,
            "fecha_respuesta": corr.fecha_respuesta,
            "created_by_id": corr.created_by_id,
            "assigned_to_id": corr.assigned_to_id,
            "entity_id": corr.entity_id,
            "created_by_name": corr.created_by.full_name if corr.created_by else None,
            "assigned_to_name": corr.assigned_to.full_name if corr.assigned_to else None
        }
        result.append(corr_dict)
    
    return result


@router.get("/{correspondencia_id}", response_model=CorrespondenciaWithDetails)
async def get_correspondencia(
    correspondencia_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Obtener correspondencia por ID"""
    
    correspondencia = db.query(Correspondencia).filter(
        Correspondencia.id == correspondencia_id,
        Correspondencia.entity_id == current_user.entity_id
    ).first()
    
    if not correspondencia:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Correspondencia no encontrada"
        )
    
    # Verificar permisos
    if current_user.role == UserRole.SECRETARIO:
        if correspondencia.assigned_to_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permiso para ver esta correspondencia"
            )
    
    return {
        **correspondencia.__dict__,
        "created_by_name": correspondencia.created_by.full_name if correspondencia.created_by else None,
        "assigned_to_name": correspondencia.assigned_to.full_name if correspondencia.assigned_to else None
    }


@router.put("/{correspondencia_id}", response_model=CorrespondenciaResponse)
async def update_correspondencia(
    correspondencia_id: int,
    correspondencia_data: CorrespondenciaUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Actualizar correspondencia"""
    
    correspondencia = db.query(Correspondencia).filter(
        Correspondencia.id == correspondencia_id,
        Correspondencia.entity_id == current_user.entity_id
    ).first()
    
    if not correspondencia:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Correspondencia no encontrada"
        )
    
    # Verificar permisos
    if current_user.role == UserRole.SECRETARIO:
        if correspondencia.assigned_to_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permiso para editar esta correspondencia"
            )
    
    # Actualizar campos
    update_data = correspondencia_data.model_dump(exclude_unset=True)
    
    # Si se está actualizando el estado a RESUELTA, registrar fecha de respuesta
    if "estado" in update_data and update_data["estado"] == EstadoCorrespondencia.RESUELTA:
        if correspondencia.estado != EstadoCorrespondencia.RESUELTA:
            update_data["fecha_respuesta"] = get_colombia_time()
    
    for field, value in update_data.items():
        setattr(correspondencia, field, value)
    
    try:
        db.commit()
        db.refresh(correspondencia)
        return correspondencia
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error actualizando correspondencia: {str(e)}"
        )


@router.delete("/{correspondencia_id}")
async def delete_correspondencia(
    correspondencia_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Eliminar correspondencia (solo admin)"""
    
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo los administradores pueden eliminar correspondencia"
        )
    
    correspondencia = db.query(Correspondencia).filter(
        Correspondencia.id == correspondencia_id,
        Correspondencia.entity_id == current_user.entity_id
    ).first()
    
    if not correspondencia:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Correspondencia no encontrada"
        )
    
    try:
        db.delete(correspondencia)
        db.commit()
        return {"message": "Correspondencia eliminada exitosamente"}
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error eliminando correspondencia: {str(e)}"
        )


@router.get("/next-radicado/preview")
async def preview_next_radicado(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Vista previa del siguiente número de radicado"""
    
    try:
        next_radicado = generate_radicado(db, entity_id=current_user.entity_id, prefix="CORR")
        return {"numero_radicado": next_radicado}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generando radicado: {str(e)}"
        )


# Configuración S3
S3_BUCKET = "softone360-pqrs-archivos"
S3_REGION = "us-east-1"
s3_client = boto3.client('s3', region_name=S3_REGION)


@router.post("/{correspondencia_id}/upload-solicitud", response_model=dict)
async def upload_archivo_solicitud(
    correspondencia_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Subir archivo de solicitud para una correspondencia.
    El archivo se almacena en S3 y se guarda la URL en la base de datos.
    """
    # Validar que la correspondencia existe
    correspondencia = db.query(Correspondencia).filter(Correspondencia.id == correspondencia_id).first()
    if not correspondencia:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Correspondencia con ID {correspondencia_id} no encontrada"
        )
    
    # Validar permisos
    is_creator = (correspondencia.created_by_id == current_user.id)
    is_same_entity = (current_user.entity_id == correspondencia.entity_id)
    is_admin = (current_user.role == UserRole.ADMIN)
    
    if not (is_creator or is_same_entity or is_admin):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permisos para subir archivos a esta correspondencia"
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
        file_extension = file.filename.split('.')[-1] if '.' in file.filename else 'pdf'
        file_key = f"correspondencia/{correspondencia.entity_id}/solicitud_{correspondencia.numero_radicado}_{timestamp}.{file_extension}"
        
        # Subir a S3
        s3_client.put_object(
            Bucket=S3_BUCKET,
            Key=file_key,
            Body=file_content,
            ContentType=file.content_type,
            Metadata={
                "correspondencia_id": str(correspondencia_id),
                "numero_radicado": correspondencia.numero_radicado,
                "tipo": "solicitud",
                "uploaded_by": current_user.username
            }
        )
        
        # Actualizar correspondencia con la URL del archivo
        file_url = f"https://{S3_BUCKET}.s3.{S3_REGION}.amazonaws.com/{file_key}"
        correspondencia.archivo_solicitud = file_url
        db.commit()
        
        return {
            "message": "Archivo de solicitud subido exitosamente",
            "archivo_url": file_url,
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


@router.post("/{correspondencia_id}/upload-respuesta", response_model=dict)
async def upload_archivo_respuesta(
    correspondencia_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Subir archivo adjunto para la respuesta de una correspondencia.
    Solo admin y usuarios de la misma entidad pueden subir.
    """
    try:
        print(f"📎 Iniciando upload de archivo de respuesta para Correspondencia ID: {correspondencia_id}")
        print(f"   Usuario: {current_user.username}")
        print(f"   Archivo: {file.filename}, Content-Type: {file.content_type}")
        
        # Validar que la correspondencia existe
        correspondencia = db.query(Correspondencia).filter(Correspondencia.id == correspondencia_id).first()
        if not correspondencia:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Correspondencia con ID {correspondencia_id} no encontrada"
            )
        
        # Validar permisos: admin o usuario de la misma entidad
        if current_user.role != UserRole.ADMIN and correspondencia.entity_id != current_user.entity_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permisos para subir archivos de respuesta a esta correspondencia"
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
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El archivo no debe superar 10 MB"
            )
        
        # Generar nombre único para el archivo
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        file_extension = file.filename.split('.')[-1] if '.' in file.filename else 'pdf'
        file_key = f"correspondencia/{correspondencia.entity_id}/respuesta_{correspondencia.numero_radicado}_{timestamp}.{file_extension}"
        
        print(f"   Subiendo a S3: {file_key}")
        
        # Subir a S3
        s3_client.put_object(
            Bucket=S3_BUCKET,
            Key=file_key,
            Body=file_content,
            ContentType=file.content_type,
            Metadata={
                "correspondencia_id": str(correspondencia_id),
                "numero_radicado": correspondencia.numero_radicado,
                "tipo": "respuesta",
                "uploaded_by": current_user.username
            }
        )
        
        # Actualizar correspondencia con la URL del archivo
        file_url = f"https://{S3_BUCKET}.s3.{S3_REGION}.amazonaws.com/{file_key}"
        correspondencia.archivo_respuesta = file_url
        db.commit()
        
        print(f"✅ Archivo de respuesta subido exitosamente: {file_url}")
        
        return {
            "message": "Archivo de respuesta subido exitosamente",
            "archivo_url": file_url,
            "file_key": file_key
        }
        
    except HTTPException:
        raise
    except ClientError as e:
        print(f"❌ Error de S3: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al subir el archivo a S3: {str(e)}"
        )
    except Exception as e:
        print(f"❌ Error inesperado: {e}")
        import traceback
        print(f"Traceback: {traceback.format_exc()}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error procesando el archivo: {str(e)}"
        )
