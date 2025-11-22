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
     * Carga un archivo Excel/CSV de ejecución presupuestal para un año específico
     */
    uploadEjecucion(file: File, anio?: number): Observable<PDMEjecucionUploadResponse> {
        if (!file) {
            console.error('⚠️ uploadEjecucion llamado con file null/undefined');
            throw new Error('Archivo no seleccionado');
        }

        const formData = new FormData();
        formData.append('file', file, file.name);
        if (anio) {
            formData.append('anio', anio.toString());
        }

        // DEBUG: listar contenido antes de enviar
        try {
            const debugEntries: any[] = [];
            formData.forEach((v, k) => {
                debugEntries.push({ clave: k, valor: v instanceof File ? `FILE(${v.name}, size=${v.size})` : v });
            });
            console.log('[uploadEjecucion] Enviando FormData:', debugEntries);
        } catch (e) {
            // Ignorar errores de inspección
        }

        return this.http.post<PDMEjecucionUploadResponse>(`${this.baseUrl}/upload`, formData);
    }

    /**
     * Obtiene el resumen de ejecución presupuestal para un producto PDM
     * Opcionalmente filtra por año
     */
    getEjecucionPorProducto(codigoProducto: string, anio?: number): Observable<PDMEjecucionResumen> {
        const params: Record<string, string> = {};
        if (anio) {
            params['anio'] = anio.toString();
        }
        return this.http.get<PDMEjecucionResumen>(`${this.baseUrl}/${codigoProducto}`, { params });
    }

    /**
     * Elimina todos los registros de ejecución de un producto
     */
    deleteEjecucionProducto(codigoProducto: string): Observable<any> {
        return this.http.delete(`${this.baseUrl}/${codigoProducto}`);
    }
}
