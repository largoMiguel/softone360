#!/usr/bin/env python3
"""
Script para corregir Content-Type de imágenes en S3
Cambia de image/jpg a image/jpeg
"""
import boto3
import sys

def fix_content_types():
    s3 = boto3.client('s3', region_name='us-east-1')
    bucket = 'softone-pdm-evidencias'
    
    print("🔍 Listando objetos en bucket...")
    paginator = s3.get_paginator('list_objects_v2')
    
    fixed_count = 0
    error_count = 0
    
    for page in paginator.paginate(Bucket=bucket):
        if 'Contents' not in page:
            continue
            
        for obj in page['Contents']:
            key = obj['Key']
            
            # Solo procesar .jpg
            if not key.endswith('.jpg'):
                continue
            
            try:
                # Obtener metadata actual
                response = s3.head_object(Bucket=bucket, Key=key)
                current_type = response.get('ContentType', '')
                
                if current_type == 'image/jpg':
                    print(f"🔧 Corrigiendo: {key}")
                    
                    # Copiar el objeto sobre sí mismo con nuevo Content-Type
                    s3.copy_object(
                        Bucket=bucket,
                        CopySource={'Bucket': bucket, 'Key': key},
                        Key=key,
                        ContentType='image/jpeg',
                        MetadataDirective='REPLACE',
                        CacheControl='max-age=31536000',
                        ServerSideEncryption='AES256'
                    )
                    fixed_count += 1
                    
                elif current_type == 'image/jpeg':
                    print(f"✅ OK: {key}")
                else:
                    print(f"⚠️  Tipo inesperado {current_type}: {key}")
                    
            except Exception as e:
                print(f"❌ Error con {key}: {e}")
                error_count += 1
    
    print(f"\n📊 Resumen:")
    print(f"   Corregidos: {fixed_count}")
    print(f"   Errores: {error_count}")
    
    return fixed_count > 0

if __name__ == '__main__':
    success = fix_content_types()
    sys.exit(0 if success else 1)
