import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy.exc import OperationalError, SQLAlchemyError
from fastapi import HTTPException
from app.config.settings import settings

# Resolver ruta SQLite relativa a absoluta basada en la carpeta backend
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
db_url = settings.database_url
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
    pool_recycle=300,        # Recicla conexiones cada 5 min
    pool_size=3,             # Muy reducido para free tier de Render (máximo 5 conexiones totales)
    max_overflow=2,          # Solo 2 adicionales para evitar saturar
    pool_timeout=60,         # Timeout más largo para esperar conexión disponible
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