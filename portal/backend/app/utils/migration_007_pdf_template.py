"""
Migración 007: Añadir campo pdf_template_url a entities
Para almacenar template PDF con membrete institucional usado en informes de PQRS
"""

from sqlalchemy import text
from app.config.database import engine


def run_migration():
    """Ejecutar migración 007"""
    print("="*70)
    print("MIGRACIÓN 007: Añadir pdf_template_url a entities")
    print("="*70)
    
    try:
        with engine.connect() as conn:
            # Verificar si ya existe el campo
            result = conn.execute(text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'entities' 
                AND column_name = 'pdf_template_url'
            """))
            
            if result.fetchone():
                print("✅ El campo 'pdf_template_url' ya existe en la tabla 'entities'")
                print("="*70)
                return
            
            # Añadir columna
            print("📝 Añadiendo columna 'pdf_template_url'...")
            conn.execute(text("""
                ALTER TABLE entities 
                ADD COLUMN pdf_template_url VARCHAR(500) NULL
            """))
            
            conn.commit()
            
            print("✅ Migración 007 completada exitosamente")
            print("   - Columna 'pdf_template_url' añadida a 'entities'")
            print("="*70)
            
    except Exception as e:
        print(f"❌ Error en migración 007: {e}")
        print("="*70)
        raise


if __name__ == "__main__":
    run_migration()
