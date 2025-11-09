#!/usr/bin/env python3
"""
Script para ejecutar migraciones SQL en la base de datos de producción
a través de SQLAlchemy.
"""

import os
import sys
from pathlib import Path

# Agregar el directorio raíz al path para importar módulos de app
sys.path.insert(0, str(Path(__file__).parent))

from sqlalchemy import create_engine, text
from app.config.settings import settings

def run_migration_file(migration_file: str):
    """
    Ejecuta un archivo SQL de migración en la base de datos.
    
    Args:
        migration_file: Ruta al archivo SQL de migración
    """
    print(f"🔌 Conectando a la base de datos...")
    print(f"   Database URL: {settings.DATABASE_URL.replace(settings.DATABASE_URL.split('@')[0].split('://')[1], '***')}")
    
    # Crear conexión a la base de datos
    engine = create_engine(settings.DATABASE_URL)
    
    # Leer el archivo SQL
    migration_path = Path(__file__).parent.parent / "migrations" / migration_file
    
    if not migration_path.exists():
        print(f"❌ Error: No se encontró el archivo {migration_path}")
        return False
    
    print(f"📄 Leyendo migración: {migration_path}")
    with open(migration_path, 'r', encoding='utf-8') as f:
        sql_content = f.read()
    
    # Dividir en statements individuales (separados por ;)
    statements = [stmt.strip() for stmt in sql_content.split(';') if stmt.strip()]
    
    print(f"🔧 Ejecutando {len(statements)} statements SQL...")
    
    try:
        with engine.connect() as conn:
            for i, statement in enumerate(statements, 1):
                print(f"   [{i}/{len(statements)}] Ejecutando: {statement[:80]}...")
                conn.execute(text(statement))
                conn.commit()
                print(f"   ✅ Statement {i} completado")
        
        print(f"✅ Migración completada exitosamente")
        return True
        
    except Exception as e:
        print(f"❌ Error ejecutando migración: {e}")
        return False
    finally:
        engine.dispose()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Uso: python run_migration.py <nombre_archivo_sql>")
        print("Ejemplo: python run_migration.py fix_consecutivo_varchar.sql")
        sys.exit(1)
    
    migration_file = sys.argv[1]
    success = run_migration_file(migration_file)
    sys.exit(0 if success else 1)
