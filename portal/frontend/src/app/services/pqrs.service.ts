import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
    PQRS,
    PQRSWithDetails,
    CreatePQRSRequest,
    UpdatePQRSRequest,
    PQRSResponse,
    EstadoPQRS
} from '../models/pqrs.model';
import { environment } from '../../environments/environment';

@Injectable({
    providedIn: 'root'
})
export class PqrsService {
    private baseUrl = `${environment.apiUrl}/pqrs/`;

    constructor(private http: HttpClient) { }

    createPqrs(pqrsData: CreatePQRSRequest): Observable<PQRS> {
        return this.http.post<PQRS>(this.baseUrl, pqrsData);
    }

    getPqrs(params?: {
        skip?: number;
        limit?: number;
        estado?: EstadoPQRS;
        assigned_to_me?: boolean;
    }): Observable<PQRSWithDetails[]> {
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
            if (params.assigned_to_me !== undefined) {
                httpParams = httpParams.set('assigned_to_me', params.assigned_to_me.toString());
            }
        }

        return this.http.get<PQRSWithDetails[]>(this.baseUrl, { params: httpParams });
    }

    // Obtener PQRS del ciudadano autenticado
    getMisPqrs(): Observable<PQRSWithDetails[]> {
        return this.http.get<PQRSWithDetails[]>(`${this.baseUrl}mis-pqrs`);
    }

    getPqrsById(id: number): Observable<PQRSWithDetails> {
        return this.http.get<PQRSWithDetails>(`${this.baseUrl}${id}`);
    }

    updatePqrs(id: number, updateData: UpdatePQRSRequest): Observable<PQRS> {
        return this.http.put<PQRS>(`${this.baseUrl}${id}`, updateData);
    }

    assignPqrs(id: number, assignedToId: number, justificacion?: string): Observable<any> {
        return this.http.post(`${this.baseUrl}${id}/assign`, {
            assigned_to_id: assignedToId,
            justificacion: justificacion || undefined
        });
    }

    respondPqrs(id: number, response: PQRSResponse): Observable<PQRS> {
        return this.http.post<PQRS>(`${this.baseUrl}${id}/respond`, response);
    }

    deletePqrs(id: number): Observable<any> {
        return this.http.delete(`${this.baseUrl}${id}`);
    }

    // ENDPOINT PÚBLICO - No requiere autenticación
    consultarPqrsByRadicado(numeroRadicado: string): Observable<PQRS> {
        const url = `${environment.apiUrl}/pqrs/public/consultar/${numeroRadicado}`;
        return this.http.get<PQRS>(url);
    }

    // Upload de archivo adjunto
    uploadArchivo(pqrsId: number, file: File): Observable<any> {
        const formData = new FormData();
        formData.append('file', file);
        return this.http.post(`${this.baseUrl}${pqrsId}/upload`, formData);
    }

    // Subir archivo de respuesta
    uploadArchivoRespuesta(pqrsId: number, file: File): Observable<any> {
        const formData = new FormData();
        formData.append('file', file);
        return this.http.post(`${this.baseUrl}${pqrsId}/upload-respuesta`, formData);
    }

    // Obtener URL de descarga del archivo adjunto
    getArchivoDownloadUrl(pqrsId: number): Observable<{ download_url: string; expires_in: number; filename: string }> {
        return this.http.get<{ download_url: string; expires_in: number; filename: string }>(
            `${this.baseUrl}${pqrsId}/archivo/download-url`
        );
    }

    // Obtener el próximo número de radicado
    getNextRadicado(): Observable<{ next_radicado: string; format: string; description: string }> {
        return this.http.get<{ next_radicado: string; format: string; description: string }>(
            `${this.baseUrl}next-radicado`
        );
    }

    // Obtener historial de asignaciones
    getHistorialAsignaciones(pqrsId: number): Observable<any[]> {
        return this.http.get<any[]>(`${this.baseUrl}${pqrsId}/historial-asignaciones`);
    }
}