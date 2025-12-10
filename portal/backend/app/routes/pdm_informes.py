"""
Rutas API para generación de informes PDM en PDF
"""
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from io import BytesIO
from datetime import datetime

from app.config.database import get_db
from app.models.entity import Entity
from app.models.user import User
from app.models.pdm import PdmProducto, PdmActividad
from app.utils.auth import get_current_active_user
from app.services.pdm_report_generator import PDMReportGenerator

router = APIRouter(prefix="/pdm/informes", tags=["PDM Informes"])


def get_entity_or_404(db: Session, slug: str) -> Entity:
    """Obtiene una entidad por slug o retorna 404"""
    entity = db.query(Entity).filter(Entity.slug == slug).first()
    if not entity:
        raise HTTPException(status_code=404, detail=f"Entidad '{slug}' no encontrada")
    return entity


@router.get("/{slug}/generar/{anio}")
async def generar_informe_pdm(
    slug: str,
    anio: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Genera un informe PDF del Plan de Desarrollo Municipal para un año específico
    
    Args:
        slug: Slug de la entidad
        anio: Año del informe (2024-2027)
        
    Returns:
        PDF file download
    """
    try:
        print(f"\n📊 Generando informe PDM para {slug} - Año {anio}")
        
        # Obtener entidad
        entity = get_entity_or_404(db, slug)
        print(f"   Entidad: {entity.name}")
        
        # Obtener todos los productos de la entidad con secretarías
        from sqlalchemy.orm import joinedload
        
        productos = db.query(PdmProducto).options(
            joinedload(PdmProducto.responsable_secretaria)
        ).filter(
            PdmProducto.entity_id == entity.id
        ).all()
        print(f"   Productos encontrados: {len(productos)}")
        
        if not productos:
            raise HTTPException(
                status_code=404,
                detail=f"No hay productos cargados para la entidad '{slug}'"
            )
        
        # Obtener todas las actividades (opcional por año) con evidencias
        from sqlalchemy.orm import joinedload
        
        actividades_query = db.query(PdmActividad).options(
            joinedload(PdmActividad.evidencia),
            joinedload(PdmActividad.responsable_secretaria)
        ).filter(
            PdmActividad.entity_id == entity.id
        )
        
        if anio:
            actividades_query = actividades_query.filter(PdmActividad.anio == anio)
        
        actividades = actividades_query.all()
        print(f"   Actividades encontradas: {len(actividades)}")
        
        # Contar actividades con evidencias
        actividades_con_evidencia = sum(1 for act in actividades if act.evidencia)
        print(f"   Actividades con evidencia: {actividades_con_evidencia}")
        
        # Generar PDF
        print(f"   Generando PDF...")
        generator = PDMReportGenerator(
            entity=entity,
            productos=productos,
            actividades=actividades,
            anio=anio,
            db=db
        )
        
        pdf_bytes = generator.generate()
        
        # Nombre del archivo
        fecha_actual = datetime.now().strftime("%Y-%m-%d")
        filename = f"informe-pdm-{slug}-{anio}-{fecha_actual}.pdf"
        
        print(f"✅ Informe generado exitosamente: {filename}\n")
        
        # Retornar PDF como descarga
        return StreamingResponse(
            BytesIO(pdf_bytes),
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename={filename}",
                "Content-Type": "application/pdf",
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error generando informe: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Error generando informe PDM: {str(e)}"
        )


@router.get("/{slug}/preview/{anio}")
async def preview_informe_pdm(
    slug: str,
    anio: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Vista previa del informe PDF (inline, sin descarga)
    """
    try:
        entity = get_entity_or_404(db, slug)
        
        productos = db.query(PdmProducto).filter(
            PdmProducto.entity_id == entity.id
        ).all()
        
        if not productos:
            raise HTTPException(
                status_code=404,
                detail=f"No hay productos cargados para la entidad '{slug}'"
            )
        
        actividades = db.query(PdmActividad).filter(
            PdmActividad.entity_id == entity.id,
            PdmActividad.anio == anio
        ).all()
        
        generator = PDMReportGenerator(
            entity=entity,
            productos=productos,
            actividades=actividades,
            anio=anio,
            db=db
        )
        
        pdf_bytes = generator.generate()
        
        # Retornar PDF para visualización inline
        return StreamingResponse(
            BytesIO(pdf_bytes),
            media_type="application/pdf",
            headers={
                "Content-Disposition": "inline",
                "Content-Type": "application/pdf",
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error generando vista previa: {str(e)}"
        )
