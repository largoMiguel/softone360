from sqlalchemy import Column, Integer, String, Numeric, ForeignKey, DateTime, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from app.config.database import Base

class PDMEjecucionPresupuestal(Base):
    """
    Modelo para almacenar datos de ejecución presupuestal por producto PDM.
    Datos extraídos del Excel de Ejecución de Gastos.
    """
    __tablename__ = "pdm_ejecucion_presupuestal"

    id = Column(Integer, primary_key=True, index=True)
    
    # Código del producto PDM (ej: "4003018")
    codigo_producto = Column(String(20), nullable=False, index=True)
    
    # Descripción de la fuente presupuestal
    descripcion_fte = Column(String(500), nullable=False)
    
    # Columnas presupuestales (valores numéricos)
    pto_inicial = Column(Numeric(18, 2), default=0)
    adicion = Column(Numeric(18, 2), default=0)
    reduccion = Column(Numeric(18, 2), default=0)
    credito = Column(Numeric(18, 2), default=0)
    contracredito = Column(Numeric(18, 2), default=0)
    pto_definitivo = Column(Numeric(18, 2), default=0)
    pagos = Column(Numeric(18, 2), default=0)
    
    # Relación con entidad
    entity_id = Column(Integer, ForeignKey('entities.id'), nullable=False)
    entity = relationship("Entity", back_populates="pdm_ejecuciones")
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Información adicional del Excel (opcional)
    sector = Column(String(100), nullable=True)
    dependencia = Column(String(200), nullable=True)
    bpin = Column(String(50), nullable=True)
    
    def __repr__(self):
        return f"<PDMEjecucionPresupuestal(codigo={self.codigo_producto}, fuente={self.descripcion_fte[:50]})>"
