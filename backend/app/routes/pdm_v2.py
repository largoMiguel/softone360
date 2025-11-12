"""
Rutas API para PDM - Versión 2
Alineadas con la estructura del frontend
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
from datetime import datetime

from app.config.database import get_db
from app.models.entity import Entity
from app.models.user import User, UserRole
from app.models.secretaria import Secretaria
from app.models.alert import Alert
from app.models.pdm import (
    PdmProducto,
    PdmActividad,
    PdmActividadEvidencia,
    PdmIniciativaSGR
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


def enrich_actividad_with_secretaria(actividad: PdmActividad, db: Session, current_user: User = None) -> dict:
    """Enriquece una actividad con el nombre de la secretaría responsable y lógica de UI
    
    Retorna un dict que mapea:
    - Para ADMIN: muestra nombre de la secretaría
    - Para SECRETARIO: muestra "Tu Secretaría" 
    """
    actividad_dict = schemas.ActividadResponse.model_validate(actividad).model_dump()
    
    # Si hay secretaría asignada, obtener su nombre
    if actividad.responsable_secretaria_id:
        secretaria = db.query(Secretaria).filter(
            Secretaria.id == actividad.responsable_secretaria_id
        ).first()
        
        if secretaria:
            # Determinar qué mostrar según el rol del usuario
            if current_user and current_user.secretaria_id == actividad.responsable_secretaria_id:
                # Si es secretario de esa secretaría, mostrar "Tu Secretaría"
                actividad_dict['responsable_secretaria_nombre'] = f"Tu Secretaría ({secretaria.nombre})"
            else:
                # Si es admin u otro rol, mostrar el nombre completo
                actividad_dict['responsable_secretaria_nombre'] = secretaria.nombre
    
    return actividad_dict


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
    
    # ✅ NUEVO: Upsert iniciativas SGR (clave: consecutivo)
    # Primero, eliminar todas las iniciativas SGR existentes para esta entidad
    # (ya que el Excel es la fuente de verdad)
    db.query(PdmIniciativaSGR).filter(
        PdmIniciativaSGR.entity_id == entity.id
    ).delete()
    
    # Luego agregar las nuevas iniciativas SGR
    for item in data.iniciativas_sgr:
        iniciativa = PdmIniciativaSGR(
            entity_id=entity.id,
            **item.model_dump()
        )
        db.add(iniciativa)
    
    db.commit()
    
    # Retornar status
    return await get_pdm_status(slug, db, current_user)


# ==============================================
# Obtener todos los datos del PDM
# ==============================================

@router.get("/{slug}/data")
async def get_pdm_data(
    slug: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Obtiene los productos del PDM cargados con sus actividades y otros arrays del frontend
    
    FILTRADO POR ROL EN BACKEND:
    - ADMIN: ve TODOS los productos
    - SECRETARIO: ve SOLO sus productos asignados (responsable_user_id == current_user.id)
    """
    try:
        entity = get_entity_or_404(db, slug)
        ensure_user_can_manage_entity(current_user, entity)
        
        # Construir query base
        query = db.query(PdmProducto).filter(PdmProducto.entity_id == entity.id)
        
        # FILTRADO POR ROL: Secretarios solo ven productos asignados a SU secretaría
        if current_user.role == UserRole.SECRETARIO:
            # ✅ Si el usuario es secretario, ver productos asignados a su secretaría
            if current_user.secretaria_id:
                query = query.filter(PdmProducto.responsable_secretaria_id == current_user.secretaria_id)
                print(f"🔐 Usuario SECRETARIO {current_user.username} (secretaria_id={current_user.secretaria_id}) - filtrando por productos de su secretaría")
            else:
                # Si no tiene secretaría asignada, no ver productos
                query = query.filter(PdmProducto.id == -1)  # Query que no retorna nada
                print(f"🔐 Usuario SECRETARIO {current_user.username} sin secretaría asignada - sin acceso a productos")
        else:
            print(f"👨‍💼 Usuario {current_user.role} - viendo TODOS los productos")
        
        # Cargar productos CON sus actividades relacionadas (eager loading)
        productos = query.all()
        
        print(f"📊 Encontrados {len(productos)} productos para entidad {slug}")
        
        # Validar cada producto antes de retornar
        productos_validos = []
        lineas_set = set()  # Usar set para líneas únicas
        
        for p in productos:
            try:
                # Cargar actividades del producto usando el codigo_producto
                actividades = db.query(PdmActividad).filter(
                    PdmActividad.entity_id == entity.id,
                    PdmActividad.codigo_producto == p.codigo_producto
                ).all()
                
                # Asignar actividades al producto (para que Pydantic pueda validarlo)
                p.actividades = actividades
                
                # Enriquecer con nombre del responsable (SECRETARÍA) si existe
                responsable_nombre = None
                
                # ✅ Mostrar SECRETARÍA como responsable (no usuario)
                if p.responsable_secretaria_nombre:
                    responsable_nombre = p.responsable_secretaria_nombre
                
                prod_response = schemas.ProductoResponse.model_validate(p)
                # Agregar el nombre de la secretaría responsable al response
                prod_response.responsable_nombre = responsable_nombre
                productos_validos.append(prod_response)
                
                # Recolectar líneas estratégicas únicas
                if p.linea_estrategica:
                    lineas_set.add(p.linea_estrategica)
                
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
        
        # ✅ Cargar iniciativas SGR desde la tabla separada (no del BPIN de productos)
        iniciativas_sgr_db = db.query(PdmIniciativaSGR).filter(
            PdmIniciativaSGR.entity_id == entity.id
        ).all()
        
        # Convertir sets a listas de diccionarios
        lineas_estrategicas = [{"nombre": linea} for linea in sorted(lineas_set)]
        iniciativas_sgr = [
            {
                "consecutivo": i.consecutivo,
                "iniciativa_sgr": i.iniciativa_sgr,
                "recursos_sgr_indicativos": i.recursos_sgr_indicativos,
                "bpin": i.bpin
            }
            for i in iniciativas_sgr_db
        ]
        
        print(f"✅ Retornando {len(productos_validos)} productos + {len(lineas_estrategicas)} líneas + {len(iniciativas_sgr)} iniciativas SGR")
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
    
    # Generar alertas si se asignó a una secretaría
    if nueva_actividad.responsable_secretaria_id:
        secretaria = db.query(Secretaria).filter(Secretaria.id == nueva_actividad.responsable_secretaria_id).first()
        if secretaria:
            # Obtener todos los usuarios de esa secretaría
            usuarios_secretaria = db.query(User).filter(
                User.secretaria_id == secretaria.id,
                User.is_active == True,
                User.entity_id == entity.id
            ).all()
            
            for usuario in usuarios_secretaria:
                alerta = Alert(
                    entity_id=entity.id,
                    recipient_user_id=usuario.id,
                    type="PDM_ACTIVIDAD_ASIGNADA",
                    title=f"Nueva actividad en {secretaria.nombre}: {nueva_actividad.nombre}",
                    message=f"Se ha asignado la actividad '{nueva_actividad.nombre}' a la Secretaría {secretaria.nombre} para el año {nueva_actividad.anio}.",
                    data=f'{{"actividad_id": {nueva_actividad.id}, "codigo_producto": "{nueva_actividad.codigo_producto}", "responsable_secretaria": "{secretaria.nombre}"}}'
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
        
        # Enriquecer actividades con nombre de secretaría
        result = [enrich_actividad_with_secretaria(a, db, current_user) for a in actividades]
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
    """Obtiene las actividades asignadas a la secretaría del usuario actual"""
    entity = get_entity_or_404(db, slug)
    ensure_user_can_manage_entity(current_user, entity)
    
    # Incluir actividades asignadas a la secretaría del usuario
    query = db.query(PdmActividad).filter(
        PdmActividad.entity_id == entity.id,
        PdmActividad.responsable_secretaria_id == current_user.secretaria_id
    )
    
    if anio:
        query = query.filter(PdmActividad.anio == anio)
    
    actividades = query.order_by(PdmActividad.fecha_inicio.desc()).all()
    
    # Enriquecer actividades con nombre de secretaría
    return [enrich_actividad_with_secretaria(a, db, current_user) for a in actividades]


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
    
    # Generar alertas si cambió la secretaría asignada
    if actividad.responsable_secretaria_id and 'responsable_secretaria_id' in update_dict:
        secretaria = db.query(Secretaria).filter(Secretaria.id == actividad.responsable_secretaria_id).first()
        if secretaria:
            usuarios_secretaria = db.query(User).filter(
                User.secretaria_id == secretaria.id,
                User.is_active == True,
                User.entity_id == entity.id
            ).all()
            
            for usuario in usuarios_secretaria:
                alerta = Alert(
                    entity_id=entity.id,
                    recipient_user_id=usuario.id,
                    type="PDM_ACTIVIDAD_REASIGNADA",
                    title=f"Actividad reasignada en {secretaria.nombre}: {actividad.nombre}",
                    message=f"La actividad '{actividad.nombre}' ha sido reasignada a la Secretaría {secretaria.nombre} para el año {actividad.anio}.",
                    data=f'{{"actividad_id": {actividad.id}, "codigo_producto": "{actividad.codigo_producto}", "responsable_secretaria": "{secretaria.nombre}"}}'
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
    responsable_secretaria_id: str = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Asigna una SECRETARÍA como responsable de un producto del PDM.
    
    ✅ El producto se asigna a la SECRETARÍA, no a un usuario específico
    ✅ TODOS los usuarios de esa secretaría ven el producto en su lista
    ✅ Se crean alertas para TODOS los usuarios de la secretaría
    
    Args:
        responsable_secretaria_id: ID de la secretaría responsable del producto
    """
    from app.models.secretaria import Secretaria
    
    # Convertir a número
    try:
        responsable_secretaria_id = int(responsable_secretaria_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="responsable_secretaria_id debe ser un número entero")
    
    entity = get_entity_or_404(db, slug)
    ensure_user_can_manage_entity(current_user, entity)
    
    # Buscar el producto
    producto = db.query(PdmProducto).filter(
        PdmProducto.codigo_producto == codigo_producto,
        PdmProducto.entity_id == entity.id
    ).first()
    
    if not producto:
        raise HTTPException(status_code=404, detail=f"Producto '{codigo_producto}' no encontrado")
    
    # Verificar que la secretaría existe y pertenece a la entidad
    secretaria = db.query(Secretaria).filter(
        Secretaria.id == responsable_secretaria_id,
        Secretaria.entity_id == entity.id
    ).first()
    
    if not secretaria:
        raise HTTPException(status_code=404, detail="Secretaría no encontrada o no pertenece a esta entidad")
    
    # Asignar secretaría como responsable
    producto.responsable_secretaria_id = responsable_secretaria_id
    producto.responsable_secretaria_nombre = secretaria.nombre
    
    db.commit()
    db.refresh(producto)
    
    # ✅ Crear alertas para TODOS los usuarios de esta secretaría
    usuarios_en_secretaria = db.query(User).filter(
        User.secretaria_id == responsable_secretaria_id,
        User.entity_id == entity.id,
        User.is_active == True
    ).all()
    
    for usuario in usuarios_en_secretaria:
        alerta = Alert(
            entity_id=entity.id,
            recipient_user_id=usuario.id,
            type="PDM_PRODUCT_ASSIGNED",
            title=f"Producto asignado a tu secretaría: {producto.codigo_producto}",
            message=f"El producto '{producto.indicador_producto_mga or producto.personalizacion_indicador}' ha sido asignado a la Secretaría {secretaria.nombre} para seguimiento en el PDM.",
            data=f'{{"producto_codigo": "{producto.codigo_producto}", "slug": "{slug}", "secretaria_id": {responsable_secretaria_id}}}',
            created_at=datetime.utcnow()
        )
        db.add(alerta)
    
    db.commit()
    
    print(f"✅ Producto asignado a secretaría {secretaria.nombre}")
    print(f"✅ Alertas creadas para {len(usuarios_en_secretaria)} usuario(s)")
    
    return {
        "success": True,
        "message": f"Producto asignado a la secretaría '{secretaria.nombre}'",
        "producto_codigo": producto.codigo_producto,
        "responsable_secretaria_id": producto.responsable_secretaria_id,
        "responsable_secretaria_nombre": producto.responsable_secretaria_nombre,
        "usuarios_notificados": len(usuarios_en_secretaria)
    }
