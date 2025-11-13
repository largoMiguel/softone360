import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { catchError, map, shareReplay, switchMap, tap } from 'rxjs/operators';
import { Router, ActivatedRoute, Params } from '@angular/router';
import { Entity } from '../models/entity.model';
import { EntityService } from './entity.service';

@Injectable({ providedIn: 'root' })
export class EntityContextService {
    private entity$ = new BehaviorSubject<Entity | null>(null);
    private loading$ = new BehaviorSubject<boolean>(false);

    private entityService = inject(EntityService);

    get currentEntity$(): Observable<Entity | null> {
        return this.entity$.asObservable();
    }

    get currentEntity(): Entity | null {
        return this.entity$.value;
    }

    get isLoading$(): Observable<boolean> {
        return this.loading$.asObservable();
    }

    clear() {
        this.entity$.next(null);
    }

    /**
     * Inicializa el contexto leyendo el slug de la URL y cargando la entidad.
     */
    initFromRoute(params: Params): Observable<Entity | null> {
        const slug = params['slug'];
        if (!slug) {
            this.clear();
            return of(null);
        }
        return this.setEntityBySlug(slug);
    }

    /**
     * Carga y establece la entidad actual a partir del slug.
     */
    setEntityBySlug(slug: string): Observable<Entity> {
        if (this.entity$.value && this.entity$.value.slug === slug) {
            return of(this.entity$.value);
        }
        this.loading$.next(true);
        return this.entityService.getEntityBySlug(slug).pipe(
            tap(entity => this.entity$.next(entity)),
            tap(() => this.loading$.next(false)),
            catchError(err => {
                this.loading$.next(false);
                this.clear();
                return throwError(() => err);
            }),
            shareReplay(1)
        );
    }
}
