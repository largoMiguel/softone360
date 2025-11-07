from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Dict
from io import BytesIO
from pydantic import BaseModel
from app.config.database import get_db
from app.models.entity import Entity
from app.models.user import User, UserRole
from app.models.pdm import (
    PdmMetaAssignment, 
    PdmAvance, 
    PdmActividad, 
    PdmArchivoExcel,
    PdmActividadEjecucion,
    PdmActividadEvidencia
)
from app.models.alert import Alert
import json
import base64
from app.schemas.pdm import (
    AssignmentUpsertRequest,
    AssignmentResponse,
    AssignmentsMapResponse,
    AvanceUpsertRequest,
    AvanceResponse,
    AvancesListResponse,
    ActividadCreateRequest,
    ActividadUpdateRequest,
    ActividadResponse,
    ActividadesListResponse,
    ActividadesBulkRequest,
    ActividadesBulkResponse,
    ExcelUploadResponse,
    ExcelInfoResponse,
    EjecucionCreateRequest,
    EjecucionResponse,
    EjecucionesListResponse,
    EvidenciaImagenResponse,
    EvidenciaCreateRequest,
    EvidenciaResponse,
    EvidenciasListResponse,
)
from app.utils.auth import get_current_active_user

# Inicializar router antes de usar decoradores
router = APIRouter(prefix="/pdm")

# =========================================================================
# ENDPOINT DE PURGA COMPLETA DEL DOMINIO PDM PARA UNA ENTIDAD
# =========================================================================

class PdmPurgeSummary(BaseModel):
    archivo_excel: int
    meta_assignments: int
    avances: int
    actividades: int
    ejecuciones: int
    evidencias: int
    message: str


