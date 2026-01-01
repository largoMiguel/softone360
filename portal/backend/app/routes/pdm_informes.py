"""
Rutas API para generación de informes PDM en PDF
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from io import BytesIO
from datetime import datetime
from typing import Optional, List

from app.config.database import get_db
from app.models.entity import Entity
from app.models.user import User
from app.models.pdm import PdmProducto, PdmActividad
from app.models.secretaria import Secretaria
from app.models.user import UserRole
from app.utils.auth import get_current_active_user
from app.services.pdm_report_generator import PDMReportGenerator

router = APIRouter(prefix="/pdm/informes", tags=["PDM Informes"])


def get_entity_or_404(db: Session, slug: str) -> Entity:
    """Obtiene una entidad por slug o retorna 404"""
    entity = db.query(Entity).filter(Entity.slug == slug).first()
    if not entity:
        raise HTTPException(status_code=404, detail=f"Entidad '{slug}' no encontrada")
    return entity


@router.get("/{slug}/filtros")
async def obtener_filtros_disponibles(
    slug: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Obtiene los filtros disponibles para generar informes
    
    Retorna:
    - secretarias: Lista de secretarías disponibles según permisos
    - estados: Lista de estados posibles
    - anios: Años disponibles
    """
    try:
        entity = get_entity_or_404(db, slug)
        
        # Control de permisos
        is_admin = current_user.role in [UserRole.ADMIN, UserRole.SUPERADMIN]
        
        # Obtener secretarías según permisos
        secretarias_query = db.query(Secretaria).filter(
            Secretaria.entity_id == entity.id
        )
        
        # Si no es admin, solo su secretaría
        if not is_admin:
            try:
                if hasattr(current_user, 'secretaria_id') and current_user.secretaria_id:
                    secretarias_query = secretarias_query.filter(
                        Secretaria.id == current_user.secretaria_id
                    )
                else:
                    # Buscar por email o nombre
                    if current_user.email:
                        secretarias_query = secretarias_query.filter(
                            Secretaria.email == current_user.email
                        )
                    elif current_user.full_name:
                        secretarias_query = secretarias_query.filter(
                            Secretaria.nombre.ilike(f"%{current_user.full_name}%")
                        )
            except Exception as filter_error:
                # Si falla el filtro, devolver lista vacía de secretarías para no-admin
                print(f"⚠️ Error filtrando secretarías para usuario {current_user.email}: {filter_error}")
                secretarias_query = db.query(Secretaria).filter(Secretaria.id == -1)  # Query vacío
        
        secretarias = secretarias_query.all()
        
        # Estados disponibles
        estados = ["PENDIENTE", "EN_PROGRESO", "COMPLETADA", "CANCELADA"]
        
        # Años disponibles (del PDM)
        anios = [2024, 2025, 2026, 2027]
        
        return {
            "secretarias": [
                {
                    "id": s.id,
                    "nombre": s.nombre
                }
                for s in secretarias
            ],
            "estados": estados,
            "anios": anios,
            "es_admin": is_admin
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error obteniendo filtros: {str(e)}"
        )


