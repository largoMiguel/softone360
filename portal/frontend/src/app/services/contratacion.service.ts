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
            map(rows => rows || []),
            catchError(err => {
                console.error('[ContratacionService] Error fetching SECOP I:', err);
                return of([]);
            })
        );
    }

    /**
     * Fetch SECOP II - SOLO dataset de CONTRATOS (jbjy-vk9h)
     */
    private fetchSecop2Merged(filtro: FiltroContratacion, nombreEntidad?: string): Observable<ProcesoContratacion[]> {
        const query = this.buildSoqlQuery(filtro, 'secop2', nombreEntidad);
        const endpoint = `${this.baseUrl}/proxy`;

        return this.http.get<ProcesoContratacion[]>(endpoint, {
            params: { '$query': query }
        }).pipe(
            map(rows => rows || []),
            catchError(err => {
                console.error('[ContratacionService] Error:', err);
                return of([]);
            })
        );
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


}
