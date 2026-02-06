"""
Endpoint temporal para ejecutar migraciones S3 desde el backend
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
import traceback

from app.config.database import get_db

router = APIRouter(prefix="/api/admin/migrations", tags=["Admin Migrations"])


@router.post("/add-s3-columns")
async def add_s3_columns(
    db: Session = Depends(get_db)
):
    """
    Agrega columnas S3 a la tabla pdm_actividades_evidencias
    IMPORTANTE: Solo ejecutar UNA VEZ
    """
    try:
        print("🔧 Agregando columnas S3...")
        
        # Agregar columna imagenes_s3_urls
        try:
            db.execute(text("""
                ALTER TABLE pdm_actividades_evidencias 
                ADD COLUMN IF NOT EXISTS imagenes_s3_urls JSON
            """))
            db.commit()
            print("   ✅ imagenes_s3_urls agregada")
        except Exception as e:
            print(f"   ⚠️ imagenes_s3_urls: {e}")
            db.rollback()
        
        # Agregar columna migrated_to_s3
        try:
            db.execute(text("""
                ALTER TABLE pdm_actividades_evidencias 
                ADD COLUMN IF NOT EXISTS migrated_to_s3 BOOLEAN DEFAULT FALSE
            """))
            db.commit()
            print("   ✅ migrated_to_s3 agregada")
        except Exception as e:
            print(f"   ⚠️ migrated_to_s3: {e}")
            db.rollback()
        
        # Verificar columnas
        result = db.execute(text("""
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'pdm_actividades_evidencias'
            AND column_name IN ('imagenes_s3_urls', 'migrated_to_s3')
            ORDER BY column_name
        """))
        
        columnas = [{"nombre": row[0], "tipo": row[1]} for row in result]
        
        return {
            "status": "success",
            "message": "Columnas S3 agregadas exitosamente",
            "columnas": columnas
        }
        
    except Exception as e:
        print(f"❌ Error: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/migrate-images-to-s3")
async def migrate_images_to_s3(
    batch_size: int = 50,
    db: Session = Depends(get_db)
):
    """
    Migra imágenes Base64 de evidencias a S3
    """
    try:
        import boto3
        import base64
        import uuid
        from app.models.pdm import PdmActividadEvidencia
        
        S3_BUCKET = 'softone-pdm-evidencias'
        S3_REGION = 'us-east-1'
        
        print(f"🚀 Iniciando migración de imágenes a S3...")
        
        # Obtener evidencias pendientes de migrar
        # Usar text() para comparar JSON correctamente
        evidencias_pendientes = db.query(PdmActividadEvidencia).filter(
            text("migrated_to_s3 IS NOT TRUE"),
            text("imagenes IS NOT NULL"),
            text("jsonb_array_length(imagenes::jsonb) > 0")
        ).limit(batch_size).all()
        
        total_procesadas = 0
        total_migradas = 0
        errores = []
        
        s3_client = boto3.client('s3', region_name=S3_REGION)
        
        for evidencia in evidencias_pendientes:
            try:
                imagenes = evidencia.imagenes
                if not imagenes or not isinstance(imagenes, list) or len(imagenes) == 0:
                    continue
                
                s3_urls = []
                for idx, imagen_base64 in enumerate(imagenes):
                    if not imagen_base64 or len(imagen_base64) < 100:
                        continue
                    
                    # Decodificar Base64
                    imagen_data = base64.b64decode(imagen_base64)
                    
                    # Detectar extensión
                    extension = 'jpg'
                    if imagen_base64.startswith('/9j/'):
                        extension = 'jpg'
                    elif imagen_base64.startswith('iVBORw0KGgo'):
                        extension = 'png'
                    
                    # Generar key S3
                    unique_id = str(uuid.uuid4())[:8]
                    s3_key = f"entity_{evidencia.entity_id}/evidencia_{evidencia.id}/imagen_{idx}_{unique_id}.{extension}"
                    
                    # Subir a S3
                    s3_client.put_object(
                        Bucket=S3_BUCKET,
                        Key=s3_key,
                        Body=imagen_data,
                        ContentType=f'image/{extension}',
                        CacheControl='max-age=31536000'
                    )
                    
                    url = f"https://{S3_BUCKET}.s3.{S3_REGION}.amazonaws.com/{s3_key}"
                    s3_urls.append(url)
                
                if s3_urls:
                    # Actualizar evidencia
                    db.execute(text("""
                        UPDATE pdm_actividades_evidencias 
                        SET imagenes_s3_urls = :urls::jsonb,
                            migrated_to_s3 = TRUE
                        WHERE id = :evidencia_id
                    """), {"urls": str(s3_urls).replace("'", '"'), "evidencia_id": evidencia.id})
                    
                    total_migradas += 1
                
                total_procesadas += 1
                
            except Exception as e:
                errores.append({
                    "evidencia_id": evidencia.id,
                    "error": str(e)
                })
        
        db.commit()
        
        return {
            "status": "success",
            "total_procesadas": total_procesadas,
            "total_migradas": total_migradas,
            "errores": errores,
            "batch_size": batch_size
        }
        
    except Exception as e:
        print(f"❌ Error: {e}")
        traceback.print_exc()
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
