from sqlalchemy import Column, Integer, String, Text, Date, ForeignKey, Enum as SQLEnum, Numeric, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from datetime import datetime
from app.config.database import Base
import enum

# ==================== ENUMS ====================

class EstadoPlan(str, enum.Enum):
    """Estados posibles para un plan institucional"""
    FORMULACION = "formulacion"
    APROBADO = "aprobado"
    EN_EJECUCION = "en_ejecucion"
    FINALIZADO = "finalizado"
    SUSPENDIDO = "suspendido"
    CANCELADO = "cancelado"


class EstadoComponente(str, enum.Enum):
    """Estados posibles para un componente/proceso"""
    NO_INICIADO = "no_iniciado"
    EN_PROGRESO = "en_progreso"
    COMPLETADO = "completado"
    EN_RIESGO = "en_riesgo"
    RETRASADO = "retrasado"


class EstadoActividad(str, enum.Enum):
    """Estados posibles para una actividad"""
    PENDIENTE = "pendiente"
    EN_EJECUCION = "en_ejecucion"
    COMPLETADA = "completada"
    PAUSADA = "pausada"
    CANCELADA = "cancelada"


class PrioridadActividad(str, enum.Enum):
    """Prioridad de una actividad"""
    BAJA = "baja"
    MEDIA = "media"
    ALTA = "alta"
    CRITICA = "critica"


class TipoActividadEjecucion(str, enum.Enum):
    """Tipo de actividad de ejecución"""
    AVANCE = "avance"
    OBSERVACION = "observacion"
    INCIDENCIA = "incidencia"
    EVIDENCIA = "evidencia"
    FINALIZACION = "finalizacion"


class TipoEvidencia(str, enum.Enum):
    """Tipo de evidencia para actividades de ejecución"""
    URL = "url"
    IMAGEN = "imagen"


# ==================== MODELOS ====================

