import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map, of, forkJoin } from 'rxjs';
import { ProcesoContratacion, FiltroContratacion } from '../models/contratacion.model';
import { TimeService } from './time.service';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ContratacionService {
    // Usar proxy del backend para evitar CORS
    private baseUrlSecop2 = `${environment.apiUrl}/contratacion/proxy`; // Contratos firmados
    private baseUrlSecop2Procesos = `${environment.apiUrl}/contratacion/proxy-secop2-procesos`; // Procesos sin contrato
    private baseUrlSecop1 = `${environment.apiUrl}/contratacion/proxy-secop1`;
    private cache = new Map<string, { ts: number; data: ProcesoContratacion[] }>();
    private TTL_MS = 5 * 60 * 1000; // 5 minutos

    constructor(private http: HttpClient, private time: TimeService) { }

    /**
     * Construye la consulta SODA para SECOP II Procesos (dataset p6dx-8zbt).
     * Este dataset contiene procesos que aún no tienen contrato firmado.
     */
    buildQuerySecop2Procesos(f: FiltroContratacion): string {
        const condiciones: string[] = [];

        // Filtro principal: NIT de la entidad (estandarizado)
        const nit = f.entidad?.trim() || '800019277';
        condiciones.push(`\`nit_entidad\` IN ("${nit.replaceAll('"', '\\"')}")`);

        // Fechas - dataset p6dx-8zbt usa fecha_de_publicacion_del
        const fechaDesde = f.fechaDesde || '2025-01-01';
        const fechaHasta = f.fechaHasta || this.time.todayBogotaISODate();

        condiciones.push(`(\`fecha_de_publicacion_del\` >= "${fechaDesde}T00:00:00.000" :: floating_timestamp)`);
        condiciones.push(`(\`fecha_de_publicacion_del\` <= "${fechaHasta}T23:59:59.000" :: floating_timestamp)`);

        // Modalidad, tipo
        if (f.modalidad) condiciones.push(`\`modalidad_de_contratacion\` = "${f.modalidad.replaceAll('"', '\\"')}"`);
        if (f.tipoContrato) condiciones.push(`\`tipo_de_contrato\` = "${f.tipoContrato.replaceAll('"', '\\"')}"`);
        
        // Estado del procedimiento (en lugar de estado_contrato)
        if (f.estado) condiciones.push(`\`estado_del_procedimiento\` = "${f.estado.replaceAll('"', '\\"')}"`);

        // Rango de valor (precio_base en lugar de valor_del_contrato)
        if (typeof f.precioMin === 'number') {
            condiciones.push(`to_number(\`precio_base\`) >= ${f.precioMin}`);
        }
        if (typeof f.precioMax === 'number') {
            condiciones.push(`to_number(\`precio_base\`) <= ${f.precioMax}`);
        }

        // Búsqueda textual
        if (f.texto && f.texto.trim().length > 0) {
            const t = f.texto.trim().replaceAll('"', '\\"');
            condiciones.push(`(upper(\`descripci_n_del_procedimiento\`) like upper("%${t}%") OR upper(\`referencia_del_proceso\`) like upper("%${t}%"))`);
        }

        const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';

        // Seleccionar campos relevantes del dataset de procesos
        const select = [
            '`entidad`', '`nit_entidad`', '`departamento_entidad`', '`ciudad_entidad`',
            '`id_del_proceso`', '`referencia_del_proceso`',
            '`nombre_del_procedimiento`', '`descripci_n_del_procedimiento`',
            '`fase`', '`fecha_de_publicacion_del`',
            '`precio_base`', '`modalidad_de_contratacion`',
            '`estado_del_procedimiento`', '`id_estado_del_procedimiento`',
            '`tipo_de_contrato`', '`subtipo_de_contrato`',
            '`adjudicado`', '`nombre_del_proveedor`', '`nit_del_proveedor_adjudicado`',
            '`fecha_adjudicacion`', '`valor_total_adjudicacion`',
            '`urlproceso`', '`estado_resumen`'
        ].join(', ');

        const order = 'ORDER BY `referencia_del_proceso` DESC NULL LAST';

        const query = `SELECT ${select} ${where} ${order}`;
        return query;
    }

    /**
     * Construye la consulta SODA para SECOP II con parámetros usando NIT de la entidad.
     */
    buildQuerySecop2(f: FiltroContratacion): string {
        const condiciones: string[] = [];

        // Filtro principal: NIT de la entidad
        const nit = f.entidad?.trim() || '800019277'; // NIT de ejemplo
        condiciones.push(`\`nit_entidad\` IN ("${nit.replaceAll('"', '\\"')}")`);

        // Fechas - dataset jbjy-vk9h usa fecha_de_firma
        const fechaDesde = f.fechaDesde || '2025-01-01';
        const fechaHasta = f.fechaHasta || this.time.todayBogotaISODate();

        condiciones.push(`(\`fecha_de_firma\` >= "${fechaDesde}T00:00:00.000" :: floating_timestamp)`);
        condiciones.push(`(\`fecha_de_firma\` <= "${fechaHasta}T23:59:59.000" :: floating_timestamp)`);

        // Modalidad, tipo, estado
        if (f.modalidad) condiciones.push(`\`modalidad_de_contratacion\` = "${f.modalidad.replaceAll('"', '\\"')}"`);
        if (f.tipoContrato) condiciones.push(`\`tipo_de_contrato\` = "${f.tipoContrato.replaceAll('"', '\\"')}"`);
        if (f.estado) condiciones.push(`\`estado_contrato\` = "${f.estado.replaceAll('"', '\\"')}"`);

        // Rango de valor del contrato
        if (typeof f.precioMin === 'number') {
            condiciones.push(`to_number(\`valor_del_contrato\`) >= ${f.precioMin}`);
        }
        if (typeof f.precioMax === 'number') {
            condiciones.push(`to_number(\`valor_del_contrato\`) <= ${f.precioMax}`);
        }

        // Búsqueda textual
        if (f.texto && f.texto.trim().length > 0) {
            const t = f.texto.trim().replaceAll('"', '\\"');
            condiciones.push(`(upper(\`descripcion_del_proceso\`) like upper("%${t}%") OR upper(\`referencia_del_contrato\`) like upper("%${t}%") OR upper(\`objeto_del_contrato\`) like upper("%${t}%"))`);
        }

        const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';

        // Seleccionar campos relevantes de la nueva estructura
        const select = [
            '`nombre_entidad`',
            '`nit_entidad`',
            '`departamento`',
            '`ciudad`',
            '`proceso_de_compra`',
            '`id_contrato`',
            '`referencia_del_contrato`',
            '`estado_contrato`',
            '`descripcion_del_proceso`',
            '`tipo_de_contrato`',
            '`modalidad_de_contratacion`',
            '`justificacion_modalidad_de`',
            '`fecha_de_firma`',
            '`fecha_de_inicio_del_contrato`',
            '`fecha_de_fin_del_contrato`',
            '`duraci_n_del_contrato`',
            '`tipodocproveedor`',
            '`documento_proveedor`',
            '`proveedor_adjudicado`',
            '`es_grupo`',
            '`es_pyme`',
            '`valor_del_contrato`',
            '`valor_de_pago_adelantado`',
            '`valor_facturado`',
            '`valor_pendiente_de_pago`',
            '`valor_pagado`',
            '`valor_amortizado`',
            '`valor_pendiente_de_ejecucion`',
            '`origen_de_los_recursos`',
            '`destino_gasto`',
            '`liquidaci_n`',
            '`urlproceso`',
            '`objeto_del_contrato`',
            '`nombre_ordenador_del_gasto`',
            '`nombre_supervisor`',
            '`el_contrato_puede_ser_prorrogado`',
            '`fecha_inicio_liquidacion`',
            '`fecha_fin_liquidacion`',
            '`ultima_actualizacion`'
        ].join(', ');

        const order = 'ORDER BY `proceso_de_compra` DESC NULL LAST';

        const query = `SELECT ${select} ${where} ${order}`;
        return query;
    }

    /**
     * Construye la consulta SODA para SECOP I usando NIT de la entidad (alineado con SECOP II).
     */
    buildQuerySecop1(f: FiltroContratacion): string {
        const condiciones: string[] = [];

        // Filtrar por NIT de la entidad (requerido)
        const nit = f.entidad?.trim() || '800019277';
        condiciones.push(`\`nit_de_la_entidad\` IN ("${nit.replaceAll('"', '\\"')}")`);

        // Fechas - usar fecha_de_cargue_en_el_secop
        const fechaDesde = f.fechaDesde || '2025-01-01';
        const fechaHasta = f.fechaHasta || this.time.todayBogotaISODate();
        condiciones.push(`(\`fecha_de_cargue_en_el_secop\` >= "${fechaDesde}T00:00:00.000" :: floating_timestamp)`);
        condiciones.push(`(\`fecha_de_cargue_en_el_secop\` <= "${fechaHasta}T23:59:59.000" :: floating_timestamp)`);

        const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';

        // Seleccionar campos relevantes de SECOP I
        const select = [
            '`uid`', '`anno_cargue_secop`', '`anno_firma_contrato`', '`nivel_entidad`', '`orden_entidad`',
            '`nombre_entidad`', '`nit_de_la_entidad`', '`c_digo_de_la_entidad`', '`id_modalidad`',
            '`modalidad_de_contratacion`', '`estado_del_proceso`', '`causal_de_otras_formas_de`',
            '`id_regimen_de_contratacion`', '`nombre_regimen_de_contratacion`', '`id_objeto_a_contratar`',
            '`objeto_a_contratar`', '`detalle_del_objeto_a_contratar`', '`tipo_de_contrato`',
            '`municipio_de_obtencion`', '`municipio_de_entrega`', '`municipios_ejecucion`',
            '`fecha_de_cargue_en_el_secop`', '`numero_de_constancia`', '`numero_de_proceso`',
            '`numero_de_contrato`', '`cuantia_proceso`', '`id_grupo`', '`nombre_grupo`', '`id_familia`',
            '`nombre_familia`', '`id_clase`', '`nombre_clase`', '`id_adjudicacion`',
            '`tipo_identifi_del_contratista`', '`identificacion_del_contratista`',
            '`nom_razon_social_contratista`', '`dpto_y_muni_contratista`', '`tipo_doc_representante_legal`',
            '`identific_representante_legal`', '`nombre_del_represen_legal`', '`fecha_de_firma_del_contrato`',
            '`fecha_ini_ejec_contrato`', '`plazo_de_ejec_del_contrato`', '`rango_de_ejec_del_contrato`',
            '`tiempo_adiciones_en_dias`', '`tiempo_adiciones_en_meses`', '`fecha_fin_ejec_contrato`',
            '`compromiso_presupuestal`', '`cuantia_contrato`', '`valor_total_de_adiciones`',
            '`valor_contrato_con_adiciones`', '`objeto_del_contrato_a_la`', '`proponentes_seleccionados`',
            '`calificacion_definitiva`', '`id_sub_unidad_ejecutora`', '`nombre_sub_unidad_ejecutora`',
            '`ruta_proceso_en_secop_i`', '`moneda`', '`es_postconflicto`', '`marcacion_adiciones`',
            '`posicion_rubro`', '`nombre_rubro`', '`valor_rubro`', '`sexo_replegal`',
            '`pilar_acuerdo_paz`', '`punto_acuerdo_paz`', '`municipio_entidad`', '`departamento_entidad`',
            '`ultima_actualizacion`', '`fecha_liquidacion`', '`cumpledecreto248`',
            '`incluyebienesdecreto248`', '`cumple_sentencia_t302`', '`es_mipyme`', '`tama_o_mipyme`',
            '`codigo_bpin`', '`destino_gasto`'
        ].join(', ');

        const order = 'ORDER BY `fecha_de_cargue_en_el_secop` DESC NULL LAST';

        const query = `SELECT ${select} ${where} ${order}`;
        return query;
    }

    fetchProcesos(filtro: FiltroContratacion, forceRefresh = false, tipo: 'secop1' | 'secop2' = 'secop2', nombreEntidad?: string): Observable<ProcesoContratacion[]> {
        const now = Date.now();

        // Para SECOP II, consultar ambas fuentes (contratos y procesos)
        if (tipo === 'secop2') {
            const queryContratos = this.buildQuerySecop2(filtro);
            const queryProcesos = this.buildQuerySecop2Procesos(filtro);
            const cacheKey = `secop2-dual-${queryContratos}-${queryProcesos}`;

            if (!forceRefresh && this.cache.has(cacheKey)) {
                const entry = this.cache.get(cacheKey)!;
                if (now - entry.ts < this.TTL_MS) {
                    return of(entry.data);
                }
            }

            const paramsContratos = new HttpParams().set('$query', queryContratos);
            const paramsProcesos = new HttpParams().set('$query', queryProcesos);

            // Llamar a ambos endpoints en paralelo
            return forkJoin({
                contratos: this.http.get<ProcesoContratacion[]>(this.baseUrlSecop2, { params: paramsContratos }),
                procesos: this.http.get<ProcesoContratacion[]>(this.baseUrlSecop2Procesos, { params: paramsProcesos })
            }).pipe(
                map(({ contratos, procesos }) => {
                    const dataContratos = contratos || [];
                    const dataProcesos = procesos || [];

                    // Normalizar datos de procesos para compatibilidad con la vista
                    dataProcesos.forEach(row => {
                        row.referencia_del_contrato = row.referencia_del_proceso || row.proceso_de_compra;
                        row.descripcion_del_proceso = row.descripci_n_del_procedimiento;
                        row.valor_del_contrato = row.precio_base;
                        row.estado_contrato = row.estado_del_procedimiento;
                        row.proveedor_adjudicado = row.nombre_del_proveedor || 'Sin adjudicar';
                        row.objeto_del_contrato = row.descripci_n_del_procedimiento;
                    });

                    // Fusionar ambas listas y eliminar duplicados por referencia/ID de proceso
                    const combined = [...dataContratos, ...dataProcesos];
                    const seen = new Set<string>();
                    const data = combined.filter(row => {
                        const key = row.id_del_proceso || row.proceso_de_compra || row.referencia_del_contrato || row.referencia_del_proceso;
                        if (!key || seen.has(key)) return false;
                        seen.add(key);
                        return true;
                    });

                    this.cache.set(cacheKey, { ts: now, data });
                    return data;
                })
            );
        }

        // Para SECOP I, mantener la lógica original
        const query = this.buildQuerySecop1(filtro);
        const cacheKey = `secop1-${query}`;

        if (!forceRefresh && this.cache.has(cacheKey)) {
            const entry = this.cache.get(cacheKey)!;
            if (now - entry.ts < this.TTL_MS) {
                return of(entry.data);
            }
        }

        const params = new HttpParams().set('$query', query);
        return this.http.get<ProcesoContratacion[]>(this.baseUrlSecop1, { params }).pipe(
            map(rows => {
                const data = rows || [];
                // Normalizar datos de SECOP I para compatibilidad con la vista
                data.forEach(row => {
                    // Mapear campos de SECOP I a campos compatibles con SECOP II
                    row.referencia_del_contrato = row.numero_de_contrato || row.numero_de_proceso;
                    row.estado_contrato = row.estado_del_proceso;
                    row.fecha_de_firma = row.fecha_de_firma_del_contrato;
                    row.fecha_de_inicio_del_contrato = row.fecha_ini_ejec_contrato;
                    row.fecha_de_fin_del_contrato = row.fecha_fin_ejec_contrato;
                    row.duraci_n_del_contrato = row.plazo_de_ejec_del_contrato;
                    row.proveedor_adjudicado = row.nom_razon_social_contratista;
                    row.documento_proveedor = row.identificacion_del_contratista;
                    row.valor_del_contrato = row.cuantia_contrato || row.valor_contrato_con_adiciones;
                    row.valor_pagado = 0; // SECOP I no tiene este campo
                    row.nit_entidad = row.nit_de_la_entidad;
                    row.objeto_del_contrato = row.detalle_del_objeto_a_contratar || row.objeto_del_contrato_a_la;
                    row.urlproceso = row.ruta_proceso_en_secop_i;
                });
                this.cache.set(cacheKey, { ts: now, data });
                return data;
            })
        );
    }
}

