from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel
import json
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from datetime import datetime
from app.config.database import get_db
from app.models.pqrs import PQRS, EstadoPQRS
from app.models.user import User, UserRole
from app.schemas.pqrs import PQRSCreate, PQRSUpdate, PQRS as PQRSSchema, PQRSWithDetails, PQRSResponse
from app.models.alert import Alert
from app.utils.auth import get_current_active_user, require_admin
from app.utils.helpers import generate_radicado

router = APIRouter(prefix="/pqrs", tags=["PQRS"])

@router.post("/", response_model=PQRSSchema)
async def create_pqrs(
    pqrs_data: PQRSCreate, 
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
                pqrs_data.cedula_ciudadano = current_user.cedula or current_user.username
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
        # Siempre generar un nuevo radicado único con formato YYYYMMDDNNN
        numero_radicado = generate_radicado(db)
        # Verificar unicidad por si acaso (aunque la función ya maneja esto)
        max_intentos = 10
        intentos = 0
        while db.query(PQRS).filter(PQRS.numero_radicado == numero_radicado).first() and intentos < max_intentos:
            numero_radicado = generate_radicado(db)
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
            entity_id=pqrs_data.entity_id
        )
        
        db.add(db_pqrs)
        db.commit()
        db.refresh(db_pqrs)

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
    limit: int = Query(100, ge=1, le=1000),
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
        # Ciudadanos ven PQRS que ellos crearon (basándose en created_by_id)
        # O que coincidan con su cédula/email
        query = query.filter(
            (PQRS.created_by_id == current_user.id) |
            (PQRS.cedula_ciudadano == current_user.cedula) |
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


@router.post("/{pqrs_id}/assign")
async def assign_pqrs(
    pqrs_id: int,
    payload: AssignPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Asignar PQRS a un usuario (solo admin)"""
    pqrs = db.query(PQRS).filter(PQRS.id == pqrs_id).first()
    
    if not pqrs:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="PQRS no encontrada"
        )
    
    # Verificar que el usuario existe
    assigned_user = db.query(User).filter(User.id == payload.assigned_to_id).first()
    if not assigned_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado"
        )
    
    pqrs.assigned_to_id = payload.assigned_to_id
    if not pqrs.fecha_delegacion:
        pqrs.fecha_delegacion = datetime.utcnow()
    
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
    if current_user.role != UserRole.ADMIN and pqrs.assigned_to_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permisos para responder esta PQRS"
        )
    
    pqrs.respuesta = response_data.respuesta
    pqrs.estado = EstadoPQRS.RESUELTO
    pqrs.fecha_respuesta = datetime.utcnow()
    
    db.commit()
    db.refresh(pqrs)
    
    return pqrs

@router.delete("/{pqrs_id}")
async def delete_pqrs(
    pqrs_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Eliminar PQRS (solo admin)"""
    pqrs = db.query(PQRS).filter(PQRS.id == pqrs_id).first()
    
    if not pqrs:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="PQRS no encontrada"
        )
    
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