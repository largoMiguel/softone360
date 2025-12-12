from pydantic import BaseModel, EmailStr, model_validator, field_validator
from typing import Optional
from datetime import datetime
from app.models.pqrs import TipoSolicitud, EstadoPQRS, TipoIdentificacion, MedioRespuesta, CanalLlegada, TipoPersona, Genero
import re

# Esquemas base
class PQRSBase(BaseModel):
    canal_llegada: CanalLlegada = CanalLlegada.WEB
    tipo_identificacion: TipoIdentificacion = TipoIdentificacion.PERSONAL
    medio_respuesta: MedioRespuesta = MedioRespuesta.EMAIL
    nombre_ciudadano: Optional[str] = None
    cedula_ciudadano: Optional[str] = None
    telefono_ciudadano: Optional[str] = None
    email_ciudadano: Optional[str] = None  # Cambiado de EmailStr a str para validación condicional
    direccion_ciudadano: Optional[str] = None
    tipo_solicitud: TipoSolicitud
    asunto: Optional[str] = None  # Opcional para anónimas
    descripcion: str
    tipo_persona: Optional[TipoPersona] = None
    genero: Optional[Genero] = None
    dias_respuesta: Optional[int] = None
    archivo_adjunto: Optional[str] = None
    justificacion_asignacion: Optional[str] = None
    archivo_respuesta: Optional[str] = None
    
    @field_validator('email_ciudadano')
    @classmethod
    def validate_email(cls, v):
        """Validar email solo si tiene valor"""
        if v is None or v == '' or v.strip() == '':
            return None
        # Validación básica de formato de email
        email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        if not re.match(email_pattern, v.strip()):
            raise ValueError('El email no tiene un formato válido')
        return v.strip().lower()
    
    @model_validator(mode='after')
    def validate_medio_respuesta(self):
        """Validar campos requeridos según el medio de respuesta"""
        if self.medio_respuesta == MedioRespuesta.EMAIL:
            if not self.email_ciudadano or self.email_ciudadano.strip() == '':
                raise ValueError('El email es obligatorio cuando el medio de respuesta es email')
        elif self.medio_respuesta == MedioRespuesta.FISICA:
            if not self.direccion_ciudadano or self.direccion_ciudadano.strip() == '':
                raise ValueError('La dirección es obligatoria cuando el medio de respuesta es físico')
        elif self.medio_respuesta == MedioRespuesta.TELEFONO:
            if not self.telefono_ciudadano or self.telefono_ciudadano.strip() == '':
                raise ValueError('El teléfono es obligatorio cuando el medio de respuesta es telefónico')
        return self

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
    email_ciudadano: Optional[str] = None  # Cambiado de EmailStr a str
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
    justificacion_asignacion: Optional[str] = None
    archivo_respuesta: Optional[str] = None
    
    @field_validator('email_ciudadano')
    @classmethod
    def validate_email(cls, v):
        """Validar email solo si tiene valor"""
        if v is None or v == '' or (isinstance(v, str) and v.strip() == ''):
            return None
        # Validación básica de formato de email
        email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        if not re.match(email_pattern, v.strip()):
            raise ValueError('El email no tiene un formato válido')
        return v.strip().lower()

class PQRSResponse(BaseModel):
    respuesta: str

class AsignacionAuditoriaResponse(BaseModel):
    id: int
    pqrs_id: int
    usuario_anterior_id: Optional[int] = None
    usuario_nuevo_id: Optional[int] = None
    justificacion: Optional[str] = None
    fecha_asignacion: datetime
    usuario_anterior: Optional[dict] = None
    usuario_nuevo: Optional[dict] = None
    
    class Config:
        from_attributes = True

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
    justificacion_asignacion: Optional[str] = None
    archivo_respuesta: Optional[str] = None
    
    class Config:
        from_attributes = True

class PQRSWithDetails(PQRS):
    created_by: Optional[dict] = None
    assigned_to: Optional[dict] = None