import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Guard para proteger el módulo de Control de Asistencia
 * Solo permite acceso a usuarios autenticados con entidad asociada,
 * roles de secretario, admin o superadmin, y marca de is_talento_humano
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
    
    // Verificar que la entidad tenga el módulo de asistencia habilitado
    if (!user.entity.enable_asistencia) {
        router.navigate(['/asistencia-login']);
        return false;
    }
    
    // Verificar que tenga rol autorizado
    if (!['secretario', 'admin', 'superadmin'].includes(user.role)) {
        router.navigate(['/']);
        return false;
    }
    
    // Admins y superadmins siempre tienen acceso
    if (user.role === 'admin' || user.role === 'superadmin') {
        return true;
    }
    
    // Para secretarios, verificar permisos específicos
    if (user.role === 'secretario') {
        // Debe tener la marca de Talento Humano
        if (!user.is_talento_humano) {
            router.navigate(['/']);
            return false;
        }
        
        // Debe tener el módulo 'asistencia' en allowed_modules
        if (!user.allowed_modules || !user.allowed_modules.includes('asistencia')) {
            router.navigate(['/']);
            return false;
        }
    }
    
    return true;
};
