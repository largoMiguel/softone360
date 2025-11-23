export interface ProcesoContratacion {
    // ============ CAMPOS SECOP II (existentes) ============
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

    // ============ CAMPOS SECOP II PROCESOS (p6dx-8zbt) ============
    descripci_n_del_procedimiento?: string;
    estado_del_procedimiento?: string;
    id_del_proceso?: string;
    fecha_de_publicacion_del?: string;

    // ============ CAMPOS SECOP I (nuevos) ============
    uid?: string;
    anno_cargue_secop?: string;
    anno_firma_contrato?: string;
    nivel_entidad?: string;
    orden_entidad?: string;
    nit_de_la_entidad?: string;
    c_digo_de_la_entidad?: string;
    id_modalidad?: string;
    estado_del_proceso?: string;
    causal_de_otras_formas_de?: string;
    id_regimen_de_contratacion?: string;
    nombre_regimen_de_contratacion?: string;
    id_objeto_a_contratar?: string;
    objeto_a_contratar?: string;
    detalle_del_objeto_a_contratar?: string;
    municipio_de_obtencion?: string;
    municipio_de_entrega?: string;
    municipios_ejecucion?: string;
    fecha_de_cargue_en_el_secop?: string;
    numero_de_constancia?: string;
    numero_de_proceso?: string;
    numero_de_contrato?: string;
    cuantia_proceso?: number | string;
    id_grupo?: string;
    nombre_grupo?: string;
    id_familia?: string;
    nombre_familia?: string;
    id_clase?: string;
    nombre_clase?: string;
    id_adjudicacion?: string;
    tipo_identifi_del_contratista?: string;
    identificacion_del_contratista?: string;
    nom_razon_social_contratista?: string;
    dpto_y_muni_contratista?: string;
    tipo_doc_representante_legal?: string;
    identific_representante_legal?: string;
    nombre_del_represen_legal?: string;
    fecha_de_firma_del_contrato?: string;
    fecha_ini_ejec_contrato?: string;
    plazo_de_ejec_del_contrato?: string;
    rango_de_ejec_del_contrato?: string;
    tiempo_adiciones_en_dias?: string;
    tiempo_adiciones_en_meses?: string;
    fecha_fin_ejec_contrato?: string;
    compromiso_presupuestal?: string;
    cuantia_contrato?: number | string;
    valor_total_de_adiciones?: number | string;
    valor_contrato_con_adiciones?: number | string;
    objeto_del_contrato_a_la?: string;
    proponentes_seleccionados?: string;
    calificacion_definitiva?: string;
    id_sub_unidad_ejecutora?: string;
    nombre_sub_unidad_ejecutora?: string;
    ruta_proceso_en_secop_i?: string | { url?: string };
    moneda?: string;
    es_postconflicto?: string;
    marcacion_adiciones?: string;
    posicion_rubro?: string;
    nombre_rubro?: string;
    valor_rubro?: number | string;
    sexo_replegal?: string;
    pilar_acuerdo_paz?: string;
    punto_acuerdo_paz?: string;
    municipio_entidad?: string;
    departamento_entidad?: string;
    fecha_liquidacion?: string;
    cumpledecreto248?: string;
    incluyebienesdecreto248?: string;
    cumple_sentencia_t302?: string;
    es_mipyme?: string;
    tama_o_mipyme?: string;
    codigo_bpin?: string;
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
