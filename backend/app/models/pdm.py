from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Float, Text, ForeignKey, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.config.database import Base


# ============================================
# Tablas para gestión de productos y actividades PDM
# ============================================

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
    
    # Responsable del producto (FK a secretarias)
    responsable_secretaria_id = Column(Integer, ForeignKey("secretarias.id", ondelete="SET NULL"), nullable=True, index=True)
    
    # Campo de texto para guardar nombre de secretaría (por compatibilidad backward)
    responsable_secretaria_nombre = Column(String(256), nullable=True)
    
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
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relación con secretaría responsable
    responsable_secretaria = relationship("Secretaria", foreign_keys=[responsable_secretaria_id])
    
    # Relación con actividades (lazy loading, se cargan bajo demanda)
    actividades = relationship(
        "PdmActividad",
        foreign_keys="PdmActividad.codigo_producto",
        primaryjoin="PdmProducto.codigo_producto == PdmActividad.codigo_producto",
        viewonly=True,
        lazy="select"
    )


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
    
    # Responsable de la actividad (FK a secretarias)
    responsable_secretaria_id = Column(Integer, ForeignKey("secretarias.id", ondelete="SET NULL"), nullable=True, index=True)
    
    fecha_inicio = Column(DateTime, nullable=True)
    fecha_fin = Column(DateTime, nullable=True)
    
    # Meta que se va a ejecutar
    meta_ejecutar = Column(Float, nullable=False, default=0.0)
    
    # Estado: PENDIENTE, EN_PROGRESO, COMPLETADA, CANCELADA
    estado = Column(String(64), nullable=False, default='PENDIENTE')
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relación con evidencia
    evidencia = relationship("PdmActividadEvidencia", back_populates="actividad", uselist=False, cascade="all, delete-orphan")
    
    # Relación con secretaría responsable
    responsable_secretaria = relationship("Secretaria", foreign_keys=[responsable_secretaria_id])


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
    
    fecha_registro = Column(DateTime(timezone=True), server_default=func.now())
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relación inversa con actividad
    actividad = relationship("PdmActividad", back_populates="evidencia")


class PdmArchivoExcel(Base):
    """Tabla para almacenar archivos Excel generados para PDM"""
    __tablename__ = "pdm_archivos_excel"

    id = Column(Integer, primary_key=True, index=True)
    entity_id = Column(Integer, ForeignKey("entities.id", ondelete="CASCADE"), nullable=False, index=True)
    nombre_archivo = Column(String(512), nullable=False)
    contenido = Column(String, nullable=False)  # LargeBinary as String
    tamanio = Column(Integer, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


# ============================================
# Tabla para Iniciativas SGR
# ============================================

class PdmIniciativaSGR(Base):
    """Iniciativas del Sistema General de Regalías (SGR) - Datos del Excel"""
    __tablename__ = "pdm_iniciativas_sgr"

    id = Column(Integer, primary_key=True, index=True)
    entity_id = Column(Integer, ForeignKey("entities.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Identificadores
    codigo_dane = Column(String(20), nullable=True)
    entidad_territorial = Column(String(256), nullable=True)
    nombre_plan = Column(String(512), nullable=True)
    consecutivo = Column(String(128), nullable=False, unique=True, index=True)  # ISGR-1, ISGR-2, etc.
    
    # Estructura
    linea_estrategica = Column(Text, nullable=True)
    tipo_iniciativa = Column(String(256), nullable=True)
    sector_mga = Column(String(256), nullable=True)
    iniciativa_sgr = Column(Text, nullable=True)
    recursos_sgr_indicativos = Column(Float, default=0)
    bpin = Column(String(50), nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
