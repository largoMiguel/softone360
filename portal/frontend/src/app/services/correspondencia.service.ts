import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
    Correspondencia,
    CorrespondenciaWithDetails,
    CreateCorrespondencia,
    UpdateCorrespondencia,
    EstadoCorrespondencia,
    TipoSolicitudCorrespondencia
} from '../models/correspondencia.model';
import { environment } from '../../environments/environment';

@Injectable({
    providedIn: 'root'
})
export class CorrespondenciaService {
    private baseUrl = `${environment.apiUrl}/correspondencia/`;

    constructor(private http: HttpClient) { }

    /**
     * Crear nueva correspondencia
     */
    createCorrespondencia(data: CreateCorrespondencia): Observable<Correspondencia> {
        return this.http.post<Correspondencia>(this.baseUrl, data);
    }

    /**
     * Obtener lista de correspondencias con filtros opcionales
     */
    getCorrespondencias(params?: {
        skip?: number;
        limit?: number;
        estado?: EstadoCorrespondencia;
        tipo_solicitud?: TipoSolicitudCorrespondencia;
    }): Observable<CorrespondenciaWithDetails[]> {
        let httpParams = new HttpParams();

        if (params) {
            if (params.skip !== undefined) {
                httpParams = httpParams.set('skip', params.skip.toString());
            }
            if (params.limit !== undefined) {
                httpParams = httpParams.set('limit', params.limit.toString());
            }
            if (params.estado) {
                httpParams = httpParams.set('estado', params.estado);
            }
            if (params.tipo_solicitud) {
                httpParams = httpParams.set('tipo_solicitud', params.tipo_solicitud);
            }
        }

        return this.http.get<CorrespondenciaWithDetails[]>(this.baseUrl, { params: httpParams });
    }

    /**
     * Obtener correspondencia por ID
     */
    getCorrespondenciaById(id: number): Observable<CorrespondenciaWithDetails> {
        return this.http.get<CorrespondenciaWithDetails>(`${this.baseUrl}${id}`);
    }

    /**
     * Actualizar correspondencia
     */
    updateCorrespondencia(id: number, data: UpdateCorrespondencia): Observable<Correspondencia> {
        return this.http.put<Correspondencia>(`${this.baseUrl}${id}`, data);
    }

    /**
     * Eliminar correspondencia
     */
    deleteCorrespondencia(id: number): Observable<any> {
        return this.http.delete(`${this.baseUrl}${id}`);
    }

    /**
     * Obtener vista previa del siguiente número de radicado
     */
    getNextRadicado(): Observable<{ numero_radicado: string }> {
        return this.http.get<{ numero_radicado: string }>(`${this.baseUrl}next-radicado/preview`);
    }
}