@router.delete("/{slug}/purge", response_model=PdmPurgeSummary)
async def purge_pdm(
    slug: str,
    dry_run: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Elimina TODOS los datos del módulo PDM para la entidad indicada.
    Incluye: archivo Excel, asignaciones de metas, avances, actividades y cascadas
    (ejecuciones + evidencias). Requiere rol SUPERADMIN o pertenecer a la entidad.

    Parámetros:
    - dry_run: si es True no elimina nada, sólo devuelve conteos.
    """
    entity = get_entity_or_404(db, slug)
    ensure_user_can_manage_entity(current_user, entity)

    # Conteos previos
    archivo_excel_cnt = db.query(PdmArchivoExcel).filter(PdmArchivoExcel.entity_id == entity.id).count()
    meta_assignments_cnt = db.query(PdmMetaAssignment).filter(PdmMetaAssignment.entity_id == entity.id).count()
    avances_cnt = db.query(PdmAvance).filter(PdmAvance.entity_id == entity.id).count()
    actividades_cnt = db.query(PdmActividad).filter(PdmActividad.entity_id == entity.id).count()
    ejecuciones_cnt = db.query(PdmActividadEjecucion).filter(PdmActividadEjecucion.entity_id == entity.id).count()
    evidencias_cnt = db.query(PdmActividadEvidencia).filter(PdmActividadEvidencia.entity_id == entity.id).count()

    if dry_run:
        return PdmPurgeSummary(
            archivo_excel=archivo_excel_cnt,
            meta_assignments=meta_assignments_cnt,
            avances=avances_cnt,
            actividades=actividades_cnt,
            ejecuciones=ejecuciones_cnt,
            evidencias=evidencias_cnt,
            message="Dry run: no se eliminaron datos"
        )

    # Eliminaciones (orden: actividades se llevan ejecuciones+evidencias por cascade)
    db.query(PdmArchivoExcel).filter(PdmArchivoExcel.entity_id == entity.id).delete()
    db.query(PdmMetaAssignment).filter(PdmMetaAssignment.entity_id == entity.id).delete()
    db.query(PdmAvance).filter(PdmAvance.entity_id == entity.id).delete()
    db.query(PdmActividad).filter(PdmActividad.entity_id == entity.id).delete()
    # Por seguridad, limpieza explícita restante (si algo quedó huérfano)
    db.query(PdmActividadEjecucion).filter(PdmActividadEjecucion.entity_id == entity.id).delete()
    db.query(PdmActividadEvidencia).filter(PdmActividadEvidencia.entity_id == entity.id).delete()

    db.commit()

    return PdmPurgeSummary(
        archivo_excel=archivo_excel_cnt,
        meta_assignments=meta_assignments_cnt,
        avances=avances_cnt,
        actividades=actividades_cnt,
        ejecuciones=ejecuciones_cnt,
        evidencias=evidencias_cnt,
        message="Purga completada"
    )


def get_entity_or_404(db: Session, slug: str) -> Entity:
    entity = db.query(Entity).filter(Entity.slug == slug, Entity.is_active == True).first()
    if not entity:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Entidad no encontrada o inactiva")
    return entity


def ensure_user_can_manage_entity(current_user: User, entity: Entity):
    if current_user.role == UserRole.SUPERADMIN:
        return
    if not current_user.entity_id or current_user.entity_id != entity.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No autorizado para gestionar esta entidad")


@router.get("/{slug}/assignments", response_model=AssignmentsMapResponse)
async def get_assignments(
    slug: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    entity = get_entity_or_404(db, slug)
    ensure_user_can_manage_entity(current_user, entity)

    rows = db.query(PdmMetaAssignment).filter(PdmMetaAssignment.entity_id == entity.id).all()
    mapping = {r.codigo_indicador_producto: r.secretaria for r in rows}
    return {"assignments": mapping}


@router.post("/{slug}/assignments", response_model=AssignmentResponse)
async def upsert_assignment(
    slug: str,
    payload: AssignmentUpsertRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    entity = get_entity_or_404(db, slug)
    ensure_user_can_manage_entity(current_user, entity)

    rec = db.query(PdmMetaAssignment).filter(
        PdmMetaAssignment.entity_id == entity.id,
        PdmMetaAssignment.codigo_indicador_producto == payload.codigo_indicador_producto,
    ).first()
    
    # Detectar si es una nueva asignación o cambio de secretaría
    is_new_assignment = False
    old_secretaria = None
    if rec:
        old_secretaria = rec.secretaria
        if rec.secretaria != payload.secretaria and payload.secretaria:
            is_new_assignment = True
        rec.secretaria = payload.secretaria
    else:
        is_new_assignment = bool(payload.secretaria)
        rec = PdmMetaAssignment(
            entity_id=entity.id,
            codigo_indicador_producto=payload.codigo_indicador_producto,
            secretaria=payload.secretaria,
        )
        db.add(rec)
    
    db.commit()
    db.refresh(rec)
    
    # Crear alerta para usuarios de la secretaría asignada
    if is_new_assignment and payload.secretaria:
        try:
            secretarios = db.query(User).filter(
                User.role == UserRole.SECRETARIO,
                User.entity_id == entity.id,
                User.secretaria == payload.secretaria
            ).all()
            
            for secretario in secretarios:
                db.add(Alert(
                    entity_id=entity.id,
                    recipient_user_id=secretario.id,
                    type="PDM_PRODUCT_ASSIGNED",
                    title=f"Producto PDM asignado a {payload.secretaria}",
                    message=f"Se asignó el producto {payload.codigo_indicador_producto} a tu secretaría",
                    data=json.dumps({"codigo_indicador_producto": payload.codigo_indicador_producto}),
                ))
            db.commit()
        except Exception as e:
            db.rollback()
            # No interrumpir el flujo por alertas
            print(f"Error creando alertas de asignación: {e}")
    
    return AssignmentResponse(
        entity_id=rec.entity_id,
        codigo_indicador_producto=rec.codigo_indicador_producto,
        secretaria=rec.secretaria,
    )


@router.get("/{slug}/avances", response_model=AvancesListResponse)
async def get_avances(
    slug: str,
    codigo: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    entity = get_entity_or_404(db, slug)
    ensure_user_can_manage_entity(current_user, entity)

    rows = db.query(PdmAvance).filter(
        PdmAvance.entity_id == entity.id,
        PdmAvance.codigo_indicador_producto == codigo,
    ).all()

    return AvancesListResponse(
        codigo_indicador_producto=codigo,
        avances=[
            AvanceResponse(
                entity_id=row.entity_id,
                codigo_indicador_producto=row.codigo_indicador_producto,
                anio=row.anio,
                valor_ejecutado=row.valor_ejecutado,
                comentario=row.comentario,
            )
            for row in rows
        ],
    )


@router.post("/{slug}/avances", response_model=AvanceResponse)
async def upsert_avance(
    slug: str,
    payload: AvanceUpsertRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    entity = get_entity_or_404(db, slug)
    ensure_user_can_manage_entity(current_user, entity)

    row = db.query(PdmAvance).filter(
        PdmAvance.entity_id == entity.id,
        PdmAvance.codigo_indicador_producto == payload.codigo_indicador_producto,
        PdmAvance.anio == payload.anio,
    ).first()

    if row:
        row.valor_ejecutado = payload.valor_ejecutado
        row.comentario = payload.comentario
    else:
        row = PdmAvance(
            entity_id=entity.id,
            codigo_indicador_producto=payload.codigo_indicador_producto,
            anio=payload.anio,
            valor_ejecutado=payload.valor_ejecutado,
            comentario=payload.comentario,
        )
        db.add(row)

    db.commit()
    db.refresh(row)

    return AvanceResponse(
        entity_id=row.entity_id,
        codigo_indicador_producto=row.codigo_indicador_producto,
        anio=row.anio,
        valor_ejecutado=row.valor_ejecutado,
        comentario=row.comentario,
    )


@router.get("/{slug}/actividades", response_model=ActividadesListResponse)
async def get_actividades(
    slug: str,
    codigo: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    entity = get_entity_or_404(db, slug)
    ensure_user_can_manage_entity(current_user, entity)

    rows = db.query(PdmActividad).filter(
        PdmActividad.entity_id == entity.id,
        PdmActividad.codigo_indicador_producto == codigo,
    ).order_by(PdmActividad.created_at.desc()).all()

    return ActividadesListResponse(
        codigo_indicador_producto=codigo,
        actividades=[
            ActividadResponse(
                id=row.id,
                entity_id=row.entity_id,
                codigo_indicador_producto=row.codigo_indicador_producto,
                nombre=row.nombre,
                descripcion=row.descripcion,
                responsable=row.responsable,
                fecha_inicio=row.fecha_inicio.isoformat() if row.fecha_inicio else None,
                fecha_fin=row.fecha_fin.isoformat() if row.fecha_fin else None,
                estado=row.estado,
                anio=row.anio if row.anio is not None else 0,
                meta_ejecutar=row.meta_ejecutar if row.meta_ejecutar is not None else 0.0,
                valor_ejecutado=row.valor_ejecutado if row.valor_ejecutado is not None else 0.0,
                created_at=row.created_at.isoformat() if row.created_at else '',
                updated_at=row.updated_at.isoformat() if row.updated_at else '',
            )
            for row in rows
        ],
    )


@router.post("/{slug}/actividades/bulk", response_model=ActividadesBulkResponse)
async def get_actividades_bulk(
    slug: str,
    payload: ActividadesBulkRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Obtiene actividades para múltiples códigos en una sola consulta.
    Límite: máximo 100 códigos por request para evitar timeouts.
    """
    try:
        entity = get_entity_or_404(db, slug)
        ensure_user_can_manage_entity(current_user, entity)

        codigos = [c for c in (payload.codigos or []) if c]
        if not codigos:
            return {"items": {}}
        
        # Limitar cantidad de códigos para evitar queries muy pesadas
        if len(codigos) > 100:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Máximo 100 códigos por request. Divida la consulta en lotes más pequeños."
            )

        # Query optimizada con limit para evitar cargar todo en memoria
        rows = (
            db.query(PdmActividad)
            .filter(
                PdmActividad.entity_id == entity.id,
                PdmActividad.codigo_indicador_producto.in_(codigos),
            )
            .order_by(PdmActividad.codigo_indicador_producto.asc(), PdmActividad.created_at.desc())
            .limit(1000)  # Límite de seguridad
            .all()
        )
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error en actividades/bulk: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error cargando actividades: {str(e)}"
        )

    items: Dict[str, List[ActividadResponse]] = {c: [] for c in codigos}
    for row in rows:
        ar = ActividadResponse(
            id=row.id,
            entity_id=row.entity_id,
            codigo_indicador_producto=row.codigo_indicador_producto,
            nombre=row.nombre,
            descripcion=row.descripcion,
            responsable=row.responsable,
            fecha_inicio=row.fecha_inicio.isoformat() if row.fecha_inicio else None,
            fecha_fin=row.fecha_fin.isoformat() if row.fecha_fin else None,
            estado=row.estado,
            anio=row.anio if row.anio is not None else 0,
            meta_ejecutar=row.meta_ejecutar if row.meta_ejecutar is not None else 0.0,
            valor_ejecutado=row.valor_ejecutado if row.valor_ejecutado is not None else 0.0,
            created_at=row.created_at.isoformat() if row.created_at else '',
            updated_at=row.updated_at.isoformat() if row.updated_at else '',
        )
        items.setdefault(row.codigo_indicador_producto, []).append(ar)

    return {"items": items}


