from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.config.database import get_db
from app.models.user import User, UserRole
from app.models.secretaria import Secretaria
from app.models.entity import Entity
from app.schemas.secretaria import SecretariaCreate, SecretariaResponse
from app.utils.auth import get_current_user

router = APIRouter()

@router.get("/secretarias/", response_model=List[SecretariaResponse])
async def list_secretarias(
    entity_id: Optional[int] = Query(None),
    include_inactive: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Lista secretarías por entidad.
    - SUPERADMIN: puede especificar entity_id o ver todas; si no especifica entity_id, usa su entity_id asignado o retorna todas.
    - ADMIN/SECRETARIO: retorna de su entidad.
    """
    query = db.query(Secretaria)

    if current_user.role == UserRole.SUPERADMIN:
        if entity_id:
            # Filtrar por entity_id específico
            query = query.filter(Secretaria.entity_id == entity_id)
        elif current_user.entity_id:
            # Si el superadmin tiene entity_id asignado, usar ese
            query = query.filter(Secretaria.entity_id == current_user.entity_id)
        # Si no tiene entity_id ni se especifica uno, retorna todas (sin filtro)
    else:
        if not current_user.entity_id:
            return []
        query = query.filter(Secretaria.entity_id == current_user.entity_id)

    if not include_inactive:
        query = query.filter(Secretaria.is_active == True)  # noqa: E712

    items = query.order_by(Secretaria.nombre.asc()).all()
    return items

@router.post("/secretarias/", response_model=SecretariaResponse)
async def create_secretaria(
    payload: SecretariaCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Crea una secretaría (única por nombre en la entidad)."""
    nombre = (payload.nombre or '').strip()
    if not nombre:
        raise HTTPException(status_code=400, detail="El nombre es obligatorio")

    # Determinar entidad
    if current_user.role == UserRole.SUPERADMIN:
        if not payload.entity_id:
            raise HTTPException(status_code=400, detail="Debe especificar entity_id")
        entity_id = payload.entity_id
    elif current_user.role in [UserRole.ADMIN, UserRole.SECRETARIO]:
        if not current_user.entity_id:
            raise HTTPException(status_code=400, detail="No hay entidad asociada al usuario")
        entity_id = current_user.entity_id
    else:
        raise HTTPException(status_code=403, detail="No tienes permisos para crear secretarías")

    # Validar entidad
    entity = db.query(Entity).filter(Entity.id == entity_id).first()
    if not entity:
        raise HTTPException(status_code=404, detail="Entidad no encontrada")
    if not entity.is_active:
        raise HTTPException(status_code=400, detail="La entidad está inactiva")

    # Verificar duplicado
    existing = db.query(Secretaria).filter(Secretaria.entity_id == entity_id, Secretaria.nombre.ilike(nombre)).first()
    if existing:
        return existing  # idempotente: retornar existente

    item = Secretaria(entity_id=entity_id, nombre=nombre, is_active=True)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item

@router.patch("/secretarias/{id}/toggle/", response_model=SecretariaResponse)
async def toggle_secretaria(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in [UserRole.ADMIN, UserRole.SUPERADMIN]:
        raise HTTPException(status_code=403, detail="No tienes permisos para editar secretarías")

    item = db.query(Secretaria).filter(Secretaria.id == id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Secretaría no encontrada")

    # Admin solo puede cambiar las de su entidad
    if current_user.role == UserRole.ADMIN and item.entity_id != current_user.entity_id:
        raise HTTPException(status_code=403, detail="No puedes editar secretarías de otra entidad")

    item.is_active = not bool(item.is_active)
    db.commit()
    db.refresh(item)
    return item
