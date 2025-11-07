import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { EntityContextService } from '../services/entity-context.service';

function getSlugFromRoute(route: any, stateUrl: string, entityContext: EntityContextService): string | null {
    const fromParams = route?.params?.['slug'] || route?.parent?.params?.['slug'] || null;
    if (fromParams) return fromParams;
    const fromUrl = (stateUrl || '').replace(/^\//, '').split('/')[0] || null;
    if (fromUrl) return fromUrl;
    return entityContext.currentEntity?.slug || null;
}

export const authGuard: CanActivateFn = (route, state) => {
    const authService = inject(AuthService);
    const router = inject(Router);
    const entityContext = inject(EntityContextService);

    if (authService.isAuthenticated()) {
        return true;
    } else {
        const slug = getSlugFromRoute(route, state.url, entityContext);
        router.navigate(slug ? ['/', slug, 'login'] : ['/']);
        return false;
    }
};

export const loginGuard: CanActivateFn = (route, state) => {
    const authService = inject(AuthService);
    // Permitir el acceso a /:slug/login aunque el usuario esté autenticado,
    // forzando un logout suave para que pueda iniciar sesión nuevamente.
    if (authService.isAuthenticated()) {
        authService.logout();
    }
    return true;
};

export const adminGuard: CanActivateFn = (route, state) => {
    const authService = inject(AuthService);
    const router = inject(Router);
    const entityContext = inject(EntityContextService);

    if (authService.isAuthenticated() && authService.isAdmin()) {
        return true;
    } else {
        const slug = getSlugFromRoute(route, state.url, entityContext);
        router.navigate(slug ? ['/', slug, 'dashboard'] : ['/']);
        return false;
    }
};

export const adminPortalGuard: CanActivateFn = (route, state) => {
    const authService = inject(AuthService);
    const router = inject(Router);
    const entityContext = inject(EntityContextService);

    if (!authService.isAuthenticated()) {
        const slug = getSlugFromRoute(route, state.url, entityContext);
        router.navigate(slug ? ['/', slug, 'login'] : ['/']);
        return false;
    }

    const currentUser = authService.getCurrentUserValue();
    if (currentUser && currentUser.role === 'ciudadano') {
        const slug = getSlugFromRoute(route, state.url, entityContext);
        router.navigate(slug ? ['/', slug, 'portal-ciudadano'] : ['/']);
        return false;
    }

    if (currentUser && (currentUser.role === 'admin' || currentUser.role === 'secretario')) {
        return true;
    }

    router.navigate(['/']);
    return false;
};

export const ciudadanoGuard: CanActivateFn = (route, state) => {
    const authService = inject(AuthService);
    const router = inject(Router);
    const entityContext = inject(EntityContextService);

    if (!authService.isAuthenticated()) {
        return true;
    }

    const currentUser = authService.getCurrentUserValue();
    if (currentUser && currentUser.role === 'ciudadano') {
        return true;
    }

    const slug = getSlugFromRoute(route, state.url, entityContext);
    router.navigate(slug ? ['/', slug, 'dashboard'] : ['/']);
    return false;
};