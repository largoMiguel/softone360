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


@router.get("/informes/status")
async def debug_informes_status(db: Session = Depends(get_db)):
    """
    Muestra el estado de todos los informes en la base de datos
    """
    try:
        from app.models.informe import InformeEstado
        
        informes = db.query(InformeEstado).order_by(InformeEstado.created_at.desc()).all()
        
        return {
            "total": len(informes),
            "por_estado": {
                "pending": len([i for i in informes if i.estado == 'pending']),
                "processing": len([i for i in informes if i.estado == 'processing']),
                "completed": len([i for i in informes if i.estado == 'completed']),
                "failed": len([i for i in informes if i.estado == 'failed'])
            },
            "informes": [
                {
                    "id": inf.id,
                    "estado": inf.estado,
                    "anio": inf.anio,
                    "formato": inf.formato,
                    "user_id": inf.user_id,
                    "created_at": inf.created_at.isoformat() if inf.created_at else None,
                    "completed_at": inf.completed_at.isoformat() if inf.completed_at else None,
                    "s3_url": inf.s3_url[:80] + "..." if inf.s3_url and len(inf.s3_url) > 80 else inf.s3_url,
                    "error_message": inf.error_message[:100] + "..." if inf.error_message and len(inf.error_message) > 100 else inf.error_message
                }
                for inf in informes
            ]
        }
    except Exception as e:
        import traceback
        return {
            "error": str(e),
            "traceback": traceback.format_exc()
        }


@router.delete("/informes/cleanup")
async def cleanup_informes(
    estado: str = None,  # pending, processing, failed, completed, o None para todos
    db: Session = Depends(get_db)
):
    """
    Limpia informes de la base de datos.
    
    Parámetros:
    - estado: Si se especifica, solo elimina informes en ese estado
    - Si no se especifica, elimina TODOS los informes
    
    Ejemplos:
    - /api/admin/debug/informes/cleanup?estado=failed
    - /api/admin/debug/informes/cleanup?estado=pending
    - /api/admin/debug/informes/cleanup (elimina TODOS)
    """
    try:
        from app.models.informe import InformeEstado
        
        # Contar antes de eliminar
        if estado:
            antes = db.query(InformeEstado).filter(InformeEstado.estado == estado).count()
            db.query(InformeEstado).filter(InformeEstado.estado == estado).delete()
        else:
            antes = db.query(InformeEstado).count()
            db.query(InformeEstado).delete()
        
        db.commit()
        
        return {
            "success": True,
            "eliminados": antes,
            "filtro": estado if estado else "todos",
            "mensaje": f"Se eliminaron {antes} informes" + (f" en estado '{estado}'" if estado else "")
        }
        
    except Exception as e:
        db.rollback()
        import traceback
        return {
            "success": False,
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
