"""
Script para crear superadmin y entidad de prueba en la base de datos.
Ejecutar con: python create_initial_data.py
"""

import sys
import os

# Agregar el directorio actual al path para importar los módulos
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.config.database import SessionLocal
from app.models.entity import Entity
from app.models.user import User, UserRole
from app.models.secretaria import Secretaria
from passlib.context import CryptContext
from datetime import datetime

# Configuración de hash de contraseñas
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def create_initial_data():
    """
    Crea:
    1. Entidad de prueba "Municipio Demo"
    2. Secretaría de Administración
    3. Usuario superadmin con acceso completo
    """
    db = SessionLocal()
    
    try:
        print("🚀 Iniciando creación de datos iniciales...")
        print("=" * 70)
        
        # 1. Crear Entidad de Prueba
        print("\n📍 Paso 1: Creando entidad de prueba...")
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
            # Módulos habilitados
            enable_pqrs=True,
            enable_planes_institucionales=True,
            enable_pdm=True,
            enable_contratacion=True,
            enable_users_admin=True,
            enable_reports_pdf=True,
            enable_ai_reports=True
        )
        db.add(entity)
        db.flush()  # Para obtener el ID
        
        print(f"   ✅ Entidad creada: {entity.nombre} (ID: {entity.id})")
        
        # 2. Crear Secretaría
        print("\n🏢 Paso 2: Creando Secretaría de Administración...")
        secretaria = Secretaria(
            entity_id=entity.id,
            nombre="Secretaría de Administración",
            is_active=True
        )
        db.add(secretaria)
        db.flush()
        
        print(f"   ✅ Secretaría creada: {secretaria.nombre} (ID: {secretaria.id})")
        
        # 3. Crear Superadmin
        print("\n👤 Paso 3: Creando usuario superadmin...")
        
        # Hash de la contraseña
        hashed_password = pwd_context.hash("Admin123!")
        
        superadmin = User(
            entity_id=entity.id,
            secretaria_id=secretaria.id,
            username="admin",
            email="admin@municipiodemo.gov.co",
            full_name="Administrador Principal",
            hashed_password=hashed_password,
            role=UserRole.ADMIN,
            is_active=True,
            # Módulos permitidos (todos)
            allowed_modules=["pqrs", "planes", "pdm", "contratacion", "bpin", "users", "entities", "secretarias"]
        )
        db.add(superadmin)
        
        # Commit final
        db.commit()
        
        print(f"   ✅ Usuario creado: {superadmin.username} (ID: {superadmin.id})")
        
        # Resumen final
        print("\n" + "=" * 70)
        print("✅ ¡DATOS INICIALES CREADOS CON ÉXITO!")
        print("=" * 70)
        print("\n📊 RESUMEN:")
        print(f"   • Entidad: {entity.name} (Código: {entity.code})")
        print(f"   • Secretaría: {secretaria.nombre}")
        print(f"   • Usuario: {superadmin.username}")
        print(f"   • Email: {superadmin.email}")
        print(f"   • Contraseña: Admin123!")
        print(f"   • Rol: {superadmin.role}")
        print(f"   • Módulos: {', '.join(superadmin.allowed_modules)}")
        print("\n🌐 ACCESO:")
        print("   URL Frontend: https://tu-dominio.com")
        print("   URL Backend: http://softone-backend-useast1.eba-epvnmbmk.us-east-1.elasticbeanstalk.com")
        print("\n💡 CREDENCIALES DE ACCESO:")
        print("   Usuario: admin")
        print("   Contraseña: Admin123!")
        print("=" * 70 + "\n")
        
        return True
        
    except Exception as e:
        db.rollback()
        print(f"\n❌ ERROR: {type(e).__name__}: {str(e)}")
        import traceback
        traceback.print_exc()
        return False
        
    finally:
        db.close()

if __name__ == "__main__":
    success = create_initial_data()
    sys.exit(0 if success else 1)
