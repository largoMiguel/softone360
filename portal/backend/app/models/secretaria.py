from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.config.database import Base

class Secretaria(Base):
    __tablename__ = "secretarias"
    __table_args__ = (
        UniqueConstraint('entity_id', 'nombre', name='uq_secretaria_entity_nombre'),
    )

    id = Column(Integer, primary_key=True, index=True)
    entity_id = Column(Integer, ForeignKey("entities.id", ondelete="CASCADE"), nullable=False)
    nombre = Column(String, nullable=False)
    is_active = Column(Boolean, nullable=False, server_default="1", default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    entity = relationship("Entity", back_populates="secretarias", lazy="joined")
