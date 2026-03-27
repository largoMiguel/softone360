"""
Migración: Agregar columnas email_enviado y email_error a la tabla pqrs

Estas columnas permiten rastrear si el correo de respuesta fue entregado
correctamente al ciudadano cuando el medio de respuesta es 'email'.

  email_enviado: BOOLEAN (NULL=no aplica/no intentado, TRUE=ok, FALSE=fallido)
  email_error:   VARCHAR(500) — mensaje de error cuando email_enviado=FALSE

Ejecutar en producción:
    python portal/backend/migration_add_email_enviado.py
"""

import psycopg2
import os
from datetime import datetime

DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'softone-db.ccvomgoayzyt.us-east-1.rds.amazonaws.com'),
    'port': int(os.getenv('DB_PORT', 5432)),
    'database': os.getenv('DB_NAME', 'postgres'),
    'user': os.getenv('DB_USER', 'dbadmin'),
    'password': os.getenv('DB_PASSWORD', 'TuPassSeguro123!')
}

def run_migration():
    print("\n" + "="*70)
    print("MIGRACIÓN: Agregar email_enviado y email_error a tabla pqrs")
    print("="*70 + "\n")

    try:
        print("📡 Conectando a PostgreSQL...")
        conn = psycopg2.connect(**DB_CONFIG)
        cur = conn.cursor()
        print("✅ Conexión exitosa\n")

        # 1. Agregar columna email_enviado
        print("📋 Agregando columna email_enviado...")
        cur.execute("""
            ALTER TABLE pqrs
            ADD COLUMN IF NOT EXISTS email_enviado BOOLEAN;
        """)
        print("   ✓ email_enviado BOOLEAN nullable")

        # 2. Agregar columna email_error
        print("📋 Agregando columna email_error...")
        cur.execute("""
            ALTER TABLE pqrs
            ADD COLUMN IF NOT EXISTS email_error VARCHAR(500);
        """)
        print("   ✓ email_error VARCHAR(500) nullable")

        conn.commit()
        print("\n✅ Migración completada exitosamente")
        print(f"   Fecha: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

        # Verificar columnas
        cur.execute("""
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'pqrs'
              AND column_name IN ('email_enviado', 'email_error')
            ORDER BY column_name;
        """)
        rows = cur.fetchall()
        print("\n📊 Columnas creadas:")
        for row in rows:
            print(f"   {row[0]}: {row[1]} (nullable={row[2]})")

        cur.close()
        conn.close()

    except Exception as e:
        print(f"\n❌ Error en migración: {e}")
        raise

if __name__ == "__main__":
    run_migration()
