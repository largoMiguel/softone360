"""
Schemas Pydantic para PDM - Version 2
Alineados con la estructura del frontend
"""
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime


# ============================================
# Schemas para datos del Excel
# ============================================

class ProductoPlanIndicativoBase(BaseModel):
    """Producto del Plan Indicativo (lo principal)"""
    codigo_dane: Optional[str] = None
    entidad_territorial: Optional[str] = None
    nombre_plan: Optional[str] = None
    codigo_indicador_producto: Optional[str] = None
    codigo_producto: str
    linea_estrategica: Optional[str] = None
    codigo_sector: Optional[str] = None
    sector_mga: Optional[str] = None
    codigo_programa: Optional[str] = None
    programa_mga: Optional[str] = None
    codigo_producto_mga: Optional[str] = None
    producto_mga: Optional[str] = None
    codigo_indicador_producto_mga: Optional[str] = None
    indicador_producto_mga: Optional[str] = None
    personalizacion_indicador: Optional[str] = None
    unidad_medida: Optional[str] = None
    meta_cuatrienio: Optional[float] = 0
    principal: Optional[str] = None
    codigo_ods: Optional[str] = None
    ods: Optional[str] = None
    tipo_acumulacion: Optional[str] = None
    bpin: Optional[str] = None
    
    # Programación
    programacion_2024: float = 0
    programacion_2025: float = 0
    programacion_2026: float = 0
    programacion_2027: float = 0
    
    # Presupuesto (JSON simplificado)
    presupuesto_2024: Optional[Dict[str, Any]] = None
    presupuesto_2025: Optional[Dict[str, Any]] = None
    presupuesto_2026: Optional[Dict[str, Any]] = None
    presupuesto_2027: Optional[Dict[str, Any]] = None
    
    # Totales
    total_2024: float = 0
    total_2025: float = 0
    total_2026: float = 0
    total_2027: float = 0


class ProductoResponse(ProductoPlanIndicativoBase):
    id: int
    entity_id: int
    responsable_user_id: Optional[int] = None
    responsable: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class LineaEstrategicaBase(BaseModel):
    codigo_dane: Optional[str] = None
    entidad_territorial: Optional[str] = None
    nombre_plan: Optional[str] = None
    consecutivo: Optional[str] = None
    linea_estrategica: str


class LineaEstrategicaResponse(LineaEstrategicaBase):
    id: int
    entity_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class IndicadorResultadoBase(BaseModel):
    codigo_dane: Optional[str] = None
    entidad_territorial: Optional[str] = None
    nombre_plan: Optional[str] = None
    consecutivo: Optional[str] = None
    linea_estrategica: Optional[str] = None
    indicador_resultado: str
    esta_pnd: Optional[str] = None
    meta_cuatrienio: Optional[float] = None
    transformacion_pnd: Optional[str] = None


class IndicadorResultadoResponse(IndicadorResultadoBase):
    id: int
    entity_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class IniciativaSGRBase(BaseModel):
    codigo_dane: Optional[str] = None
    entidad_territorial: Optional[str] = None
    nombre_plan: Optional[str] = None
    consecutivo: Optional[str] = None
    linea_estrategica: Optional[str] = None
    tipo_iniciativa: Optional[str] = None
    sector_mga: Optional[str] = None
    iniciativa_sgr: str
    recursos_sgr_indicativos: Optional[float] = None
    bpin: Optional[str] = None


class IniciativaSGRResponse(IniciativaSGRBase):
    id: int
    entity_id: int
    created_at: datetime

    class Config:
        from_attributes = True


# ============================================
# Schemas para Actividades
# ============================================

class ActividadBase(BaseModel):
    codigo_producto: str
    anio: int = Field(..., ge=2024, le=2027)
    nombre: str = Field(..., min_length=1, max_length=512)
    descripcion: Optional[str] = None
    responsable: Optional[str] = None  # Nombre del responsable (legacy)
    responsable_user_id: Optional[int] = None  # ID del usuario responsable
    fecha_inicio: Optional[str] = None  # ISO string para input
    fecha_fin: Optional[str] = None  # ISO string para input
    meta_ejecutar: float = Field(..., ge=0)
    estado: str = Field(default='PENDIENTE')  # PENDIENTE, EN_PROGRESO, COMPLETADA, CANCELADA


class ActividadCreate(ActividadBase):
    pass


class ActividadUpdate(BaseModel):
    nombre: Optional[str] = None
    descripcion: Optional[str] = None
    responsable: Optional[str] = None
    responsable_user_id: Optional[int] = None
    fecha_inicio: Optional[str] = None
    fecha_fin: Optional[str] = None
    meta_ejecutar: Optional[float] = None
    estado: Optional[str] = None


class ActividadResponseBase(BaseModel):
    """Base para respuestas - acepta datetime desde la DB"""
    codigo_producto: str
    anio: int
    nombre: str
    descripcion: Optional[str] = None
    responsable: Optional[str] = None
    responsable_user_id: Optional[int] = None
    fecha_inicio: Optional[datetime] = None  # datetime para output desde DB
    fecha_fin: Optional[datetime] = None  # datetime para output desde DB
    meta_ejecutar: float
    estado: str


class EvidenciaActividadBase(BaseModel):
    descripcion: str = Field(..., min_length=10)
    url_evidencia: Optional[str] = None
    imagenes: Optional[List[str]] = Field(None, max_items=4)  # Array de strings base64


class EvidenciaCreate(EvidenciaActividadBase):
    pass


class EvidenciaResponse(EvidenciaActividadBase):
    id: int
    actividad_id: int
    entity_id: int
    fecha_registro: datetime
    created_at: datetime

    class Config:
        from_attributes = True


class ActividadResponse(ActividadResponseBase):
    id: int
    entity_id: int
    evidencia: Optional[EvidenciaResponse] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda v: v.isoformat() if v else None
        }


# ============================================
# Schemas para carga masiva del Excel
# ============================================

class PDMDataUpload(BaseModel):
    """Estructura completa del Excel PDM"""
    lineas_estrategicas: List[LineaEstrategicaBase]
    indicadores_resultado: List[IndicadorResultadoBase]
    iniciativas_sgr: List[IniciativaSGRBase]
    productos_plan_indicativo: List[ProductoPlanIndicativoBase]
    productos_plan_indicativo_sgr: Optional[List[Any]] = []


class PDMDataResponse(BaseModel):
    """Respuesta con todos los datos del PDM cargados"""
    lineas_estrategicas: List[LineaEstrategicaResponse]
    indicadores_resultado: List[IndicadorResultadoResponse]
    iniciativas_sgr: List[IniciativaSGRResponse]
    productos_plan_indicativo: List[ProductoResponse]
    productos_plan_indicativo_sgr: List[Any] = []


class PDMLoadStatusResponse(BaseModel):
    """Estado de carga del PDM"""
    tiene_datos: bool
    total_productos: int = 0
    total_lineas: int = 0
    total_indicadores: int = 0
    total_iniciativas: int = 0
    fecha_ultima_carga: Optional[datetime] = None


# ============================================
# Schemas para obtener actividades
# ============================================

class ActividadesPorProductoResponse(BaseModel):
    codigo_producto: str
    actividades: List[ActividadResponse]


class ActividadesPorAnioResponse(BaseModel):
    anio: int
    actividades: List[ActividadResponse]
