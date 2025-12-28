"""
Endpoint para servicios de ingeniería vial y pavimentos.
Retorna información sobre los servicios ofrecidos por el ingeniero.
"""

from fastapi import APIRouter
from typing import List, Dict

router = APIRouter(prefix="/servicios-ingenieria", tags=["Servicios de Ingeniería"])


@router.get("")
async def get_servicios_ingenieria():
    """
    Retorna la información completa de servicios de ingeniería vial y pavimentos.
    Incluye lista de servicios, información de contacto y especialidades.
    """
    return {
        "titulo": "EXPERTOS EN INGENIERÍA VIAL Y PAVIMENTOS",
        "subtitulo": "Soluciones Integrales para Proyectos de Infraestructura Vial",
        "servicios": [
            {
                "id": 1,
                "nombre": "Diseño de pavimentos flexibles (asfáltico)",
                "descripcion": "Diseño estructural de pavimentos flexibles considerando tráfico, clima y materiales disponibles",
                "icono": "fas fa-road",
                "categoria": "diseño"
            },
            {
                "id": 2,
                "nombre": "Diseño de pavimentos rígidos (hormigón)",
                "descripcion": "Diseño de pavimentos de concreto hidráulico para diferentes condiciones de carga",
                "icono": "fas fa-cube",
                "categoria": "diseño"
            },
            {
                "id": 3,
                "nombre": "Diseño de pavimento articulado (adoquín)",
                "descripcion": "Diseño de pavimentos con adoquines de concreto para zonas urbanas y rurales",
                "icono": "fas fa-th",
                "categoria": "diseño"
            },
            {
                "id": 4,
                "nombre": "Cálculo de espesores de capa",
                "descripcion": "Determinación técnica de espesores óptimos para cada capa del pavimento",
                "icono": "fas fa-layer-group",
                "categoria": "cálculo"
            },
            {
                "id": 5,
                "nombre": "Diseño de fondo",
                "descripcion": "Diseño de capas de base, subbase y subrasante para pavimentos",
                "icono": "fas fa-arrows-alt-v",
                "categoria": "diseño"
            },
            {
                "id": 6,
                "nombre": "Diseños Hidrosanitarios",
                "descripcion": "Diseño de sistemas de drenaje, alcantarillado pluvial y sanitario para proyectos viales",
                "icono": "fas fa-water",
                "categoria": "hidrosanitario"
            },
            {
                "id": 7,
                "nombre": "Elaboración de presupuestos detallados para proyecto vial",
                "descripcion": "Presupuestos técnicos con análisis de precios unitarios y especificaciones",
                "icono": "fas fa-calculator",
                "categoria": "presupuesto"
            },
            {
                "id": 8,
                "nombre": "Análisis de precios unitarios",
                "descripcion": "Descomposición detallada de costos para cada actividad del proyecto",
                "icono": "fas fa-coins",
                "categoria": "presupuesto"
            },
            {
                "id": 9,
                "nombre": "Asesoría y revisión de proyectos",
                "descripcion": "Consultoría especializada y revisión técnica de diseños viales",
                "icono": "fas fa-clipboard-check",
                "categoria": "consultoria"
            },
            {
                "id": 10,
                "nombre": "Memorias de cantidades",
                "descripcion": "Documentación técnica de cantidades de obra y materiales",
                "icono": "fas fa-file-alt",
                "categoria": "documentacion"
            },
            {
                "id": 11,
                "nombre": "Cronograma",
                "descripcion": "Programación temporal de actividades y entregables del proyecto",
                "icono": "fas fa-calendar-alt",
                "categoria": "planificacion"
            }
        ],
        "contacto": {
            "nombre": "WILMAR STEVEN LOPEZ REYES",
            "profesion": "Ingeniero Civil",
            "email": "ingenialalopez@gmail.com",
            "telefono": "320 9963119",
            "especialidad": "Ingeniería Vial y Pavimentos"
        },
        "categorias": [
            {
                "nombre": "Diseño",
                "descripcion": "Diseños técnicos de pavimentos y estructuras viales",
                "color": "#0d6efd"
            },
            {
                "nombre": "Cálculo",
                "descripcion": "Cálculos estructurales y dimensionamiento",
                "color": "#198754"
            },
            {
                "nombre": "Hidrosanitario",
                "descripcion": "Sistemas de drenaje y alcantarillado",
                "color": "#0dcaf0"
            },
            {
                "nombre": "Presupuesto",
                "descripcion": "Análisis económico y presupuestación",
                "color": "#ffc107"
            },
            {
                "nombre": "Consultoría",
                "descripcion": "Asesoría técnica especializada",
                "color": "#6f42c1"
            },
            {
                "nombre": "Documentación",
                "descripcion": "Memorias técnicas y especificaciones",
                "color": "#fd7e14"
            },
            {
                "nombre": "Planificación",
                "descripcion": "Programación y control de proyectos",
                "color": "#dc3545"
            }
        ],
        "estadisticas": {
            "anios_experiencia": "10+",
            "proyectos_completados": "50+",
            "clientes_satisfechos": "30+",
            "ciudades_atendidas": "15+"
        },
        "ventajas": [
            "Experiencia comprobada en proyectos viales",
            "Cumplimiento de normativa técnica vigente",
            "Uso de software especializado",
            "Respuesta rápida y profesional",
            "Precios competitivos",
            "Asesoría permanente durante el proyecto"
        ]
    }


@router.get("/servicios")
async def get_lista_servicios():
    """
    Retorna únicamente la lista de servicios disponibles.
    """
    data = await get_servicios_ingenieria()
    return {
        "servicios": data["servicios"],
        "total": len(data["servicios"])
    }


@router.get("/contacto")
async def get_contacto():
    """
    Retorna la información de contacto del ingeniero.
    """
    data = await get_servicios_ingenieria()
    return data["contacto"]
