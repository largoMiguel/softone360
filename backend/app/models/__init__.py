# Archivo para hacer que sea un paquete Python
from app.models.user import User, UserRole
from app.models.entity import Entity
from app.models.pqrs import PQRS
from app.models.plan import (
    PlanInstitucional, 
    ComponenteProceso, 
    Actividad, 
    ActividadEjecucion,
    EstadoPlan,
    EstadoComponente,
    EstadoActividad,
    PrioridadActividad,
    TipoActividadEjecucion
)
from app.models.pdm import (
    PdmProducto,
    PdmActividad,
    PdmActividadEvidencia
)

__all__ = [
    "User", 
    "UserRole", 
    "Entity", 
    "PQRS", 
    "PlanInstitucional", 
    "ComponenteProceso",
    "Actividad",
    "ActividadEjecucion",
    "EstadoPlan",
    "EstadoComponente",
    "EstadoActividad",
    "PrioridadActividad",
    "TipoActividadEjecucion",
    "PdmProducto",
    "PdmActividad",
    "PdmActividadEvidencia"
]