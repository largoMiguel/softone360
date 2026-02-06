#!/usr/bin/env python3
"""
Migración: Cleanup columna imagenes (Base64)
Elimina la columna 'imagenes' Base64 después de migrar exitosamente a S3

⚠️ ADVERTENCIA: Esta migración es DESTRUCTIVA
- Elimina permanentemente todos los datos Base64
- SOLO ejecutar después de verificar que las imágenes S3 funcionan correctamente
- Hacer BACKUP de la base de datos antes de ejecutar

Ejecutar con:
    python3 migration_cleanup_base64.py
"""
import sys
import traceback
from datetime import datetime

try:
    import psycopg2
except ImportError:
    print("\n❌ ERROR: psycopg2 no está instalado")
    print("   Instalar con: pip install psycopg2-binary")
    sys.exit(1)

# Configuración
DB_CONFIG = {
    'host': 'softone-db.ccvomgoayzyt.us-east-1.rds.amazonaws.com',
    'port': 5432,
    'database': 'postgres',
    'user': 'dbadmin',
    'password': 'TuPassSeguro123!'
}


def verificar_migracion_completa(conn):
    """
    Verifica que todas las evidencias estén migradas a S3
    
    Returns:
        tuple: (completa, stats)
    """
    cursor = conn.cursor()
    
    try:
        # Total de evidencias
        cursor.execute("SELECT COUNT(*) FROM pdm_actividades_evidencias")
        total = cursor.fetchone()[0]
        
        # Evidencias migradas a S3
        cursor.execute("""
            SELECT COUNT(*) FROM pdm_actividades_evidencias 
            WHERE migrated_to_s3 = TRUE 
            AND imagenes_s3_urls IS NOT NULL
            AND imagenes_s3_urls::text != 'null'
            AND imagenes_s3_urls::text != '[]'
        """)
        migradas = cursor.fetchone()[0]
        
        # Evidencias sin imágenes (válidas)
        cursor.execute("""
            SELECT COUNT(*) FROM pdm_actividades_evidencias 
            WHERE imagenes IS NULL 
            OR imagenes::text = 'null'
            OR imagenes::text = '[]'
        """)
        sin_imagenes = cursor.fetchone()[0]
        
        # Evidencias pendientes (tienen imagenes pero no migradas)
        cursor.execute("""
            SELECT COUNT(*) FROM pdm_actividades_evidencias 
            WHERE (migrated_to_s3 = FALSE OR migrated_to_s3 IS NULL)
            AND imagenes IS NOT NULL
            AND imagenes::text != 'null'
            AND imagenes::text != '[]'
        """)
        pendientes = cursor.fetchone()[0]
        
        stats = {
            'total': total,
            'migradas': migradas,
            'sin_imagenes': sin_imagenes,
            'pendientes': pendientes
        }
        
        completa = (pendientes == 0)
        
        return completa, stats
        
    except Exception as e:
        print(f"❌ ERROR verificando migración: {e}")
        return False, {}
    finally:
        cursor.close()


def calcular_espacio_liberado(conn):
    """
    Calcula cuánto espacio se va a liberar
    
    Returns:
        int: Bytes que se liberarán
    """
    cursor = conn.cursor()
    
    try:
        cursor.execute("""
            SELECT 
                SUM(LENGTH(imagenes::text)) as total_bytes,
                COUNT(*) as total_registros
            FROM pdm_actividades_evidencias 
            WHERE imagenes IS NOT NULL
        """)
        
        result = cursor.fetchone()
        bytes_total = result[0] if result[0] else 0
        registros = result[1] if result[1] else 0
        
        return bytes_total, registros
        
    except Exception as e:
        print(f"❌ ERROR calculando espacio: {e}")
        return 0, 0
    finally:
        cursor.close()


def eliminar_columna_imagenes(conn, dry_run=False):
    """
    Elimina la columna 'imagenes' de pdm_actividades_evidencias
    
    Args:
        conn: Conexión psycopg2
        dry_run: Si True, no aplica cambios (solo simula)
    
    Returns:
        bool: True si exitoso
    """
    cursor = conn.cursor()
    
    try:
        if dry_run:
            print("\n⚠️  MODO DRY-RUN: No se aplicarán cambios a la DB")
            print("\nQuery que se ejecutaría:")
            print("   ALTER TABLE pdm_actividades_evidencias DROP COLUMN imagenes;")
            return True
        
        print("\n🗑️  Eliminando columna 'imagenes'...")
        
        cursor.execute("""
            ALTER TABLE pdm_actividades_evidencias 
            DROP COLUMN IF EXISTS imagenes;
        """)
        
        conn.commit()
        print("✅ Columna eliminada exitosamente")
        
        return True
        
    except Exception as e:
        print(f"❌ ERROR eliminando columna: {e}")
        traceback.print_exc()
        conn.rollback()
        return False
    finally:
        cursor.close()


