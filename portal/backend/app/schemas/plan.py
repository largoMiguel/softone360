from pydantic import BaseModel, Field, field_validator
from typing import Optional, List
from datetime import date, datetime
from decimal import Decimal
from app.models.plan import (
    EstadoPlan, EstadoComponente
)


# ==================== SCHEMAS PARA PLAN INSTITUCIONAL ====================

class PlanInstitucionalBase(BaseModel):
    """Schema base para Plan Institucional"""
    anio: int = Field(..., ge=2000, le=2100, description="Año del plan")
    nombre: str = Field(..., min_length=5, max_length=300)
    descripcion: str = Field(..., min_length=20)
    fecha_inicio: date
    fecha_fin: date
    estado: EstadoPlan = EstadoPlan.FORMULACION
    responsable_elaboracion: str = Field(..., min_length=3, max_length=200)
    responsable_aprobacion: Optional[str] = Field(None, max_length=200)

    @field_validator('fecha_fin')
    @classmethod
    def validar_fechas(cls, v, info):
        if 'fecha_inicio' in info.data and v <= info.data['fecha_inicio']:
            raise ValueError('La fecha de fin debe ser posterior a la fecha de inicio')
        return v


class PlanInstitucionalCreate(PlanInstitucionalBase):
    """Schema para crear un plan institucional"""
    entity_id: Optional[int] = None  # Se asigna automáticamente desde current_user


class PlanInstitucionalUpdate(BaseModel):
    """Schema para actualizar un plan institucional"""
    anio: Optional[int] = Field(None, ge=2000, le=2100)
    nombre: Optional[str] = Field(None, min_length=5, max_length=300)
    descripcion: Optional[str] = Field(None, min_length=20)
    fecha_inicio: Optional[date] = None
    fecha_fin: Optional[date] = None
    estado: Optional[EstadoPlan] = None
    responsable_elaboracion: Optional[str] = Field(None, min_length=3, max_length=200)
    responsable_aprobacion: Optional[str] = Field(None, max_length=200)


class PlanInstitucional(PlanInstitucionalBase):
    """Schema de respuesta para plan institucional"""
    id: int
    entity_id: int
    porcentaje_avance: Decimal
    created_at: datetime
    updated_at: Optional[datetime] = None
    created_by: Optional[str] = None

    class Config:
        from_attributes = True


# ==================== SCHEMAS PARA COMPONENTE/PROCESO ====================

class ComponenteProcesoBase(BaseModel):
    """Schema base para Componente/Proceso (simplificado)"""
    nombre: str = Field(..., min_length=3, max_length=300)
    estado: EstadoComponente = EstadoComponente.NO_INICIADO


class ComponenteProcesoCreate(ComponenteProcesoBase):
    """Schema para crear un componente"""
    plan_id: int


class ComponenteProcesoUpdate(BaseModel):
    """Schema para actualizar un componente (simplificado)"""
    nombre: Optional[str] = Field(None, min_length=3, max_length=300)
    estado: Optional[EstadoComponente] = None


class ComponenteProceso(ComponenteProcesoBase):
    """Schema de respuesta para componente"""
    id: int
    plan_id: int
    porcentaje_avance: Decimal
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ==================== SCHEMAS PARA ACTIVIDAD ====================

class ActividadBase(BaseModel):
    """Schema base para Actividad (simplificada)"""
    objetivo_especifico: Optional[str] = Field(None, min_length=5)
    fecha_inicio_prevista: date
    fecha_fin_prevista: date
    responsable_secretaria_id: Optional[int] = Field(None, description="ID de la secretaría responsable")

    @field_validator('fecha_fin_prevista')
    @classmethod
    def validar_fechas_previstas(cls, v, info):
        if 'fecha_inicio_prevista' in info.data and v <= info.data['fecha_inicio_prevista']:
            raise ValueError('La fecha fin prevista debe ser posterior a la fecha inicio prevista')
        return v


class ActividadCreate(ActividadBase):
    """Schema para crear una actividad"""
    componente_id: int


