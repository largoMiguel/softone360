import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

/**
 * Guard que redirige automáticamente al dashboard/portal correcto si hay sesión activa.
 * 
 * Flujo:
 * - Si usuario autenticado accede a /:slug (vacío), redirige a dashboard/portal-ciudadano
 * - Si usuario NO autenticado, permite acceso a ventanilla (:slug)
 * 
 * Esto permite que al presionar "back" y llegar a /:slug, se redirija automáticamente
 * sin necesidad de iniciar sesión nuevamente.
 */
export const sessionRedirectGuard: CanActivateFn = (route, state) => {
    const authService = inject(AuthService);
    const router = inject(Router);

    // Solo aplicar si es acceso a /:slug (sin subruta adicional)
    const currentPath = state.url.split('?')[0]; // Eliminar query params
    const pathParts = currentPath.split('/').filter(p => p);
    
    // Si la ruta es solo /:slug (ej: /chiquiza-boyaca) sin subrutas
    if (pathParts.length === 1 && authService.isAuthenticated()) {
        const user = authService.getCurrentUserValue();
        const slug = route.params?.['slug'];

        if (user && slug) {
            // Redirigir según el rol del usuario
            if (user.role === 'ciudadano') {
                router.navigate(['/', slug, 'portal-ciudadano'], { replaceUrl: true });
                return false;
            } else if (user.role === 'admin' || user.role === 'secretario') {
                router.navigate(['/', slug, 'dashboard'], { replaceUrl: true });
                return false;
            } else if (user.role === 'superadmin') {
                router.navigate(['/soft-admin'], { replaceUrl: true });
                return false;
            }
        }
    }

    return true;
};
