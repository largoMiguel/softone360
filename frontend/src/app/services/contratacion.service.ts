import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map, of } from 'rxjs';
import { ProcesoContratacion, FiltroContratacion } from '../models/contratacion.model';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ContratacionService {
    // Usar proxy del backend para evitar CORS
    private baseUrl = `${environment.apiUrl}/contratacion/proxy`;
    private cache = new Map<string, { ts: number; data: ProcesoContratacion[] }>();
    private TTL_MS = 5 * 60 * 1000; // 5 minutos

    constructor(private http: HttpClient) { }

    /**
     * Construye la consulta SODA con parámetros usando NIT de la entidad.
     * Filtra contratos desde el 1 de enero de 2025 hasta la fecha actual.
     */
    buildQuery(f: FiltroContratacion): string {
        const condiciones: string[] = [];

        // Filtro principal: NIT de la entidad
        const nit = f.entidad?.trim() || '800019277'; // NIT de ejemplo
        condiciones.push(`\`nit_entidad\` IN ("${nit.replaceAll('"', '\\"')}")`);

        // Fechas - forzar desde 1 de enero 2025 hasta fecha actual o especificada
        const fechaDesde = f.fechaDesde || '2025-01-01';
        const fechaHasta = f.fechaHasta || new Date().toISOString().split('T')[0];

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

        const order = 'ORDER BY `referencia_del_contrato` ASC NULL LAST';

        const query = `SELECT ${select} ${where} ${order}`;
        return query;
    }

    fetchProcesos(filtro: FiltroContratacion, forceRefresh = false): Observable<ProcesoContratacion[]> {
        const query = this.buildQuery(filtro);
        const cacheKey = query;
        const now = Date.now();

        if (!forceRefresh && this.cache.has(cacheKey)) {
            const entry = this.cache.get(cacheKey)!;
            if (now - entry.ts < this.TTL_MS) {
                return of(entry.data);
            }
        }

        const params = new HttpParams().set('$query', query);
        return this.http.get<ProcesoContratacion[]>(this.baseUrl, { params }).pipe(
            map(rows => {
                const data = rows || [];
                this.cache.set(cacheKey, { ts: now, data });
                return data;
            })
        );
    }
}
