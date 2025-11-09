"""
Script para eliminar las tablas PDM antiguas antes de crear las nuevas
"""
from sqlalchemy import create_engine, text
from app.config.settings import settings

def drop_pdm_tables():
    engine = create_engine(settings.database_url)
    
    with engine.connect() as conn:
        # Desactivar foreign key constraints temporalmente (SQLite)
        conn.execute(text("PRAGMA foreign_keys = OFF"))
        conn.commit()
        
        # Eliminar tablas PDM existentes en orden inverso de dependencias
        tables_to_drop = [
            "pdm_actividades_evidencias",
            "pdm_actividades_ejecuciones",
            "pdm_actividades",
            "pdm_avances",
            "pdm_meta_assignments",
            "pdm_archivos_excel",
            # Nuevas tablas
            "pdm_productos",
            "pdm_lineas_estrategicas",
            "pdm_indicadores_resultado",
            "pdm_iniciativas_sgr"
        ]
        
        for table in tables_to_drop:
            try:
                conn.execute(text(f"DROP TABLE IF EXISTS {table}"))
                print(f"✅ Tabla {table} eliminada")
            except Exception as e:
                print(f"⚠️  Error al eliminar {table}: {e}")
        
        conn.commit()
        
        # Reactivar foreign key constraints
        conn.execute(text("PRAGMA foreign_keys = ON"))
        conn.commit()
    
    print("\n✅ Proceso completado")

if __name__ == "__main__":
    print("🗑️  Eliminando tablas PDM antiguas...")
    drop_pdm_tables()
