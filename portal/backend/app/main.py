from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
import traceback
from sqlalchemy.orm import Session
from sqlalchemy import inspect, text
from app.config.database import engine, get_db, Base
from app.config.settings import settings
from app.routes import auth, pqrs, users, planes, entities, contratacion, alerts, secretarias, bpin, showcase, setup, predio_analysis, asistencia, servicios_ingenieria, admin_migrations, admin_migrations_stats, admin_debug, correspondencia, vias
from app.models import user, pqrs as pqrs_model, plan, entity, pdm as pdm_model, secretaria as secretaria_model, pdm_ejecucion, funcionario, correspondencia as correspondencia_model, vias as vias_model
from app.models.user import User, UserRole
from app.utils.auth import get_password_hash
from app.utils.rate_limiter import limiter
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

# Asegurar que el ENUM userrole existe en Postgres con todos los valores antes de crear tablas
def ensure_postgres_enums():
    """Crea o actualiza los ENUMs en Postgres si es necesario."""
    try:
        if 'postgresql' not in str(engine.url):
            return  # Solo para PostgreSQL
        
        with engine.connect() as conn:
            # 1. ENUM userrole
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
            
            # 2. ENUMs de Correspondencia
            # TipoRadicacion
            conn.execute(text("""
                DO $$ BEGIN
                    CREATE TYPE tiporadicacion AS ENUM ('fisico', 'correo');
                EXCEPTION
                    WHEN duplicate_object THEN null;
                END $$;
            """))
            conn.commit()
            
            # TipoSolicitudCorrespondencia
            conn.execute(text("""
                DO $$ BEGIN
                    CREATE TYPE tiposolicitudcorrespondencia AS ENUM (
                        'sugerencia', 'peticion', 'queja', 'reclamo', 
                        'felicitacion', 'solicitud_informacion', 'otro'
                    );
                EXCEPTION
                    WHEN duplicate_object THEN null;
                END $$;
            """))
            conn.commit()
            
            # EstadoCorrespondencia
            conn.execute(text("""
                DO $$ BEGIN
                    CREATE TYPE estadocorrespondencia AS ENUM (
                        'enviada', 'en_proceso', 'resuelta', 'cerrada'
                    );
                EXCEPTION
                    WHEN duplicate_object THEN null;
                END $$;
            """))
            conn.commit()
            
            print("✅ ENUMs de correspondencia verificados/creados")
            
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

# Registrar rate limiter (slowapi)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# === Validación de secrets inseguros al arrancar ===
_INSECURE_SECRET_KEY = "tu-clave-secreta-super-segura-cambiar-en-produccion"
_INSECURE_SUPERADMIN_PWD = "changeMe!SuperSecure"
_INSECURE_MIGRATION_KEY = "change-me-in-production-migration-key-2024"

if settings.environment == "production":
    errors = []
    if settings.secret_key == _INSECURE_SECRET_KEY:
        errors.append("SECRET_KEY")
    if settings.superadmin_password == _INSECURE_SUPERADMIN_PWD:
        errors.append("SUPERADMIN_PASSWORD")
    if settings.migration_secret_key == _INSECURE_MIGRATION_KEY:
        errors.append("MIGRATION_SECRET_KEY")
    if errors:
        raise RuntimeError(
            f"[SEGURIDAD] Variables de entorno inseguras en producción: {', '.join(errors)}. "
            "Configura valores únicos y secretos en el archivo .env de producción."
        )
elif settings.environment == "development":
    if settings.secret_key == _INSECURE_SECRET_KEY:
        print("⚠️  [SEGURIDAD] SECRET_KEY usa el valor por defecto. Cámbialo en producción.")
    if settings.superadmin_password == _INSECURE_SUPERADMIN_PWD:
        print("⚠️  [SEGURIDAD] SUPERADMIN_PASSWORD usa el valor por defecto. Cámbialo en producción.")

# ============================================
# IMPORTANTE: Handler de OPTIONS ANTES de middlewares
# ============================================
@app.options("/{full_path:path}")
async def preflight_handler(full_path: str, request: Request):
    """Maneja explícitamente todos los requests OPTIONS (CORS preflight)
    Este handler se ejecuta ANTES de los middlewares para evitar 502"""
    origin = request.headers.get("origin", "")
    allowed = origin if origin in settings.cors_origins else settings.cors_origins[0]
    return Response(
        status_code=200,
        headers={
            "Access-Control-Allow-Origin": allowed,
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, PATCH",
            "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept, Origin, X-Requested-With",
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Max-Age": "3600",
            "Vary": "Origin",
        }
    )

