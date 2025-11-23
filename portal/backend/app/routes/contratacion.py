from fastapi import APIRouter, Query, HTTPException, Depends, Request
from typing import Optional, Dict, Any, List
from pydantic import BaseModel
from app.config.settings import settings
import httpx
from urllib.parse import urlencode
from app.models.user import User
from app.utils.auth import get_current_active_user
from app.config.database import get_db
from sqlalchemy.orm import Session
from app.utils.rate_limiter import limiter, RATE_LIMITS
from app.utils.cache_manager import cache_manager, CACHE_CONFIGS
from app.utils.openai_logger import openai_logger, CostAnalyzer
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/contratacion", tags=["Contratación"])

# Dataset de contratos SECOP II (jbjy-vk9h) - Solo procesos CON contrato
DATOS_GOV_BASE_URL = "https://www.datos.gov.co/resource/jbjy-vk9h.json"

# Dataset de procesos SECOP II (p6dx-8zbt) - Procesos SIN contrato
DATOS_GOV_PROCESOS_URL = "https://www.datos.gov.co/resource/p6dx-8zbt.json"

# Dataset de contratos SECOP I (f789-7hwg)
DATOS_GOV_SECOP1_URL = "https://www.datos.gov.co/resource/f789-7hwg.json"


@router.get("/proxy")
@limiter.limit(RATE_LIMITS["contratacion_proxy"])
async def proxy_datos_gov(
    request: Request,
    query: Optional[str] = Query(None, alias="$query"),
    current_user: User = Depends(get_current_active_user)
):
    """
    Proxy para consultar el API de datos.gov.co (SECOP II).
    Evita problemas de CORS haciendo la petición desde el servidor.
    ✅ Protecciones:
    - Autenticación requerida
    - Rate limiting: 100 req/hora
    - Caching: 1 hora
    """
    try:
        # Generar clave de caché
        cache_key = f"datos_gov:{query}"
        
        # Intentar obtener del caché
        cached_data = cache_manager.get(cache_key)
        if cached_data:
            logger.info(f"📦 Datos.gov proxy (cached) - Usuario: {current_user.email}")
            return cached_data
        
        params = {}
        if query:
            params["$query"] = query
        
        # Construir URL completa
        url = DATOS_GOV_BASE_URL
        if params:
            url = f"{url}?{urlencode(params)}"
        
        # Hacer petición al API externo
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(url)
            response.raise_for_status()
            
            data = response.json()
            
            # Cachear resultado (1 hora)
            cache_manager.set(cache_key, data, ttl_seconds=3600)
            
            logger.info(f"✅ Datos.gov proxy (fresh) - Usuario: {current_user.email}")
            return data
            
    except httpx.HTTPStatusError as e:
        logger.error(f"❌ HTTP Error {e.response.status_code} - Usuario: {current_user.email}")
        raise HTTPException(
            status_code=e.response.status_code,
            detail=f"Error al consultar datos.gov.co: {e.response.text}"
        )
    except httpx.TimeoutException:
        logger.error(f"❌ Timeout en datos.gov - Usuario: {current_user.email}")
        raise HTTPException(
            status_code=504,
            detail="Timeout al consultar datos.gov.co"
        )
    except Exception as e:
        logger.error(f"❌ Error: {str(e)} - Usuario: {current_user.email}")
        raise HTTPException(
            status_code=500,
            detail=f"Error interno: {str(e)}"
        )


@router.get("/proxy-secop1")
@limiter.limit(RATE_LIMITS["contratacion_proxy"])
async def proxy_datos_gov_secop1(
    request: Request,
    query: Optional[str] = Query(None, alias="$query"),
    current_user: User = Depends(get_current_active_user)
):
    """
    Proxy para consultar el API de datos.gov.co (SECOP I).
    Evita problemas de CORS haciendo la petición desde el servidor.
    ✅ Protecciones:
    - Autenticación requerida
    - Rate limiting: 100 req/hora
    - Caching: 1 hora
    """
    try:
        # Generar clave de caché
        cache_key = f"datos_gov_secop1:{query}"
        
        # Intentar obtener del caché
        cached_data = cache_manager.get(cache_key)
        if cached_data:
            logger.info(f"📦 Datos.gov SECOP I proxy (cached) - Usuario: {current_user.email}")
            return cached_data
        
        params = {}
        if query:
            params["$query"] = query
        
        # Construir URL completa
        url = DATOS_GOV_SECOP1_URL
        if params:
            url = f"{url}?{urlencode(params)}"
        
        # Hacer petición al API externo
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(url)
            response.raise_for_status()
            
            data = response.json()
            
            # Cachear resultado (1 hora)
            cache_manager.set(cache_key, data, ttl_seconds=3600)
            
            logger.info(f"✅ Datos.gov SECOP I proxy (fresh) - Usuario: {current_user.email}")
            return data
            
    except httpx.HTTPStatusError as e:
        logger.error(f"❌ HTTP Error {e.response.status_code} - Usuario: {current_user.email}")
        raise HTTPException(
            status_code=e.response.status_code,
            detail=f"Error al consultar datos.gov.co SECOP I: {e.response.text}"
        )
    except httpx.TimeoutException:
        logger.error(f"❌ Timeout en datos.gov SECOP I - Usuario: {current_user.email}")
        raise HTTPException(
            status_code=504,
            detail="Timeout al consultar datos.gov.co SECOP I"
        )
    except Exception as e:
        logger.error(f"❌ Error: {str(e)} - Usuario: {current_user.email}")
        raise HTTPException(
            status_code=500,
            detail=f"Error interno: {str(e)}"
        )