@router.post("/{slug}/actividades", response_model=ActividadResponse, status_code=status.HTTP_201_CREATED)
async def create_actividad(
    slug: str,
    payload: ActividadCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    entity = get_entity_or_404(db, slug)
    ensure_user_can_manage_entity(current_user, entity)

    from datetime import datetime as dt
    from datetime import datetime

    # Validaciones de negocio
    if payload.fecha_inicio and not payload.fecha_fin:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Si diligencias fecha_inicio debes diligenciar fecha_fin")
    if payload.fecha_fin and not payload.fecha_inicio:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Si diligencias fecha_fin debes diligenciar fecha_inicio")
    if payload.fecha_inicio and payload.fecha_fin:
        try:
            d1 = datetime.fromisoformat(payload.fecha_inicio)
            d2 = datetime.fromisoformat(payload.fecha_fin)
            if d1 > d2:
                raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="La fecha de inicio no puede ser mayor a la fecha de fin")
        except ValueError:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Formato de fecha inválido. Use ISO 8601 (YYYY-MM-DD)")
    # Validar estado permitido
    estados_permitidos = {"pendiente", "en_progreso", "completada", "cancelada"}
    if payload.estado and payload.estado not in estados_permitidos:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Estado inválido para actividad")

    # Validaciones de anio/meta
    if payload.anio < 2000 or payload.anio > 2100:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Año de ejecución inválido")
    if payload.meta_ejecutar < 0:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="La meta a ejecutar debe ser >= 0")
    if payload.valor_ejecutado < 0:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="El valor ejecutado debe ser >= 0")

    nueva_actividad = PdmActividad(
        entity_id=entity.id,
        codigo_indicador_producto=payload.codigo_indicador_producto,
        nombre=payload.nombre,
        descripcion=payload.descripcion,
        responsable=(payload.responsable or None),
        fecha_inicio=dt.fromisoformat(payload.fecha_inicio) if payload.fecha_inicio else None,
        fecha_fin=dt.fromisoformat(payload.fecha_fin) if payload.fecha_fin else None,
        estado=payload.estado,
        anio=payload.anio,
        meta_ejecutar=payload.meta_ejecutar,
        valor_ejecutado=payload.valor_ejecutado,
    )

    db.add(nueva_actividad)
    db.commit()
    db.refresh(nueva_actividad)

    # Crear alertas para secretarios asignados al producto
    try:
        assignment = db.query(PdmMetaAssignment).filter(
            PdmMetaAssignment.entity_id == entity.id,
            PdmMetaAssignment.codigo_indicador_producto == payload.codigo_indicador_producto
        ).first()
        
        if assignment and assignment.secretaria:
            secretarios = db.query(User).filter(
                User.role == UserRole.SECRETARIO,
                User.entity_id == entity.id,
                User.secretaria == assignment.secretaria
            ).all()
            
            for secretario in secretarios:
                db.add(Alert(
                    entity_id=entity.id,
                    recipient_user_id=secretario.id,
                    type="PDM_NEW_ACTIVITY",
                    title=f"Nueva actividad en PDM",
                    message=f"Se creó la actividad '{nueva_actividad.nombre}' para el producto {payload.codigo_indicador_producto}",
                    data=json.dumps({
                        "codigo_indicador_producto": payload.codigo_indicador_producto,
                        "actividad_id": nueva_actividad.id
                    }),
                ))
            db.commit()
    except Exception as e:
        db.rollback()
        # No interrumpir el flujo por alertas
        print(f"Error creando alertas de nueva actividad: {e}")

    return ActividadResponse(
        id=nueva_actividad.id,
        entity_id=nueva_actividad.entity_id,
        codigo_indicador_producto=nueva_actividad.codigo_indicador_producto,
        nombre=nueva_actividad.nombre,
        descripcion=nueva_actividad.descripcion,
        responsable=nueva_actividad.responsable,
        fecha_inicio=nueva_actividad.fecha_inicio.isoformat() if nueva_actividad.fecha_inicio else None,
        fecha_fin=nueva_actividad.fecha_fin.isoformat() if nueva_actividad.fecha_fin else None,
        estado=nueva_actividad.estado,
        anio=nueva_actividad.anio if nueva_actividad.anio is not None else 0,
        meta_ejecutar=nueva_actividad.meta_ejecutar,
        valor_ejecutado=nueva_actividad.valor_ejecutado,
        created_at=nueva_actividad.created_at.isoformat() if nueva_actividad.created_at else '',
        updated_at=nueva_actividad.updated_at.isoformat() if nueva_actividad.updated_at else '',
    )


