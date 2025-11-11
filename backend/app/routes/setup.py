"""
Endpoint temporal para crear datos iniciales en producción.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.config.database import get_db
from app.models.entity import Entity
from app.models.user import User, UserRole
from app.models.secretaria import Secretaria
from passlib.context import CryptContext

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
        admin_user = db.query(User).filter(User.username == "admin").first()
        
        if not admin_user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Usuario 'admin' no encontrado"
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
