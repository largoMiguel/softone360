import random
import string
from datetime import datetime
from sqlalchemy.orm import Session

def generate_radicado(db: Session = None, entity_id: int = None) -> str:
    """
    Generar número de radicado único en formato ENT-YYYYMMDDNNN
    Donde:
    - ENT es el ID de la entidad (para evitar colisiones entre entidades)
    - YYYYMMDD es la fecha actual
    - NNN es un número consecutivo que inicia en 001 cada día por entidad
    """
    now = datetime.now()
    fecha_base = now.strftime("%Y%m%d")  # YYYYMMDD
    
    # Si no hay entity_id, usar 0 como default
    entity_code = entity_id if entity_id else 0
    prefijo = f"{entity_code}-{fecha_base}"
    
    if db is None:
        # Si no se pasa la sesión de BD, generar un número aleatorio de 3 dígitos
        numero = random.randint(1, 999)
        return f"{prefijo}{numero:03d}"
    
    # Buscar el último radicado del día actual para esta entidad
    from app.models.pqrs import PQRS
    
    # Filtrar por entidad y fecha para evitar colisiones
    ultimo_radicado = db.query(PQRS).filter(
        PQRS.numero_radicado.like(f"{prefijo}%"),
        PQRS.entity_id == entity_id
    ).order_by(PQRS.numero_radicado.desc()).first()
    
    if ultimo_radicado:
        # Extraer el número consecutivo y sumarle 1
        try:
            # El formato es ENT-YYYYMMDDNNN, extraer los últimos 3 dígitos
            ultimo_numero = int(ultimo_radicado.numero_radicado[-3:])
            nuevo_numero = ultimo_numero + 1
        except (ValueError, IndexError):
            nuevo_numero = 1
    else:
        # Primer radicado del día para esta entidad
        nuevo_numero = 1
    
    return f"{prefijo}{nuevo_numero:03d}"

def format_date(date: datetime) -> str:
    """Formatear fecha para mostrar"""
    if date:
        return date.strftime("%d/%m/%Y %H:%M")
    return ""