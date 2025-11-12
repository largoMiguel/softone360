import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { PDMEjecucionResumen, PDMEjecucionUploadResponse } from '../models/pdm-ejecucion.model';

@Injectable({
    providedIn: 'root'
})
export class PdmEjecucionService {
    private baseUrl = `${environment.apiUrl}/pdm/ejecucion`;

    constructor(private http: HttpClient) { }

    /**
     * Carga un archivo Excel/CSV de ejecución presupuestal
     */
    uploadEjecucion(file: File): Observable<PDMEjecucionUploadResponse> {
        const formData = new FormData();
        formData.append('file', file);

        return this.http.post<PDMEjecucionUploadResponse>(`${this.baseUrl}/upload`, formData);
    }

    /**
     * Obtiene el resumen de ejecución presupuestal para un producto PDM
     */
    getEjecucionPorProducto(codigoProducto: string): Observable<PDMEjecucionResumen> {
        return this.http.get<PDMEjecucionResumen>(`${this.baseUrl}/${codigoProducto}`);
    }

    /**
     * Elimina todos los registros de ejecución de un producto
     */
    deleteEjecucionProducto(codigoProducto: string): Observable<any> {
        return this.http.delete(`${this.baseUrl}/${codigoProducto}`);
    }
}
