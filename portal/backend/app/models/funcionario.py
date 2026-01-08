from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.config.database import Base


class Funcionario(Base):
    """
    Modelo para los funcionarios de las entidades.
    Cada funcionario pertenece a una entidad.
    """
    __tablename__ = "funcionarios"
    
    id = Column(Integer, primary_key=True, index=True)
    cedula = Column(String(20), unique=True, index=True, nullable=False)
    nombres = Column(String(100), nullable=False)
    apellidos = Column(String(100), nullable=False)
    email = Column(String(150), nullable=True)
    telefono = Column(String(20), nullable=True)
    cargo = Column(String(150), nullable=True)
    foto_url = Column(String(500), nullable=True)  # URL de la foto en S3
    
    # Relación con entidad
    entity_id = Column(Integer, ForeignKey("entities.id", ondelete="CASCADE"), nullable=False)
    entity = relationship("Entity", back_populates="funcionarios")
    
    # Estado activo/inactivo
    is_active = Column(Boolean, nullable=False, default=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relaciones
    registros_asistencia = relationship("RegistroAsistencia", back_populates="funcionario", cascade="all, delete-orphan")


class EquipoRegistro(Base):
    """
    Modelo para los equipos autorizados para registro de asistencia.
    Cada equipo está asociado a una entidad.
    """
    __tablename__ = "equipos_registro"
    
    id = Column(Integer, primary_key=True, index=True)
    uuid = Column(String(100), unique=True, index=True, nullable=False)
    nombre = Column(String(100), nullable=False)  # Nombre descriptivo del equipo
    ubicacion = Column(String(200), nullable=True)  # Ubicación física (ej: "Recepción principal")
    
    # Relación con entidad
    entity_id = Column(Integer, ForeignKey("entities.id", ondelete="CASCADE"), nullable=False)
    entity = relationship("Entity", back_populates="equipos_registro")
    
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relaciones
    registros_asistencia = relationship("RegistroAsistencia", back_populates="equipo", cascade="all, delete-orphan")


class RegistroAsistencia(Base):
    """
    Modelo para los registros de asistencia (entrada/salida).
    Cada funcionario puede tener máximo 2 registros por día: entrada y salida.
    """
    __tablename__ = "registros_asistencia"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Relación con funcionario
    funcionario_id = Column(Integer, ForeignKey("funcionarios.id", ondelete="CASCADE"), nullable=False, index=True)
    funcionario = relationship("Funcionario", back_populates="registros_asistencia")
    
    # Relación con equipo
    equipo_id = Column(Integer, ForeignKey("equipos_registro.id", ondelete="CASCADE"), nullable=False)
    equipo = relationship("EquipoRegistro", back_populates="registros_asistencia")
    
    # Tipo de registro: entrada o salida
    tipo_registro = Column(String(10), nullable=False)  # "entrada" o "salida"
    
    # Fecha y hora del registro
    fecha_hora = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    
    # Foto capturada en el momento del registro
    foto_url = Column(String(500), nullable=True)
    
    # Observaciones opcionales
    observaciones = Column(String(500), nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
