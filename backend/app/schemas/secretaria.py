from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class SecretariaBase(BaseModel):
    nombre: str = Field(..., min_length=1)

class SecretariaCreate(SecretariaBase):
    entity_id: Optional[int] = None  # SUPERADMIN puede especificarla; ADMIN se fuerza a la suya

class SecretariaResponse(SecretariaBase):
    id: int
    entity_id: int
    is_active: bool
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True
