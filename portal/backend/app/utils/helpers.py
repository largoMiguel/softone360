import random
import string
from datetime import datetime
from sqlalchemy.orm import Session

def generate_radicado(db: Session = None, entity_id: int = None, prefix: str = None) -> str:
    """
    Generar número de radicado único en formato PREFIX-YYYYMMDDNNN o ENT-YYYYMMDDNNN
    Donde:
    - PREFIX es el prefijo del tipo de documento (PQRS, CORR, etc.) - opcional
    - ENT es el ID de la entidad (para evitar colisiones entre entidades) - sin prefix
    - YYYYMMDD es la fecha actual
    - NNN es un número consecutivo que inicia en 001 cada día
    """
    now = datetime.now()
    fecha_base = now.strftime("%Y%m%d")  # YYYYMMDD
    
    # Determinar el modelo a usar basado en el prefix
    if prefix == "CORR":
        from app.models.correspondencia import Correspondencia as Modelo
        prefijo = f"{prefix}-{fecha_base}"
    else:
        # Default: PQRS (comportamiento anterior)
        from app.models.pqrs import PQRS as Modelo
        entity_code = entity_id if entity_id else 0
        prefijo = f"{entity_code}-{fecha_base}"
    
    if db is None:
        # Si no se pasa la sesión de BD, generar un número aleatorio de 3 dígitos
        numero = random.randint(1, 999)
        return f"{prefijo}{numero:03d}"
    
    # Buscar el último radicado del día actual
    filtros = [Modelo.numero_radicado.like(f"{prefijo}%")]
    if not prefix:  # Solo filtrar por entity_id si no hay prefix (PQRS)
        filtros.append(Modelo.entity_id == entity_id)
    
    ultimo_radicado = db.query(Modelo).filter(*filtros).order_by(Modelo.numero_radicado.desc()).first()
    
    if ultimo_radicado:
        # Extraer el número consecutivo y sumarle 1
        try:
            # El formato es PREFIX-YYYYMMDDNNN, extraer los últimos 3 dígitos
            ultimo_numero = int(ultimo_radicado.numero_radicado[-3:])
            nuevo_numero = ultimo_numero + 1
        except (ValueError, IndexError):
            nuevo_numero = 1
    else:
        # Primer radicado del día
        nuevo_numero = 1
    
    return f"{prefijo}{nuevo_numero:03d}"

def format_date(date: datetime) -> str:
    """Formatear fecha para mostrar"""
    if date:
        return date.strftime("%d/%m/%Y %H:%M")
    return ""