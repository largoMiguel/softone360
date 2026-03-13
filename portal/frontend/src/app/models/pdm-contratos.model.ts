// Modelos para Contratos RPS del PDM

export interface ContratoRPS {
    id: number;
    no_crp: string;
    codigo_producto: string;
    concepto: string | null;
    valor: number;
    contratista?: string | null;
    anio: number;
}

export interface ResumenContratos {
    contratos: ContratoRPS[];
    total_contratado: number;
    cantidad_contratos: number;
    anio: number;
}

export interface UploadContratosResponse {
    mensaje: string;
    registros_insertados: number;
    registros_eliminados: number;
    procesados: number;
    contratos_agrupados: number;
    contratos: ContratoRPS[];
    errores: string[];
}
