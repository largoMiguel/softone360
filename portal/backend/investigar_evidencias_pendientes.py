"""
Script para investigar evidencias pendientes de migración a S3
"""
import psycopg2
import json

# Configuración de conexión
DB_CONFIG = {
    'host': 'softone-db.ccvomgoayzyt.us-east-1.rds.amazonaws.com',
    'port': 5432,
    'database': 'softone360',
    'user': 'postgresuser',
    'password': 'Sistemas.2024'
}

def main():
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()
    
    print("=" * 80)
    print("INVESTIGACIÓN DE EVIDENCIAS PENDIENTES")
    print("=" * 80)
    
    # Total de evidencias
    cur.execute("SELECT COUNT(*) FROM pdm_actividades_evidencias")
    total = cur.fetchone()[0]
    print(f"\n✅ Total evidencias: {total}")
    
    # Evidencias migradas
    cur.execute("SELECT COUNT(*) FROM pdm_actividades_evidencias WHERE migrated_to_s3 = TRUE")
    migradas = cur.fetchone()[0]
    print(f"✅ Evidencias migradas: {migradas}")
    print(f"⚠️  Evidencias pendientes: {total - migradas}")
    
    # Análisis de pendientes por tipo
    print("\n" + "=" * 80)
    print("ANÁLISIS DE EVIDENCIAS PENDIENTES")
    print("=" * 80)
    
    # NULL
    cur.execute("""
        SELECT COUNT(*) 
        FROM pdm_actividades_evidencias 
        WHERE migrated_to_s3 IS NOT TRUE 
        AND imagenes IS NULL
    """)
    null_count = cur.fetchone()[0]
    print(f"\n❌ Imágenes NULL: {null_count}")
    
    # Arrays vacíos
    cur.execute("""
        SELECT COUNT(*) 
        FROM pdm_actividades_evidencias 
        WHERE migrated_to_s3 IS NOT TRUE 
        AND imagenes = '[]'::jsonb
    """)
    empty_count = cur.fetchone()[0]
    print(f"📭 Imágenes array vacío: {empty_count}")
    
    # Strings vacíos o muy cortos (no válidos)
    cur.execute("""
        SELECT COUNT(*) 
        FROM pdm_actividades_evidencias 
        WHERE migrated_to_s3 IS NOT TRUE 
        AND imagenes IS NOT NULL
        AND imagenes != '[]'::jsonb
        AND jsonb_array_length(imagenes) > 0
        AND (
            imagenes->0->>'0' IS NULL
            OR length(imagenes->0->>'0') < 100
        )
    """)
    invalid_count = cur.fetchone()[0]
    print(f"❌ Imágenes inválidas/corruptas: {invalid_count}")
    
    # Válidas pendientes de migrar
    cur.execute("""
        SELECT COUNT(*) 
        FROM pdm_actividades_evidencias 
        WHERE migrated_to_s3 IS NOT TRUE 
        AND imagenes IS NOT NULL
        AND imagenes != '[]'::jsonb
        AND jsonb_array_length(imagenes) > 0
        AND length(imagenes->0->>'0') >= 100
    """)
    valid_pending = cur.fetchone()[0]
    print(f"✅ Imágenes VÁLIDAS pendientes de migrar: {valid_pending}")
    
    # Muestras de válidas pendientes
    if valid_pending > 0:
        print(f"\n{'=' * 80}")
        print(f"MUESTRA DE {min(10, valid_pending)} EVIDENCIAS VÁLIDAS PENDIENTES")
        print("=" * 80)
        
        cur.execute("""
            SELECT 
                id,
                actividad_id,
                entity_id,
                jsonb_array_length(imagenes) as num_imagenes,
                length(imagenes->0->>'0') as primer_imagen_size
            FROM pdm_actividades_evidencias 
            WHERE migrated_to_s3 IS NOT TRUE 
            AND imagenes IS NOT NULL
            AND imagenes != '[]'::jsonb
            AND jsonb_array_length(imagenes) > 0
            AND length(imagenes->0->>'0') >= 100
            LIMIT 10
        """)
        
        for row in cur.fetchall():
            print(f"\nID: {row[0]} | Actividad: {row[1]} | Entity: {row[2]}")
            print(f"  Num imágenes: {row[3]} | Tamaño 1ª imagen: {row[4]:,} bytes")
    
    # Resumen final
    print(f"\n{'=' * 80}")
    print("RESUMEN")
    print("=" * 80)
    print(f"Total evidencias: {total}")
    print(f"Migradas exitosamente: {migradas} ({migradas/total*100 if total > 0 else 0:.1f}%)")
    print(f"Sin imágenes/vacías: {null_count + empty_count}")
    print(f"Corruptas/inválidas: {invalid_count}")
    print(f"VÁLIDAS pendientes: {valid_pending} ⚠️")
    print(f"\n{'=' * 80}")
    
    if valid_pending > 0:
        print(f"\n⚠️  ACCIÓN REQUERIDA: Ejecutar script de migración para {valid_pending} evidencias válidas")
        print("💡 Comando: python migration_upload_images_to_s3.py")
    else:
        print("\n✅ No hay evidencias válidas pendientes de migrar")
    
    cur.close()
    conn.close()

if __name__ == "__main__":
    main()
