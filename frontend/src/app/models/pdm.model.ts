// Modelos para el Plan de Desarrollo Municipal (PDM)

export interface LineaEstrategica {
    codigo_dane: string;
    entidad_territorial: string;
    nombre_plan: string;
    consecutivo: string;
    linea_estrategica: string;
}

export interface IndicadorResultado {
    codigo_dane: string;
    entidad_territorial: string;
    nombre_plan: string;
    consecutivo: string;
    linea_estrategica: string;
    indicador_resultado: string;
    esta_pnd: string;
    meta_cuatrienio: number;
    transformacion_pnd: string;
}

export interface IniciativaSGR {
    codigo_dane: string;
    entidad_territorial: string;
    nombre_plan: string;
    consecutivo: string;
    linea_estrategica: string;
    tipo_iniciativa: string;
    sector_mga: string;
    iniciativa_sgr: string;
    recursos_sgr_indicativos: number;
    bpin: string;
}

export interface ProductoPlanIndicativo {
    // Parte estratégica
    codigo_dane: string;
    entidad_territorial: string;
    nombre_plan: string;
    codigo_indicador_producto: string;
    linea_estrategica: string;
    codigo_sector: string;
    sector_mga: string;
    codigo_programa: string;
    programa_mga: string;
    codigo_producto: string;
    producto_mga: string;
    codigo_indicador_producto_mga: string;
    indicador_producto_mga: string;
    personalizacion_indicador: string;
    unidad_medida: string;
    meta_cuatrienio: number;
    principal: string;
    codigo_ods: string;
    ods: string;
    tipo_acumulacion: string;
    
    // Programación por año
    programacion_2024: number;
    programacion_2025: number;
    programacion_2026: number;
    programacion_2027: number;
    
    // Presupuesto 2024
    recursos_propios_2024: number;
    sgp_educacion_2024: number;
    sgp_salud_2024: number;
    sgp_deporte_2024: number;
    sgp_cultura_2024: number;
    sgp_libre_inversion_2024: number;
    sgp_libre_destinacion_2024: number;
    sgp_alimentacion_escolar_2024: number;
    sgp_municipios_rio_magdalena_2024: number;
    sgp_apsb_2024: number;
    credito_2024: number;
    transferencias_cofinanciacion_departamento_2024: number;
    transferencias_cofinanciacion_nacion_2024: number;
    otros_2024: number;
    total_2024: number;
    
    // Presupuesto 2025
    recursos_propios_2025: number;
    sgp_educacion_2025: number;
    sgp_salud_2025: number;
    sgp_deporte_2025: number;
    sgp_cultura_2025: number;
    sgp_libre_inversion_2025: number;
    sgp_libre_destinacion_2025: number;
    sgp_alimentacion_escolar_2025: number;
    sgp_municipios_rio_magdalena_2025: number;
    sgp_apsb_2025: number;
    credito_2025: number;
    transferencias_cofinanciacion_departamento_2025: number;
    transferencias_cofinanciacion_nacion_2025: number;
    otros_2025: number;
    total_2025: number;
    
    // Presupuesto 2026
    recursos_propios_2026: number;
    sgp_educacion_2026: number;
    sgp_salud_2026: number;
    sgp_deporte_2026: number;
    sgp_cultura_2026: number;
    sgp_libre_inversion_2026: number;
    sgp_libre_destinacion_2026: number;
    sgp_alimentacion_escolar_2026: number;
    sgp_municipios_rio_magdalena_2026: number;
    sgp_apsb_2026: number;
    credito_2026: number;
    transferencias_cofinanciacion_departamento_2026: number;
    transferencias_cofinanciacion_nacion_2026: number;
    otros_2026: number;
    total_2026: number;
    
    // Presupuesto 2027
    recursos_propios_2027: number;
    sgp_educacion_2027: number;
    sgp_salud_2027: number;
    sgp_deporte_2027: number;
    sgp_cultura_2027: number;
    sgp_libre_inversion_2027: number;
    sgp_libre_destinacion_2027: number;
    sgp_alimentacion_escolar_2027: number;
    sgp_municipios_rio_magdalena_2027: number;
    sgp_apsb_2027: number;
    credito_2027: number;
    transferencias_cofinanciacion_departamento_2027: number;
    transferencias_cofinanciacion_nacion_2027: number;
    otros_2027: number;
    total_2027: number;
    
    bpin: string;
    
    // Responsable del producto (asignación manual)
    responsable_user_id?: number | null;
    responsable?: string;
}

export interface ProductoPlanIndicativoSGR {
    codigo_dane: string;
    entidad_territorial: string;
    nombre_plan: string;
    codigo_indicador_producto_sgr: string;
    iniciativa_sgr: string;
    codigo_sector: string;
    sector_mga: string;
    codigo_programa: string;
    programa_mga: string;
    codigo_producto: string;
    producto_mga: string;
    codigo_indicador_producto_mga: string;
    indicador_producto_mga: string;
    personalizacion_indicador: string;
    unidad_medida: string;
    meta_cuatrienio: number;
    principal: string;
    codigo_ods: string;
    ods: string;
    tipo_acumulacion: string;
    cofinanciado_presupuesto_ordinario: string;
    programacion_2023_2024: number;
    programacion_2025_2026: number;
    programacion_2027_2028: number;
    recursos_sgr_2023_2024: number;
    recursos_sgr_2025_2026: number;
    recursos_sgr_2027_2028: number;
    bpin: string;
}

