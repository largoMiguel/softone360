from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List


class ViaViajeCreate(BaseModel):
    entity_slug: str
    conductor_nombre: str = Field(..., max_length=150)
    placa_vehiculo: str = Field(..., max_length=20)
    tipo_material: Optional[str] = Field(None, max_length=100)
    observacion: Optional[str] = None
    latitud: float = Field(..., ge=-90, le=90)
    longitud: float = Field(..., ge=-180, le=180)
    timestamp_registro: datetime


class ViaViajeResponse(BaseModel):
    id: int
    conductor_nombre: str
    placa_vehiculo: str
    tipo_material: Optional[str]
    observacion: Optional[str]
    latitud: float
    longitud: float
    timestamp_registro: datetime
    created_at: datetime

    model_config = {"from_attributes": True}


class ViaTramoCreate(BaseModel):
    entity_slug: str
    operador_nombre: str = Field(..., max_length=150)
    nombre_maquina: str = Field(..., max_length=100)
    tipo_trabajo: Optional[str] = Field(None, max_length=100)
    observacion: Optional[str] = None
    lat_inicio: float = Field(..., ge=-90, le=90)
    lng_inicio: float = Field(..., ge=-180, le=180)
    lat_fin: float = Field(..., ge=-90, le=90)
    lng_fin: float = Field(..., ge=-180, le=180)
    timestamp_inicio: datetime
    timestamp_fin: datetime


class ViaTramoResponse(BaseModel):
    id: int
    operador_nombre: str
    nombre_maquina: str
    tipo_trabajo: Optional[str]
    observacion: Optional[str]
    lat_inicio: float
    lng_inicio: float
    lat_fin: float
    lng_fin: float
    timestamp_inicio: datetime
    timestamp_fin: datetime
    created_at: datetime

    model_config = {"from_attributes": True}


class ViaBatchViajesRequest(BaseModel):
    viajes: List[ViaViajeCreate]


class ViaBatchTramosRequest(BaseModel):
    tramos: List[ViaTramoCreate]


class ViaMapaResponse(BaseModel):
    viajes: List[ViaViajeResponse]
    tramos: List[ViaTramoResponse]
