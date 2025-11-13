from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.config.database import Base


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True)
    entity_id = Column(Integer, ForeignKey("entities.id", ondelete="CASCADE"), nullable=True, index=True)
    recipient_user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    type = Column(String(64), nullable=False)  # NEW_PQRS, PQRS_ASSIGNED, etc.
    title = Column(String(256), nullable=False)
    message = Column(String(1024), nullable=True)
    data = Column(Text, nullable=True)  # JSON serializado opcional
    created_at = Column(DateTime, default=datetime.utcnow)
    read_at = Column(DateTime, nullable=True)

    recipient = relationship("User", foreign_keys=[recipient_user_id])