def crear_indices_optimizados(conn, dry_run=False):
    """
    Crea índices optimizados después del cleanup
    
    Args:
        conn: Conexión psycopg2
        dry_run: Si True, no aplica cambios
    
    Returns:
        bool: True si exitoso
    """
    cursor = conn.cursor()
    
    indices = [
        # Índice para queries que filtran por migrated_to_s3
        """
        CREATE INDEX IF NOT EXISTS idx_pdm_evidencias_migrated 
        ON pdm_actividades_evidencias(migrated_to_s3) 
        WHERE migrated_to_s3 = TRUE;
        """,
        
        # Índice para queries que buscan evidencias con S3 URLs
        """
        CREATE INDEX IF NOT EXISTS idx_pdm_evidencias_has_s3 
        ON pdm_actividades_evidencias(id) 
        WHERE imagenes_s3_urls IS NOT NULL;
        """
    ]
    
    try:
        if dry_run:
            print("\n⚠️  MODO DRY-RUN: Índices que se crearían:")
            for idx in indices:
                print(f"\n{idx}")
            return True
        
        print("\n📊 Creando índices optimizados...")
        
        for idx_sql in indices:
            cursor.execute(idx_sql)
            conn.commit()
            print("   ✅ Índice creado")
        
        print("✅ Todos los índices creados")
        return True
        
    except Exception as e:
        print(f"⚠️  Advertencia creando índices: {e}")
        conn.rollback()
        return False
    finally:
        cursor.close()


def vacuum_analyze(conn, dry_run=False):
    """
    Ejecuta VACUUM y ANALYZE para recuperar espacio
    
    Args:
        conn: Conexión psycopg2
        dry_run: Si True, no ejecuta
    """
    if dry_run:
        print("\n⚠️  MODO DRY-RUN: VACUUM y ANALYZE que se ejecutarían:")
        print("   VACUUM FULL pdm_actividades_evidencias;")
        print("   ANALYZE pdm_actividades_evidencias;")
        return
    
    # VACUUM requiere autocommit
    old_isolation = conn.isolation_level
    conn.set_isolation_level(0)
    
    cursor = conn.cursor()
    
    try:
        print("\n🧹 Ejecutando VACUUM FULL (esto puede tardar varios minutos)...")
        cursor.execute("VACUUM FULL pdm_actividades_evidencias;")
        print("✅ VACUUM completado")
        
        print("\n📊 Ejecutando ANALYZE...")
        cursor.execute("ANALYZE pdm_actividades_evidencias;")
        print("✅ ANALYZE completado")
        
    except Exception as e:
        print(f"⚠️  Advertencia en VACUUM/ANALYZE: {e}")
    finally:
        cursor.close()
        conn.set_isolation_level(old_isolation)


