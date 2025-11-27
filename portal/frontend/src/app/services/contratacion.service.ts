import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, forkJoin, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { ProcesoContratacion, FiltroContratacion } from '../models/contratacion.model';

@Injectable({
    providedIn: 'root'
})
export class ContratacionService {
    private baseUrl = `${environment.apiUrl}/contratacion`;

    constructor(private http: HttpClient) { }

    /**
     * Fetch procesos de contratación de SECOP I o SECOP II
     * 
     * Para SECOP II:
     * - Consulta DOS datasets: procesos CON contrato (jbjy-vk9h) y procesos SIN contrato (p6dx-8zbt)
     * - Fusiona los resultados sin duplicar usando id_contrato o referencia_del_contrato como clave única
     * 
     * Para SECOP I:
     * - Consulta un solo dataset (f789-7hwg)
     * 
     * @param filtro - Filtros de búsqueda (entidad, fechas, etc.)
     * @param useCache - No usado actualmente (el backend maneja caché)
     * @param tipo - 'secop1' o 'secop2'
     * @param nombreEntidad - Nombre de la entidad (opcional)
     * @returns Observable con array de procesos sin duplicados
     */
    fetchProcesos(
        filtro: FiltroContratacion,
        useCache: boolean = true,
        tipo: 'secop1' | 'secop2' = 'secop2',
        nombreEntidad?: string
    ): Observable<ProcesoContratacion[]> {
        if (tipo === 'secop1') {
            return this.fetchSecop1(filtro, nombreEntidad);
        } else {
            return this.fetchSecop2Merged(filtro, nombreEntidad);
        }
    }

    /**
     * Fetch SECOP I - Un solo dataset
     */
    private fetchSecop1(filtro: FiltroContratacion, nombreEntidad?: string): Observable<ProcesoContratacion[]> {
        const query = this.buildSoqlQuery(filtro, 'secop1', nombreEntidad);
        const endpoint = `${this.baseUrl}/proxy-secop1`;

        return this.http.get<ProcesoContratacion[]>(endpoint, {
            params: { '$query': query }
        }).pipe(
            map(rows => rows || []),
            catchError(err => {
                console.error('[ContratacionService] Error fetching SECOP I:', err);
                return of([]);
            })
        );
    }

    /**
     * Fetch SECOP II - Fusiona DOS datasets sin duplicar
     * 
     * Estrategia de fusión:
     * 1. Obtener procesos CON contrato (dataset principal jbjy-vk9h)
     * 2. Obtener procesos SIN contrato (dataset complementario p6dx-8zbt)
     * 3. Crear un Map usando id_contrato o referencia_del_contrato como clave única
     * 4. Priorizar datos del dataset CON contrato (más completo)
     * 5. Agregar procesos SIN contrato solo si no existen en el Map
     */
    private fetchSecop2Merged(filtro: FiltroContratacion, nombreEntidad?: string): Observable<ProcesoContratacion[]> {
        const queryConContrato = this.buildSoqlQuery(filtro, 'secop2', nombreEntidad);
        const querySinContrato = this.buildSoqlQueryProcesos(filtro, nombreEntidad);

        const endpointConContrato = `${this.baseUrl}/proxy`; // jbjy-vk9h - CON contrato
        const endpointSinContrato = `${this.baseUrl}/proxy-secop2-procesos`; // p6dx-8zbt - SIN contrato

        // Ejecutar ambas peticiones en paralelo
        return forkJoin({
            conContrato: this.http.get<ProcesoContratacion[]>(endpointConContrato, {
                params: { '$query': queryConContrato }
            }).pipe(
                catchError(err => {
                    console.error('[ContratacionService] Error fetching SECOP II con contrato:', err);
                    return of([]);
                })
            ),
            sinContrato: this.http.get<ProcesoContratacion[]>(endpointSinContrato, {
                params: { '$query': querySinContrato }
            }).pipe(
                catchError(err => {
                    console.error('[ContratacionService] Error fetching SECOP II sin contrato:', err);
                    return of([]);
                })
            )
        }).pipe(
            map(({ conContrato, sinContrato }) => {
                console.log('[ContratacionService] Query SECOP II CON contrato:', queryConContrato);
                console.log('[ContratacionService] Query SECOP II SIN contrato:', querySinContrato);
                console.log(`[ContratacionService] SECOP II - Con contrato: ${conContrato.length}, Sin contrato: ${sinContrato.length}`);

                // Map para deduplicación usando clave única
                const procesosMap = new Map<string, ProcesoContratacion>();

                // 1. Agregar procesos CON contrato primero (prioridad)
                conContrato.forEach(proceso => {
                    const key = this.getUniqueKey(proceso);
                    if (key) {
                        procesosMap.set(key, proceso);
                    }
                });

                // 2. Agregar procesos SIN contrato solo si NO existen ya
                sinContrato.forEach(proceso => {
                    const key = this.getUniqueKey(proceso);
                    if (key && !procesosMap.has(key)) {
                        // Normalizar campos del dataset de procesos al formato de contratos
                        const procesoNormalizado = this.normalizarProceso(proceso);
                        procesosMap.set(key, procesoNormalizado);
                    }
                });

                const merged = Array.from(procesosMap.values());
                console.log(`[ContratacionService] SECOP II - Total después de fusión: ${merged.length}`);

                return merged;
            })
        );
    }

