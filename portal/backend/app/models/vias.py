from sqlalchemy import Column, Integer, String, Numeric, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.config.database import Base


class ViaViaje(Base):
    """
    Registro de descarga de volqueta — punto en el mapa.
    Enviado desde el celular del conductor. Puede llegar con retraso si estaba offline.
    """
    __tablename__ = "via_viajes"

    id = Column(Integer, primary_key=True, index=True)
    entity_id = Column(Integer, ForeignKey('entities.id'), nullable=False, index=True)

    conductor_nombre = Column(String(150), nullable=False)
    placa_vehiculo = Column(String(20), nullable=False)
    tipo_material = Column(String(100), nullable=True)
    observacion = Column(Text, nullable=True)

    # Coordenadas capturadas por GPS del celular
    latitud = Column(Numeric(10, 7), nullable=False)
    longitud = Column(Numeric(10, 7), nullable=False)

    # Timestamp capturado en el celular (puede ser del pasado si estaba offline)
    timestamp_registro = Column(DateTime, nullable=False)

    # Timestamp cuando llegó al servidor
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    entity = relationship("Entity", back_populates="via_viajes")


class ViaTramo(Base):
    """
    Registro de tramo intervenido por maquinaria amarilla — línea en el mapa.
    El operador marca inicio y fin. Ambos puntos se almacenan para dibujar el segmento.
    """
    __tablename__ = "via_tramos"

    id = Column(Integer, primary_key=True, index=True)
    entity_id = Column(Integer, ForeignKey('entities.id'), nullable=False, index=True)

    operador_nombre = Column(String(150), nullable=False)
    nombre_maquina = Column(String(100), nullable=False)
    tipo_trabajo = Column(String(100), nullable=True)
    observacion = Column(Text, nullable=True)

    # Punto de inicio del tramo (al presionar "Iniciar")
    lat_inicio = Column(Numeric(10, 7), nullable=False)
    lng_inicio = Column(Numeric(10, 7), nullable=False)

    # Punto de fin del tramo (al presionar "Finalizar")
    lat_fin = Column(Numeric(10, 7), nullable=False)
    lng_fin = Column(Numeric(10, 7), nullable=False)

    # Timestamps capturados en el celular
    timestamp_inicio = Column(DateTime, nullable=False)
    timestamp_fin = Column(DateTime, nullable=False)

    # Timestamp cuando llegó al servidor
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    entity = relationship("Entity", back_populates="via_tramos")
