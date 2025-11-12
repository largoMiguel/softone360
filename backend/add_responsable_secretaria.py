#!/usr/bin/env python3
"""
Script para agregar la columna responsable_secretaria_id a pdm_actividades
Ejecutar desde el directorio backend
"""

import sqlite3
import sys

def add_column_to_sqlite():
    """Agrega la columna responsable_secretaria_id a pdm_actividades"""
    
    db_path = "pqrs_alcaldia.db"
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        print(f"📝 Conectando a BD: {db_path}")
        
        # Verificar si la columna ya existe
        cursor.execute("PRAGMA table_info(pdm_actividades)")
        columns = [column[1] for column in cursor.fetchall()]
        
        if 'responsable_secretaria_id' in columns:
            print("✅ La columna responsable_secretaria_id ya existe")
            conn.close()
            return True
        
        print("❌ La columna responsable_secretaria_id no existe, agregándola...")
        
        # Agregar la columna
        sql_commands = [
            # Agregar la columna responsable_secretaria_id
            """
            ALTER TABLE pdm_actividades 
            ADD COLUMN responsable_secretaria_id INTEGER
            """,
            
            # Crear índice
            """
            CREATE INDEX IF NOT EXISTS idx_pdm_actividades_responsable_secretaria 
            ON pdm_actividades(responsable_secretaria_id)
            """,
        ]
        
        for sql in sql_commands:
            print(f"Ejecutando: {sql.strip()[:50]}...")
            cursor.execute(sql)
        
        conn.commit()
        print("✅ Columna agregada exitosamente")
        
        # Verificar que se agregó
        cursor.execute("PRAGMA table_info(pdm_actividades)")
        columns = [column[1] for column in cursor.fetchall()]
        
        if 'responsable_secretaria_id' in columns:
            print("✅ Verificación: Columna responsable_secretaria_id existe")
            print(f"✅ Total de columnas en pdm_actividades: {len(columns)}")
            conn.close()
            return True
        else:
            print("❌ Error: La columna no se agregó correctamente")
            conn.close()
            return False
            
    except sqlite3.Error as e:
        print(f"❌ Error de SQLite: {e}")
        return False
    except Exception as e:
        print(f"❌ Error general: {e}")
        return False

if __name__ == "__main__":
    success = add_column_to_sqlite()
    sys.exit(0 if success else 1)
