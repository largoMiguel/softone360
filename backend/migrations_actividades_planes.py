"""
Migración: Cambiar actividades de planes institucionales para usar secretarías en lugar de usuarios.

Cambios:
- Eliminar columna 'responsable' (String) de tabla 'actividades'
- Agregar columna 'responsable_secretaria_id' (FK a secretarias.id)
"""

import sys
import os
from sqlalchemy import text

# Agregar la ruta del proyecto al path
sys.path.insert(0, os.path.dirname(__file__))

from app.config.database import engine


def migrate_up():
    """Ejecutar migración hacia arriba"""
    with engine.connect() as conn:
        with conn.begin():
            # 1. Agregar la columna responsable_secretaria_id
            print("1. Agregando columna responsable_secretaria_id...")
            try:
                conn.execute(text("""
                    ALTER TABLE actividades
                    ADD COLUMN responsable_secretaria_id INTEGER REFERENCES secretarias(id) ON DELETE SET NULL
                """))
                print("   ✅ Columna responsable_secretaria_id agregada")
            except Exception as e:
                if "already exists" in str(e).lower():
                    print("   ℹ️ La columna ya existe")
                else:
                    print(f"   ⚠️ Error: {e}")

            # 2. Eliminar la columna responsable (con manejo de índices en SQLite)
            print("2. Eliminando columna responsable...")
            try:
                # Primero eliminar el índice si existe
                try:
                    conn.execute(text("DROP INDEX IF EXISTS ix_actividades_responsable"))
                except:
                    pass
                
                conn.execute(text("""
                    ALTER TABLE actividades
                    DROP COLUMN responsable
                """))
                print("   ✅ Columna responsable eliminada")
            except Exception as e:
                if "no such column" in str(e).lower():
                    print("   ℹ️ La columna ya ha sido eliminada")
                else:
                    print(f"   ⚠️ Error: {e}")

            # 3. Crear índice en responsable_secretaria_id
            print("3. Creando índice en responsable_secretaria_id...")
            try:
                conn.execute(text("""
                    CREATE INDEX IF NOT EXISTS idx_actividades_responsable_secretaria_id 
                    ON actividades(responsable_secretaria_id)
                """))
                print("   ✅ Índice creado")
            except Exception as e:
                print(f"   ⚠️ Error: {e}")


def migrate_down():
    """Ejecutar migración hacia abajo (rollback)"""
    with engine.connect() as conn:
        with conn.begin():
            # 1. Agregar la columna responsable de vuelta
            print("1. Agregando columna responsable (rollback)...")
            try:
                conn.execute(text("""
                    ALTER TABLE actividades
                    ADD COLUMN responsable VARCHAR(200) NOT NULL DEFAULT ''
                """))
                print("   ✅ Columna responsable restaurada")
            except Exception as e:
                print(f"   ⚠️ Error al agregar columna: {e}")

            # 2. Eliminar la columna responsable_secretaria_id
            print("2. Eliminando columna responsable_secretaria_id (rollback)...")
            try:
                conn.execute(text("""
                    ALTER TABLE actividades
                    DROP COLUMN responsable_secretaria_id
                """))
                print("   ✅ Columna responsable_secretaria_id eliminada")
            except Exception as e:
                print(f"   ⚠️ Error al eliminar columna: {e}")


if __name__ == "__main__":
    action = sys.argv[1] if len(sys.argv) > 1 else "up"
    
    if action == "up":
        print("🔄 Ejecutando migración hacia arriba...")
        migrate_up()
        print("\n✅ Migración completada")
    elif action == "down":
        print("🔄 Ejecutando migración hacia abajo (rollback)...")
        migrate_down()
        print("\n✅ Rollback completado")
    else:
        print(f"Acción desconocida: {action}")
        print("Uso: python migrations_actividades_planes.py [up|down]")
