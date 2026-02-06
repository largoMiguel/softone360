"""
Endpoint temporal para obtener estadísticas de migración
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.config.database import get_db

router = APIRouter(prefix="/api/admin/migrations", tags=["Admin Migrations Stats"])


@router.get("/stats")
async def get_migration_stats(db: Session = Depends(get_db)):
    """
    Obtiene estadísticas de evidencias para la migración S3
    """
    try:
        # Total de evidencias
        total_result = db.execute(text("""
            SELECT COUNT(*) as total
            FROM pdm_actividades_evidencias
        """))
        total = total_result.scalar()
        
        # Con imágenes en Base64
        con_imagenes_result = db.execute(text("""
            SELECT COUNT(*) as total
            FROM pdm_actividades_evidencias
            WHERE imagenes IS NOT NULL 
            AND jsonb_array_length(imagenes::jsonb) > 0
        """))
        con_imagenes = con_imagenes_result.scalar()
        
        # Ya migradas a S3
        migradas_result = db.execute(text("""
            SELECT COUNT(*) as total
            FROM pdm_actividades_evidencias
            WHERE migrated_to_s3 = TRUE
        """))
        migradas = migradas_result.scalar()
        
        # Pendientes de migrar
        pendientes_result = db.execute(text("""
            SELECT COUNT(*) as total
            FROM pdm_actividades_evidencias
            WHERE (migrated_to_s3 IS NULL OR migrated_to_s3 = FALSE)
            AND imagenes IS NOT NULL 
            AND jsonb_array_length(imagenes::jsonb) > 0
        """))
        pendientes = pendientes_result.scalar()
        
        # Sin imágenes
        sin_imagenes = total - con_imagenes
        
        # Obtener muestra de pendientes
        muestra_result = db.execute(text("""
            SELECT id, entity_id, actividad_id, 
                   jsonb_array_length(imagenes::jsonb) as num_imagenes,
                   migrated_to_s3,
                   created_at
            FROM pdm_actividades_evidencias
            WHERE (migrated_to_s3 IS NULL OR migrated_to_s3 = FALSE)
            AND imagenes IS NOT NULL 
            AND jsonb_array_length(imagenes::jsonb) > 0
            LIMIT 10
        """))
        
        muestra = [
            {
                "id": row[0],
                "entity_id": row[1],
                "actividad_id": row[2],
                "num_imagenes": row[3],
                "migrated_to_s3": row[4],
                "created_at": str(row[5]) if row[5] else None
            }
            for row in muestra_result
        ]
        
        return {
            "status": "success",
            "estadisticas": {
                "total_evidencias": total,
                "con_imagenes_base64": con_imagenes,
                "sin_imagenes": sin_imagenes,
                "migradas_a_s3": migradas,
                "pendientes_migracion": pendientes
            },
            "muestra_pendientes": muestra
        }
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {
            "status": "error",
            "error": str(e)
        }


@router.get("/evidencia/{evidencia_id}")
async def get_evidencia_debug(evidencia_id: int, db: Session = Depends(get_db)):
    """
    Obtiene detalle completo de una evidencia para debug
    """
    try:
        from app.models.pdm import PdmActividadEvidencia
        
        evidencia = db.query(PdmActividadEvidencia).filter(
            PdmActividadEvidencia.id == evidencia_id
        ).first()
        
        if not evidencia:
            return {"error": "No encontrada"}
        
        # Convertir a dict para ver todos los campos
        return {
            "id": evidencia.id,
            "actividad_id": evidencia.actividad_id,
            "entity_id": evidencia.entity_id,
            "tiene_imagenes_base64": evidencia.imagenes is not None and len(evidencia.imagenes) > 0 if isinstance(evidencia.imagenes, list) else False,
            "num_imagenes_base64": len(evidencia.imagenes) if evidencia.imagenes and isinstance(evidencia.imagenes, list) else 0,
            "tiene_urls_s3": evidencia.imagenes_s3_urls is not None and len(evidencia.imagenes_s3_urls) > 0 if hasattr(evidencia, 'imagenes_s3_urls') and evidencia.imagenes_s3_urls else False,
            "num_urls_s3": len(evidencia.imagenes_s3_urls) if hasattr(evidencia, 'imagenes_s3_urls') and evidencia.imagenes_s3_urls else 0,
            "migrated_to_s3": evidencia.migrated_to_s3 if hasattr(evidencia, 'migrated_to_s3') else None,
            "imagenes_s3_urls": evidencia.imagenes_s3_urls if hasattr(evidencia, 'imagenes_s3_urls') else None,
            "descripcion": evidencia.descripcion[:100] if evidencia.descripcion else None
        }
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {
            "status": "error",
            "error": str(e)
        }