class ActividadUpdate(BaseModel):
    """Schema para actualizar una actividad (simplificada)"""
    objetivo_especifico: Optional[str] = Field(None, min_length=5)
    fecha_inicio_prevista: Optional[date] = None
    fecha_fin_prevista: Optional[date] = None
    responsable_secretaria_id: Optional[int] = Field(None, description="ID de la secretaría responsable")


class Actividad(ActividadBase):
    """Schema de respuesta para actividad (simplificada)"""
    id: int
    componente_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    responsable_secretaria_nombre: Optional[str] = Field(None, description="Nombre enriquecido de la secretaría responsable")

    class Config:
        from_attributes = True


# Se elimina el esquema de actualización de avance: el avance se infiere por ejecuciones


# ==================== SCHEMAS PARA ACTIVIDAD DE EJECUCIÓN ====================

class ActividadEjecucionBase(BaseModel):
    """Schema base para Actividad de Ejecución (simplificada)"""
    descripcion: str = Field(..., min_length=5)
    evidencia_url: Optional[str] = Field(None, max_length=500)


class ActividadEjecucionCreate(ActividadEjecucionBase):
    """Schema para crear una actividad de ejecución"""
    actividad_id: int


class ActividadEjecucionUpdate(BaseModel):
    """Schema para actualizar una actividad de ejecución (simplificada)"""
    descripcion: Optional[str] = Field(None, min_length=5)
    evidencia_url: Optional[str] = Field(None, max_length=500)


class ActividadEjecucion(ActividadEjecucionBase):
    """Schema de respuesta para actividad de ejecución"""
    id: int
    actividad_id: int
    fecha_registro: datetime
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ==================== SCHEMAS ANIDADOS PARA RESPUESTAS COMPLETAS ====================

class ActividadCompleta(Actividad):
    """Schema de actividad con sus ejecuciones"""
    actividades_ejecucion: List[ActividadEjecucion] = []

    class Config:
        from_attributes = True


class ActividadConEjecuciones(Actividad):
    """Schema de actividad con sus ejecuciones"""
    actividades_ejecucion: List[ActividadEjecucion] = []

    class Config:
        from_attributes = True


class ComponenteConActividades(ComponenteProceso):
    """Schema de componente con sus actividades"""
    actividades: List[Actividad] = []

    class Config:
        from_attributes = True


class PlanInstitucionalCompleto(PlanInstitucional):
    """Schema de plan con todos sus componentes y actividades"""
    componentes: List[ComponenteConActividades] = []

    class Config:
        from_attributes = True


# ==================== SCHEMAS PARA ESTADÍSTICAS Y REPORTES ====================

class EstadisticasPlan(BaseModel):
    """Estadísticas generales de un plan (simplificadas)"""
    total_componentes: int
    total_actividades: int
    actividades_con_avance: int
    componentes_con_avance: int
    porcentaje_avance_global: Decimal


class EstadisticasComponente(BaseModel):
    """Estadísticas de un componente (simplificadas)"""
    total_actividades: int
    actividades_con_avance: int
    porcentaje_avance: Decimal


# ==================== SCHEMAS PARA EVIDENCIAS ====================

class ActividadEvidenciaBase(BaseModel):
    """Schema base para evidencias"""
    tipo: str = Field(..., pattern="^(url|imagen)$", description="Tipo de evidencia: 'url' o 'imagen'")
    contenido: str = Field(..., description="URL o imagen en base64")
    nombre_archivo: Optional[str] = Field(None, max_length=255)
    mime_type: Optional[str] = Field(None, max_length=100)
    orden: Optional[int] = Field(0, ge=0, description="Orden de visualización")


class ActividadEvidenciaCreate(ActividadEvidenciaBase):
    """Schema para crear una evidencia"""
    pass


class ActividadEvidencia(ActividadEvidenciaBase):
    """Schema de respuesta para evidencia"""
    id: int
    actividad_ejecucion_id: int
    created_at: datetime

    class Config:
        from_attributes = True

