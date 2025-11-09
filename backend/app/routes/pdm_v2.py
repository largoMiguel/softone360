"""
Rutas API para PDM - Versión 2
Alineadas con la estructura del frontend
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
from datetime import datetime

from app.config.database import get_db
from app.models.entity import Entity
from app.models.user import User
from app.models.alert import Alert
from app.models.pdm import (
    PdmLineaEstrategica,
    PdmIndicadorResultado,
    PdmIniciativaSGR,
    PdmProducto,
    PdmActividad,
    PdmActividadEvidencia
)
from app.schemas import pdm_v2 as schemas
from app.utils.auth import get_current_active_user

router = APIRouter(prefix="/pdm/v2", tags=["PDM V2"])


# ==============================================
# Helpers
# ==============================================

def get_entity_or_404(db: Session, slug: str) -> Entity:
    """Obtiene una entidad por slug o retorna 404"""
    entity = db.query(Entity).filter(Entity.slug == slug).first()
    if not entity:
        raise HTTPException(status_code=404, detail=f"Entidad '{slug}' no encontrada")
    return entity


def ensure_user_can_manage_entity(user: User, entity: Entity):
    """Verifica que el usuario pueda gestionar la entidad"""
    if user.role == "SUPERADMIN":
        return
    if user.entity_id != entity.id:
        raise HTTPException(
            status_code=403,
            detail="No tiene permisos para gestionar esta entidad"
        )


# ==============================================
# Estado de carga del PDM
# ==============================================

@router.get("/{slug}/status", response_model=schemas.PDMLoadStatusResponse)
async def get_pdm_status(
    slug: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Verifica si hay datos del PDM cargados para esta entidad"""
    entity = get_entity_or_404(db, slug)
    ensure_user_can_manage_entity(current_user, entity)
    
    total_productos = db.query(func.count(PdmProducto.id)).filter(
        PdmProducto.entity_id == entity.id
    ).scalar()
    
    total_lineas = db.query(func.count(PdmLineaEstrategica.id)).filter(
        PdmLineaEstrategica.entity_id == entity.id
    ).scalar()
    
    total_indicadores = db.query(func.count(PdmIndicadorResultado.id)).filter(
        PdmIndicadorResultado.entity_id == entity.id
    ).scalar()
    
    total_iniciativas = db.query(func.count(PdmIniciativaSGR.id)).filter(
        PdmIniciativaSGR.entity_id == entity.id
    ).scalar()
    
    fecha_ultima_carga = None
    if total_productos > 0:
        producto_mas_reciente = db.query(PdmProducto).filter(
            PdmProducto.entity_id == entity.id
        ).order_by(PdmProducto.created_at.desc()).first()
        if producto_mas_reciente:
            fecha_ultima_carga = producto_mas_reciente.created_at
    
    return schemas.PDMLoadStatusResponse(
        tiene_datos=total_productos > 0,
        total_productos=total_productos,
        total_lineas=total_lineas,
        total_indicadores=total_indicadores,
        total_iniciativas=total_iniciativas,
        fecha_ultima_carga=fecha_ultima_carga
    )


# ==============================================
# Carga masiva de datos del Excel
# ==============================================

