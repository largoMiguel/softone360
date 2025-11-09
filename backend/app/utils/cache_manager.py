"""
Módulo de caching con Redis para optimizar llamadas a APIs externas
"""
import redis
import json
import hashlib
from typing import Optional, Any, Callable
from functools import wraps
import logging
from datetime import timedelta

logger = logging.getLogger(__name__)

class CacheManager:
    """Gestor de caché con Redis"""
    
    def __init__(self, host: str = "localhost", port: int = 6379, db: int = 0):
        """
        Inicializa la conexión con Redis
        
        Args:
            host: Host de Redis
            port: Puerto de Redis
            db: Base de datos Redis a usar
        """
        try:
            self.redis_client = redis.Redis(
                host=host,
                port=port,
                db=db,
                decode_responses=True,
                socket_connect_timeout=5
            )
            # Test de conexión
            self.redis_client.ping()
            logger.info("✅ Conexión exitosa a Redis")
            self.connected = True
        except Exception as e:
            logger.warning(f"⚠️ No se pudo conectar a Redis: {str(e)}. Cache deshabilitado.")
            self.connected = False
    
    def get(self, key: str) -> Optional[Any]:
        """Obtener valor del caché"""
        if not self.connected:
            return None
        
        try:
            value = self.redis_client.get(key)
            if value:
                logger.debug(f"✅ Cache hit: {key}")
                return json.loads(value)
            return None
        except Exception as e:
            logger.warning(f"Error al obtener del caché: {str(e)}")
            return None
    
    def set(self, key: str, value: Any, ttl_seconds: int = 3600) -> bool:
        """
        Guardar valor en el caché
        
        Args:
            key: Clave de caché
            value: Valor a guardar
            ttl_seconds: Tiempo de vida en segundos (default 1 hora)
        """
        if not self.connected:
            return False
        
        try:
            self.redis_client.setex(
                key,
                ttl_seconds,
                json.dumps(value)
            )
            logger.debug(f"✅ Cache set: {key} (TTL: {ttl_seconds}s)")
            return True
        except Exception as e:
            logger.warning(f"Error al guardar en caché: {str(e)}")
            return False
    
    def delete(self, key: str) -> bool:
        """Eliminar clave del caché"""
        if not self.connected:
            return False
        
        try:
            self.redis_client.delete(key)
            logger.debug(f"✅ Cache deleted: {key}")
            return True
        except Exception as e:
            logger.warning(f"Error al eliminar del caché: {str(e)}")
            return False
    
    def clear(self) -> bool:
        """Limpiar todo el caché"""
        if not self.connected:
            return False
        
        try:
            self.redis_client.flushdb()
            logger.info("✅ Caché limpiado")
            return True
        except Exception as e:
            logger.warning(f"Error al limpiar caché: {str(e)}")
            return False

# Instancia global de caché
cache_manager = CacheManager()

def cache_response(ttl_seconds: int = 3600, key_prefix: str = "api") -> Callable:
    """
    Decorador para cachear respuestas de funciones
    
    Args:
        ttl_seconds: Tiempo de vida del caché en segundos
        key_prefix: Prefijo para la clave de caché
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, **kwargs) -> Any:
            # Generar clave de caché única basada en función y parámetros
            cache_key = f"{key_prefix}:{func.__name__}:{hashlib.md5(str((args, kwargs)).encode()).hexdigest()}"
            
            # Intentar obtener del caché
            cached_value = cache_manager.get(cache_key)
            if cached_value is not None:
                logger.debug(f"📦 Usando valor cacheado para {func.__name__}")
                return cached_value
            
            # Ejecutar función y cachear resultado
            result = await func(*args, **kwargs)
            cache_manager.set(cache_key, result, ttl_seconds)
            
            return result
        return wrapper
    return decorator

# Configuraciones de caché predefinidas
CACHE_CONFIGS = {
    "datos_gov_proxy": {
        "ttl": 3600,        # 1 hora
        "prefix": "datos_gov"
    },
    "bpin_details": {
        "ttl": 7200,        # 2 horas
        "prefix": "bpin"
    },
    "contratacion_summary": {
        "ttl": 1800,        # 30 minutos (datos más frescos por IA)
        "prefix": "resumen_ia"
    }
}
