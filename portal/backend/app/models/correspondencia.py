from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Enum, Text, Date
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
        if isinstance(value, enum.Enum):
            return value.value
        if isinstance(value, str):
            try:
                return self.enum_cls[value].value
            except Exception:
                return value
        return value

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        if isinstance(value, str):
            for member in self.enum_cls:
                if member.value == value:
                    return member
            try:
                return self.enum_cls[value]
            except Exception:
                for member in self.enum_cls:
                    if member.value == value.lower():
                        return member
        return value


class TipoRadicacion(enum.Enum):
    """Tipo de radicación: físico o correo"""
    FISICO = "fisico"
    CORREO = "correo"


class TipoSolicitudCorrespondencia(enum.Enum):
    """Tipos de solicitud de correspondencia"""
    SUGERENCIA = "sugerencia"
    PETICION = "peticion"
    QUEJA = "queja"
    RECLAMO = "reclamo"
    FELICITACION = "felicitacion"
    SOLICITUD_INFORMACION = "solicitud_informacion"
    OTRO = "otro"


class EstadoCorrespondencia(enum.Enum):
    """Estados de la correspondencia"""
    ENVIADA = "enviada"
    EN_PROCESO = "en_proceso"
    RESUELTA = "resuelta"
    CERRADA = "cerrada"


class Correspondencia(Base):
    """
    Modelo para gestión de correspondencia oficial
    Gestiona la correspondencia entrante y saliente de la entidad
    """
    __tablename__ = "correspondencia"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Número de radicado (generado automáticamente)
    numero_radicado = Column(String, unique=True, index=True, nullable=False)
    
    # Fecha de envío (ingresada por la entidad)
    fecha_envio = Column(Date, nullable=False)
    
    # Procedencia (predeterminado: PERSONERIA MUNICIPAL)
    procedencia = Column(String, nullable=False, default="PERSONERIA MUNICIPAL")
    
    # Destinación (datos ingresados por la entidad)
    destinacion = Column(String, nullable=False)
    
    # Número de folios
    numero_folios = Column(Integer, nullable=False, default=1)
    
    # Tipo de radicación (físico o correo)
    tipo_radicacion = Column(
        EnumType(TipoRadicacion),
        nullable=False,
        default=TipoRadicacion.CORREO
    )
    
    # Correo electrónico (opcional, depende del tipo de radicación)
    correo_electronico = Column(String, nullable=True)
    
    # Dirección para radicación física
    direccion_radicacion = Column(String, nullable=True)
    
    # Tipo de solicitud
    tipo_solicitud = Column(
        EnumType(TipoSolicitudCorrespondencia),
        nullable=False,
        index=True
    )
    
    # Archivos adjuntos (rutas en S3)
    archivo_solicitud = Column(String, nullable=True)
    archivo_respuesta = Column(String, nullable=True)
    
    # Estado de la solicitud
    estado = Column(
        EnumType(EstadoCorrespondencia),
        nullable=False,
        default=EstadoCorrespondencia.ENVIADA,
        index=True
    )
    
    # Tiempo de respuesta (en días: 5, 10 o 15)
    tiempo_respuesta_dias = Column(Integer, nullable=True)
    
    # Observaciones adicionales
    observaciones = Column(Text, nullable=True)
    
    # Respuesta oficial
    respuesta = Column(Text, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    fecha_respuesta = Column(DateTime(timezone=True), nullable=True)
    
    # Relaciones con usuarios
    created_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    assigned_to_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    
    # Relación con entidad
    entity_id = Column(Integer, ForeignKey("entities.id", ondelete="CASCADE"), nullable=False)
    
    # Relaciones ORM
    created_by = relationship("User", foreign_keys=[created_by_id])
    assigned_to = relationship("User", foreign_keys=[assigned_to_id])
    entity = relationship("Entity")
