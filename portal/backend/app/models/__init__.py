# Archivo para hacer que sea un paquete Python
from app.models.user import User, UserRole
from app.models.entity import Entity
from app.models.secretaria import Secretaria
from app.models.pqrs import PQRS
from app.models.correspondencia import Correspondencia
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
from app.models.funcionario import (
    Funcionario,
    EquipoRegistro,
    RegistroAsistencia
)
from app.models.informe import InformeEstado
from app.models.vias import ViaViaje, ViaTramo

__all__ = [
    "User", 
    "UserRole", 
    "Entity",
    "Secretaria", 
    "PQRS",
    "Correspondencia",
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
    "PdmActividadEvidencia",
    "Funcionario",
    "EquipoRegistro",
    "RegistroAsistencia",
    "InformeEstado",
    "ViaViaje",
    "ViaTramo",
]