@router.put("/{slug}/actividades/{actividad_id}", response_model=ActividadResponse)
async def update_actividad(
    slug: str,
    actividad_id: int,
    payload: ActividadUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    entity = get_entity_or_404(db, slug)
    ensure_user_can_manage_entity(current_user, entity)

    actividad = db.query(PdmActividad).filter(
        PdmActividad.id == actividad_id,
        PdmActividad.entity_id == entity.id,
    ).first()

    if not actividad:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Actividad no encontrada")

    from datetime import datetime as dt

    if payload.nombre is not None:
        actividad.nombre = payload.nombre
    if payload.descripcion is not None:
        actividad.descripcion = payload.descripcion
    if payload.responsable is not None:
        actividad.responsable = (payload.responsable or None)
    if payload.fecha_inicio is not None:
        actividad.fecha_inicio = dt.fromisoformat(payload.fecha_inicio) if payload.fecha_inicio else None
    if payload.fecha_fin is not None:
        actividad.fecha_fin = dt.fromisoformat(payload.fecha_fin) if payload.fecha_fin else None
    if payload.anio is not None:
        actividad.anio = payload.anio
    if payload.meta_ejecutar is not None:
        actividad.meta_ejecutar = payload.meta_ejecutar
    if payload.valor_ejecutado is not None:
        actividad.valor_ejecutado = payload.valor_ejecutado
    if payload.estado is not None:
        estados_permitidos = {"pendiente", "en_progreso", "completada", "cancelada"}
        if payload.estado not in estados_permitidos:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Estado inválido para actividad")
        actividad.estado = payload.estado

    # Validar consistencia de fechas cuando ambas presentes
    if actividad.fecha_inicio and actividad.fecha_fin and actividad.fecha_inicio > actividad.fecha_fin:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="La fecha de inicio no puede ser mayor a la fecha de fin")

    db.commit()
    db.refresh(actividad)

    return ActividadResponse(
        id=actividad.id,
        entity_id=actividad.entity_id,
        codigo_indicador_producto=actividad.codigo_indicador_producto,
        nombre=actividad.nombre,
        descripcion=actividad.descripcion,
        responsable=actividad.responsable,
        fecha_inicio=actividad.fecha_inicio.isoformat() if actividad.fecha_inicio else None,
        fecha_fin=actividad.fecha_fin.isoformat() if actividad.fecha_fin else None,
        estado=actividad.estado,
        anio=actividad.anio if actividad.anio is not None else 0,
        meta_ejecutar=actividad.meta_ejecutar,
        valor_ejecutado=actividad.valor_ejecutado,
        created_at=actividad.created_at.isoformat() if actividad.created_at else '',
        updated_at=actividad.updated_at.isoformat() if actividad.updated_at else '',
    )


