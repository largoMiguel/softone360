import os
import json
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy.exc import OperationalError, SQLAlchemyError
from fastapi import HTTPException
from app.config.settings import settings


def _fetch_db_url_from_secrets_manager(current_url: str) -> str:
    """Obtiene DATABASE_URL desde AWS Secrets Manager cuando la URL actual apunta a SQLite
    y el entorno es producción. Nunca lanza excepción: devuelve current_url como fallback."""
    if "sqlite" not in current_url:
        return current_url
    if os.getenv("ENVIRONMENT", "development").lower() != "production":
        return current_url
    try:
        import boto3
        client = boto3.client("secretsmanager", region_name="us-east-1")
        secret_str = client.get_secret_value(
            SecretId="softone/db/credentials"
        )["SecretString"]
        data = json.loads(secret_str)
        resolved = data.get("DATABASE_URL", "")
        if resolved:
            print("[DB] DATABASE_URL obtenida desde Secrets Manager")
            return resolved
        print("[DB] Secreto encontrado pero DATABASE_URL vacío, usando fallback")
    except Exception as exc:
        print(f"[DB] No se pudo obtener DATABASE_URL de Secrets Manager: {exc}")
    return current_url


# Resolver ruta SQLite relativa a absoluta basada en la carpeta backend
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
db_url = _fetch_db_url_from_secrets_manager(settings.database_url)
if db_url.startswith("sqlite:///"):
    raw_path = db_url.replace("sqlite:///", "", 1)
    if raw_path.startswith("./") or not raw_path.startswith("/"):
        abs_path = os.path.abspath(os.path.join(BASE_DIR, raw_path))
        db_url = f"sqlite:///{abs_path}"
        # Mensaje útil en desarrollo; no usar logging para mantener simple.
        print(f"[DB] Usando SQLite absoluto: {db_url}")

# Configurar argumentos de conexión según el tipo de base de datos
if "sqlite" in db_url:
    connect_args = {"check_same_thread": False}
else:
    # PostgreSQL - Configuración para Render y producción
    connect_args = {
        "connect_timeout": 30,  # Aumentado para dar más tiempo en free tier
        "keepalives": 1,
        "keepalives_idle": 30,
        "keepalives_interval": 10,
        "keepalives_count": 5,
        # Forzar SSL en proveedores gestionados (Render/Neon/RDS)
        "sslmode": "require",
    }

engine = create_engine(
    db_url,
    connect_args=connect_args,
    pool_pre_ping=True,      # Verifica la conexión antes de usarla
    pool_recycle=1800,       # Recicla conexiones cada 30 min (RDS cierra inactivas a los 10min)
    pool_size=10,            # RDS soporta muchas conexiones; 10 base por instancia/worker
    max_overflow=5,          # 5 adicionales en picos; total máximo 15 por instancia
    pool_timeout=30,         # Falla rápido si no hay conexión disponible
    echo=False               # No mostrar SQL en logs (cambiar a True para debug)
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        # Algunos proveedores pueden cerrar la conexión de forma abrupta.
        # Evitamos que un error de rollback al cerrar burbujee al ASGI.
        try:
            db.close()
        except (OperationalError, SQLAlchemyError):
            # Conexión ya cerrada/rota; ignorar en teardown
            pass