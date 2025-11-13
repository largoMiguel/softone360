import random
import string
from datetime import datetime
from sqlalchemy.orm import Session

def generate_radicado(db: Session = None) -> str:
    """
    Generar número de radicado único en formato YYYYMMDDNNN
    Donde NNN es un número consecutivo que inicia en 001 cada día
    """
    now = datetime.now()
    fecha_base = now.strftime("%Y%m%d")  # YYYYMMDD
    
    if db is None:
        # Si no se pasa la sesión de BD, generar un número aleatorio de 3 dígitos
        numero = random.randint(1, 999)
        return f"{fecha_base}{numero:03d}"
    
    # Buscar el último radicado del día actual
    from app.models.pqrs import PQRS
    ultimo_radicado = db.query(PQRS).filter(
        PQRS.numero_radicado.like(f"{fecha_base}%")
    ).order_by(PQRS.numero_radicado.desc()).first()
    
    if ultimo_radicado:
        # Extraer el número consecutivo y sumarle 1
        try:
            ultimo_numero = int(ultimo_radicado.numero_radicado[-3:])
            nuevo_numero = ultimo_numero + 1
        except (ValueError, IndexError):
            nuevo_numero = 1
    else:
        # Primer radicado del día
        nuevo_numero = 1
    
    return f"{fecha_base}{nuevo_numero:03d}"

def format_date(date: datetime) -> str:
    """Formatear fecha para mostrar"""
    if date:
        return date.strftime("%d/%m/%Y %H:%M")
    return ""