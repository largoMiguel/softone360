from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Enum, Boolean, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.config.database import Base
import enum

class UserRole(enum.Enum):
    SUPERADMIN = "superadmin"  # Super administrador del sistema
    ADMIN = "admin"  # Administrador de entidad
    SECRETARIO = "secretario"  # Secretario de entidad
    CIUDADANO = "ciudadano"  # Ciudadano

class UserType(enum.Enum):
    SECRETARIO = "secretario"  # Personal de planta
    CONTRATISTA = "contratista"  # Personal contratado

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    full_name = Column(String, nullable=False)
    hashed_password = Column(String, nullable=False)
    # Usar los VALORES en minúscula del Enum para almacenar en la BD (coincide con el frontend)
    # native_enum=False evita depender de tipos ENUM en Postgres y mapea contra texto
    role = Column(
        Enum(
            UserRole,
            name="userrole",
            native_enum=False,
            values_callable=lambda enum_cls: [e.value for e in enum_cls]
        ),
        nullable=False,
        default=UserRole.SECRETARIO
    )
    
    # Relación con entidad (solo para ADMIN y SECRETARIO)
    entity_id = Column(Integer, ForeignKey("entities.id", ondelete="CASCADE"), nullable=True)
    entity = relationship("Entity", back_populates="users")
    
    # Tipo de usuario (para diferenciar secretarios de contratistas)
    user_type = Column(
        Enum(
            UserType,
            name="usertype",
            native_enum=False,
            values_callable=lambda enum_cls: [e.value for e in enum_cls]  # usa valores en minúsculas
        ),
        nullable=True  # NULL para ciudadanos y admins
    )
    
    # Módulos permitidos para este usuario (JSON array de strings)
    # Ejemplo: ["pqrs", "planes_institucionales", "contratacion"]
    allowed_modules = Column(JSON, nullable=True, default=list)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    is_active = Column(Boolean, nullable=False, server_default="1", default=True)
    
    # Relaciones
    pqrs_creadas = relationship("PQRS", foreign_keys="PQRS.created_by_id", back_populates="created_by")
    pqrs_asignadas = relationship("PQRS", foreign_keys="PQRS.assigned_to_id", back_populates="assigned_to")