"""
Script de migración para actualizar Control de Asistencia - PostgreSQL RDS
Actualiza las tablas existentes al nuevo esquema
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
        
        print("🔄 Actualizando estructura de Control de Asistencia...\n")
        
        # 1. Actualizar tabla funcionarios
        print("📋 Actualizando tabla funcionarios...")
        
        # Agregar columnas nuevas si no existen
        cursor.execute("""
            DO $$ 
            BEGIN
                -- Agregar email si no existe
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                              WHERE table_name='funcionarios' AND column_name='email') THEN
                    ALTER TABLE funcionarios ADD COLUMN email VARCHAR(150);
                    RAISE NOTICE 'Agregada columna email';
                END IF;
                
                -- Agregar telefono si no existe
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                              WHERE table_name='funcionarios' AND column_name='telefono') THEN
                    ALTER TABLE funcionarios ADD COLUMN telefono VARCHAR(20);
                    RAISE NOTICE 'Agregada columna telefono';
                END IF;
                
                -- Agregar foto_url si no existe
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                              WHERE table_name='funcionarios' AND column_name='foto_url') THEN
                    ALTER TABLE funcionarios ADD COLUMN foto_url VARCHAR(500);
                    RAISE NOTICE 'Agregada columna foto_url';
                END IF;
                
                -- Agregar entity_id si no existe
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                              WHERE table_name='funcionarios' AND column_name='entity_id') THEN
                    ALTER TABLE funcionarios ADD COLUMN entity_id INTEGER REFERENCES entities(id) ON DELETE CASCADE;
                    RAISE NOTICE 'Agregada columna entity_id';
                END IF;
            END $$;
        """)
        
        print("✅ Tabla funcionarios actualizada\n")
        
        # 2. Actualizar tabla registros_asistencia
        print("📋 Actualizando tabla registros_asistencia...")
        
        cursor.execute("""
            DO $$ 
            BEGIN
                -- Agregar equipo_id si no existe
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                              WHERE table_name='registros_asistencia' AND column_name='equipo_id') THEN
                    ALTER TABLE registros_asistencia ADD COLUMN equipo_id INTEGER REFERENCES equipos_registro(id) ON DELETE CASCADE;
                END IF;
                
                -- Agregar fecha_hora si no existe
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                              WHERE table_name='registros_asistencia' AND column_name='fecha_hora') THEN
                    ALTER TABLE registros_asistencia ADD COLUMN fecha_hora TIMESTAMP WITH TIME ZONE DEFAULT NOW();
                END IF;
                
                -- Agregar foto_url si no existe
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                              WHERE table_name='registros_asistencia' AND column_name='foto_url') THEN
                    ALTER TABLE registros_asistencia ADD COLUMN foto_url VARCHAR(500);
                END IF;
                
                -- Agregar observaciones si no existe
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                              WHERE table_name='registros_asistencia' AND column_name='observaciones') THEN
                    ALTER TABLE registros_asistencia ADD COLUMN observaciones VARCHAR(500);
                END IF;
            END $$;
        """)
        
        print("✅ Tabla registros_asistencia actualizada\n")
        
        # 3. Crear índices faltantes
        print("📋 Creando índices faltantes...")
        
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_funcionarios_cedula ON funcionarios(cedula);
        """)
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_funcionarios_entity ON funcionarios(entity_id);
        """)
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_equipos_uuid ON equipos_registro(uuid);
        """)
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_equipos_entity ON equipos_registro(entity_id);
        """)
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_registros_funcionario ON registros_asistencia(funcionario_id);
        """)
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_registros_fecha ON registros_asistencia(fecha_hora);
        """)
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_registros_tipo ON registros_asistencia(tipo_registro);
        """)
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_registros_equipo ON registros_asistencia(equipo_id);
        """)
        
        print("✅ Índices creados\n")
        
        # Commit de todos los cambios
        conn.commit()
        
        print("✅ Actualización de Control de Asistencia completada exitosamente\n")
        
        # Verificación final
        print("🔍 Verificación final:")
        
        # Verificar funcionarios
        cursor.execute("""
            SELECT column_name FROM information_schema.columns 
            WHERE table_name='funcionarios' 
            AND column_name IN ('email', 'telefono', 'foto_url', 'entity_id')
            ORDER BY column_name;
        """)
        cols_func = [r[0] for r in cursor.fetchall()]
        print(f"  Funcionarios - columnas nuevas: {', '.join(cols_func)}")
        
        # Verificar registros
        cursor.execute("""
            SELECT column_name FROM information_schema.columns 
            WHERE table_name='registros_asistencia' 
            AND column_name IN ('equipo_id', 'fecha_hora', 'foto_url', 'observaciones')
            ORDER BY column_name;
        """)
        cols_reg = [r[0] for r in cursor.fetchall()]
        print(f"  Registros - columnas nuevas: {', '.join(cols_reg)}")
        
        # Verificar índices
        cursor.execute("""
            SELECT indexname FROM pg_indexes 
            WHERE tablename IN ('funcionarios', 'equipos_registro', 'registros_asistencia')
            AND indexname LIKE 'idx_%'
            ORDER BY indexname;
        """)
        indexes = [r[0] for r in cursor.fetchall()]
        print(f"  Índices creados: {len(indexes)}")
        for idx in indexes:
            print(f"    ✓ {idx}")
        
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
    print("ACTUALIZACIÓN: Control de Asistencia de Funcionarios")
    print("="*60)
    print()
    
    success = migrate()
    
    print()
    print("="*60)
    if success:
        print("✅ ACTUALIZACIÓN COMPLETADA CON ÉXITO")
    else:
        print("❌ ACTUALIZACIÓN FALLÓ - Revisar errores arriba")
    print("="*60)