@router.delete("/{slug}/actividades/{actividad_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_actividad(
    slug: str,
    actividad_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    entity = get_entity_or_404(db, slug)
    ensure_user_can_manage_entity(current_user, entity)

    actividad = db.query(PdmActividad).filter(
        PdmActividad.id == actividad_id,
        PdmActividad.entity_id == entity.id,
    ).first()

    if not actividad:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Actividad no encontrada")

    db.delete(actividad)
    db.commit()
    return None


# ============================================================================
# ENDPOINTS PARA GESTIÓN DE EVIDENCIAS DE ACTIVIDADES
# ============================================================================

@router.post("/{slug}/actividades/{actividad_id}/evidencias", response_model=dict)
async def create_evidencia(
    slug: str,
    actividad_id: int,
    payload: EvidenciaCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Crea evidencias para una actividad. Puede incluir descripción, URL y/o imágenes.
    Al menos uno de los campos debe estar presente.
    """
    from app.models.pdm import PdmActividadEvidencia
    from app.schemas.pdm import EvidenciaCreateRequest
    import base64
    
    entity = get_entity_or_404(db, slug)
    ensure_user_can_manage_entity(current_user, entity)

    # Verificar que la actividad existe
    actividad = db.query(PdmActividad).filter(
        PdmActividad.id == actividad_id,
        PdmActividad.entity_id == entity.id,
    ).first()

    if not actividad:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Actividad no encontrada")

    # Validar que al menos un campo esté presente
    tiene_descripcion = payload.descripcion and payload.descripcion.strip()
    tiene_url = payload.url and payload.url.strip()
    tiene_imagenes = payload.imagenes and len(payload.imagenes) > 0

    if not (tiene_descripcion or tiene_url or tiene_imagenes):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Debe proporcionar al menos descripción, URL o imágenes"
        )

    evidencias_creadas = []

    # Crear evidencia con descripción y/o URL
    if tiene_descripcion or tiene_url:
        evidencia = PdmActividadEvidencia(
            actividad_id=actividad_id,
            entity_id=entity.id,
            descripcion=payload.descripcion if tiene_descripcion else None,
            url=payload.url if tiene_url else None,
        )
        db.add(evidencia)
        evidencias_creadas.append("texto")

    # Crear evidencias para cada imagen
    if tiene_imagenes:
        # Validar máximo 4 imágenes
        if len(payload.imagenes) > 4:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Máximo 4 imágenes permitidas"
            )

        for img in payload.imagenes:
            # Validar tamaño (2MB)
            tamano = img.get('tamano', 0)
            if tamano > 2 * 1024 * 1024:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"La imagen {img.get('nombre', 'sin nombre')} supera el tamaño máximo de 2MB"
                )

            # Decodificar base64
            contenido_base64 = img.get('contenido_base64', '')
            try:
                contenido_binario = base64.b64decode(contenido_base64)
            except Exception:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="Error al decodificar la imagen"
                )

            evidencia_img = PdmActividadEvidencia(
                actividad_id=actividad_id,
                entity_id=entity.id,
                nombre_imagen=img.get('nombre'),
                mime_type=img.get('mime_type'),
                tamano=tamano,
                contenido=contenido_binario,
            )
            db.add(evidencia_img)
            evidencias_creadas.append("imagen")

    db.commit()
    
    return {
        "message": "Evidencias creadas exitosamente",
        "count": len(evidencias_creadas)
    }


@router.get("/{slug}/actividades/{actividad_id}/evidencias", response_model=EvidenciasListResponse)
async def get_evidencias(
    slug: str,
    actividad_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Obtiene todas las evidencias de una actividad.
    """
    from app.models.pdm import PdmActividadEvidencia
    from app.schemas.pdm import EvidenciaResponse, EvidenciasListResponse
    import base64
    
    entity = get_entity_or_404(db, slug)
    
    # Verificar que la actividad existe
    actividad = db.query(PdmActividad).filter(
        PdmActividad.id == actividad_id,
        PdmActividad.entity_id == entity.id,
    ).first()

    if not actividad:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Actividad no encontrada")

    evidencias = db.query(PdmActividadEvidencia).filter(
        PdmActividadEvidencia.actividad_id == actividad_id,
        PdmActividadEvidencia.entity_id == entity.id,
    ).all()

    # Convertir a response
    evidencias_response = []
    for ev in evidencias:
        contenido_base64 = None
        if ev.contenido:
            contenido_base64 = base64.b64encode(ev.contenido).decode('utf-8')
        
        evidencias_response.append(EvidenciaResponse(
            id=ev.id,
            actividad_id=getattr(ev, 'actividad_id', None),
            entity_id=ev.entity_id,
            descripcion=ev.descripcion,
            url=ev.url,
            nombre_imagen=ev.nombre_imagen,
            mime_type=ev.mime_type,
            tamano=ev.tamano,
            contenido_base64=contenido_base64,
            contenido=contenido_base64,
            created_at=ev.created_at.isoformat() if ev.created_at else '',
            updated_at=ev.updated_at.isoformat() if ev.updated_at else '',
        ))

    return EvidenciasListResponse(
        actividad_id=actividad_id,
        evidencias=evidencias_response
    )


@router.delete("/{slug}/actividades/{actividad_id}/evidencias/{evidencia_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_evidencia(
    slug: str,
    actividad_id: int,
    evidencia_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Elimina una evidencia específica.
    """
    from app.models.pdm import PdmActividadEvidencia
    
    entity = get_entity_or_404(db, slug)
    ensure_user_can_manage_entity(current_user, entity)

    evidencia = db.query(PdmActividadEvidencia).filter(
        PdmActividadEvidencia.id == evidencia_id,
        PdmActividadEvidencia.actividad_id == actividad_id,
        PdmActividadEvidencia.entity_id == entity.id,
    ).first()

    if not evidencia:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Evidencia no encontrada")

    db.delete(evidencia)
    db.commit()
    return None


# ============================================================================
# ENDPOINTS PARA GESTIÓN DE EJECUCIONES DE ACTIVIDADES
# ============================================================================

@router.post("/{slug}/actividades/{actividad_id}/ejecuciones", response_model=EjecucionResponse)
async def crear_ejecucion(
    slug: str,
    actividad_id: int,
    ejecucion_data: EjecucionCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Crea una nueva ejecución de actividad con evidencias opcionales.
    El valor_ejecutado_incremento se suma al total ejecutado de la actividad.
    """
    entity = get_entity_or_404(db, slug)
    ensure_user_can_manage_entity(current_user, entity)

    # Verificar que la actividad existe
    actividad = db.query(PdmActividad).filter(
        PdmActividad.id == actividad_id,
        PdmActividad.entity_id == entity.id,
    ).first()

    if not actividad:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Actividad no encontrada")

    # Crear la ejecución
    nueva_ejecucion = PdmActividadEjecucion(
        actividad_id=actividad_id,
        entity_id=entity.id,
        valor_ejecutado_incremento=ejecucion_data.valor_ejecutado_incremento,
        descripcion=ejecucion_data.descripcion,
        url_evidencia=ejecucion_data.url_evidencia,
        registrado_por=ejecucion_data.registrado_por or current_user.email,
    )

    db.add(nueva_ejecucion)
    db.flush()  # Para obtener el ID de la ejecución

    # Crear las evidencias si existen
    evidencias_response = []
    if ejecucion_data.imagenes:
        for imagen in ejecucion_data.imagenes:
            # Decodificar el contenido base64 (campo unificado contenido_base64 con alias contenido)
            raw_b64 = getattr(imagen, 'contenido_base64', None) or getattr(imagen, 'contenido', None)
            try:
                contenido_bytes = base64.b64decode(raw_b64 or '')
            except Exception as e:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Error al decodificar imagen base64: {str(e)}"
                )

            evidencia = PdmActividadEvidencia(
                ejecucion_id=nueva_ejecucion.id,
                entity_id=entity.id,
                nombre_imagen=imagen.nombre_imagen,
                mime_type=imagen.mime_type,
                tamano=imagen.tamano,
                contenido=contenido_bytes,
            )
            db.add(evidencia)
            db.flush()

            evidencias_response.append(EvidenciaImagenResponse(
                id=evidencia.id,
                nombre_imagen=evidencia.nombre_imagen,
                mime_type=evidencia.mime_type,
                tamano=evidencia.tamano,
                contenido_base64=raw_b64,
                contenido=raw_b64,
                created_at=evidencia.created_at.isoformat() if evidencia.created_at else ''
            ))

    # Actualizar el valor_ejecutado de la actividad (suma de todas las ejecuciones)
    total_ejecutado = db.query(func.sum(PdmActividadEjecucion.valor_ejecutado_incremento)).filter(
        PdmActividadEjecucion.actividad_id == actividad_id
    ).scalar() or 0.0

    actividad.valor_ejecutado = float(total_ejecutado)

    db.commit()
    db.refresh(nueva_ejecucion)

    return EjecucionResponse(
        id=nueva_ejecucion.id,
        actividad_id=nueva_ejecucion.actividad_id,
        entity_id=nueva_ejecucion.entity_id,
        valor_ejecutado_incremento=nueva_ejecucion.valor_ejecutado_incremento,
        descripcion=nueva_ejecucion.descripcion,
        url_evidencia=nueva_ejecucion.url_evidencia,
        registrado_por=nueva_ejecucion.registrado_por,
        created_at=nueva_ejecucion.created_at.isoformat() if nueva_ejecucion.created_at else '',
        updated_at=nueva_ejecucion.updated_at.isoformat() if nueva_ejecucion.updated_at else '',
        imagenes=evidencias_response,
    )


@router.get("/{slug}/actividades/{actividad_id}/ejecuciones", response_model=EjecucionesListResponse)
async def get_ejecuciones(
    slug: str,
    actividad_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Obtiene el historial de ejecuciones de una actividad con sus evidencias.
    Incluye el total ejecutado acumulado.
    """
    entity = get_entity_or_404(db, slug)
    
    # Verificar que la actividad existe
    actividad = db.query(PdmActividad).filter(
        PdmActividad.id == actividad_id,
        PdmActividad.entity_id == entity.id,
    ).first()

    if not actividad:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Actividad no encontrada")

    # Obtener todas las ejecuciones ordenadas por fecha (más reciente primero)
    ejecuciones = db.query(PdmActividadEjecucion).filter(
        PdmActividadEjecucion.actividad_id == actividad_id,
        PdmActividadEjecucion.entity_id == entity.id,
    ).order_by(PdmActividadEjecucion.created_at.desc()).all()

    # Calcular total ejecutado
    total_ejecutado = db.query(func.sum(PdmActividadEjecucion.valor_ejecutado_incremento)).filter(
        PdmActividadEjecucion.actividad_id == actividad_id
    ).scalar() or 0.0

    # Convertir a response con evidencias
    ejecuciones_response = []
    for ejecucion in ejecuciones:
        # Obtener evidencias de esta ejecución
        evidencias = db.query(PdmActividadEvidencia).filter(
            PdmActividadEvidencia.ejecucion_id == ejecucion.id,
            PdmActividadEvidencia.entity_id == entity.id,
        ).all()

        evidencias_response = []
        for ev in evidencias:
            contenido_base64 = None
            if ev.contenido:
                contenido_base64 = base64.b64encode(ev.contenido).decode('utf-8')
            
            evidencias_response.append(EvidenciaImagenResponse(
                id=ev.id,
                nombre_imagen=ev.nombre_imagen,
                mime_type=ev.mime_type,
                tamano=ev.tamano,
                contenido_base64=contenido_base64,
                contenido=contenido_base64,
                created_at=ev.created_at.isoformat() if ev.created_at else ''
            ))

        ejecuciones_response.append(EjecucionResponse(
            id=ejecucion.id,
            actividad_id=ejecucion.actividad_id,
            entity_id=ejecucion.entity_id,
            valor_ejecutado_incremento=ejecucion.valor_ejecutado_incremento,
            descripcion=ejecucion.descripcion,
            url_evidencia=ejecucion.url_evidencia,
            registrado_por=ejecucion.registrado_por,
            created_at=ejecucion.created_at.isoformat() if ejecucion.created_at else '',
            updated_at=ejecucion.updated_at.isoformat() if ejecucion.updated_at else '',
            imagenes=evidencias_response,
        ))

    return EjecucionesListResponse(
        actividad_id=actividad_id,
        total_ejecutado=float(total_ejecutado),
        ejecuciones=ejecuciones_response,
    )


@router.delete("/{slug}/actividades/{actividad_id}/ejecuciones/{ejecucion_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_ejecucion(
    slug: str,
    actividad_id: int,
    ejecucion_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Elimina una ejecución específica y recalcula el valor_ejecutado de la actividad.
    Las evidencias asociadas se eliminan automáticamente por cascade.
    """
    entity = get_entity_or_404(db, slug)
    ensure_user_can_manage_entity(current_user, entity)

    ejecucion = db.query(PdmActividadEjecucion).filter(
        PdmActividadEjecucion.id == ejecucion_id,
        PdmActividadEjecucion.actividad_id == actividad_id,
        PdmActividadEjecucion.entity_id == entity.id,
    ).first()

    if not ejecucion:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ejecución no encontrada")

    db.delete(ejecucion)
    
    # Recalcular el valor_ejecutado de la actividad
    total_ejecutado = db.query(func.sum(PdmActividadEjecucion.valor_ejecutado_incremento)).filter(
        PdmActividadEjecucion.actividad_id == actividad_id
    ).scalar() or 0.0

    actividad = db.query(PdmActividad).filter(
        PdmActividad.id == actividad_id,
        PdmActividad.entity_id == entity.id,
    ).first()

    if actividad:
        actividad.valor_ejecutado = float(total_ejecutado)

    db.commit()
    return None


# ============================================================================
# ENDPOINTS PARA GESTIÓN DE ARCHIVO EXCEL PDM
# ============================================================================

@router.post("/{slug}/upload-excel", response_model=ExcelUploadResponse)
async def upload_excel(
    slug: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Sube un archivo Excel del PDM y lo almacena en la base de datos.
    Si ya existe un archivo para esta entidad, lo reemplaza.
    """
    entity = get_entity_or_404(db, slug)
    ensure_user_can_manage_entity(current_user, entity)

    # Validar tipo de archivo
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El archivo debe ser un Excel válido (.xlsx o .xls)"
        )

    # Leer contenido del archivo
    contenido = await file.read()
    tamanio = len(contenido)

    # Validar tamaño (máximo 10MB)
    max_size = 10 * 1024 * 1024
    if tamanio > max_size:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El archivo es demasiado grande. Máximo 10MB."
        )

    # Verificar si ya existe un archivo para esta entidad
    archivo_existente = db.query(PdmArchivoExcel).filter(
        PdmArchivoExcel.entity_id == entity.id
    ).first()

    if archivo_existente:
        # Actualizar archivo existente
        archivo_existente.nombre_archivo = file.filename
        archivo_existente.contenido = contenido
        archivo_existente.tamanio = tamanio
        from datetime import datetime
        archivo_existente.updated_at = datetime.utcnow()
        mensaje = "Archivo Excel actualizado correctamente"
    else:
        # Crear nuevo registro
        nuevo_archivo = PdmArchivoExcel(
            entity_id=entity.id,
            nombre_archivo=file.filename,
            contenido=contenido,
            tamanio=tamanio
        )
        db.add(nuevo_archivo)
        mensaje = "Archivo Excel cargado correctamente"

    db.commit()

    # Obtener el archivo actualizado
    archivo = db.query(PdmArchivoExcel).filter(
        PdmArchivoExcel.entity_id == entity.id
    ).first()

    return ExcelUploadResponse(
        entity_id=archivo.entity_id,
        nombre_archivo=archivo.nombre_archivo,
        tamanio=archivo.tamanio,
        created_at=archivo.created_at,
        mensaje=mensaje
    )


@router.get("/{slug}/excel-info", response_model=ExcelInfoResponse)
async def get_excel_info(
    slug: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Obtiene información sobre el archivo Excel almacenado para esta entidad.
    """
    entity = get_entity_or_404(db, slug)
    ensure_user_can_manage_entity(current_user, entity)

    archivo = db.query(PdmArchivoExcel).filter(
        PdmArchivoExcel.entity_id == entity.id
    ).first()

    if not archivo:
        return ExcelInfoResponse(existe=False)

    return ExcelInfoResponse(
        existe=True,
        nombre_archivo=archivo.nombre_archivo,
        tamanio=archivo.tamanio,
        fecha_carga=archivo.created_at
    )


@router.get("/{slug}/download-excel")
async def download_excel(
    slug: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Descarga el archivo Excel almacenado en la base de datos.
    """
    try:
        entity = get_entity_or_404(db, slug)
        ensure_user_can_manage_entity(current_user, entity)

        archivo = db.query(PdmArchivoExcel).filter(
            PdmArchivoExcel.entity_id == entity.id
        ).first()

        if not archivo:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No se ha cargado ningún archivo Excel para esta entidad"
            )

        # Copiar contenido a memoria y cerrar sesión DB antes de streaming
        contenido_bytes = bytes(archivo.contenido) if archivo.contenido else b''
        nombre_archivo = archivo.nombre_archivo or "archivo.xlsx"
        
        # Cerrar explícitamente la sesión DB antes del streaming
        db.close()
        
        # Crear un stream del contenido
        excel_stream = BytesIO(contenido_bytes)
        excel_stream.seek(0)

        return StreamingResponse(
            excel_stream,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={
                "Content-Disposition": f"attachment; filename={nombre_archivo}"
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error en download_excel: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error descargando archivo: {str(e)}"
        )


@router.delete("/{slug}/delete-excel", status_code=status.HTTP_204_NO_CONTENT)
async def delete_excel(
    slug: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Elimina el archivo Excel almacenado para esta entidad.
    """
    entity = get_entity_or_404(db, slug)
    ensure_user_can_manage_entity(current_user, entity)

    archivo = db.query(PdmArchivoExcel).filter(
        PdmArchivoExcel.entity_id == entity.id
    ).first()

    if not archivo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No se ha cargado ningún archivo Excel para esta entidad"
        )

    db.delete(archivo)
    db.commit()
    return None
