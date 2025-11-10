from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.config.database import get_db
from app.models.user import User, UserRole, UserType
from app.models.entity import Entity
from app.schemas.user import UserCreate, UserUpdate, UserResponse, ChangePasswordRequest
from app.utils.auth import (
    get_password_hash, 
    get_current_user, 
    require_superadmin, 
    require_admin_or_superadmin,
    check_entity_access
)

router = APIRouter()

@router.get("/users/secretarias/", response_model=List[str])
async def list_secretarias(
    entity_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Devuelve la lista de nombres de secretarías existentes (distintas) para una entidad.
    - SUPERADMIN: puede consultar por cualquier entidad si especifica entity_id; si no, retorna vacío.
    - ADMIN/SECRETARIO: retorna las secretarías dentro de su propia entidad.
    """
    query = db.query(User.secretaria).filter(
        User.secretaria.isnot(None),
        User.secretaria != ""
    )

    if current_user.role == UserRole.SUPERADMIN:
        if entity_id:
            query = query.filter(User.entity_id == entity_id)
        else:
            # Sin entity_id explícito, no retornar global para evitar mezclar entre entidades
            return []
    else:
        # Admin/Secretario limitados a su entidad
        if not current_user.entity_id:
            return []
        query = query.filter(User.entity_id == current_user.entity_id)

    rows = query.distinct().all()
    secretarias = sorted([r[0] for r in rows if r and r[0]], key=lambda s: s.lower())
    return secretarias

@router.get("/users/", response_model=List[UserResponse])
async def get_users(
    role: Optional[str] = Query(None),
    entity_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Obtener lista de usuarios.
    - Superadmin: puede ver todos los usuarios de todas las entidades
    - Admin: puede ver solo usuarios de su entidad
    - Secretarios: pueden ver solo otros secretarios de su entidad
    """
    query = db.query(User)
    
    # Superadmin puede ver todos los usuarios
    if current_user.role == UserRole.SUPERADMIN:
        # Puede filtrar por entidad si se especifica
        if entity_id:
            query = query.filter(User.entity_id == entity_id)
        # Puede filtrar por rol
        if role:
            try:
                role_enum = UserRole[role.upper()]
                query = query.filter(User.role == role_enum)
            except KeyError:
                pass
    
    # Admin solo ve usuarios de su entidad
    elif current_user.role == UserRole.ADMIN:
        query = query.filter(User.entity_id == current_user.entity_id)
        # Puede filtrar por rol dentro de su entidad
        if role:
            try:
                role_enum = UserRole[role.upper()]
                query = query.filter(User.role == role_enum)
            except KeyError:
                pass
    
    # Secretario solo ve otros secretarios de su entidad
    elif current_user.role == UserRole.SECRETARIO:
        query = query.filter(
            User.role == UserRole.SECRETARIO,
            User.entity_id == current_user.entity_id
        )
    
    users = query.all()
    return users

@router.get("/users/{user_id}/", response_model=UserResponse)
async def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Obtener un usuario específico por ID.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    # Superadmin puede ver cualquier usuario
    if current_user.role == UserRole.SUPERADMIN:
        return user
    
    # Admin puede ver usuarios de su entidad
    if current_user.role == UserRole.ADMIN:
        if user.entity_id != current_user.entity_id:
            raise HTTPException(status_code=403, detail="No tienes permisos para acceder a esta información")
        return user
    
    # Otros usuarios solo pueden ver su propio perfil
    if current_user.id != user_id:
        raise HTTPException(status_code=403, detail="No tienes permisos para acceder a esta información")
    
    return user

@router.post("/users/", response_model=UserResponse)
async def create_user(
    user_data: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Crear un nuevo usuario.
    - Superadmin: puede crear usuarios de cualquier tipo y asignarlos a cualquier entidad
    - Admin: solo puede crear secretarios dentro de su entidad
    """
    # Verificar permisos
    if current_user.role == UserRole.SUPERADMIN:
        # Superadmin puede crear cualquier tipo de usuario
        pass
    elif current_user.role == UserRole.ADMIN:
        # ✅ CORREGIDO: Admin SOLO puede crear Secretarios/Ciudadanos, NO otros Admins
        if user_data.role in [UserRole.ADMIN, UserRole.SUPERADMIN]:
            raise HTTPException(
                status_code=403, 
                detail="Solo puedes crear secretarios. Los administradores solo pueden ser creados por SuperAdmin."
            )
        # Forzar que el usuario pertenezca a su entidad
        user_data.entity_id = current_user.entity_id
    else:
            raise HTTPException(
                status_code=403, 
                detail="No tienes permisos para crear usuarios"
            )
    
    # ✅ VALIDACIÓN ESTRICTA DE MÓDULOS: Solo SUPERADMIN puede asignar módulos
    if user_data.allowed_modules and current_user.role != UserRole.SUPERADMIN:
        raise HTTPException(
            status_code=403,
            detail="Solo el SuperAdmin puede asignar módulos a usuarios"
        )
    
    # Validar que la entidad existe si se especifica    # Validar que la entidad existe si se especifica
    if user_data.entity_id:
        entity = db.query(Entity).filter(Entity.id == user_data.entity_id).first()
        if not entity:
            raise HTTPException(status_code=400, detail="La entidad especificada no existe")
        if not entity.is_active:
            raise HTTPException(status_code=400, detail="La entidad está inactiva")
        
        # Validar que los módulos asignados están activos en la entidad
        if user_data.allowed_modules:
            valid_modules = []
            if entity.enable_pqrs:
                valid_modules.append("pqrs")
            if entity.enable_users_admin:
                valid_modules.append("users_admin")
            if entity.enable_planes_institucionales:
                valid_modules.append("planes_institucionales")
            if entity.enable_pdm:
                valid_modules.append("pdm")
            if entity.enable_contratacion:
                valid_modules.append("contratacion")
            if entity.enable_reports_pdf:
                valid_modules.append("reports_pdf")
            if entity.enable_ai_reports:
                valid_modules.append("ai_reports")
            
            # Verificar que todos los módulos solicitados están activos
            for module in user_data.allowed_modules:
                if module not in valid_modules:
                    raise HTTPException(
                        status_code=400, 
                        detail=f"El módulo '{module}' no está activo en esta entidad"
                    )
    
    # Verificar si el username ya existe
    existing_user = db.query(User).filter(User.username == user_data.username).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="El nombre de usuario ya existe")
    
    # Verificar si el email ya existe
    existing_email = db.query(User).filter(User.email == user_data.email).first()
    if existing_email:
        raise HTTPException(status_code=400, detail="El email ya está en uso")
    
    # Crear el hash de la contraseña
    hashed_password = get_password_hash(user_data.password)
    
    # Normalizar y validar user_type (acepta Enum o string), guardar en minúsculas
    normalized_user_type = None
    if user_data.user_type is not None:
        if isinstance(user_data.user_type, UserType):
            normalized_user_type = user_data.user_type.value  # 'secretario' | 'contratista'
        else:
            # Puede venir como string, normalizar
            ut_str = str(user_data.user_type).strip().lower()
            if ut_str not in {UserType.SECRETARIO.value, UserType.CONTRATISTA.value}:
                raise HTTPException(status_code=400, detail="user_type inválido (use 'secretario' o 'contratista')")
            normalized_user_type = ut_str

    # Si se proporciona una secretaría, asegurar que existe en la tabla secretarias (idempotente)
    secretaria_nombre = (user_data.secretaria or '').strip() if user_data.secretaria else None
    if secretaria_nombre and user_data.entity_id:
        from app.models.secretaria import Secretaria
        existing_secretaria = db.query(Secretaria).filter(
            Secretaria.entity_id == user_data.entity_id,
            Secretaria.nombre.ilike(secretaria_nombre)
        ).first()
        if not existing_secretaria:
            # Crear automáticamente la secretaría
            new_secretaria = Secretaria(
                entity_id=user_data.entity_id,
                nombre=secretaria_nombre,
                is_active=True
            )
            db.add(new_secretaria)
            db.flush()  # Asegurar que se crea antes del usuario

    # Crear el usuario
    db_user = User(
        username=user_data.username,
        email=user_data.email,
        full_name=user_data.full_name,
        hashed_password=hashed_password,
        role=user_data.role,
        entity_id=user_data.entity_id,
        user_type=normalized_user_type,
        allowed_modules=user_data.allowed_modules or [],
        secretaria=secretaria_nombre,
        is_active=True
    )
    
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    return db_user

@router.put("/users/{user_id}/", response_model=UserResponse)
async def update_user(
    user_id: int,
    user_data: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Actualizar un usuario existente.
    """
    # Permisos: SUPERADMIN puede actualizar a cualquiera.
    # ADMIN puede actualizar usuarios de su misma entidad (no puede promover a SUPERADMIN ni cambiar a otra entidad).
    # Cada usuario puede actualizar su propio perfil (limitado por el frontend generalmente).
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    if current_user.role == UserRole.SUPERADMIN:
        pass  # acceso total
    elif current_user.role == UserRole.ADMIN:
        # Debe pertenecer a su misma entidad
        if user.entity_id != current_user.entity_id:
            raise HTTPException(status_code=403, detail="No puedes actualizar usuarios de otra entidad")
        # ADMIN NO puede editar a otros ADMINs ni SUPERADMINs
        if user.role in [UserRole.ADMIN, UserRole.SUPERADMIN]:
            raise HTTPException(status_code=403, detail="No puedes editar a otros administradores. Solo el SuperAdmin puede hacerlo.")
    elif current_user.id == user_id:
        pass  # puede actualizar su propio perfil
    else:
        raise HTTPException(status_code=403, detail="No tienes permisos para actualizar este usuario")

    # Actualizar campos si se proporcionan
    update_data = user_data.dict(exclude_unset=True)
    
    # Si se proporciona una nueva contraseña, hashearla
    if "password" in update_data:
        update_data["hashed_password"] = get_password_hash(update_data.pop("password"))
    
    # ✅ FIX: Permitir cambio de entity_id incluso si viene como None (para "Sin entidad")
    # Validar cambio de entidad para ADMIN ANTES de procesarlo
    if current_user.role == UserRole.ADMIN and "entity_id" in update_data:
        if update_data["entity_id"] is not None and update_data["entity_id"] != current_user.entity_id:
            raise HTTPException(status_code=403, detail="No puedes mover usuarios a otra entidad")
    
    # Validar módulos permitidos si se actualizan
    if "allowed_modules" in update_data and update_data.get("entity_id"):
        # ✅ ESTRICTO: Solo SUPERADMIN puede cambiar módulos de CUALQUIER ADMIN (incluyendo a sí mismo)
        # Si current_user es ADMIN y quiere cambiar módulos:
        #   - Si es otro ADMIN → Error
        #   - Si es él mismo pero es ADMIN → Error (NO puede cambiar sus propios módulos)
        if current_user.role == UserRole.ADMIN:
            # Un ADMIN nunca puede cambiar módulos, ni siquiera los suyos propios
            raise HTTPException(status_code=403, detail="Solo el SuperAdmin puede cambiar módulos. Los administradores no pueden modificar módulos.")
        
        entity = db.query(Entity).filter(Entity.id == user.entity_id).first()
        if entity:
            valid_modules = []
            if entity.enable_pqrs:
                valid_modules.append("pqrs")
            if entity.enable_users_admin:
                valid_modules.append("users_admin")
            if entity.enable_planes_institucionales:
                valid_modules.append("planes_institucionales")
            if entity.enable_pdm:
                valid_modules.append("pdm")
            if entity.enable_contratacion:
                valid_modules.append("contratacion")
            if entity.enable_reports_pdf:
                valid_modules.append("reports_pdf")
            if entity.enable_ai_reports:
                valid_modules.append("ai_reports")
            
            for module in update_data.get("allowed_modules", []):
                if module not in valid_modules:
                    raise HTTPException(
                        status_code=400,
                        detail=f"El módulo '{module}' no está activo en esta entidad"
                    )
    
    # Verificar si el username ya existe (si se está cambiando)
    if "username" in update_data and update_data["username"] != user.username:
        existing_user = db.query(User).filter(User.username == update_data["username"]).first()
        if existing_user:
            raise HTTPException(status_code=400, detail="El nombre de usuario ya existe")
    
    # Verificar si el email ya existe (si se está cambiando)
    if "email" in update_data and update_data["email"] != user.email:
        existing_email = db.query(User).filter(User.email == update_data["email"]).first()
        if existing_email:
            raise HTTPException(status_code=400, detail="El email ya está en uso")
    
    # Normalizar rol si viene como string y validar restricciones
    if "role" in update_data:
        role_val = update_data["role"]
        if isinstance(role_val, str):
            try:
                update_data["role"] = UserRole[role_val.upper()]
            except KeyError:
                raise HTTPException(status_code=400, detail="Rol inválido")
        # Restringir a ADMIN para no promover a SUPERADMIN
        if current_user.role == UserRole.ADMIN and update_data["role"] == UserRole.SUPERADMIN:
            raise HTTPException(status_code=403, detail="No puedes asignar rol SUPERADMIN")

    # Normalizar user_type si viene en la actualización
    if "user_type" in update_data:
        raw_ut = update_data["user_type"]
        if raw_ut is None:
            update_data["user_type"] = None
        elif isinstance(raw_ut, UserType):
            update_data["user_type"] = raw_ut.value
        else:
            ut_str = str(raw_ut).strip().lower()
            if ut_str not in {UserType.SECRETARIO.value, UserType.CONTRATISTA.value}:
                raise HTTPException(status_code=400, detail="user_type inválido (use 'secretario' o 'contratista')")
            update_data["user_type"] = ut_str

    # Si se está actualizando la secretaría, asegurar que existe en la tabla secretarias (idempotente)
    if "secretaria" in update_data:
        secretaria_nombre = (update_data["secretaria"] or '').strip() if update_data["secretaria"] else None
        if secretaria_nombre and user.entity_id:
            from app.models.secretaria import Secretaria
            existing_secretaria = db.query(Secretaria).filter(
                Secretaria.entity_id == user.entity_id,
                Secretaria.nombre.ilike(secretaria_nombre)
            ).first()
            if not existing_secretaria:
                # Crear automáticamente la secretaría
                new_secretaria = Secretaria(
                    entity_id=user.entity_id,
                    nombre=secretaria_nombre,
                    is_active=True
                )
                db.add(new_secretaria)
                db.flush()  # Asegurar que se crea antes de actualizar usuario
        update_data["secretaria"] = secretaria_nombre

    # Aplicar las actualizaciones
    for field, value in update_data.items():
        setattr(user, field, value)
    
    db.commit()
    db.refresh(user)
    
    return user

@router.post("/users/{user_id}/change-password/", response_model=dict)
async def change_user_password(
    user_id: int,
    payload: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Cambiar la contraseña de un usuario de forma explícita.
    Permisos:
    - SUPERADMIN: puede cambiar la contraseña de cualquier usuario.
    - ADMIN: solo puede cambiar contraseña de Secretarios/Ciudadanos de su entidad (NO otros Admins)
    - El propio usuario puede cambiar su contraseña.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    # Permisos
    if current_user.role == UserRole.SUPERADMIN:
        pass
    elif current_user.role == UserRole.ADMIN:
        if user.entity_id != current_user.entity_id:
            raise HTTPException(status_code=403, detail="No puedes cambiar la contraseña de usuarios de otra entidad")
        # ✅ Admin NO puede cambiar contraseña de otros Admins
        if user.role in [UserRole.ADMIN, UserRole.SUPERADMIN]:
            raise HTTPException(status_code=403, detail="No puedes cambiar la contraseña de administradores. Solo SuperAdmin puede hacerlo.")
    elif current_user.id == user_id:
        pass
    else:
        raise HTTPException(status_code=403, detail="No tienes permisos para esta acción")

    # Validaciones
    new_password = (payload.new_password or '').strip()
    if len(new_password) < 6:
        raise HTTPException(status_code=400, detail="La contraseña debe tener al menos 6 caracteres")

    # Actualizar hash
    user.hashed_password = get_password_hash(new_password)
    db.commit()
    db.refresh(user)

    return {"message": "Contraseña actualizada exitosamente"}

@router.delete("/users/{user_id}/")
async def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Eliminar un usuario.
    Permisos:
    - SUPERADMIN: puede eliminar a cualquiera (excepto a sí mismo)
    - ADMIN: puede eliminar usuarios de su entidad (excepto otros ADMIN o SUPERADMIN)
    """
    # Verificar que el usuario actual tenga permisos
    if current_user.role not in [UserRole.SUPERADMIN, UserRole.ADMIN]:
        raise HTTPException(status_code=403, detail="No tienes permisos para eliminar usuarios")
    
    # No permitir que se elimine a sí mismo
    if current_user.id == user_id:
        raise HTTPException(status_code=400, detail="No puedes eliminarte a ti mismo")
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    # Si es ADMIN, validar permisos
    if current_user.role == UserRole.ADMIN:
        # Debe pertenecer a su misma entidad
        if user.entity_id != current_user.entity_id:
            raise HTTPException(status_code=403, detail="No puedes eliminar usuarios de otra entidad")
        # ADMIN NO puede eliminar a otros ADMIN o SUPERADMIN
        if user.role in [UserRole.ADMIN, UserRole.SUPERADMIN]:
            raise HTTPException(status_code=403, detail="No puedes eliminar administradores. Solo el SuperAdmin puede hacerlo.")
    
    db.delete(user)
    db.commit()
    
    return {"message": "Usuario eliminado exitosamente"}

@router.patch("/users/{user_id}/toggle-status/", response_model=UserResponse)
async def toggle_user_status(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Activar/desactivar un usuario.
    Permisos:
    - SuperAdmin: puede cambiar estado de cualquiera (excepto sí mismo)
    - Admin: puede cambiar estado de usuarios de su entidad (excepto otros Admins/SuperAdmins)
    """
    # Verificar que el usuario actual sea administrador o superadmin
    if current_user.role not in [UserRole.ADMIN, UserRole.SUPERADMIN]:
        raise HTTPException(status_code=403, detail="No tienes permisos para cambiar el estado de usuarios")
    
    # No permitir que se desactive a sí mismo
    if current_user.id == user_id:
        raise HTTPException(status_code=400, detail="No puedes cambiar tu propio estado")
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    # ✅ Si es Admin, validar que puede cambiar estado de este usuario
    if current_user.role == UserRole.ADMIN:
        # Debe ser de la misma entidad
        if user.entity_id != current_user.entity_id:
            raise HTTPException(status_code=403, detail="No puedes cambiar el estado de usuarios de otra entidad")
        # No puede cambiar estado de otros Admins o SuperAdmins
        if user.role in [UserRole.ADMIN, UserRole.SUPERADMIN]:
            raise HTTPException(status_code=403, detail="No puedes cambiar el estado de administradores. Solo SuperAdmin puede hacerlo.")
    
    # Cambiar el estado
    user.is_active = not user.is_active
    
    db.commit()
    db.refresh(user)
    
    return user

@router.patch("/users/{user_id}/modules/", response_model=UserResponse)
async def update_user_modules(
    user_id: int,
    modules: List[str],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Actualizar los módulos permitidos para un usuario.
    ✅ SOLO SuperAdmin puede modificar módulos
    """
    # ✅ ESTRICTO: Solo SuperAdmin puede modificar módulos
    if current_user.role != UserRole.SUPERADMIN:
        raise HTTPException(status_code=403, detail="Solo el SuperAdmin puede editar módulos de usuarios")
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    # Validar que los módulos están activos en la entidad
    if user.entity_id:
        entity = db.query(Entity).filter(Entity.id == user.entity_id).first()
        if entity:
            valid_modules = []
            if entity.enable_pqrs:
                valid_modules.append("pqrs")
            if entity.enable_users_admin:
                valid_modules.append("users_admin")
            if entity.enable_planes_institucionales:
                valid_modules.append("planes_institucionales")
            if entity.enable_pdm:
                valid_modules.append("pdm")
            if entity.enable_contratacion:
                valid_modules.append("contratacion")
            if entity.enable_reports_pdf:
                valid_modules.append("reports_pdf")
            if entity.enable_ai_reports:
                valid_modules.append("ai_reports")
            
            for module in modules:
                if module not in valid_modules:
                    raise HTTPException(
                        status_code=400,
                        detail=f"El módulo '{module}' no está activo en esta entidad"
                    )
    
    # Actualizar los módulos
    user.allowed_modules = modules
    db.commit()
    db.refresh(user)
    
    return user