import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { EntityContextService } from '../services/entity-context.service';
import { map, catchError, of } from 'rxjs';

// Asegura que la entidad esté cargada en el contexto ANTES de evaluar otros guards
export const ensureEntityGuard: CanActivateFn = (route, state) => {
    const router = inject(Router);
    const entityContext = inject(EntityContextService);

    const slug = route.params?.['slug'] || route.parent?.params?.['slug'] || null;
    if (!slug) {
        return router.createUrlTree(['/']);
    }

    const current = entityContext.currentEntity;
    if (current && current.slug === slug) {
        return true;
    }

    return entityContext.setEntityBySlug(slug).pipe(
        map(() => true as boolean | UrlTree),
        catchError((err) => {
            console.error(`No se pudo cargar la entidad con slug: ${slug}`, err);
            // Redirigir a la raíz para que defaultEntityGuard seleccione una entidad activa
            // Evitamos enviar al soft-admin para no exigir superadmin a usuarios públicos
            return of(router.createUrlTree(['/']));
        })
    );
};
