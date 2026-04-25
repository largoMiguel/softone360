import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface InformePqrs {
    id: number;
    filename: string;
    fecha_inicio: string;
    fecha_fin: string;
    total_pqrs: number;
    tasa_resolucion: number;
    used_ai: boolean;
    file_size_mb: number;
    download_url: string;
    created_at: string;
    expires_at: string;
    dias_restantes: number;
}

@Injectable({ providedIn: 'root' })
export class InformesPqrsService {
    private baseUrl = `${environment.apiUrl}/pqrs/informes`;

    private _informes$ = new BehaviorSubject<InformePqrs[]>([]);
    informes$ = this._informes$.asObservable();

    get count(): number { return this._informes$.value.length; }

    constructor(private http: HttpClient) {}

    cargar(): Observable<InformePqrs[]> {
        return this.http.get<InformePqrs[]>(this.baseUrl).pipe(
            tap(informes => this._informes$.next(informes))
        );
    }

    getInformes(): InformePqrs[] {
        return this._informes$.value;
    }
}
