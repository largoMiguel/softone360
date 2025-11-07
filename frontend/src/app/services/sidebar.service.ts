import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class SidebarService {
    // Sidebar cerrado por defecto al iniciar sesión
    private _open$ = new BehaviorSubject<boolean>(false);
    readonly open$ = this._open$.asObservable();

    get isOpen(): boolean { return this._open$.value; }

    open() { this._open$.next(true); }
    close() { this._open$.next(false); }
    toggle() { this._open$.next(!this._open$.value); }
}
