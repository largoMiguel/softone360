from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List
from decimal import Decimal

class PDMEjecucionBase(BaseModel):
    codigo_producto: str
    descripcion_fte: str
    pto_inicial: Decimal = Decimal('0.00')
    adicion: Decimal = Decimal('0.00')
    reduccion: Decimal = Decimal('0.00')
    credito: Decimal = Decimal('0.00')
    contracredito: Decimal = Decimal('0.00')
    pto_definitivo: Decimal = Decimal('0.00')
    pagos: Decimal = Decimal('0.00')
    sector: Optional[str] = None
    dependencia: Optional[str] = None
    bpin: Optional[str] = None


class PDMEjecucionCreate(PDMEjecucionBase):
    entity_id: int


class PDMEjecucionResponse(PDMEjecucionBase):
    id: int
    entity_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class PDMEjecucionResumen(BaseModel):
    """Resumen de ejecución presupuestal por producto PDM"""
    codigo_producto: str
    fuentes: List[str]  # Lista única de DESCRIPCIÓN FTE.
    totales: dict  # Diccionario con totales de cada columna presupuestal
    
    class Config:
        from_attributes = True


class PDMEjecucionUploadResponse(BaseModel):
    """Respuesta del upload del Excel de ejecución"""
    success: bool
    message: str
    registros_procesados: int
    registros_insertados: int
    errores: List[str] = []
