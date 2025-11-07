// Modelos para el PDM

export interface LineaEstrategica {
    codigoDane: string;
    entidadTerritorial: string;
    nombrePlan: string;
    consecutivo: string;
    lineaEstrategica: string;
}

export interface IndicadorResultado {
    codigoDane: string;
    entidadTerritorial: string;
    nombrePlan: string;
    consecutivo: string;
    lineaEstrategica: string;
    indicadorResultado: string;
    estaEnPND: string;
    metaCuatrienio: number;
    transformacionPND: string;
}

export interface PlanIndicativoProducto {
    codigoDane: string;
    entidadTerritorial: string;
    nombrePlan: string;
    codigoIndicador: string;
    lineaEstrategica: string;
    codigoSector: string;
    sector: string;
    codigoPrograma: string;
    programa: string;
    codigoProducto: string;
    producto: string;
    codigoIndicadorProducto: string;
    indicadorProducto: string;
    personalizacion: string;
    unidadMedida: string;
    metaCuatrienio: number;
    principal: string;
    codigoODS: string;
    ods: string;
    tipoAcumulacion: string;
    programacion2024: number;
    programacion2025: number;
    programacion2026: number;
    programacion2027: number;
    total2024: number;
    total2025: number;
    total2026: number;
    total2027: number;
    bpin?: string;
    // Estado calculado
    estado?: EstadoMeta;
    avance?: number;
    // Estados por año (para análisis de gráficos)
    estadosPorAnio?: {
        2024: EstadoMeta;
        2025: EstadoMeta;
        2026: EstadoMeta;
        2027: EstadoMeta;
    };
    // Metas por año (extraídas de programación)
    meta2024?: number;
    meta2025?: number;
    meta2026?: number;
    meta2027?: number;
    // Gestión
    secretariaAsignada?: string;
    // Avances por año registrados por el usuario
    avances?: {
        [anio: number]: {
            valor: number; // porcentaje o valor ejecutado
            comentario?: string;
        }
    };
    // Actividades para cumplimiento de la meta
    actividades?: Actividad[];
}

export interface IniciativaSGR {
    codigoDane: string;
    entidadTerritorial: string;
    nombrePlan: string;
    consecutivo: string;
    lineaEstrategica: string;
    tipoIniciativa: string;
    sector: string;
    iniciativaSGR: string;
    recursosSGR: number;
    bpin?: string;
}

export interface PlanIndicativoSGR {
    codigoDane: string;
    entidadTerritorial: string;
    nombrePlan: string;
    codigoIndicador: string;
    iniciativaSGR: string;
    codigoSector: string;
    sector: string;
    codigoPrograma: string;
    programa: string;
    codigoProducto: string;
    producto: string;
    codigoIndicadorProducto: string;
    indicadorProducto: string;
    personalizacion: string;
    unidadMedida: string;
    metaCuatrienio: number;
    principal: string;
    codigoODS: string;
    ods: string;
    tipoAcumulacion: string;
    cofinanciado: string;
    programacion20232024: number;
    programacion20252026: number;
    programacion20272028: number;
    recursosSGR20232024: number;
    recursosSGR20252026: number;
    recursosSGR20272028: number;
    bpin?: string;
}

export enum EstadoMeta {
    CUMPLIDA = 'cumplida',
    EN_PROGRESO = 'en_progreso',
    POR_CUMPLIR = 'por_cumplir',
    PENDIENTE = 'pendiente',
    SIN_DEFINIR = 'sin_definir'
}

export enum EstadoActividad {
    PENDIENTE = 'pendiente',
    EN_PROGRESO = 'en_progreso',
    COMPLETADA = 'completada',
    CANCELADA = 'cancelada'
}

export interface Actividad {
    id?: number;
    entity_id?: number;
    codigo_indicador_producto: string;
    nombre: string;
    descripcion?: string;
    responsable?: string;
    fecha_inicio?: string;  // ISO string
    fecha_fin?: string;  // ISO string
    estado: string;
    created_at?: string;
    updated_at?: string;
    // Nuevos campos para ejecución por año
    anio: number;  // Año al que pertenece la actividad (2024-2027)
    meta_ejecutar: number;  // Cantidad de la meta anual que se ejecutará (del 1 al disponible)
    valor_ejecutado: number;  // Cantidad real ejecutada hasta el momento (se calculará con meta_ejecutar)
}

export interface PDMData {
    lineasEstrategicas: LineaEstrategica[];
    indicadoresResultado: IndicadorResultado[];
    planIndicativoProductos: PlanIndicativoProducto[];
    iniciativasSGR: IniciativaSGR[];
    planIndicativoSGR: PlanIndicativoSGR[];
    metadata: {
        fechaCarga: Date;
        nombreArchivo: string;
        totalRegistros: number;
    };
}

export interface AnalisisPDM {
    indicadoresGenerales: {
        totalMetas: number;
        metasCumplidas: number;
        metasEnProgreso: number;
        metasPorCumplir: number;
        metasPendientes: number;
        porcentajeCumplimiento: number;
    };
    analisisPorAnio: {
        anio: number;
        totalMetas: number;
        metasCumplidas: number;
        porcentajeCumplimiento: number;
        presupuestoTotal: number;
    }[];
    analisisPorSector: {
        sector: string;
        totalMetas: number;
        metasCumplidas: number;
        porcentajeCumplimiento: number;
        presupuestoTotal: number;
    }[];
    analisisPorLineaEstrategica: {
        lineaEstrategica: string;
        totalMetas: number;
        metasCumplidas: number;
        porcentajeCumplimiento: number;
    }[];
    analisisPorODS: {
        codigoODS: string;
        nombreODS: string;
        totalMetas: number;
        metasCumplidas: number;
        porcentajeCumplimiento: number;
        presupuestoTotal: number;
    }[];
    analisisSGR: {
        totalIniciativas: number;
        recursosSGRTotales: number;
        recursosSGRPorSector: {
            sector: string;
            totalRecursosSGR: number;
            numeroIniciativas: number;
        }[];
        iniciativasConBPIN: number;
        iniciativasSinBPIN: number;
    };
    analisisIndicadoresResultado: {
        totalIndicadores: number;
        indicadoresEnPND: number;
        indicadoresFueraPND: number;
        porcentajeAlineacionPND: number;
        indicadoresPorLinea: {
            lineaEstrategica: string;
            totalIndicadores: number;
            indicadoresEnPND: number;
            metaCuatrienioTotal: number;
        }[];
        transformacionesPND: {
            transformacion: string;
            numeroIndicadores: number;
        }[];
    };
    analisisPresupuestoDetallado: {
        presupuestoOrdinarioTotal: number;
        presupuestoSGRTotal: number;
        porcentajeOrdinario: number;
        porcentajeSGR: number;
        presupuestoPorAnio: {
            anio: number;
            ordinario: number;
            sgr: number;
            total: number;
        }[];
        presupuestoPorSector: {
            sector: string;
            ordinario: number;
            sgr: number;
            total: number;
        }[];
    };
    tendencias: {
        descripcion: string;
        tipo: 'positivo' | 'neutro' | 'negativo';
    }[];
    recomendaciones: string[];
    alertas: string[];
    inconsistencias: {
        tipo: string;
        descripcion: string;
        cantidad: number;
    }[];
}

export interface FiltrosPDM {
    anio?: number;
    sector?: string;
    lineaEstrategica?: string;
    estado?: EstadoMeta;
    secretaria?: string;
    ods?: string;
    bpin?: string;
}
