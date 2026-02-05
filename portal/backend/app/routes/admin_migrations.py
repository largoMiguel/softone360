"""
Rutas temporales para ejecutar migraciones PDM
⚠️ ELIMINAR DESPUÉS DE EJECUTAR LAS MIGRACIONES
"""
from fastapi import APIRouter, Depends, HTTPException
from app.utils.auth import get_current_active_user
from app.models.user import User, UserRole
import subprocess
import os
from typing import Dict, Any

router = APIRouter(prefix="/admin/migrations", tags=["Admin Migrations"])


@router.post("/pdm-optimizations")
async def run_pdm_optimizations(
    current_user: User = Depends(get_current_active_user)
) -> Dict[str, Any]:
    """
    Ejecuta las migraciones de optimización del módulo PDM
    ⚠️ Solo SUPERADMIN puede ejecutar esto
    """
    
    # Verificar que sea superadmin
    if current_user.role != UserRole.SUPERADMIN:
        raise HTTPException(
            status_code=403,
            detail="Solo el superadmin puede ejecutar migraciones"
        )
    
    results = {}
    base_path = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    
    # Migración 1: Agregar FK producto_id
    print("\n🔧 Ejecutando migration_add_producto_fk.py...")
    try:
        result = subprocess.run(
            ["python3", f"{base_path}/migration_add_producto_fk.py"],
            capture_output=True,
            text=True,
            timeout=600  # 10 minutos max
        )
        results["migration_add_producto_fk"] = {
            "success": result.returncode == 0,
            "exitcode": result.returncode,
            "output": result.stdout,
            "errors": result.stderr
        }
        print(f"   {'✅' if result.returncode == 0 else '❌'} Código de salida: {result.returncode}")
    except subprocess.TimeoutExpired:
        results["migration_add_producto_fk"] = {
            "success": False,
            "error": "Timeout: La migración tardó más de 10 minutos"
        }
    except Exception as e:
        results["migration_add_producto_fk"] = {
            "success": False,
            "error": str(e)
        }
    
    # Migración 2: Preparar S3 para imágenes
    print("\n🔧 Ejecutando migration_prepare_s3_images.py...")
    try:
        result = subprocess.run(
            ["python3", f"{base_path}/migration_prepare_s3_images.py"],
            capture_output=True,
            text=True,
            timeout=120  # 2 minutos max
        )
        results["migration_prepare_s3_images"] = {
            "success": result.returncode == 0,
            "exitcode": result.returncode,
            "output": result.stdout,
            "errors": result.stderr
        }
        print(f"   {'✅' if result.returncode == 0 else '❌'} Código de salida: {result.returncode}")
    except subprocess.TimeoutExpired:
        results["migration_prepare_s3_images"] = {
            "success": False,
            "error": "Timeout: La migración tardó más de 2 minutos"
        }
    except Exception as e:
        results["migration_prepare_s3_images"] = {
            "success": False,
            "error": str(e)
        }
    
    # Test de rendimiento
    print("\n🔧 Ejecutando test_pdm_performance.py...")
    try:
        result = subprocess.run(
            ["python3", f"{base_path}/test_pdm_performance.py"],
            capture_output=True,
            text=True,
            timeout=60  # 1 minuto max
        )
        results["test_pdm_performance"] = {
            "success": result.returncode == 0,
            "exitcode": result.returncode,
            "output": result.stdout,
            "errors": result.stderr
        }
        print(f"   {'✅' if result.returncode == 0 else '❌'} Código de salida: {result.returncode}")
    except subprocess.TimeoutExpired:
        results["test_pdm_performance"] = {
            "success": False,
            "error": "Timeout: El test tardó más de 1 minuto"
        }
    except Exception as e:
        results["test_pdm_performance"] = {
            "success": False,
            "error": str(e)
        }
    
    # Resumen
    total_success = all(
        r.get("success", False) 
        for r in results.values()
    )
    
    return {
        "success": total_success,
        "message": "Todas las migraciones completadas" if total_success else "Algunas migraciones fallaron",
        "results": results
    }


@router.get("/status")
async def get_migration_status(
    current_user: User = Depends(get_current_active_user)
) -> Dict[str, Any]:
    """Verifica el estado de las migraciones aplicadas"""
    
    if current_user.role != UserRole.SUPERADMIN:
        raise HTTPException(status_code=403, detail="No autorizado")
    
    import psycopg2
    from app.config.database import settings
    
    try:
        conn = psycopg2.connect(
            host=settings.DB_HOST,
            port=settings.DB_PORT,
            database=settings.DB_NAME,
            user=settings.DB_USER,
            password=settings.DB_PASSWORD
        )
        cursor = conn.cursor()
        
        status = {}
        
        # Verificar si existe columna producto_id en pdm_actividades
        cursor.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'pdm_actividades' 
            AND column_name = 'producto_id'
        """)
        status["producto_fk_applied"] = cursor.fetchone() is not None
        
        # Verificar si existe columna imagenes_s3_urls en pdm_actividades_evidencias
        cursor.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'pdm_actividades_evidencias' 
            AND column_name = 'imagenes_s3_urls'
        """)
        status["s3_prepare_applied"] = cursor.fetchone() is not None
        
        # Verificar índices PDM
        cursor.execute("""
            SELECT COUNT(*) 
            FROM pg_indexes 
            WHERE tablename LIKE 'pdm_%' 
            AND indexname LIKE 'idx_pdm_%'
        """)
        status["pdm_indexes_count"] = cursor.fetchone()[0]
        
        cursor.close()
        conn.close()
        
        return {
            "success": True,
            "status": status,
            "ready_for_migrations": not status["producto_fk_applied"] and not status["s3_prepare_applied"]
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }
