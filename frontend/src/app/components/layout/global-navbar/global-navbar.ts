import { Component, HostListener, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { EntityContextService } from '../../../services/entity-context.service';
import { AuthService } from '../../../services/auth.service';
import { NotificationsService, AlertItem } from '../../../services/notifications.service';
import { AlertsEventsService } from '../../../services/alerts-events.service';
import { SidebarService } from '../../../services/sidebar.service';

@Component({
    selector: 'app-global-navbar',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './global-navbar.html',
    styleUrl: './global-navbar.scss'
})
export class GlobalNavbarComponent implements OnInit, OnDestroy {
    showAlertsPanel = false;
    alerts$!: import('rxjs').Observable<AlertItem[]>;
    unreadCount$!: import('rxjs').Observable<number>;
    private refreshInterval: any;

    private router = inject(Router);

    constructor(
        public entityContext: EntityContextService,
        public auth: AuthService,
        private notifications: NotificationsService,
        private alertsEvents: AlertsEventsService,
        public sidebar: SidebarService
    ) {
        this.alerts$ = this.notifications.alertsStream;
        this.unreadCount$ = this.notifications.unreadCountStream;
    }

    ngOnInit() {
        // Cargar badge de no leídas cuando haya usuario y entidad
        this.auth.currentUser$.subscribe(user => {
            const entity = this.entityContext.currentEntity;
            if (user && entity) {
                this.notifications.fetch(true).subscribe();
            }
        });
        this.entityContext.currentEntity$.subscribe(entity => {
            const user = this.auth.getCurrentUserValue();
            if (user && entity) {
                this.notifications.fetch(true).subscribe();
            }
        });

        // Auto-refresh de alertas cada 60 segundos
        this.refreshInterval = setInterval(() => {
            if (!this.auth.isAuthenticated()) {
                if (this.refreshInterval) {
                    clearInterval(this.refreshInterval);
                }
                return;
            }

            const user = this.auth.getCurrentUserValue();
            const entity = this.entityContext.currentEntity;
            if (user && entity) {
                this.notifications.fetch(true).subscribe();
            }
        }, 60000);
    }

    ngOnDestroy() {
        // Limpiar el intervalo de auto-refresh
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
    }

    @HostListener('document:click', ['$event'])
    onDocumentClick(event: MouseEvent) {
        const target = event.target as HTMLElement;
        const isBell = target.closest('.alerts-bell');
        if (!isBell && this.showAlertsPanel) {
            this.showAlertsPanel = false;
        }
    }

    toggleAlertsPanel() {
        this.showAlertsPanel = !this.showAlertsPanel;
        if (this.showAlertsPanel) {
            this.notifications.fetch(true).subscribe();
        }
    }

    verTodasAlertas() {
        this.notifications.fetch(false).subscribe();
    }

    marcarLeida(alert: AlertItem, event?: MouseEvent) {
        if (event) {
            event.stopPropagation();
            event.preventDefault();
        }
        if (!alert.read_at) {
            this.notifications.markRead(alert.id).subscribe();
        }
    }

    private goToDashboardIfNeeded(): Promise<boolean> {
        const url = this.router.url;
        if (/\/dashboard(\b|\/)/.test(url)) return Promise.resolve(true);
        const slug = this.entityContext.currentEntity?.slug;
        if (!slug) return Promise.resolve(false);
        return this.router.navigate([`/${slug}/dashboard`]);
    }

    async abrirAlerta(alert: AlertItem, event?: MouseEvent) {
        if (event) {
            event.stopPropagation();
            event.preventDefault();
        }
        if (!alert.read_at) {
            this.notifications.markRead(alert.id).subscribe();
        }

        // Detectar tipo de alerta y redirigir según corresponda
        const slug = this.entityContext.currentEntity?.slug;
        if (!slug) {
            console.warn('No hay entidad actual para abrir alerta');
            this.showAlertsPanel = false;
            return;
        }

        // Parsear datos de la alerta
        let data: any = {};
        try {
            data = alert.data ? JSON.parse(alert.data) : {};
        } catch (e) {
            console.error('Error parseando data de alerta:', e);
        }

        // Redirigir según el tipo de alerta
        if (alert.type === 'PDM_PRODUCT_ASSIGNED' || alert.type === 'PDM_NEW_ACTIVITY') {
            // Alerta de PDM - redirigir al dashboard PDM y emitir evento
            await this.router.navigate([`/${slug}/pdm-dashboard`]);
            setTimeout(() => this.alertsEvents.requestOpen(alert), 100);
        } else if (alert.type === 'PLAN_COMPONENT_ASSIGNED' || alert.type === 'PLAN_NEW_ACTIVITY') {
            // Alerta de Planes - redirigir al módulo de planes y emitir evento
            await this.router.navigate([`/${slug}/planes-institucionales`]);
            setTimeout(() => this.alertsEvents.requestOpen(alert), 100);
        } else if (alert.type === 'NEW_PQRS' || alert.type === 'PQRS_ASSIGNED') {
            // Alerta de PQRS - comportamiento original
            await this.goToDashboardIfNeeded();
            setTimeout(() => this.alertsEvents.requestOpen(alert), 50);
        } else {
            // Tipo desconocido - intentar comportamiento por defecto
            console.warn('Tipo de alerta desconocido:', alert.type);
            await this.goToDashboardIfNeeded();
            setTimeout(() => this.alertsEvents.requestOpen(alert), 50);
        }

        this.showAlertsPanel = false;
    }

    marcarTodasLeidas(event?: MouseEvent) {
        if (event) event.stopPropagation();
        this.notifications.markAllRead().subscribe();
    }

    // ===== Navegación de pestañas globales =====
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
        if (this.isAdmin()) return true;
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

    goDashboard(view: 'dashboard' | 'mis-pqrs' | 'nueva-pqrs' | 'usuarios' = 'dashboard') {
        if (!this.slug) return;
        const queryParams: any = {};
        if (view && view !== 'dashboard') queryParams.v = view;
        this.router.navigate([`/${this.slug}/dashboard`], { queryParams });
    }

    goPlanes() {
        if (!this.slug) return; this.router.navigate([`/${this.slug}/planes-institucionales`]);
    }
    goContratacion() {
        if (!this.slug) return; this.router.navigate([`/${this.slug}/contratacion`]);
    }
    goPdm() {
        if (!this.slug) return; this.router.navigate([`/${this.slug}/pdm`]);
    }

    // Activo visual de pestañas
    isActiveRouteDashboard(): boolean {
        return /\/dashboard(\b|\?)/.test(this.router.url);
    }
    isActiveRoutePlanes(): boolean {
        return /\/planes-institucionales(\/?|\?|$)/.test(this.router.url);
    }
    isActiveRouteContratacion(): boolean {
        return /\/contratacion(\/?|\?|$)/.test(this.router.url);
    }
    isActiveRoutePdm(): boolean {
        return /\/pdm(\/?|\?|$)/.test(this.router.url);
    }
    isActiveView(view: 'dashboard' | 'mis-pqrs' | 'nueva-pqrs' | 'usuarios'): boolean {
        const url = this.router.url;
        if (!this.isActiveRouteDashboard()) return false;
        const m = url.match(/\bv=([^&#]+)/);
        const v = m?.[1] || 'dashboard';
        return v === view;
    }

    // Reportes PDF (mismo flag que en Dashboard)
    reportsPdfEnabled(): boolean { return this.entityContext.currentEntity?.enable_reports_pdf ?? false; }

    async openReportForm() {
        // Debe estar en dashboard
        await this.goToDashboardIfNeeded();
        // Emitir evento para que el Dashboard abra el selector de fechas
        setTimeout(() => this.alertsEvents.requestOpenReportForm(), 50);
    }

    getUserLabel(): string {
        const u = this.auth.getCurrentUserValue();
        if (!u) return '';
        if (u.role === 'admin') return 'Admin';
        if (u.role === 'superadmin') return 'Superadmin';
        if (u.role === 'secretario') {
            return u.user_type === 'contratista' ? 'Contratista' : 'Secretario';
        }
        if (u.role === 'ciudadano') return 'Ciudadano';
        return String(u.role || '');
    }

    logout() {
        this.auth.logout();
        const slug = this.router.url.replace(/^\//, '').split('/')[0];
        this.router.navigate(slug ? ['/', slug, 'login'] : ['/']);
    }
}
