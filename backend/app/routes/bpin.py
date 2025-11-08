from fastapi import APIRouter, HTTPException
import httpx
from typing import Dict, Any, Optional

router = APIRouter(prefix="/api/bpin", tags=["BPIN"])

DATOS_GOV_CO_API = "https://www.datos.gov.co/resource/cf9k-55fw.json"

@router.get("/{bpin}")
async def get_bpin_details(bpin: str) -> Optional[Dict[str, Any]]:
    """
    Obtiene los detalles de un proyecto BPIN desde la API de datos.gov.co
    Actúa como proxy para evitar problemas de CORS
    """
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            # Query para buscar el BPIN específico
            query = f'$where=caseless_one_of(`bpin`, "{bpin}")&$limit=1'
            url = f"{DATOS_GOV_CO_API}?{query}"
            
            response = await client.get(url)
            response.raise_for_status()
            
            data = response.json()
            
            if not data or len(data) == 0:
                return None
            
            return data[0]
            
    except httpx.HTTPError as e:
        raise HTTPException(
            status_code=503,
            detail=f"Error al consultar datos.gov.co: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error inesperado: {str(e)}"
        )
