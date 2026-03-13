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
    
    # Sin constraint único — DELETE+INSERT por entidad+año garantiza unicidad
    __table_args__ = (
        Index('idx_pdm_contratos_entity_codigo_anio', 'entity_id', 'codigo_producto', 'anio'),
        Index('idx_pdm_contratos_entity_anio', 'entity_id', 'anio'),
    )

    id = Column(Integer, primary_key=True, index=True)
    
    # Código del producto PDM (puede ser largo: ej: "4003018", o un nombre)
    codigo_producto = Column(Text, nullable=False, index=True)
    
    # Número del CRP (Compromiso de Registro Presupuestal)
    no_crp = Column(String(100), nullable=False)
    
    # Concepto/descripción del contrato
    concepto = Column(Text, nullable=True)
    
    # Valor del contrato (suma de valores con el mismo CRP)
    valor = Column(Numeric(18, 2), nullable=False, default=0)
    
    # Relación con entidad
    entity_id = Column(Integer, ForeignKey('entities.id', ondelete='CASCADE'), nullable=False, index=True)
    entity = relationship("Entity", back_populates="pdm_contratos_rps")
    
    # Año fiscal del contrato
    anio = Column(Integer, nullable=False, index=True)
    
    # Información adicional opcional
    contratista = Column(String(500), nullable=True)
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def __repr__(self):
        return f"<PDMContratoRPS(codigo={self.codigo_producto}, crp={self.no_crp}, anio={self.anio})>"