@router.get("/proxy-secop2-procesos")
@limiter.limit(RATE_LIMITS["contratacion_proxy"])
async def proxy_datos_gov_secop2_procesos(
    request: Request,
    query: Optional[str] = Query(None, alias="$query"),
    current_user: User = Depends(get_current_active_user)
):
    """
    Proxy para consultar procesos SECOP II SIN contrato (dataset p6dx-8zbt).
    Complementa el dataset principal de contratos.
    ✅ Protecciones:
    - Autenticación requerida
    - Rate limiting: 100 req/hora
    - Caching: 1 hora
    """
    try:
        # Generar clave de caché
        cache_key = f"datos_gov_secop2_procesos:{query}"
        
        # Intentar obtener del caché
        cached_data = cache_manager.get(cache_key)
        if cached_data:
            logger.info(f"📦 Datos.gov SECOP II Procesos proxy (cached) - Usuario: {current_user.email}")
            return cached_data
        
        params = {}
        if query:
            params["$query"] = query
        
        # Construir URL completa
        url = DATOS_GOV_PROCESOS_URL
        if params:
            url = f"{url}?{urlencode(params)}"
        
        # Hacer petición al API externo
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(url)
            response.raise_for_status()
            
            data = response.json()
            
            # Cachear resultado (1 hora)
            cache_manager.set(cache_key, data, ttl_seconds=3600)
            
            logger.info(f"✅ Datos.gov SECOP II Procesos proxy (fresh) - Usuario: {current_user.email}")
            return data
            
    except httpx.HTTPStatusError as e:
        logger.error(f"❌ HTTP Error {e.response.status_code} - Usuario: {current_user.email}")
        raise HTTPException(
            status_code=e.response.status_code,
            detail=f"Error al consultar datos.gov.co SECOP II Procesos: {e.response.text}"
        )
    except httpx.TimeoutException:
        logger.error(f"❌ Timeout en datos.gov SECOP II Procesos - Usuario: {current_user.email}")
        raise HTTPException(
            status_code=504,
            detail="Timeout al consultar datos.gov.co SECOP II Procesos"
        )
    except Exception as e:
        logger.error(f"❌ Error: {str(e)} - Usuario: {current_user.email}")
        raise HTTPException(
            status_code=500,
            detail=f"Error interno: {str(e)}"
        )


# ==== Resumen con IA ====

class Periodo(BaseModel):
    desde: Optional[str] = None
    hasta: Optional[str] = None


class KPIs(BaseModel):
    totalProcesos: int
    totalAdjudicados: int
    tasaAdjudicacion: float
    sumaAdjudicado: float
    promedioPrecioBase: float


class ResumenRequest(BaseModel):
    entity_name: Optional[str] = None
    nit: Optional[str] = None
    periodo: Optional[Periodo] = None
    kpis: KPIs
    distribuciones: Optional[Dict[str, Dict[str, int]]] = None  # { estados, modalidades, tiposContrato }
    top_proveedores: Optional[List[Dict[str, Any]]] = None  # [{ nombre, valor }]
    notas: Optional[str] = None


