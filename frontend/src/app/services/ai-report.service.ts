import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface ContratacionSummaryPayload {
    entity_name?: string | null;
    nit?: string | null;
    periodo?: { desde?: string | null; hasta?: string | null };
    kpis: {
        totalProcesos: number;
        totalAdjudicados: number;
        tasaAdjudicacion: number;
        sumaAdjudicado: number;
        promedioPrecioBase: number;
    };
    distribuciones?: {
        estados?: Record<string, number>;
        modalidades?: Record<string, number>;
        tiposContrato?: Record<string, number>;
    };
    top_proveedores?: Array<{ nombre: string; valor: number }>;
    notas?: string;
}

@Injectable({ providedIn: 'root' })
export class AiReportService {
    private summaryUrl = `${environment.apiUrl}/contratacion/summary`;

    constructor(private http: HttpClient) { }

    summarizeContratacion(payload: ContratacionSummaryPayload): Observable<{ configured: boolean; summary: string }> {
        return this.http.post<{ configured: boolean; summary: string }>(this.summaryUrl, payload);
    }
}
