import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
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

    private getSlug(): string {
        const user = this.authService.getCurrentUserValue();
        if (!user?.entity?.slug) {
            throw new Error('No se pudo obtener el slug de la entidad');
        }
        return user.entity.slug;
    }

    /**
     * Carga archivo Excel de contratos RPS y GUARDA EN DB.
     * DELETE+INSERT por entidad+año: reemplaza todos los contratos del año.
     */
    uploadContratos(file: File, codigoProducto?: string, anio?: number): Observable<UploadContratosResponse> {
        const formData = new FormData();
        formData.append('file', file);

        const slug = this.getSlug();

        let params = new HttpParams();
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
     * Obtiene contratos RPS desde DB, filtrando por producto y/o año.
     */
    getContratosPorProducto(codigoProducto: string, anio?: number): Observable<ResumenContratos> {
        const slug = this.getSlug();
        let params = new HttpParams().set('codigo_producto', codigoProducto);
        if (anio) {
            params = params.set('anio', anio.toString());
        }
        return this.http.get<ResumenContratos>(
            `${this.baseUrl}/${slug}/contratos`,
            { params }
        );
    }

    /**
     * Obtiene los años con contratos cargados para la entidad.
     */
    getAniosDisponibles(): Observable<{ anios: number[] }> {
        const slug = this.getSlug();
        return this.http.get<{ anios: number[] }>(`${this.baseUrl}/${slug}/anios`);
    }
}

