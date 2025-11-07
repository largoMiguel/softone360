import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export type UserRole = 'SUPERADMIN' | 'ADMIN' | 'SECRETARIO' | 'CIUDADANO';
export type UserType = 'secretario' | 'contratista' | null;

export interface UserResponse {
    id: number;
    username: string;
    email: string;
    full_name: string;
    role: UserRole;
    entity_id?: number | null;
    user_type?: UserType;
    allowed_modules?: string[] | null;
    secretaria?: string | null;
    is_active: boolean;
    created_at: string;
    updated_at?: string | null;
}

export interface UserCreatePayload {
    username: string;
    email: string;
    full_name: string;
    password: string;
    role: UserRole;
    user_type?: UserType;
    secretaria?: string | null;
    allowed_modules?: string[] | null;
    // entity_id opcional: si lo omite un ADMIN, backend forzará su propia entidad
    entity_id?: number | null;
}

@Injectable({ providedIn: 'root' })
export class UsersService {
    private http = inject(HttpClient);
    private baseUrl = `${environment.apiUrl}/users`;

    listar(): Observable<UserResponse[]> {
        return this.http.get<UserResponse[]>(`${this.baseUrl}/`);
    }

    crear(data: UserCreatePayload): Observable<UserResponse> {
        return this.http.post<UserResponse>(`${this.baseUrl}/`, data);
    }

    eliminar(id: number): Observable<{ message: string }> {
        return this.http.delete<{ message: string }>(`${this.baseUrl}/${id}/`);
    }
}