# Nota: se removieron prints de CORS para un arranque limpio

# Configurar CORS dinámicamente según entorno
# NOTA CRÍTICA: En AWS S3, el browser hace preflight requests (OPTIONS)
# Deben ser permitidas EXPLÍCITAMENTE
cors_origins_list = settings.cors_origins
print(f"\n✅ CORS Origins permitidos: {cors_origins_list}\n")

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins_list,  # URLs permitidas desde settings
    allow_credentials=True,
    allow_methods=["*"],  # Incluye OPTIONS para preflight
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=3600  # Cache preflight por 1 hora
)

# Comprimir respuestas grandes para optimizar ancho de banda
app.add_middleware(GZipMiddleware, minimum_size=500)

# Middleware para manejar excepciones y asegurar CORS headers

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    try:
        print("\n⚠️  ValidationError 422:")
        print(f"   Path: {request.method} {request.url.path}")
        # Detalle de errores pydantic
        for err in exc.errors():
            print(f"   - loc={err.get('loc')}, msg={err.get('msg')}, type={err.get('type')}")
    except Exception:
        pass
    # Dejar que FastAPI genere la respuesta estándar
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors()},
    )

@app.middleware("http")
async def catch_exceptions_middleware(request: Request, call_next):
    """Middleware para capturar todas las excepciones"""
    try:
        response = await call_next(request)
        return response
    except Exception as e:
        # Log detallado del error
        print(f"\n❌ Error no manejado:")
        print(f"   Path: {request.method} {request.url.path}")
        print(f"   Error: {str(e)}")
        print(f"   Traceback:\n{traceback.format_exc()}")
        
        # Retornar error simple - CORSMiddleware ya manejó los headers
        return JSONResponse(
            status_code=500,
            content={
                "detail": "Error interno del servidor",
                "error": str(e) if settings.debug else "Internal server error"
            }
        )

# Incluir routers
app.include_router(auth.router, prefix="/api")
app.include_router(pqrs.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(planes.router, prefix="/api/planes", tags=["Planes Institucionales"])
app.include_router(entities.router, prefix="/api")
app.include_router(contratacion.router, prefix="/api")
from app.routes import pdm_v2 as pdm_v2_routes
app.include_router(pdm_v2_routes.router, prefix="/api", tags=["PDM V2"])
from app.routes import pdm_ejecucion
app.include_router(pdm_ejecucion.router, prefix="/api/pdm/ejecucion", tags=["PDM Ejecución"])
from app.routes import pdm_informes
app.include_router(pdm_informes.router, prefix="/api", tags=["PDM Informes"])
from app.routes import pdm_contratos
app.include_router(pdm_contratos.router, prefix="/api", tags=["PDM Contratos RPS"])
app.include_router(alerts.router, prefix="/api", tags=["Alerts"])
app.include_router(secretarias.router, prefix="/api", tags=["Secretarías"])
app.include_router(bpin.router, tags=["BPIN"])
app.include_router(showcase.router, prefix="/api", tags=["Showcase"])
app.include_router(setup.router, prefix="/api", tags=["Setup"])
app.include_router(predio_analysis.router, prefix="/api", tags=["Predios Analysis (Temporal)"])
app.include_router(asistencia.router, prefix="/api", tags=["Asistencia"])
app.include_router(servicios_ingenieria.router, prefix="/api", tags=["Servicios Ingeniería"])
app.include_router(admin_migrations.router, tags=["Admin Migrations"])
app.include_router(admin_migrations_stats.router, tags=["Admin Migrations Stats"])
app.include_router(admin_debug.router, tags=["Admin Debug"])
app.include_router(correspondencia.router, prefix="/api", tags=["Correspondencia"])
app.include_router(vias.router, prefix="/api", tags=["Vías Intervenidas"])

@app.get("/")
async def root():
    return {"message": "Sistema PQRS Alcaldía API"}

@app.get("/health")
async def health_check():
    """Health check endpoint para AWS y monitoreo"""
    try:
        # Verificar conexión a la base de datos
        db = next(get_db())
        db.execute(text("SELECT 1"))
        db.close()
        return {
            "status": "healthy",
            "database": "connected",
            "version": "1.0.0"
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "database": "disconnected",
            "error": str(e)
        }

# Seed en startup eliminado; usar endpoint /api/auth/init-superadmin si se necesita