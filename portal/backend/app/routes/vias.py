"""
Endpoints para el módulo de Seguimiento de Vías Intervenidas.

Flujo:
- POST /vias/viajes       → conductor de volqueta registra un punto de descarga (público)
- POST /vias/viajes/batch → sincronización batch cuando recupera señal (público)
- POST /vias/tramos       → operador registra un tramo de maquinaria (público)
- POST /vias/tramos/batch → sincronización batch cuando recupera señal (público)
- GET  /vias/mapa         → panel admin: puntos y tramos para el mapa (requiere auth)
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime

from app.config.database import get_db
from app.models.vias import ViaViaje, ViaTramo
from app.models.entity import Entity
from app.schemas.vias import (
    ViaViajeCreate, ViaViajeResponse,
    ViaTramoCreate, ViaTramoResponse,
    ViaBatchViajesRequest, ViaBatchTramosRequest,
    ViaMapaResponse,
)
from app.utils.auth import get_current_active_user
from app.models.user import User

router = APIRouter(prefix="/vias", tags=["Vías Intervenidas"])


def _resolver_entidad(entity_slug: str, db: Session) -> Entity:
    entity = db.query(Entity).filter(Entity.slug == entity_slug, Entity.is_active == True).first()
    if not entity:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Entidad '{entity_slug}' no encontrada"
        )
    return entity


# ─────────────────────────────────────────
# VOLQUETA — registro de puntos de descarga
# ─────────────────────────────────────────

@router.post("/viajes", response_model=ViaViajeResponse, status_code=status.HTTP_201_CREATED)
def registrar_viaje(data: ViaViajeCreate, db: Session = Depends(get_db)):
    """
    Registra un punto de descarga de volqueta.
    Endpoint público — se llama desde el formulario móvil del conductor.
    """
    entity = _resolver_entidad(data.entity_slug, db)

    viaje = ViaViaje(
        entity_id=entity.id,
        conductor_nombre=data.conductor_nombre.strip(),
        placa_vehiculo=data.placa_vehiculo.strip().upper(),
        tipo_material=data.tipo_material,
        observacion=data.observacion,
        latitud=data.latitud,
        longitud=data.longitud,
        timestamp_registro=data.timestamp_registro,
    )
    db.add(viaje)
    db.commit()
    db.refresh(viaje)
    return viaje


@router.post("/viajes/batch", status_code=status.HTTP_200_OK)
def registrar_viajes_batch(data: ViaBatchViajesRequest, db: Session = Depends(get_db)):
    """
    Registra múltiples viajes de una sola vez.
    Se llama cuando el conductor recupera señal y sincroniza los registros pendientes.
    """
    guardados = 0
    errores = []

    for i, viaje_data in enumerate(data.viajes):
        try:
            entity = _resolver_entidad(viaje_data.entity_slug, db)
            viaje = ViaViaje(
                entity_id=entity.id,
                conductor_nombre=viaje_data.conductor_nombre.strip(),
                placa_vehiculo=viaje_data.placa_vehiculo.strip().upper(),
                tipo_material=viaje_data.tipo_material,
                observacion=viaje_data.observacion,
                latitud=viaje_data.latitud,
                longitud=viaje_data.longitud,
                timestamp_registro=viaje_data.timestamp_registro,
            )
            db.add(viaje)
            guardados += 1
        except HTTPException as e:
            errores.append({"index": i, "detalle": e.detail})
        except Exception as e:
            errores.append({"index": i, "detalle": str(e)})

    db.commit()
    return {"guardados": guardados, "errores": errores}


# ─────────────────────────────────────────────────────
# MAQUINARIA AMARILLA — registro de tramos intervenidos
# ─────────────────────────────────────────────────────

@router.post("/tramos", response_model=ViaTramoResponse, status_code=status.HTTP_201_CREATED)
def registrar_tramo(data: ViaTramoCreate, db: Session = Depends(get_db)):
    """
    Registra un tramo intervenido por maquinaria amarilla.
    Endpoint público — se llama desde el formulario móvil del operador.
    """
    entity = _resolver_entidad(data.entity_slug, db)

    if data.timestamp_fin < data.timestamp_inicio:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="timestamp_fin debe ser posterior a timestamp_inicio"
        )

    tramo = ViaTramo(
        entity_id=entity.id,
        operador_nombre=data.operador_nombre.strip(),
        nombre_maquina=data.nombre_maquina.strip(),
        tipo_trabajo=data.tipo_trabajo,
        observacion=data.observacion,
        lat_inicio=data.lat_inicio,
        lng_inicio=data.lng_inicio,
        lat_fin=data.lat_fin,
        lng_fin=data.lng_fin,
        timestamp_inicio=data.timestamp_inicio,
        timestamp_fin=data.timestamp_fin,
    )
    db.add(tramo)
    db.commit()
    db.refresh(tramo)
    return tramo


@router.post("/tramos/batch", status_code=status.HTTP_200_OK)
def registrar_tramos_batch(data: ViaBatchTramosRequest, db: Session = Depends(get_db)):
    """
    Registra múltiples tramos de una sola vez.
    Se llama cuando el operador recupera señal y sincroniza los registros pendientes.
    """
    guardados = 0
    errores = []

    for i, tramo_data in enumerate(data.tramos):
        try:
            entity = _resolver_entidad(tramo_data.entity_slug, db)

            if tramo_data.timestamp_fin < tramo_data.timestamp_inicio:
                errores.append({"index": i, "detalle": "timestamp_fin anterior a timestamp_inicio"})
                continue

            tramo = ViaTramo(
                entity_id=entity.id,
                operador_nombre=tramo_data.operador_nombre.strip(),
                nombre_maquina=tramo_data.nombre_maquina.strip(),
                tipo_trabajo=tramo_data.tipo_trabajo,
                observacion=tramo_data.observacion,
                lat_inicio=tramo_data.lat_inicio,
                lng_inicio=tramo_data.lng_inicio,
                lat_fin=tramo_data.lat_fin,
                lng_fin=tramo_data.lng_fin,
                timestamp_inicio=tramo_data.timestamp_inicio,
                timestamp_fin=tramo_data.timestamp_fin,
            )
            db.add(tramo)
            guardados += 1
        except HTTPException as e:
            errores.append({"index": i, "detalle": e.detail})
        except Exception as e:
            errores.append({"index": i, "detalle": str(e)})

    db.commit()
    return {"guardados": guardados, "errores": errores}


# ─────────────────────────────────────
# PANEL ADMIN — datos para el mapa
# ─────────────────────────────────────

@router.get("/mapa", response_model=ViaMapaResponse)
def obtener_mapa(
    entity_slug: str = Query(...),
    fecha_inicio: Optional[str] = Query(None, description="Fecha ISO 8601, ej: 2026-03-01"),
    fecha_fin: Optional[str] = Query(None, description="Fecha ISO 8601, ej: 2026-03-31"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Retorna todos los viajes (puntos) y tramos (líneas) para pintar el mapa.
    Requiere autenticación — solo para el panel administrativo.
    """
    entity = _resolver_entidad(entity_slug, db)

    # Filtrar por entidad del usuario autenticado
    if current_user.entity_id and current_user.entity_id != entity.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tiene permisos para ver datos de esta entidad"
        )

    q_viajes = db.query(ViaViaje).filter(ViaViaje.entity_id == entity.id)
    q_tramos = db.query(ViaTramo).filter(ViaTramo.entity_id == entity.id)

    if fecha_inicio:
        try:
            dt_inicio = datetime.fromisoformat(fecha_inicio)
            q_viajes = q_viajes.filter(ViaViaje.timestamp_registro >= dt_inicio)
            q_tramos = q_tramos.filter(ViaTramo.timestamp_inicio >= dt_inicio)
        except ValueError:
            raise HTTPException(status_code=400, detail="fecha_inicio inválida, use formato ISO 8601")

    if fecha_fin:
        try:
            dt_fin = datetime.fromisoformat(fecha_fin)
            q_viajes = q_viajes.filter(ViaViaje.timestamp_registro <= dt_fin)
            q_tramos = q_tramos.filter(ViaTramo.timestamp_inicio <= dt_fin)
        except ValueError:
            raise HTTPException(status_code=400, detail="fecha_fin inválida, use formato ISO 8601")

    viajes = q_viajes.order_by(ViaViaje.timestamp_registro.desc()).all()
    tramos = q_tramos.order_by(ViaTramo.timestamp_inicio.desc()).all()

    return ViaMapaResponse(viajes=viajes, tramos=tramos)
