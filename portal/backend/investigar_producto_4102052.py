#!/usr/bin/env python3
"""
Script para investigar el producto 4102052 y sus evidencias
"""
import psycopg2
import json

DB_HOST = 'softone-db.ccvomgoayzyt.us-east-1.rds.amazonaws.com'
DB_PORT = 5432
DB_NAME = 'postgres'
DB_USER = 'dbadmin'
DB_PASS = 'TuPassSeguro123!'

try:
    print("🔍 Conectando a RDS...")
    conn = psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        database=DB_NAME,
        user=DB_USER,
        password=DB_PASS,
        connect_timeout=10
    )
    
    cur = conn.cursor()
    
    # 1. Buscar actividades del producto
    print("\n📋 Buscando actividades del producto 4102052...")
    cur.execute("""
        SELECT id, codigo_producto, nombre, anio, estado
        FROM pdm_actividades
        WHERE codigo_producto = '4102052'
        ORDER BY anio
    """)
    
    actividades = cur.fetchall()
    print(f"   ✅ Encontradas {len(actividades)} actividades")
    
    for act in actividades:
        print(f"   - Actividad ID: {act[0]}, Año: {act[3]}, Estado: {act[4]}")
        print(f"     Nombre: {act[2][:80]}...")
        
        # 2. Buscar evidencia de esta actividad
        cur.execute("""
            SELECT id, actividad_id, entity_id, 
                   imagenes IS NOT NULL as tiene_base64,
                   imagenes_s3_urls IS NOT NULL as tiene_s3_urls,
                   migrated_to_s3,
                   created_at,
                   fecha_registro,
                   CASE 
                       WHEN imagenes IS NOT NULL THEN jsonb_array_length(imagenes::jsonb)
                       ELSE 0
                   END as num_imagenes_base64,
                   CASE 
                       WHEN imagenes_s3_urls IS NOT NULL THEN jsonb_array_length(imagenes_s3_urls::jsonb)
                       ELSE 0
                   END as num_urls_s3
            FROM pdm_actividades_evidencias
            WHERE actividad_id = %s
        """, (act[0],))
        
        evidencias = cur.fetchall()
        
        if evidencias:
            for ev in evidencias:
                print(f"\n     📸 Evidencia ID: {ev[0]}")
                print(f"        - Tiene Base64: {ev[3]} ({ev[8]} imágenes)")
                print(f"        - Tiene S3 URLs: {ev[4]} ({ev[9]} URLs)")
                print(f"        - migrated_to_s3: {ev[5]}")
                print(f"        - Fecha registro: {ev[7]}")
                
                # Obtener las URLs S3 si existen
                if ev[4]:
                    cur.execute("""
                        SELECT imagenes_s3_urls
                        FROM pdm_actividades_evidencias
                        WHERE id = %s
                    """, (ev[0],))
                    
                    urls_result = cur.fetchone()
                    if urls_result and urls_result[0]:
                        urls = urls_result[0]
                        if isinstance(urls, str):
                            urls = json.loads(urls)
                        print(f"        - URLs S3: {urls}")
        else:
            print(f"     ℹ️  Sin evidencia")
    
    cur.close()
    conn.close()
    print("\n✅ Consulta completada")

except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
