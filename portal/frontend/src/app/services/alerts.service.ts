import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface Alert {
    id: number;
    entity_id?: number;
    recipient_user_id?: number;
    type: string;
    title: string;
    message?: string;
    data?: string;
    created_at: string;
    read_at?: string;
}

export interface AlertsListResponse {
    unread_count: number;
    alerts: Alert[];
}

@Injectable({
    providedIn: 'root'
})
export class AlertsService {
    private http = inject(HttpClient);
    private baseUrl = `${environment.apiUrl}/alerts`;

    // BehaviorSubject para mantener el conteo de alertas no leídas
    private unreadCountSubject = new BehaviorSubject<number>(0);
    public unreadCount$ = this.unreadCountSubject.asObservable();

    /**
     * Obtiene la lista de alertas del usuario actual
     */
    getAlerts(onlyUnread: boolean = false, limit: number = 50): Observable<AlertsListResponse> {
        let url = `${this.baseUrl}?limit=${limit}`;
        if (onlyUnread) {
            url += '&only_unread=true';
        }

        return this.http.get<AlertsListResponse>(url).pipe(
            tap(response => {
                this.unreadCountSubject.next(response.unread_count);
            })
        );
    }

    /**
     * Marca una alerta como leída
     */
    markAsRead(alertId: number): Observable<any> {
        return this.http.post(`${this.baseUrl}/${alertId}/read`, {}).pipe(
            tap(() => {
                // Decrementar el contador
                const currentCount = this.unreadCountSubject.value;
                if (currentCount > 0) {
                    this.unreadCountSubject.next(currentCount - 1);
                }
            })
        );
    }

    /**
     * Marca todas las alertas como leídas
     */
    markAllAsRead(): Observable<any> {
        return this.http.post(`${this.baseUrl}/read-all`, {}).pipe(
            tap(() => {
                this.unreadCountSubject.next(0);
            })
        );
    }

    /**
     * Obtiene el conteo actual de alertas no leídas
     */
    getUnreadCount(): number {
        return this.unreadCountSubject.value;
    }

    /**
     * Refresca las alertas (útil para polling)
     */
    refreshAlerts(): void {
        this.getAlerts(true).subscribe();
    }
}
