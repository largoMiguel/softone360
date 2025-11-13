from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime


class EntityBase(BaseModel):
    """Schema base para entidades"""
    name: str = Field(..., min_length=3, max_length=200, description="Nombre de la entidad")
    code: str = Field(..., min_length=2, max_length=50, description="Código único de la entidad")
    nit: Optional[str] = Field(None, max_length=50, description="NIT de la entidad para consultas SECOP")
    slug: str = Field(..., min_length=2, max_length=100, description="URL slug (ej: chiquiza-boyaca)")
    description: Optional[str] = Field(None, description="Descripción de la entidad")
    address: Optional[str] = Field(None, max_length=300, description="Dirección")
    phone: Optional[str] = Field(None, max_length=50, description="Teléfono")
    email: Optional[EmailStr] = Field(None, description="Email de contacto")
    logo_url: Optional[str] = Field(None, max_length=500, description="URL del logo")
    horario_atencion: Optional[str] = Field(None, max_length=200, description="Horario de atención")
    tiempo_respuesta: Optional[str] = Field(None, max_length=100, description="Tiempo de respuesta")
    # Flags de módulos
    enable_pqrs: Optional[bool] = True
    enable_users_admin: Optional[bool] = True
    enable_reports_pdf: Optional[bool] = True
    enable_ai_reports: Optional[bool] = True
    enable_planes_institucionales: Optional[bool] = True
    enable_contratacion: Optional[bool] = True
    enable_pdm: Optional[bool] = True


class EntityCreate(EntityBase):
    """Schema para crear una entidad"""
    pass


class EntityUpdate(BaseModel):
    """Schema para actualizar una entidad"""
    name: Optional[str] = Field(None, min_length=3, max_length=200)
    code: Optional[str] = Field(None, min_length=2, max_length=50)
    nit: Optional[str] = Field(None, max_length=50)
    slug: Optional[str] = Field(None, min_length=2, max_length=100)
    description: Optional[str] = None
    address: Optional[str] = Field(None, max_length=300)
    phone: Optional[str] = Field(None, max_length=50)
    email: Optional[EmailStr] = None
    logo_url: Optional[str] = Field(None, max_length=500)
    horario_atencion: Optional[str] = Field(None, max_length=200)
    tiempo_respuesta: Optional[str] = Field(None, max_length=100)
    is_active: Optional[bool] = None
    enable_pqrs: Optional[bool] = None
    enable_users_admin: Optional[bool] = None
    enable_reports_pdf: Optional[bool] = None
    enable_ai_reports: Optional[bool] = None
    enable_planes_institucionales: Optional[bool] = None
    enable_contratacion: Optional[bool] = None
    enable_pdm: Optional[bool] = None


class EntityResponse(EntityBase):
    """Schema de respuesta para entidades"""
    id: int
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class EntityWithAdmin(EntityResponse):
    """Schema de entidad con información del admin principal"""
    admin_count: int = 0
    user_count: int = 0
    
    class Config:
        from_attributes = True
