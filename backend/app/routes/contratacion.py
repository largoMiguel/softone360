from fastapi import APIRouter, Query, HTTPException
from typing import Optional, Dict, Any, List
from pydantic import BaseModel
from app.config.settings import settings
import httpx
from urllib.parse import urlencode

router = APIRouter(prefix="/contratacion", tags=["Contratación"])

# Dataset de contratos (jbjy-vk9h)
DATOS_GOV_BASE_URL = "https://www.datos.gov.co/resource/jbjy-vk9h.json"


@router.get("/proxy")
async def proxy_datos_gov(query: Optional[str] = Query(None, alias="$query")):
    """
    Proxy para consultar el API de datos.gov.co (SECOP II).
    Evita problemas de CORS haciendo la petición desde el servidor.
    """
    try:
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
            
            # Retornar la respuesta JSON
            return response.json()
            
    except httpx.HTTPStatusError as e:
        raise HTTPException(
            status_code=e.response.status_code,
            detail=f"Error al consultar datos.gov.co: {e.response.text}"
        )
    except httpx.TimeoutException:
        raise HTTPException(
            status_code=504,
            detail="Timeout al consultar datos.gov.co"
        )
    except Exception as e:
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
async def resumen_con_ia(payload: ResumenRequest):
    """Genera un resumen ejecutivo del módulo de contratación. Si hay OPENAI_API_KEY, usa IA; si no, devuelve un resumen heurístico.

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
        return {"configured": True, "summary": content or base_summary}

    except Exception as e:
        # Si falla la IA, devolver el heurístico
        return {
            "configured": True,
            "summary": base_summary + f" (Nota: IA no disponible temporalmente: {str(e)})"
        }
