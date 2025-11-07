// Modelos para Planes Institucionales y Metas

export interface Meta {
    id?: number;
    nombre: string;
    descripcion: string;
    indicador: string;
    meta_numerica: number;
    avance_actual: number;
    fecha_inicio: string;
    fecha_fin: string;
    responsable: string;
    estado: 'no_iniciada' | 'en_progreso' | 'completada' | 'atrasada';
    resultado?: string;  // Resultado u observaciones de la meta
    plan_id?: number;
    created_at?: string;
    updated_at?: string;
}

export interface PlanInstitucional {
    id?: number;
    nombre: string;
    descripcion: string;
    anio: number;
    fecha_inicio: string;
    fecha_fin: string;
    estado: 'activo' | 'finalizado' | 'suspendido';
    entity_id?: number;
    metas?: Meta[];
    created_at?: string;
    updated_at?: string;
}

export interface CreatePlanRequest {
    nombre: string;
    descripcion: string;
    anio: number;
    fecha_inicio: string;
    fecha_fin: string;
    estado: 'activo' | 'finalizado' | 'suspendido';
    entity_id?: number;  // Opcional, el backend lo toma del usuario admin
}

export interface UpdatePlanRequest {
    nombre?: string;
    descripcion?: string;
    anio?: number;
    fecha_inicio?: string;
    fecha_fin?: string;
    estado?: 'activo' | 'finalizado' | 'suspendido';
}

export interface CreateMetaRequest {
    nombre: string;
    descripcion: string;
    indicador: string;
    meta_numerica: number;
    avance_actual: number;
    fecha_inicio: string;
    fecha_fin: string;
    responsable: string;
    estado: 'no_iniciada' | 'en_progreso' | 'completada' | 'atrasada';
    resultado?: string;
    plan_id: number;
}

export interface UpdateMetaRequest {
    nombre?: string;
    descripcion?: string;
    indicador?: string;
    meta_numerica?: number;
    avance_actual?: number;
    fecha_inicio?: string;
    fecha_fin?: string;
    responsable?: string;
    estado?: 'no_iniciada' | 'en_progreso' | 'completada' | 'atrasada';
    resultado?: string;
}
