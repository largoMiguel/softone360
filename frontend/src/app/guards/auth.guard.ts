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
    const router = inject(Router);
    
    // Si el usuario está autenticado y viene desde el back del navegador,
    // permitir acceso a /login. Si viene acceso directo, hacer logout.
    // Para determinar esto, verificamos si hay referrer:
    if (authService.isAuthenticated()) {
        // Permitir que el usuario pueda acceder a /login con back button sin perder sesión
        // Solo hacer logout si viene de acceso directo (sin referrer)
        const referrer = document.referrer;
        const isBackNavigation = referrer && referrer.includes(window.location.hostname);
        
        if (!isBackNavigation) {
            // Acceso directo a /login - logout suave para nueva sesión
            authService.logout();
        }
        // Si es back navigation, permitir acceso sin logout
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