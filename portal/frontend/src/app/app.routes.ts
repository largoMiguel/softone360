import { Routes } from '@angular/router';
import { VentanillaComponent } from './components/ventanilla/ventanilla';
import { LoginComponent } from './components/login/login';
// Dashboard lazy
// Other heavy modules lazy loaded
import { PortalCiudadanoComponent } from './components/portal-ciudadano/portal-ciudadano';
import { SoftAdminComponent } from './components/soft-admin/soft-admin';
import { authGuard, loginGuard, adminPortalGuard, ciudadanoGuard } from './guards/auth.guard';
import { superAdminGuard } from './guards/superadmin.guard';
import { asistenciaGuard } from './guards/asistencia.guard';
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
import { ServiciosIngenieriaComponent } from './components/servicios-ingenieria/servicios-ingenieria.component';

export const routes: Routes = [
    // Ruta raíz: muestra el showcase como home
    // Si hay sesión activa, redirige automáticamente al dashboard
    { path: '', component: ShowcaseComponent, canActivate: [showcaseSessionGuard] },

    // Ruta de login global (sin slug de entidad)
    { path: 'login', component: LoginComponent, canActivate: [loginGuard] },
    
    // Ruta de login para Control de Asistencia (independiente)
    { 
        path: 'asistencia-login', 
        loadComponent: () => import('./components/ventanilla/login-asistencia/login-asistencia.component').then(m => m.LoginAsistenciaComponent)
    },
    
    // Módulo de Control de Asistencia (Talento Humano) - Completamente independiente del portal administrativo
    {
        path: 'talento-humano',
        loadChildren: () => import('./components/ventanilla/ventanilla.routes').then(m => m.VENTANILLA_ROUTES),
        canActivate: [asistenciaGuard]
    },

    // Ruta de super administración (global, no depende de entidad)
    { path: 'soft-admin', component: SoftAdminComponent, canActivate: [superAdminGuard] },

    // Ruta provisional para visor IGAC (SIN autenticación - solo para pruebas)
    { path: 'igac-viewer', component: IgacViewerComponent },

    // Ruta pública para servicios de ingeniería vial (debe ir ANTES del :slug)
    { path: 'ingenieria-vial', component: ServiciosIngenieriaComponent },

    // Rutas por entidad (con slug). Ej: /chiquiza-boyaca/
    {
        path: ':slug',
        canActivate: [ensureEntityGuard],
        resolve: { entity: entityResolver },
        children: [
            { path: '', component: VentanillaComponent, canActivate: [sessionRedirectGuard] },
            // Redirección de la ruta antigua de ventanilla al nuevo módulo independiente
            { path: 'ventanilla', redirectTo: '/talento-humano', pathMatch: 'prefix' },
            // El portal ciudadano no requiere permisos por módulos ni autenticación
            { path: 'portal-ciudadano', component: PortalCiudadanoComponent, canActivate: [ciudadanoGuard, pqrsEnabledGuard] },
            { path: 'dashboard', loadComponent: () => import('./components/dashboard/dashboard').then(m => m.DashboardComponent), canActivate: [adminPortalGuard, enforceUserEntityGuard] },
            { path: 'planes-dashboard', loadComponent: () => import('./components/planes-institucionales-v2/planes-dashboard/planes-dashboard').then(m => m.PlanesDashboardComponent), canActivate: [adminPortalGuard, enforceUserEntityGuard, planesEnabledGuard, moduleAccessGuard('planes_institucionales')] },
            { path: 'planes-institucionales', loadComponent: () => import('./components/planes-institucionales-v2/planes-institucionales-v2').then(m => m.PlanesInstitucionalesV2Component), canActivate: [adminPortalGuard, enforceUserEntityGuard, planesEnabledGuard, moduleAccessGuard('planes_institucionales')] },
            { path: 'pdm', loadComponent: () => import('./components/pdm/pdm').then(m => m.PdmComponent), canActivate: [adminPortalGuard, enforceUserEntityGuard, pdmEnabledGuard, moduleAccessGuard('pdm')] },
            { path: 'contratacion', loadComponent: () => import('./components/contratacion/contratacion').then(m => m.ContratacionComponent), canActivate: [adminPortalGuard, enforceUserEntityGuard, contratacionEnabledGuard, moduleAccessGuard('contratacion')] },
            // Solicitudes
            { path: 'solicitudes/cdp', loadComponent: () => import('./components/solicitudes/solicitud-cdp/solicitud-cdp.component').then(m => m.SolicitudCDPComponent), canActivate: [adminPortalGuard, enforceUserEntityGuard] },
            { path: 'solicitudes/certificacion-bpp', loadComponent: () => import('./components/solicitudes/certificacion-bpp/certificacion-bpp.component').then(m => m.CertificacionBPPComponent), canActivate: [adminPortalGuard, enforceUserEntityGuard] },
            // Administración de usuarios se gestiona desde el Dashboard (vista interna ?v=usuarios)
        ]
    },
    { path: '**', redirectTo: '' }
];