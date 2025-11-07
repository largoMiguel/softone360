from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Optional
from app.config.database import get_db
from app.models.alert import Alert
from app.models.user import User
from app.schemas.alert import AlertsListResponse, AlertResponse
from app.utils.auth import get_current_active_user
from datetime import datetime


router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.get("/", response_model=AlertsListResponse)
async def list_alerts(
    only_unread: bool = Query(False),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    q = db.query(Alert).filter(
        (Alert.recipient_user_id == current_user.id) | (Alert.recipient_user_id.is_(None))
    )
    if current_user.entity_id is not None:
        q = q.filter((Alert.entity_id == current_user.entity_id) | (Alert.entity_id.is_(None)))
    if only_unread:
        q = q.filter(Alert.read_at.is_(None))
    alerts = q.order_by(Alert.created_at.desc()).limit(limit).all()

    # Unread count
    unread_q = db.query(Alert).filter(
        (Alert.recipient_user_id == current_user.id) | (Alert.recipient_user_id.is_(None))
    )
    if current_user.entity_id is not None:
        unread_q = unread_q.filter((Alert.entity_id == current_user.entity_id) | (Alert.entity_id.is_(None)))
    unread_q = unread_q.filter(Alert.read_at.is_(None))
    unread_count = unread_q.count()

    return AlertsListResponse(
        unread_count=unread_count,
        alerts=[
            AlertResponse(
                id=a.id,
                entity_id=a.entity_id,
                recipient_user_id=a.recipient_user_id,
                type=a.type,
                title=a.title,
                message=a.message,
                data=a.data,
                created_at=a.created_at.isoformat() if a.created_at else "",
                read_at=a.read_at.isoformat() if a.read_at else None,
            )
            for a in alerts
        ],
    )


@router.post("/{alert_id}/read")
async def mark_alert_read(
    alert_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    a = db.query(Alert).filter(Alert.id == alert_id).first()
    if not a:
        return {"ok": False, "message": "Alerta no encontrada"}
    # Permitir marcar si eres destinatario o de tu entidad
    if a.recipient_user_id and a.recipient_user_id != current_user.id:
        return {"ok": False, "message": "No autorizado"}
    if a.entity_id and current_user.entity_id and a.entity_id != current_user.entity_id:
        return {"ok": False, "message": "No autorizado"}
    a.read_at = datetime.utcnow()
    db.commit()
    return {"ok": True}


@router.post("/read-all")
async def mark_all_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    q = db.query(Alert).filter(
        (Alert.recipient_user_id == current_user.id) | (Alert.recipient_user_id.is_(None))
    )
    if current_user.entity_id is not None:
        q = q.filter((Alert.entity_id == current_user.entity_id) | (Alert.entity_id.is_(None)))
    q = q.filter(Alert.read_at.is_(None))
    now = datetime.utcnow()
    for a in q.all():
        a.read_at = now
    db.commit()
    return {"ok": True}
