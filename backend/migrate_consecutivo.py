from sqlalchemy import create_engine, text
import os

# Obtener credenciales de RDS desde variables de entorno de Elastic Beanstalk
rds_hostname = os.environ.get('RDS_HOSTNAME')
rds_port = os.environ.get('RDS_PORT', '5432')
rds_db_name = os.environ.get('RDS_DB_NAME')
rds_username = os.environ.get('RDS_USERNAME')
rds_password = os.environ.get('RDS_PASSWORD')

# Construir DATABASE_URL
if all([rds_hostname, rds_db_name, rds_username, rds_password]):
    db_url = f'postgresql://{rds_username}:{rds_password}@{rds_hostname}:{rds_port}/{rds_db_name}'
    print(f'🔌 Conectando a la base de datos RDS: {rds_hostname}/{rds_db_name}')
else:
    # Fallback a DATABASE_URL directa
    db_url = os.environ.get('DATABASE_URL')
    print(f'🔌 Conectando usando DATABASE_URL del entorno')
    if not db_url:
        print('❌ Error: No se encontró configuración de base de datos')
        exit(1)

engine = create_engine(db_url)

sql_statements = [
    'ALTER TABLE pdm_indicadores_resultado ALTER COLUMN consecutivo TYPE VARCHAR(50)',
    'ALTER TABLE pdm_iniciativas_sgr ALTER COLUMN consecutivo TYPE VARCHAR(50)',
    'ALTER TABLE pdm_productos ALTER COLUMN consecutivo TYPE VARCHAR(50)'
]

with engine.connect() as conn:
    for i, stmt in enumerate(sql_statements, 1):
        try:
            print(f'[{i}/{len(sql_statements)}] Ejecutando: {stmt[:60]}...')
            conn.execute(text(stmt))
            conn.commit()
            print(f'✅ Statement {i} completado')
        except Exception as e:
            print(f'⚠️  Error en statement {i}: {e}')

print('✅ Migración completada')
engine.dispose()