@router.post("/summary")
@limiter.limit(RATE_LIMITS["contratacion_summary"])
async def resumen_con_ia(
    request: Request,
    payload: ResumenRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Genera un resumen ejecutivo del módulo de contratación.
    ✅ Protecciones:
    - Autenticación requerida
    - Rate limiting: 20 req/hora (restrictivo por OpenAI API)
    - Logging de costos de API
    - Caching: 30 minutos
    
    Body esperado:
    {
      entity_name, nit, periodo: {desde, hasta},
      kpis: { totalProcesos, totalAdjudicados, tasaAdjudicacion, sumaAdjudicado, promedioPrecioBase },
      distribuciones: { estados: {...}, modalidades: {...}, tiposContrato: {...} },
      top_proveedores: [{ nombre, valor }],
      notas
    }
    """
    # Si no hay datos
    if payload.kpis.totalProcesos == 0:
        return {
            "configured": bool(settings.openai_api_key),
            "summary": "No se encontraron procesos en el periodo seleccionado. Verifique el NIT y el rango de fechas."
        }

    # Resumen base heurístico
    k = payload.kpis
    periodo_txt = ""
    if payload.periodo and (payload.periodo.desde or payload.periodo.hasta):
        periodo_txt = f"Periodo: {payload.periodo.desde or 'N/D'} a {payload.periodo.hasta or 'N/D'}. "
    base_summary = (
        f"Entidad: {payload.entity_name or 'N/D'} (NIT {payload.nit or 'N/D'}). "
        f"{periodo_txt}Se analizaron {k.totalProcesos} procesos. "
        f"Adjudicados: {k.totalAdjudicados} ({round(k.tasaAdjudicacion*100,1)}%). "
        f"Total adjudicado: ${round(k.sumaAdjudicado):,}. "
        f"Precio base promedio: ${round(k.promedioPrecioBase):,}."
    )

    # Top proveedores (si disponible)
    if payload.top_proveedores:
        top = payload.top_proveedores[:5]
        prov_txt = ", ".join([f"{p.get('nombre','N/D')} (${round(float(p.get('valor',0))):,})" for p in top])
        base_summary += f" Principales proveedores por valor adjudicado: {prov_txt}."

    # Distribuciones
    if payload.distribuciones and payload.distribuciones.get("estados"):
        estados = payload.distribuciones["estados"]
        # Estado más frecuente
        top_estado = max(estados.items(), key=lambda x: x[1]) if estados else None
        if top_estado:
            base_summary += f" Estado más frecuente: {top_estado[0]} ({top_estado[1]} procesos)."

    # Si no hay API Key, devolver el heurístico
    if not settings.openai_api_key:
        logger.info(f"📋 Resumen sin IA - Usuario: {current_user.email}, Entidad: {payload.entity_name}")
        return {
            "configured": False,
            "summary": base_summary + " Nota: Para habilitar el resumen con IA, configure OPENAI_API_KEY en el backend."
        }

    # Llamada a OpenAI (opcional) - manejo defensivo si la librería no está instalada
    try:
        from openai import OpenAI  # type: ignore

        client = OpenAI(api_key=settings.openai_api_key)
        system = (
            "Eres un analista de compras públicas. Redacta un resumen ejecutivo claro, en español, "
            "con 2-3 párrafos y 3-5 bullet points de hallazgos y recomendaciones. Evita jerga innecesaria."
        )

        user_prompt = (
            "Genera un informe ejecutivo de contratación pública con los siguientes datos en JSON. "
            "Enfatiza tendencias, riesgos (p. ej. concentración de proveedores, procesos desiertos) y oportunidades.\n\n"
            f"Datos: {payload.model_dump()}\n\n"
            f"Resumen base: {base_summary}"
        )

        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            temperature=0.3,
            max_tokens=500,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user_prompt}
            ],
        )
        
        content = resp.choices[0].message.content if resp and resp.choices else base_summary
        
        # 📊 LOGGING DE COSTOS
        if resp and resp.usage:
            cost_data = CostAnalyzer.calculate_cost(
                model="gpt-4o-mini",
                prompt_tokens=resp.usage.prompt_tokens,
                completion_tokens=resp.usage.completion_tokens
            )
            
            openai_logger.log_api_call(
                user_id=current_user.email,
                entity_name=payload.entity_name,
                model="gpt-4o-mini",
                prompt_tokens=resp.usage.prompt_tokens,
                completion_tokens=resp.usage.completion_tokens,
                total_tokens=resp.usage.total_tokens,
                cost_usd=cost_data["total_cost"],
                status="success"
            )
            
            logger.info(
                f"💰 OpenAI API - Usuario: {current_user.email} | "
                f"Tokens: {resp.usage.total_tokens} | "
                f"Costo: ${cost_data['total_cost']:.6f}"
            )
        
        return {"configured": True, "summary": content or base_summary}

    except Exception as e:
        # Registrar error
        openai_logger.log_error(
            user_id=current_user.email,
            error_message=str(e),
            error_type=type(e).__name__
        )
        logger.error(f"❌ OpenAI API Error - Usuario: {current_user.email} - {str(e)}")
        
        # Si falla la IA, devolver el heurístico
        return {
            "configured": True,
            "summary": base_summary + f" (Nota: IA no disponible temporalmente: {str(e)})"
        }
