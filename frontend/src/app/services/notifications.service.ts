import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface AlertItem {
    id: number;
    entity_id?: number | null;
    recipient_user_id?: number | null;
    type: string;
    title: string;
    message?: string | null;
    data?: string | null; // JSON serializado opcional
    created_at: string;
    read_at?: string | null;
}

export interface AlertsList {
    unread_count: number;
    alerts: AlertItem[];
}

@Injectable({ providedIn: 'root' })
export class NotificationsService {
    private baseUrl = `${environment.apiUrl}/alerts`;
    private alerts$ = new BehaviorSubject<AlertItem[]>([]);
    private unreadCount$ = new BehaviorSubject<number>(0);

    constructor(private http: HttpClient) { }

    get alertsStream(): Observable<AlertItem[]> {
        return this.alerts$.asObservable();
    }

    get unreadCountStream(): Observable<number> {
        return this.unreadCount$.asObservable();
    }

    fetch(onlyUnread = false): Observable<AlertsList> {
        let params = new HttpParams();
        if (onlyUnread) params = params.set('only_unread', 'true');
        return this.http.get<AlertsList>(`${this.baseUrl}/`, { params }).pipe(
            tap((res) => {
                this.alerts$.next(res.alerts);
                this.unreadCount$.next(res.unread_count);
            })
        );
    }

    markRead(id: number): Observable<{ ok: boolean }> {
        return this.http.post<{ ok: boolean }>(`${this.baseUrl}/${id}/read`, {}).pipe(
            tap(() => {
                const updated = this.alerts$.value.map(a => a.id === id ? { ...a, read_at: new Date().toISOString() } : a);
                this.alerts$.next(updated);
                const unread = updated.filter(a => !a.read_at).length;
                this.unreadCount$.next(unread);
            })
        );
    }

    markAllRead(): Observable<{ ok: boolean }> {
        return this.http.post<{ ok: boolean }>(`${this.baseUrl}/read-all`, {}).pipe(
            tap(() => {
                const updated = this.alerts$.value.map(a => ({ ...a, read_at: new Date().toISOString() }));
                this.alerts$.next(updated);
                this.unreadCount$.next(0);
            })
        );
    }
}
