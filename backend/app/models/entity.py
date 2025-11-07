from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.config.database import Base


class Entity(Base):
    """
    Modelo para las entidades/secretarías.
    Cada entidad puede tener múltiples administradores.
    """
    __tablename__ = "entities"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), unique=True, index=True, nullable=False)
    code = Column(String(50), unique=True, index=True, nullable=False)  # Código único de la entidad
    nit = Column(String(50), nullable=True, index=True)  # NIT de la entidad para consultas SECOP
    slug = Column(String(100), unique=True, index=True, nullable=False)  # URL slug (ej: chiquiza-boyaca)
    description = Column(Text, nullable=True)
    address = Column(String(300), nullable=True)
    phone = Column(String(50), nullable=True)
    email = Column(String(150), nullable=True)
    logo_url = Column(String(500), nullable=True)  # URL del logo de la entidad
    horario_atencion = Column(String(200), nullable=True)  # Ej: "Lunes a Viernes 8:00 AM - 5:00 PM"
    tiempo_respuesta = Column(String(100), nullable=True)  # Ej: "Respuesta en 24 horas"
    is_active = Column(Boolean, nullable=False, default=True)
    # Flags de módulos/funcionalidades
    enable_pqrs = Column(Boolean, nullable=False, default=True)
    enable_users_admin = Column(Boolean, nullable=False, default=True)
    enable_reports_pdf = Column(Boolean, nullable=False, default=True)
    enable_ai_reports = Column(Boolean, nullable=False, default=True)
    enable_planes_institucionales = Column(Boolean, nullable=False, default=True)
    # Nuevo módulo de Contratación (SECOP/SODA)
    enable_contratacion = Column(Boolean, nullable=False, default=True)
    # Nuevo módulo de Plan de Desarrollo Municipal (PDM)
    enable_pdm = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relaciones
    users = relationship("User", back_populates="entity", cascade="all, delete-orphan")
    secretarias = relationship("Secretaria", back_populates="entity", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<Entity {self.code}: {self.name}>"
