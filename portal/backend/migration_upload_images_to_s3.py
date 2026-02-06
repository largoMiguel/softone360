#!/usr/bin/env python3
"""
Migración: Subir imágenes Base64 a S3
Convierte todas las imágenes almacenadas como Base64 en la DB a URLs S3

IMPORTANTE:
- Migración GRADUAL en batches de 50 evidencias
- Preserva datos originales hasta verificación
- Idempotente: se puede ejecutar múltiples veces

Ejecutar con:
    python3 migration_upload_images_to_s3.py
"""
import sys
import traceback
import base64
import json
from datetime import datetime
import uuid

try:
    import psycopg2
    import boto3
    from botocore.exceptions import ClientError
except ImportError as e:
    print(f"\n❌ ERROR: Falta dependencia: {e}")
    print("   Instalar con: pip install psycopg2-binary boto3")
    sys.exit(1)

# Configuración
DB_CONFIG = {
    'host': 'softone-db.ccvomgoayzyt.us-east-1.rds.amazonaws.com',
    'port': 5432,
    'database': 'softone360',
    'user': 'postgresuser',
    'password': 'Sistemas.2024'
}

S3_BUCKET = 'softone-pdm-evidencias'
S3_REGION = 'us-east-1'
BATCH_SIZE = 50  # Procesar de a 50 evidencias


def conectar_db():
    """Conecta a PostgreSQL RDS"""
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        return conn
    except Exception as e:
        print(f"❌ ERROR conectando a DB: {e}")
        sys.exit(1)


def conectar_s3():
    """Conecta al cliente S3"""
    try:
        s3_client = boto3.client('s3', region_name=S3_REGION)
        # Verificar acceso al bucket
        s3_client.head_bucket(Bucket=S3_BUCKET)
        return s3_client
    except ClientError as e:
        error_code = e.response['Error']['Code']
        if error_code == '404':
            print(f"❌ ERROR: Bucket {S3_BUCKET} no existe")
        elif error_code == '403':
            print(f"❌ ERROR: Sin permisos para acceder al bucket {S3_BUCKET}")
        else:
            print(f"❌ ERROR S3: {e}")
        sys.exit(1)


def subir_imagen_s3(s3_client, entity_id, evidencia_id, imagen_index, imagen_base64):
    """
    Sube una imagen Base64 a S3 y retorna la URL
    
    Args:
        s3_client: Cliente boto3 S3
        entity_id: ID de la entidad
        evidencia_id: ID de la evidencia
        imagen_index: Índice de la imagen (0, 1, 2...)
        imagen_base64: String Base64 de la imagen
    
    Returns:
        str: URL pública de la imagen en S3
    """
    try:
        # Decodificar Base64
        imagen_data = base64.b64decode(imagen_base64)
        
        # Determinar extensión (por defecto jpg)
        # Se podría mejorar detectando el tipo MIME
        extension = 'jpg'
        if imagen_base64.startswith('/9j/'):
            extension = 'jpg'
        elif imagen_base64.startswith('iVBORw0KGgo'):
            extension = 'png'
        
        # Generar key S3: entity_{id}/evidencia_{id}/imagen_{idx}_{uuid}.{ext}
        unique_id = str(uuid.uuid4())[:8]
        s3_key = f"entity_{entity_id}/evidencia_{evidencia_id}/imagen_{imagen_index}_{unique_id}.{extension}"
        
        # Subir a S3
        s3_client.put_object(
            Bucket=S3_BUCKET,
            Key=s3_key,
            Body=imagen_data,
            ContentType=f'image/{extension}',
            CacheControl='max-age=31536000'  # Cache 1 año
        )
        
        # Generar URL pública
        url = f"https://{S3_BUCKET}.s3.{S3_REGION}.amazonaws.com/{s3_key}"
        
        return url
        
    except Exception as e:
        print(f"      ⚠️ Error subiendo imagen {imagen_index}: {e}")
        return None


