import { Routes } from '@angular/router';
import { VentanillaComponent } from './components/ventanilla/ventanilla';
import { LoginComponent } from './components/login/login';
import { DashboardComponent } from './components/dashboard/dashboard';
import { PlanesInstitucionalesV2Component } from './components/planes-institucionales-v2/planes-institucionales-v2';
import { PortalCiudadanoComponent } from './components/portal-ciudadano/portal-ciudadano';
import { SoftAdminComponent } from './components/soft-admin/soft-admin';
import { PdmComponent } from './components/pdm/pdm';
import { authGuard, loginGuard, adminPortalGuard, ciudadanoGuard } from './guards/auth.guard';
import { superAdminGuard } from './guards/superadmin.guard';
import { planesEnabledGuard, pqrsEnabledGuard, contratacionEnabledGuard, pdmEnabledGuard } from './guards/feature.guard';
import { ContratacionComponent } from './components/contratacion/contratacion';
import { ShowcaseComponent } from './components/showcase/showcase';
import { ensureEntityGuard } from './guards/ensure-entity.guard';
import { enforceUserEntityGuard } from './guards/enforce-user-entity.guard';
import { entityResolver } from './resolvers/entity.resolver';
import { defaultEntityGuard } from './guards/default-entity.guard';
import { moduleAccessGuard } from './guards/module-access.guard';

export const routes: Routes = [
    // Ruta pública de showcase del sistema (sin autenticación ni entidad) - DEBE IR PRIMERO
    { path: 'showcase', component: ShowcaseComponent },

    // Ruta raíz: redirige a la primera entidad activa
    { path: '', canActivate: [defaultEntityGuard], children: [] },

    // Ruta de super administración (global, no depende de entidad)
    { path: 'soft-admin', component: SoftAdminComponent, canActivate: [superAdminGuard] },

    // Rutas por entidad (con slug). Ej: /chiquiza-boyaca/login
    {
        path: ':slug',
        canActivate: [ensureEntityGuard],
        resolve: { entity: entityResolver },
        children: [
            { path: '', component: VentanillaComponent },
            { path: 'login', component: LoginComponent, canActivate: [loginGuard] },
            // El portal ciudadano no requiere permisos por módulos ni autenticación
            { path: 'portal-ciudadano', component: PortalCiudadanoComponent, canActivate: [ciudadanoGuard, pqrsEnabledGuard] },
            { path: 'dashboard', component: DashboardComponent, canActivate: [adminPortalGuard, enforceUserEntityGuard] },
            { path: 'planes-dashboard', loadComponent: () => import('./components/planes-institucionales-v2/planes-dashboard/planes-dashboard').then(m => m.PlanesDashboardComponent), canActivate: [adminPortalGuard, enforceUserEntityGuard, planesEnabledGuard, moduleAccessGuard('planes_institucionales')] },
            { path: 'planes-institucionales', component: PlanesInstitucionalesV2Component, canActivate: [adminPortalGuard, enforceUserEntityGuard, planesEnabledGuard, moduleAccessGuard('planes_institucionales')] },
            { path: 'pdm', component: PdmComponent, canActivate: [adminPortalGuard, enforceUserEntityGuard, pdmEnabledGuard, moduleAccessGuard('pdm')] },
            { path: 'contratacion', component: ContratacionComponent, canActivate: [adminPortalGuard, enforceUserEntityGuard, contratacionEnabledGuard, moduleAccessGuard('contratacion')] },
            // Administración de usuarios se gestiona desde el Dashboard (vista interna ?v=usuarios)
        ]
    },
    { path: '**', redirectTo: '' }
];