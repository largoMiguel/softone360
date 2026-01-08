"""
Script para actualizar is_talento_humano del usuario jhon-rubio
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

def fix_user():
    """Actualizar is_talento_humano para el usuario jhon-rubio"""
    try:
        print("🔌 Conectando a PostgreSQL RDS...\n")
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()
        
        # Verificar estado actual del usuario
        print("📋 Verificando usuario jhon-rubio...")
        cursor.execute("""
            SELECT id, username, full_name, is_talento_humano, allowed_modules 
            FROM users 
            WHERE username = 'jhon-rubio'
        """)
        
        user = cursor.fetchone()
        if not user:
            print("❌ Usuario 'jhon-rubio' no encontrado")
            return False
        
        print(f"\n👤 Usuario encontrado:")
        print(f"   ID: {user[0]}")
        print(f"   Username: {user[1]}")
        print(f"   Nombre: {user[2]}")
        print(f"   is_talento_humano: {user[3]}")
        print(f"   allowed_modules: {user[4]}")
        
        # Actualizar is_talento_humano a TRUE
        print(f"\n📝 Actualizando is_talento_humano a TRUE...")
        cursor.execute("""
            UPDATE users 
            SET is_talento_humano = TRUE 
            WHERE username = 'jhon-rubio'
        """)
        conn.commit()
        print("   ✅ Actualizado")
        
        # Verificar que allowed_modules incluya 'asistencia'
        print(f"\n📝 Verificando allowed_modules...")
        cursor.execute("""
            SELECT allowed_modules 
            FROM users 
            WHERE username = 'jhon-rubio'
        """)
        modules = cursor.fetchone()[0]
        
        if modules is None or 'asistencia' not in modules:
            print(f"   📝 Agregando 'asistencia' a allowed_modules...")
            if modules is None:
                modules = ['asistencia']
            else:
                modules.append('asistencia')
            
            cursor.execute("""
                UPDATE users 
                SET allowed_modules = %s 
                WHERE username = 'jhon-rubio'
            """, (modules,))
            conn.commit()
            print("   ✅ Módulo agregado")
        else:
            print("   ✅ Módulo ya está en allowed_modules")
        
        # Verificar resultado final
        print(f"\n📊 Estado final del usuario:")
        cursor.execute("""
            SELECT username, full_name, is_talento_humano, allowed_modules 
            FROM users 
            WHERE username = 'jhon-rubio'
        """)
        
        result = cursor.fetchone()
        print(f"   Username: {result[0]}")
        print(f"   Nombre: {result[1]}")
        print(f"   is_talento_humano: {result[2]}")
        print(f"   allowed_modules: {result[3]}")
        
        cursor.close()
        conn.close()
        print("\n✅ Script completado exitosamente")
        return True
        
    except Exception as e:
        print(f"❌ ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    import sys
    success = fix_user()
    sys.exit(0 if success else 1)
