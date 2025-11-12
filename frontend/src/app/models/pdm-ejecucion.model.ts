export interface PDMEjecucionResumen {
    codigo_producto: string;
    fuentes: string[];
    totales: {
        pto_inicial: number;
        adicion: number;
        reduccion: number;
        credito: number;
        contracredito: number;
        pto_definitivo: number;
        pagos: number;
    };
}

export interface PDMEjecucionUploadResponse {
    success: boolean;
    message: string;
    registros_procesados: number;
    registros_insertados: number;
    errores: string[];
}
