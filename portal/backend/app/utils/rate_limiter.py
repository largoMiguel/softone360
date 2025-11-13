"""
Rate limiter utility para proteger endpoints con APIs externas
"""
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from fastapi import Request
from functools import wraps
import time
from typing import Callable, Any

# Inicializar limitador con dirección IP remota
limiter = Limiter(key_func=get_remote_address)

# Límites personalizados por endpoint
RATE_LIMITS = {
    "contratacion_proxy": "100/hour",      # 100 requests por hora
    "contratacion_summary": "20/hour",     # 20 requests por hora (más restrictivo por OpenAI)
    "bpin_details": "100/hour",            # 100 requests por hora
}

def rate_limit_decorator(limit_key: str) -> Callable:
    """
    Decorador personalizado para rate limiting
    
    Args:
        limit_key: Clave en RATE_LIMITS para obtener el límite
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, **kwargs) -> Any:
            # Este es un decorador auxiliar
            # El rate limiting se aplica a través de slowapi en los routers
            return await func(*args, **kwargs)
        return wrapper
    return decorator

class RateLimitConfig:
    """Configuración centralizada de rate limiting"""
    
    # Límites por endpoint
    CONTRATACION_PROXY = "100/hour"        # Datos públicos de datos.gov.co
    CONTRATACION_SUMMARY = "20/hour"       # Limitado por costo de OpenAI API
    BPIN_DETAILS = "100/hour"              # Datos públicos
    
    # Límites por usuario (si se implementa autenticación avanzada)
    PER_USER_LIMITS = {
        "superadmin": "unlimited",
        "admin": "500/hour",
        "secretario": "300/hour",
        "ciudadano": "100/hour",
    }
