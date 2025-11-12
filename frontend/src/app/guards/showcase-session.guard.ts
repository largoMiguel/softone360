import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { EntityContextService } from '../services/entity-context.service';

/**
 * Guard para el showcase (home) que redirige automáticamente si hay sesión activa.
 * 
 * Flujo:
 * - Si hay sesión activa, redirige al dashboard/portal según rol
 * - Si NO hay sesión, permite acceso al showcase
 * 
 * Previene que un usuario autenticado vuelva al home presionando back
 */
export const showcaseSessionGuard: CanActivateFn = (route, state) => {
    const authService = inject(AuthService);
    const entityContext = inject(EntityContextService);
    const router = inject(Router);

    if (authService.isAuthenticated()) {
        const user = authService.getCurrentUserValue();
        const entity = entityContext.currentEntity;

        if (user && entity) {
            // Redirigir según el rol del usuario
            if (user.role === 'ciudadano') {
                router.navigate(['/', entity.slug, 'portal-ciudadano'], { replaceUrl: true });
                return false;
            } else if (user.role === 'admin' || user.role === 'secretario') {
                router.navigate(['/', entity.slug, 'dashboard'], { replaceUrl: true });
                return false;
            } else if (user.role === 'superadmin') {
                router.navigate(['/soft-admin'], { replaceUrl: true });
                return false;
            }
        }
    }

    return true;
};
