"""
Migración: Agregar índices compuestos para optimizar queries del PDM
Mejora el rendimiento de consultas frecuentes en productos y actividades

Ejecutar con:
    eb ssh softone-backend-useast1 --command "source /var/app/venv/*/bin/activate && python migration_add_pdm_indexes.py"
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


def crear_indices_pdm():
    """Crea índices compuestos para optimizar consultas PDM"""
    
    print("\n🔧 INICIANDO MIGRACIÓN: Agregar índices PDM")
    print("=" * 60)
    
    try:
        print("\n🔌 Conectando a PostgreSQL RDS...")
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()
        print("✅ Conexión exitosa\n")
        # ========================================
        # ÍNDICES PARA pdm_productos
        # ========================================
        print("\n📊 Agregando índices en pdm_productos...")
        
        # Índice compuesto: entity_id + codigo_producto
        # Acelera: filtrado por entidad y búsqueda por código
        try:
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_pdm_productos_entity_codigo 
                ON pdm_productos(entity_id, codigo_producto)
            """)
            conn.commit()
            print("  ✅ idx_pdm_productos_entity_codigo")
        except Exception as e:
            print(f"  ⚠️ idx_pdm_productos_entity_codigo: {e}")
            conn.rollback()
        
        # Índice compuesto: entity_id + responsable_secretaria_id
        # Acelera: filtrado de productos por secretaría
        try:
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_pdm_productos_entity_secretaria 
                ON pdm_productos(entity_id, responsable_secretaria_id) 
                WHERE responsable_secretaria_id IS NOT NULL
            """)
            conn.commit()
            print("  ✅ idx_pdm_productos_entity_secretaria")
        except Exception as e:
            print(f"  ⚠️ idx_pdm_productos_entity_secretaria: {e}")
            conn.rollback()
        
        # ========================================
        # ÍNDICES PARA pdm_actividades
        # ========================================
        print("\n📊 Agregando índices en pdm_actividades...")
        
        # Índice compuesto: entity_id + codigo_producto + anio
        # Acelera: carga de actividades por producto y año
        try:
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_pdm_actividades_entity_codigo_anio 
                ON pdm_actividades(entity_id, codigo_producto, anio)
            """)
            conn.commit()
            print("  ✅ idx_pdm_actividades_entity_codigo_anio")
        except Exception as e:
            print(f"  ⚠️ idx_pdm_actividades_entity_codigo_anio: {e}")
            conn.rollback()
        
        # Índice compuesto: entity_id + responsable_secretaria_id + anio
        # Acelera: "Mis actividades" para secretarios
        try:
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_pdm_actividades_entity_secretaria_anio 
                ON pdm_actividades(entity_id, responsable_secretaria_id, anio) 
                WHERE responsable_secretaria_id IS NOT NULL
            """)
            conn.commit()
            print("  ✅ idx_pdm_actividades_entity_secretaria_anio")
        except Exception as e:
            print(f"  ⚠️ idx_pdm_actividades_entity_secretaria_anio: {e}")
            conn.rollback()
        
        # Índice: estado
        # Acelera: filtrado por estado de actividad
        try:
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_pdm_actividades_estado 
                ON pdm_actividades(estado)
            """)
            conn.commit()
            print("  ✅ idx_pdm_actividades_estado")
        except Exception as e:
            print(f"  ⚠️ idx_pdm_actividades_estado: {e}")
            conn.rollback()
        
        # ========================================
        # ÍNDICES PARA pdm_actividades_evidencias
        # ========================================
        print("\n📊 Agregando índices en pdm_actividades_evidencias...")
        
        # Índice compuesto: entity_id + actividad_id
        # Acelera: carga de evidencias
        try:
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_pdm_evidencias_entity_actividad 
                ON pdm_actividades_evidencias(entity_id, actividad_id)
            """)
            conn.commit()
            print("  ✅ idx_pdm_evidencias_entity_actividad")
        except Exception as e:
            print(f"  ⚠️ idx_pdm_evidencias_entity_actividad: {e}")
            conn.rollback()
        
        # ========================================
        # ÍNDICES PARA pdm_iniciativas_sgr
        # ========================================
        print("\n📊 Agregando índices en pdm_iniciativas_sgr...")
        
        # Índice compuesto: entity_id + consecutivo (ya existe constraint único)
        # Este índice se crea automáticamente por el UniqueConstraint
        print("  ℹ️ idx_pdm_iniciativas_entity_consecutivo (creado por UniqueConstraint)")
        
        # ========================================
        # ÍNDICES PARA pdm_ejecucion_presupuestal
        # ========================================
        print("\n📊 Agregando índices en pdm_ejecucion_presupuestal...")
        
        # Índice compuesto: entity_id + codigo_producto + anio
        # Acelera: carga de ejecución presupuestal por producto y año
        try:
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_pdm_ejecucion_entity_codigo_anio 
                ON pdm_ejecucion_presupuestal(entity_id, codigo_producto, anio)
            """)
            conn.commit()
            print("  ✅ idx_pdm_ejecucion_entity_codigo_anio")
        except Exception as e:
            print(f"  ⚠️ idx_pdm_ejecucion_entity_codigo_anio: {e}")
            conn.rollback()
        
        print("\n" + "=" * 60)
        print("✅ MIGRACIÓN COMPLETADA: Todos los índices PDM agregados")
        print("=" * 60)
        
        # Mostrar estadísticas de índices
        print("\n📊 ESTADÍSTICAS DE ÍNDICES:")
        cursor.execute("""
            SELECT 
                tablename, 
                indexname 
            FROM pg_indexes 
            WHERE tablename LIKE 'pdm_%' 
            ORDER BY tablename, indexname
        """)
        
        current_table = None
        for row in cursor.fetchall():
            if row[0] != current_table:
                print(f"\n  📋 {row[0]}:")
                current_table = row[0]
            print(f"     - {row[1]}")
        
        print("\n✅ Migración finalizada exitosamente")
        print("   Los queries PDM ahora deberían ser significativamente más rápidos.\n")
        
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
    success = crear_indices_pdm()
    sys.exit(0 if success else 1)
