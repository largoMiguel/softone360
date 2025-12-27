#!/usr/bin/env python3
"""
Script para eliminar todos los registros de asistencia
Fecha: 19 de diciembre de 2025
"""
import psycopg2

# Configuración de conexión a RDS PostgreSQL
DB_CONFIG = {
    'host': 'softone-db.ccvomgoayzyt.us-east-1.rds.amazonaws.com',
    'port': 5432,
    'database': 'postgres',
    'user': 'dbadmin',
    'password': 'TuPassSeguro123!'
}

def main():
    print("="*60)
    print("SCRIPT: Eliminar todos los registros de asistencia")
    print("="*60)
    
    # Conectar a la base de datos
    print("\n1. Conectando a la base de datos...")
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()
        print("   ✓ Conexión exitosa")
    except Exception as e:
        print(f"   ✗ Error de conexión: {e}")
        return
    
    # Contar registros actuales
    print("\n2. Contando registros actuales...")
    cursor.execute("SELECT COUNT(*) FROM registros_asistencia")
    count_before = cursor.fetchone()[0]
    print(f"   Total de registros: {count_before}")
    
    if count_before == 0:
        print("   ℹ No hay registros para eliminar")
        cursor.close()
        conn.close()
        return
    
    # Confirmar eliminación
    print("\n⚠️  ADVERTENCIA: Esto eliminará TODOS los registros de asistencia")
    print(f"   Se eliminarán {count_before} registros")
    
    # Eliminar registros
    print("\n3. Eliminando registros...")
    try:
        cursor.execute("DELETE FROM registros_asistencia")
        conn.commit()
        print(f"   ✓ {cursor.rowcount} registros eliminados")
    except Exception as e:
        print(f"   ✗ Error al eliminar: {e}")
        conn.rollback()
        cursor.close()
        conn.close()
        return
    
    # Verificar eliminación
    print("\n4. Verificando eliminación...")
    cursor.execute("SELECT COUNT(*) FROM registros_asistencia")
    count_after = cursor.fetchone()[0]
    print(f"   Registros restantes: {count_after}")
    
    if count_after == 0:
        print("\n✅ ÉXITO: Todos los registros fueron eliminados")
    else:
        print(f"\n⚠️  ADVERTENCIA: Aún quedan {count_after} registros")
    
    # Resetear secuencia del ID
    print("\n5. Reseteando secuencia de IDs...")
    try:
        cursor.execute("ALTER SEQUENCE registros_asistencia_id_seq RESTART WITH 1")
        conn.commit()
        print("   ✓ Secuencia reseteada a 1")
    except Exception as e:
        print(f"   ⚠️  No se pudo resetear secuencia: {e}")
    
    # Cerrar conexión
    cursor.close()
    conn.close()
    
    print("\n" + "="*60)
    print("PROCESO COMPLETADO")
    print("="*60)

if __name__ == "__main__":
    main()