@router.get("/{slug}/generar/{anio}")
async def generar_informe_pdm(
    slug: str,
    anio: int,
    secretaria_ids: Optional[List[int]] = Query(None, description="IDs de secretarías a filtrar"),
    fecha_inicio: Optional[str] = Query(None, description="Fecha inicio (YYYY-MM-DD)"),
    fecha_fin: Optional[str] = Query(None, description="Fecha fin (YYYY-MM-DD)"),
    estados: Optional[List[str]] = Query(None, description="Estados de actividades"),
    formato: str = Query("pdf", description="Formato del informe (pdf, docx, excel)"),
    usar_ia: bool = Query(False, description="Habilitar resúmenes con IA (OpenAI)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Genera un informe del Plan de Desarrollo Municipal para un año específico o todos los años
    
    Filtros disponibles:
    - anio: Año del informe (2024-2027) o 0 para todos los años
    - secretaria_ids: Filtrar por secretarías específicas (admin)
    - fecha_inicio/fecha_fin: Rango de fechas de actividades
    - estados: Estados de actividades (PENDIENTE, EN_PROGRESO, COMPLETADA, CANCELADA)
    - formato: Formato de salida (pdf, docx, excel) - Por defecto: pdf
    - usar_ia: Habilitar análisis narrativo con IA (experimental)
    
    Permisos:
    - Admin: puede filtrar por cualquier secretaría o ver todas
    - Secretario: solo puede ver su propia secretaría
    
    Args:
        slug: Slug de la entidad
        anio: Año del informe (2024-2027) o 0 para todos los años
        formato: Formato del archivo (pdf, docx, excel)
        
    Returns:
        Archivo descargable en el formato solicitado
    """
    try:
        # Validar formato
        formato = formato.lower()
        if formato not in ["pdf", "docx", "excel"]:
            raise HTTPException(
                status_code=400,
                detail=f"Formato '{formato}' no soportado. Use: pdf, docx o excel"
            )
        
        anio_texto = "Todos los Años" if anio == 0 else str(anio)
        print(f"\n📊 Generando informe PDM {formato.upper()} para {slug} - Año {anio_texto}")
        
        # Obtener entidad
        entity = get_entity_or_404(db, slug)
        print(f"   Entidad: {entity.name}")
        
        # ============================================
        # CONTROL DE PERMISOS POR ROL
        # ============================================
        is_admin = current_user.role in [UserRole.ADMIN, UserRole.SUPERADMIN]
        user_secretaria_id = None
        
        # Si el usuario es secretario, obtener su secretaría
        if not is_admin and hasattr(current_user, 'secretaria_id'):
            user_secretaria_id = current_user.secretaria_id
            print(f"   Usuario secretario - Secretaría ID: {user_secretaria_id}")
            
            # Forzar filtro de secretaría para usuarios no admin
            secretaria_ids = [user_secretaria_id]
        
        # Si no es admin y no tiene secretaría asignada, denegar acceso
        if not is_admin and not user_secretaria_id:
            # Buscar secretaría por email o nombre
            secretaria = db.query(Secretaria).filter(
                Secretaria.entity_id == entity.id
            ).filter(
                (Secretaria.email == current_user.email) |
                (Secretaria.nombre.contains(current_user.full_name))
            ).first()
            
            if secretaria:
                user_secretaria_id = secretaria.id
                secretaria_ids = [user_secretaria_id]
                print(f"   Secretaría encontrada por email/nombre: {secretaria.nombre}")
            else:
                raise HTTPException(
                    status_code=403,
                    detail="No tiene permisos para generar informes. Contacte al administrador."
                )
        
        print(f"   Filtros aplicados:")
        print(f"     - Secretarías: {secretaria_ids}")
        print(f"     - Fechas: {fecha_inicio} a {fecha_fin}")
        print(f"     - Estados: {estados}")
        
        # ============================================
        # OBTENER PRODUCTOS CON FILTROS (OPTIMIZADO v2)
        # ============================================
        from sqlalchemy.orm import joinedload, selectinload, defer
        from sqlalchemy import or_
        
        # OPTIMIZACIÓN: Usar defer para campos JSON pesados + selectinload
        # Reduce uso de memoria en ~70% para informes grandes
        productos_query = db.query(PdmProducto).options(
            defer(PdmProducto.presupuesto_2024),
            defer(PdmProducto.presupuesto_2025),
            defer(PdmProducto.presupuesto_2026),
            defer(PdmProducto.presupuesto_2027),
            selectinload(PdmProducto.responsable_secretaria)
        ).filter(
            PdmProducto.entity_id == entity.id
        )
        
        # Filtrar por secretarías si se especifica
        if secretaria_ids:
            productos_query = productos_query.filter(
                PdmProducto.responsable_secretaria_id.in_(secretaria_ids)
            )
        
        # Filtrar productos por año (si anio != 0)
        # Si anio es 0, incluir productos de todos los años con meta > 0
        if anio > 0:
            # Filtrar productos que tienen meta para el año específico
            campo_meta = f"programacion_{anio}"
            productos_query = productos_query.filter(
                getattr(PdmProducto, campo_meta, 0) > 0
            )
        else:
            # Incluir productos que tengan meta en al menos un año
            productos_query = productos_query.filter(
                or_(
                    PdmProducto.programacion_2024 > 0,
                    PdmProducto.programacion_2025 > 0,
                    PdmProducto.programacion_2026 > 0,
                    PdmProducto.programacion_2027 > 0
                )
            )
        
        productos = productos_query.all()
        print(f"   Productos encontrados: {len(productos)}")
        
        if not productos:
            raise HTTPException(
                status_code=404,
                detail=f"No hay productos cargados para la entidad '{slug}'"
            )
        
        # ============================================
        # OBTENER ACTIVIDADES CON FILTROS (OPTIMIZADO v2)
        # ============================================
        # OPTIMIZACIÓN: NO cargar relación evidencia aquí (demasiado pesada)
        # La evidencia se cargará bajo demanda solo si es necesaria para el informe
        actividades_query = db.query(PdmActividad).options(
            selectinload(PdmActividad.responsable_secretaria)
        ).filter(
            PdmActividad.entity_id == entity.id
        )
        
        # Filtrar por año (solo si no es 0 - 'todos')
        if anio > 0:
            actividades_query = actividades_query.filter(PdmActividad.anio == anio)
        
        # Filtrar por secretarías
        if secretaria_ids:
            actividades_query = actividades_query.filter(
                PdmActividad.responsable_secretaria_id.in_(secretaria_ids)
            )
        
        # Filtrar por rango de fechas
        if fecha_inicio:
            try:
                fecha_inicio_dt = datetime.strptime(fecha_inicio, "%Y-%m-%d")
                actividades_query = actividades_query.filter(
                    PdmActividad.fecha_inicio >= fecha_inicio_dt
                )
            except ValueError:
                print(f"   ⚠️ Fecha inicio inválida: {fecha_inicio}")
        
        if fecha_fin:
            try:
                fecha_fin_dt = datetime.strptime(fecha_fin, "%Y-%m-%d")
                actividades_query = actividades_query.filter(
                    PdmActividad.fecha_fin <= fecha_fin_dt
                )
            except ValueError:
                print(f"   ⚠️ Fecha fin inválida: {fecha_fin}")
        
        # Filtrar por estados
        if estados:
            actividades_query = actividades_query.filter(
                PdmActividad.estado.in_(estados)
            )
        
        actividades = actividades_query.all()
        print(f"   Actividades encontradas: {len(actividades)}")
        
        # ============================================
        # CARGAR EVIDENCIAS BAJO DEMANDA (OPTIMIZADO)
        # ============================================
        # Solo cargar IDs de actividades que tienen evidencia (query ligera)
        # NO cargar las imágenes completas para evitar OOM
        actividades_ids = [act.id for act in actividades]
        evidencias_dict = {}
        if actividades_ids:
            from app.models.pdm import PdmActividadEvidencia
            # Query ligera: solo ID y actividad_id (sin imágenes Base64)
            evidencias_query = db.query(
                PdmActividadEvidencia.actividad_id,
                PdmActividadEvidencia.id
            ).filter(
                PdmActividadEvidencia.actividad_id.in_(actividades_ids)
            ).all()
            evidencias_dict = {e[0]: e[1] for e in evidencias_query}
            print(f"   Actividades con evidencia: {len(evidencias_dict)}")
        
        # Marcar actividades que tienen evidencia (sin cargar el objeto completo)
        for act in actividades:
            if act.id in evidencias_dict:
                # Crear un objeto mock con solo el ID para evitar consultas lazy
                class EvidenciaMock:
                    def __init__(self, eid):
                        self.id = eid
                        self.imagenes = None  # Se cargará solo si es necesario
                act.evidencia = EvidenciaMock(evidencias_dict[act.id])
            else:
                act.evidencia = None
        
        # ============================================
        # GENERAR INFORME EN EL FORMATO SOLICITADO
        # ============================================
        print(f"   Generando informe en formato {formato.upper()}...")
        
        # Obtener nombres de secretarías para el título
        secretarias_nombres = []
        if secretaria_ids:
            secretarias = db.query(Secretaria).filter(
                Secretaria.id.in_(secretaria_ids)
            ).all()
            secretarias_nombres = [s.nombre for s in secretarias]
        
        generator = PDMReportGenerator(
            entity=entity,
            productos=productos,
            actividades=actividades,
            anio=anio,
            db=db,
            filtros={
                'secretarias': secretarias_nombres,
                'fecha_inicio': fecha_inicio,
                'fecha_fin': fecha_fin,
                'estados': estados
            },
            usar_ia=usar_ia
        )
        
        # Generar según formato solicitado
        if formato == "pdf":
            file_bytes = generator.generate()
            media_type = "application/pdf"
            extension = "pdf"
        elif formato == "docx":
            file_bytes = generator.generate_docx()
            media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            extension = "docx"
        elif formato == "excel":
            file_bytes = generator.generate_excel()
            media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            extension = "xlsx"
        
        # Nombre del archivo con información de filtros
        fecha_actual = datetime.now().strftime("%Y-%m-%d")
        filtro_nombre = ""
        if secretaria_ids and len(secretaria_ids) == 1:
            sec_nombre = secretarias_nombres[0] if secretarias_nombres else f"sec{secretaria_ids[0]}"
            filtro_nombre = f"-{sec_nombre.replace(' ', '-')[:20]}"
        anio_archivo = "todos" if anio == 0 else str(anio)
        filename = f"informe-pdm-{slug}-{anio_archivo}{filtro_nombre}-{fecha_actual}.{extension}"
        
        print(f"✅ Informe {formato.upper()} generado exitosamente: {filename}\n")
        
        # Retornar archivo como descarga
        return StreamingResponse(
            BytesIO(file_bytes),
            media_type=media_type,
            headers={
                "Content-Disposition": f"attachment; filename={filename}",
                "Content-Type": media_type,
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
    secretaria_ids: Optional[List[int]] = Query(None, description="IDs de secretarías a filtrar"),
    fecha_inicio: Optional[str] = Query(None, description="Fecha inicio (YYYY-MM-DD)"),
    fecha_fin: Optional[str] = Query(None, description="Fecha fin (YYYY-MM-DD)"),
    estados: Optional[List[str]] = Query(None, description="Estados de actividades"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Vista previa del informe PDF (inline, sin descarga) con filtros
    """
    try:
        entity = get_entity_or_404(db, slug)
        
        # Control de permisos (igual que en generar)
        is_admin = current_user.role in [UserRole.ADMIN, UserRole.SUPERADMIN]
        user_secretaria_id = None
        
        if not is_admin and hasattr(current_user, 'secretaria_id'):
            user_secretaria_id = current_user.secretaria_id
            secretaria_ids = [user_secretaria_id]
        
        if not is_admin and not user_secretaria_id:
            secretaria = db.query(Secretaria).filter(
                Secretaria.entity_id == entity.id
            ).filter(
                (Secretaria.email == current_user.email) |
                (Secretaria.nombre.contains(current_user.full_name))
            ).first()
            
            if secretaria:
                user_secretaria_id = secretaria.id
                secretaria_ids = [user_secretaria_id]
            else:
                raise HTTPException(
                    status_code=403,
                    detail="No tiene permisos para generar informes."
                )
        
        # Obtener productos con filtros
        from sqlalchemy.orm import joinedload
        
        productos_query = db.query(PdmProducto).options(
            joinedload(PdmProducto.responsable_secretaria)
        ).filter(PdmProducto.entity_id == entity.id)
        
        if secretaria_ids:
            productos_query = productos_query.filter(
                PdmProducto.responsable_secretaria_id.in_(secretaria_ids)
            )
        
        productos = productos_query.all()
        
        if not productos:
            raise HTTPException(
                status_code=404,
                detail=f"No hay productos para los filtros especificados"
            )
        
        # Obtener actividades con filtros
        actividades_query = db.query(PdmActividad).options(
            joinedload(PdmActividad.evidencia),
            joinedload(PdmActividad.responsable_secretaria)
        ).filter(PdmActividad.entity_id == entity.id)
        
        if anio:
            actividades_query = actividades_query.filter(PdmActividad.anio == anio)
        if secretaria_ids:
            actividades_query = actividades_query.filter(
                PdmActividad.responsable_secretaria_id.in_(secretaria_ids)
            )
        if fecha_inicio:
            try:
                fecha_inicio_dt = datetime.strptime(fecha_inicio, "%Y-%m-%d")
                actividades_query = actividades_query.filter(
                    PdmActividad.fecha_inicio >= fecha_inicio_dt
                )
            except ValueError:
                pass
        if fecha_fin:
            try:
                fecha_fin_dt = datetime.strptime(fecha_fin, "%Y-%m-%d")
                actividades_query = actividades_query.filter(
                    PdmActividad.fecha_fin <= fecha_fin_dt
                )
            except ValueError:
                pass
        if estados:
            actividades_query = actividades_query.filter(
                PdmActividad.estado.in_(estados)
            )
        
        actividades = actividades_query.all()
        
        # Obtener nombres de secretarías
        secretarias_nombres = []
        if secretaria_ids:
            secretarias = db.query(Secretaria).filter(
                Secretaria.id.in_(secretaria_ids)
            ).all()
            secretarias_nombres = [s.nombre for s in secretarias]
        
        generator = PDMReportGenerator(
            entity=entity,
            productos=productos,
            actividades=actividades,
            anio=anio,
            db=db,
            filtros={
                'secretarias': secretarias_nombres,
                'fecha_inicio': fecha_inicio,
                'fecha_fin': fecha_fin,
                'estados': estados
            },
            usar_ia=usar_ia
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
