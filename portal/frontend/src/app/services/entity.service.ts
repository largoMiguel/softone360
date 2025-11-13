import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Entity, EntityWithStats, CreateEntityRequest, UpdateEntityRequest } from '../models/entity.model';
import { environment } from '../../environments/environment';

@Injectable({
    providedIn: 'root'
})
export class EntityService {
    private baseUrl = `${environment.apiUrl}/entities`;

    constructor(private http: HttpClient) { }

    /**
     * Obtener todas las entidades (solo superadmin)
     */
    getEntities(): Observable<EntityWithStats[]> {
        return this.http.get<EntityWithStats[]>(this.baseUrl);
    }

    /**
     * Obtener entidades públicas (activas) para selección por defecto (público)
     */
    getPublicEntities(): Observable<Entity[]> {
        return this.http.get<Entity[]>(`${this.baseUrl}/public`);
    }

    /**
     * Obtener una entidad por ID (solo superadmin)
     */
    getEntity(id: number): Observable<Entity> {
        return this.http.get<Entity>(`${this.baseUrl}/${id}`);
    }

    /**
     * Obtener una entidad por slug (público)
     */
    getEntityBySlug(slug: string): Observable<Entity> {
        return this.http.get<Entity>(`${this.baseUrl}/by-slug/${slug}`);
    }

    /**
     * Crear nueva entidad (solo superadmin)
     */
    createEntity(entity: CreateEntityRequest): Observable<Entity> {
        return this.http.post<Entity>(this.baseUrl, entity);
    }

    /**
     * Actualizar entidad (solo superadmin)
     */
    updateEntity(id: number, entity: UpdateEntityRequest): Observable<Entity> {
        return this.http.put<Entity>(`${this.baseUrl}/${id}`, entity);
    }

    /**
     * Eliminar entidad (solo superadmin)
     */
    deleteEntity(id: number): Observable<any> {
        return this.http.delete(`${this.baseUrl}/${id}`);
    }

    /**
     * Activar/desactivar entidad (solo superadmin)
     */
    toggleEntityStatus(id: number): Observable<Entity> {
        return this.http.patch<Entity>(`${this.baseUrl}/${id}/toggle-status`, {});
    }

    /**
     * Obtener usuarios de una entidad (solo superadmin)
     */
    getEntityUsers(id: number): Observable<any[]> {
        return this.http.get<any[]>(`${this.baseUrl}/${id}/users`);
    }
}
