#!/usr/bin/env python3
"""
Script para re-subir imágenes S3 limpiando correctamente el Base64
"""
import boto3
import base64
import uuid
import sys
import os

# Configurar path para importar módulos de la app
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

DATABASE_URL = os.getenv('DATABASE_URL', 'postgresql://dbadmin:TuPassSeguro123!@softone-db.ccvomgoayzyt.us-east-1.rds.amazonaws.com:5432/postgres')

engine = create_engine(DATABASE_URL)
Session = sessionmaker(bind=engine)

S3_BUCKET = 'softone-pdm-evidencias'
S3_REGION = 'us-east-1'

def limpiar_base64(imagen_str):
    """
    Limpia el string Base64 removiendo prefijos y espacios
    """
    # Remover prefijos comunes
    if imagen_str.startswith('data:image'):
        # Formato: data:image/jpeg;base64,/9j/4AAQ...
        if ';base64,' in imagen_str:
            imagen_str = imagen_str.split(';base64,')[1]
    
    # Remover espacios y saltos de línea
    imagen_str = imagen_str.strip().replace('\n', '').replace('\r', '').replace(' ', '')
    
    return imagen_str

def re_migrar_imagenes():
    db = Session()
    s3_client = boto3.client('s3', region_name=S3_REGION)
    
    try:
        # Obtener evidencias migradas
        result = db.execute("""
            SELECT id, entity_id, imagenes, imagenes_s3_urls
            FROM pdm_actividad_evidencia
            WHERE migrated_to_s3 = true AND imagenes IS NOT NULL
        """)
        
        evidencias = result.fetchall()
        print(f"📋 Encontradas {len(evidencias)} evidencias migradas")
        
        for evidencia in evidencias:
            evidencia_id, entity_id, imagenes, s3_urls_actuales = evidencia
            
            if not imagenes or len(imagenes) == 0:
                continue
            
            print(f"\n🔄 Procesando evidencia {evidencia_id}...")
            
            # Procesar cada imagen
            for idx, imagen_base64 in enumerate(imagenes):
                if not imagen_base64 or len(imagen_base64) < 100:
                    continue
                
                try:
                    # LIMPIAR Base64
                    imagen_limpia = limpiar_base64(imagen_base64)
                    
                    # Decodificar
                    imagen_data = base64.b64decode(imagen_limpia)
                    
                    # Verificar que sea JPEG válido (debe empezar con FF D8 FF)
                    if not imagen_data.startswith(b'\xff\xd8\xff'):
                        print(f"  ⚠️  Imagen {idx} no empieza con FF D8 FF (primeros bytes: {imagen_data[:10].hex()})")
                        continue
                    
                    # Detectar extensión
                    extension = 'jpg'
                    if imagen_limpia.startswith('/9j/'):
                        extension = 'jpg'
                    elif imagen_limpia.startswith('iVBORw0KGgo'):
                        extension = 'png'
                    
                    # Usar el mismo key que ya existe
                    if s3_urls_actuales and idx < len(s3_urls_actuales):
                        url_actual = s3_urls_actuales[idx]
                        s3_key = url_actual.split('.amazonaws.com/')[1]
                    else:
                        unique_id = str(uuid.uuid4())[:8]
                        s3_key = f"entity_{entity_id}/evidencia_{evidencia_id}/imagen_{idx}_{unique_id}.{extension}"
                    
                    # RE-SUBIR a S3 con datos limpios
                    s3_client.put_object(
                        Bucket=S3_BUCKET,
                        Key=s3_key,
                        Body=imagen_data,
                        ContentType='image/jpeg',
                        CacheControl='max-age=31536000',
                        ServerSideEncryption='AES256'
                    )
                    
                    print(f"  ✅ Re-subida imagen {idx}: {s3_key} ({len(imagen_data)} bytes)")
                    
                except Exception as e:
                    print(f"  ❌ Error con imagen {idx}: {e}")
                    continue
        
        print(f"\n✅ Re-migración completada")
        
    finally:
        db.close()

if __name__ == '__main__':
    re_migrar_imagenes()
