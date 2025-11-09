from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer
from sqlalchemy.orm import Session
from datetime import timedelta
from app.config.database import get_db
from app.config.settings import settings
from app.models.user import User, UserRole
from app.schemas.user import UserCreate, UserLogin, Token, User as UserSchema
from app.utils.auth import (
    verify_password, 
    get_password_hash, 
    create_access_token,
    get_current_active_user,
    require_admin
)

router = APIRouter(prefix="/auth", tags=["Autenticación"])

@router.post("/login", response_model=Token)
async def login(user_credentials: UserLogin, db: Session = Depends(get_db)):
    """Iniciar sesión"""
    from sqlalchemy.orm import joinedload
    
    # Cargar usuario con su entidad (eager loading)
    user = db.query(User).options(joinedload(User.entity)).filter(
        User.username == user_credentials.username
    ).first()
    
    if not user or not verify_password(user_credentials.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales incorrectas",
            headers={"WWW-Authenticate": "Bearer"}
        )
    
    # Verificar si el usuario está activo
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tu cuenta está inactiva. Contacta al administrador."
        )
    
    access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user
    }

@router.post("/register", response_model=UserSchema)
async def register(user_data: UserCreate, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    """Registrar nuevo usuario (solo admin)"""
    # Verificar si el usuario ya existe
    existing_user = db.query(User).filter(
        (User.username == user_data.username) | (User.email == user_data.email)
    ).first()
    
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El usuario o email ya existe"
        )
    
    # Crear nuevo usuario
    hashed_password = get_password_hash(user_data.password)
    db_user = User(
        username=user_data.username,
        email=user_data.email,
        full_name=user_data.full_name,
        hashed_password=hashed_password,
        role=user_data.role,
        secretaria=user_data.secretaria,
        cedula=user_data.cedula,
        telefono=user_data.telefono,
        direccion=user_data.direccion
    )
    
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    return db_user

@router.post("/register-ciudadano", response_model=UserSchema)
async def register_ciudadano(user_data: UserCreate, db: Session = Depends(get_db)):
    """Registrar nuevo ciudadano (endpoint público)"""
    # Validar que el rol sea ciudadano
    if user_data.role != UserRole.CIUDADANO:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Este endpoint es solo para registro de ciudadanos"
        )
    
    # Verificar que la cédula sea proporcionada
    if not user_data.cedula:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La cédula es requerida para ciudadanos"
        )
    
    # Verificar si el usuario ya existe
    existing_user = db.query(User).filter(
        (User.username == user_data.username) | 
        (User.email == user_data.email) |
        (User.cedula == user_data.cedula)
    ).first()
    
    if existing_user:
        if existing_user.username == user_data.username:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El nombre de usuario ya está en uso"
            )
        elif existing_user.email == user_data.email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El email ya está registrado"
            )
        elif existing_user.cedula == user_data.cedula:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="La cédula ya está registrada"
            )
    
    # Crear nuevo ciudadano
    hashed_password = get_password_hash(user_data.password)
    db_user = User(
        username=user_data.username,
        email=user_data.email,
        full_name=user_data.full_name,
        hashed_password=hashed_password,
        role=UserRole.CIUDADANO,
        cedula=user_data.cedula,
        telefono=user_data.telefono,
        direccion=user_data.direccion
    )
    
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    return db_user

@router.get("/me", response_model=UserSchema)
async def get_current_user_info(current_user: User = Depends(get_current_active_user)):
    """Obtener información del usuario actual"""
    return current_user

@router.get("/users", response_model=list[UserSchema])
async def get_users(db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    """Obtener lista de usuarios (solo admin)"""
    users = db.query(User).all()
    return users