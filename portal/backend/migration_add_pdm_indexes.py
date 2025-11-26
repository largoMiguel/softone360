"""
Migración: Agregar índices compuestos para optimizar queries del PDM
Mejora el rendimiento de consultas frecuentes en productos y actividades

Ejecutar con:
    python migration_add_pdm_indexes.py
"""
import sys
from sqlalchemy import text, create_engine
from sqlalchemy.orm import sessionmaker

# Importar configuración de base de datos
try:
    from app.config.database import get_db, engine
    from app.config.settings import get_settings
except ImportError:
    print("❌ Error: No se pudo importar la configuración de la base de datos")
    print("   Asegúrate de ejecutar este script desde el directorio raíz del backend")
    sys.exit(1)


def crear_indices_pdm():
    """Crea índices compuestos para optimizar consultas PDM"""
    
    print("\n🔧 INICIANDO MIGRACIÓN: Agregar índices PDM")
    print("=" * 60)
    
    # Crear sesión
    SessionLocal = sessionmaker(bind=engine)
    db = SessionLocal()
    
    try:
        # ========================================
        # ÍNDICES PARA pdm_productos
        # ========================================
        print("\n📊 Agregando índices en pdm_productos...")
        
        # Índice compuesto: entity_id + codigo_producto
        # Acelera: filtrado por entidad y búsqueda por código
        try:
            db.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_pdm_productos_entity_codigo 
                ON pdm_productos(entity_id, codigo_producto)
            """))
            print("  ✅ idx_pdm_productos_entity_codigo")
        except Exception as e:
            print(f"  ⚠️ idx_pdm_productos_entity_codigo ya existe o error: {e}")
        
        # Índice compuesto: entity_id + responsable_secretaria_id
        # Acelera: filtrado de productos por secretaría
        try:
            db.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_pdm_productos_entity_secretaria 
                ON pdm_productos(entity_id, responsable_secretaria_id) 
                WHERE responsable_secretaria_id IS NOT NULL
            """))
            print("  ✅ idx_pdm_productos_entity_secretaria")
        except Exception as e:
            print(f"  ⚠️ idx_pdm_productos_entity_secretaria ya existe o error: {e}")
        
        # ========================================
        # ÍNDICES PARA pdm_actividades
        # ========================================
        print("\n📊 Agregando índices en pdm_actividades...")
        
        # Índice compuesto: entity_id + codigo_producto + anio
        # Acelera: carga de actividades por producto y año
        try:
            db.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_pdm_actividades_entity_codigo_anio 
                ON pdm_actividades(entity_id, codigo_producto, anio)
            """))
            print("  ✅ idx_pdm_actividades_entity_codigo_anio")
        except Exception as e:
            print(f"  ⚠️ idx_pdm_actividades_entity_codigo_anio ya existe o error: {e}")
        
        # Índice compuesto: entity_id + responsable_secretaria_id + anio
        # Acelera: "Mis actividades" para secretarios
        try:
            db.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_pdm_actividades_entity_secretaria_anio 
                ON pdm_actividades(entity_id, responsable_secretaria_id, anio) 
                WHERE responsable_secretaria_id IS NOT NULL
            """))
            print("  ✅ idx_pdm_actividades_entity_secretaria_anio")
        except Exception as e:
            print(f"  ⚠️ idx_pdm_actividades_entity_secretaria_anio ya existe o error: {e}")
        
        # Índice: estado
        # Acelera: filtrado por estado de actividad
        try:
            db.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_pdm_actividades_estado 
                ON pdm_actividades(estado)
            """))
            print("  ✅ idx_pdm_actividades_estado")
        except Exception as e:
            print(f"  ⚠️ idx_pdm_actividades_estado ya existe o error: {e}")
        
        # ========================================
        # ÍNDICES PARA pdm_actividades_evidencias
        # ========================================
        print("\n📊 Agregando índices en pdm_actividades_evidencias...")
        
        # Índice compuesto: entity_id + actividad_id
        # Acelera: carga de evidencias
        try:
            db.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_pdm_evidencias_entity_actividad 
                ON pdm_actividades_evidencias(entity_id, actividad_id)
            """))
            print("  ✅ idx_pdm_evidencias_entity_actividad")
        except Exception as e:
            print(f"  ⚠️ idx_pdm_evidencias_entity_actividad ya existe o error: {e}")
        
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
            db.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_pdm_ejecucion_entity_codigo_anio 
                ON pdm_ejecucion_presupuestal(entity_id, codigo_producto, anio)
            """))
            print("  ✅ idx_pdm_ejecucion_entity_codigo_anio")
        except Exception as e:
            print(f"  ⚠️ idx_pdm_ejecucion_entity_codigo_anio ya existe o error: {e}")
        
        # Commit de cambios
        db.commit()
        
        print("\n" + "=" * 60)
        print("✅ MIGRACIÓN COMPLETADA: Todos los índices PDM agregados")
        print("=" * 60)
        
        # Mostrar estadísticas de índices
        print("\n📊 ESTADÍSTICAS DE ÍNDICES:")
        result = db.execute(text("""
            SELECT 
                tablename, 
                indexname 
            FROM pg_indexes 
            WHERE tablename LIKE 'pdm_%' 
            ORDER BY tablename, indexname
        """))
        
        current_table = None
        for row in result:
            if row.tablename != current_table:
                print(f"\n  📋 {row.tablename}:")
                current_table = row.tablename
            print(f"     - {row.indexname}")
        
        print("\n✅ Migración finalizada exitosamente")
        print("   Los queries PDM ahora deberían ser significativamente más rápidos.\n")
        
    except Exception as e:
        print(f"\n❌ ERROR durante la migración: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    print("\n" + "=" * 60)
    print("  MIGRACIÓN: AGREGAR ÍNDICES PDM")
    print("  Optimiza rendimiento de consultas PDM")
    print("=" * 60)
    
    try:
        settings = get_settings()
        print(f"\n📌 Base de datos: {settings.DATABASE_URL}")
        
        respuesta = input("\n⚠️  ¿Deseas continuar con la migración? (s/n): ")
        if respuesta.lower() != 's':
            print("\n❌ Migración cancelada por el usuario")
            sys.exit(0)
        
        crear_indices_pdm()
        
    except KeyboardInterrupt:
        print("\n\n❌ Migración interrumpida por el usuario")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Error fatal: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
