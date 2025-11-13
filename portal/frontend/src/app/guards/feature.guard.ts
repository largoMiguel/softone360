import { inject } from '@angular/core';
import { Router, CanActivateFn, UrlTree } from '@angular/router';
import { EntityContextService } from '../services/entity-context.service';
import { map, of, switchMap } from 'rxjs';

export const planesEnabledGuard: CanActivateFn = (route, state) => {
    const router = inject(Router);
    const entityContext = inject(EntityContextService);

    const slug = route.params?.['slug'] || route.parent?.params?.['slug'] || null;
    const entity = entityContext.currentEntity;

    const allowOrRedirect = (enabled: boolean): boolean | UrlTree => {
        if (enabled) return true;
        return router.createUrlTree(slug ? ['/', slug, 'dashboard'] : ['/']);
    };

    if (entity && (!slug || entity.slug === slug)) {
        return allowOrRedirect(!!entity.enable_planes_institucionales);
    }

    if (!slug) {
        return router.createUrlTree(['/']);
    }

    // Cargar entidad por slug antes de decidir
    return entityContext.setEntityBySlug(slug).pipe(
        map(loaded => allowOrRedirect(!!loaded.enable_planes_institucionales))
    );
};

export const pqrsEnabledGuard: CanActivateFn = (route, state) => {
    const router = inject(Router);
    const entityContext = inject(EntityContextService);

    const slug = route.params?.['slug'] || route.parent?.params?.['slug'] || null;
    const entity = entityContext.currentEntity;

    const allowOrRedirect = (enabled: boolean): boolean | UrlTree => {
        if (enabled) return true;
        return router.createUrlTree(slug ? ['/', slug] : ['/']);
    };

    if (entity && (!slug || entity.slug === slug)) {
        return allowOrRedirect(!!entity.enable_pqrs);
    }

    if (!slug) {
        return router.createUrlTree(['/']);
    }

    return entityContext.setEntityBySlug(slug).pipe(
        map(loaded => allowOrRedirect(!!loaded.enable_pqrs))
    );
};

export const contratacionEnabledGuard: CanActivateFn = (route, state) => {
    const router = inject(Router);
    const entityContext = inject(EntityContextService);

    const slug = route.params?.['slug'] || route.parent?.params?.['slug'] || null;
    const entity = entityContext.currentEntity;

    const allowOrRedirect = (enabled: boolean): boolean | UrlTree => {
        if (enabled) return true;
        return router.createUrlTree(slug ? ['/', slug, 'dashboard'] : ['/']);
    };

    if (entity && (!slug || entity.slug === slug)) {
        return allowOrRedirect(!!(entity as any).enable_contratacion);
    }

    if (!slug) {
        return router.createUrlTree(['/']);
    }

    return entityContext.setEntityBySlug(slug).pipe(
        map(loaded => allowOrRedirect(!!(loaded as any).enable_contratacion))
    );
};

export const pdmEnabledGuard: CanActivateFn = (route, state) => {
    const router = inject(Router);
    const entityContext = inject(EntityContextService);

    const slug = route.params?.['slug'] || route.parent?.params?.['slug'] || null;
    const entity = entityContext.currentEntity;

    const allowOrRedirect = (enabled: boolean): boolean | UrlTree => {
        if (enabled) return true;
        return router.createUrlTree(slug ? ['/', slug, 'dashboard'] : ['/']);
    };

    if (entity && (!slug || entity.slug === slug)) {
        const enabled = (entity as any).enable_pdm;
        return allowOrRedirect(enabled === undefined ? true : !!enabled);
    }

    if (!slug) {
        return router.createUrlTree(['/']);
    }

    return entityContext.setEntityBySlug(slug).pipe(
        map(loaded => {
            const enabled = (loaded as any).enable_pdm;
            return allowOrRedirect(enabled === undefined ? true : !!enabled);
        })
    );
};
