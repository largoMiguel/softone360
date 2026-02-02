import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';
import { ResumenContratos, UploadContratosResponse } from '../models/pdm-contratos.model';

@Injectable({
    providedIn: 'root'
})
export class PdmContratosService {
    private http = inject(HttpClient);
    private authService = inject(AuthService);
    private baseUrl = `${environment.apiUrl}/pdm/contratos`;

    /**
     * Carga archivo Excel de contratos RPS y retorna datos procesados EN MEMORIA
     */
    uploadContratos(file: File, codigoProducto?: string, anio?: number): Observable<UploadContratosResponse> {
        const formData = new FormData();
        formData.append('file', file);

        // Obtener entity slug del usuario actual
        const user = this.authService.getCurrentUserValue();
        if (!user || !user.entity || !user.entity.slug) {
            throw new Error('No se pudo obtener el slug de la entidad');
        }
        const slug = user.entity.slug;

        // Construir URL con query params
        let params = new HttpParams();
        if (codigoProducto) {
            params = params.set('codigo_producto', codigoProducto);
        }
        if (anio) {
            params = params.set('anio', anio.toString());
        }

        return this.http.post<UploadContratosResponse>(
            `${this.baseUrl}/${slug}/upload`,
            formData,
            { params }
        );
    }

    /**
     * ✅ TEMPORAL: Retorna observable vacío ya que no hay datos en DB
     */
    getContratosPorProducto(codigoProducto: string, anio?: number): Observable<ResumenContratos> {
        // Retornar observable vacío (no hay datos en DB)
        return of({
            contratos: [],
            total_contratado: 0,
            cantidad_contratos: 0,
            anio: anio || 0
        });
    }
}
