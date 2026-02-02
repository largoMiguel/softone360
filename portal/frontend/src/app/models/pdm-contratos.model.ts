// Modelos para Contratos RPS del PDM

export interface ContratoRPS {
    no_crp: string;
    concepto: string | null;
    valor: number;
    contratista?: string | null;
}

export interface ResumenContratos {
    contratos: ContratoRPS[];
    total_contratado: number;
    cantidad_contratos: number;
    anio: number;
}

export interface UploadContratosResponse {
    mensaje: string;
    registros_procesados: number;
    contratos_agrupados: number;
    contratos: ContratoRPS[];
    errores: string[];
}
