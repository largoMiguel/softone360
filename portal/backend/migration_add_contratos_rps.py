"""
Migración para crear la tabla de contratos RPS en PDM

Ejecutar con:
python migration_add_contratos_rps.py
"""
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session
import os
from dotenv import load_dotenv

# Cargar variables de entorno
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "mysql+pymysql://root:password@localhost:3306/pqrs_db")

def run_migration():
    """Ejecuta la migración para agregar contratos RPS"""
    engine = create_engine(DATABASE_URL)
    
    with Session(engine) as session:
        print("🔨 Creando tabla pdm_contratos_rps...")
        
        # Crear tabla
        session.execute(text("""
            CREATE TABLE IF NOT EXISTS pdm_contratos_rps (
                id INT AUTO_INCREMENT PRIMARY KEY,
                codigo_producto VARCHAR(20) NOT NULL,
                no_cdp VARCHAR(100) NOT NULL,
                concepto TEXT,
                valor DECIMAL(18, 2) NOT NULL DEFAULT 0,
                entity_id INT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                anio INT NOT NULL,
                contratista VARCHAR(500),
                fecha_inicio DATETIME,
                fecha_fin DATETIME,
                
                -- Índices
                INDEX idx_pdm_contratos_entity_codigo_anio (entity_id, codigo_producto, anio),
                INDEX idx_pdm_contratos_cdp (no_cdp),
                INDEX idx_pdm_contratos_codigo (codigo_producto),
                INDEX idx_pdm_contratos_anio (anio),
                INDEX idx_pdm_contratos_entity (entity_id),
                
                -- Constraint único
                UNIQUE KEY uq_pdm_contratos_entity_codigo_cdp_anio (entity_id, codigo_producto, no_cdp, anio),
                
                -- Foreign key
                FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        """))
        
        session.commit()
        print("✅ Tabla pdm_contratos_rps creada exitosamente")
        
        # Verificar
        result = session.execute(text("SHOW TABLES LIKE 'pdm_contratos_rps'"))
        if result.fetchone():
            print("✅ Verificación: Tabla existe")
            
            # Mostrar estructura
            result = session.execute(text("DESCRIBE pdm_contratos_rps"))
            print("\n📋 Estructura de la tabla:")
            for row in result:
                print(f"   {row[0]}: {row[1]}")
        else:
            print("❌ Error: La tabla no se creó correctamente")

if __name__ == "__main__":
    print("🚀 Iniciando migración de contratos RPS...")
    try:
        run_migration()
        print("\n✅ Migración completada exitosamente")
    except Exception as e:
        print(f"\n❌ Error en la migración: {str(e)}")
        import traceback
        traceback.print_exc()
