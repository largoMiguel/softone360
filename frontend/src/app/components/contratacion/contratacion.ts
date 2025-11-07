import { Component, HostListener, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { BaseChartDirective } from 'ng2-charts';
import { Chart, ChartConfiguration, ChartData, ChartType, registerables } from 'chart.js';
import { ContratacionService } from '../../services/contratacion.service';
import { ProcesoContratacion, FiltroContratacion, KPIsContratacion } from '../../models/contratacion.model';
import { EntityContextService } from '../../services/entity-context.service';
import { AuthService } from '../../services/auth.service';
import { Subscription, filter, combineLatest } from 'rxjs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { AiReportService, ContratacionSummaryPayload } from '../../services/ai-report.service';

Chart.register(...registerables);

@Component({
    selector: 'app-contratacion',
    standalone: true,
    imports: [CommonModule, FormsModule, BaseChartDirective, RouterModule],
    templateUrl: './contratacion.html',
    styleUrls: ['./contratacion.scss']
})
export class ContratacionComponent implements OnInit, OnDestroy {
    @ViewChild(BaseChartDirective) chart?: BaseChartDirective;

    procesos: ProcesoContratacion[] = [];
    procesosFiltrados: ProcesoContratacion[] = [];
    // Paginación
    pageIndex = 1; // 1-based
    pageSize = 8;
    pageSizes: number[] = [8, 12, 24, 48];
    loading = false;
    errorMsg = '';
    subs = new Subscription();
    currentUser: any = null;
    private refreshInterval: any;

    // Vista detallada de KPI
    kpiDetailVisible = false;
    selectedKpi: string = '';

    // Contratos vencidos
    contratosVencidos: ProcesoContratacion[] = [];
    mostrarContratosVencidos = false;

    // Filtros UI - Por defecto desde 1 de enero 2025
    filtro: FiltroContratacion = {
        entidad: '',
        fechaDesde: '2025-01-01',
        fechaHasta: new Date().toISOString().split('T')[0],
        modalidad: '',
        tipoContrato: '',
        estado: '',
        adjudicado: '',
        texto: '',
        precioMin: null,
        precioMax: null
    };

    // Catálogos deducidos de los datos
    modalidades: string[] = [];
    tiposContrato: string[] = [];
    estadosResumen: string[] = [];

    // Filtros por columna (tabla)
    columnFilters: {
        referencia?: string;
        estado?: string;
        modalidad?: string;
        tipo?: string;
        precioMin?: number | null;
        precioMax?: number | null;
        proveedor?: string;
        publicacionDesde?: string; // YYYY-MM-DD
        publicacionHasta?: string; // YYYY-MM-DD
        ultimaDesde?: string; // YYYY-MM-DD
        ultimaHasta?: string; // YYYY-MM-DD
    } = {
            referencia: '',
            estado: '',
            modalidad: '',
            tipo: '',
            precioMin: null,
            precioMax: null,
            proveedor: '',
            publicacionDesde: '',
            publicacionHasta: '',
            ultimaDesde: '',
            ultimaHasta: ''
        };

    // KPIs
    kpis: KPIsContratacion = {
        totalProcesos: 0,
        totalAdjudicados: 0,
        tasaAdjudicacion: 0,
        sumaAdjudicado: 0,
        promedioPrecioBase: 0
    };

    // Charts
    doughnutChartType: ChartType = 'doughnut';
    barChartType: ChartType = 'bar';
    lineChartType: ChartType = 'line';

    chartOptions: ChartConfiguration['options'] = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: true, position: 'bottom' } }
    };

    estadosChartData: ChartData<'doughnut'> = { labels: [], datasets: [] };
    modalidadesChartData: ChartData<'bar'> = { labels: [], datasets: [] };
    timelineChartData: ChartData<'line'> = { labels: [], datasets: [] };
    proveedoresChartData: ChartData<'bar'> = { labels: [], datasets: [] };
    tiposContratoChartData: ChartData<'doughnut'> = { labels: [], datasets: [] };
    proveedoresChartOptions: ChartConfiguration['options'] = {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        plugins: { legend: { display: false } }
    };

    generatingPdf = false;
    mostrarModalInforme = false;
    incluirResumenIA = false;

    // Estado de expansión de tarjetas
    private expandedRefs = new Set<string>();

    // Modal de detalle minimalista
    showModal = false;
    selectedProceso: ProcesoContratacion | null = null;

    constructor(
        private contratacionService: ContratacionService,
        public entityContext: EntityContextService,
        private authService: AuthService,
        private aiReport: AiReportService,
        private router: Router
    ) {
        this.currentUser = this.authService.getCurrentUserValue();
    }

    ngOnInit(): void {
        // Relanzar carga cuando cambia la entidad
        const sub = this.entityContext.currentEntity$.pipe(
            filter(e => !!e)
        ).subscribe(entity => {
            // Usar el NIT de la entidad para consultas SECOP
            const nit = entity!.nit || '891801994'; // NIT de ejemplo si no tiene
            this.filtro.entidad = nit;

            console.log(`[Contratación] NIT de la entidad: ${nit}`);
            this.fetch();
        });
        this.subs.add(sub);

        // Auto-refresh cada 60 segundos para actualizar datos de contratación
        this.refreshInterval = setInterval(() => {
            if (!this.authService.isAuthenticated()) {
                if (this.refreshInterval) {
                    clearInterval(this.refreshInterval);
                }
                return;
            }

            if (this.entityContext.currentEntity) {
                this.fetch();
            }
        }, 60000);
    }

    ngOnDestroy(): void {
        this.subs.unsubscribe();
        // Limpiar el intervalo de auto-refresh
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
    }

    // Abrir modal de detalle
    openModal(p: ProcesoContratacion): void {
        this.selectedProceso = p;
        this.showModal = true;
        // Evitar scroll de fondo
        document.body.style.overflow = 'hidden';
    }

    // Cerrar modal de detalle
    closeModal(): void {
        this.showModal = false;
        this.selectedProceso = null;
        document.body.style.overflow = '';
    }

    // Accesibilidad: cerrar con tecla ESC
    @HostListener('document:keydown.escape')
    onEsc() {
        if (this.showModal) this.closeModal();
    }

    fetch(): void {
        this.loading = true;
        this.errorMsg = '';
        this.contratacionService.fetchProcesos(this.filtro).subscribe({
            next: (rows) => {
                this.procesos = rows;
                if (rows.length === 0) {
                    this.errorMsg = `No se encontraron datos de contratación para el NIT "${this.filtro.entidad}" en el rango de fechas seleccionado. Verifica que el NIT de la entidad esté configurado correctamente en el super admin.`;
                }
                this.applyLocalFilters();
                this.loading = false;
            },
            error: (err) => {
                console.error('[Contratación] Error al cargar datos:', err);
                this.errorMsg = 'No se pudo cargar la información de contratación. Verifica la conexión con el servidor.';
                this.loading = false;
            }
        });
    }

    // Filtrado adicional en cliente (búsqueda y rangos ya cubiertos, mantenemos por si llega sin tipado numérico)
    applyLocalFilters(): void {
        let data = [...this.procesos];

        // Actualizar catálogos
        this.modalidades = Array.from(new Set(data.map(d => d.modalidad_de_contratacion).filter(Boolean))) as string[];
        this.tiposContrato = Array.from(new Set(data.map(d => d.tipo_de_contrato).filter(Boolean))) as string[];
        this.estadosResumen = Array.from(new Set(data.map(d => d.estado_contrato).filter(Boolean))) as string[];

        // Filtros por columna
        const cf = this.columnFilters;
        if (cf.referencia) {
            const needle = cf.referencia.toLowerCase();
            data = data.filter(p => (p.referencia_del_contrato || '').toLowerCase().includes(needle));
        }
        if (cf.estado) {
            data = data.filter(p => (p.estado_contrato || '') === cf.estado);
        }
        if (cf.modalidad) {
            data = data.filter(p => (p.modalidad_de_contratacion || '') === cf.modalidad);
        }
        if (cf.tipo) {
            data = data.filter(p => (p.tipo_de_contrato || '') === cf.tipo);
        }
        if (cf.precioMin != null && cf.precioMin !== undefined) {
            data = data.filter(p => this.toNumber(p.valor_del_contrato) >= (cf.precioMin || 0));
        }
        if (cf.precioMax != null && cf.precioMax !== undefined) {
            data = data.filter(p => this.toNumber(p.valor_del_contrato) <= (cf.precioMax || Number.MAX_SAFE_INTEGER));
        }
        if (cf.proveedor) {
            const needle = cf.proveedor.toLowerCase();
            data = data.filter(p => (p.proveedor_adjudicado || '').toString().toLowerCase().includes(needle));
        }
        if (cf.publicacionDesde) {
            const d = new Date(cf.publicacionDesde);
            data = data.filter(p => !p.fecha_de_firma || new Date(p.fecha_de_firma) >= d);
        }
        if (cf.publicacionHasta) {
            const d = new Date(cf.publicacionHasta);
            data = data.filter(p => !p.fecha_de_firma || new Date(p.fecha_de_firma) <= d);
        }
        if (cf.ultimaDesde) {
            const d = new Date(cf.ultimaDesde);
            data = data.filter(p => !p.ultima_actualizacion || new Date(p.ultima_actualizacion) >= d);
        }
        if (cf.ultimaHasta) {
            const d = new Date(cf.ultimaHasta);
            data = data.filter(p => !p.ultima_actualizacion || new Date(p.ultima_actualizacion) <= d);
        }

        // Orden por referencia
        data.sort((a, b) => (a.referencia_del_contrato || '').localeCompare(b.referencia_del_contrato || ''));

        this.procesosFiltrados = data;
        // reset página al aplicar filtros
        this.pageIndex = 1;
        this.computeKPIs();
        this.updateCharts();
        this.detectarContratosVencidos();
    }

    // Datos paginados para la vista
    get totalPages(): number {
        return Math.max(1, Math.ceil(this.procesosFiltrados.length / Math.max(this.pageSize, 1)));
    }

    get paginatedProcesos(): ProcesoContratacion[] {
        const size = Math.max(this.pageSize, 1);
        const start = (Math.max(this.pageIndex, 1) - 1) * size;
        return this.procesosFiltrados.slice(start, start + size);
    }

    onPageSizeChange(size: number): void {
        this.pageSize = Number(size) || 12;
        this.pageIndex = 1;
    }

    goToPage(n: number): void {
        const t = this.totalPages;
        if (n < 1) n = 1;
        if (n > t) n = t;
        this.pageIndex = n;
    }

    nextPage(): void {
        if (this.pageIndex < this.totalPages) this.pageIndex += 1;
    }

    prevPage(): void {
        if (this.pageIndex > 1) this.pageIndex -= 1;
    }

    getPageNumbers(): number[] {
        const total = this.totalPages;
        const windowSize = 5;
        let start = Math.max(1, this.pageIndex - Math.floor(windowSize / 2));
        let end = Math.min(total, start + windowSize - 1);
        start = Math.max(1, end - windowSize + 1);
        return Array.from({ length: end - start + 1 }, (_, i) => start + i);
    }

    detectarContratosVencidos(): void {
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0); // Normalizar a medianoche para comparación precisa

        this.contratosVencidos = this.procesosFiltrados.filter(p => {
            // Solo contratos con fecha de finalización definida
            if (!p.fecha_de_fin_del_contrato) return false;

            // Verificar si el contrato está vencido (fecha de fin anterior a hoy)
            const fechaFin = new Date(p.fecha_de_fin_del_contrato);
            fechaFin.setHours(0, 0, 0, 0);

            // Normalizar estado
            const estado = (p.estado_contrato ?? '')
                .toString()
                .trim()
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '');

            // Excluir contratos ya finalizados
            const estadosFinalizados = ['terminado', 'cerrado', 'liquidado', 'cancelado', 'suspendido', 'anulado'];
            if (estadosFinalizados.includes(estado)) return false;

            // Contrato vencido: fecha de fin ya pasó y no está finalizado
            return fechaFin < hoy;
        });

        console.log(`[Contratación] Contratos vencidos detectados: ${this.contratosVencidos.length}`);
    }

    calcularDiasVencidos(contrato: ProcesoContratacion): number {
        if (!contrato.fecha_de_fin_del_contrato) return 0;

        const fechaFin = new Date(contrato.fecha_de_fin_del_contrato);
        const hoy = new Date();
        const diffTime = hoy.getTime() - fechaFin.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        return diffDays > 0 ? diffDays : 0;
    }

    formatearDuracion(contrato: ProcesoContratacion): string {
        if (!contrato.duraci_n_del_contrato) return 'N/D';
        return contrato.duraci_n_del_contrato;
    }

    computeKPIs(): void {
        const total = this.procesosFiltrados.length;
        const ejecutados = this.procesosFiltrados.filter(p => this.isContratado(p));
        const sumaContratada = this.procesosFiltrados.reduce((acc, p) => acc + this.toNumber(p.valor_del_contrato), 0);
        const sumaPagada = this.procesosFiltrados.reduce((acc, p) => acc + this.toNumber(p.valor_pagado), 0);
        const promedioPrecio = this.avg(this.procesosFiltrados.map(p => this.toNumber(p.valor_del_contrato)));

        this.kpis = {
            totalProcesos: total,
            totalAdjudicados: ejecutados.length,
            tasaAdjudicacion: total ? ejecutados.length / total : 0,
            sumaAdjudicado: sumaPagada,
            promedioPrecioBase: promedioPrecio
        };
    }

    updateCharts(): void {
        // Estados
        const estados = this.groupCount(this.procesosFiltrados.map(p => p.estado_contrato || 'SIN ESTADO'));
        this.estadosChartData = {
            labels: Object.keys(estados),
            datasets: [{
                data: Object.values(estados),
                backgroundColor: ['#216ba8', '#28a745', '#ffc107', '#dc3545', '#6c757d', '#17a2b8', '#6610f2', '#20c997']
            }]
        };

        // Modalidades
        const mods = this.groupCount(this.procesosFiltrados.map(p => p.modalidad_de_contratacion || 'N/D'));
        this.modalidadesChartData = {
            labels: Object.keys(mods),
            datasets: [{
                label: 'Procesos',
                data: Object.values(mods),
                backgroundColor: 'rgba(33, 107, 168, 0.7)',
                borderColor: 'rgba(33, 107, 168, 1)',
                borderWidth: 2
            }]
        };

        // Timeline por mes (conteo por fecha de firma)
        const byMonth = this.groupCount(this.procesosFiltrados.map(p => this.toMonth(p.fecha_de_firma)));
        const labels = Object.keys(byMonth).sort();
        this.timelineChartData = {
            labels,
            datasets: [{
                label: 'Contratos Firmados',
                data: labels.map(l => byMonth[l] || 0),
                borderColor: '#216ba8',
                backgroundColor: 'rgba(33, 107, 168, 0.1)',
                fill: true,
                tension: 0.3
            }]
        };

        // Top proveedores por valor adjudicado
        this.computeTopProveedoresChart();

        // Tipos de contrato
        this.computeTiposContratoChart();

        if (this.chart) this.chart.update();
    }

    private computeTiposContratoChart(): void {
        const map = new Map<string, number>();
        for (const p of this.procesosFiltrados) {
            const tipo = p.tipo_de_contrato || 'Sin especificar';
            map.set(tipo, (map.get(tipo) || 0) + 1);
        }
        const pairs = Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
        const labels = pairs.map(([tipo]) => tipo);
        const data = pairs.map(([, count]) => count);

        const colors = [
            'rgba(33, 107, 168, 0.7)',
            'rgba(40, 167, 69, 0.7)',
            'rgba(255, 193, 7, 0.7)',
            'rgba(23, 162, 184, 0.7)',
            'rgba(220, 53, 69, 0.7)',
            'rgba(108, 117, 125, 0.7)'
        ];

        this.tiposContratoChartData = {
            labels,
            datasets: [{
                label: 'Cantidad',
                data,
                backgroundColor: colors,
                borderColor: colors.map(c => c.replace('0.7', '1')),
                borderWidth: 2
            }]
        };
    }

    // Helpers
    toNumber(v: any): number {
        if (v === null || v === undefined) return 0;
        if (typeof v === 'number') return v;
        const s = String(v).replace(/[^0-9.-]/g, '');
        const n = Number(s);
        return isNaN(n) ? 0 : n;
    }

    // URL helper para enlaces externos del proceso (SECOP II)
    getProcesoUrl(p: ProcesoContratacion): string {
        const resolve = (u: any): string => {
            if (!u) return '#';
            if (typeof u === 'string') return u;
            if (typeof u === 'object') {
                if ('url' in u && u.url) return String(u.url);
                if ('href' in u && u.href) return String(u.href);
                if ('value' in u && u.value) return String(u.value);
                if (Array.isArray(u)) return resolve(u[0]);
            }
            return '#';
        };

        const raw = (p as any)?.urlproceso;
        const url = resolve(raw);
        // Validación ligera del esquema
        try {
            const parsed = new URL(url, window?.location?.origin || undefined);
            return parsed.toString();
        } catch {
            return url || '#';
        }
    }

    avg(nums: number[]): number {
        const list = nums.filter(n => typeof n === 'number' && !isNaN(n));
        if (!list.length) return 0;
        return Math.round((list.reduce((a, b) => a + b, 0) / list.length) * 100) / 100;
    }

    // ===== Listado en tarjetas =====
    getKey(p: ProcesoContratacion): string {
        return (p.id_contrato as any) || p.referencia_del_contrato || `${p.nit_entidad || ''}-${p.documento_proveedor || ''}-${p.fecha_de_firma || ''}`;
    }

    isExpanded(key: string): boolean {
        return this.expandedRefs.has(key);
    }

    toggleExpand(p: ProcesoContratacion): void {
        const key = this.getKey(p);
        if (!key) return;
        if (this.expandedRefs.has(key)) this.expandedRefs.delete(key); else this.expandedRefs.add(key);
    }

    trackByContrato = (_: number, p: ProcesoContratacion) => this.getKey(p);

    async copyReferencia(p: ProcesoContratacion): Promise<void> {
        const ref = p.referencia_del_contrato || '';
        try { await navigator.clipboard?.writeText(ref); } catch { /* noop */ }
    }

    // Normaliza si un contrato está contratado/en ejecución (activo)
    isContratado(p: ProcesoContratacion): boolean {
        // Normalizar estado: minúsculas sin acentos para comparación
        const estado = (p.estado_contrato ?? '')
            .toString()
            .trim()
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, ''); // Eliminar acentos

        // Estados que se consideran finalizados (no activos)
        const estadosFinalizados = ['terminado', 'cerrado', 'liquidado', 'cancelado', 'suspendido', 'anulado'];

        // Si está en un estado finalizado, NO está en ejecución
        if (estadosFinalizados.includes(estado)) {
            return false;
        }

        // Estados activos: En ejecución, Aprobado, Modificado
        // La API devuelve: "En ejecución" (con acento), "Aprobado", "Modificado"
        const estadosActivos = ['en ejecucion', 'aprobado', 'modificado', 'celebrado', 'activo'];
        return estadosActivos.includes(estado);
    }

    // Clase visual para estado
    getEstadoBadgeClass(p: ProcesoContratacion): string {
        // Normalizar estado: minúsculas sin acentos
        const estado = (p.estado_contrato ?? '')
            .toString()
            .trim()
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');

        // Estados liquidados (azul info)
        if (estado === 'liquidado') return 'bg-info';

        // Estados cerrados/terminados (gris secundario)
        if (estado === 'cerrado' || estado === 'terminado') return 'bg-secondary';

        // Estados activos en ejecución (verde success)
        if (estado === 'en ejecucion' ||
            estado === 'aprobado' ||
            estado === 'modificado' ||
            estado === 'celebrado' ||
            estado === 'activo') return 'bg-success';

        // Estados problemáticos (rojo danger)
        if (estado === 'cancelado' ||
            estado === 'suspendido' ||
            estado === 'anulado') return 'bg-danger';

        // Estados en borrador/pendiente (amarillo warning)
        if (estado === 'borrador' ||
            estado === 'pendiente' ||
            estado === 'proceso') return 'bg-warning';

        // Por defecto (gris)
        return 'bg-secondary';
    }

    // Texto a mostrar para estado (mapear 'terminado' -> 'Liquidado')
    getEstadoDisplay(p: ProcesoContratacion): string {
        const raw = p.estado_contrato || '';
        const norm = raw.toString().trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        if (norm === 'terminado') return 'Liquidado';
        return raw || 'N/D';
    }

    // Helper para verificar si un contrato está finalizado
    private isEstadoFinalizado(estado: string): boolean {
        const e = (estado ?? '')
            .toString()
            .trim()
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
        const finalizados = ['terminado', 'cerrado', 'liquidado', 'cancelado', 'suspendido', 'anulado'];
        return finalizados.includes(e);
    }

    // Helper para verificar si un contrato está activo/en ejecución
    private isEstadoActivo(estado: string): boolean {
        const e = (estado ?? '')
            .toString()
            .trim()
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
        const activos = ['en ejecucion', 'celebrado', 'aprobado', 'modificado', 'activo'];
        return activos.includes(e);
    }

    groupCount(arr: string[]): Record<string, number> {
        return arr.reduce((acc: Record<string, number>, key) => {
            acc[key] = (acc[key] || 0) + 1;
            return acc;
        }, {});
    }

    toMonth(iso?: string): string {
        if (!iso) return 'N/D';
        const d = new Date(iso);
        if (isNaN(d.getTime())) return 'N/D';
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }

    // Obtener mes de la fecha de firma para el timeline
    getMesFirma(p: ProcesoContratacion): string {
        return this.toMonth(p.fecha_de_firma);
    }

    // Acciones UI
    buscar(): void {
        this.fetch();
    }

    limpiar(): void {
        this.filtro = {
            entidad: this.filtro.entidad,
            fechaDesde: '2025-01-01',
            fechaHasta: new Date().toISOString().split('T')[0],
            modalidad: '',
            tipoContrato: '',
            estado: '',
            adjudicado: '',
            texto: '',
            precioMin: null,
            precioMax: null
        };
        // Limpiar filtros de columna locales
        this.columnFilters = {
            referencia: '', estado: '', modalidad: '', tipo: '',
            precioMin: null, precioMax: null, proveedor: '',
            publicacionDesde: '', publicacionHasta: '', ultimaDesde: '', ultimaHasta: ''
        };
        this.fetch();
    }

    exportCSV(): void {
        const headers = [
            'referencia_del_contrato', 'estado_contrato', 'fecha_de_firma', 'fecha_de_inicio_del_contrato', 'fecha_de_fin_del_contrato',
            'modalidad_de_contratacion', 'tipo_de_contrato', 'valor_del_contrato', 'proveedor_adjudicado',
            'documento_proveedor', 'es_pyme', 'objeto_del_contrato', 'descripcion_del_proceso', 'nombre_supervisor',
            'valor_pagado', 'valor_pendiente_de_pago', 'liquidaci_n', 'ultima_actualizacion'
        ];
        const rows = this.procesosFiltrados.map(p => headers.map(h => (p as any)[h] ?? ''));
        const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `contratos_${this.filtro.entidad || 'entidad'}_${this.filtro.fechaDesde}_${this.filtro.fechaHasta}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }

    private computeTopProveedoresChart(): void {
        const map = new Map<string, number>();
        for (const p of this.procesosFiltrados) {
            const prov = (p.proveedor_adjudicado || 'N/D').toString();
            const val = this.toNumber(p.valor_del_contrato);
            if (val > 0) map.set(prov, (map.get(prov) || 0) + val);
        }
        const pairs = Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10);
        const labels = pairs.map(([prov]) => prov);
        const data = pairs.map(([, valor]) => valor);
        this.proveedoresChartData = {
            labels,
            datasets: [{
                label: 'Total contratado',
                data,
                backgroundColor: 'rgba(40, 167, 69, 0.7)',
                borderColor: 'rgba(40, 167, 69, 1)',
                borderWidth: 2
            }]
        };
    }

    // Métodos de navegación
    logout(): void {
        this.authService.logout();
        this.router.navigate([`/${this.entityContext.currentEntity?.slug}/login`]);
    }

    get entity() {
        return this.entityContext.currentEntity;
    }

    pqrsEnabled(): boolean {
        return this.entityContext.currentEntity?.enable_pqrs ?? false;
    }

    planesEnabled(): boolean {
        return this.entityContext.currentEntity?.enable_planes_institucionales ?? false;
    }

    contratacionEnabled(): boolean {
        return this.entityContext.currentEntity?.enable_contratacion ?? false;
    }

    usersAdminEnabled(): boolean {
        return this.entityContext.currentEntity?.enable_users_admin ?? false;
    }

    isAdmin(): boolean {
        return this.currentUser?.role === 'admin';
    }

    // Etiqueta legible del usuario para la barra superior (consistente con Dashboard)
    getUserLabel(): string {
        const u = this.currentUser;
        if (!u) return '';
        if (u.role === 'admin') return 'Admin';
        if (u.role === 'superadmin') return 'Superadmin';
        if (u.role === 'secretario') {
            return u.user_type === 'contratista' ? 'Contratista' : 'Secretario';
        }
        if (u.role === 'ciudadano') return 'Ciudadano';
        return String(u.role || '');
    }

    // Modal de configuración de informe
    abrirModalInforme(): void {
        if (!this.procesosFiltrados.length) {
            return;
        }
        this.mostrarModalInforme = true;
        this.incluirResumenIA = false;
    }

    cerrarModalInforme(): void {
        this.mostrarModalInforme = false;
        this.incluirResumenIA = false;
    }

    generarInformeConOpciones(): void {
        this.mostrarModalInforme = false;
        if (this.incluirResumenIA) {
            this.generatePdfWithAI();
        } else {
            this.generatePdf();
        }
    }

    // Métodos para KPIs clickeables
    toggleKpiDetail(kpiType: string): void {
        if (this.selectedKpi === kpiType) {
            this.kpiDetailVisible = !this.kpiDetailVisible;
        } else {
            this.selectedKpi = kpiType;
            this.kpiDetailVisible = true;
        }
    }

    getKpiDetail(): any {
        switch (this.selectedKpi) {
            case 'procesos':
                return {
                    title: 'Detalle de Procesos',
                    items: [
                        { label: 'Total registros', value: this.procesos.length },
                        { label: 'Procesos filtrados', value: this.procesosFiltrados.length },
                        { label: 'Promedio precio base', value: `$ ${this.kpis.promedioPrecioBase.toLocaleString()}` }
                    ]
                };
            case 'adjudicados':
                const noAdjudicados = this.kpis.totalProcesos - this.kpis.totalAdjudicados;
                return {
                    title: 'Detalle de Adjudicación',
                    items: [
                        { label: 'Procesos adjudicados', value: this.kpis.totalAdjudicados },
                        { label: 'Procesos sin adjudicar', value: noAdjudicados },
                        { label: 'Tasa de éxito', value: `${(this.kpis.tasaAdjudicacion * 100).toFixed(1)}%` }
                    ]
                };
            case 'tasa':
                return {
                    title: 'Análisis de Tasa',
                    items: [
                        { label: 'Procesos evaluados', value: this.kpis.totalProcesos },
                        { label: 'Exitosos', value: this.kpis.totalAdjudicados },
                        { label: 'Porcentaje', value: `${(this.kpis.tasaAdjudicacion * 100).toFixed(2)}%` }
                    ]
                };
            case 'monto':
                return {
                    title: 'Análisis de Montos',
                    items: [
                        { label: 'Total adjudicado', value: `$ ${this.kpis.sumaAdjudicado.toLocaleString()}` },
                        { label: 'Promedio por contrato', value: `$ ${(this.kpis.sumaAdjudicado / Math.max(this.kpis.totalAdjudicados, 1)).toLocaleString('es-CO', { maximumFractionDigits: 0 })}` },
                        { label: 'Contratos adjudicados', value: this.kpis.totalAdjudicados }
                    ]
                };
            default:
                return null;
        }
    }

    // Métodos para filtros de columna
    onColumnFilterChange(): void {
        this.applyLocalFilters();
    }

    clearColumnFilters(): void {
        this.columnFilters = {
            referencia: '', estado: '', modalidad: '', tipo: '',
            precioMin: null, precioMax: null, proveedor: '',
            publicacionDesde: '', publicacionHasta: '', ultimaDesde: '', ultimaHasta: ''
        };
        this.applyLocalFilters();
    }

    // ===== Reporte PDF =====
    private getChartImage(chartId: string): string | null {
        const canvas = document.getElementById(chartId) as HTMLCanvasElement | null;
        if (!canvas) return null;
        try {
            return canvas.toDataURL('image/png', 1.0);
        } catch {
            return null;
        }
    }

    private buildSummaryPayload(): ContratacionSummaryPayload {
        // Distribuciones a partir de chart data
        const distribEstados: Record<string, number> = {};
        (this.estadosChartData.labels || []).forEach((l: any, i: number) => {
            const v = (this.estadosChartData.datasets[0] as any)?.data?.[i] ?? 0;
            distribEstados[String(l)] = Number(v);
        });
        const distribModalidades: Record<string, number> = {};
        (this.modalidadesChartData.labels || []).forEach((l: any, i: number) => {
            const v = (this.modalidadesChartData.datasets[0] as any)?.data?.[i] ?? 0;
            distribModalidades[String(l)] = Number(v);
        });
        const distribTipos: Record<string, number> = {};
        (this.tiposContratoChartData.labels || []).forEach((l: any, i: number) => {
            const v = (this.tiposContratoChartData.datasets[0] as any)?.data?.[i] ?? 0;
            distribTipos[String(l)] = Number(v);
        });

        const top_proveedores: Array<{ nombre: string; valor: number }> = [];
        const labels = (this.proveedoresChartData.labels || []) as string[];
        const data = ((this.proveedoresChartData.datasets?.[0] as any)?.data || []) as number[];
        labels.forEach((name, i) => top_proveedores.push({ nombre: name, valor: Number(data[i] || 0) }));

        return {
            entity_name: this.entityContext.currentEntity?.name || null,
            nit: this.entityContext.currentEntity?.nit || this.filtro.entidad || null,
            periodo: { desde: this.filtro.fechaDesde || null, hasta: this.filtro.fechaHasta || null },
            kpis: {
                totalProcesos: this.kpis.totalProcesos,
                totalAdjudicados: this.kpis.totalAdjudicados,
                tasaAdjudicacion: this.kpis.tasaAdjudicacion,
                sumaAdjudicado: this.kpis.sumaAdjudicado,
                promedioPrecioBase: this.kpis.promedioPrecioBase
            },
            distribuciones: {
                estados: distribEstados,
                modalidades: distribModalidades,
                tiposContrato: distribTipos
            },
            top_proveedores
        };
    }

    generatePdfWithAI(): void {
        if (!this.procesosFiltrados.length) return;
        this.generatingPdf = true;
        const payload = this.buildSummaryPayload();
        this.aiReport.summarizeContratacion(payload).subscribe({
            next: (res) => {
                this.generatePdf(res.summary || undefined);
                this.generatingPdf = false;
            },
            error: () => {
                // Si falla IA, generamos PDF sin IA
                this.generatePdf();
                this.generatingPdf = false;
            }
        });
    }

    generatePdf(aiSummary?: string): void {
        const doc = new jsPDF({ unit: 'pt', format: 'a4' });
        const margin = 40;
        let y = margin;

        const entityName = this.entityContext.currentEntity?.name || 'Entidad';
        const nit = this.entityContext.currentEntity?.nit || this.filtro.entidad || 'N/D';

        // Encabezado
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        doc.text(`Informe de Contratación Pública - SECOP II`, margin, y); y += 22;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(11);
        doc.text(`Entidad: ${entityName}  |  NIT: ${nit}`, margin, y); y += 16;
        doc.text(`Periodo: ${this.filtro.fechaDesde} a ${this.filtro.fechaHasta}`, margin, y); y += 10;
        doc.text(`Generado: ${new Date().toLocaleString('es-CO')}`, margin, y); y += 18;

        // Línea
        doc.setDrawColor(33, 107, 168);
        doc.line(margin, y, 555, y); y += 14;

        // KPIs
        doc.setFont('helvetica', 'bold');
        doc.text('Resumen de Indicadores', margin, y); y += 14;
        doc.setFont('helvetica', 'normal');
        const k = this.kpis;
        const kpiLines = [
            `Total procesos: ${k.totalProcesos}`,
            `Adjudicados: ${k.totalAdjudicados} (${(k.tasaAdjudicacion * 100).toFixed(1)}%)`,
            `Total adjudicado: $ ${Math.round(k.sumaAdjudicado).toLocaleString('es-CO')}`,
            `Precio base promedio: $ ${Math.round(k.promedioPrecioBase).toLocaleString('es-CO')}`
        ];
        kpiLines.forEach(line => { doc.text(line, margin, y); y += 14; });
        y += 6;

        // Resumen IA (opcional)
        if (aiSummary) {
            doc.setFont('helvetica', 'bold');
            doc.text('Resumen con IA', margin, y); y += 14;
            doc.setFont('helvetica', 'normal');
            const split = doc.splitTextToSize(aiSummary, 515);
            split.forEach((line: string) => {
                if (y > 770) { doc.addPage(); y = margin; }
                doc.text(line, margin, y);
                y += 14;
            });
            y += 6;
        }

        // Gráficas como imágenes
        const charts = [
            { id: 'chart-estados', title: 'Distribución por Estado' },
            { id: 'chart-modalidades', title: 'Modalidades' },
            { id: 'chart-tipos', title: 'Tipos de Contrato' },
            { id: 'chart-proveedores', title: 'Top Proveedores por Valor Contratado' },
            { id: 'chart-timeline', title: 'Contratos firmados en el tiempo' }
        ];
        for (const c of charts) {
            const img = this.getChartImage(c.id);
            if (!img) continue;
            if (y > 700) { doc.addPage(); y = margin; }
            doc.setFont('helvetica', 'bold');
            doc.text(c.title, margin, y); y += 10;
            try {
                doc.addImage(img, 'PNG', margin, y, 515, 220, undefined, 'FAST');
                y += 230;
            } catch { /* ignore image errors */ }
        }

        // Tabla (resumen top 20 por tamaño)
        const headers = [
            'Referencia', 'Estado', 'Modalidad', 'Tipo', 'Valor contrato', 'Valor pagado', 'Proveedor', 'Fecha firma', 'Fecha fin'
        ];
        const body = this.procesosFiltrados.slice(0, 20).map(p => [
            p.referencia_del_contrato || '-',
            p.estado_contrato || '-',
            p.modalidad_de_contratacion || '-',
            p.tipo_de_contrato || '-',
            `$ ${this.toNumber(p.valor_del_contrato).toLocaleString('es-CO')}`,
            `$ ${this.toNumber(p.valor_pagado).toLocaleString('es-CO')}`,
            p.proveedor_adjudicado || '-',
            p.fecha_de_firma ? new Date(p.fecha_de_firma).toLocaleDateString('es-CO') : '-',
            p.fecha_de_fin_del_contrato ? new Date(p.fecha_de_fin_del_contrato).toLocaleDateString('es-CO') : '-',
        ]);

        autoTable(doc, {
            head: [headers],
            body,
            startY: y,
            styles: { fontSize: 8 },
            headStyles: { fillColor: [33, 107, 168] },
            theme: 'grid',
            margin: { left: margin, right: margin }
        });

        // Guardar
        const file = `informe_contratacion_${(this.entityContext.currentEntity?.slug || 'entidad')}_${this.filtro.fechaDesde}_${this.filtro.fechaHasta}.pdf`;
        doc.save(file);
    }
}
