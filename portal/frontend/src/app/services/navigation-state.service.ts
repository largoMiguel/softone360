import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

/**
 * Servicio para mantener estado de navegación en memoria
 * Reemplaza el uso de sessionStorage para pasar datos entre componentes
 */
@Injectable({
    providedIn: 'root'
})
export class NavigationStateService {
    // Estado PDM
    private pdmOpenProductoSubject = new BehaviorSubject<string | null>(null);
    private pdmOpenActividadSubject = new BehaviorSubject<string | null>(null);
    private pdmScrollToActividadSubject = new BehaviorSubject<string | null>(null);

    public pdmOpenProducto$ = this.pdmOpenProductoSubject.asObservable();
    public pdmOpenActividad$ = this.pdmOpenActividadSubject.asObservable();
    public pdmScrollToActividad$ = this.pdmScrollToActividadSubject.asObservable();

    // Métodos para PDM
    setPdmOpenProducto(codigo: string | null): void {
        this.pdmOpenProductoSubject.next(codigo);
    }

    getPdmOpenProducto(): string | null {
        return this.pdmOpenProductoSubject.value;
    }

    clearPdmOpenProducto(): void {
        this.pdmOpenProductoSubject.next(null);
    }

    setPdmOpenActividad(id: string | null): void {
        this.pdmOpenActividadSubject.next(id);
    }

    getPdmOpenActividad(): string | null {
        return this.pdmOpenActividadSubject.value;
    }

    clearPdmOpenActividad(): void {
        this.pdmOpenActividadSubject.next(null);
    }

    setPdmScrollToActividad(id: string | null): void {
        this.pdmScrollToActividadSubject.next(id);
    }

    getPdmScrollToActividad(): string | null {
        return this.pdmScrollToActividadSubject.value;
    }

    clearPdmScrollToActividad(): void {
        this.pdmScrollToActividadSubject.next(null);
    }

    // Limpiar todo el estado PDM
    clearPdmState(): void {
        this.pdmOpenProductoSubject.next(null);
        this.pdmOpenActividadSubject.next(null);
        this.pdmScrollToActividadSubject.next(null);
    }

    // Limpiar todo el estado de navegación
    clearAll(): void {
        this.clearPdmState();
    }
}
