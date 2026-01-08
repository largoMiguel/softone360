import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Guard para proteger el módulo de Control de Asistencia
 * Solo permite acceso a usuarios autenticados con entidad asociada
 * y roles de secretario, admin o superadmin
 */
export const asistenciaGuard: CanActivateFn = (route, state) => {
    const authService = inject(AuthService);
    const router = inject(Router);
    
    const user = authService.getCurrentUserValue();
    
    // Si no hay usuario autenticado, redirigir al login de asistencia
    if (!user) {
        router.navigate(['/asistencia-login']);
        return false;
    }
    
    // Verificar que tenga entidad asociada
    if (!user.entity || !user.entity.slug) {
        router.navigate(['/asistencia-login']);
        return false;
    }
    
    // Verificar que tenga rol autorizado
    if (!['secretario', 'admin', 'superadmin'].includes(user.role)) {
        router.navigate(['/']);
        return false;
    }
    
    return true;
};