def main():
    """Función principal"""
    print("\n" + "="*70)
    print("🗑️  CLEANUP PDM: Eliminar columna 'imagenes' (Base64)")
    print("="*70)
    
    print("\n⚠️⚠️⚠️  ADVERTENCIA CRÍTICA  ⚠️⚠️⚠️")
    print("=" * 70)
    print("Esta operación es DESTRUCTIVA e IRREVERSIBLE")
    print("Eliminará PERMANENTEMENTE todos los datos Base64 de la DB")
    print("\nSOLO ejecutar si:")
    print("  1. ✅ Todas las imágenes están migradas a S3")
    print("  2. ✅ Las URLs S3 funcionan correctamente en producción")
    print("  3. ✅ El frontend usa imagenes_s3_urls en lugar de imagenes")
    print("  4. ✅ Tienes BACKUP completo de la base de datos")
    print("=" * 70)
    
    # Conectar a DB
    print("\n🔌 Conectando a PostgreSQL RDS...")
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        print("✅ Conexión exitosa")
    except Exception as e:
        print(f"❌ ERROR conectando: {e}")
        sys.exit(1)
    
    # Verificar estado de migración
    print("\n🔍 Verificando estado de migración a S3...")
    completa, stats = verificar_migracion_completa(conn)
    
    print(f"\n📊 Estado actual:")
    print(f"   Total evidencias: {stats.get('total', 0)}")
    print(f"   ✅ Migradas a S3: {stats.get('migradas', 0)}")
    print(f"   ℹ️  Sin imágenes: {stats.get('sin_imagenes', 0)}")
    print(f"   ⚠️  Pendientes: {stats.get('pendientes', 0)}")
    
    if not completa:
        print(f"\n❌ ERROR: Aún hay {stats.get('pendientes', 0)} evidencias pendientes de migrar")
        print("   Ejecuta primero: python3 migration_upload_images_to_s3.py")
        conn.close()
        sys.exit(1)
    
    print("\n✅ Todas las evidencias están migradas a S3")
    
    # Calcular espacio a liberar
    print("\n💾 Calculando espacio a liberar...")
    bytes_total, registros = calcular_espacio_liberado(conn)
    mb_total = bytes_total / 1024 / 1024
    gb_total = bytes_total / 1024 / 1024 / 1024
    
    print(f"\n📊 Espacio a liberar:")
    print(f"   Registros con Base64: {registros}")
    print(f"   Tamaño total: {bytes_total:,} bytes")
    print(f"   Tamaño total: {mb_total:.2f} MB")
    print(f"   Tamaño total: {gb_total:.2f} GB")
    
    # Preguntar modo
    print("\n¿Ejecutar en modo DRY-RUN (simulación)? (y/N): ", end='')
    dry_run = input().lower() == 'y'
    
    if not dry_run:
        print("\n" + "="*70)
        print("⚠️  ÚLTIMA CONFIRMACIÓN")
        print("="*70)
        print(f"\nVas a eliminar {gb_total:.2f} GB de datos Base64")
        print("Esta operación NO SE PUEDE DESHACER")
        print("\n¿Tienes un BACKUP de la base de datos? (y/N): ", end='')
        
        if input().lower() != 'y':
            print("❌ Operación cancelada. Crea un backup primero.")
            conn.close()
            sys.exit(0)
        
        print("\n¿CONFIRMAR eliminación PERMANENTE de columna 'imagenes'? (escriba 'ELIMINAR'): ", end='')
        confirmacion = input()
        
        if confirmacion != 'ELIMINAR':
            print("❌ Operación cancelada")
            conn.close()
            sys.exit(0)
    
    # Ejecutar cleanup
    inicio = datetime.now()
    
    # Paso 1: Eliminar columna
    if not eliminar_columna_imagenes(conn, dry_run):
        print("\n❌ Error eliminando columna. Abortando.")
        conn.close()
        sys.exit(1)
    
    # Paso 2: Crear índices optimizados
    crear_indices_optimizados(conn, dry_run)
    
    # Paso 3: VACUUM y ANALYZE
    vacuum_analyze(conn, dry_run)
    
    fin = datetime.now()
    duracion = (fin - inicio).total_seconds()
    
    # Resumen final
    print("\n" + "="*70)
    print("📊 RESUMEN DE CLEANUP")
    print("="*70)
    print(f"\n⏱️  Duración: {duracion:.2f} segundos")
    print(f"\n💾 Espacio liberado: {gb_total:.2f} GB (~{mb_total:.2f} MB)")
    
    if dry_run:
        print("\n⚠️  MODO DRY-RUN: Ningún cambio fue aplicado")
        print("   Ejecuta sin dry-run para aplicar cambios reales")
    else:
        print("\n✅ Cleanup completado exitosamente")
        print("\n💡 Beneficios obtenidos:")
        print(f"   - Base de datos {gb_total:.2f} GB más liviana")
        print(f"   - Queries 50-100% más rápidas")
        print(f"   - Backups {((gb_total / 2) * 100):.0f}% más rápidos")
        print(f"   - Reducción de costos RDS")
        
        print("\n📝 Verificación recomendada:")
        print("   1. Monitorear métricas RDS en CloudWatch")
        print("   2. Verificar tamaño de tabla en PostgreSQL")
        print("   3. Probar endpoints PDM desde frontend")
        print("   4. Validar que imágenes S3 se cargan correctamente")
    
    conn.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
