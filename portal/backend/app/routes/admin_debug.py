"""
Endpoint de diagnóstico para investigar productos específicos
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
import json

from app.config.database import get_db

router = APIRouter(prefix="/api/admin/debug", tags=["Debug"])


@router.get("/producto/{codigo_producto}")
async def debug_producto(codigo_producto: str, db: Session = Depends(get_db)):
    """
    Investiga un producto y sus evidencias en detalle
    """
    try:
        from app.models.pdm import PdmActividad, PdmActividadEvidencia
        
        # Buscar actividades
        actividades = db.query(PdmActividad).filter(
            PdmActividad.codigo_producto == codigo_producto
        ).all()
        
        resultado = {
            "codigo_producto": codigo_producto,
            "total_actividades": len(actividades),
            "actividades": []
        }
        
        for act in actividades:
            # Buscar evidencia
            evidencia = db.query(PdmActividadEvidencia).filter(
                PdmActividadEvidencia.actividad_id == act.id
            ).first()
            
            act_info = {
                "id": act.id,
                "nombre": act.nombre,
                "anio": act.anio,
                "estado": act.estado,
                "tiene_evidencia": evidencia is not None
            }
            
            if evidencia:
                # Analizar estado de la evidencia
                tiene_base64 = evidencia.imagenes is not None and len(evidencia.imagenes) > 0 if isinstance(evidencia.imagenes, list) else False
                tiene_s3 = evidencia.imagenes_s3_urls is not None and len(evidencia.imagenes_s3_urls) > 0 if hasattr(evidencia, 'imagenes_s3_urls') and evidencia.imagenes_s3_urls else False
                
                act_info["evidencia"] = {
                    "id": evidencia.id,
                    "tiene_imagenes_base64": tiene_base64,
                    "num_imagenes_base64": len(evidencia.imagenes) if evidencia.imagenes and isinstance(evidencia.imagenes, list) else 0,
                    "tiene_urls_s3": tiene_s3,
                    "num_urls_s3": len(evidencia.imagenes_s3_urls) if hasattr(evidencia, 'imagenes_s3_urls') and evidencia.imagenes_s3_urls else 0,
                    "migrated_to_s3": evidencia.migrated_to_s3 if hasattr(evidencia, 'migrated_to_s3') else None,
                    "fecha_registro": str(evidencia.fecha_registro) if evidencia.fecha_registro else None,
                    "urls_s3": evidencia.imagenes_s3_urls if hasattr(evidencia, 'imagenes_s3_urls') and evidencia.imagenes_s3_urls else [],
                    "descripcion": evidencia.descripcion[:100] if evidencia.descripcion else None
                }
            
            resultado["actividades"].append(act_info)
        
        return resultado
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {
            "error": str(e),
            "traceback": traceback.format_exc()
        }


@router.get("/evidencia-raw/{actividad_id}")
async def debug_evidencia_raw(actividad_id: int, db: Session = Depends(get_db)):
    """
    Devuelve la evidencia RAW tal como la devuelve el endpoint principal
    (simula lo que obtiene el frontend)
    """
    try:
        from app.models.pdm import PdmActividadEvidencia
        from app.schemas import pdm_v2 as schemas
        
        evidencia = db.query(PdmActividadEvidencia).filter(
            PdmActividadEvidencia.actividad_id == actividad_id
        ).first()
        
        if not evidencia:
            return {"error": "No encontrada"}
        
        # Simular lo que hace el endpoint get_evidencia
        if evidencia.migrated_to_s3 and evidencia.imagenes_s3_urls:
            evidencia_dict = schemas.EvidenciaResponse.model_validate(evidencia).model_dump()
            evidencia_dict['imagenes'] = []  # Limpiar Base64
            response = schemas.EvidenciaResponse(**evidencia_dict)
        else:
            response = schemas.EvidenciaResponse.model_validate(evidencia)
        
        # Convertir a dict para ver
        result = response.model_dump()
        
        # Agregar metadatos de debug
        return {
            "debug_info": {
                "actividad_id": actividad_id,
                "evidencia_id": evidencia.id,
                "tiene_base64_en_db": evidencia.imagenes is not None and len(evidencia.imagenes) > 0 if isinstance(evidencia.imagenes, list) else False,
                "tiene_s3_en_db": evidencia.imagenes_s3_urls is not None and len(evidencia.imagenes_s3_urls) > 0 if evidencia.imagenes_s3_urls else False,
                "migrated_to_s3_en_db": evidencia.migrated_to_s3 if hasattr(evidencia, 'migrated_to_s3') else None,
            },
            "response_seria": result,
            "test_frontend": {
                "tiene_imagenes_base64": len(result.get('imagenes', [])) > 0,
                "num_imagenes_base64": len(result.get('imagenes', [])),
                "tiene_urls_s3": len(result.get('imagenes_s3_urls', [])) > 0,
                "num_urls_s3": len(result.get('imagenes_s3_urls', [])),
                "que_deberia_mostrar": "S3" if len(result.get('imagenes_s3_urls', [])) > 0 else "Base64" if len(result.get('imagenes', [])) > 0 else "NADA"
            }
        }
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {
            "error": str(e),
            "traceback": traceback.format_exc()
        }
