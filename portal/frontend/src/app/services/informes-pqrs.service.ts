import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, combineLatest, map } from 'rxjs';
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

const STORAGE_KEY = 'informes_pqrs_viewed_ids';

function loadViewedIds(): Set<number> {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return new Set();
        const arr = JSON.parse(raw);
        return new Set(Array.isArray(arr) ? arr : []);
    } catch {
        return new Set();
    }
}

function saveViewedIds(ids: Set<number>): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(ids)));
}

@Injectable({ providedIn: 'root' })
export class InformesPqrsService {
    private baseUrl = `${environment.apiUrl}/pqrs/informes`;

    private _informes$ = new BehaviorSubject<InformePqrs[]>([]);
    informes$ = this._informes$.asObservable();

    private _viewedIds$ = new BehaviorSubject<Set<number>>(loadViewedIds());

    /** Cantidad de informes cuyo id no ha sido marcado como visto */
    nuevos$: Observable<number> = combineLatest([this._informes$, this._viewedIds$]).pipe(
        map(([informes, viewed]) =>
            informes.filter(i => !viewed.has(i.id)).length
        )
    );

    get count(): number { return this._informes$.value.length; }

    constructor(private http: HttpClient) {}

    cargar(): Observable<InformePqrs[]> {
        return this.http.get<InformePqrs[]>(this.baseUrl).pipe(
            tap(informes => this._informes$.next(informes))
        );
    }

    /** Marca todos los informes actuales como vistos → badge a 0 */
    marcarTodosVistos(): void {
        const ids = new Set(this._viewedIds$.value);
        for (const inf of this._informes$.value) {
            ids.add(inf.id);
        }
        saveViewedIds(ids);
        this._viewedIds$.next(ids);
    }

    getInformes(): InformePqrs[] {
        return this._informes$.value;
    }
}
