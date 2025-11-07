import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface AssignmentUpsertRequest {
    codigo_indicador_producto: string;
    secretaria?: string | null;
}

export interface AssignmentMapResponse {
    assignments: Record<string, string | null>;
}

export interface AvanceUpsertRequest {
    codigo_indicador_producto: string;
    anio: number;
    valor_ejecutado: number;
    comentario?: string;
}

export interface AvanceResponse {
    entity_id: number;
    codigo_indicador_producto: string;
    anio: number;
    valor_ejecutado: number;
    comentario?: string;
}

export interface ActividadCreateRequest {
    codigo_indicador_producto: string;
    nombre: string;
    descripcion?: string;
    responsable?: string;
    fecha_inicio?: string;
    fecha_fin?: string;
    estado: string;
    anio: number;
    meta_ejecutar: number;
    valor_ejecutado: number;
}

export interface ActividadUpdateRequest {
    nombre?: string;
    descripcion?: string;
    responsable?: string;
    fecha_inicio?: string;
    fecha_fin?: string;
    estado?: string;
    anio?: number;
    meta_ejecutar?: number;
    valor_ejecutado?: number;
}

export interface ActividadResponse {
    id: number;
    entity_id: number;
    codigo_indicador_producto: string;
    nombre: string;
    descripcion?: string;
    responsable?: string;
    fecha_inicio?: string;
    fecha_fin?: string;
    estado: string;
    anio: number;
    meta_ejecutar: number;
    valor_ejecutado: number;
    created_at: string;
    updated_at: string;
}

export interface EvidenciaCreateRequest {
    actividad_id: number;
    descripcion?: string;
    url?: string;
    imagenes?: Array<{
        nombre: string;
        mime_type: string;
        tamano: number;
        contenido_base64: string;
    }>;
}

export interface EvidenciaResponse {
    id: number;
    actividad_id: number;
    entity_id: number;
    descripcion?: string;
    url?: string;
    nombre_imagen?: string;
    mime_type?: string;
    tamano?: number;
    contenido?: string;
    created_at: string;
    updated_at: string;
}

export interface EvidenciasListResponse {
    actividad_id: number;
    evidencias: EvidenciaResponse[];
}

// Interfaces para Ejecuciones
export interface EjecucionImagenBase {
    nombre_imagen: string;
    mime_type: string;
    tamano: number;
    contenido: string; // base64
}

export interface EjecucionCreateRequest {
    actividad_id: number;
    valor_ejecutado_incremento: number;
    descripcion?: string;
    url_evidencia?: string;
    imagenes?: EjecucionImagenBase[];
    registrado_por?: string;
}

export interface EvidenciaImagenResponse {
    id: number;
    nombre_imagen: string;
    mime_type: string;
    tamano: number;
    contenido: string; // base64
}

export interface EjecucionResponse {
    id: number;
    actividad_id: number;
    entity_id: number;
    valor_ejecutado_incremento: number;
    descripcion?: string;
    url_evidencia?: string;
    registrado_por: string;
    created_at: string;
    updated_at: string;
    imagenes: EvidenciaImagenResponse[];
}

export interface EjecucionesListResponse {
    actividad_id: number;
    total_ejecutado: number;
    ejecuciones: EjecucionResponse[];
}

@Injectable({ providedIn: 'root' })
export class PdmBackendService {
    private http = inject(HttpClient);
    private baseUrl = `${environment.apiUrl}/pdm`;

    getAssignments(slug: string): Observable<AssignmentMapResponse> {
        return this.http.get<AssignmentMapResponse>(`${this.baseUrl}/${slug}/assignments`);
    }

    upsertAssignment(slug: string, payload: AssignmentUpsertRequest): Observable<any> {
        return this.http.post(`${this.baseUrl}/${slug}/assignments`, payload);
    }

    getAvances(slug: string, codigo: string): Observable<{ codigo_indicador_producto: string; avances: AvanceResponse[] }> {
        return this.http.get<{ codigo_indicador_producto: string; avances: AvanceResponse[] }>(`${this.baseUrl}/${slug}/avances`, { params: { codigo } });
    }

    upsertAvance(slug: string, payload: AvanceUpsertRequest): Observable<AvanceResponse> {
        return this.http.post<AvanceResponse>(`${this.baseUrl}/${slug}/avances`, payload);
    }

    getActividades(slug: string, codigo: string): Observable<{ codigo_indicador_producto: string; actividades: ActividadResponse[] }> {
        return this.http.get<{ codigo_indicador_producto: string; actividades: ActividadResponse[] }>(`${this.baseUrl}/${slug}/actividades`, { params: { codigo } });
    }

    getActividadesBulk(slug: string, codigos: string[]): Observable<{ items: Record<string, ActividadResponse[]> }> {
        return this.http.post<{ items: Record<string, ActividadResponse[]> }>(`${this.baseUrl}/${slug}/actividades/bulk`, { codigos });
    }

    createActividad(slug: string, payload: ActividadCreateRequest): Observable<ActividadResponse> {
        return this.http.post<ActividadResponse>(`${this.baseUrl}/${slug}/actividades`, payload);
    }

    updateActividad(slug: string, actividadId: number, payload: ActividadUpdateRequest): Observable<ActividadResponse> {
        return this.http.put<ActividadResponse>(`${this.baseUrl}/${slug}/actividades/${actividadId}`, payload);
    }

    deleteActividad(slug: string, actividadId: number): Observable<void> {
        return this.http.delete<void>(`${this.baseUrl}/${slug}/actividades/${actividadId}`);
    }

    // Evidencias
    createEvidencia(slug: string, actividadId: number, payload: EvidenciaCreateRequest): Observable<{ message: string; count: number }> {
        return this.http.post<{ message: string; count: number }>(`${this.baseUrl}/${slug}/actividades/${actividadId}/evidencias`, payload);
    }

    getEvidencias(slug: string, actividadId: number): Observable<EvidenciasListResponse> {
        return this.http.get<EvidenciasListResponse>(`${this.baseUrl}/${slug}/actividades/${actividadId}/evidencias`);
    }

    deleteEvidencia(slug: string, actividadId: number, evidenciaId: number): Observable<void> {
        return this.http.delete<void>(`${this.baseUrl}/${slug}/actividades/${actividadId}/evidencias/${evidenciaId}`);
    }

    // Ejecuciones
    createEjecucion(slug: string, actividadId: number, payload: EjecucionCreateRequest): Observable<EjecucionResponse> {
        return this.http.post<EjecucionResponse>(`${this.baseUrl}/${slug}/actividades/${actividadId}/ejecuciones`, payload);
    }

    getEjecuciones(slug: string, actividadId: number): Observable<EjecucionesListResponse> {
        return this.http.get<EjecucionesListResponse>(`${this.baseUrl}/${slug}/actividades/${actividadId}/ejecuciones`);
    }

    deleteEjecucion(slug: string, actividadId: number, ejecucionId: number): Observable<void> {
        return this.http.delete<void>(`${this.baseUrl}/${slug}/actividades/${actividadId}/ejecuciones/${ejecucionId}`);
    }

    // Excel management
    downloadExcel(slug: string): Observable<Blob> {
        return this.http.get(`${this.baseUrl}/${slug}/download-excel`, {
            responseType: 'blob'
        });
    }

    getExcelInfo(slug: string): Observable<{ existe: boolean; nombre_archivo?: string; tamanio?: number; fecha_carga?: string }> {
        return this.http.get<{ existe: boolean; nombre_archivo?: string; tamanio?: number; fecha_carga?: string }>(`${this.baseUrl}/${slug}/excel-info`);
    }
}
