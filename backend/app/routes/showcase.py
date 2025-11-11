"""
Ruta para el endpoint de showcase.
Retorna información estática sobre características, módulos, beneficios, etc.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.config.database import get_db

router = APIRouter(prefix="/showcase", tags=["Showcase"])


@router.get("/db-audit")
async def db_audit(db: Session = Depends(get_db)):
    """
    Endpoint temporal para auditar la base de datos y verificar CASCADE.
    """
    try:
        # 1. Listar todas las tablas
        tables_result = db.execute(text("""
            SELECT tablename 
            FROM pg_tables 
            WHERE schemaname = 'public' 
            ORDER BY tablename;
        """))
        tables = [row[0] for row in tables_result.fetchall()]
        
        # 2. Verificar FKs con CASCADE para cada tabla
        cascade_info = {}
        for table in tables:
            fks_result = db.execute(text(f"""
                SELECT
                    tc.constraint_name,
                    tc.table_name,
                    kcu.column_name,
                    ccu.table_name AS foreign_table_name,
                    ccu.column_name AS foreign_column_name,
                    rc.delete_rule
                FROM information_schema.table_constraints AS tc
                JOIN information_schema.key_column_usage AS kcu
                  ON tc.constraint_name = kcu.constraint_name
                  AND tc.table_schema = kcu.table_schema
                JOIN information_schema.constraint_column_usage AS ccu
                  ON ccu.constraint_name = tc.constraint_name
                  AND ccu.table_schema = tc.table_schema
                JOIN information_schema.referential_constraints AS rc
                  ON tc.constraint_name = rc.constraint_name
                WHERE tc.constraint_type = 'FOREIGN KEY'
                  AND tc.table_name = '{table}';
            """))
            
            fks = []
            for fk in fks_result.fetchall():
                fks.append({
                    "constraint": fk[0],
                    "column": fk[2],
                    "references": f"{fk[3]}.{fk[4]}",
                    "on_delete": fk[5]
                })
            
            if fks:
                cascade_info[table] = fks
        
        return {
            "status": "success",
            "total_tables": len(tables),
            "tables": tables,
            "foreign_keys": cascade_info
        }
        
    except Exception as e:
        return {
            "status": "error",
            "message": str(e)
        }


@router.get("")
async def get_showcase():
    """
    Retorna la información completa del showcase de la plataforma.
    Incluye características, módulos, estadísticas, casos de uso, etc.
    """
    return {
        "features": [
            {
                "icon": "fas fa-brain",
                "title": "IA Generativa Integrada",
                "description": "Resúmenes ejecutivos automáticos con OpenAI para reportes de PQRS, Planes y Contratación. Análisis narrativos profesionales en segundos.",
                "color": "#412991"
            },
            {
                "icon": "fas fa-shield-alt",
                "title": "Seguro y Confiable",
                "description": "Autenticación robusta con JWT, control de acceso granular por módulo y usuario. Cumple con estándares de seguridad gubernamental.",
                "color": "#216ba8"
            },
            {
                "icon": "fas fa-mobile-alt",
                "title": "Responsivo 100%",
                "description": "Diseño adaptativo que funciona perfectamente en escritorio, tablet y móvil. Acceso desde cualquier dispositivo, en cualquier momento.",
                "color": "#28a745"
            },
            {
                "icon": "fas fa-chart-line",
                "title": "Analytics Avanzado",
                "description": "Dashboards interactivos con gráficas en tiempo real, KPIs automáticos y reportes exportables en PDF profesional y CSV.",
                "color": "#17a2b8"
            },
            {
                "icon": "fas fa-th-large",
                "title": "Permisos Granulares",
                "description": "Asigna módulos específicos a cada usuario. Control total sobre quién accede a PQRS, Planes, Contratación e informes con IA.",
                "color": "#6610f2"
            },
            {
                "icon": "fas fa-cogs",
                "title": "Multi-entidad Configurable",
                "description": "Soporta múltiples entidades con personalización completa: logos, configuración de módulos, permisos y funcionalidades por entidad.",
                "color": "#dc3545"
            }
        ],
        "modules": [
            {
                "name": "PQRS - Peticiones, Quejas, Reclamos y Sugerencias",
                "icon": "fas fa-inbox",
                "description": "Sistema completo de gestión de peticiones ciudadanas con flujos de trabajo automatizados, asignación inteligente y seguimiento en tiempo real.",
                "features": [
                    "Portal ciudadano sin autenticación requerida",
                    "Ventanilla única para recepción y clasificación",
                    "Dashboard ejecutivo con métricas y alertas",
                    "Asignación automática por departamento",
                    "Notificaciones por correo electrónico",
                    "Respuestas con adjuntos y trazabilidad completa",
                    "Reportes estadísticos exportables con IA",
                    "Búsqueda avanzada y filtros dinámicos"
                ],
                "image": "fas fa-clipboard-list",
                "color": "#216ba8"
            },
            {
                "name": "Plan de Desarrollo Municipal (PDM)",
                "icon": "fas fa-chart-line",
                "description": "Carga, análisis y seguimiento del PDM con KPIs, actividades por producto, avances anuales y reportes profesionales.",
                "features": [
                    "Carga de Excel oficial (Plan Indicativo y SGR)",
                    "Dashboard con KPIs, filtros y tarjetas clickeables",
                    "Resumen de avances por Año, Secretaría y Línea Estratégica",
                    "Actividades por producto con responsable, fechas y progreso",
                    "Registro de avances por año (2024-2027) con comentarios",
                    "Asignación de metas a Secretarías por indicador",
                    "Exportación y análisis con IA (resumen ejecutivo)",
                    "UI moderna con Bootstrap 5 y ng2-charts"
                ],
                "image": "fas fa-chart-pie",
                "color": "#0d6efd"
            },
            {
                "name": "Planes Institucionales",
                "icon": "fas fa-tasks",
                "description": "Gestión estratégica de planes con seguimiento de objetivos, metas e indicadores. Reportes profesionales en PDF con análisis de cumplimiento.",
                "features": [
                    "Creación de planes anuales por entidad",
                    "Objetivos estratégicos con metas medibles",
                    "Indicadores de gestión con fórmulas personalizadas",
                    "Seguimiento de avance con línea de tiempo",
                    "Analytics visuales con gráficas de progreso",
                    "Reportes PDF profesionales con resumen ejecutivo",
                    "Alertas de cumplimiento y vencimientos",
                    "Integración con dashboard central"
                ],
                "image": "fas fa-project-diagram",
                "color": "#28a745"
            },
            {
                "name": "Contratación Pública - SECOP II",
                "icon": "fas fa-file-contract",
                "description": "Consulta en tiempo real de procesos de contratación desde SECOP II. Análisis inteligente con IA y reportes profesionales con resúmenes ejecutivos.",
                "features": [
                    "Integración directa con datos.gov.co (API SODA)",
                    "Consulta automática por NIT de la entidad",
                    "KPIs de contratación: adjudicados, montos, tasa de éxito",
                    "Gráficas interactivas: estados, modalidades, proveedores",
                    "Detección automática de contratos vencidos",
                    "Exportación CSV y PDF profesional",
                    "Resumen ejecutivo generado con IA (OpenAI)",
                    "Filtros avanzados por fecha, modalidad, tipo y estado"
                ],
                "image": "fas fa-handshake",
                "color": "#ffc107"
            },
            {
                "name": "Gestión de Usuarios y Permisos",
                "icon": "fas fa-users-cog",
                "description": "Control granular de usuarios, roles y accesos por módulo. Sistema jerárquico con administradores, secretarios, contratistas y portal ciudadano público.",
                "features": [
                    "Admin por entidad con gestión local completa",
                    "Secretarios y contratistas con permisos personalizables",
                    "Asignación granular de módulos permitidos por usuario",
                    "Control de funcionalidades por entidad (IA, PDF, módulos)",
                    "Portal ciudadano sin registro necesario",
                    "Activación/desactivación de usuarios en un clic",
                    "Edición de permisos desde dashboard administrativo",
                    "Auditoría completa de acciones por usuario"
                ],
                "image": "fas fa-user-shield",
                "color": "#6610f2"
            }
        ],
        "stats": [
            {"value": "99.9%", "label": "Uptime", "icon": "fas fa-server"},
            {"value": "<100ms", "label": "Tiempo de respuesta", "icon": "fas fa-bolt"},
            {"value": "5+", "label": "Módulos integrados", "icon": "fas fa-cubes"},
            {"value": "∞", "label": "Entidades soportadas", "icon": "fas fa-building"}
        ],
        "testimonials": [
            {
                "name": "María González",
                "role": "Secretaria de Atención al Ciudadano",
                "entity": "Alcaldía Municipal",
                "message": "El sistema nos ha permitido reducir en un 60% el tiempo de respuesta a las PQRS. La ciudadanía ahora puede hacer seguimiento en tiempo real.",
                "avatar": "fas fa-user-circle"
            },
            {
                "name": "Carlos Ramírez",
                "role": "Director de Planeación",
                "entity": "Gobernación Departamental",
                "message": "Los reportes de contratación con IA nos dan insights que antes nos tomaban días analizar. Ahora en minutos tenemos decisiones informadas.",
                "avatar": "fas fa-user-tie"
            },
            {
                "name": "Ana Martínez",
                "role": "Coordinadora TI",
                "entity": "Municipio",
                "message": "La implementación fue rápida y el soporte técnico excelente. El sistema es intuitivo tanto para funcionarios como para ciudadanos.",
                "avatar": "fas fa-user-graduate"
            }
        ],
        "benefits": [
            {
                "title": "Cumplimiento Normativo",
                "description": "Alineado con la Ley 1755 de 2015 y decretos reglamentarios de PQRS en Colombia.",
                "icon": "fas fa-gavel"
            },
            {
                "title": "Transparencia Total",
                "description": "Trazabilidad completa de todas las operaciones. Auditoría y reportes para entes de control.",
                "icon": "fas fa-eye"
            },
            {
                "title": "Ahorro de Tiempo",
                "description": "Automatización de procesos repetitivos. Reduce hasta 70% el tiempo administrativo.",
                "icon": "fas fa-clock"
            },
            {
                "title": "Satisfacción Ciudadana",
                "description": "Portal intuitivo y respuestas oportunas mejoran la percepción del servicio público.",
                "icon": "fas fa-smile"
            },
            {
                "title": "Escalable",
                "description": "Crece con tu entidad. Desde pequeños municipios hasta grandes gobernaciones.",
                "icon": "fas fa-expand-arrows-alt"
            },
            {
                "title": "Soporte Continuo",
                "description": "Actualizaciones regulares, nuevas funcionalidades y soporte técnico especializado.",
                "icon": "fas fa-life-ring"
            }
        ],
        "useCases": [
            {
                "title": "Alcaldía Municipal",
                "description": "Gestión centralizada de PQRS de 50,000 habitantes, seguimiento de planes de desarrollo y consulta de contratación.",
                "icon": "fas fa-city",
                "metrics": ["500+ PQRS/mes", "95% respuestas a tiempo", "10 usuarios activos"]
            },
            {
                "title": "Gobernación",
                "description": "Coordinación multi-entidad con 20+ municipios, reportes consolidados y dashboard ejecutivo para el gobernador.",
                "icon": "fas fa-landmark",
                "metrics": ["2000+ PQRS/mes", "15 planes institucionales", "100+ usuarios"]
            },
            {
                "title": "Entidad Descentralizada",
                "description": "Hospital, universidad o empresa pública con necesidades específicas de atención ciudadana y transparencia.",
                "icon": "fas fa-hospital",
                "metrics": ["Personalización completa", "Integración con sistemas legacy", "SLA garantizado"]
            }
        ],
        "techStack": [
            {"name": "Angular 18", "icon": "fab fa-angular", "color": "#dd0031"},
            {"name": "FastAPI", "icon": "fas fa-rocket", "color": "#009688"},
            {"name": "PostgreSQL", "icon": "fas fa-database", "color": "#336791"},
            {"name": "Bootstrap 5", "icon": "fab fa-bootstrap", "color": "#7952b3"},
            {"name": "Chart.js", "icon": "fas fa-chart-bar", "color": "#ff6384"},
            {"name": "OpenAI", "icon": "fas fa-brain", "color": "#412991"}
        ]
    }