    /**
     * Obtiene una clave única para identificar un proceso/contrato
     * Prioridad solicitada: referencia_del_contrato (jbjy-vk9h) > referencia_del_proceso (p6dx-8zbt) > id_del_proceso > proceso_de_compra
     * Nota: se normaliza (trim + uppercase) para evitar duplicados por casing/espacios.
     */
    private getUniqueKey(proceso: ProcesoContratacion): string | null {
        const normalizeRef = (v?: string) => (v || '').toString().trim().toUpperCase();

        const refContrato = normalizeRef(proceso.referencia_del_contrato);
        if (refContrato) {
            return `REFC-${refContrato}`;
        }

        const refProceso = normalizeRef((proceso as any).referencia_del_proceso as string);
        if (refProceso) {
            return `REFP-${refProceso}`;
        }

        const idProceso = normalizeRef(proceso.id_del_proceso as string);
        if (idProceso) {
            return `IDP-${idProceso}`;
        }

        const procCompra = normalizeRef(proceso.proceso_de_compra as string);
        if (procCompra) {
            return `PC-${procCompra}`;
        }

        return null; // Si no tiene ningún identificador, se omite
    }

    /**
     * Normaliza campos del dataset de procesos (p6dx-8zbt) al formato de contratos (jbjy-vk9h)
     * para que sean compatibles en la UI
     */
    private normalizarProceso(proceso: ProcesoContratacion): ProcesoContratacion {
        const referenciaProceso = (proceso as any).referencia_del_proceso as string | undefined;
        return {
            ...proceso,
            // Mapear campos específicos del dataset de procesos -> compatibilidad con UI (usa referencia_del_contrato)
            referencia_del_contrato: proceso.referencia_del_contrato || referenciaProceso || proceso.id_del_proceso || proceso.proceso_de_compra,
            descripcion_del_proceso: proceso.descripcion_del_proceso || (proceso as any).descripci_n_del_procedimiento,
            estado_contrato: proceso.estado_contrato || (proceso as any).estado_del_procedimiento || 'Sin contrato',
            // Para procesos sin contrato, la fecha de referencia para filtros/orden es fecha_de_publicacion_del_proceso
            fecha_de_inicio_del_contrato: proceso.fecha_de_inicio_del_contrato || (proceso as any).fecha_de_publicacion_del_proceso,
            // Valores por defecto para procesos sin contrato
            valor_del_contrato: proceso.valor_del_contrato || 0,
            valor_pagado: proceso.valor_pagado || 0
        };
    }

    /**
     * Construye query SOQL para datasets de SECOP
     */
    private buildSoqlQuery(filtro: FiltroContratacion, tipo: 'secop1' | 'secop2', nombreEntidad?: string): string {
        const where: string[] = [];

        if (tipo === 'secop2') {
            // SECOP II - Dataset jbjy-vk9h (CON contrato)
            if (filtro.entidad) {
                where.push(`nit_entidad='${filtro.entidad}'`);
            }
            if (filtro.fechaDesde) {
                where.push(`fecha_de_firma>='${filtro.fechaDesde}T00:00:00.000'`);
            }
            if (filtro.fechaHasta) {
                where.push(`fecha_de_firma<='${filtro.fechaHasta}T23:59:59.999'`);
            }
        } else {
            // SECOP I - Dataset f789-7hwg
            if (filtro.entidad) {
                where.push(`nit_de_la_entidad='${filtro.entidad}'`);
            }
            if (filtro.fechaDesde) {
                where.push(`fecha_de_firma_del_contrato>='${filtro.fechaDesde}T00:00:00.000'`);
            }
            if (filtro.fechaHasta) {
                where.push(`fecha_de_firma_del_contrato<='${filtro.fechaHasta}T23:59:59.999'`);
            }
        }

        const whereClause = where.length > 0 ? ` WHERE ${where.join(' AND ')}` : '';
        const limitClause = ' LIMIT 10000';

        return `SELECT *${whereClause}${limitClause}`;
    }

    /**
     * Construye query SOQL para dataset de procesos SECOP II (p6dx-8zbt) - SIN contrato
     */
    private buildSoqlQueryProcesos(filtro: FiltroContratacion, nombreEntidad?: string): string {
        const where: string[] = [];

        // El dataset p6dx-8zbt tiene campos diferentes
        if (filtro.entidad) {
            // Buscar por NIT en el campo correspondiente
            where.push(`nit_entidad='${filtro.entidad}'`);
        }
        if (filtro.fechaDesde) {
            where.push(`fecha_de_publicacion_del_proceso>='${filtro.fechaDesde}T00:00:00.000'`);
        }
        if (filtro.fechaHasta) {
            where.push(`fecha_de_publicacion_del_proceso<='${filtro.fechaHasta}T23:59:59.999'`);
        }

        const whereClause = where.length > 0 ? ` WHERE ${where.join(' AND ')}` : '';
        const limitClause = ' LIMIT 10000';

        return `SELECT *${whereClause}${limitClause}`;
    }
}
