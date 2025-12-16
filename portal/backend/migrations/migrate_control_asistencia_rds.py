"""
Script de migración para Control de Asistencia - PostgreSQL RDS
Crea las tablas: funcionarios, equipos_registro, registros_asistencia
Creado: 15 de diciembre de 2025
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
    """Función principal de migración"""
    try:
        print("🔌 Conectando a PostgreSQL RDS...\n")
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()
        
        print("🔄 Ejecutando migración: Control de Asistencia...\n")
        
        # 1. Crear tabla funcionarios
        print("📋 Creando tabla funcionarios...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS funcionarios (
                id SERIAL PRIMARY KEY,
                cedula VARCHAR(20) UNIQUE NOT NULL,
                nombres VARCHAR(100) NOT NULL,
                apellidos VARCHAR(100) NOT NULL,
                email VARCHAR(150),
                telefono VARCHAR(20),
                cargo VARCHAR(150),
                foto_url VARCHAR(500),
                entity_id INTEGER NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
                is_active BOOLEAN NOT NULL DEFAULT TRUE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE
            );
        """)
        
        # Índices para funcionarios
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_funcionarios_cedula ON funcionarios(cedula);
        """)
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_funcionarios_entity ON funcionarios(entity_id);
        """)
        print("✅ Tabla funcionarios creada\n")
        
        # 2. Crear tabla equipos_registro
        print("📋 Creando tabla equipos_registro...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS equipos_registro (
                id SERIAL PRIMARY KEY,
                uuid VARCHAR(100) UNIQUE NOT NULL,
                nombre VARCHAR(100) NOT NULL,
                ubicacion VARCHAR(200),
                entity_id INTEGER NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
                is_active BOOLEAN NOT NULL DEFAULT TRUE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE
            );
        """)
        
        # Índices para equipos_registro
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_equipos_uuid ON equipos_registro(uuid);
        """)
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_equipos_entity ON equipos_registro(entity_id);
        """)
        print("✅ Tabla equipos_registro creada\n")
        
        # 3. Crear tabla registros_asistencia
        print("📋 Creando tabla registros_asistencia...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS registros_asistencia (
                id SERIAL PRIMARY KEY,
                funcionario_id INTEGER NOT NULL REFERENCES funcionarios(id) ON DELETE CASCADE,
                equipo_id INTEGER NOT NULL REFERENCES equipos_registro(id) ON DELETE CASCADE,
                tipo_registro VARCHAR(10) NOT NULL CHECK (tipo_registro IN ('entrada', 'salida')),
                fecha_hora TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                foto_url VARCHAR(500),
                observaciones VARCHAR(500),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
        """)
        
        # Índices para registros_asistencia
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_registros_funcionario ON registros_asistencia(funcionario_id);
        """)
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_registros_fecha ON registros_asistencia(fecha_hora);
        """)
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_registros_tipo ON registros_asistencia(tipo_registro);
        """)
        print("✅ Tabla registros_asistencia creada\n")
        
        # 4. Agregar relaciones en entity (solo comentario, las relaciones son en el ORM)
        print("📋 Verificando relaciones con entities...")
        cursor.execute("""
            SELECT COUNT(*) FROM information_schema.tables 
            WHERE table_name IN ('funcionarios', 'equipos_registro', 'registros_asistencia');
        """)
        count = cursor.fetchone()[0]
        print(f"✅ {count} tablas de asistencia creadas/verificadas\n")
        
        # Commit de todos los cambios
        conn.commit()
        
        print("✅ Migración de Control de Asistencia completada exitosamente\n")
        
        # Verificación final
        print("🔍 Verificación final:")
        cursor.execute("""
            SELECT 
                tablename, 
                schemaname
            FROM pg_tables 
            WHERE tablename IN ('funcionarios', 'equipos_registro', 'registros_asistencia')
            ORDER BY tablename;
        """)
        
        tables = cursor.fetchall()
        for table in tables:
            print(f"  ✓ Tabla '{table[0]}' existe en schema '{table[1]}'")
        
        cursor.close()
        conn.close()
        return True
        
    except Exception as e:
        print(f"❌ ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == '__main__':
    print("="*60)
    print("MIGRACIÓN: Control de Asistencia de Funcionarios")
    print("="*60)
    print()
    
    success = migrate()
    
    print()
    print("="*60)
    if success:
        print("✅ MIGRACIÓN COMPLETADA CON ÉXITO")
    else:
        print("❌ MIGRACIÓN FALLÓ - Revisar errores arriba")
    print("="*60)
