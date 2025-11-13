import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PlanV2Service } from '../../../services/plan-v2.service';
import { User } from '../../../models/user.model';
import { AuthService } from '../../../services/auth.service';
import { PlanInstitucional } from '../../../models/plan-v2.model';

/**
 * Componente de Análisis y Estadísticas para Planes Institucionales
 * Muestra gráficos estadísticos sobre:
 * - Planes por año
 * - Planes por estado
 * - Porcentaje de avance global
 */
@Component({
    selector: 'app-planes-analisis',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './planes-analisis.html',
    styleUrls: ['./planes-analisis.scss']
})
export class PlanesAnalisisComponent implements OnInit {
    @Input() planes: PlanInstitucional[] = [];

    currentUser: User | null = null;
    cargando = false;

    // Estadísticas
    estadisticas = {
        totalPlanes: 0,
        planesEnEjecucion: 0,
        planesFinalizados: 0,
        porcentajeAvancePromedio: 0,
        planesOrdenados: [] as any[]
    };

    constructor(
        private planService: PlanV2Service,
        private authService: AuthService
    ) {}

    ngOnInit() {
        this.currentUser = this.authService.getCurrentUserValue();
        this.calcularEstadisticas();
    }

    calcularEstadisticas() {
        if (!this.planes || this.planes.length === 0) {
            return;
        }

        // Estadísticas básicas
        this.estadisticas.totalPlanes = this.planes.length;
        this.estadisticas.planesEnEjecucion = this.planes.filter(
            p => p.estado === 'en_ejecucion'
        ).length;
        this.estadisticas.planesFinalizados = this.planes.filter(
            p => p.estado === 'finalizado'
        ).length;
        this.estadisticas.porcentajeAvancePromedio = 
            this.planes.reduce((sum, p) => sum + Number(p.porcentaje_avance || 0), 0) / 
            this.planes.length;

        // Ordenar planes por año descendente
        this.estadisticas.planesOrdenados = [...this.planes].sort(
            (a, b) => b.anio - a.anio
        );
    }

    /**
     * Obtiene planes agrupados por año
     */
    getPlanesPorAnio(): any[] {
        const agrupados = new Map<number, PlanInstitucional[]>();
        
        this.planes.forEach(p => {
            if (!agrupados.has(p.anio)) {
                agrupados.set(p.anio, []);
            }
            agrupados.get(p.anio)!.push(p);
        });

        return Array.from(agrupados.entries())
            .sort((a, b) => b[0] - a[0])
            .map(([anio, planes]) => ({
                anio,
                cantidad: planes.length,
                avancePromedio: Math.round(
                    planes.reduce((sum, p) => sum + Number(p.porcentaje_avance || 0), 0) / planes.length
                )
            }));
    }

    /**
     * Obtiene planes agrupados por estado
     */
    getPlanesPorEstado(): any {
        const estadoCounts = {
            'formulacion': 0,
            'aprobado': 0,
            'en_ejecucion': 0,
            'finalizado': 0,
            'suspendido': 0,
            'cancelado': 0
        };

        this.planes.forEach(p => {
            const estado = p.estado || 'formulacion';
            if (estado in estadoCounts) {
                estadoCounts[estado as keyof typeof estadoCounts]++;
            }
        });

        return estadoCounts;
    }

    /**
     * Obtiene etiqueta amigable para estado
     */
    getEtiquetaEstado(estado: string): string {
        const etiquetas: any = {
            'formulacion': 'Formulación',
            'aprobado': 'Aprobado',
            'en_ejecucion': 'En Ejecución',
            'finalizado': 'Finalizado',
            'suspendido': 'Suspendido',
            'cancelado': 'Cancelado'
        };
        return etiquetas[estado] || estado;
    }

    /**
     * Obtiene color para estado
     */
    getColorEstado(estado: string): string {
        const colores: any = {
            'formulacion': '#6c757d',
            'aprobado': '#0d6efd',
            'en_ejecucion': '#0dcaf0',
            'finalizado': '#198754',
            'suspendido': '#ffc107',
            'cancelado': '#dc3545'
        };
        return colores[estado] || '#6c757d';
    }

    /**
     * Obtiene información de progreso visual
     */
    getInfoProgreso(plan: PlanInstitucional): string {
        const avance = Number(plan.porcentaje_avance) || 0;
        if (avance === 0) return 'Sin iniciar';
        if (avance < 33) return 'Iniciado';
        if (avance < 66) return 'En progreso';
        if (avance < 100) return 'Casi completado';
        return 'Completado';
    }

    esAdmin(): boolean {
        return this.currentUser?.role === 'admin' || this.currentUser?.role === 'superadmin';
    }
}
