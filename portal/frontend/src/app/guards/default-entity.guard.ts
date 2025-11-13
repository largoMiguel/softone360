import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { map, catchError, of } from 'rxjs';
import { EntityService } from '../services/entity.service';

export const defaultEntityGuard: CanActivateFn = (route, state) => {
    const entityService = inject(EntityService);
    const router = inject(Router);
    // Intentar obtener la primera entidad activa como por defecto
    return entityService.getPublicEntities().pipe(
        map(entities => {
            if (entities && entities.length > 0) {
                const defaultEntity = entities.find(e => e.is_active) || entities[0];
                router.navigate(['/', defaultEntity.slug], { replaceUrl: true });
                return false;
            } else {
                // Si no hay entidades, mostrar mensaje pero permitir acceso
                // para evitar bucle infinito con soft-admin guard
                console.warn('[defaultEntityGuard] No hay entidades disponibles');
                alert('No hay entidades configuradas. Por favor contacte al administrador del sistema.');
                return true; // Permitir acceso para evitar bucle
            }
        }),
        catchError(err => {
            // En caso de error al obtener entidades, mostrar error pero permitir acceso
            console.error('[defaultEntityGuard] Error al obtener entidades:', err);
            alert('Error al cargar las entidades. Por favor intente más tarde o contacte al administrador.');
            return of(true); // Permitir acceso para evitar bucle
        })
    );
};
