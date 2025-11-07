from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime
from app.models.user import UserRole, UserType

# Esquemas base
class UserBase(BaseModel):
    username: str
    email: EmailStr
    full_name: str
    role: UserRole
    entity_id: Optional[int] = None  # ID de la entidad a la que pertenece
    user_type: Optional[UserType] = None  # Tipo: secretario o contratista
    allowed_modules: Optional[List[str]] = None  # Módulos permitidos: ["pqrs", "planes_institucionales", "contratacion"]
    secretaria: Optional[str] = None  # Legacy, mantener por compatibilidad
    cedula: Optional[str] = None
    telefono: Optional[str] = None
    direccion: Optional[str] = None

class UserCreate(UserBase):
    password: str

class UserUpdate(BaseModel):
    username: Optional[str] = None
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    role: Optional[UserRole] = None
    entity_id: Optional[int] = None
    user_type: Optional[UserType] = None
    allowed_modules: Optional[List[str]] = None
    secretaria: Optional[str] = None
    cedula: Optional[str] = None
    telefono: Optional[str] = None
    direccion: Optional[str] = None
    password: Optional[str] = None

class User(UserBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class UserResponse(UserBase):
    id: int
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

# Esquemas de autenticación
class UserLogin(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str
    user: User

class TokenData(BaseModel):
    username: Optional[str] = None

# Cambio de contraseña
class ChangePasswordRequest(BaseModel):
    new_password: str