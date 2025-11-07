import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
    PlanInstitucional,
    Meta,
    CreatePlanRequest,
    UpdatePlanRequest,
    CreateMetaRequest,
    UpdateMetaRequest
} from '../models/plan.model';
import { environment } from '../../environments/environment';

@Injectable({
    providedIn: 'root'
})
export class PlanService {
    private http = inject(HttpClient);
    private apiUrl = environment.apiUrl;

    // ========== CRUD Planes Institucionales ==========

    /**
     * Obtener todos los planes institucionales
     * @param anio - Filtro opcional por año
     * @param estado - Filtro opcional por estado
     */
    getPlanes(anio?: number, estado?: string): Observable<PlanInstitucional[]> {
        let url = `${this.apiUrl}/planes/`;
        const params: string[] = [];

        if (anio) params.push(`anio=${anio}`);
        if (estado) params.push(`estado=${estado}`);

        if (params.length > 0) {
            url += `?${params.join('&')}`;
        }

        return this.http.get<PlanInstitucional[]>(url);
    }

    /**
     * Obtener un plan por ID (incluye todas las metas filtradas por rol)
     */
    getPlanById(id: number): Observable<PlanInstitucional> {
        return this.http.get<PlanInstitucional>(`${this.apiUrl}/planes/${id}/`);
    }

    /**
     * Crear un nuevo plan institucional
     */
    createPlan(plan: CreatePlanRequest): Observable<PlanInstitucional> {
        return this.http.post<PlanInstitucional>(`${this.apiUrl}/planes/`, plan);
    }

    /**
     * Actualizar un plan existente
     */
    updatePlan(id: number, plan: UpdatePlanRequest): Observable<PlanInstitucional> {
        return this.http.put<PlanInstitucional>(`${this.apiUrl}/planes/${id}/`, plan);
    }

    /**
     * Eliminar un plan
     */
    deletePlan(id: number): Observable<void> {
        return this.http.delete<void>(`${this.apiUrl}/planes/${id}/`);
    }

    // ========== CRUD Metas ==========

    /**
     * Obtener todas las metas de un plan (filtradas por rol automáticamente)
     * @param planId - ID del plan
     * @param estado - Filtro opcional por estado
     */
    getMetasByPlan(planId: number, estado?: string): Observable<Meta[]> {
        let url = `${this.apiUrl}/planes/${planId}/metas/`;
        if (estado) {
            url += `?estado=${estado}`;
        }
        return this.http.get<Meta[]>(url);
    }

    /**
     * Obtener una meta por ID
     */
    getMetaById(metaId: number): Observable<Meta> {
        return this.http.get<Meta>(`${this.apiUrl}/planes/metas/${metaId}/`);
    }

    /**
     * Crear una nueva meta
     */
    createMeta(planId: number, meta: CreateMetaRequest): Observable<Meta> {
        // Asegurar que plan_id esté en el objeto
        const metaData = { ...meta, plan_id: planId };
        return this.http.post<Meta>(`${this.apiUrl}/planes/${planId}/metas/`, metaData);
    }

    /**
     * Actualizar una meta existente
     */
    updateMeta(metaId: number, meta: UpdateMetaRequest): Observable<Meta> {
        return this.http.put<Meta>(`${this.apiUrl}/planes/metas/${metaId}/`, meta);
    }

    /**
     * Eliminar una meta
     */
    deleteMeta(metaId: number): Observable<void> {
        return this.http.delete<void>(`${this.apiUrl}/planes/metas/${metaId}/`);
    }
}