@router.post("/{slug}/upload", response_model=schemas.PDMLoadStatusResponse)
async def upload_pdm_data(
    slug: str,
    data: schemas.PDMDataUpload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Carga/actualiza todos los datos del Excel PDM. Actualiza existentes y agrega nuevos."""
    entity = get_entity_or_404(db, slug)
    ensure_user_can_manage_entity(current_user, entity)
    
    # Upsert líneas estratégicas (actualizar o insertar)
    for item in data.lineas_estrategicas:
        # Buscar si ya existe por linea_estrategica
        existing = db.query(PdmLineaEstrategica).filter(
            PdmLineaEstrategica.entity_id == entity.id,
            PdmLineaEstrategica.linea_estrategica == item.linea_estrategica
        ).first()
        
        if existing:
            # Actualizar
            for key, value in item.model_dump().items():
                setattr(existing, key, value)
        else:
            # Insertar nuevo
            linea = PdmLineaEstrategica(entity_id=entity.id, **item.model_dump())
            db.add(linea)
    
    # Upsert indicadores de resultado
    for item in data.indicadores_resultado:
        existing = db.query(PdmIndicadorResultado).filter(
            PdmIndicadorResultado.entity_id == entity.id,
            PdmIndicadorResultado.codigo_indicador == item.codigo_indicador
        ).first()
        
        if existing:
            for key, value in item.model_dump().items():
                setattr(existing, key, value)
        else:
            indicador = PdmIndicadorResultado(entity_id=entity.id, **item.model_dump())
            db.add(indicador)
    
    # Upsert iniciativas SGR
    for item in data.iniciativas_sgr:
        existing = db.query(PdmIniciativaSGR).filter(
            PdmIniciativaSGR.entity_id == entity.id,
            PdmIniciativaSGR.codigo_iniciativa == item.codigo_iniciativa
        ).first()
        
        if existing:
            for key, value in item.model_dump().items():
                setattr(existing, key, value)
        else:
            iniciativa = PdmIniciativaSGR(entity_id=entity.id, **item.model_dump())
            db.add(iniciativa)
    
    # Upsert productos (clave: codigo_producto)
    for item in data.productos_plan_indicativo:
        existing = db.query(PdmProducto).filter(
            PdmProducto.entity_id == entity.id,
            PdmProducto.codigo_producto == item.codigo_producto
        ).first()
        
        if existing:
            # Actualizar solo campos del Excel, preservar responsable y responsable_user_id
            for key, value in item.model_dump().items():
                # No sobrescribir los campos de responsable si ya están definidos
                if key not in ['responsable', 'responsable_user_id']:
                    setattr(existing, key, value)
        else:
            # Insertar nuevo producto
            producto = PdmProducto(entity_id=entity.id, **item.model_dump())
            db.add(producto)
    
    db.commit()
    
    # Retornar status
    return await get_pdm_status(slug, db, current_user)


# ==============================================
# Obtener todos los datos del PDM
# ==============================================

@router.get("/{slug}/data", response_model=schemas.PDMDataResponse)
async def get_pdm_data(
    slug: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Obtiene todos los datos del PDM cargados"""
    entity = get_entity_or_404(db, slug)
    ensure_user_can_manage_entity(current_user, entity)
    
    lineas = db.query(PdmLineaEstrategica).filter(
        PdmLineaEstrategica.entity_id == entity.id
    ).all()
    
    indicadores = db.query(PdmIndicadorResultado).filter(
        PdmIndicadorResultado.entity_id == entity.id
    ).all()
    
    iniciativas = db.query(PdmIniciativaSGR).filter(
        PdmIniciativaSGR.entity_id == entity.id
    ).all()
    
    productos = db.query(PdmProducto).filter(
        PdmProducto.entity_id == entity.id
    ).all()
    
    return schemas.PDMDataResponse(
        lineas_estrategicas=[schemas.LineaEstrategicaResponse.model_validate(l) for l in lineas],
        indicadores_resultado=[schemas.IndicadorResultadoResponse.model_validate(i) for i in indicadores],
        iniciativas_sgr=[schemas.IniciativaSGRResponse.model_validate(i) for i in iniciativas],
        productos_plan_indicativo=[schemas.ProductoResponse.model_validate(p) for p in productos],
        productos_plan_indicativo_sgr=[]
    )


# ==============================================
# Gestión de Actividades
# ==============================================

@router.post("/{slug}/actividades", response_model=schemas.ActividadResponse, status_code=status.HTTP_201_CREATED)
async def create_actividad(
    slug: str,
    actividad: schemas.ActividadCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Crea una nueva actividad para un producto"""
    entity = get_entity_or_404(db, slug)
    ensure_user_can_manage_entity(current_user, entity)
    
    # Convertir fechas ISO string a datetime
    actividad_data = actividad.model_dump()
    if actividad_data.get('fecha_inicio'):
        try:
            actividad_data['fecha_inicio'] = datetime.fromisoformat(actividad_data['fecha_inicio'].replace('Z', '+00:00'))
        except (ValueError, AttributeError):
            actividad_data['fecha_inicio'] = None
    
    if actividad_data.get('fecha_fin'):
        try:
            actividad_data['fecha_fin'] = datetime.fromisoformat(actividad_data['fecha_fin'].replace('Z', '+00:00'))
        except (ValueError, AttributeError):
            actividad_data['fecha_fin'] = None
    
    nueva_actividad = PdmActividad(
        entity_id=entity.id,
        **actividad_data
    )
    db.add(nueva_actividad)
    db.commit()
    db.refresh(nueva_actividad)
    
    # Generar alerta si se asignó un responsable
    if nueva_actividad.responsable_user_id:
        responsable = db.query(User).filter(User.id == nueva_actividad.responsable_user_id).first()
        if responsable:
            alerta = Alert(
                entity_id=entity.id,
                recipient_user_id=responsable.id,
                type="PDM_ACTIVIDAD_ASIGNADA",
                title=f"Nueva actividad asignada: {nueva_actividad.nombre}",
                message=f"Se te ha asignado la actividad '{nueva_actividad.nombre}' para el año {nueva_actividad.anio}.",
                data=f'{{"actividad_id": {nueva_actividad.id}, "codigo_producto": "{nueva_actividad.codigo_producto}"}}'
            )
            db.add(alerta)
            db.commit()
    
    return schemas.ActividadResponse.model_validate(nueva_actividad)


@router.get("/{slug}/actividades/{codigo_producto}", response_model=List[schemas.ActividadResponse])
async def get_actividades_por_producto(
    slug: str,
    codigo_producto: str,
    anio: int = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Obtiene todas las actividades de un producto, opcionalmente filtradas por año"""
    entity = get_entity_or_404(db, slug)
    ensure_user_can_manage_entity(current_user, entity)
    
    query = db.query(PdmActividad).filter(
        PdmActividad.entity_id == entity.id,
        PdmActividad.codigo_producto == codigo_producto
    )
    
    if anio:
        query = query.filter(PdmActividad.anio == anio)
    
    actividades = query.all()
    
    return [schemas.ActividadResponse.model_validate(a) for a in actividades]


@router.get("/{slug}/mis-actividades", response_model=List[schemas.ActividadResponse])
async def get_mis_actividades(
    slug: str,
    anio: int = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Obtiene las actividades asignadas al usuario actual (para secretarios)"""
    entity = get_entity_or_404(db, slug)
    ensure_user_can_manage_entity(current_user, entity)
    
    query = db.query(PdmActividad).filter(
        PdmActividad.entity_id == entity.id,
        PdmActividad.responsable_user_id == current_user.id
    )
    
    if anio:
        query = query.filter(PdmActividad.anio == anio)
    
    actividades = query.order_by(PdmActividad.fecha_inicio.desc()).all()
    
    return [schemas.ActividadResponse.model_validate(a) for a in actividades]


@router.put("/{slug}/actividades/{actividad_id}", response_model=schemas.ActividadResponse)
async def update_actividad(
    slug: str,
    actividad_id: int,
    update_data: schemas.ActividadUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Actualiza una actividad"""
    entity = get_entity_or_404(db, slug)
    ensure_user_can_manage_entity(current_user, entity)
    
    actividad = db.query(PdmActividad).filter(
        PdmActividad.id == actividad_id,
        PdmActividad.entity_id == entity.id
    ).first()
    
    if not actividad:
        raise HTTPException(status_code=404, detail="Actividad no encontrada")
    
    # Guardar el responsable anterior para comparar
    responsable_anterior_id = actividad.responsable_user_id
    
    update_dict = update_data.model_dump(exclude_unset=True)
    
    # Convertir fechas ISO string a datetime
    if 'fecha_inicio' in update_dict and update_dict['fecha_inicio']:
        try:
            update_dict['fecha_inicio'] = datetime.fromisoformat(update_dict['fecha_inicio'].replace('Z', '+00:00'))
        except (ValueError, AttributeError):
            update_dict['fecha_inicio'] = None
    
    if 'fecha_fin' in update_dict and update_dict['fecha_fin']:
        try:
            update_dict['fecha_fin'] = datetime.fromisoformat(update_dict['fecha_fin'].replace('Z', '+00:00'))
        except (ValueError, AttributeError):
            update_dict['fecha_fin'] = None
    
    for key, value in update_dict.items():
        setattr(actividad, key, value)
    
    db.commit()
    db.refresh(actividad)
    
    # Generar alerta si cambió el responsable
    if actividad.responsable_user_id and actividad.responsable_user_id != responsable_anterior_id:
        responsable = db.query(User).filter(User.id == actividad.responsable_user_id).first()
        if responsable:
            alerta = Alert(
                entity_id=entity.id,
                recipient_user_id=responsable.id,
                type="PDM_ACTIVIDAD_REASIGNADA",
                title=f"Actividad reasignada: {actividad.nombre}",
                message=f"Se te ha reasignado la actividad '{actividad.nombre}' para el año {actividad.anio}.",
                data=f'{{"actividad_id": {actividad.id}, "codigo_producto": "{actividad.codigo_producto}"}}'
            )
            db.add(alerta)
            db.commit()
    
    return schemas.ActividadResponse.model_validate(actividad)


@router.delete("/{slug}/actividades/{actividad_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_actividad(
    slug: str,
    actividad_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Elimina una actividad"""
    entity = get_entity_or_404(db, slug)
    ensure_user_can_manage_entity(current_user, entity)
    
    actividad = db.query(PdmActividad).filter(
        PdmActividad.id == actividad_id,
        PdmActividad.entity_id == entity.id
    ).first()
    
    if not actividad:
        raise HTTPException(status_code=404, detail="Actividad no encontrada")
    
    db.delete(actividad)
    db.commit()


# ==============================================
# Gestión de Evidencias
# ==============================================

@router.post("/{slug}/actividades/{actividad_id}/evidencia", response_model=schemas.EvidenciaResponse, status_code=status.HTTP_201_CREATED)
async def create_evidencia(
    slug: str,
    actividad_id: int,
    evidencia: schemas.EvidenciaCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Registra evidencia de cumplimiento de una actividad"""
    entity = get_entity_or_404(db, slug)
    ensure_user_can_manage_entity(current_user, entity)
    
    # Verificar que la actividad existe
    actividad = db.query(PdmActividad).filter(
        PdmActividad.id == actividad_id,
        PdmActividad.entity_id == entity.id
    ).first()
    
    if not actividad:
        raise HTTPException(status_code=404, detail="Actividad no encontrada")
    
    # Verificar que no exista ya una evidencia
    evidencia_existente = db.query(PdmActividadEvidencia).filter(
        PdmActividadEvidencia.actividad_id == actividad_id
    ).first()
    
    if evidencia_existente:
        raise HTTPException(status_code=400, detail="La actividad ya tiene evidencia registrada")
    
    nueva_evidencia = PdmActividadEvidencia(
        actividad_id=actividad_id,
        entity_id=entity.id,
        fecha_registro=datetime.utcnow(),
        **evidencia.model_dump()
    )
    
    db.add(nueva_evidencia)
    
    # Actualizar estado de la actividad a COMPLETADA
    actividad.estado = 'COMPLETADA'
    
    db.commit()
    db.refresh(nueva_evidencia)
    
    return schemas.EvidenciaResponse.model_validate(nueva_evidencia)


@router.get("/{slug}/actividades/{actividad_id}/evidencia", response_model=schemas.EvidenciaResponse)
async def get_evidencia(
    slug: str,
    actividad_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Obtiene la evidencia de una actividad"""
    entity = get_entity_or_404(db, slug)
    ensure_user_can_manage_entity(current_user, entity)
    
    evidencia = db.query(PdmActividadEvidencia).filter(
        PdmActividadEvidencia.actividad_id == actividad_id,
        PdmActividadEvidencia.entity_id == entity.id
    ).first()
    
    if not evidencia:
        raise HTTPException(status_code=404, detail="Evidencia no encontrada")
    
    return schemas.EvidenciaResponse.model_validate(evidencia)


# ==============================================
# Asignación de responsables a productos
# ==============================================

@router.patch("/{slug}/productos/{codigo_producto}/responsable")
async def asignar_responsable_producto(
    slug: str,
    codigo_producto: str,
    responsable_user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Asigna un responsable a un producto del PDM"""
    entity = get_entity_or_404(db, slug)
    ensure_user_can_manage_entity(current_user, entity)
    
    # Buscar el producto
    producto = db.query(PdmProducto).filter(
        PdmProducto.codigo_producto == codigo_producto,
        PdmProducto.entity_id == entity.id
    ).first()
    
    if not producto:
        raise HTTPException(status_code=404, detail=f"Producto '{codigo_producto}' no encontrado")
    
    # Verificar que el usuario existe y pertenece a la entidad
    usuario = db.query(User).filter(
        User.id == responsable_user_id,
        User.entity_id == entity.id
    ).first()
    
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado o no pertenece a esta entidad")
    
    # Asignar responsable
    producto.responsable_user_id = responsable_user_id
    producto.responsable = usuario.full_name or usuario.name  # Actualizar también el campo legacy
    
    db.commit()
    db.refresh(producto)
    
    return {
        "success": True,
        "message": f"Responsable asignado correctamente al producto {codigo_producto}",
        "producto_codigo": producto.codigo_producto,
        "responsable_id": producto.responsable_user_id,
        "responsable_nombre": usuario.full_name or usuario.name
    }
