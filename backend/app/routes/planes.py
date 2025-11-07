"""
Rutas principales para el módulo de Planes Institucionales rediseñado.
Este archivo maneja los endpoints relacionados con Planes y Componentes.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from decimal import Decimal
from datetime import date
import json

from app.config.database import get_db
from app.models.plan import (
    PlanInstitucional, ComponenteProceso, Actividad, ActividadEjecucion,
    EstadoPlan, EstadoComponente
)
from app.models.user import User, UserRole
from app.models.alert import Alert
from app.schemas import plan as plan_schemas
from app.utils.auth import get_current_user, require_feature_enabled

router = APIRouter()


# ==================== UTILIDADES ====================

def calcular_porcentaje_avance_actividad(db: Session, actividad: Actividad) -> Decimal:
    """Regla: si la actividad tiene al menos una ejecución, su avance es 100%, sino 0%"""
    count = db.query(ActividadEjecucion).filter(ActividadEjecucion.actividad_id == actividad.id).count()
    return Decimal(100) if count > 0 else Decimal(0)


def calcular_porcentaje_avance_componente(componente: ComponenteProceso, db: Session) -> Decimal:
    """Avance del componente: promedio del avance (0% o 100%) de sus actividades"""
    actividades = db.query(Actividad).filter(Actividad.componente_id == componente.id).all()
    if not actividades:
        return Decimal(0)
    avances = [calcular_porcentaje_avance_actividad(db, a) for a in actividades]
    return sum(avances) / len(avances)


def calcular_porcentaje_avance_plan(plan: PlanInstitucional, db: Session) -> Decimal:
    """Calcula el porcentaje de avance de un plan basado en sus componentes"""
    componentes = db.query(ComponenteProceso).filter(ComponenteProceso.plan_id == plan.id).all()
    if not componentes:
        return Decimal(0)
    
    total_avance = sum(comp.porcentaje_avance for comp in componentes)
    return total_avance / len(componentes)


""" Se elimina toda la lógica de presupuesto: no se gestionan montos en el módulo. """


def tiene_permiso_plan(user: User, plan: PlanInstitucional) -> bool:
    """Verifica si el usuario tiene permiso para acceder al plan"""
    if user.role == UserRole.SUPERADMIN:
        return True
    return plan.entity_id == user.entity_id


def tiene_permiso_componente(user: User, componente: ComponenteProceso, db: Session) -> bool:
    """
    Permisos basados en la entidad del plan.
    - SUPERADMIN: acceso total
    - ADMIN: acceso a componentes de su entidad
    - SECRETARIO: acceso a componentes de su entidad (para ver sus actividades filtradas)
    """
    if user.role == UserRole.SUPERADMIN:
        return True
    plan = db.query(PlanInstitucional).filter(PlanInstitucional.id == componente.plan_id).first()
    # Todos los usuarios (admin y secretario) de la misma entidad pueden ver el componente
    # El filtrado de actividades se hace en el endpoint de listar_actividades
    return plan is not None and plan.entity_id == user.entity_id


def tiene_permiso_actividad(user: User, actividad: Actividad, db: Session) -> bool:
    """
    Permisos para actividades:
    - SUPERADMIN: acceso total
    - ADMIN: acceso a actividades de su entidad
    - SECRETARIO: solo actividades asignadas a su secretaría (campo responsable)
    """
    if user.role == UserRole.SUPERADMIN:
        return True
    
    # Verificar que pertenece a la misma entidad
    componente = db.query(ComponenteProceso).filter(ComponenteProceso.id == actividad.componente_id).first()
    if not componente:
        return False
    plan = db.query(PlanInstitucional).filter(PlanInstitucional.id == componente.plan_id).first()
    if not plan or plan.entity_id != user.entity_id:
        return False
    
    # Si es admin, tiene acceso
    if user.role == UserRole.ADMIN:
        return True
    
    # Si es secretario, solo puede acceder si la actividad está asignada a su secretaría
    if user.role == UserRole.SECRETARIO:
        # Verificar que el responsable de la actividad coincida con la secretaría del usuario
        return actividad.responsable == user.secretaria
    
    return False


def puede_editar_actividad(user: User, actividad: Actividad, db: Session) -> bool:
    """
    Verifica si el usuario puede editar una actividad:
    - SUPERADMIN/ADMIN: pueden editar cualquier actividad de su entidad
    - SECRETARIO: NO puede editar actividades (solo registrar ejecuciones)
    """
    if user.role == UserRole.SUPERADMIN:
        return True
    
    if user.role == UserRole.SECRETARIO:
        return False  # Secretarios no editan actividades, solo registran ejecuciones
    
    # Admin puede editar
    componente = db.query(ComponenteProceso).filter(ComponenteProceso.id == actividad.componente_id).first()
    if not componente:
        return False
    plan = db.query(PlanInstitucional).filter(PlanInstitucional.id == componente.plan_id).first()
    return plan is not None and plan.entity_id == user.entity_id


def puede_registrar_ejecucion(user: User, actividad: Actividad, db: Session) -> bool:
    """
    Verifica si el usuario puede registrar ejecución en una actividad:
    - SUPERADMIN/ADMIN: pueden registrar en cualquier actividad
    - SECRETARIO: solo en actividades asignadas a su secretaría
    """
    if user.role == UserRole.SUPERADMIN or user.role == UserRole.ADMIN:
        # Verificar que pertenece a la entidad
        componente = db.query(ComponenteProceso).filter(ComponenteProceso.id == actividad.componente_id).first()
        if not componente:
            return False
        plan = db.query(PlanInstitucional).filter(PlanInstitucional.id == componente.plan_id).first()
        return plan is not None and plan.entity_id == user.entity_id
    
    # Secretarios solo en su secretaría
    if user.role == UserRole.SECRETARIO:
        return actividad.responsable == user.secretaria
    
    return False


# ==================== ENDPOINTS PLANES INSTITUCIONALES ====================

@router.get("/", response_model=List[plan_schemas.PlanInstitucional])
def listar_planes(
    estado: Optional[EstadoPlan] = Query(None, description="Filtrar por estado"),
    anio: Optional[int] = Query(None, description="Filtrar por año"),
    fecha_inicio: Optional[date] = Query(None, description="Filtrar por fecha inicio"),
    fecha_fin: Optional[date] = Query(None, description="Filtrar por fecha fin"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _feature: bool = Depends(require_feature_enabled('enable_planes_institucionales'))
):
    """
    Listar planes institucionales.
    - SECRETARIOS: Ven los planes de su entidad (para navegar a sus actividades)
    - ADMIN/SUPERADMIN: Ven los planes de su entidad
    """
    query = db.query(PlanInstitucional)
    
    # Filtrar por entidad si no es superadmin
    if current_user.role != UserRole.SUPERADMIN:
        query = query.filter(PlanInstitucional.entity_id == current_user.entity_id)
    
    if estado:
        query = query.filter(PlanInstitucional.estado == estado)
    if anio:
        query = query.filter(PlanInstitucional.anio == anio)
    
    if fecha_inicio:
        query = query.filter(PlanInstitucional.fecha_inicio >= fecha_inicio)
    
    if fecha_fin:
        query = query.filter(PlanInstitucional.fecha_fin <= fecha_fin)
    
    return query.order_by(PlanInstitucional.anio.desc(), PlanInstitucional.fecha_inicio.desc()).all()


@router.get("/{plan_id}", response_model=plan_schemas.PlanInstitucional)
def obtener_plan(
    plan_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _feature: bool = Depends(require_feature_enabled('enable_planes_institucionales'))
):
    """Obtener un plan específico por ID"""
    plan = db.query(PlanInstitucional).filter(PlanInstitucional.id == plan_id).first()
    
    if not plan:
        raise HTTPException(status_code=404, detail="Plan no encontrado")
    
    if not tiene_permiso_plan(current_user, plan):
        raise HTTPException(status_code=403, detail="No tienes acceso a este plan")
    
    return plan


@router.get("/{plan_id}/completo", response_model=plan_schemas.PlanInstitucionalCompleto)
def obtener_plan_completo(
    plan_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _feature: bool = Depends(require_feature_enabled('enable_planes_institucionales'))
):
    """Obtener un plan con todos sus componentes y actividades anidados"""
    plan = db.query(PlanInstitucional).options(
        joinedload(PlanInstitucional.componentes).joinedload(ComponenteProceso.actividades)
    ).filter(PlanInstitucional.id == plan_id).first()
    
    if not plan:
        raise HTTPException(status_code=404, detail="Plan no encontrado")
    
    if not tiene_permiso_plan(current_user, plan):
        raise HTTPException(status_code=403, detail="No tienes acceso a este plan")
    
    return plan


@router.post("/", response_model=plan_schemas.PlanInstitucional, status_code=status.HTTP_201_CREATED)
def crear_plan(
    plan_data: plan_schemas.PlanInstitucionalCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _feature: bool = Depends(require_feature_enabled('enable_planes_institucionales'))
):
    """Crear un nuevo plan institucional (solo admins)"""
    if current_user.role not in [UserRole.ADMIN, UserRole.SUPERADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo los administradores pueden crear planes"
        )
    
    if not current_user.entity_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El usuario no tiene una entidad asignada"
        )
    
    # Crear el plan
    plan_dict = plan_data.model_dump(exclude={'entity_id'})
    plan_dict['entity_id'] = current_user.entity_id
    plan_dict['created_by'] = current_user.username
    
    nuevo_plan = PlanInstitucional(**plan_dict)
    db.add(nuevo_plan)
    db.commit()
    db.refresh(nuevo_plan)
    
    return nuevo_plan


@router.put("/{plan_id}", response_model=plan_schemas.PlanInstitucional)
def actualizar_plan(
    plan_id: int,
    plan_data: plan_schemas.PlanInstitucionalUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _feature: bool = Depends(require_feature_enabled('enable_planes_institucionales'))
):
    """Actualizar un plan institucional (solo admins)"""
    if current_user.role not in [UserRole.ADMIN, UserRole.SUPERADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo los administradores pueden actualizar planes"
        )
    
    plan = db.query(PlanInstitucional).filter(PlanInstitucional.id == plan_id).first()
    
    if not plan:
        raise HTTPException(status_code=404, detail="Plan no encontrado")
    
    if not tiene_permiso_plan(current_user, plan):
        raise HTTPException(status_code=403, detail="No tienes acceso a este plan")
    
    # Actualizar campos
    update_data = plan_data.model_dump(exclude_unset=True)
    
    for field, value in update_data.items():
        setattr(plan, field, value)
    
    db.commit()
    db.refresh(plan)
    
    return plan


@router.delete("/{plan_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_plan(
    plan_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _feature: bool = Depends(require_feature_enabled('enable_planes_institucionales'))
):
    """Eliminar un plan institucional (solo admins)"""
    if current_user.role not in [UserRole.ADMIN, UserRole.SUPERADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo los administradores pueden eliminar planes"
        )
    
    plan = db.query(PlanInstitucional).filter(PlanInstitucional.id == plan_id).first()
    
    if not plan:
        raise HTTPException(status_code=404, detail="Plan no encontrado")
    
    if not tiene_permiso_plan(current_user, plan):
        raise HTTPException(status_code=403, detail="No tienes acceso a este plan")
    
    db.delete(plan)
    db.commit()
    
    return None


@router.get("/{plan_id}/estadisticas", response_model=plan_schemas.EstadisticasPlan)
def obtener_estadisticas_plan(
    plan_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _feature: bool = Depends(require_feature_enabled('enable_planes_institucionales'))
):
    """Obtener estadísticas detalladas de un plan"""
    plan = db.query(PlanInstitucional).filter(PlanInstitucional.id == plan_id).first()
    
    if not plan:
        raise HTTPException(status_code=404, detail="Plan no encontrado")
    
    if not tiene_permiso_plan(current_user, plan):
        raise HTTPException(status_code=403, detail="No tienes acceso a este plan")
    
    # Obtener componentes y actividades
    componentes = db.query(ComponenteProceso).filter(ComponenteProceso.plan_id == plan_id).all()
    componente_ids = [c.id for c in componentes]
    
    actividades = db.query(Actividad).filter(Actividad.componente_id.in_(componente_ids)).all() if componente_ids else []
    
    # Calcular estadísticas simplificadas
    actividades_con_avance = sum(1 for a in actividades if calcular_porcentaje_avance_actividad(db, a) >= 100)
    componentes_con_avance = sum(1 for c in componentes if calcular_porcentaje_avance_componente(c, db) > 0)

    return plan_schemas.EstadisticasPlan(
        total_componentes=len(componentes),
        total_actividades=len(actividades),
        actividades_con_avance=actividades_con_avance,
        componentes_con_avance=componentes_con_avance,
        porcentaje_avance_global=plan.porcentaje_avance
    )


# ==================== ENDPOINTS COMPONENTES/PROCESOS ====================

@router.get("/{plan_id}/componentes", response_model=List[plan_schemas.ComponenteProceso])
def listar_componentes(
    plan_id: int,
    estado: Optional[EstadoComponente] = Query(None, description="Filtrar por estado"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _feature: bool = Depends(require_feature_enabled('enable_planes_institucionales'))
):
    """Listar todos los componentes de un plan"""
    plan = db.query(PlanInstitucional).filter(PlanInstitucional.id == plan_id).first()
    
    if not plan:
        raise HTTPException(status_code=404, detail="Plan no encontrado")
    
    if not tiene_permiso_plan(current_user, plan):
        raise HTTPException(status_code=403, detail="No tienes acceso a este plan")
    
    query = db.query(ComponenteProceso).filter(ComponenteProceso.plan_id == plan_id)
    
    if estado:
        query = query.filter(ComponenteProceso.estado == estado)
    
    return query.order_by(ComponenteProceso.created_at).all()


@router.get("/componentes/{componente_id}", response_model=plan_schemas.ComponenteProceso)
def obtener_componente(
    componente_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _feature: bool = Depends(require_feature_enabled('enable_planes_institucionales'))
):
    """Obtener un componente específico"""
    componente = db.query(ComponenteProceso).filter(ComponenteProceso.id == componente_id).first()
    
    if not componente:
        raise HTTPException(status_code=404, detail="Componente no encontrado")
    
    if not tiene_permiso_componente(current_user, componente, db):
        raise HTTPException(status_code=403, detail="No tienes acceso a este componente")
    
    return componente


@router.post("/{plan_id}/componentes", response_model=plan_schemas.ComponenteProceso, 
             status_code=status.HTTP_201_CREATED)
def crear_componente(
    plan_id: int,
    componente_data: plan_schemas.ComponenteProcesoCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _feature: bool = Depends(require_feature_enabled('enable_planes_institucionales'))
):
    """Crear un nuevo componente en un plan (solo admins)"""
    if current_user.role not in [UserRole.ADMIN, UserRole.SUPERADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo los administradores pueden crear componentes"
        )
    
    plan = db.query(PlanInstitucional).filter(PlanInstitucional.id == plan_id).first()
    
    if not plan:
        raise HTTPException(status_code=404, detail="Plan no encontrado")
    
    if not tiene_permiso_plan(current_user, plan):
        raise HTTPException(status_code=403, detail="No tienes acceso a este plan")
    
    if componente_data.plan_id != plan_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El plan_id no coincide"
        )
    
    nuevo_componente = ComponenteProceso(**componente_data.model_dump())
    db.add(nuevo_componente)
    db.commit()
    db.refresh(nuevo_componente)
    
    return nuevo_componente


@router.put("/componentes/{componente_id}", response_model=plan_schemas.ComponenteProceso)
def actualizar_componente(
    componente_id: int,
    componente_data: plan_schemas.ComponenteProcesoUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _feature: bool = Depends(require_feature_enabled('enable_planes_institucionales'))
):
    """Actualizar un componente"""
    componente = db.query(ComponenteProceso).filter(ComponenteProceso.id == componente_id).first()
    
    if not componente:
        raise HTTPException(status_code=404, detail="Componente no encontrado")
    
    if not tiene_permiso_componente(current_user, componente, db):
        raise HTTPException(status_code=403, detail="No tienes permiso para editar este componente")
    
    update_data = componente_data.model_dump(exclude_unset=True)
    
    # Detectar cambio de secretaría asignada
    old_secretaria = componente.secretaria_asignada
    new_secretaria = update_data.get('secretaria_asignada')
    secretaria_changed = (
        'secretaria_asignada' in update_data and 
        new_secretaria != old_secretaria and 
        new_secretaria is not None
    )
    
    for field, value in update_data.items():
        setattr(componente, field, value)
    
    db.commit()
    db.refresh(componente)
    
    # Crear alertas si cambió la secretaría asignada
    if secretaria_changed:
        try:
            secretarios = db.query(User).filter(
                User.role == UserRole.SECRETARIO,
                User.entity_id == componente.plan.entity_id,
                User.secretaria == new_secretaria
            ).all()
            
            for secretario in secretarios:
                db.add(Alert(
                    entity_id=componente.plan.entity_id,
                    recipient_user_id=secretario.id,
                    type="PLAN_COMPONENT_ASSIGNED",
                    title=f"Componente de Plan asignado a {new_secretaria}",
                    message=f"Se asignó el componente '{componente.nombre}' del plan '{componente.plan.nombre}' a tu secretaría",
                    data=json.dumps({
                        "plan_id": componente.plan_id,
                        "componente_id": componente_id
                    }),
                ))
            db.commit()
        except Exception as e:
            db.rollback()
            # No interrumpir el flujo por alertas
            print(f"Error creando alertas de asignación de componente: {e}")
    
    # Actualizar avance del plan
    plan = db.query(PlanInstitucional).filter(PlanInstitucional.id == componente.plan_id).first()
    if plan:
        plan.porcentaje_avance = calcular_porcentaje_avance_plan(plan, db)
        db.commit()
    
    return componente


@router.delete("/componentes/{componente_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_componente(
    componente_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _feature: bool = Depends(require_feature_enabled('enable_planes_institucionales'))
):
    """Eliminar un componente (solo admins)"""
    if current_user.role not in [UserRole.ADMIN, UserRole.SUPERADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo los administradores pueden eliminar componentes"
        )
    
    componente = db.query(ComponenteProceso).filter(ComponenteProceso.id == componente_id).first()
    
    if not componente:
        raise HTTPException(status_code=404, detail="Componente no encontrado")
    
    if not tiene_permiso_componente(current_user, componente, db):
        raise HTTPException(status_code=403, detail="No tienes acceso a este componente")
    
    db.delete(componente)
    db.commit()
    
    return None


# ==================== ENDPOINTS ACTIVIDADES ====================

@router.get("/componentes/{componente_id}/actividades", response_model=List[plan_schemas.Actividad])
def listar_actividades(
    componente_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _feature: bool = Depends(require_feature_enabled('enable_planes_institucionales'))
):
    """
    Listar actividades de un componente.
    - ADMIN/SUPERADMIN: ven todas las actividades
    - SECRETARIO: solo ve actividades asignadas a su secretaría
    """
    componente = db.query(ComponenteProceso).filter(ComponenteProceso.id == componente_id).first()
    
    if not componente:
        raise HTTPException(status_code=404, detail="Componente no encontrado")
    
    if not tiene_permiso_componente(current_user, componente, db):
        raise HTTPException(status_code=403, detail="No tienes acceso a este componente")
    
    query = db.query(Actividad).filter(Actividad.componente_id == componente_id)
    
    # Si es secretario, filtrar solo sus actividades
    if current_user.role == UserRole.SECRETARIO and current_user.secretaria:
        query = query.filter(Actividad.responsable == current_user.secretaria)
    
    return query.order_by(Actividad.created_at).all()


@router.get("/actividades/{actividad_id}", response_model=plan_schemas.Actividad)
def obtener_actividad(
    actividad_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _feature: bool = Depends(require_feature_enabled('enable_planes_institucionales'))
):
    """Obtener una actividad específica"""
    actividad = db.query(Actividad).filter(Actividad.id == actividad_id).first()
    
    if not actividad:
        raise HTTPException(status_code=404, detail="Actividad no encontrada")
    
    if not tiene_permiso_actividad(current_user, actividad, db):
        raise HTTPException(status_code=403, detail="No tienes acceso a esta actividad")
    
    return actividad


@router.get("/actividades/{actividad_id}/completa", response_model=plan_schemas.ActividadCompleta)
def obtener_actividad_completa(
    actividad_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _feature: bool = Depends(require_feature_enabled('enable_planes_institucionales'))
):
    """Obtener una actividad con todas sus ejecuciones"""
    actividad = db.query(Actividad).options(
        joinedload(Actividad.actividades_ejecucion)
    ).filter(Actividad.id == actividad_id).first()
    
    if not actividad:
        raise HTTPException(status_code=404, detail="Actividad no encontrada")
    
    if not tiene_permiso_actividad(current_user, actividad, db):
        raise HTTPException(status_code=403, detail="No tienes acceso a esta actividad")
    
    return actividad


@router.post("/componentes/{componente_id}/actividades", response_model=plan_schemas.Actividad,
             status_code=status.HTTP_201_CREATED)
def crear_actividad(
    componente_id: int,
    actividad_data: plan_schemas.ActividadCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _feature: bool = Depends(require_feature_enabled('enable_planes_institucionales'))
):
    """Crear una nueva actividad en un componente"""
    if current_user.role not in [UserRole.ADMIN, UserRole.SUPERADMIN, UserRole.SECRETARIO]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permisos para crear actividades"
        )
    
    componente = db.query(ComponenteProceso).filter(ComponenteProceso.id == componente_id).first()
    
    if not componente:
        raise HTTPException(status_code=404, detail="Componente no encontrado")
    
    if not tiene_permiso_componente(current_user, componente, db):
        raise HTTPException(status_code=403, detail="No tienes acceso a este componente")
    
    if actividad_data.componente_id != componente_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El componente_id no coincide"
        )
    
    # Validar fechas
    if actividad_data.fecha_inicio_prevista >= actividad_data.fecha_fin_prevista:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La fecha de inicio debe ser anterior a la fecha de fin"
        )
    
    nueva_actividad = Actividad(**actividad_data.model_dump())
    db.add(nueva_actividad)
    db.commit()
    db.refresh(nueva_actividad)
    
    # Crear alertas para secretarios responsables y administradores
    try:
        # 1. Alertas para secretarios responsables de la actividad
        if nueva_actividad.responsable:
            secretarios = db.query(User).filter(
                User.role == UserRole.SECRETARIO,
                User.entity_id == componente.plan.entity_id,
                User.secretaria == nueva_actividad.responsable,
                User.is_active == True
            ).all()
            
            for secretario in secretarios:
                db.add(Alert(
                    entity_id=componente.plan.entity_id,
                    recipient_user_id=secretario.id,
                    type="PLAN_NEW_ACTIVITY",
                    title="Nueva actividad asignada en Plan Institucional",
                    message=f"Se te ha asignado una nueva actividad en el componente '{componente.nombre}'",
                    data=json.dumps({
                        "plan_id": componente.plan_id,
                        "componente_id": componente_id,
                        "actividad_id": nueva_actividad.id
                    }),
                ))

        # 2. Alertas para administradores de la entidad
        admins = db.query(User).filter(
            User.role == UserRole.ADMIN,
            User.entity_id == componente.plan.entity_id,
            User.is_active == True
        ).all()
        
        for admin in admins:
            db.add(Alert(
                entity_id=componente.plan.entity_id,
                recipient_user_id=admin.id,
                type="PLAN_NEW_ACTIVITY",
                title="Nueva actividad en Plan Institucional",
                message=f"Se creó una nueva actividad en el componente '{componente.nombre}'",
                data=json.dumps({
                    "plan_id": componente.plan_id,
                    "componente_id": componente_id,
                    "actividad_id": nueva_actividad.id
                }),
            ))
        
        db.commit()
        
    except Exception as e:
        db.rollback()
        # No interrumpir el flujo por alertas
    
    return nueva_actividad


@router.put("/actividades/{actividad_id}", response_model=plan_schemas.Actividad)
def actualizar_actividad(
    actividad_id: int,
    actividad_data: plan_schemas.ActividadUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _feature: bool = Depends(require_feature_enabled('enable_planes_institucionales'))
):
    """
    Actualizar una actividad.
    Solo ADMIN y SUPERADMIN pueden editar actividades.
    Los SECRETARIOS no pueden editar actividades, solo registrar ejecuciones.
    """
    actividad = db.query(Actividad).filter(Actividad.id == actividad_id).first()
    
    if not actividad:
        raise HTTPException(status_code=404, detail="Actividad no encontrada")
    
    if not puede_editar_actividad(current_user, actividad, db):
        raise HTTPException(status_code=403, detail="No tienes permiso para editar esta actividad. Los secretarios solo pueden registrar avances de ejecución.")
    
    update_data = actividad_data.model_dump(exclude_unset=True)
    
    # Validaciones
    if 'fecha_inicio_prevista' in update_data and 'fecha_fin_prevista' in update_data:
        if update_data['fecha_inicio_prevista'] >= update_data['fecha_fin_prevista']:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="La fecha de inicio debe ser anterior a la fecha de fin"
            )
    
    for field, value in update_data.items():
        setattr(actividad, field, value)
    
    db.commit()
    db.refresh(actividad)
    
    # Actualizar avance del componente y plan (sin presupuesto)
    componente = db.query(ComponenteProceso).filter(ComponenteProceso.id == actividad.componente_id).first()
    if componente:
        componente.porcentaje_avance = calcular_porcentaje_avance_componente(componente, db)
        db.commit()
        plan = db.query(PlanInstitucional).filter(PlanInstitucional.id == componente.plan_id).first()
        if plan:
            plan.porcentaje_avance = calcular_porcentaje_avance_plan(plan, db)
            db.commit()
    
    return actividad


## Eliminado: endpoint de actualización manual de avance de actividad


@router.delete("/actividades/{actividad_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_actividad(
    actividad_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _feature: bool = Depends(require_feature_enabled('enable_planes_institucionales'))
):
    """Eliminar una actividad (solo admins)"""
    if current_user.role not in [UserRole.ADMIN, UserRole.SUPERADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo los administradores pueden eliminar actividades"
        )
    
    actividad = db.query(Actividad).filter(Actividad.id == actividad_id).first()
    
    if not actividad:
        raise HTTPException(status_code=404, detail="Actividad no encontrada")
    
    if not tiene_permiso_actividad(current_user, actividad, db):
        raise HTTPException(status_code=403, detail="No tienes acceso a esta actividad")
    
    db.delete(actividad)
    db.commit()
    
    return None


# ==================== ENDPOINTS ACTIVIDADES DE EJECUCIÓN ====================

@router.get("/actividades/{actividad_id}/ejecuciones", response_model=List[plan_schemas.ActividadEjecucion])
def listar_ejecuciones(
    actividad_id: int,
    fecha_desde: Optional[date] = Query(None, description="Filtrar desde fecha"),
    fecha_hasta: Optional[date] = Query(None, description="Filtrar hasta fecha"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _feature: bool = Depends(require_feature_enabled('enable_planes_institucionales'))
):
    """Listar todas las ejecuciones de una actividad"""
    actividad = db.query(Actividad).filter(Actividad.id == actividad_id).first()
    
    if not actividad:
        raise HTTPException(status_code=404, detail="Actividad no encontrada")
    
    if not tiene_permiso_actividad(current_user, actividad, db):
        raise HTTPException(status_code=403, detail="No tienes acceso a esta actividad")
    
    query = db.query(ActividadEjecucion).filter(ActividadEjecucion.actividad_id == actividad_id)
    
    if fecha_desde:
        query = query.filter(ActividadEjecucion.fecha_registro >= fecha_desde)
    
    if fecha_hasta:
        query = query.filter(ActividadEjecucion.fecha_registro <= fecha_hasta)
    
    return query.order_by(ActividadEjecucion.fecha_registro.desc()).all()


@router.get("/ejecuciones/{ejecucion_id}", response_model=plan_schemas.ActividadEjecucion)
def obtener_ejecucion(
    ejecucion_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _feature: bool = Depends(require_feature_enabled('enable_planes_institucionales'))
):
    """Obtener una ejecución específica"""
    ejecucion = db.query(ActividadEjecucion).filter(ActividadEjecucion.id == ejecucion_id).first()
    
    if not ejecucion:
        raise HTTPException(status_code=404, detail="Ejecución no encontrada")
    
    # Verificar permisos a través de la actividad
    actividad = db.query(Actividad).filter(Actividad.id == ejecucion.actividad_id).first()
    if not actividad or not tiene_permiso_actividad(current_user, actividad, db):
        raise HTTPException(status_code=403, detail="No tienes acceso a esta ejecución")
    
    return ejecucion


@router.post("/actividades/{actividad_id}/ejecuciones", response_model=plan_schemas.ActividadEjecucion,
             status_code=status.HTTP_201_CREATED)
def crear_ejecucion(
    actividad_id: int,
    ejecucion_data: plan_schemas.ActividadEjecucionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _feature: bool = Depends(require_feature_enabled('enable_planes_institucionales'))
):
    """
    Crear una nueva ejecución para una actividad.
    - ADMIN/SUPERADMIN: pueden registrar en cualquier actividad
    - SECRETARIO: solo en actividades asignadas a su secretaría
    """
    if current_user.role not in [UserRole.ADMIN, UserRole.SUPERADMIN, UserRole.SECRETARIO]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permisos para registrar ejecuciones"
        )
    
    actividad = db.query(Actividad).filter(Actividad.id == actividad_id).first()
    
    if not actividad:
        raise HTTPException(status_code=404, detail="Actividad no encontrada")
    
    # Validar permisos específicos para registrar ejecución
    if not puede_registrar_ejecucion(current_user, actividad, db):
        if current_user.role == UserRole.SECRETARIO:
            raise HTTPException(
                status_code=403, 
                detail=f"Solo puedes registrar avances en actividades asignadas a tu secretaría ({current_user.secretaria}). Esta actividad está asignada a: {actividad.responsable}"
            )
        else:
            raise HTTPException(status_code=403, detail="No tienes acceso a esta actividad")
    
    if ejecucion_data.actividad_id != actividad_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El actividad_id no coincide"
        )
    
    nueva_ejecucion = ActividadEjecucion(
        **ejecucion_data.model_dump()
    )
    
    db.add(nueva_ejecucion)
    db.commit()
    db.refresh(nueva_ejecucion)
    
    # Recalcular avances
    componente = db.query(ComponenteProceso).filter(ComponenteProceso.id == actividad.componente_id).first()
    if componente:
        componente.porcentaje_avance = calcular_porcentaje_avance_componente(componente, db)
        db.commit()
        plan = db.query(PlanInstitucional).filter(PlanInstitucional.id == componente.plan_id).first()
        if plan:
            plan.porcentaje_avance = calcular_porcentaje_avance_plan(plan, db)
            db.commit()
    return nueva_ejecucion


@router.put("/ejecuciones/{ejecucion_id}", response_model=plan_schemas.ActividadEjecucion)
def actualizar_ejecucion(
    ejecucion_id: int,
    ejecucion_data: plan_schemas.ActividadEjecucionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _feature: bool = Depends(require_feature_enabled('enable_planes_institucionales'))
):
    """Actualizar una ejecución existente"""
    ejecucion = db.query(ActividadEjecucion).filter(ActividadEjecucion.id == ejecucion_id).first()
    
    if not ejecucion:
        raise HTTPException(status_code=404, detail="Ejecución no encontrada")
    
    # Verificar permisos
    actividad = db.query(Actividad).filter(Actividad.id == ejecucion.actividad_id).first()
    if not actividad or not tiene_permiso_actividad(current_user, actividad, db):
        raise HTTPException(status_code=403, detail="No tienes permiso para editar esta ejecución")
    
    update_data = ejecucion_data.model_dump(exclude_unset=True)
    
    for field, value in update_data.items():
        setattr(ejecucion, field, value)
    
    db.commit()
    db.refresh(ejecucion)
    
    # Recalcular avances
    if actividad:
        componente = db.query(ComponenteProceso).filter(ComponenteProceso.id == actividad.componente_id).first()
        if componente:
            componente.porcentaje_avance = calcular_porcentaje_avance_componente(componente, db)
            db.commit()
            plan = db.query(PlanInstitucional).filter(PlanInstitucional.id == componente.plan_id).first()
            if plan:
                plan.porcentaje_avance = calcular_porcentaje_avance_plan(plan, db)
                db.commit()
    return ejecucion


@router.delete("/ejecuciones/{ejecucion_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_ejecucion(
    ejecucion_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _feature: bool = Depends(require_feature_enabled('enable_planes_institucionales'))
):
    """Eliminar una ejecución"""
    if current_user.role not in [UserRole.ADMIN, UserRole.SUPERADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo los administradores pueden eliminar ejecuciones"
        )
    
    ejecucion = db.query(ActividadEjecucion).filter(ActividadEjecucion.id == ejecucion_id).first()
    
    if not ejecucion:
        raise HTTPException(status_code=404, detail="Ejecución no encontrada")
    
    # Verificar permisos
    actividad = db.query(Actividad).filter(Actividad.id == ejecucion.actividad_id).first()
    if not actividad or not tiene_permiso_actividad(current_user, actividad, db):
        raise HTTPException(status_code=403, detail="No tienes acceso a esta ejecución")
    
    db.delete(ejecucion)
    db.commit()
    
    # Recalcular avances
    if actividad:
        componente = db.query(ComponenteProceso).filter(ComponenteProceso.id == actividad.componente_id).first()
        if componente:
            componente.porcentaje_avance = calcular_porcentaje_avance_componente(componente, db)
            db.commit()
            plan = db.query(PlanInstitucional).filter(PlanInstitucional.id == componente.plan_id).first()
            if plan:
                plan.porcentaje_avance = calcular_porcentaje_avance_plan(plan, db)
                db.commit()
    return None


# ==================== ENDPOINTS EVIDENCIAS ====================

@router.post("/actividades/ejecuciones/{ejecucion_id}/evidencias", response_model=plan_schemas.ActividadEvidencia, status_code=status.HTTP_201_CREATED)
def crear_evidencia(
    ejecucion_id: int,
    evidencia: plan_schemas.ActividadEvidenciaCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _feature: bool = Depends(require_feature_enabled('enable_planes_institucionales'))
):
    """Crear una evidencia (URL o imagen) para una actividad de ejecución. Máximo 4 imágenes + 1 URL."""
    from app.models.plan import ActividadEvidencia, TipoEvidencia
    
    # Verificar que la ejecución existe
    ejecucion = db.query(ActividadEjecucion).filter(ActividadEjecucion.id == ejecucion_id).first()
    if not ejecucion:
        raise HTTPException(status_code=404, detail="Ejecución de actividad no encontrada")
    
    # Verificar permisos a través de la actividad
    actividad = db.query(Actividad).filter(Actividad.id == ejecucion.actividad_id).first()
    if not actividad or not tiene_permiso_actividad(current_user, actividad, db):
        raise HTTPException(status_code=403, detail="No tiene permisos para agregar evidencias a esta ejecución")
    
    # Validar límites: máximo 1 URL y 4 imágenes
    evidencias_existentes = db.query(ActividadEvidencia).filter(
        ActividadEvidencia.actividad_ejecucion_id == ejecucion_id
    ).all()
    
    if evidencia.tipo == TipoEvidencia.URL:
        urls_existentes = [e for e in evidencias_existentes if e.tipo == TipoEvidencia.URL]
        if len(urls_existentes) >= 1:
            raise HTTPException(status_code=400, detail="Solo se permite una URL por actividad de ejecución")
    elif evidencia.tipo == TipoEvidencia.IMAGEN:
        imagenes_existentes = [e for e in evidencias_existentes if e.tipo == TipoEvidencia.IMAGEN]
        if len(imagenes_existentes) >= 4:
            raise HTTPException(status_code=400, detail="Solo se permiten hasta 4 imágenes por actividad de ejecución")
    
    # Crear la evidencia
    nueva_evidencia = ActividadEvidencia(
        actividad_ejecucion_id=ejecucion_id,
        tipo=evidencia.tipo,
        contenido=evidencia.contenido,
        nombre_archivo=evidencia.nombre_archivo,
        mime_type=evidencia.mime_type,
        orden=evidencia.orden if evidencia.orden is not None else len(evidencias_existentes)
    )
    
    db.add(nueva_evidencia)
    db.commit()
    db.refresh(nueva_evidencia)
    
    return nueva_evidencia


@router.get("/actividades/ejecuciones/{ejecucion_id}/evidencias", response_model=List[plan_schemas.ActividadEvidencia])
def listar_evidencias(
    ejecucion_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _feature: bool = Depends(require_feature_enabled('enable_planes_institucionales'))
):
    """Listar todas las evidencias de una actividad de ejecución"""
    from app.models.plan import ActividadEvidencia
    
    # Verificar que la ejecución existe
    ejecucion = db.query(ActividadEjecucion).filter(ActividadEjecucion.id == ejecucion_id).first()
    if not ejecucion:
        raise HTTPException(status_code=404, detail="Ejecución de actividad no encontrada")
    
    # Verificar permisos
    actividad = db.query(Actividad).filter(Actividad.id == ejecucion.actividad_id).first()
    if not actividad or not tiene_permiso_actividad(current_user, actividad, db):
        raise HTTPException(status_code=403, detail="No tiene permisos para ver las evidencias de esta ejecución")
    
    evidencias = db.query(ActividadEvidencia).filter(
        ActividadEvidencia.actividad_ejecucion_id == ejecucion_id
    ).order_by(ActividadEvidencia.orden).all()
    
    return evidencias


@router.delete("/evidencias/{evidencia_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_evidencia(
    evidencia_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _feature: bool = Depends(require_feature_enabled('enable_planes_institucionales'))
):
    """Eliminar una evidencia"""
    from app.models.plan import ActividadEvidencia
    
    evidencia = db.query(ActividadEvidencia).filter(ActividadEvidencia.id == evidencia_id).first()
    if not evidencia:
        raise HTTPException(status_code=404, detail="Evidencia no encontrada")
    
    # Verificar permisos a través de la ejecución → actividad
    ejecucion = db.query(ActividadEjecucion).filter(ActividadEjecucion.id == evidencia.actividad_ejecucion_id).first()
    if not ejecucion:
        raise HTTPException(status_code=404, detail="Ejecución no encontrada")
    
    actividad = db.query(Actividad).filter(Actividad.id == ejecucion.actividad_id).first()
    if not actividad or not tiene_permiso_actividad(current_user, actividad, db):
        raise HTTPException(status_code=403, detail="No tiene permisos para eliminar esta evidencia")
    
    db.delete(evidencia)
    db.commit()
    
    return None
