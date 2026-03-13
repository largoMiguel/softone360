from pydantic import BaseModel, field_validator
from typing import Optional
from datetime import datetime, date
from app.models.correspondencia import (
    TipoRadicacion, 
    TipoSolicitudCorrespondencia, 
    EstadoCorrespondencia
)
import re


# Esquema base
class CorrespondenciaBase(BaseModel):
    fecha_envio: date
    procedencia: str = "PERSONERIA MUNICIPAL"
    destinacion: str
    numero_folios: int = 1
    tipo_radicacion: TipoRadicacion = TipoRadicacion.CORREO
    correo_electronico: Optional[str] = None
    direccion_radicacion: Optional[str] = None
    tipo_solicitud: TipoSolicitudCorrespondencia
    archivo_solicitud: Optional[str] = None
    archivo_respuesta: Optional[str] = None
    estado: EstadoCorrespondencia = EstadoCorrespondencia.ENVIADA
    tiempo_respuesta_dias: Optional[int] = None
    observaciones: Optional[str] = None
    respuesta: Optional[str] = None
    assigned_to_id: Optional[int] = None
    
    @field_validator('correo_electronico')
    @classmethod
    def validate_email(cls, v):
        """Validar email solo si tiene valor"""
        if v is None or v == '' or (isinstance(v, str) and v.strip() == ''):
            return None
        email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        if not re.match(email_pattern, v.strip()):
            raise ValueError('El email no tiene un formato válido')
        return v.strip().lower()
    
    @field_validator('tiempo_respuesta_dias')
    @classmethod
    def validate_tiempo_respuesta(cls, v):
        """Validar que el tiempo de respuesta sea 5, 10 o 15 días"""
        if v is not None and v not in [5, 10, 15]:
            raise ValueError('El tiempo de respuesta debe ser 5, 10 o 15 días')
        return v
    
    @field_validator('numero_folios')
    @classmethod
    def validate_folios(cls, v):
        """Validar que el número de folios sea positivo"""
        if v < 1:
            raise ValueError('El número de folios debe ser al menos 1')
        return v


class CorrespondenciaCreate(CorrespondenciaBase):
    numero_radicado: Optional[str] = None
    entity_id: int


class CorrespondenciaUpdate(BaseModel):
    fecha_envio: Optional[date] = None
    procedencia: Optional[str] = None
    destinacion: Optional[str] = None
    numero_folios: Optional[int] = None
    tipo_radicacion: Optional[TipoRadicacion] = None
    correo_electronico: Optional[str] = None
    direccion_radicacion: Optional[str] = None
    tipo_solicitud: Optional[TipoSolicitudCorrespondencia] = None
    archivo_solicitud: Optional[str] = None
    archivo_respuesta: Optional[str] = None
    estado: Optional[EstadoCorrespondencia] = None
    tiempo_respuesta_dias: Optional[int] = None
    observaciones: Optional[str] = None
    respuesta: Optional[str] = None
    assigned_to_id: Optional[int] = None
    
    @field_validator('correo_electronico')
    @classmethod
    def validate_email(cls, v):
        if v is None or v == '' or (isinstance(v, str) and v.strip() == ''):
            return None
        email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        if not re.match(email_pattern, v.strip()):
            raise ValueError('El email no tiene un formato válido')
        return v.strip().lower()


class CorrespondenciaResponse(BaseModel):
    id: int
    numero_radicado: str
    fecha_envio: date
    procedencia: str
    destinacion: str
    numero_folios: int
    tipo_radicacion: TipoRadicacion
    correo_electronico: Optional[str]
    direccion_radicacion: Optional[str]
    tipo_solicitud: TipoSolicitudCorrespondencia
    archivo_solicitud: Optional[str]
    archivo_respuesta: Optional[str]
    estado: EstadoCorrespondencia
    tiempo_respuesta_dias: Optional[int]
    observaciones: Optional[str]
    respuesta: Optional[str]
    created_at: datetime
    updated_at: Optional[datetime]
    fecha_respuesta: Optional[datetime]
    created_by_id: Optional[int]
    assigned_to_id: Optional[int]
    entity_id: int
    
    class Config:
        from_attributes = True


class CorrespondenciaWithDetails(CorrespondenciaResponse):
    """Esquema con detalles de los usuarios relacionados"""
    created_by_name: Optional[str] = None
    assigned_to_name: Optional[str] = None
