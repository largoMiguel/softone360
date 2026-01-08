"""
Script de migración para agregar campo is_talento_humano a la tabla users
PostgreSQL Version
Creado: 7 de enero de 2026
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

def migrate():
    """Agregar columna is_talento_humano y establecer TRUE para admins/superadmins"""
    try:
        print("🔌 Conectando a PostgreSQL RDS...\n")
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()
        
        print("🔄 Ejecutando migración: Agregar campo is_talento_humano...\n")
        
        # Verificar si la columna ya existe
        cursor.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'users' 
            AND column_name = 'is_talento_humano'
        """)
        
        if cursor.fetchone():
            print("✅ La columna 'is_talento_humano' ya existe")
            cursor.close()
            conn.close()
            return True
        
        # Agregar columna is_talento_humano
        print("   📝 Agregando columna is_talento_humano...")
        cursor.execute("""
            ALTER TABLE users 
            ADD COLUMN is_talento_humano BOOLEAN NOT NULL DEFAULT FALSE
        """)
        conn.commit()
        print("   ✅ Columna agregada")
        
        # Establecer TRUE para admins y superadmins existentes
        print("   📝 Estableciendo TRUE para admins y superadmins...")
        cursor.execute("""
            UPDATE users 
            SET is_talento_humano = TRUE 
            WHERE role IN ('admin', 'superadmin')
        """)
        affected_rows = cursor.rowcount
        conn.commit()
        print(f"   ✅ {affected_rows} usuarios actualizados (admins/superadmins)")
        
        # Verificar resultado
        cursor.execute("""
            SELECT column_name, data_type, column_default
            FROM information_schema.columns 
            WHERE table_name = 'users' 
            AND column_name = 'is_talento_humano'
        """)
        
        result = cursor.fetchone()
        if result:
            print(f"\n📋 Verificación: {result[0]} ({result[1]}, default={result[2]})")
        
        # Contar usuarios con acceso
        cursor.execute("""
            SELECT role, COUNT(*) 
            FROM users 
            WHERE is_talento_humano = TRUE 
            GROUP BY role
        """)
        
        print("\n📊 Usuarios con acceso a Talento Humano:")
        for row in cursor.fetchall():
            print(f"   • {row[0]}: {row[1]} usuario(s)")
        
        cursor.close()
        conn.close()
        print("\n✅ Migración completada exitosamente")
        return True
        
    except Exception as e:
        print(f"❌ ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    import sys
    success = migrate()
    sys.exit(0 if success else 1)
