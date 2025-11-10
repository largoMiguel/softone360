from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Enum, Text
from sqlalchemy.types import TypeDecorator
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.config.database import Base
import enum


class EnumType(TypeDecorator):
    """Almacena enums como texto pero procesa resultados tolerando tanto
    los nombres de miembro en mayúsculas como los valores en minúsculas.
    Devuelve instancias del Enum Python correspondiente.
    """
    impl = String

    def __init__(self, enum_cls, length: int = 50, **kwargs):
        super().__init__(length=length, **kwargs)
        self.enum_cls = enum_cls

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        # Si es instancia del enum, enviar su .value
        if isinstance(value, enum.Enum):
            return value.value
        # Si vienen nombres de miembro (ej: 'PETICION'), convertir a su .value
        if isinstance(value, str):
            # intentar mapear por nombre
            try:
                return self.enum_cls[value].value
            except Exception:
                # si no existe como nombre, asumir que es el value correcto
                return value
        return value

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        # Si DB devolvió string, mapear a instancia del enum
        if isinstance(value, str):
            # buscar por value exacto (ej: 'peticion')
            for member in self.enum_cls:
                if member.value == value:
                    return member
            # intentar por nombre (ej: 'PETICION')
            try:
                return self.enum_cls[value]
            except Exception:
                # intentar por lowercased
                for member in self.enum_cls:
                    if member.value == value.lower():
                        return member
        return value

class TipoSolicitud(enum.Enum):
    PETICION = "peticion"
    QUEJA = "queja"
    RECLAMO = "reclamo"
    SUGERENCIA = "sugerencia"

class EstadoPQRS(enum.Enum):
    PENDIENTE = "pendiente"
    EN_PROCESO = "en_proceso"
    RESUELTO = "resuelto"
    CERRADO = "cerrado"

class TipoIdentificacion(enum.Enum):
    PERSONAL = "personal"
    ANONIMA = "anonima"

class MedioRespuesta(enum.Enum):
    EMAIL = "email"
    FISICA = "fisica"
    TELEFONO = "telefono"
    TICKET = "ticket"

class PQRS(Base):
    __tablename__ = "pqrs"
    
    id = Column(Integer, primary_key=True, index=True)
    numero_radicado = Column(String, unique=True, index=True, nullable=False)
    
    # Tipo de identificación (personal o anónima)
    # Use enum values (e.g., 'personal') instead of member names to avoid lookup issues
    tipo_identificacion = Column(
        EnumType(TipoIdentificacion),
        nullable=False,
        default=TipoIdentificacion.PERSONAL
    )
    
    # Medio de respuesta preferido
    medio_respuesta = Column(
        EnumType(MedioRespuesta),
        nullable=False,
        default=MedioRespuesta.EMAIL
    )
    
    # Información del ciudadano (opcionales si es anónima)
    nombre_ciudadano = Column(String, nullable=True)
    cedula_ciudadano = Column(String, nullable=True)
    telefono_ciudadano = Column(String, nullable=True)
    email_ciudadano = Column(String, nullable=True)
    direccion_ciudadano = Column(String, nullable=True)
    
    # Información de la PQRS
    tipo_solicitud = Column(
        EnumType(TipoSolicitud),
        nullable=False
    )
    asunto = Column(String, nullable=False)
    descripcion = Column(Text, nullable=False)
    estado = Column(
        EnumType(EstadoPQRS),
        nullable=False,
        default=EstadoPQRS.PENDIENTE
    )
    
    # Fechas importantes
    fecha_solicitud = Column(DateTime(timezone=True), server_default=func.now())
    fecha_cierre = Column(DateTime(timezone=True), nullable=True)
    fecha_delegacion = Column(DateTime(timezone=True), nullable=True)
    fecha_respuesta = Column(DateTime(timezone=True), nullable=True)
    
    # Relaciones con usuarios
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    assigned_to_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    # Relación con entidad (CASCADE: elimina PQRS cuando se elimina entidad)
    entity_id = Column(Integer, ForeignKey("entities.id", ondelete="CASCADE"), nullable=False)
    
    # Respuesta
    respuesta = Column(Text, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relaciones
    created_by = relationship("User", foreign_keys=[created_by_id], back_populates="pqrs_creadas")
    assigned_to = relationship("User", foreign_keys=[assigned_to_id], back_populates="pqrs_asignadas")