from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Boolean, JSON
from sqlalchemy.orm import relationship
from app.config.database import Base


class InformeEstado(Base):
    """
    Modelo para guardar el estado de generación de informes PDM.
    Permite generación asíncrona con notificación al usuario cuando termina.
    """
    __tablename__ = "informes_estado"

    id = Column(Integer, primary_key=True, index=True)
    entity_id = Column(Integer, ForeignKey("entities.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Configuración del informe solicitado
    anio = Column(Integer, nullable=False)
    formato = Column(String(10), nullable=False, default='pdf')  # pdf, docx, xlsx
    filtros = Column(JSON, nullable=True)  # secretaria_ids, fechas, estados, etc.
    
    # Estado de la generación
    estado = Column(String(20), nullable=False, default='pending')  # pending, processing, completed, failed
    progreso = Column(Integer, default=0)  # 0-100%
    
    # Resultado
    s3_url = Column(String(512), nullable=True)  # URL del archivo generado en S3
    s3_key = Column(String(512), nullable=True)  # Key en S3 para eliminación posterior
    filename = Column(String(256), nullable=True)
    file_size = Column(Integer, nullable=True)  # bytes
    
    # Errores
    error_message = Column(Text, nullable=True)
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    expires_at = Column(DateTime, nullable=True)  # Fecha de expiración del archivo en S3
    downloaded = Column(Boolean, default=False)  # Track si el usuario ya descargó
    downloaded_at = Column(DateTime, nullable=True)
    
    # Relationships
    entity = relationship("Entity", foreign_keys=[entity_id])
    user = relationship("User", foreign_keys=[user_id])

    def __repr__(self):
        return f"<InformeEstado(id={self.id}, estado={self.estado}, anio={self.anio})>"