// Interfaz para datos consolidados del PDM
export interface PDMData {
    lineas_estrategicas: LineaEstrategica[];
    indicadores_resultado: IndicadorResultado[];
    iniciativas_sgr: IniciativaSGR[];
    productos_plan_indicativo: ProductoPlanIndicativo[];
    productos_plan_indicativo_sgr: ProductoPlanIndicativoSGR[];
}

// Interfaz para resumen de producto con presupuesto por año
export interface ResumenProducto {
    codigo: string;
    producto: string;
    linea_estrategica: string;
    sector: string;
    programa_mga: string;
    ods: string;
    tipo_acumulacion: string;
    bpin: string;
    meta_cuatrienio: number;
    unidad_medida: string;
    programacion_2024: number;
    programacion_2025: number;
    programacion_2026: number;
    programacion_2027: number;
    total_2024: number;
    total_2025: number;
    total_2026: number;
    total_2027: number;
    total_cuatrienio: number;
    porcentaje_ejecucion: number;
    detalle_completo: ProductoPlanIndicativo;
    responsable_id?: number | null;
    responsable_nombre?: string;
    responsable_secretaria_id?: number | null; // ✅ ID de la secretaría responsable
    responsable_secretaria_nombre?: string; // ✅ Nombre de la secretaría responsable
}

// Interfaz para estadísticas del PDM
export interface EstadisticasPDM {
    total_lineas_estrategicas: number;
    total_productos: number;
    total_iniciativas_sgr: number;
    presupuesto_total: number;
    presupuestoPorAnio: {
        anio2024: number;
        anio2025: number;
        anio2026: number;
        anio2027: number;
    };
    presupuesto_por_linea: {
        linea: string;
        total: number;
    }[];
    presupuesto_por_sector: {
        sector: string;
        total: number;
    }[];
}

// Actividad asociada a un producto por año
export interface ActividadPDM {
    id?: number;
    codigo_producto: string; // Código del producto al que pertenece
    anio: number; // 2024, 2025, 2026, 2027
    nombre: string;
    descripcion: string;
    responsable: string; // Nombre del responsable (legacy)
    responsable_secretaria_id?: number; // ID de la secretaría responsable
    responsable_secretaria_nombre?: string; // Nombre de la secretaría responsable
    estado: 'PENDIENTE' | 'EN_PROGRESO' | 'COMPLETADA' | 'CANCELADA';
    fecha_inicio: string; // ISO date string
    fecha_fin: string; // ISO date string
    meta_ejecutar: number; // Cantidad de la meta que se ejecutará en esta actividad
    evidencia?: EvidenciaActividad; // Evidencia de cumplimiento
    fecha_creacion?: string;
    fecha_actualizacion?: string;
}

// Evidencia de cumplimiento de una actividad
export interface EvidenciaActividad {
    id?: number;
    actividad_id?: number;
    descripcion: string;
    url_evidencia?: string; // URL externa opcional
    imagenes: string[]; // Base64 o URLs de imágenes (máximo 4, 2MB c/u)
    fecha_registro: string; // ISO date string
}

// Resumen de actividades por año para un producto
export interface ResumenActividadesPorAnio {
    anio: number;
    meta_programada: number; // Meta total del producto para ese año
    meta_asignada: number; // Suma de meta_ejecutar de todas las actividades
    meta_ejecutada: number; // Suma de meta_ejecutar de actividades CON evidencia
    meta_disponible: number; // meta_programada - meta_asignada
    total_actividades: number;
    actividades_completadas: number; // Actividades con evidencia
    porcentaje_avance: number; // (meta_ejecutada / meta_programada) * 100
    actividades: ActividadPDM[];
}

// Estadísticas de avance de un producto
export interface AvanceProducto {
    codigo_producto: string;
    avance_por_anio: {
        [anio: number]: ResumenActividadesPorAnio;
    };
    porcentaje_avance_total: number; // Promedio ponderado de todos los años
}

// Información de proyecto BPIN desde datos.gov.co
export interface ProyectoBPIN {
    bpin: string;
    nombreproyecto: string;
    objetivogeneral: string;
    estadoproyecto: string;
    horizonte: string;
    sector: string;
    entidadresponsable: string;
    valortotalproyecto: string;
    valorvigenteproyecto: string;
}

// Dashboards analíticos
export interface AnalisisPorEstado {
    estado: string;
    cantidad: number;
    porcentaje: number;
    color: string;
}

export interface AnalisisPorSector {
    sector: string;
    total_productos: number;
    productos_completados: number;
    productos_en_progreso: number;
    productos_pendientes: number;
    porcentaje_avance: number;
    presupuesto_total: number;
}

export interface AnalisisPorODS {
    ods: string;
    total_productos: number;
    porcentaje_avance_promedio: number;
    presupuesto_asignado: number;
}

export interface AnalisisPorLineaEstrategica {
    linea: string;
    total_productos: number;
    productos_completados: number;
    porcentaje_cumplimiento: number;
    meta_total: number;
    meta_ejecutada: number;
}

export interface AnalisisPresupuestal {
    anio: number;
    presupuesto_programado: number;
    presupuesto_asignado_actividades: number;
    porcentaje_asignacion: number;
}

export interface DashboardAnalytics {
    por_estado: AnalisisPorEstado[];
    por_sector: AnalisisPorSector[];
    por_ods: AnalisisPorODS[];
    por_linea_estrategica: AnalisisPorLineaEstrategica[];
    analisis_presupuestal: AnalisisPresupuestal[];
    resumen_general: {
        total_productos: number;
        porcentaje_avance_global: number;
        presupuesto_total: number;
        productos_sin_actividades: number;
    };
}
