from typing import Optional, List
from pydantic import BaseModel, Field


class AlertBase(BaseModel):
    type: str = Field(..., max_length=64)
    title: str = Field(..., max_length=256)
    message: Optional[str] = Field(None, max_length=1024)
    data: Optional[str] = None  # JSON serializado opcional


class AlertResponse(AlertBase):
    id: int
    entity_id: Optional[int]
    recipient_user_id: Optional[int]
    created_at: str
    read_at: Optional[str]

    class Config:
        from_attributes = True


class AlertsListResponse(BaseModel):
    unread_count: int
    alerts: List[AlertResponse]