class PlanInstitucional(Base):
    """
    Modelo para planes institucionales del municipio.
    Representa el nivel más alto de planificación estratégica.
    """
    __tablename__ = "planes_institucionales"

    id = Column(Integer, primary_key=True, index=True)
    anio = Column(Integer, nullable=False, index=True)
    nombre = Column(String(300), nullable=False)
    descripcion = Column(Text, nullable=False)
    fecha_inicio = Column(Date, nullable=False, index=True)
    fecha_fin = Column(Date, nullable=False, index=True)
    # Cambio de SQLEnum a String para evitar problemas con valores en mayúsculas
    estado = Column(String(50), default=EstadoPlan.FORMULACION.value, nullable=False, index=True)
    
    # Avance calculado automáticamente desde los componentes
    porcentaje_avance = Column(Numeric(5, 2), default=0, nullable=False)
    
    # Responsables
    responsable_elaboracion = Column(String(200), nullable=False)
    responsable_aprobacion = Column(String(200), nullable=True)
    
    # Auditoría
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    created_by = Column(String(200), nullable=True)  # Username del creador
    
    # Relación con entidad
    entity_id = Column(Integer, ForeignKey("entities.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Relaciones
    componentes = relationship("ComponenteProceso", back_populates="plan", cascade="all, delete-orphan", 
                               order_by="ComponenteProceso.created_at")

    def __repr__(self):
        return f"<PlanInstitucional(anio='{self.anio}', nombre='{self.nombre}')>"


class ComponenteProceso(Base):
    """
    Modelo para componentes o procesos de un plan institucional.
    Cada plan se divide en componentes estratégicos.
    """
    __tablename__ = "componentes_procesos"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(300), nullable=False)

    # Estado y avance (se mantiene porcentaje para análisis)
    estado = Column(String(50), default=EstadoComponente.NO_INICIADO.value, nullable=False, index=True)
    porcentaje_avance = Column(Numeric(5, 2), default=0, nullable=False)
    
    # Auditoría
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relación con plan
    plan_id = Column(Integer, ForeignKey("planes_institucionales.id", ondelete="CASCADE"), nullable=False, index=True)
    plan = relationship("PlanInstitucional", back_populates="componentes")
    
    # Relaciones
    actividades = relationship("Actividad", back_populates="componente", cascade="all, delete-orphan",
                              order_by="Actividad.created_at")

    def __repr__(self):
        return f"<ComponenteProceso(nombre='{self.nombre}')>"


class Actividad(Base):
    """
    Modelo para actividades dentro de un componente/proceso.
    Cada componente contiene múltiples actividades específicas.
    """
    __tablename__ = "actividades"

    id = Column(Integer, primary_key=True, index=True)
    objetivo_especifico = Column(Text, nullable=True)

    # Fechas previstas
    fecha_inicio_prevista = Column(Date, nullable=False)
    fecha_fin_prevista = Column(Date, nullable=False)

    # Responsable: Foreign Key a secretarías
    responsable_secretaria_id = Column(Integer, ForeignKey("secretarias.id", ondelete="SET NULL"), nullable=True, index=True)

    # Auditoría
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relación con componente
    componente_id = Column(Integer, ForeignKey("componentes_procesos.id", ondelete="CASCADE"), nullable=False, index=True)
    componente = relationship("ComponenteProceso", back_populates="actividades")
    
    # Relación con secretaría responsable
    secretaria_responsable = relationship("Secretaria", foreign_keys=[responsable_secretaria_id])
    
    # Relaciones
    actividades_ejecucion = relationship("ActividadEjecucion", back_populates="actividad", 
                                        cascade="all, delete-orphan",
                                        order_by="ActividadEjecucion.fecha_registro.desc()")

    def __repr__(self):
        return f"<Actividad(id='{self.id}')>"


class ActividadEjecucion(Base):
    """
    Modelo para registrar el avance y seguimiento de las actividades.
    Cada actividad puede tener múltiples registros de ejecución.
    """
    __tablename__ = "actividades_ejecucion"

    id = Column(Integer, primary_key=True, index=True)
    fecha_registro = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)

    # Descripción y evidencia mínima
    descripcion = Column(Text, nullable=False)
    evidencia_url = Column(String(500), nullable=True)

    # Auditoría
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relación con actividad
    actividad_id = Column(Integer, ForeignKey("actividades.id", ondelete="CASCADE"), nullable=False, index=True)
    actividad = relationship("Actividad", back_populates="actividades_ejecucion")
    
    # Relación con evidencias
    evidencias = relationship("ActividadEvidencia", back_populates="actividad_ejecucion", 
                            cascade="all, delete-orphan",
                            order_by="ActividadEvidencia.orden")

    def __repr__(self):
        return f"<ActividadEjecucion(id={self.id}, fecha='{self.fecha_registro}')>"


class ActividadEvidencia(Base):
    """
    Modelo para almacenar evidencias (URLs o imágenes) de las actividades de ejecución.
    Máximo 4 imágenes + 1 URL por actividad de ejecución.
    """
    __tablename__ = "actividades_evidencias"

    id = Column(Integer, primary_key=True, index=True)
    tipo = Column(SQLEnum(TipoEvidencia), nullable=False, index=True)
    
    # Contenido: URL o imagen en base64
    contenido = Column(Text, nullable=False)
    
    # Para imágenes: nombre del archivo y tipo MIME
    nombre_archivo = Column(String(255), nullable=True)
    mime_type = Column(String(100), nullable=True)
    
    # Orden de visualización
    orden = Column(Integer, default=0, nullable=False)
    
    # Auditoría
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    # Relación con actividad de ejecución
    actividad_ejecucion_id = Column(Integer, ForeignKey("actividades_ejecucion.id", ondelete="CASCADE"), 
                                   nullable=False, index=True)
    actividad_ejecucion = relationship("ActividadEjecucion", back_populates="evidencias")

    def __repr__(self):
        return f"<ActividadEvidencia(id={self.id}, tipo='{self.tipo}')>"
