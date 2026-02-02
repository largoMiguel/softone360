from sqlalchemy import Column, Integer, String, Numeric, ForeignKey, DateTime, Text, UniqueConstraint, Index
from sqlalchemy.orm import relationship
from datetime import datetime
from app.config.database import Base


class PDMContratoRPS(Base):
    """
    Modelo para almacenar contratos/RPS (Registro Presupuestal) por producto PDM.
    Datos extraídos del Excel de Contratos RPS.
    """
    __tablename__ = "pdm_contratos_rps"
    
    # Constraint compuesto para evitar duplicados del mismo CDP en el mismo producto, entidad y año
    __table_args__ = (
        UniqueConstraint('entity_id', 'codigo_producto', 'no_cdp', 'anio',
                        name='uq_pdm_contratos_entity_codigo_cdp_anio'),
        Index('idx_pdm_contratos_entity_codigo_anio', 'entity_id', 'codigo_producto', 'anio'),
        Index('idx_pdm_contratos_cdp', 'no_cdp'),
    )

    id = Column(Integer, primary_key=True, index=True)
    
    # Código del producto PDM (ej: "4003018")
    codigo_producto = Column(String(20), nullable=False, index=True)
    
    # Número del CDP (Certificado de Disponibilidad Presupuestal)
    no_cdp = Column(String(100), nullable=False)
    
    # Concepto/descripción del contrato
    concepto = Column(Text, nullable=True)
    
    # Valor del contrato (suma de valores con el mismo NO CDP)
    valor = Column(Numeric(18, 2), nullable=False, default=0)
    
    # Relación con entidad
    entity_id = Column(Integer, ForeignKey('entities.id'), nullable=False, index=True)
    entity = relationship("Entity", back_populates="pdm_contratos_rps")
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Año fiscal del contrato
    anio = Column(Integer, nullable=False, index=True)
    
    # Información adicional opcional
    contratista = Column(String(500), nullable=True)
    fecha_inicio = Column(DateTime, nullable=True)
    fecha_fin = Column(DateTime, nullable=True)
    
    def __repr__(self):
        return f"<PDMContratoRPS(codigo={self.codigo_producto}, cdp={self.no_cdp}, anio={self.anio})>"
