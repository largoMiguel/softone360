from pydantic import BaseModel, EmailStr, model_validator
from typing import Optional
from datetime import datetime
from app.models.pqrs import TipoSolicitud, EstadoPQRS, TipoIdentificacion, MedioRespuesta, CanalLlegada, TipoPersona, Genero

# Esquemas base
class PQRSBase(BaseModel):
    canal_llegada: CanalLlegada = CanalLlegada.WEB
    tipo_identificacion: TipoIdentificacion = TipoIdentificacion.PERSONAL
    medio_respuesta: MedioRespuesta = MedioRespuesta.EMAIL
    nombre_ciudadano: Optional[str] = None
    cedula_ciudadano: Optional[str] = None
    telefono_ciudadano: Optional[str] = None
    email_ciudadano: Optional[EmailStr] = None
    direccion_ciudadano: Optional[str] = None
    tipo_solicitud: TipoSolicitud
    asunto: Optional[str] = None  # Opcional para anónimas
    descripcion: str
    tipo_persona: Optional[TipoPersona] = None
    genero: Optional[Genero] = None
    dias_respuesta: Optional[int] = None
    archivo_adjunto: Optional[str] = None

class PQRSCreate(PQRSBase):
    numero_radicado: Optional[str] = None
    entity_id: int  # Obligatorio al crear

class PQRSUpdate(BaseModel):
    canal_llegada: Optional[CanalLlegada] = None
    tipo_identificacion: Optional[TipoIdentificacion] = None
    medio_respuesta: Optional[MedioRespuesta] = None
    nombre_ciudadano: Optional[str] = None
    cedula_ciudadano: Optional[str] = None
    telefono_ciudadano: Optional[str] = None
    email_ciudadano: Optional[EmailStr] = None
    direccion_ciudadano: Optional[str] = None
    tipo_solicitud: Optional[TipoSolicitud] = None
    asunto: Optional[str] = None
    descripcion: Optional[str] = None
    estado: Optional[EstadoPQRS] = None
    respuesta: Optional[str] = None
    assigned_to_id: Optional[int] = None
    fecha_solicitud: Optional[datetime] = None
    tipo_persona: Optional[TipoPersona] = None
    genero: Optional[Genero] = None
    dias_respuesta: Optional[int] = None
    archivo_adjunto: Optional[str] = None

class PQRSResponse(BaseModel):
    respuesta: str

class PQRS(PQRSBase):
    id: int
    numero_radicado: str
    canal_llegada: CanalLlegada
    tipo_identificacion: TipoIdentificacion
    medio_respuesta: MedioRespuesta
    estado: EstadoPQRS
    fecha_solicitud: datetime
    fecha_cierre: Optional[datetime] = None
    fecha_delegacion: Optional[datetime] = None
    fecha_respuesta: Optional[datetime] = None
    respuesta: Optional[str] = None
    created_by_id: int
    assigned_to_id: Optional[int] = None
    entity_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    tipo_persona: Optional[TipoPersona] = None
    genero: Optional[Genero] = None
    dias_respuesta: Optional[int] = None
    archivo_adjunto: Optional[str] = None
    
    class Config:
        from_attributes = True

class PQRSWithDetails(PQRS):
    created_by: Optional[dict] = None
    assigned_to: Optional[dict] = None