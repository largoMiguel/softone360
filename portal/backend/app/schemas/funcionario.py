from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime


# === Funcionario Schemas ===
class FuncionarioBase(BaseModel):
    cedula: str = Field(..., min_length=5, max_length=20)
    nombres: str = Field(..., min_length=2, max_length=100)
    apellidos: str = Field(..., min_length=2, max_length=100)
    email: Optional[EmailStr] = None
    telefono: Optional[str] = Field(None, max_length=20)
    cargo: Optional[str] = Field(None, max_length=150)


class FuncionarioCreate(FuncionarioBase):
    entity_id: int = Field(..., gt=0)


class FuncionarioUpdate(BaseModel):
    nombres: Optional[str] = Field(None, min_length=2, max_length=100)
    apellidos: Optional[str] = Field(None, min_length=2, max_length=100)
    email: Optional[EmailStr] = None
    telefono: Optional[str] = Field(None, max_length=20)
    cargo: Optional[str] = Field(None, max_length=150)
    is_active: Optional[bool] = None


class FuncionarioResponse(FuncionarioBase):
    id: int
    entity_id: int
    foto_url: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


# === Equipo Registro Schemas ===
class EquipoRegistroBase(BaseModel):
    uuid: str = Field(..., min_length=10, max_length=100)
    nombre: str = Field(..., min_length=2, max_length=100)
    ubicacion: Optional[str] = Field(None, max_length=200)


class EquipoRegistroCreate(EquipoRegistroBase):
    entity_id: int = Field(..., gt=0)


class EquipoRegistroUpdate(BaseModel):
    nombre: Optional[str] = Field(None, min_length=2, max_length=100)
    ubicacion: Optional[str] = Field(None, max_length=200)
    is_active: Optional[bool] = None


class EquipoRegistroResponse(EquipoRegistroBase):
    id: int
    entity_id: int
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


# === Registro Asistencia Schemas ===
class RegistroAsistenciaBase(BaseModel):
    tipo_registro: str = Field(..., pattern="^(entrada|salida)$")
    observaciones: Optional[str] = Field(None, max_length=500)


class RegistroAsistenciaCreate(BaseModel):
    """
    Schema para crear un registro desde la app de escritorio.
    """
    cedula: str = Field(..., min_length=5, max_length=20)
    equipo_uuid: str = Field(..., min_length=10, max_length=100)
    tipo_registro: str = Field(..., pattern="^(entrada|salida)$")
    foto_base64: Optional[str] = None  # Imagen en base64
    observaciones: Optional[str] = Field(None, max_length=500)


class RegistroAsistenciaResponse(RegistroAsistenciaBase):
    id: int
    funcionario_id: int
    equipo_id: int
    fecha_hora: datetime
    foto_url: Optional[str] = None
    created_at: datetime
    
    # Información adicional del funcionario
    funcionario_nombres: Optional[str] = None
    funcionario_apellidos: Optional[str] = None
    funcionario_cedula: Optional[str] = None
    
    # Información adicional del equipo
    equipo_nombre: Optional[str] = None
    equipo_ubicacion: Optional[str] = None
    
    class Config:
        from_attributes = True


class RegistroAsistenciaListResponse(BaseModel):
    """
    Response para listar registros con información completa.
    """
    id: int
    funcionario_id: int
    funcionario_nombres: str
    funcionario_apellidos: str
    funcionario_cedula: str
    funcionario_cargo: Optional[str] = None
    funcionario_foto_url: Optional[str] = None
    equipo_nombre: str
    equipo_ubicacion: Optional[str] = None
    tipo_registro: str
    fecha_hora: datetime
    foto_url: Optional[str] = None
    observaciones: Optional[str] = None
    
    class Config:
        from_attributes = True


# === Estadísticas y Reportes ===
class EstadisticasAsistencia(BaseModel):
    """
    Estadísticas de asistencia para un rango de fechas.
    """
    total_funcionarios: int
    total_registros: int
    registros_hoy: int
    entradas_hoy: int
    salidas_hoy: int
    funcionarios_presentes: int  # Han registrado entrada pero no salida hoy
    promedio_asistencia_semanal: Optional[float] = None


# === Validación de equipo ===
class ValidacionEquipoRequest(BaseModel):
    uuid: str = Field(..., min_length=10, max_length=100)


class ValidacionEquipoResponse(BaseModel):
    valido: bool
    equipo_id: Optional[int] = None
    entity_id: Optional[int] = None
    mensaje: str
