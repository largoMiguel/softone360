"""
Endpoint temporal para crear datos iniciales en producción y utilidades de mantenimiento.
Incluye una ruta segura para resetear la contraseña del superadmin cuando se requiera.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.config.database import get_db
from app.models.entity import Entity
from app.models.user import User, UserRole
from app.models.secretaria import Secretaria
from passlib.context import CryptContext
from app.utils.migration_005 import run_migration_005
from app.utils.migration_006 import run_migration_006

router = APIRouter(prefix="/setup", tags=["Setup"])

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

@router.post("/create-initial-data")
async def create_initial_data(db: Session = Depends(get_db)):
    """
    Crea entidad de prueba, secretaría y superadmin.
    Solo funciona si no existen datos previos.
    """
    try:
        # Verificar si ya hay datos
        entity_count = db.query(Entity).count()
        if entity_count > 0:
            # Si ya existe, verificar si el usuario admin es superadmin
            admin_user = db.query(User).filter(User.username == "admin").first()
            if admin_user and admin_user.role != UserRole.SUPERADMIN:
                # Actualizar rol a SUPERADMIN
                admin_user.role = UserRole.SUPERADMIN
                db.commit()
                return {
                    "status": "updated",
                    "message": f"Usuario 'admin' actualizado a rol SUPERADMIN"
                }
            
            return {
                "status": "skipped",
                "message": f"Ya existen {entity_count} entidades. Usuario admin verificado."
            }
        
        # 1. Crear Entidad
        entity = Entity(
            code="DEMO001",
            name="Municipio Demo",
            slug="municipio-demo",
            nit="900123456-7",
            phone="3001234567",
            email="contacto@municipiodemo.gov.co",
            address="Calle 1 # 2-3, Centro",
            description="Municipio de prueba para demostración del sistema",
            logo_url="https://via.placeholder.com/150",
            horario_atencion="Lunes a Viernes 8:00 AM - 5:00 PM",
            tiempo_respuesta="Respuesta en 24 horas",
            is_active=True,
            enable_pqrs=True,
            enable_planes_institucionales=True,
            enable_pdm=True,
            enable_contratacion=True,
            enable_users_admin=True,
            enable_reports_pdf=True,
            enable_ai_reports=True
        )
        db.add(entity)
        db.flush()
        
        # 2. Crear Secretaría
        secretaria = Secretaria(
            entity_id=entity.id,
            nombre="Secretaría de Administración",
            is_active=True
        )
        db.add(secretaria)
        db.flush()
        
        # 3. Crear Superadmin
        hashed_password = pwd_context.hash("Admin123!")
        
        superadmin = User(
            entity_id=entity.id,
            secretaria_id=secretaria.id,
            username="admin",
            email="admin@municipiodemo.gov.co",
            full_name="Administrador Principal",
            hashed_password=hashed_password,
            role=UserRole.SUPERADMIN,
            is_active=True,
            allowed_modules=["pqrs", "planes", "pdm", "contratacion", "bpin", "users", "entities", "secretarias"]
        )
        db.add(superadmin)
        
        db.commit()
        
        return {
            "status": "success",
            "message": "Datos iniciales creados exitosamente",
            "data": {
                "entity": {
                    "id": entity.id,
                    "code": entity.code,
                    "name": entity.name
                },
                "secretaria": {
                    "id": secretaria.id,
                    "nombre": secretaria.nombre
                },
                "superadmin": {
                    "id": superadmin.id,
                    "username": superadmin.username,
                    "email": superadmin.email,
                    "password": "Admin123!",
                    "role": superadmin.role
                }
            }
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creando datos iniciales: {str(e)}"
        )

@router.post("/fix-superadmin")
async def fix_superadmin(db: Session = Depends(get_db)):
    """
    Actualiza el usuario superadmin para que no pertenezca a ninguna entidad.
    El superadmin debe tener entity_id y secretaria_id en NULL.
    """
    try:
        # Buscar por rol en lugar de username
        admin_user = db.query(User).filter(User.role == UserRole.SUPERADMIN).first()
        
        if not admin_user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Usuario con rol SUPERADMIN no encontrado"
            )
        
        # Actualizar a NULL
        old_entity_id = admin_user.entity_id
        old_secretaria_id = admin_user.secretaria_id
        
        admin_user.entity_id = None
        admin_user.secretaria_id = None
        admin_user.role = UserRole.SUPERADMIN
        
        db.commit()
        
        return {
            "status": "success",
            "message": "Superadmin actualizado correctamente",
            "changes": {
                "entity_id": f"{old_entity_id} → NULL",
                "secretaria_id": f"{old_secretaria_id} → NULL",
                "role": str(admin_user.role)
            },
            "user": {
                "id": admin_user.id,
                "username": admin_user.username,
                "role": admin_user.role,
                "entity_id": admin_user.entity_id,
                "secretaria_id": admin_user.secretaria_id
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error actualizando superadmin: {str(e)}"
        )

@router.get("/list-users")
async def list_users(db: Session = Depends(get_db)):
    """
    Lista todos los usuarios en el sistema para debugging.
    """
    try:
        users = db.query(User).all()
        
        return {
            "status": "success",
            "total": len(users),
            "users": [
                {
                    "id": u.id,
                    "username": u.username,
                    "email": u.email,
                    "role": u.role,
                    "entity_id": u.entity_id,
                    "secretaria_id": u.secretaria_id
                }
                for u in users
            ]
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error listando usuarios: {str(e)}"
        )

@router.post("/run-migration-005")
async def execute_migration_005():
    """
    Ejecuta la migración 005 para agregar campos tipo_persona, genero, dias_respuesta y archivo_adjunto.
    """
    try:
        result = run_migration_005()
        return {
            "status": "success",
            **result
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error ejecutando migración 005: {str(e)}"
        )

@router.post("/run-migration-006")
async def execute_migration_006():
    """
    Ejecuta la migración 006 para agregar tabla asignacion_auditoria y campos justificacion_asignacion y archivo_respuesta.
    """
    try:
        result = run_migration_006()
        return {
            "status": "success",
            **result
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error ejecutando migración 006: {str(e)}"
        )

@router.get("/check-database")
async def check_database_status(db: Session = Depends(get_db)):
    """
    Endpoint de diagnóstico para verificar el estado de la base de datos
    """
    try:
        # Verificar tablas existentes
        result = db.execute(text("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
            ORDER BY table_name
        """))
        tables = [row[0] for row in result.fetchall()]
        
        # Verificar columnas de tabla pqrs
        result = db.execute(text("""
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'pqrs'
            ORDER BY ordinal_position
        """))
        pqrs_columns = [{"name": row[0], "type": row[1], "nullable": row[2]} for row in result.fetchall()]
        
        # Verificar columnas de tabla asignacion_auditoria si existe
        asignacion_columns = None
        if 'asignacion_auditoria' in tables:
            result = db.execute(text("""
                SELECT column_name, data_type, is_nullable
                FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'asignacion_auditoria'
                ORDER BY ordinal_position
            """))
            asignacion_columns = [{"name": row[0], "type": row[1], "nullable": row[2]} for row in result.fetchall()]
        
        # Intentar importar modelo
        model_import_ok = True
        import_error = None
        try:
            from app.models.pqrs import AsignacionAuditoria
        except Exception as e:
            model_import_ok = False
            import_error = str(e)
        
        return {
            "status": "success",
            "diagnostics": {
                "tables_in_database": tables,
                "asignacion_auditoria_exists": 'asignacion_auditoria' in tables,
                "pqrs_columns": pqrs_columns,
                "asignacion_auditoria_columns": asignacion_columns,
                "model_import_ok": model_import_ok,
                "import_error": import_error
            }
        }
    except Exception as e:
        import traceback
        return {
            "status": "error",
            "message": str(e),
            "traceback": traceback.format_exc()
        }
