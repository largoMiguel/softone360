from fastapi import APIRouter, HTTPException, Depends
import httpx
from typing import Dict, Any, Optional
from app.models.user import User
from app.utils.auth import get_current_active_user
from app.utils.rate_limiter import limiter, RATE_LIMITS
from app.utils.cache_manager import cache_manager, CACHE_CONFIGS
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/bpin", tags=["BPIN"])

DATOS_GOV_CO_API = "https://www.datos.gov.co/resource/cf9k-55fw.json"

@router.get("/{bpin}")
@limiter.limit(RATE_LIMITS["bpin_details"])
async def get_bpin_details(
    bpin: str,
    current_user: User = Depends(get_current_active_user)
) -> Optional[Dict[str, Any]]:
    """
    Obtiene los detalles de un proyecto BPIN desde la API de datos.gov.co
    ✅ Protecciones:
    - Autenticación requerida
    - Rate limiting: 100 req/hora
    - Caching: 2 horas
    """
    try:
        # Generar clave de caché
        cache_key = f"bpin:{bpin}"
        
        # Intentar obtener del caché
        cached_data = cache_manager.get(cache_key)
        if cached_data:
            logger.info(f"📦 BPIN (cached) {bpin} - Usuario: {current_user.email}")
            return cached_data
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            # Query para buscar el BPIN específico
            query = f'$where=caseless_one_of(`bpin`, "{bpin}")&$limit=1'
            url = f"{DATOS_GOV_CO_API}?{query}"
            
            response = await client.get(url)
            response.raise_for_status()
            
            data = response.json()
            
            if not data or len(data) == 0:
                logger.warning(f"⚠️ BPIN no encontrado: {bpin} - Usuario: {current_user.email}")
                return None
            
            result = data[0]
            
            # Cachear resultado (2 horas)
            cache_manager.set(cache_key, result, ttl_seconds=7200)
            
            logger.info(f"✅ BPIN (fresh) {bpin} - Usuario: {current_user.email}")
            return result
            
    except httpx.HTTPError as e:
        logger.error(f"❌ Error en BPIN {bpin} - Usuario: {current_user.email} - {str(e)}")
        raise HTTPException(
            status_code=503,
            detail=f"Error al consultar datos.gov.co: {str(e)}"
        )
    except Exception as e:
        logger.error(f"❌ Error inesperado en BPIN {bpin} - {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error inesperado: {str(e)}"
        )
