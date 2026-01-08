"""
Migración: Agregar campo is_talento_humano a users
Fecha: 2026-01-08
Descripción: Agrega un campo booleano para indicar si un usuario tiene acceso al módulo de Talento Humano
"""

from sqlalchemy import create_engine, Boolean, Column, text
import os
from dotenv import load_dotenv

load_dotenv()

def migrate():
    # Conectar a la base de datos
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise ValueError("DATABASE_URL no está configurada")
    
    engine = create_engine(database_url)
    
    with engine.connect() as conn:
        # Verificar si la columna ya existe
        result = conn.execute(text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name='users' AND column_name='is_talento_humano'
        """))
        
        if result.fetchone():
            print("✓ La columna 'is_talento_humano' ya existe")
            return
        
        # Agregar la columna
        print("Agregando columna 'is_talento_humano' a la tabla users...")
        conn.execute(text("""
            ALTER TABLE users 
            ADD COLUMN is_talento_humano BOOLEAN DEFAULT FALSE
        """))
        conn.commit()
        print("✓ Columna agregada exitosamente")
        
        # Establecer is_talento_humano=true para admins y superadmins
        print("Configurando permisos para admins y superadmins...")
        conn.execute(text("""
            UPDATE users 
            SET is_talento_humano = TRUE 
            WHERE role IN ('admin', 'superadmin')
        """))
        conn.commit()
        print("✓ Permisos configurados")

if __name__ == "__main__":
    print("=== Migración: Agregar campo is_talento_humano ===")
    migrate()
    print("=== Migración completada ===")
