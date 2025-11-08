import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { PlanV2Service } from '../../../services/plan-v2.service';
import { EntityContextService } from '../../../services/entity-context.service';
import { NotificationsService, AlertItem } from '../../../services/notifications.service';
import { AlertsEventsService } from '../../../services/alerts-events.service';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartData } from 'chart.js';
import { Observable, Subject, takeUntil } from 'rxjs';
import {
    PlanInstitucional,
    EstadoPlan,
    LABELS_ESTADO_PLAN,
    BADGE_CLASS_ESTADO_PLAN
} from '../../../models/plan-v2.model';

@Component({
    selector: 'app-planes-dashboard',
    standalone: true,
    imports: [CommonModule, FormsModule, BaseChartDirective],
    templateUrl: './planes-dashboard.html',
    styleUrls: ['./planes-dashboard.scss']
})
export class PlanesDashboardComponent implements OnInit, OnDestroy {
    private planService = inject(PlanV2Service);
    private router = inject(Router);
    public entityContext = inject(EntityContextService);
    private notificationsService = inject(NotificationsService);
    private alertsEvents = inject(AlertsEventsService);

    private destroy$ = new Subject<void>();

    // Notificaciones
    alerts$!: Observable<AlertItem[]>;
    unreadCount$!: Observable<number>;

    // Estados y labels
    EstadoPlan = EstadoPlan;
    LABELS_ESTADO_PLAN = LABELS_ESTADO_PLAN;
    BADGE_CLASS_ESTADO_PLAN = BADGE_CLASS_ESTADO_PLAN;

    // Datos
    cargando = false;
    planes: PlanInstitucional[] = [];
    filtroEstadoPlan: EstadoPlan | '' = '';

    // Estadísticas básicas
    stats = {
        totalPlanes: 0,
        planesActivos: 0,
        planesFinalizados: 0,
        promedioAvance: 0
    };

    // Estadísticas avanzadas
    estadisticasAvanzadas = {
        planesPorAnio: [] as { anio: number; cantidad: number }[],
        distribucionPorEstado: [] as { estado: string; cantidad: number }[],
        tendenciaAvance: [] as { periodo: string; avance: number }[]
    };

    // Gráficos
    chartEstados: ChartData<'doughnut'> | null = null;
    chartPorAnio: ChartData<'bar'> | null = null;
    chartTendencia: ChartData<'line'> | null = null;

