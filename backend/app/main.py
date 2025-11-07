from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import inspect, text
from app.config.database import engine, get_db, Base
from app.config.settings import settings
from app.routes import auth, pqrs, users, planes, entities, contratacion, alerts, secretarias, migrations
from app.models import user, pqrs as pqrs_model, plan, entity, pdm as pdm_model, secretaria as secretaria_model
from app.models.user import User, UserRole
from app.utils.auth import get_password_hash

# Asegurar que el ENUM userrole existe en Postgres con todos los valores antes de crear tablas
def ensure_postgres_enums():
    """Crea o actualiza el ENUM userrole en Postgres si es necesario."""
    try:
        if 'postgresql' not in str(engine.url):
            return  # Solo para PostgreSQL
        
        with engine.connect() as conn:
            # Verificar si el tipo userrole existe
            check_type = text("""
                SELECT EXISTS (
                    SELECT 1 FROM pg_type WHERE typname = 'userrole'
                ) as exists;
            """)
            type_exists = conn.execute(check_type).scalar()
            
            if not type_exists:
                # Crear el ENUM con valores en MAYÚSCULAS (coinciden con Enum.name)
                conn.execute(text(
                    "CREATE TYPE userrole AS ENUM ('SUPERADMIN', 'ADMIN', 'SECRETARIO', 'CIUDADANO')"
                ))
                conn.commit()
            else:
                # Verificar que tenga todos los valores necesarios
                check_values = text("""
                    SELECT enumlabel FROM pg_enum 
                    WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'userrole')
                    ORDER BY enumsortorder;
                """)
                existing_values = [row[0] for row in conn.execute(check_values).fetchall()]
                
                # Agregar valores faltantes
                required_values = ['SUPERADMIN', 'ADMIN', 'SECRETARIO', 'CIUDADANO']
                for value in required_values:
                    if value not in existing_values:
                        try:
                            conn.execute(text("COMMIT"))
                            conn.execute(text(f"ALTER TYPE userrole ADD VALUE '{value}'"))
                        except Exception:
                            pass  # El valor ya existe o hay error
    except Exception as e:
        print(f"⚠️  Error asegurando ENUMs: {e}")

# Ejecutar antes de crear tablas
ensure_postgres_enums()

# Crear las tablas en la base de datos (solo si no existen)
Base.metadata.create_all(bind=engine)

# Compatibilidad: añadir columna `is_active` a la tabla users en SQLite si no existe
inspector = inspect(engine)
if inspector.has_table("users"):
    cols = [c.get("name") for c in inspector.get_columns("users")]
    if "is_active" not in cols:
        try:
            with engine.connect() as conn:
                conn.execute(text('ALTER TABLE users ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT 1'))
                conn.commit()
        except Exception:
            pass  # Columna ya existe o error ignorado

# Nota: se removieron migraciones automáticas específicas de SQLite

# Migración automática para PostgreSQL: agregar columnas de ciudadano y PQRS
# Nota: se removieron migraciones automáticas específicas de PostgreSQL

app = FastAPI(
    title="Sistema PQRS Alcaldía",
    description="API para gestión de Peticiones, Quejas, Reclamos y Sugerencias",
    version="1.0.0"
)

# Nota: se removieron prints de CORS para un arranque limpio

# Configurar CORS dinámicamente según entorno
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,  # URLs permitidas desde settings
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"]
)

# Comprimir respuestas grandes para optimizar ancho de banda
app.add_middleware(GZipMiddleware, minimum_size=500)

# Middleware para manejar excepciones y asegurar CORS headers
from fastapi import Request, Response
from fastapi.responses import JSONResponse
import traceback

@app.middleware("http")
async def catch_exceptions_middleware(request: Request, call_next):
    """Middleware para capturar todas las excepciones y enviar headers CORS"""
    try:
        response = await call_next(request)
        return response
    except Exception as e:
        # Log detallado del error
        print(f"\n❌ Error no manejado:")
        print(f"   Path: {request.method} {request.url.path}")
        print(f"   Error: {str(e)}")
        print(f"   Traceback:\n{traceback.format_exc()}")
        
        # Crear respuesta con CORS headers
        origin = request.headers.get("origin")
        if origin in settings.cors_origins or "*" in settings.cors_origins:
            return JSONResponse(
                status_code=500,
                content={
                    "detail": "Error interno del servidor",
                    "error": str(e) if settings.debug else "Internal server error"
                },
                headers={
                    "Access-Control-Allow-Origin": origin or "*",
                    "Access-Control-Allow-Credentials": "true",
                    "Access-Control-Allow-Methods": "*",
                    "Access-Control-Allow-Headers": "*",
                }
            )
        return JSONResponse(
            status_code=500,
            content={"detail": "Error interno del servidor"}
        )

# Incluir routers
app.include_router(auth.router, prefix="/api")
app.include_router(pqrs.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(planes.router, prefix="/api/planes", tags=["Planes Institucionales"])
app.include_router(entities.router, prefix="/api", tags=["Entidades"])
app.include_router(contratacion.router, prefix="/api", tags=["Contratación"])
from app.routes import pdm as pdm_routes
app.include_router(pdm_routes.router, prefix="/api", tags=["PDM"])
app.include_router(alerts.router, prefix="/api", tags=["Alerts"])
app.include_router(secretarias.router, prefix="/api", tags=["Secretarías"])
app.include_router(migrations.router, prefix="/api", tags=["Migrations"])

@app.get("/")
async def root():
    return {"message": "Sistema PQRS Alcaldía API"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

# Seed en startup eliminado; usar endpoint /api/auth/init-superadmin si se necesita