import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Secretaria {
    id: number;
    entity_id: number;
    nombre: string;
    is_active: boolean;
    created_at?: string;
}

export interface CreateSecretariaPayload {
    nombre: string;
    entity_id?: number; // superadmin
}

@Injectable({ providedIn: 'root' })
export class SecretariasService {
    private http = inject(HttpClient);
    private baseUrl = `${environment.apiUrl}/secretarias`;

    listar(entityId?: number, includeInactive = false): Observable<Secretaria[]> {
        const params: string[] = [];
        if (entityId) params.push(`entity_id=${entityId}`);
        if (includeInactive) params.push(`include_inactive=true`);
        const suffix = params.length ? `?${params.join('&')}` : '';
        return this.http.get<Secretaria[]>(`${this.baseUrl}/${suffix}`);
    }

    crear(data: CreateSecretariaPayload): Observable<Secretaria> {
        return this.http.post<Secretaria>(`${this.baseUrl}/`, data);
    }

    toggle(id: number): Observable<Secretaria> {
        return this.http.patch<Secretaria>(`${this.baseUrl}/${id}/toggle/`, {});
    }
}
