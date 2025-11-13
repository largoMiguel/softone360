import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
    PlanInstitucional,
    PlanInstitucionalCreate,
    PlanInstitucionalUpdate,
    PlanInstitucionalCompleto,
    ComponenteProceso,
    ComponenteProcesoCreate,
    ComponenteProcesoUpdate,
    Actividad,
    ActividadCreate,
    ActividadUpdate,
    ActividadCompleta,
    ActividadEjecucion,
    ActividadEjecucionCreate,
    ActividadEjecucionUpdate,
    EstadoPlan,
    EstadoComponente,
    EstadisticasPlan
} from '../models/plan-v2.model';

@Injectable({ providedIn: 'root' })
export class PlanV2Service {
    private http = inject(HttpClient);
    private baseUrl = `${environment.apiUrl}/planes`;

    // ============== PLANES ==============
    listarPlanes(options?: { estado?: EstadoPlan; anio?: number; fecha_inicio?: string; fecha_fin?: string }): Observable<PlanInstitucional[]> {
        let params = new HttpParams();
        if (options?.estado) params = params.set('estado', options.estado);
        if (options?.anio) params = params.set('anio', options.anio.toString());
        if (options?.fecha_inicio) params = params.set('fecha_inicio', options.fecha_inicio);
        if (options?.fecha_fin) params = params.set('fecha_fin', options.fecha_fin);
        return this.http.get<PlanInstitucional[]>(`${this.baseUrl}/`, { params });
    }

    obtenerPlan(id: number): Observable<PlanInstitucional> {
        return this.http.get<PlanInstitucional>(`${this.baseUrl}/${id}`);
    }

    obtenerPlanCompleto(id: number): Observable<PlanInstitucionalCompleto> {
        return this.http.get<PlanInstitucionalCompleto>(`${this.baseUrl}/${id}/completo`);
    }

    crearPlan(data: PlanInstitucionalCreate): Observable<PlanInstitucional> {
        return this.http.post<PlanInstitucional>(`${this.baseUrl}/`, data);
    }

    actualizarPlan(id: number, data: PlanInstitucionalUpdate): Observable<PlanInstitucional> {
        return this.http.put<PlanInstitucional>(`${this.baseUrl}/${id}`, data);
    }

    eliminarPlan(id: number): Observable<void> {
        return this.http.delete<void>(`${this.baseUrl}/${id}`);
    }

    obtenerEstadisticasPlan(id: number): Observable<EstadisticasPlan> {
        return this.http.get<EstadisticasPlan>(`${this.baseUrl}/${id}/estadisticas`);
    }

    // ============== COMPONENTES ==============
    listarComponentes(planId: number, estado?: EstadoComponente): Observable<ComponenteProceso[]> {
        let params = new HttpParams();
        if (estado) params = params.set('estado', estado);
        return this.http.get<ComponenteProceso[]>(`${this.baseUrl}/${planId}/componentes`, { params });
    }

    crearComponente(planId: number, data: ComponenteProcesoCreate): Observable<ComponenteProceso> {
        return this.http.post<ComponenteProceso>(`${this.baseUrl}/${planId}/componentes`, data);
    }

    actualizarComponente(id: number, data: ComponenteProcesoUpdate): Observable<ComponenteProceso> {
        return this.http.put<ComponenteProceso>(`${this.baseUrl}/componentes/${id}`, data);
    }

    eliminarComponente(id: number): Observable<void> {
        return this.http.delete<void>(`${this.baseUrl}/componentes/${id}`);
    }

    // ============== ACTIVIDADES ==============
    listarActividades(componenteId: number): Observable<Actividad[]> {
        return this.http.get<Actividad[]>(`${this.baseUrl}/componentes/${componenteId}/actividades`);
    }

    obtenerActividad(id: number): Observable<Actividad> {
        return this.http.get<Actividad>(`${this.baseUrl}/actividades/${id}`);
    }

    obtenerActividadCompleta(id: number): Observable<ActividadCompleta> {
        return this.http.get<ActividadCompleta>(`${this.baseUrl}/actividades/${id}/completa`);
    }

    crearActividad(componenteId: number, data: ActividadCreate): Observable<Actividad> {
        return this.http.post<Actividad>(`${this.baseUrl}/componentes/${componenteId}/actividades`, data);
    }

    actualizarActividad(id: number, data: ActividadUpdate): Observable<Actividad> {
        return this.http.put<Actividad>(`${this.baseUrl}/actividades/${id}`, data);
    }

    eliminarActividad(id: number): Observable<void> {
        return this.http.delete<void>(`${this.baseUrl}/actividades/${id}`);
    }

    // Eliminado: actualización de avance manual

    // ============== EJECUCIONES ==============
    listarEjecuciones(actividadId: number, options?: { fecha_desde?: string; fecha_hasta?: string }): Observable<ActividadEjecucion[]> {
        let params = new HttpParams();
        if (options?.fecha_desde) params = params.set('fecha_desde', options.fecha_desde);
        if (options?.fecha_hasta) params = params.set('fecha_hasta', options.fecha_hasta);
        return this.http.get<ActividadEjecucion[]>(`${this.baseUrl}/actividades/${actividadId}/ejecuciones`, { params });
    }

    crearEjecucion(actividadId: number, data: ActividadEjecucionCreate): Observable<ActividadEjecucion> {
        return this.http.post<ActividadEjecucion>(`${this.baseUrl}/actividades/${actividadId}/ejecuciones`, data);
    }

    actualizarEjecucion(id: number, data: ActividadEjecucionUpdate): Observable<ActividadEjecucion> {
        return this.http.put<ActividadEjecucion>(`${this.baseUrl}/ejecuciones/${id}`, data);
    }

    eliminarEjecucion(id: number): Observable<void> {
        return this.http.delete<void>(`${this.baseUrl}/ejecuciones/${id}`);
    }

    // ==================== EVIDENCIAS ====================

    crearEvidencia(ejecucionId: number, data: any): Observable<any> {
        return this.http.post(`${this.baseUrl}/actividades/ejecuciones/${ejecucionId}/evidencias`, data);
    }

    listarEvidencias(ejecucionId: number): Observable<any[]> {
        return this.http.get<any[]>(`${this.baseUrl}/actividades/ejecuciones/${ejecucionId}/evidencias`);
    }

    eliminarEvidencia(evidenciaId: number): Observable<void> {
        return this.http.delete<void>(`${this.baseUrl}/evidencias/${evidenciaId}`);
    }
}
