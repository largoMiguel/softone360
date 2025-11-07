from typing import Optional, List, Dict
from pydantic import BaseModel, Field
from datetime import datetime


class ExcelUploadResponse(BaseModel):
    entity_id: int
    nombre_archivo: str
    tamanio: int
    created_at: datetime
    mensaje: str

    class Config:
        from_attributes = True


class ExcelInfoResponse(BaseModel):
    existe: bool
    nombre_archivo: Optional[str] = None
    tamanio: Optional[int] = None
    fecha_carga: Optional[datetime] = None

    class Config:
        from_attributes = True


class AssignmentBase(BaseModel):
    codigo_indicador_producto: str = Field(..., min_length=1)
    secretaria: Optional[str] = None


class AssignmentUpsertRequest(AssignmentBase):
    pass


class AssignmentResponse(AssignmentBase):
    entity_id: int

    class Config:
        from_attributes = True


class AvanceBase(BaseModel):
    codigo_indicador_producto: str
    anio: int
    valor_ejecutado: float
    comentario: Optional[str] = None


class AvanceUpsertRequest(AvanceBase):
    pass


class AvanceResponse(AvanceBase):
    entity_id: int

    class Config:
        from_attributes = True


class AssignmentsMapResponse(BaseModel):
    assignments: Dict[str, Optional[str]]


class AvancesListResponse(BaseModel):
    codigo_indicador_producto: str
    avances: List[AvanceResponse]


class ActividadBase(BaseModel):
    nombre: str = Field(..., min_length=1, max_length=512)
    descripcion: Optional[str] = Field(None, max_length=1024)
    responsable: Optional[str] = Field(None, max_length=256)
    fecha_inicio: Optional[str] = None  # ISO format string
    fecha_fin: Optional[str] = None  # ISO format string
    estado: str = Field(default='pendiente', max_length=64)  # pendiente, en_progreso, completada, cancelada
    # Nuevos campos de ejecución por año
    anio: int
    meta_ejecutar: float = Field(default=0.0, ge=0.0)
    valor_ejecutado: float = Field(default=0.0, ge=0.0)


class ActividadCreateRequest(ActividadBase):
    codigo_indicador_producto: str = Field(..., min_length=1)


class ActividadUpdateRequest(BaseModel):
    nombre: Optional[str] = Field(None, min_length=1, max_length=512)
    descripcion: Optional[str] = Field(None, max_length=1024)
    responsable: Optional[str] = Field(None, max_length=256)
    fecha_inicio: Optional[str] = None
    fecha_fin: Optional[str] = None
    estado: Optional[str] = Field(None, max_length=64)
    anio: Optional[int] = None
    meta_ejecutar: Optional[float] = Field(None, ge=0.0)
    valor_ejecutado: Optional[float] = Field(None, ge=0.0)


class ActividadResponse(ActividadBase):
    id: int
    entity_id: int
    codigo_indicador_producto: str
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True


class ActividadesListResponse(BaseModel):
    codigo_indicador_producto: str
    actividades: List[ActividadResponse]


class ActividadesBulkRequest(BaseModel):
    codigos: List[str]


class ActividadesBulkResponse(BaseModel):
    # Mapa codigo -> lista de actividades
    items: Dict[str, List[ActividadResponse]]


# Schemas para ejecuciones de actividades (historial de avances)
class EjecucionImagenBase(BaseModel):
    nombre_imagen: str = Field(..., max_length=256)
    mime_type: str = Field(..., max_length=64)
    tamano: int = Field(..., gt=0)
    contenido_base64: str  # Imagen en base64


class EjecucionCreateRequest(BaseModel):
    """Request para registrar un nuevo avance/ejecución de una actividad"""
    actividad_id: int
    valor_ejecutado_incremento: float = Field(..., gt=0.0)
    descripcion: Optional[str] = Field(None, max_length=2048)
    url_evidencia: Optional[str] = Field(None, max_length=512)
    imagenes: Optional[List[EjecucionImagenBase]] = Field(None, max_items=4)
    registrado_por: Optional[str] = Field(None, max_length=256)


class EvidenciaImagenResponse(BaseModel):
    """Imagen de evidencia asociada a una ejecución"""
    id: int
    nombre_imagen: str
    mime_type: str
    tamano: int
    contenido_base64: str  # Imagen en base64
    created_at: str

    class Config:
        from_attributes = True


class EjecucionResponse(BaseModel):
    """Respuesta de una ejecución (avance registrado)"""
    id: int
    actividad_id: int
    entity_id: int
    valor_ejecutado_incremento: float
    descripcion: Optional[str] = None
    url_evidencia: Optional[str] = None
    registrado_por: Optional[str] = None
    imagenes: List[EvidenciaImagenResponse] = []
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True


class EjecucionesListResponse(BaseModel):
    """Lista de ejecuciones de una actividad (historial)"""
    actividad_id: int
    total_ejecutado: float  # Suma de todos los valor_ejecutado_incremento
    ejecuciones: List[EjecucionResponse]


# Schemas antiguos de evidencias (deprecated, mantener por compatibilidad)
class EvidenciaBase(BaseModel):
    descripcion: Optional[str] = Field(None, max_length=2048)
    url: Optional[str] = Field(None, max_length=512)
    nombre_imagen: Optional[str] = Field(None, max_length=256)
    mime_type: Optional[str] = Field(None, max_length=64)
    tamano: Optional[int] = None
    contenido: Optional[str] = None  # Base64 encoded image


class EvidenciaCreateRequest(BaseModel):
    actividad_id: int
    descripcion: Optional[str] = Field(None, max_length=2048)
    url: Optional[str] = Field(None, max_length=512)
    imagenes: Optional[List[dict]] = None  # Lista de imágenes {nombre, mime_type, tamano, contenido_base64}


class EvidenciaResponse(BaseModel):
    id: int
    ejecucion_id: int
    entity_id: int
    nombre_imagen: str
    mime_type: str
    tamano: int
    contenido: str  # Base64 encoded
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True


class EvidenciasListResponse(BaseModel):
    ejecucion_id: int
    evidencias: List[EvidenciaResponse]