    doughnutOptions: ChartConfiguration<'doughnut'>['options'] = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: true,
                position: 'right',
                labels: {
                    font: { size: 12, family: "'Inter', sans-serif" },
                    padding: 12,
                    usePointStyle: true
                }
            },
            tooltip: {
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                padding: 12,
                cornerRadius: 8
            }
        }
    };

    barOptions: ChartConfiguration<'bar'>['options'] = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                padding: 12,
                cornerRadius: 8
            }
        },
        scales: {
            x: { grid: { display: false } },
            y: { grid: { color: 'rgba(0, 0, 0, 0.05)' }, ticks: { precision: 0 } }
        }
    };

    lineOptions: ChartConfiguration<'line'>['options'] = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: true,
                position: 'top',
                labels: { font: { size: 12 }, padding: 16, usePointStyle: true }
            },
            tooltip: {
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                padding: 12,
                cornerRadius: 8
            }
        },
        scales: {
            x: { grid: { display: false } },
            y: {
                grid: { color: 'rgba(0, 0, 0, 0.05)' },
                ticks: {
                    callback: (value) => `${value}%`
                }
            }
        }
    };

    ngOnInit(): void {
        // Inicializar streams de alertas
        this.alerts$ = this.notificationsService.alertsStream;
        this.unreadCount$ = this.notificationsService.unreadCountStream;

        // Cargar notificaciones al iniciar
        this.notificationsService.fetch(true).subscribe();

        // Escuchar eventos de alertas (cuando se hace click en una notificación)
        this.alertsEvents.openRequested$
            .pipe(takeUntil(this.destroy$))
            .subscribe(alert => this.abrirDesdeNotificacion(alert));

        this.cargarPlanes();
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    /**
     * Abre un plan/componente desde una notificación
     */
    abrirDesdeNotificacion(alert: AlertItem): void {
        // Marcar como leída
        if (!alert.read_at) {
            this.notificationsService.markRead(alert.id).subscribe();
        }

        // Parsear datos de la alerta
        let data: { plan_id?: number; componente_id?: number; actividad_id?: number } = {};
        try {
            data = alert.data ? JSON.parse(alert.data) : {};
        } catch (e) {
            console.error('Error parseando data de alerta:', e);
            return;
        }

        const { plan_id, componente_id } = data;
        if (!plan_id) {
            console.warn('Alerta sin plan_id');
            return;
        }

        // Redirigir al módulo de Planes (la vista de detalle se manejará allí)
        const slug = this.entityContext.currentEntity?.slug;
        if (slug) {
            this.router.navigate([`/${slug}/planes-institucionales`]);
        }
    }

    cargarPlanes() {
        this.cargando = true;
        this.planService.listarPlanes({ estado: this.filtroEstadoPlan || undefined }).subscribe({
            next: (data) => {
                this.planes = data;
                this.calcularEstadisticas();
                this.generarGraficos();
            },
            error: () => (this.planes = []),
            complete: () => (this.cargando = false)
        });
    }

    calcularEstadisticas() {
        this.stats.totalPlanes = this.planes.length;
        this.stats.planesActivos = this.planes.filter(p =>
            p.estado === EstadoPlan.EN_EJECUCION || p.estado === EstadoPlan.APROBADO
        ).length;
        this.stats.planesFinalizados = this.planes.filter(p => p.estado === EstadoPlan.FINALIZADO).length;

        if (this.planes.length > 0) {
            const suma = this.planes.reduce((acc, p) => {
                const avance = p.porcentaje_avance || 0;
                return acc + (isNaN(avance) ? 0 : avance);
            }, 0);
            const promedio = suma / this.planes.length;
            this.stats.promedioAvance = Math.round(isNaN(promedio) ? 0 : promedio);
        } else {
            this.stats.promedioAvance = 0;
        }

        // Estadísticas avanzadas
        this.calcularEstadisticasAvanzadas();
    }

    calcularEstadisticasAvanzadas() {
        // Planes por año
        const aniosMap = new Map<number, number>();
        this.planes.forEach(p => {
            const count = aniosMap.get(p.anio) || 0;
            aniosMap.set(p.anio, count + 1);
        });
        this.estadisticasAvanzadas.planesPorAnio = Array.from(aniosMap.entries())
            .map(([anio, cantidad]) => ({ anio, cantidad }))
            .sort((a, b) => a.anio - b.anio);

        // Distribución por estado
        const estadosMap = new Map<string, number>();
        this.planes.forEach(p => {
            const estado = LABELS_ESTADO_PLAN[p.estado] || 'Otro';
            const count = estadosMap.get(estado) || 0;
            estadosMap.set(estado, count + 1);
        });
        this.estadisticasAvanzadas.distribucionPorEstado = Array.from(estadosMap.entries())
            .map(([estado, cantidad]) => ({ estado, cantidad }));

        // Tendencia de avance (últimos 6 meses simulado - en producción usarías datos históricos)
        const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun'];
        const promedioBase = isNaN(this.stats.promedioAvance) ? 0 : this.stats.promedioAvance;
        this.estadisticasAvanzadas.tendenciaAvance = meses.map((mes, idx) => ({
            periodo: mes,
            avance: Math.min(100, promedioBase + (idx * 5))
        }));
    }

    generarGraficos() {
        // Gráfico de distribución por estados
        this.chartEstados = {
            labels: this.estadisticasAvanzadas.distribucionPorEstado.map(d => d.estado),
            datasets: [{
                data: this.estadisticasAvanzadas.distribucionPorEstado.map(d => d.cantidad),
                backgroundColor: [
                    '#10b981', // Formulación
                    '#3b82f6', // Aprobado
                    '#f59e0b', // En Ejecución
                    '#ef4444', // Suspendido
                    '#6b7280', // Finalizado
                    '#9ca3af'  // Cancelado
                ],
                borderWidth: 3,
                borderColor: '#ffffff',
                hoverOffset: 8
            }]
        };

        // Gráfico de planes por año
        this.chartPorAnio = {
            labels: this.estadisticasAvanzadas.planesPorAnio.map(d => d.anio.toString()),
            datasets: [{
                label: 'Cantidad de Planes',
                data: this.estadisticasAvanzadas.planesPorAnio.map(d => d.cantidad),
                backgroundColor: 'rgba(59, 130, 246, 0.8)',
                borderColor: '#3b82f6',
                borderWidth: 1,
                borderRadius: 8,
                hoverBackgroundColor: '#3b82f6'
            }]
        };

        // Gráfico de tendencia
        this.chartTendencia = {
            labels: this.estadisticasAvanzadas.tendenciaAvance.map(d => d.periodo),
            datasets: [{
                label: 'Avance Promedio',
                data: this.estadisticasAvanzadas.tendenciaAvance.map(d => d.avance),
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                fill: true,
                tension: 0.4,
                pointBackgroundColor: '#10b981',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 3,
                pointRadius: 6,
                pointHoverRadius: 8,
                borderWidth: 3
            }]
        };
    }

    irGestionPlanes() {
        const slug = this.entityContext.currentEntity?.slug || '';
        this.router.navigate([`/${slug}/planes-institucionales`]);
    }

    verPlan(plan: PlanInstitucional) {
        const slug = this.entityContext.currentEntity?.slug || '';
        this.router.navigate([`/${slug}/planes-institucionales`], {
            queryParams: { plan: plan.id }
        });
    }

    formatearFecha(fecha?: string) {
        if (!fecha) return '';
        const d = new Date(fecha);
        return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
    }
}
