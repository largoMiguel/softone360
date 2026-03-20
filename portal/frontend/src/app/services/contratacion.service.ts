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
    * - Fusiona los resultados sin duplicar usando referencias oficiales
    *   (referencia_del_contrato para jbjy-vk9h y referencia_del_proceso para p6dx-8zbt)
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
            map(rows => {
                const data = (rows || []).map(r => this.normalizarSecop1(r));
                
                // Deduplicar por referencia (numero_de_contrato) para evitar duplicados en SECOP I
                const seen = new Set<string>();
                const deduplicated = data.filter(d => {
                    const ref = (d.referencia_del_contrato || d.numero_de_constancia || '').toString().trim();
                    if (!ref || seen.has(ref)) return false;
                    seen.add(ref);
                    return true;
                });
                
                // Filtrar por nombre de entidad si se proporciona
                return nombreEntidad ? this.filterByEntityName(deduplicated, nombreEntidad, 'secop1') : deduplicated;
            }),
            catchError(err => {
                console.error('[ContratacionService] Error fetching SECOP I:', err);
                return of([]);
            })
        );
    }

    /**
     * Normaliza un registro de SECOP I para que use los mismos nombres de campo que SECOP II.
     * Así la plantilla y los KPIs funcionan igual para ambos orígenes.
     *
     * Mapeo principal:
     *   numero_de_contrato           → referencia_del_contrato
     *   estado_del_proceso           → estado_contrato
     *   cuantia_contrato             → valor_del_contrato
     *   nom_razon_social_contratista → proveedor_adjudicado
     *   fecha_de_firma_del_contrato  → fecha_de_firma
     *   fecha_ini_ejec_contrato      → fecha_de_inicio_del_contrato
     *   fecha_fin_ejec_contrato      → fecha_de_fin_del_contrato
     *   objeto_del_contrato_a_la     → descripcion_del_proceso / objeto_del_contrato
     *   ruta_proceso_en_secop_i      → urlproceso
     */
    private normalizarSecop1(r: any): ProcesoContratacion {
        return {
            ...r,
            // Referencia: SECOP I usa numero_de_contrato
            referencia_del_contrato: r.numero_de_contrato || r.numero_de_proceso || r.numero_de_constancia,
            // Estado
            estado_contrato: r.estado_del_proceso,
            // Valor
            valor_del_contrato: r.cuantia_contrato || r.valor_contrato_con_adiciones || r.cuantia_proceso,
            valor_pagado: r.valor_rubro,
            // Proveedor
            proveedor_adjudicado: r.nom_razon_social_contratista,
            documento_proveedor: r.identificacion_del_contratista,
            tipodocproveedor: r.tipo_identifi_del_contratista,
            // Fechas
            fecha_de_firma: r.fecha_de_firma_del_contrato,
            fecha_de_inicio_del_contrato: r.fecha_ini_ejec_contrato,
            fecha_de_fin_del_contrato: r.fecha_fin_ejec_contrato,
            ultima_actualizacion: r.ultima_actualizacion || r.fecha_de_cargue_en_el_secop,
            // Descripción / Objeto
            descripcion_del_proceso: r.objeto_del_contrato_a_la || r.detalle_del_objeto_a_contratar || r.objeto_a_contratar,
            objeto_del_contrato: r.objeto_del_contrato_a_la || r.detalle_del_objeto_a_contratar,
            // URL SECOP I tiene estructura diferente: { url: '...' }
            urlproceso: r.ruta_proceso_en_secop_i,
            // Liquidación
            liquidaci_n: r.compromiso_presupuestal,
        };
    }

    /**
     * Fetch SECOP II - Fusiona dataset de CONTRATOS (jbjy-vk9h) y PROCESOS sin contrato (p6dx-8zbt)
     */
    private fetchSecop2Merged(filtro: FiltroContratacion, nombreEntidad?: string): Observable<ProcesoContratacion[]> {
        const queryContratos = this.buildSoqlQuery(filtro, 'secop2', nombreEntidad);
        const queryProcesos = this.buildSoqlQueryProcesos(filtro);

        const contratos$ = this.http.get<ProcesoContratacion[]>(`${this.baseUrl}/proxy`, {
            params: { '$query': queryContratos }
        }).pipe(catchError(err => {
            console.error('[ContratacionService] Error SECOP II contratos:', err);
            return of([]);
        }));

        const procesos$ = this.http.get<ProcesoContratacion[]>(`${this.baseUrl}/proxy-secop2-procesos`, {
            params: { '$query': queryProcesos }
        }).pipe(
            map(rows => (rows || []).map(r => ({ ...r, sin_contrato: true } as ProcesoContratacion))),
            catchError(err => {
                console.error('[ContratacionService] Error SECOP II procesos:', err);
                return of([]);
            })
        );

        return forkJoin([contratos$, procesos$]).pipe(
            map(([contratos, procesos]) => {
                // Deduplicar: los 'procesos' pueden existir ya en 'contratos'
                // Crear set de referencias de contratos CON contrato (solo referencias no vacías)
                const refsConContrato = new Set(
                    (contratos || [])
                        .map(c => (c.referencia_del_contrato || c.referencia_del_proceso || '').toString().trim())
                        .filter(ref => ref !== '')
                );
                // Filtrar procesos sin contrato que no estén ya en contratos
                const procesosSinDuplicados = (procesos || []).filter(p => {
                    const ref = (p.referencia_del_proceso || p.referencia_del_contrato || '').toString().trim();
                    // Si la referencia está vacía, siempre incluir (no se puede comparar)
                    if (ref === '') return true;
                    return !refsConContrato.has(ref);
                });
                const merged = [...(contratos || []), ...procesosSinDuplicados];
                // Filtrar por nombre de entidad si se proporciona
                return nombreEntidad ? this.filterByEntityName(merged, nombreEntidad, 'secop2') : merged;
            })
        );
    }

    /**
     * Filtra procesos por nombre de entidad usando fuzzy matching
     * Útil cuando un NIT corresponde a múltiples entidades
     */
    private filterByEntityName(rows: ProcesoContratacion[], nombreEntidad: string, tipo: 'secop1' | 'secop2'): ProcesoContratacion[] {
        if (!rows.length || !nombreEntidad) return rows;

        const normalize = (str: string) => str.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const targetName = normalize(nombreEntidad);

        // jbjy-vk9h usa "nombre_entidad", p6dx-8zbt usa "entidad", SECOP I usa "nombre_entidad"
        const getEntityName = (row: ProcesoContratacion): string | null => {
            const v = (row as any)['nombre_entidad'] || (row as any)['entidad'];
            return v ? normalize(v.toString()) : null;
        };

        // Si solo hay un nombre único en los resultados no hay ambigüedad
        const uniqueNames = [...new Set(rows.map(getEntityName).filter(Boolean))] as string[];
        if (uniqueNames.length <= 1) return rows;

        // Tipos de entidades municipales colombianas con sus palabras clave y exclusiones mutuas
        const ENTITY_TYPES: { keywords: string[]; excludes: string[] }[] = [
            {
                // Alcaldía / Municipio (ejecutivo)
                keywords: ['ALCALDIA', 'MUNICIPIO'],
                excludes: ['CONCEJO', 'PERSONERIA', 'CONTRALORIA', 'JUZGADO', 'TRIBUNAL', 'FISCALIA', 'DEFENSORIA']
            },
            {
                // Concejo (legislativo)
                keywords: ['CONCEJO'],
                excludes: ['MUNICIPIO', 'ALCALDIA', 'PERSONERIA', 'CONTRALORIA', 'JUZGADO', 'TRIBUNAL', 'FISCALIA']
            },
            {
                // Personería (control disciplinario)
                keywords: ['PERSONERIA'],
                excludes: ['MUNICIPIO', 'ALCALDIA', 'CONCEJO', 'CONTRALORIA', 'JUZGADO', 'TRIBUNAL', 'FISCALIA']
            },
            {
                // Contraloría (control fiscal)
                keywords: ['CONTRALORIA'],
                excludes: ['MUNICIPIO', 'ALCALDIA', 'CONCEJO', 'PERSONERIA', 'JUZGADO', 'TRIBUNAL', 'FISCALIA']
            }
        ];

        // Detectar el tipo de la entidad destino
        const matchedType = ENTITY_TYPES.find(t => t.keywords.some(k => targetName.includes(k)));

        if (matchedType) {
            const filtered = rows.filter(row => {
                const entityName = getEntityName(row);
                if (!entityName) return true;
                // Excluir filas cuyos nombres de entidad corresponden a otro tipo de organismo
                return matchedType.excludes.every(excl => !entityName.includes(excl));
            });
            if (filtered.length > 0) return filtered;
        }

        // Fallback: retornar todos si no se pudo detectar el tipo
        return rows;
    }

    /**
     * Construye query SOQL para el dataset de procesos SECOP II (p6dx-8zbt)
     */
    private buildSoqlQueryProcesos(filtro: FiltroContratacion): string {
        const where: string[] = [];
        const nit = filtro.entidad ? this.sanitizeNit(filtro.entidad) : '';
        if (nit) {
            where.push(`nit_entidad='${nit}'`);
        }
        if (filtro.fechaDesde) {
            where.push(`fecha_de_publicacion_del>='${filtro.fechaDesde}T00:00:00.000'`);
        }
        if (filtro.fechaHasta) {
            where.push(`fecha_de_publicacion_del<='${filtro.fechaHasta}T23:59:59.999'`);
        }
        const whereClause = where.length > 0 ? ` WHERE ${where.join(' AND ')}` : '';
        return `SELECT *${whereClause} LIMIT 10000`;
    }

    /**
     * Sanitiza un NIT eliminando puntos, comas y espacios que algunos sistemas agregan
     * SECOP siempre almacena NITs sin puntos: '800099723' no '800.099.723'
     */
    private sanitizeNit(nit: string): string {
        return nit.replace(/[.\s,-]/g, '').trim();
    }

    /**
     * Construye query SOQL para datasets de SECOP
     */
    private buildSoqlQuery(filtro: FiltroContratacion, tipo: 'secop1' | 'secop2', nombreEntidad?: string): string {
        const where: string[] = [];
        const nit = filtro.entidad ? this.sanitizeNit(filtro.entidad) : '';

        if (tipo === 'secop2') {
            // SECOP II - Dataset jbjy-vk9h (CON contrato)
            if (nit) {
                where.push(`nit_entidad='${nit}'`);
            }
            if (filtro.fechaDesde) {
                where.push(`fecha_de_firma>='${filtro.fechaDesde}T00:00:00.000'`);
            }
            if (filtro.fechaHasta) {
                where.push(`fecha_de_firma<='${filtro.fechaHasta}T23:59:59.999'`);
            }
        } else {
            // SECOP I - Dataset f789-7hwg
            if (nit) {
                where.push(`nit_de_la_entidad='${nit}'`);
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


}
