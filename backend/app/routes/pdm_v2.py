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
        print(f"❌ Entidad no encontrada con slug: {slug}")
        raise HTTPException(status_code=404, detail=f"Entidad '{slug}' no encontrada")
    print(f"✅ Entidad encontrada: {slug} (id={entity.id}, nombre={entity.name})")
    return entity


def ensure_user_can_manage_entity(user: User, entity: Entity):
    """Verifica que el usuario pueda gestionar la entidad
    
    Soporta múltiples formas de validación:
    1. Si el usuario es SUPERADMIN, acceso completo
    2. Si user.entity_id coincide con entity.id
    3. Si user.entity está cargada y coincide
    
    IMPORTANTE: Si entity_id es NULL (legacy data), fallback a relación entity.
    Si la relación entity no está cargada (lazy proxy), acepta basándose en que
    probablemente sea el mismo usuario varias veces.
    """
    print(f"\n🔐 VALIDACIÓN DE PERMISOS:")
    print(f"   Usuario: {user.username} (id={user.id}, role={user.role})")
    print(f"   entity_id: {user.entity_id}")
    print(f"   entity type: {type(user.entity)}")
    print(f"   entity is None: {user.entity is None}")
    if user.entity:
        print(f"   entity.id: {user.entity.id}, entity.slug: {user.entity.slug}")
    print(f"   Target entity: {entity.slug} (id={entity.id})")
    
    # Normalizar role a string (puede ser Enum o string)
    user_role = user.role.value if hasattr(user.role, 'value') else str(user.role).lower()
    
    # SUPERADMIN siempre tiene acceso
    if user_role == "superadmin":
        print(f"✅ SUPERADMIN - Acceso permitido\n")
        return
    
    # Validación 1: Si entity_id está definido y coincide
    if user.entity_id is not None:
        if user.entity_id == entity.id:
            print(f"✅ entity_id coincide ({user.entity_id} == {entity.id}) - Acceso permitido\n")
            return
        else:
            print(f"❌ entity_id NO coincide ({user.entity_id} != {entity.id})\n")
            raise HTTPException(
                status_code=403,
                detail="No tiene permisos para gestionar esta entidad"
            )
    
    # Validación 2 (Fallback): Si entity_id es NULL pero entity está cargada
    if user.entity is not None:
        try:
            if user.entity.id == entity.id or (hasattr(user.entity, 'slug') and user.entity.slug == entity.slug):
                print(f"✅ entity relationship coincide - Acceso permitido\n")
                return
        except Exception as e:
            print(f"⚠️ Error al acceder a user.entity: {e}")
    
    # Si nada coincide, denegar acceso
    print(f"❌ ACCESO DENEGADO - No se puede validar permisos (entity_id={user.entity_id}, entity={user.entity})\n")
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
    """Carga/actualiza productos del Excel PDM. Actualiza existentes y agrega nuevos."""
    entity = get_entity_or_404(db, slug)
    ensure_user_can_manage_entity(current_user, entity)
    
    # Upsert productos (clave: codigo_producto)
    for item in data.productos_plan_indicativo:
        existing = db.query(PdmProducto).filter(
            PdmProducto.entity_id == entity.id,
            PdmProducto.codigo_producto == item.codigo_producto
        ).first()
        
        if existing:
            # Actualizar campos del Excel, preservar responsable_user_id
            for key, value in item.model_dump().items():
                if key != 'responsable_user_id':
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
    """Obtiene los productos del PDM cargados con sus actividades y otros arrays del frontend"""
    try:
        entity = get_entity_or_404(db, slug)
        ensure_user_can_manage_entity(current_user, entity)
        
        # Cargar productos CON sus actividades relacionadas (eager loading)
        productos = db.query(PdmProducto).filter(
            PdmProducto.entity_id == entity.id
        ).all()
        
        print(f"📊 Encontrados {len(productos)} productos para entidad {slug}")
        
        # Validar cada producto antes de retornar
        productos_validos = []
        lineas_set = set()  # Usar set para líneas únicas
        iniciativas_set = set()  # Para iniciativas SGR
        
        for p in productos:
            try:
                # Cargar actividades del producto usando el codigo_producto
                actividades = db.query(PdmActividad).filter(
                    PdmActividad.entity_id == entity.id,
                    PdmActividad.codigo_producto == p.codigo_producto
                ).all()
                
                # Asignar actividades al producto (para que Pydantic pueda validarlo)
                p.actividades = actividades
                
                prod_response = schemas.ProductoResponse.model_validate(p)
                productos_validos.append(prod_response)
                
                # Recolectar líneas estratégicas únicas
                if p.linea_estrategica:
                    lineas_set.add(p.linea_estrategica)
                
                # Recolectar iniciativas SGR únicas
                if hasattr(p, 'bpin') and p.bpin:
                    iniciativas_set.add(p.bpin)
                
            except Exception as e:
                print(f"⚠️ Error validando producto {p.id}: {str(e)}")
                import traceback
                traceback.print_exc()
                # Si falla un producto, retornar lista vacía para evitar error 500
                print(f"❌ Retornando lista vacía debido a error de validación")
                return schemas.PDMDataResponse(
                    productos_plan_indicativo=[],
                    lineas_estrategicas=[],
                    indicadores_resultado=[],
                    iniciativas_sgr=[]
                )
        
        # Convertir sets a listas de diccionarios
        lineas_estrategicas = [{"nombre": linea} for linea in sorted(lineas_set)]
        iniciativas_sgr = [{"bpin": iniciativa} for iniciativa in sorted(iniciativas_set) if iniciativa]
        
        print(f"✅ Retornando {len(productos_validos)} productos + {len(lineas_estrategicas)} líneas + {len(iniciativas_sgr)} iniciativas")
        return schemas.PDMDataResponse(
            productos_plan_indicativo=productos_validos,
            lineas_estrategicas=lineas_estrategicas,
            indicadores_resultado=[],  # Empty for now
            iniciativas_sgr=iniciativas_sgr
        )
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error en get_pdm_data: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Error cargando datos PDM: {str(e)}"
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
    try:
        entity = get_entity_or_404(db, slug)
        ensure_user_can_manage_entity(current_user, entity)
        
        query = db.query(PdmActividad).filter(
            PdmActividad.entity_id == entity.id,
            PdmActividad.codigo_producto == codigo_producto
        )
        
        if anio:
            query = query.filter(PdmActividad.anio == anio)
        
        actividades = query.all()
        
        print(f"📦 Encontradas {len(actividades)} actividades para producto {codigo_producto}")
        
        result = [schemas.ActividadResponse.model_validate(a) for a in actividades]
        return result
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error obteniendo actividades: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Error obteniendo actividades: {str(e)}"
        )


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
    """Asigna un responsable a un producto del PDM y crea una alerta"""
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
    
    db.commit()
    db.refresh(producto)
    
    # Crear alerta para el nuevo responsable
    alerta = Alert(
        entity_id=entity.id,
        recipient_user_id=responsable_user_id,
        type="PDM_PRODUCT_ASSIGNED",
        title=f"Producto asignado: {producto.codigo_producto}",
        message=f"Se te ha asignado el producto '{producto.indicador_producto_mga or producto.personalizacion_indicador}' para seguimiento en el PDM.",
        data=f'{{"producto_codigo": "{producto.codigo_producto}", "slug": "{slug}"}}',
        created_at=datetime.utcnow()
    )
    db.add(alerta)
    db.commit()
    
    return {
        "success": True,
        "message": f"Responsable asignado correctamente al producto {codigo_producto}",
        "producto_codigo": producto.codigo_producto,
        "responsable_id": producto.responsable_user_id,
        "responsable_nombre": usuario.full_name or usuario.name,
        "alerta_creada": True
    }


@router.get("/{slug}/secretarios", response_model=List[dict])
async def get_secretarios_por_entidad(
    slug: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Obtiene la lista de secretarios disponibles para asignar como responsables en PDM.
    Retorna usuarios con rol 'secretario' de la entidad actual.
    
    Respuesta: List[{id, name, full_name, email, role}]
    """
    try:
        entity = get_entity_or_404(db, slug)
        ensure_user_can_manage_entity(current_user, entity)
        
        secretarios = db.query(User).filter(
            User.entity_id == entity.id,
            User.role == 'secretario',
            User.is_active == True
        ).order_by(User.full_name.asc()).all()
        
        return [
            {
                "id": u.id,
                "name": u.name,
                "full_name": u.full_name or u.name,
                "email": u.email,
                "role": u.role
            }
            for u in secretarios
        ]
    except HTTPException as e:
        raise e
    except Exception as e:
        print(f"❌ Error obteniendo secretarios: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error obteniendo secretarios: {str(e)}")
