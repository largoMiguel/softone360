"""
Migración: Preparar sistema para migrar imágenes de evidencias a S3
Esta migración NO mueve las imágenes aún, solo prepara la infraestructura

FASE 1: Preparación (este script)
  - Agregar columna imagenes_s3_urls
  - Mantener imagenes (Base64) para compatibilidad

FASE 2: Migración gradual (script separado)
  - Migrar imágenes Base64 a S3
  - Actualizar imagenes_s3_urls
  - Mantener imagenes hasta validar

FASE 3: Limpieza (después de validar)
  - Eliminar columna imagenes (Base64)
  - Usar solo imagenes_s3_urls

Ejecutar con:
    eb ssh softone-backend-useast1 --command "source /var/app/venv/*/bin/activate && python migration_prepare_s3_images.py"
"""
import psycopg2
from datetime import datetime

# Configuración de conexión a RDS PostgreSQL
DB_CONFIG = {
    'host': 'softone-db.ccvomgoayzyt.us-east-1.rds.amazonaws.com',
    'port': 5432,
    'database': 'postgres',
    'user': 'dbadmin',
    'password': 'TuPassSeguro123!'
}


def preparar_migracion_s3():
    """Prepara la base de datos para migrar imágenes de evidencias a S3"""
    
    print("\n🔧 INICIANDO MIGRACIÓN: Preparar S3 para evidencias")
    print("=" * 60)
    
    try:
        print("\n🔌 Conectando a PostgreSQL RDS...")
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()
        print("✅ Conexión exitosa\n")
        
        # ========================================
        # PASO 1: Analizar tamaño actual
        # ========================================
        print("\n📊 PASO 1: Analizando tamaño actual de evidencias...")
        
        cursor.execute("""
            SELECT 
                COUNT(*) as total_evidencias,
                COUNT(CASE WHEN imagenes IS NOT NULL THEN 1 END) as con_imagenes,
                pg_size_pretty(pg_total_relation_size('pdm_actividades_evidencias')) as tamaño_tabla
            FROM pdm_actividades_evidencias
        """)
        
        stats = cursor.fetchone()
        print(f"   Total de evidencias: {stats[0]}")
        print(f"   Con imágenes: {stats[1]}")
        print(f"   Tamaño de tabla: {stats[2]}")
        
        # Calcular beneficio estimado
        if stats[1] > 0:
            imagenes_por_evidencia = 2  # Promedio estimado
            tamaño_por_imagen_mb = 2.7  # 2MB original -> 2.7MB Base64
            reduccion_estimada_gb = (stats[1] * imagenes_por_evidencia * tamaño_por_imagen_mb) / 1024
            print(f"\n   💡 Reducción estimada en DB: ~{reduccion_estimada_gb:.2f} GB")
            print(f"   💡 Mejora velocidad queries: ~10-50x más rápido")
        
        # ========================================
        # PASO 2: Agregar columna imagenes_s3_urls
        # ========================================
        print("\n📊 PASO 2: Agregando columna imagenes_s3_urls...")
        
        try:
            cursor.execute("""
                ALTER TABLE pdm_actividades_evidencias 
                ADD COLUMN IF NOT EXISTS imagenes_s3_urls JSONB
            """)
            conn.commit()
            print("✅ Columna imagenes_s3_urls agregada (tipo JSONB)")
        except Exception as e:
            print(f"⚠️ Error al agregar columna: {e}")
            conn.rollback()
        
        # ========================================
        # PASO 3: Agregar índice en imagenes_s3_urls
        # ========================================
        print("\n📊 PASO 3: Agregando índice GIN en imagenes_s3_urls...")
        
        try:
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_pdm_evidencias_s3_urls 
                ON pdm_actividades_evidencias USING GIN (imagenes_s3_urls)
            """)
            conn.commit()
            print("✅ Índice GIN agregado (permite búsquedas rápidas en JSON)")
        except Exception as e:
            print(f"⚠️ Error al agregar índice: {e}")
            conn.rollback()
        
        # ========================================
        # PASO 4: Agregar columna de control de migración
        # ========================================
        print("\n📊 PASO 4: Agregando columna migrated_to_s3...")
        
        try:
            cursor.execute("""
                ALTER TABLE pdm_actividades_evidencias 
                ADD COLUMN IF NOT EXISTS migrated_to_s3 BOOLEAN DEFAULT FALSE
            """)
            conn.commit()
            print("✅ Columna migrated_to_s3 agregada")
        except Exception as e:
            print(f"⚠️ Error al agregar columna: {e}")
            conn.rollback()
        
        # ========================================
        # PASO 5: Agregar índice en migrated_to_s3
        # ========================================
        print("\n📊 PASO 5: Agregando índice en migrated_to_s3...")
        
        try:
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_pdm_evidencias_migrated 
                ON pdm_actividades_evidencias(migrated_to_s3)
                WHERE migrated_to_s3 = FALSE
            """)
            conn.commit()
            print("✅ Índice parcial agregado (solo para no migradas)")
        except Exception as e:
            print(f"⚠️ Error al agregar índice: {e}")
            conn.rollback()
        
        # ========================================
        # VERIFICACIÓN FINAL
        # ========================================
        print("\n" + "=" * 60)
        print("✅ MIGRACIÓN COMPLETADA: Base de datos preparada para S3")
        print("=" * 60)
        
        print("\n📋 ESTRUCTURA ACTUAL:")
        cursor.execute("""
            SELECT column_name, data_type, character_maximum_length
            FROM information_schema.columns
            WHERE table_name = 'pdm_actividades_evidencias'
            ORDER BY ordinal_position
        """)
        
        for col in cursor.fetchall():
            print(f"   - {col[0]}: {col[1]}")
        
        print("\n💡 PRÓXIMOS PASOS:")
        print("   1. Configurar bucket S3 para almacenar imágenes")
        print("   2. Configurar permisos IAM para acceso a S3")
        print("   3. Ejecutar migration_upload_images_to_s3.py (migración gradual)")
        print("   4. Validar que las imágenes se sirven correctamente desde S3")
        print("   5. Ejecutar migration_cleanup_base64.py (eliminar Base64)")
        
        print("\n⚠️ CONFIGURACIÓN S3 REQUERIDA:")
        print("   Bucket: softone-pdm-evidencias")
        print("   Región: us-east-1")
        print("   Estructura: /entity_{id}/evidencia_{id}/imagen_{idx}.jpg")
        print("   Permisos: Public read para imágenes")
        print("   Lifecycle: Eliminar imágenes de evidencias eliminadas (90 días)")
        
        print("\n📝 ACTUALIZACIÓN DE CÓDIGO NECESARIA:")
        print("   - pdm_v2.py: Usar imagenes_s3_urls en lugar de imagenes")
        print("   - Frontend: Cargar imágenes desde URLs S3")
        print("   - Validación: Agregar lógica para subir a S3 en create/update")
        
        cursor.close()
        conn.close()
        return True
        
    except Exception as e:
        print(f"\n❌ ERROR durante la migración: {e}")
        import traceback
        traceback.print_exc()
        if 'conn' in locals():
            conn.rollback()
            conn.close()
        return False


if __name__ == "__main__":
    import sys
    success = preparar_migracion_s3()
    sys.exit(0 if success else 1)
