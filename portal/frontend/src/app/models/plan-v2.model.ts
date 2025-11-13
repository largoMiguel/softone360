// Modelos v2 para Planes Institucionales (4 niveles)
// Plan → Componente/Proceso → Actividad → Ejecución

export enum EstadoPlan {
    FORMULACION = 'formulacion',
    APROBADO = 'aprobado',
    EN_EJECUCION = 'en_ejecucion',
    SUSPENDIDO = 'suspendido',
    FINALIZADO = 'finalizado',
    CANCELADO = 'cancelado'
}

export enum EstadoComponente {
    NO_INICIADO = 'no_iniciado',
    EN_PROGRESO = 'en_progreso',
    COMPLETADO = 'completado',
    PAUSADO = 'pausado',
    CANCELADO = 'cancelado'
}

// Actividad y ejecuciones simplificadas: sin estado/prioridad/tipo

export interface PlanInstitucional {
    id: number;
    anio: number;
    nombre: string;
    descripcion: string;
    fecha_inicio: string;
    fecha_fin: string;
    estado: EstadoPlan;
    responsable_elaboracion: string;
    porcentaje_avance: number;
    created_at?: string;
    updated_at?: string;
}

export interface PlanInstitucionalCreate {
    anio: number;
    nombre: string;
    descripcion: string;
    fecha_inicio: string; // YYYY-MM-DD
    fecha_fin: string;    // YYYY-MM-DD
    estado: EstadoPlan;
    responsable_elaboracion: string;
}

export interface PlanInstitucionalUpdate extends Partial<PlanInstitucionalCreate> { }

export interface ComponenteProceso {
    id: number;
    plan_id: number;
    nombre: string;
    estado: EstadoComponente;
    porcentaje_avance: number;
    created_at?: string;
    updated_at?: string;
}

export interface ComponenteProcesoCreate {
    plan_id: number;
    nombre: string;
    estado: EstadoComponente;
}

export interface ComponenteProcesoUpdate extends Partial<ComponenteProcesoCreate> { }

export interface Actividad {
    id: number;
    componente_id: number;
    objetivo_especifico?: string;
    fecha_inicio_prevista: string;
    fecha_fin_prevista: string;
    responsable_secretaria_id?: number;
    responsable_secretaria_nombre?: string;
    created_at?: string;
    updated_at?: string;
}

export interface ActividadCreate {
    componente_id: number;
    objetivo_especifico?: string;
    fecha_inicio_prevista: string;
    fecha_fin_prevista: string;
    responsable_secretaria_id?: number;
}

export interface ActividadUpdate extends Partial<ActividadCreate> {
}

// Eliminado: actualización de avance manual

export interface ActividadEjecucion {
    id: number;
    actividad_id: number;
    descripcion: string;
    fecha_registro: string;
    evidencia_url?: string;
    created_at?: string;
    updated_at?: string;
    evidencias?: ActividadEvidencia[];
}

export interface ActividadEjecucionCreate {
    actividad_id: number;
    descripcion: string;
    evidencia_url?: string;
}

export interface ActividadEjecucionUpdate extends Partial<ActividadEjecucionCreate> { }

// Modelos para evidencias
export enum TipoEvidencia {
    URL = 'url',
    IMAGEN = 'imagen'
}

export interface ActividadEvidencia {
    id: number;
    actividad_ejecucion_id: number;
    tipo: TipoEvidencia;
    contenido: string; // URL o base64 de imagen
    nombre_archivo?: string;
    mime_type?: string;
    orden: number;
    created_at: string;
}

export interface ActividadEvidenciaCreate {
    tipo: TipoEvidencia;
    contenido: string;
    nombre_archivo?: string;
    mime_type?: string;
    orden?: number;
}

export interface ActividadCompleta extends Actividad {
    actividades_ejecucion: ActividadEjecucion[];
}

export interface ComponenteConActividades extends ComponenteProceso {
    actividades: Actividad[];
}

export interface PlanInstitucionalCompleto extends PlanInstitucional {
    componentes: ComponenteConActividades[];
}

export interface EstadisticasPlan {
    total_componentes: number;
    total_actividades: number;
    actividades_con_avance: number;
    componentes_con_avance: number;
    porcentaje_avance_global: number;
}

// Etiquetas y utilidades UI
export const LABELS_ESTADO_PLAN: { [key in EstadoPlan]: string } = {
    [EstadoPlan.FORMULACION]: 'Formulación',
    [EstadoPlan.APROBADO]: 'Aprobado',
    [EstadoPlan.EN_EJECUCION]: 'En ejecución',
    [EstadoPlan.SUSPENDIDO]: 'Suspendido',
    [EstadoPlan.FINALIZADO]: 'Finalizado',
    [EstadoPlan.CANCELADO]: 'Cancelado'
};

export const LABELS_ESTADO_COMPONENTE: { [key in EstadoComponente]: string } = {
    [EstadoComponente.NO_INICIADO]: 'No iniciado',
    [EstadoComponente.EN_PROGRESO]: 'En progreso',
    [EstadoComponente.COMPLETADO]: 'Completado',
    [EstadoComponente.PAUSADO]: 'Pausado',
    [EstadoComponente.CANCELADO]: 'Cancelado'
};

export const BADGE_CLASS_ESTADO_PLAN: { [key in EstadoPlan]: string } = {
    [EstadoPlan.FORMULACION]: 'badge bg-warning',
    [EstadoPlan.APROBADO]: 'badge bg-info',
    [EstadoPlan.EN_EJECUCION]: 'badge bg-success',
    [EstadoPlan.SUSPENDIDO]: 'badge bg-secondary',
    [EstadoPlan.FINALIZADO]: 'badge bg-dark',
    [EstadoPlan.CANCELADO]: 'badge bg-danger'
};

// Sin badges de prioridad ni estado de actividad en versión simplificada
