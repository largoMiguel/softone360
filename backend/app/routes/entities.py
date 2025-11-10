from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
from app.config.database import get_db
from app.models.entity import Entity
from app.models.user import User, UserRole
from app.schemas.entity import EntityCreate, EntityUpdate, EntityResponse, EntityWithAdmin
from app.utils.auth import require_superadmin, get_current_active_user

router = APIRouter(prefix="/entities", tags=["Entidades"])


@router.get("/by-slug/{slug}", response_model=EntityResponse)
async def get_entity_by_slug(slug: str, db: Session = Depends(get_db)):
    """
    Obtener entidad por slug (endpoint público).
    Usado para cargar información de la entidad en la ventanilla pública.
    """
    entity = db.query(Entity).filter(
        Entity.slug == slug,
        Entity.is_active == True
    ).first()
    
    if not entity:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Entidad no encontrada o inactiva"
        )
    return entity


@router.get("/", response_model=List[EntityWithAdmin])
async def get_entities(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_superadmin)
):
    """
    Obtener todas las entidades (solo superadmin).
    Incluye conteo de administradores y usuarios por entidad.
    """
    entities = db.query(Entity).all()
    
    result = []
    for entity in entities:
        # Contar admins y usuarios de la entidad
        admin_count = db.query(User).filter(
            User.entity_id == entity.id,
            User.role == UserRole.ADMIN
        ).count()
        
        user_count = db.query(User).filter(
            User.entity_id == entity.id
        ).count()
        
        entity_dict = {
            **entity.__dict__,
            "admin_count": admin_count,
            "user_count": user_count
        }
        result.append(entity_dict)
    
    return result


@router.get("/public", response_model=List[EntityResponse])
async def get_public_entities(
    db: Session = Depends(get_db)
):
    """
    Listar entidades activas (público).
    Usado por el guard de entidad por defecto para seleccionar un slug inicial.
    """
    entities = db.query(Entity).filter(Entity.is_active == True).all()
    return entities


@router.get("/{entity_id}", response_model=EntityResponse)
async def get_entity(
    entity_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_superadmin)
):
    """Obtener una entidad específica (solo superadmin)"""
    entity = db.query(Entity).filter(Entity.id == entity_id).first()
    if not entity:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Entidad no encontrada"
        )
    return entity


@router.post("/", response_model=EntityResponse)
async def create_entity(
    entity_data: EntityCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_superadmin)
):
    """
    Crear una nueva entidad (solo superadmin).
    El código de la entidad debe ser único.
    """
    # Verificar si el código ya existe
    existing_entity = db.query(Entity).filter(
        (Entity.code == entity_data.code) | 
        (Entity.name == entity_data.name) |
        (Entity.slug == entity_data.slug)
    ).first()
    
    if existing_entity:
        if existing_entity.code == entity_data.code:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El código de entidad ya existe"
            )
        elif existing_entity.name == entity_data.name:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El nombre de entidad ya existe"
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El slug de entidad ya existe"
            )
    
    # Crear la entidad
    db_entity = Entity(**entity_data.dict())
    db.add(db_entity)
    db.commit()
    db.refresh(db_entity)
    
    return db_entity


@router.put("/{entity_id}", response_model=EntityResponse)
async def update_entity(
    entity_id: int,
    entity_data: EntityUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_superadmin)
):
    """Actualizar una entidad (solo superadmin)"""
    entity = db.query(Entity).filter(Entity.id == entity_id).first()
    if not entity:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Entidad no encontrada"
        )
    
    # Actualizar campos si se proporcionan
    update_data = entity_data.dict(exclude_unset=True)
    
    # Verificar unicidad de código y nombre si se están cambiando
    if "code" in update_data and update_data["code"] != entity.code:
        existing = db.query(Entity).filter(Entity.code == update_data["code"]).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El código de entidad ya existe"
            )
    
    if "name" in update_data and update_data["name"] != entity.name:
        existing = db.query(Entity).filter(Entity.name == update_data["name"]).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El nombre de entidad ya existe"
            )
    
    if "slug" in update_data and update_data["slug"] != entity.slug:
        existing = db.query(Entity).filter(Entity.slug == update_data["slug"]).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El slug de entidad ya existe"
            )
    
    # Aplicar las actualizaciones
    for field, value in update_data.items():
        setattr(entity, field, value)
    
    db.commit()
    db.refresh(entity)
    
    return entity


@router.delete("/{entity_id}")
async def delete_entity(
    entity_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_superadmin)
):
    """
    Eliminar una entidad (solo superadmin).
    Nota: Eliminará en cascada todos los usuarios asociados.
    """
    entity = db.query(Entity).filter(Entity.id == entity_id).first()
    if not entity:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Entidad no encontrada"
        )
    
    # Contar usuarios asociados
    user_count = db.query(User).filter(User.entity_id == entity_id).count()
    
    db.delete(entity)
    db.commit()
    
    return {
        "message": "Entidad eliminada exitosamente",
        "entity_name": entity.name,
        "users_deleted": user_count
    }


@router.patch("/{entity_id}/toggle-status", response_model=EntityResponse)
async def toggle_entity_status(
    entity_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_superadmin)
):
    """
    Activar/desactivar una entidad (solo superadmin).
    Al desactivar una entidad, sus usuarios no podrán iniciar sesión.
    Al reactivar una entidad, también reactiva sus usuarios.
    """
    entity = db.query(Entity).filter(Entity.id == entity_id).first()
    if not entity:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Entidad no encontrada"
        )
    
    # Cambiar el estado
    entity.is_active = not entity.is_active
    
    # Si se desactiva la entidad, desactivar sus usuarios
    if not entity.is_active:
        db.query(User).filter(User.entity_id == entity_id).update(
            {"is_active": False}
        )
    else:
        # Si se reactiva la entidad, también reactivar sus usuarios
        db.query(User).filter(User.entity_id == entity_id).update(
            {"is_active": True}
        )
    
    db.commit()
    db.refresh(entity)
    
    return entity


@router.get("/{entity_id}/users", response_model=List[dict])
async def get_entity_users(
    entity_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_superadmin)
):
    """Obtener todos los usuarios de una entidad (solo superadmin)"""
    entity = db.query(Entity).filter(Entity.id == entity_id).first()
    if not entity:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Entidad no encontrada"
        )
    
    users = db.query(User).filter(User.entity_id == entity_id).all()
    
    return [
        {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role.value,
            "is_active": user.is_active,
            "entity_id": user.entity_id,  # ✅ Agregar entity_id
            "allowed_modules": user.allowed_modules or [],
            "created_at": user.created_at
        }
        for user in users
    ]
