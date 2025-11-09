from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Float, Text, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.config.database import Base


# ============================================
# Tablas para almacenar datos del Excel PDM
# ============================================

class PdmLineaEstrategica(Base):
    """Líneas Estratégicas del PDM"""
    __tablename__ = "pdm_lineas_estrategicas"

    id = Column(Integer, primary_key=True, index=True)
    entity_id = Column(Integer, ForeignKey("entities.id", ondelete="CASCADE"), nullable=False, index=True)
    
    codigo_dane = Column(String(20), nullable=True)
    entidad_territorial = Column(String(256), nullable=True)
    nombre_plan = Column(String(512), nullable=True)
    consecutivo = Column(String(50), nullable=True)
    linea_estrategica = Column(Text, nullable=False)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class PdmIndicadorResultado(Base):
    """Indicadores de Resultado del PDM"""
    __tablename__ = "pdm_indicadores_resultado"

    id = Column(Integer, primary_key=True, index=True)
    entity_id = Column(Integer, ForeignKey("entities.id", ondelete="CASCADE"), nullable=False, index=True)
    
    codigo_dane = Column(String(20), nullable=True)
    entidad_territorial = Column(String(256), nullable=True)
    nombre_plan = Column(String(512), nullable=True)
    consecutivo = Column(String(50), nullable=True)
    linea_estrategica = Column(Text, nullable=True)
    indicador_resultado = Column(Text, nullable=False)
    esta_pnd = Column(String(10), nullable=True)
    meta_cuatrienio = Column(Float, nullable=True)
    transformacion_pnd = Column(String(512), nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class PdmIniciativaSGR(Base):
    """Iniciativas SGR del PDM"""
    __tablename__ = "pdm_iniciativas_sgr"

    id = Column(Integer, primary_key=True, index=True)
    entity_id = Column(Integer, ForeignKey("entities.id", ondelete="CASCADE"), nullable=False, index=True)
    
    codigo_dane = Column(String(20), nullable=True)
    entidad_territorial = Column(String(256), nullable=True)
    nombre_plan = Column(String(512), nullable=True)
    consecutivo = Column(String(50), nullable=True)
    linea_estrategica = Column(Text, nullable=True)
    tipo_iniciativa = Column(String(256), nullable=True)
    sector_mga = Column(String(256), nullable=True)
    iniciativa_sgr = Column(Text, nullable=False)
    recursos_sgr_indicativos = Column(Float, nullable=True)
    bpin = Column(String(50), nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class PdmProducto(Base):
    """Productos del Plan Indicativo - Tabla principal con toda la info del Excel"""
    __tablename__ = "pdm_productos"

    id = Column(Integer, primary_key=True, index=True)
    entity_id = Column(Integer, ForeignKey("entities.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Identificadores
    codigo_dane = Column(String(20), nullable=True)
    entidad_territorial = Column(String(256), nullable=True)
    nombre_plan = Column(String(512), nullable=True)
    codigo_indicador_producto = Column(String(128), nullable=True)
    codigo_producto = Column(String(128), nullable=False, index=True)
    
    # Estructura estratégica
    linea_estrategica = Column(Text, nullable=True)
    codigo_sector = Column(String(50), nullable=True)
    sector_mga = Column(String(256), nullable=True)
    codigo_programa = Column(String(50), nullable=True)
    programa_mga = Column(String(512), nullable=True)
    codigo_producto_mga = Column(String(50), nullable=True)
    producto_mga = Column(Text, nullable=True)
    codigo_indicador_producto_mga = Column(String(128), nullable=True)
    indicador_producto_mga = Column(Text, nullable=True)
    personalizacion_indicador = Column(Text, nullable=True)
    unidad_medida = Column(String(128), nullable=True)
    meta_cuatrienio = Column(Float, nullable=True)
    principal = Column(String(10), nullable=True)
    codigo_ods = Column(String(50), nullable=True)
    ods = Column(String(256), nullable=True)
    tipo_acumulacion = Column(String(128), nullable=True)
    bpin = Column(String(50), nullable=True)
    
    # Programación por año
    programacion_2024 = Column(Float, default=0)
    programacion_2025 = Column(Float, default=0)
    programacion_2026 = Column(Float, default=0)
    programacion_2027 = Column(Float, default=0)
    
    # Presupuesto completo (JSON para simplificar)
    presupuesto_2024 = Column(JSON, nullable=True)
    presupuesto_2025 = Column(JSON, nullable=True)
    presupuesto_2026 = Column(JSON, nullable=True)
    presupuesto_2027 = Column(JSON, nullable=True)
    
    # Totales presupuestales
    total_2024 = Column(Float, default=0)
    total_2025 = Column(Float, default=0)
    total_2026 = Column(Float, default=0)
    total_2027 = Column(Float, default=0)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# ============================================
# Tablas para gestión de actividades
# ============================================

class PdmActividad(Base):
    """Actividades asociadas a productos por año"""
    __tablename__ = "pdm_actividades"

    id = Column(Integer, primary_key=True, index=True)
    entity_id = Column(Integer, ForeignKey("entities.id", ondelete="CASCADE"), nullable=False, index=True)
    codigo_producto = Column(String(128), nullable=False, index=True)
    
    # Año de la actividad
    anio = Column(Integer, nullable=False, index=True)
    
    # Información de la actividad
    nombre = Column(String(512), nullable=False)
    descripcion = Column(Text, nullable=True)
    responsable = Column(String(256), nullable=True)  # Nombre del responsable (legacy)
    responsable_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)  # Usuario responsable
    fecha_inicio = Column(DateTime, nullable=True)
    fecha_fin = Column(DateTime, nullable=True)
    
    # Meta que se va a ejecutar
    meta_ejecutar = Column(Float, nullable=False, default=0.0)
    
    # Estado: PENDIENTE, EN_PROGRESO, COMPLETADA, CANCELADA
    estado = Column(String(64), nullable=False, default='PENDIENTE')
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relación con evidencia
    evidencia = relationship("PdmActividadEvidencia", back_populates="actividad", uselist=False, cascade="all, delete-orphan")
    
    # Relación con usuario responsable
    responsable_user = relationship("User", foreign_keys=[responsable_user_id])


class PdmActividadEvidencia(Base):
    """Evidencias de cumplimiento de actividades"""
    __tablename__ = "pdm_actividades_evidencias"

    id = Column(Integer, primary_key=True, index=True)
    actividad_id = Column(Integer, ForeignKey("pdm_actividades.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    entity_id = Column(Integer, ForeignKey("entities.id", ondelete="CASCADE"), nullable=False, index=True)
    
    descripcion = Column(Text, nullable=False)
    url_evidencia = Column(String(1024), nullable=True)
    
    # Imágenes en Base64 (JSON array)
    imagenes = Column(JSON, nullable=True)  # Array de strings base64
    
    fecha_registro = Column(DateTime, default=datetime.utcnow)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relación inversa
    actividad = relationship("PdmActividad", back_populates="evidencia")
