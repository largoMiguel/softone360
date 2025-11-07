import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { EntityContextService } from '../services/entity-context.service';
import { EntityService } from '../services/entity.service';
import { map, of, switchMap } from 'rxjs';

function getSlugFromRoute(route: any, stateUrl: string, entityContext: EntityContextService): string | null {
    const fromParams = route?.params?.['slug'] || route?.parent?.params?.['slug'] || null;
    if (fromParams) return fromParams;
    const fromUrl = (stateUrl || '').replace(/^\//, '').split('/')[0] || null;
    if (fromUrl) return fromUrl;
    return entityContext.currentEntity?.slug || null;
}

export const enforceUserEntityGuard: CanActivateFn = (route, state) => {
    const router = inject(Router);
    const auth = inject(AuthService);
    const entityContext = inject(EntityContextService);
    const entityService = inject(EntityService);

    const user = auth.getCurrentUserValue();
    if (!user) return true; // otro guard maneja auth

    // Solo restringir para admin y secretario (superadmin puede ver todas)
    if (!(user.role === 'admin' || user.role === 'secretario')) return true;

    const currentSlug = getSlugFromRoute(route, state.url, entityContext);
    const currentEntity = entityContext.currentEntity;

    // Si ya tenemos entidad en contexto y coincide con el usuario, permitir
    if (currentEntity && user.entity_id && currentEntity.id === user.entity_id) return true;

    // Si el slug actual corresponde a otra entidad, buscar la del usuario y redirigir
    const subPath = route.routeConfig?.path || '';

    return entityService.getPublicEntities().pipe(
        map(entities => {
            if (!user.entity_id) {
                // Si el usuario no tiene entidad definida, volver al root de la entidad de la URL o inicio
                return router.createUrlTree(currentSlug ? ['/', currentSlug] : ['/']);
            }
            const target = entities.find(e => e.id === user.entity_id);
            if (!target) {
                // Si la entidad del usuario no está activa o no existe públicamente, regresar al inicio
                return router.createUrlTree(['/']);
            }
            if (target.slug === currentSlug) {
                return true; // ya está en su entidad
            }
            // Redirigir al mismo subpath pero en el slug correcto
            const segments = subPath ? ['/', target.slug, subPath] : ['/', target.slug];
            return router.createUrlTree(segments);
        })
    );
};
