"""
Script para crear las nuevas tablas PDM
"""
from app.config.database import Base, engine
from app.models import (
    PdmLineaEstrategica,
    PdmIndicadorResultado,
    PdmIniciativaSGR,
    PdmProducto,
    PdmActividad,
    PdmActividadEvidencia
)

def create_pdm_tables():
    print("🔨 Creando tablas PDM nuevas...")
    
    # Crear todas las tablas
    Base.metadata.create_all(bind=engine)
    
    print("✅ Tablas PDM creadas exitosamente:")
    print("   - pdm_lineas_estrategicas")
    print("   - pdm_indicadores_resultado")
    print("   - pdm_iniciativas_sgr")
    print("   - pdm_productos")
    print("   - pdm_actividades")
    print("   - pdm_actividades_evidencias")

if __name__ == "__main__":
    create_pdm_tables()