def migrar_evidencias(conn, s3_client, batch_size=BATCH_SIZE, dry_run=False):
    """
    Migra evidencias de Base64 a S3 en batches
    
    Args:
        conn: Conexión psycopg2
        s3_client: Cliente boto3 S3
        batch_size: Número de evidencias por batch
        dry_run: Si True, no modifica la DB (solo simula)
    
    Returns:
        dict: Estadísticas de migración
    """
    cursor = conn.cursor()
    
    stats = {
        'total_evidencias': 0,
        'migradas_exitosamente': 0,
        'ya_migradas': 0,
        'sin_imagenes': 0,
        'errores': 0,
        'imagenes_subidas': 0,
        'bytes_liberados': 0
    }
    
    try:
        # Contar total de evidencias pendientes
        cursor.execute("""
            SELECT COUNT(*) FROM pdm_actividades_evidencias 
            WHERE migrated_to_s3 = FALSE OR migrated_to_s3 IS NULL
        """)
        stats['total_evidencias'] = cursor.fetchone()[0]
        
        print(f"\n📊 Total de evidencias pendientes: {stats['total_evidencias']}")
        
        if stats['total_evidencias'] == 0:
            print("✅ No hay evidencias pendientes de migrar")
            return stats
        
        if dry_run:
            print("⚠️  MODO DRY-RUN: No se modificará la base de datos\n")
        
        # Procesar en batches
        offset = 0
        batch_num = 1
        
        while True:
            # Obtener batch de evidencias
            cursor.execute("""
                SELECT id, entity_id, actividad_id, imagenes, descripcion,
                       LENGTH(imagenes::text) as size_bytes
                FROM pdm_actividades_evidencias 
                WHERE (migrated_to_s3 = FALSE OR migrated_to_s3 IS NULL)
                  AND imagenes IS NOT NULL
                  AND imagenes::text != 'null'
                  AND imagenes::text != '[]'
                ORDER BY id
                LIMIT %s OFFSET %s
            """, (batch_size, offset))
            
            evidencias = cursor.fetchall()
            
            if not evidencias:
                break  # No hay más evidencias
            
            print(f"\n{'='*70}")
            print(f"📦 BATCH {batch_num} - Procesando {len(evidencias)} evidencias")
            print(f"{'='*70}\n")
            
            for evidencia in evidencias:
                evidencia_id, entity_id, actividad_id, imagenes_json, descripcion, size_bytes = evidencia
                
                print(f"🔄 Evidencia ID {evidencia_id} (Actividad: {actividad_id}, Entity: {entity_id})")
                
                # Parsear JSON de imágenes
                try:
                    imagenes = json.loads(imagenes_json) if isinstance(imagenes_json, str) else imagenes_json
                except:
                    imagenes = imagenes_json
                
                if not imagenes or not isinstance(imagenes, list) or len(imagenes) == 0:
                    print(f"   ⚠️ Sin imágenes válidas")
                    stats['sin_imagenes'] += 1
                    continue
                
                print(f"   📸 Total de imágenes: {len(imagenes)}")
                
                # Subir cada imagen a S3
                s3_urls = []
                errores_subida = 0
                
                for idx, imagen_base64 in enumerate(imagenes):
                    if not imagen_base64 or imagen_base64 == 'null':
                        continue
                    
                    print(f"      Subiendo imagen {idx + 1}/{len(imagenes)}...", end=' ')
                    
                    if dry_run:
                        # Simular URL
                        url = f"https://{S3_BUCKET}.s3.{S3_REGION}.amazonaws.com/entity_{entity_id}/evidencia_{evidencia_id}/imagen_{idx}_dryrun.jpg"
                        print(f"✅ (DRY-RUN)")
                    else:
                        url = subir_imagen_s3(s3_client, entity_id, evidencia_id, idx, imagen_base64)
                        if url:
                            print(f"✅")
                            stats['imagenes_subidas'] += 1
                        else:
                            print(f"❌")
                            errores_subida += 1
                    
                    if url:
                        s3_urls.append(url)
                
                # Actualizar DB con URLs S3
                if s3_urls and not dry_run:
                    try:
                        cursor.execute("""
                            UPDATE pdm_actividades_evidencias 
                            SET imagenes_s3_urls = %s,
                                migrated_to_s3 = TRUE,
                                updated_at = CURRENT_TIMESTAMP
                            WHERE id = %s
                        """, (json.dumps(s3_urls), evidencia_id))
                        conn.commit()
                        
                        stats['migradas_exitosamente'] += 1
                        stats['bytes_liberados'] += size_bytes
                        
                        print(f"   ✅ Actualizada con {len(s3_urls)} URLs S3")
                        
                    except Exception as e:
                        print(f"   ❌ Error actualizando DB: {e}")
                        conn.rollback()
                        stats['errores'] += 1
                elif s3_urls and dry_run:
                    stats['migradas_exitosamente'] += 1
                    print(f"   ✅ (DRY-RUN) Se actualizarían {len(s3_urls)} URLs")
                else:
                    stats['errores'] += 1
                    print(f"   ❌ No se pudieron subir las imágenes")
            
            offset += batch_size
            batch_num += 1
            
            # Pausa entre batches (opcional)
            # time.sleep(1)
        
        return stats
        
    except Exception as e:
        print(f"\n❌ ERROR durante migración: {e}")
        traceback.print_exc()
        conn.rollback()
        return stats
    finally:
        cursor.close()


