import { Routes } from '@angular/router';
import { VentanillaComponent } from './components/ventanilla/ventanilla';
import { LoginComponent } from './components/login/login';
// Dashboard lazy
// Other heavy modules lazy loaded
import { PortalCiudadanoComponent } from './components/portal-ciudadano/portal-ciudadano';
import { SoftAdminComponent } from './components/soft-admin/soft-admin';
import { authGuard, loginGuard, adminPortalGuard, ciudadanoGuard } from './guards/auth.guard';
import { superAdminGuard } from './guards/superadmin.guard';
import { planesEnabledGuard, pqrsEnabledGuard, contratacionEnabledGuard, pdmEnabledGuard } from './guards/feature.guard';
import { ShowcaseComponent } from './components/showcase/showcase';
import { ensureEntityGuard } from './guards/ensure-entity.guard';
import { enforceUserEntityGuard } from './guards/enforce-user-entity.guard';
import { entityResolver } from './resolvers/entity.resolver';
import { defaultEntityGuard } from './guards/default-entity.guard';
import { moduleAccessGuard } from './guards/module-access.guard';
import { sessionRedirectGuard } from './guards/session-redirect.guard';
import { showcaseSessionGuard } from './guards/showcase-session.guard';
import { IgacViewerComponent } from './components/igac-viewer/igac-viewer.component';

export const routes: Routes = [
    // Ruta raíz: muestra el showcase como home
    // Si hay sesión activa, redirige automáticamente al dashboard
    { path: '', component: ShowcaseComponent, canActivate: [showcaseSessionGuard] },

    // Ruta de login global (sin slug de entidad)
    { path: 'login', component: LoginComponent, canActivate: [loginGuard] },

    // Ruta de super administración (global, no depende de entidad)
    { path: 'soft-admin', component: SoftAdminComponent, canActivate: [superAdminGuard] },

    // Ruta provisional para visor IGAC (SIN autenticación - solo para pruebas)
    { path: 'igac-viewer', component: IgacViewerComponent },

    // Rutas por entidad (con slug). Ej: /chiquiza-boyaca/
    {
        path: ':slug',
        canActivate: [ensureEntityGuard],
        resolve: { entity: entityResolver },
        children: [
            { path: '', component: VentanillaComponent, canActivate: [sessionRedirectGuard] },
            { 
                path: 'ventanilla', 
                loadChildren: () => import('./components/ventanilla/ventanilla.routes').then(m => m.VENTANILLA_ROUTES),
                canActivate: [adminPortalGuard, enforceUserEntityGuard]
            },
            // El portal ciudadano no requiere permisos por módulos ni autenticación
            { path: 'portal-ciudadano', component: PortalCiudadanoComponent, canActivate: [ciudadanoGuard, pqrsEnabledGuard] },
            { path: 'dashboard', loadComponent: () => import('./components/dashboard/dashboard').then(m => m.DashboardComponent), canActivate: [adminPortalGuard, enforceUserEntityGuard] },
            { path: 'planes-dashboard', loadComponent: () => import('./components/planes-institucionales-v2/planes-dashboard/planes-dashboard').then(m => m.PlanesDashboardComponent), canActivate: [adminPortalGuard, enforceUserEntityGuard, planesEnabledGuard, moduleAccessGuard('planes_institucionales')] },
            { path: 'planes-institucionales', loadComponent: () => import('./components/planes-institucionales-v2/planes-institucionales-v2').then(m => m.PlanesInstitucionalesV2Component), canActivate: [adminPortalGuard, enforceUserEntityGuard, planesEnabledGuard, moduleAccessGuard('planes_institucionales')] },
            { path: 'pdm', loadComponent: () => import('./components/pdm/pdm').then(m => m.PdmComponent), canActivate: [adminPortalGuard, enforceUserEntityGuard, pdmEnabledGuard, moduleAccessGuard('pdm')] },
            { path: 'contratacion', loadComponent: () => import('./components/contratacion/contratacion').then(m => m.ContratacionComponent), canActivate: [adminPortalGuard, enforceUserEntityGuard, contratacionEnabledGuard, moduleAccessGuard('contratacion')] },
            // Administración de usuarios se gestiona desde el Dashboard (vista interna ?v=usuarios)
        ]
    },
    { path: '**', redirectTo: '' }
];