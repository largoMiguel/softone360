import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { EntityContextService } from '../services/entity-context.service';

/**
 * Guard para proteger rutas según los módulos asignados al usuario.
 * Verifica que el usuario tenga acceso al módulo específico antes de permitir la navegación.
 * 
 * Uso: canActivate: [moduleAccessGuard('pqrs')]
 */
function getSlugFromRoute(route: any, stateUrl: string, entityContext: EntityContextService): string | null {
    const fromParams = route?.params?.['slug'] || route?.parent?.params?.['slug'] || null;
    if (fromParams) return fromParams;
    const fromUrl = (stateUrl || '').replace(/^\//, '').split('/')[0] || null;
    if (fromUrl) return fromUrl;
    return entityContext.currentEntity?.slug || null;
}

export const moduleAccessGuard = (requiredModule: string): CanActivateFn => {
    return (route, state) => {
        const authService = inject(AuthService);
        const router = inject(Router);
        const entityContext = inject(EntityContextService);

        const currentUser = authService.getCurrentUserValue();

        if (!currentUser) {
            const slug = getSlugFromRoute(route, state.url, entityContext);
            router.navigate(slug ? ['/', slug, 'login'] : ['/']);
            return false;
        }

        // ADMIN siempre tiene acceso
        if (currentUser.role === 'admin' || currentUser.role === 'superadmin') {
            return true;
        }        // Si el usuario no tiene allowed_modules definido (null o undefined),
        // es un usuario legacy con acceso completo (comportamiento anterior)
        if (!currentUser.allowed_modules) {
            return true;
        }

        // Si tiene allowed_modules vacío, no tiene acceso a nada
        if (currentUser.allowed_modules.length === 0) {
            const slug = getSlugFromRoute(route, state.url, entityContext);
            router.navigate(slug ? ['/', slug, 'dashboard'] : ['/']);
            return false;
        }

        // Verificar si el usuario tiene el módulo requerido
        const hasAccess = currentUser.allowed_modules.includes(requiredModule);

        if (!hasAccess) {
            const slug = getSlugFromRoute(route, state.url, entityContext);
            router.navigate(slug ? ['/', slug, 'dashboard'] : ['/']);
            return false;
        }

        return true;
    };
};