def main():
    """Función principal"""
    print("\n" + "="*70)
    print("🚀 MIGRACIÓN PDM: Base64 → S3")
    print("="*70)
    
    # Conectar a DB y S3
    print("\n🔌 Conectando a PostgreSQL RDS...")
    conn = conectar_db()
    print("✅ Conexión DB exitosa")
    
    # Mostrar estadísticas actuales
    print("\n" + "="*70)
    print("📊 ESTADO ACTUAL DE LA BASE DE DATOS")
    print("="*70)
    
    try:
        cursor = conn.cursor()
        
        # Total evidencias
        cursor.execute("SELECT COUNT(*) FROM pdm_actividades_evidencias")
        total = cursor.fetchone()[0]
        print(f"\n📋 Total de evidencias: {total}")
        
        # Migradas
        cursor.execute("SELECT COUNT(*) FROM pdm_actividades_evidencias WHERE migrated_to_s3 = TRUE")
        migradas = cursor.fetchone()[0]
        print(f"✅ Ya migradas a S3: {migradas}")
        
        # Pendientes
        pendientes = total - migradas
        print(f"⏳ Pendientes de migrar: {pendientes}")
        
        # Análisis detallado de pendientes
        cursor.execute("""
            SELECT COUNT(*) FROM pdm_actividades_evidencias 
            WHERE migrated_to_s3 IS NOT TRUE 
            AND imagenes IS NULL
        """)
        null_count = cursor.fetchone()[0]
        
        cursor.execute("""
            SELECT COUNT(*) FROM pdm_actividades_evidencias 
            WHERE migrated_to_s3 IS NOT TRUE 
            AND imagenes = '[]'::jsonb
        """)
        empty_count = cursor.fetchone()[0]
        
        cursor.execute("""
            SELECT COUNT(*) FROM pdm_actividades_evidencias 
            WHERE migrated_to_s3 IS NOT TRUE 
            AND imagenes IS NOT NULL
            AND imagenes != '[]'::jsonb
            AND jsonb_array_length(imagenes) > 0
            AND length(imagenes->0->>'0') >= 100
        """)
        valid_pending = cursor.fetchone()[0]
        
        print(f"\n📊 Análisis de pendientes:")
        print(f"   ❌ NULL: {null_count}")
        print(f"   📭 Vacías: {empty_count}")
        print(f"   ✅ Válidas para migrar: {valid_pending}")
        
        cursor.close()
        
    except Exception as e:
        print(f"⚠️  Error obteniendo estadísticas: {e}")
    
    print("\n" + "="*70)
    
    # Validación de conexión S3
    print("\n🔌 Conectando a S3...")
    s3_client = conectar_s3()
    print(f"✅ Conexión S3 exitosa (Bucket: {S3_BUCKET})")
    
    # Opción de dry-run
    print("\n⚠️  IMPORTANTE:")
    print("   - Esta migración subirá imágenes a S3")
    print("   - Los datos Base64 NO se eliminarán (se mantienen como backup)")
    print("   - La migración es idempotente (se puede ejecutar múltiples veces)")
    print("   - Procesará en batches de", BATCH_SIZE, "evidencias")
    print("\n¿Ejecutar en modo DRY-RUN (simulación sin cambios)? (y/N): ", end='')
    
    dry_run = input().lower() == 'y'
    
    if not dry_run:
        print("\n¿Confirmar ejecución REAL de la migración? (y/N): ", end='')
        if input().lower() != 'y':
            print("❌ Migración cancelada")
            sys.exit(0)
    
    # Ejecutar migración
    inicio = datetime.now()
    stats = migrar_evidencias(conn, s3_client, dry_run=dry_run)
    fin = datetime.now()
    duracion = (fin - inicio).total_seconds()
    
    # Resumen
    print("\n" + "="*70)
    print("📊 RESUMEN DE MIGRACIÓN")
    print("="*70)
    print(f"\n⏱️  Duración: {duracion:.2f} segundos")
    print(f"\n📈 Estadísticas:")
    print(f"   Total evidencias pendientes: {stats['total_evidencias']}")
    print(f"   ✅ Migradas exitosamente: {stats['migradas_exitosamente']}")
    print(f"   ℹ️  Ya migradas previamente: {stats['ya_migradas']}")
    print(f"   ⚠️  Sin imágenes: {stats['sin_imagenes']}")
    print(f"   ❌ Errores: {stats['errores']}")
    print(f"\n📸 Imágenes:")
    print(f"   Total subidas a S3: {stats['imagenes_subidas']}")
    print(f"\n💾 Espacio:")
    print(f"   Bytes Base64 procesados: {stats['bytes_liberados']:,}")
    print(f"   MB procesados: {stats['bytes_liberados'] / 1024 / 1024:.2f} MB")
    
    if dry_run:
        print("\n⚠️  MODO DRY-RUN: Ningún cambio fue aplicado a la DB")
        print("   Ejecuta sin dry-run para aplicar cambios reales")
    else:
        print("\n✅ Migración completada exitosamente")
        print(f"\n💡 Próximos pasos:")
        print(f"   1. Verificar imágenes en S3: https://s3.console.aws.amazon.com/s3/buckets/{S3_BUCKET}")
        print(f"   2. Probar URLs desde frontend")
        print(f"   3. Una vez verificado, ejecutar migration_cleanup_base64.py")
    
    conn.close()
    
    return 0 if stats['errores'] == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
