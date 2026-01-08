import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { SidebarService } from '../../../services/sidebar.service';
import { AuthService } from '../../../services/auth.service';
import { EntityContextService } from '../../../services/entity-context.service';

@Component({
    selector: 'app-sidebar',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './sidebar.component.html',
    styleUrls: ['./sidebar.component.scss']
})
export class SidebarComponent {
    sidebar = inject(SidebarService);
    private router = inject(Router);
    constructor(
        public auth: AuthService,
        public entityContext: EntityContextService
    ) { }

    // ===== Helpers de permisos (mismos criterios que en GlobalNavbar) =====
    private get slug(): string | undefined {
        return this.entityContext.currentEntity?.slug;
    }

    isAdmin(): boolean {
        const u = this.auth.getCurrentUserValue();
        return u?.role === 'admin';
    }

    userHasModule(moduleName: string): boolean {
        const u = this.auth.getCurrentUserValue();
        if (!u) return false;
        if (!u.allowed_modules || u.allowed_modules.length === 0) return true; // legacy: acceso total
        return u.allowed_modules.includes(moduleName);
    }

    pqrsEnabled(): boolean { return this.entityContext.currentEntity?.enable_pqrs ?? false; }
    usersAdminEnabled(): boolean { return this.entityContext.currentEntity?.enable_users_admin ?? false; }
    planesEnabled(): boolean { return this.entityContext.currentEntity?.enable_planes_institucionales ?? false; }
    contratacionEnabled(): boolean { return (this.entityContext.currentEntity as any)?.enable_contratacion ?? false; }
    pdmEnabled(): boolean { return (this.entityContext.currentEntity as any)?.enable_pdm ?? true; }

    canAccessPqrs(): boolean { return this.pqrsEnabled() && this.userHasModule('pqrs'); }
    canAccessPlanes(): boolean { return this.planesEnabled() && this.userHasModule('planes_institucionales'); }
    canAccessContratacion(): boolean { return this.contratacionEnabled() && this.userHasModule('contratacion'); }
    canAccessPdm(): boolean { return this.pdmEnabled() && this.userHasModule('pdm'); }

    // ===== Navegación =====
    goDashboard(view: 'welcome' | 'dashboard' | 'mis-pqrs' | 'nueva-pqrs' | 'usuarios' = 'dashboard') {
        if (!this.slug) return;
        const queryParams: any = {};
        if (view === 'welcome') {
            queryParams.v = 'welcome';
        } else if (view === 'dashboard') {
            queryParams.v = 'dashboard';
        } else {
            queryParams.v = view;
        }
        this.router.navigate([`/${this.slug}/dashboard`], { queryParams });
        this.sidebar.close(); // autocerrar siempre tras navegar
    }

    goPlanesDashboard() {
        if (!this.slug) return; this.router.navigate([`/${this.slug}/planes-dashboard`]);
        this.sidebar.close();
    }
    goPlanes() {
        if (!this.slug) return; this.router.navigate([`/${this.slug}/planes-institucionales`]);
        this.sidebar.close();
    }
    goContratacion(tipo: 'secop1' | 'secop2' = 'secop2') {
        if (!this.slug) return; 
        this.router.navigate([`/${this.slug}/contratacion`], { queryParams: { tipo } });
        this.sidebar.close();
    }
    goPdmUpload() {
        if (!this.slug) return; this.router.navigate([`/${this.slug}/pdm`]);
        this.sidebar.close();
    }
    goPdmDashboard() {
        if (!this.slug) return; this.router.navigate([`/${this.slug}/pdm-dashboard`]);
        this.sidebar.close();
    }

    openCargarEjecucion() {
        if (!this.slug) return;
        this.router.navigate([`/${this.slug}/pdm`], { queryParams: { action: 'cargar-ejecucion' } });
        this.sidebar.close();
    }

    openCargarNuevoArchivo() {
        if (!this.slug) return;
        this.router.navigate([`/${this.slug}/pdm`], { queryParams: { action: 'cargar-archivo' } });
        this.sidebar.close();
    }

    // Activos visuales
    isActiveUrl(regex: RegExp): boolean { return regex.test(this.router.url); }
    isActiveRoutePlanesDashboard(): boolean { return /\/planes-dashboard(\/?|\?|$)/.test(this.router.url); }
    isActiveRoutePlanes(): boolean { return /\/planes-institucionales(\/?|\?|$)/.test(this.router.url); }
    isActiveRouteContratacion(tipo?: 'secop1' | 'secop2'): boolean {
        const isRoute = /\/contratacion(\/?|\?|$)/.test(this.router.url);
        if (!isRoute || !tipo) return isRoute;
        const m = this.router.url.match(/\btipo=([^&#]+)/);
        const currentTipo = m?.[1] || 'secop2';
        return currentTipo === tipo;
    }
    isActiveRoutePdm(): boolean { return /\/pdm(\/?|\?|$)/.test(this.router.url); }
    isActiveRoutePdmDashboard(): boolean { return /\/pdm-dashboard(\/?|\?|$)/.test(this.router.url); }
    isActiveView(view: 'welcome' | 'dashboard' | 'mis-pqrs' | 'nueva-pqrs' | 'usuarios'): boolean {
        const url = this.router.url;
        if (!/\/(dashboard)(\b|\?)/.test(url)) return false;
        const m = url.match(/\bv=([^&#]+)/);
        const v = m?.[1] || 'welcome';
        return v === view;
    }
}
