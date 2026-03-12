#!/bin/bash
# Script para limpiar informes vía SSH en EC2

echo "📋 Ejecutando limpieza de informes en base de datos de producción..."
echo "============================================================================"
echo ""

# Ejecutar Python inline con el script de limpieza
python3 << 'PYTHON_SCRIPT'
import psycopg2

DB_CONFIG = {
    'host': 'softone-db.ccvomgoayzyt.us-east-1.rds.amazonaws.com',
    'port': 5432,
    'database': 'postgres',
    'user': 'dbadmin',
    'password': 'TuPassSeguro123!'
}

try:
    print("🔌 Conectando a PostgreSQL RDS...")
    conn = psycopg2.connect(**DB_CONFIG)
    cursor = conn.cursor()
    
    print("📊 Consultando informes existentes...")
    cursor.execute("SELECT COUNT(*) FROM informes_estado")
    total = cursor.fetchone()[0]
    print(f"   Total informes: {total}")
    
    if total == 0:
        print("\n✅ No hay informes para limpiar")
    else:
        cursor.execute("""
            SELECT id, estado, anio, formato, created_at
            FROM informes_estado
            ORDER BY created_at DESC
        """)
        for inf in cursor.fetchall():
            print(f"   ID: {inf[0]:<3} | Estado: {inf[1]:<12} | Año: {inf[2]} | {inf[3]} | {inf[4]}")
        
        print(f"\n🔄 Eliminando {total} informes...")
        cursor.execute("DELETE FROM informes_estado")
        conn.commit()
        print(f"✅ Eliminados {total} informes exitosamente\n")
    
    cursor.close()
    conn.close()
    
except Exception as e:
    print(f"❌ ERROR: {e}")
    import traceback
    traceback.print_exc()

PYTHON_SCRIPT

echo ""
echo "============================================================================"
echo "✅ Script completado"
