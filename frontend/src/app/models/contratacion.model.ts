export interface ProcesoContratacion {
    // Información de la entidad
    nombre_entidad?: string;
    nit_entidad?: string;
    departamento?: string;
    ciudad?: string;

    // Información del contrato
    proceso_de_compra?: string;
    id_contrato?: string;
    referencia_del_contrato?: string;
    estado_contrato?: string;
    descripcion_del_proceso?: string;
    tipo_de_contrato?: string;
    modalidad_de_contratacion?: string;
    justificacion_modalidad_de?: string;
    objeto_del_contrato?: string;

    // Fechas
    fecha_de_firma?: string; // ISO date
    fecha_de_inicio_del_contrato?: string; // ISO date
    fecha_de_fin_del_contrato?: string; // ISO date
    duraci_n_del_contrato?: string;
    ultima_actualizacion?: string; // ISO date

    // Información del proveedor
    tipodocproveedor?: string;
    documento_proveedor?: string;
    proveedor_adjudicado?: string;
    es_grupo?: string;
    es_pyme?: string;
    nombre_representante_legal?: string;

    // Información financiera
    valor_del_contrato?: number | string;
    valor_de_pago_adelantado?: number | string;
    valor_facturado?: number | string;
    valor_pendiente_de_pago?: number | string;
    valor_pagado?: number | string;
    valor_amortizado?: number | string;
    valor_pendiente_de_ejecucion?: number | string;

    // Origen de recursos
    origen_de_los_recursos?: string;
    destino_gasto?: string;
    presupuesto_general_de_la_nacion_pgn?: number | string;
    sistema_general_de_participaciones?: number | string;
    sistema_general_de_regal_as?: number | string;
    recursos_propios?: number | string;
    recursos_de_credito?: number | string;

    // Información adicional
    condiciones_de_entrega?: string;
    liquidaci_n?: string;
    urlproceso?: string | { url?: string };
    nombre_ordenador_del_gasto?: string;
    nombre_supervisor?: string;
    el_contrato_puede_ser_prorrogado?: string;
    fecha_inicio_liquidacion?: string; // ISO date
    fecha_fin_liquidacion?: string; // ISO date

    // Campos mantenidos por compatibilidad
    referencia_del_proceso?: string;
    precio_base?: number | string;
    nombre_del_proveedor?: string;
    estado_resumen?: string;
}

export interface FiltroContratacion {
    entidad?: string; // nombre en SECOP (ej: MUNICIPIO DE MOTAVITA)
    fechaDesde?: string; // YYYY-MM-DD
    fechaHasta?: string; // YYYY-MM-DD
    modalidad?: string;
    tipoContrato?: string;
    estado?: string; // estado_resumen
    adjudicado?: 'SI' | 'NO' | '';
    texto?: string; // búsqueda textual en descripción o referencia
    precioMin?: number | null;
    precioMax?: number | null;
}

export interface KPIsContratacion {
    totalProcesos: number;
    totalAdjudicados: number;
    tasaAdjudicacion: number; // 0..1
    sumaAdjudicado: number; // COP
    promedioPrecioBase: number; // COP
}
