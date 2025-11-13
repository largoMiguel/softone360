import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { AlertItem } from './notifications.service';

@Injectable({ providedIn: 'root' })
export class AlertsEventsService {
    private openSubject = new Subject<AlertItem>();
    openRequested$ = this.openSubject.asObservable();

    requestOpen(alert: AlertItem) {
        this.openSubject.next(alert);
    }

    // Evento para abrir el formulario de generar informe en el Dashboard
    private openReportFormSubject = new Subject<void>();
    openReportFormRequested$ = this.openReportFormSubject.asObservable();

    requestOpenReportForm() {
        this.openReportFormSubject.next();
    }
}
