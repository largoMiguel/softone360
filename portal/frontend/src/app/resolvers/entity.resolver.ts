import { inject } from '@angular/core';
import { ResolveFn, ActivatedRouteSnapshot, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { Entity } from '../models/entity.model';
import { EntityContextService } from '../services/entity-context.service';

export const entityResolver: ResolveFn<Entity | null> = (route: ActivatedRouteSnapshot) => {
    const entityContext = inject(EntityContextService);
    const router = inject(Router);
    return entityContext.initFromRoute(route.params).pipe(
        map(entity => entity),
        catchError(() => {
            // Si falla la carga del slug (404), redirigir a inicio
            router.navigate(['/']);
            return of(null);
        })
    );
};
