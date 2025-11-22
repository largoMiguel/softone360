import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class TimeService {
    private readonly tz = 'America/Bogota';

    nowBogota(): Date {
        return new Date(); // Date es UTC internamente; usamos tz al formatear
    }

    formatDateBogota(dateString: string): string {
        const d = new Date(dateString);
        return d.toLocaleDateString('es-CO', { timeZone: this.tz });
    }

    formatDateTimeBogota(date: Date | string): string {
        const d = (date instanceof Date) ? date : new Date(date);
        return d.toLocaleString('es-CO', { timeZone: this.tz });
    }

    todayBogotaISODate(): string {
        const formatter = new Intl.DateTimeFormat('en-CA', {
            timeZone: this.tz,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
        return formatter.format(new Date()); // en-CA => YYYY-MM-DD
    }
}
