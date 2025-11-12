#!/usr/bin/env python3
"""
Script para eliminar responsable_user_id de pdm_actividades en SQLite local
"""

import sqlite3
import sys

def drop_column_sqlite():
    """Elimina la columna responsable_user_id de pdm_actividades"""
    
    db_path = "pqrs_alcaldia.db"
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        print(f"📝 Conectando a BD: {db_path}")
        
        # Verificar estructura actual
        cursor.execute("PRAGMA table_info(pdm_actividades)")
        columns = {col[1]: col for col in cursor.fetchall()}
        
        if 'responsable_user_id' not in columns:
            print("✅ La columna responsable_user_id ya no existe")
            conn.close()
            return True
        
        print("❌ La columna responsable_user_id existe, eliminándola...")
        
        # SQLite no soporta DROP COLUMN directo, necesitamos recrear la tabla
        print("\n🔄 Procedimiento: Recreando tabla (SQLite limitation)...\n")
        
        # Paso 1: Verificar estructura
        print("Paso 1: Verificando estructura actual...")
        cursor.execute("PRAGMA table_info(pdm_actividades)")
        current_columns = cursor.fetchall()
        print(f"   ✅ Total de columnas: {len(current_columns)}")
        
        # Paso 2: Obtener todas las columnas excepto responsable_user_id
        print("Paso 2: Identificando columnas a mantener...")
        cols_to_keep = []
        for col in current_columns:
            col_name = col[1]
            col_type = col[2]
            if col_name != 'responsable_user_id':
                cols_to_keep.append((col_name, col_type, col))
        
        print(f"   ✅ Columnas a mantener: {len(cols_to_keep)}")
        for col_name, col_type, _ in cols_to_keep:
            print(f"      • {col_name} ({col_type})")
        
        # Paso 3: Copiar datos a tabla temporal
        print("\nPaso 3: Creando tabla temporal...")
        cols_names = ', '.join([col[0] for col in cols_to_keep])
        cursor.execute(f"CREATE TABLE pdm_actividades_temp AS SELECT {cols_names} FROM pdm_actividades")
        print("   ✅ Tabla temporal creada")
        
        # Paso 4: Eliminar tabla original
        print("Paso 4: Eliminando tabla original...")
        cursor.execute("DROP TABLE pdm_actividades")
        print("   ✅ Tabla original eliminada")
        
        # Paso 5: Recrear tabla con nueva estructura
        print("Paso 5: Recreando tabla sin responsable_user_id...")
        
        # Construir CREATE TABLE
        cols_def = []
        for col_name, col_type, col_info in cols_to_keep:
            not_null = " NOT NULL" if col_info[3] == 1 else ""
            default = f" DEFAULT {col_info[4]}" if col_info[4] else ""
            primary = " PRIMARY KEY" if col_info[5] == 1 else ""
            
            col_def = f"{col_name} {col_type}{not_null}{default}{primary}"
            cols_def.append(col_def)
        
        create_sql = f"CREATE TABLE pdm_actividades ({', '.join(cols_def)})"
        cursor.execute(create_sql)
        print("   ✅ Nueva tabla creada")
        
        # Paso 6: Copiar datos de vuelta
        print("Paso 6: Copiando datos de vuelta...")
        cursor.execute(f"INSERT INTO pdm_actividades ({cols_names}) SELECT {cols_names} FROM pdm_actividades_temp")
        print(f"   ✅ {cursor.rowcount} filas copiadas")
        
        # Paso 7: Eliminar tabla temporal
        print("Paso 7: Eliminando tabla temporal...")
        cursor.execute("DROP TABLE pdm_actividades_temp")
        print("   ✅ Tabla temporal eliminada")
        
        # Paso 8: Recrear índices
        print("Paso 8: Recreando índice...")
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_pdm_actividades_responsable_secretaria 
            ON pdm_actividades(responsable_secretaria_id)
        """)
        print("   ✅ Índice recreado")
        
        conn.commit()
        
        # Paso 9: Verificar nueva estructura
        print("\nPaso 9: Verificando nueva estructura...")
        cursor.execute("PRAGMA table_info(pdm_actividades)")
        new_columns = cursor.fetchall()
        
        print("📋 Columnas actuales en pdm_actividades:")
        for col in new_columns:
            col_name = col[1]
            col_type = col[2]
            nullable = "NULLABLE" if col[3] == 0 else "NOT NULL"
            print(f"   • {col_name} ({col_type}) - {nullable}")
        
        # Verificar que responsable_user_id no existe
        col_names = [col[1] for col in new_columns]
        if 'responsable_user_id' in col_names:
            print("\n❌ ERROR: responsable_user_id aún existe!")
            conn.close()
            return False
        
        if 'responsable_secretaria_id' not in col_names:
            print("\n❌ ERROR: responsable_secretaria_id no existe!")
            conn.close()
            return False
        
        print("\n✅ Verificación exitosa:")
        print("   ✅ responsable_user_id eliminado")
        print("   ✅ responsable_secretaria_id presente")
        
        cursor.close()
        conn.close()
        return True
            
    except sqlite3.Error as e:
        print(f"❌ Error de SQLite: {e}")
        return False
    except Exception as e:
        print(f"❌ Error general: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = drop_column_sqlite()
    sys.exit(0 if success else 1)
