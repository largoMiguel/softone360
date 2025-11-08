import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Subject, takeUntil, forkJoin, of, Observable, firstValueFrom } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ChartConfiguration, ChartData } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import * as XLSX from 'xlsx';
import { PdmDataService } from '../pdm-data.service';
import { AnalisisPDM, PDMData, FiltrosPDM, EstadoMeta, PlanIndicativoProducto } from '../pdm.models';
import { PdmBackendService } from '../../../services/pdm-backend.service';
import { EntityContextService } from '../../../services/entity-context.service';
import { SecretariasService } from '../../../services/secretarias.service';
import { AuthService } from '../../../services/auth.service';
import { NotificationsService, AlertItem } from '../../../services/notifications.service';
import { AlertsEventsService } from '../../../services/alerts-events.service';
import { PdmAvanceDialogComponent, AvanceDialogData } from '../pdm-avance-dialog/pdm-avance-dialog.component';
import { environment } from '../../../../environments/environment';

declare const bootstrap: any;

// Interfaz para datos del BPIN
interface BPINData {
    bpin: string;
    nombreproyecto?: string;
    objetivogeneral?: string;
    estadoproyecto?: string;
    horizonte?: string;
    sector?: string;
    entidadresponsable?: string;
    programapresupuestal?: string;
    tipoproyecto?: string;
    plandesarrollonacional?: string;
    valortotalproyecto?: number;
    valorvigenteproyecto?: number;
    valorobligacionproyecto?: number;
    valorpagoproyecto?: number;
    subestadoproyecto?: string;
    codigoentidadresponsable?: string;
    totalbeneficiario?: number;
}

@Component({
    selector: 'app-pdm-dashboard',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        BaseChartDirective,
        PdmAvanceDialogComponent
    ],
    templateUrl: './pdm-dashboard.component.html',
    styleUrls: ['./pdm-dashboard.component.scss']
})
export class PdmDashboardComponent implements OnInit, OnDestroy {

    private destroy$ = new Subject<void>();
    private refreshInterval: any;

    pdmData: PDMData | null = null;
    analisis: AnalisisPDM | null = null;
    cargando = false;

    // Notificaciones
    alerts$!: Observable<AlertItem[]>;
    unreadCount$!: Observable<number>;

    // Exponer enum para el template
    EstadoMeta = EstadoMeta;

    // Filtros
    filtros: FiltrosPDM = {};
    sectoresDisponibles: string[] = [];
    lineasDisponibles: string[] = [];
    secretariasDisponibles: string[] = [];
    estadosDisponibles = [
        { valor: EstadoMeta.CUMPLIDA, etiqueta: 'Cumplida' },
        { valor: EstadoMeta.EN_PROGRESO, etiqueta: 'En Progreso' },
        { valor: EstadoMeta.POR_CUMPLIR, etiqueta: 'Por Cumplir' },
        { valor: EstadoMeta.PENDIENTE, etiqueta: 'Pendiente' },
        { valor: EstadoMeta.SIN_DEFINIR, etiqueta: 'Sin Definir' }
    ];

    // Tabla
    displayedColumns: string[] = ['codigo', 'sector', 'producto', 'secretaria', 'meta', 'a2024', 'a2025', 'a2026', 'a2027', 'avance', 'estado', 'presupuesto', 'acciones'];
    productos: PlanIndicativoProducto[] = [];
    productosFiltrados: PlanIndicativoProducto[] = [];
    searchTerm: string = '';
    currentPage = 1;
    itemsPerPage = 10;
    sortColumn: string = '';
    sortDirection: 'asc' | 'desc' = 'asc';
    anioSeleccionado: number = new Date().getFullYear(); // Para tabs de años
    aniosDisponibles: number[] = [2024, 2025, 2026, 2027];

    // Navegación interna del dashboard
    seccionActiva: 'resumen' | 'analisis' | 'presupuesto' | 'ods' = 'resumen';
    
    // Navegación secundaria en Análisis
    vistaAnalisis: 'cumplimiento' | 'sectores' | 'presupuesto' | 'ods' | 'sgr' | 'indicadores' | 'secretarias' | 'lineas' = 'cumplimiento';

    // Variables para BPIN
    mostrandoModalBPIN = false;
    cargandoBPIN = false;
    bpinData: BPINData | null = null;
    bpinError: string | null = null;

    // Gráficos
    chartPorAnio: ChartData<'bar'> | null = null;
    chartPorSector: ChartData<'bar'> | null = null;
    chartCumplimiento: ChartData<'doughnut'> | null = null;
    chartPresupuesto: ChartData<'line'> | null = null;
    chartODS: ChartData<'doughnut'> | null = null;
    chartODSPresupuesto: ChartData<'bar'> | null = null;
    chartSGRPorSector: ChartData<'bar'> | null = null;
    chartIndicadoresPND: ChartData<'doughnut'> | null = null;
    chartIndicadoresPorLinea: ChartData<'bar'> | null = null;
    chartPresupuestoOrdinarioVsSGR: ChartData<'doughnut'> | null = null;
    chartPresupuestoPorAnioDetallado: ChartData<'bar'> | null = null;
    chartPresupuestoPorSectorDetallado: ChartData<'bar'> | null = null;

    chartOptions: ChartConfiguration<'bar'>['options'] = {
        responsive: true,
        maintainAspectRatio: false,
        onClick: (event, elements, chart) => {
            if (elements && elements.length > 0) {
                const element = elements[0];
                const label = chart.data.labels?.[element.index];
                if (label) {
                    this.onChartDrillDown('sector', label.toString());
                }
            }
        },
        plugins: {
            legend: {
                display: true,
                position: 'top',
                labels: {
                    font: {
                        size: 12,
                        family: "'Inter', sans-serif"
                    },
                    padding: 16,
                    usePointStyle: true
                }
            },
            tooltip: {
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                padding: 12,
                cornerRadius: 8,
                titleFont: {
                    size: 13,
                    weight: 'bold'
                },
                bodyFont: {
                    size: 12
                },
                callbacks: {
                    footer: () => 'Click para filtrar'
                }
            }
        },
        scales: {
            x: {
                grid: {
                    display: false
                }
            },
            y: {
                grid: {
                    color: 'rgba(0, 0, 0, 0.05)'
                },
                ticks: {
                    precision: 0
                }
            }
        }
    };

    barHorizontalOptions: ChartConfiguration<'bar'>['options'] = {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        onClick: (event, elements, chart) => {
            if (elements && elements.length > 0) {
                const element = elements[0];
                const label = chart.data.labels?.[element.index];
                if (label) {
                    this.onChartDrillDown('sector', label.toString());
                }
            }
        },
        plugins: {
            legend: {
                display: false
            },
            tooltip: {
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                padding: 12,
                cornerRadius: 8,
                callbacks: {
                    footer: () => 'Click para filtrar'
                }
            }
        },
        scales: {
            x: {
                grid: {
                    color: 'rgba(0, 0, 0, 0.05)'
                },
                ticks: {
                    callback: function (value) {
                        return value + '%';
                    }
                }
            },
            y: {
                grid: {
                    display: false
                }
            }
        }
    };

    doughnutOptions: ChartConfiguration<'doughnut'>['options'] = {
        responsive: true,
        maintainAspectRatio: false,
        onClick: (event, elements, chart) => {
            if (elements && elements.length > 0) {
                const element = elements[0];
                const label = chart.data.labels?.[element.index];
                if (label) {
                    this.onChartDrillDown('estado', label.toString());
                }
            }
        },
        plugins: {
            legend: {
                display: true,
                position: 'right',
                labels: {
                    font: {
                        size: 12,
                        family: "'Inter', sans-serif"
                    },
                    padding: 12,
                    usePointStyle: true,
                    generateLabels: (chart) => {
                        const data = chart.data;
                        if (data.labels && data.datasets.length) {
                            return data.labels.map((label, i) => {
                                const value = data.datasets[0].data[i] as number;
                                return {
                                    text: `${label}: ${value}`,
                                    fillStyle: (data.datasets[0].backgroundColor as string[])[i],
                                    hidden: false,
                                    index: i
                                };
                            });
                        }
                        return [];
                    }
                }
            },
            tooltip: {
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                padding: 12,
                cornerRadius: 8,
                callbacks: {
                    label: function (context) {
                        const label = context.label || '';
                        const value = context.parsed || 0;
                        const total = (context.dataset.data as number[]).reduce((a, b) => a + b, 0);
                        const percentage = ((value / total) * 100).toFixed(1);
                        return `${label}: ${value} (${percentage}%)`;
                    }
                }
            }
        }
    };

    lineOptions: ChartConfiguration<'line'>['options'] = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: true,
                position: 'top',
                labels: {
                    font: {
                        size: 12
                    },
                    padding: 16,
                    usePointStyle: true
                }
            },
            tooltip: {
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                padding: 12,
                cornerRadius: 8
            }
        },
        scales: {
            x: {
                grid: {
                    display: false
                }
            },
            y: {
                grid: {
                    color: 'rgba(0, 0, 0, 0.05)'
                },
                ticks: {
                    callback: function (value) {
                        return new Intl.NumberFormat('es-CO', {
                            style: 'currency',
                            currency: 'COP',
                            notation: 'compact',
                            maximumFractionDigits: 1
                        }).format(value as number);
                    }
                }
            }
        }
    };

    // Lista de secretarías
    secretariasList: { id: number; nombre: string; is_active: boolean }[] = [];

    // Estado del Excel en BD
    excelEnBD: { existe: boolean; nombre?: string; tamano?: number; fecha?: Date } = { existe: false };

    // Modo edición
    modoEdicion = false;
    productosModificados: Set<string> = new Set(); // Códigos de productos modificados
    guardandoCambios = false;

    // Modal de edición de producto
    productoEditando: PlanIndicativoProducto | null = null;
    mostrandoModalEdicion = false;

    // Filtro para secretarios: productos con actividades asignadas
    productosFiltradosPorActividades: string[] = [];

    constructor(
        public pdmService: PdmDataService,
        private router: Router,
        private route: ActivatedRoute,
        private pdmBackend: PdmBackendService,
        private entityContext: EntityContextService,
        private secretariasService: SecretariasService,
        public authService: AuthService, // Público para usar en el template
        private notificationsService: NotificationsService,
        private alertsEvents: AlertsEventsService,
        private http: HttpClient
    ) {
        // Inicializar streams de alertas
        this.alerts$ = this.notificationsService.alertsStream;
        this.unreadCount$ = this.notificationsService.unreadCountStream;
    }

    // Helper para extraer mensajes de error
    private extractErrorMsg(error: any): string {
        if (!error) return 'Error desconocido';
        if (typeof error === 'string') return error;

        if (error.error) {
            if (typeof error.error === 'string') return error.error;
            if (error.error.detail) {
                if (typeof error.error.detail === 'string') return error.error.detail;
                if (Array.isArray(error.error.detail)) {
                    return error.error.detail
                        .map((e: any) => {
                            if (typeof e === 'string') return e;
                            if (e.msg) return `${e.loc ? e.loc.join('.') + ': ' : ''}${e.msg}`;
                            return JSON.stringify(e);
                        })
                        .join('; ');
                }
                return JSON.stringify(error.error.detail);
            }
            if (error.error.message) return error.error.message;
        }

        if (error.message) return error.message;
        if (error.statusText) return error.statusText;

        return 'Error al procesar la solicitud';
    }

    private showToast(message: string, type: 'success' | 'error' | 'info' = 'info') {
        const toastContainer = document.getElementById('toast-container');
        if (!toastContainer) return;

        const toastId = `toast-${Date.now()}`;
        const bgClass = type === 'success' ? 'bg-success' : type === 'error' ? 'bg-danger' : 'bg-primary';
        const icon = type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle';

        const toastHtml = `
            <div id="${toastId}" class="toast align-items-center text-white ${bgClass} border-0" role="alert">
                <div class="d-flex">
                    <div class="toast-body">
                        <i class="fas ${icon} me-2"></i>${message}
                    </div>
                    <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
                </div>
            </div>
        `;

        toastContainer.insertAdjacentHTML('beforeend', toastHtml);
        const toastElement = document.getElementById(toastId);
        if (toastElement) {
            const toast = new bootstrap.Toast(toastElement, { delay: 3000 });
            toast.show();
            toastElement.addEventListener('hidden.bs.toast', () => toastElement.remove());
        }
    }

    ngOnInit(): void {
        // Cargar notificaciones al iniciar
        this.notificationsService.fetch(true).subscribe();

        // Escuchar eventos de alertas (cuando se hace click en una notificación)
        this.alertsEvents.openRequested$
            .pipe(takeUntil(this.destroy$))
            .subscribe(alert => this.abrirDesdeNotificacion(alert));

        // Cargar secretarías
        this.cargarSecretarias();

        // Verificar Excel en BD
        this.verificarExcelEnBD();

        // Intentar cargar datos desde localStorage primero
        const slug = this.entityContext.currentEntity?.slug;
        if (slug) {
            // Intentar descargar desde BD si existe y no hay datos locales
            this.verificarYCargarDesdeBD(slug);
        }

        this.pdmService.pdmData$
            .pipe(takeUntil(this.destroy$))
            .subscribe(data => {
                this.pdmData = data;
                if (data) {
                    this.sectoresDisponibles = this.pdmService.obtenerSectoresUnicos();
                    this.lineasDisponibles = this.pdmService.obtenerLineasEstrategicasUnicas();
                    this.secretariasDisponibles = this.pdmService.obtenerSecretariasUnicas();

                    // Cargar secretarías primero, luego asignaciones
                    const slug = this.entityContext.currentEntity?.slug;
                    if (slug) {
                        this.cargarSecretarias();

                        // Esperar un momento para asegurar que secretarías estén cargadas
                        setTimeout(() => {
                            this.pdmBackend.getAssignments(slug).subscribe({
                                next: (resp: { assignments: Record<string, string | null> }) => {
                                    const map = resp.assignments || {};
                                    console.log('📋 Asignaciones cargadas desde BD:', map);
                                    this.pdmData!.planIndicativoProductos.forEach(p => {
                                        const sec = map[p.codigoIndicadorProducto];
                                        if (sec !== undefined && sec !== null) {
                                            // Asignar el valor de secretaría si existe
                                            p.secretariaAsignada = sec;
                                        } else {
                                            // Si es null o undefined, dejar sin asignar
                                            p.secretariaAsignada = undefined;
                                        }
                                    });

                                    // Aplicar filtro automático basado en el rol del usuario
                                    this.aplicarFiltrosPorRol();

                                    this.actualizarTabla();
                                    // Luego de asignaciones, cargar avances por cada producto
                                    this.cargarAvancesParaTodos(slug);
                                },
                                error: () => {
                                    console.error('❌ Error al cargar asignaciones');
                                    this.aplicarFiltrosPorRol();
                                    this.actualizarTabla();
                                }
                            });
                        }, 100);
                    } else {
                        // Si no hay slug, igual intentamos cargar tabla
                        this.aplicarFiltrosPorRol();
                        this.actualizarTabla();
                    }
                }
                // No redirigir, mostrar mensaje de "No hay datos"
            });

        this.pdmService.analisis$
            .pipe(takeUntil(this.destroy$))
            .subscribe(analisis => {
                this.analisis = analisis;
                if (analisis) {
                    this.generarGraficos(analisis);
                }
            });

        this.pdmService.cargando$
            .pipe(takeUntil(this.destroy$))
            .subscribe(cargando => {
                this.cargando = cargando;
            });

        // Auto-refresh cada 60 segundos para actualizar avances y actividades
        this.refreshInterval = setInterval(() => {
            // Verificar autenticación antes de hacer peticiones
            if (!this.authService.isAuthenticated()) {
                if (this.refreshInterval) {
                    clearInterval(this.refreshInterval);
                }
                return;
            }

            const slug = this.entityContext.currentEntity?.slug;
            if (slug && this.pdmData) {
                this.cargarAvancesParaTodos(slug);
            }
        }, 60000);
    }

    cargarSecretarias() {
        this.secretariasService.listar().subscribe({
            next: (data) => {
                this.secretariasList = data;
                // Actualizar secretariasDisponibles con todas las secretarías del sistema
                // Combinar secretarías del sistema con las que ya tienen productos asignados
                const secretariasAsignadas = this.pdmService.obtenerSecretariasUnicas();
                const secretariasSistema = data.map(s => s.nombre);
                
                // Unir ambas listas y eliminar duplicados
                const todasSecretarias = new Set([...secretariasAsignadas, ...secretariasSistema]);
                this.secretariasDisponibles = Array.from(todasSecretarias).sort();
            },
            error: () => {
                this.secretariasList = [];
            }
        });
    }

    onCambiarSecretaria(row: PlanIndicativoProducto, secretaria: string | undefined) {
        const slug = this.entityContext.currentEntity?.slug;
        if (!slug) return;

        console.log('🔄 Asignando secretaría:', {
            producto: row.codigoIndicadorProducto,
            secretaria: secretaria,
            slug: slug
        });

        // Actualizar inmediatamente en la UI y en los datos del servicio
        row.secretariaAsignada = secretaria || undefined;

        // CRÍTICO: También actualizar en pdmData para que persista en el servicio
        if (this.pdmData) {
            const productoEnData = this.pdmData.planIndicativoProductos.find(
                p => p.codigoIndicadorProducto === row.codigoIndicadorProducto
            );
            if (productoEnData) {
                productoEnData.secretariaAsignada = secretaria || undefined;
                console.log('✅ Actualizado en pdmData:', productoEnData.codigoIndicadorProducto, '→', secretaria);
            }
        }

        this.pdmBackend.upsertAssignment(slug, {
            codigo_indicador_producto: row.codigoIndicadorProducto,
            secretaria: secretaria || null,
        }).subscribe({
            next: () => {
                console.log('✅ Secretaría guardada exitosamente en BD:', secretaria);
                // Actualizar la tabla para reflejar los cambios
                this.actualizarTabla();
                this.showToast('Secretaría asignada correctamente', 'success');
            },
            error: (err) => {
                console.error('❌ Error asignando secretaría:', err);
                // Revertir cambio en caso de error
                row.secretariaAsignada = undefined;
                if (this.pdmData) {
                    const productoEnData = this.pdmData.planIndicativoProductos.find(
                        p => p.codigoIndicadorProducto === row.codigoIndicadorProducto
                    );
                    if (productoEnData) {
                        productoEnData.secretariaAsignada = undefined;
                    }
                }
                this.actualizarTabla();
                const msg = this.extractErrorMsg(err);
                this.showToast(msg, 'error');
            }
        });
    }

    avanceDialogData: AvanceDialogData | null = null;
    avanceModalInstance: any = null;

    // Detalle de producto
    productoSeleccionado: PlanIndicativoProducto | null = null;
    Object = Object; // Para usar Object.keys en el template

    // Gestión de actividades
    actividadesProducto: any[] = [];
    cargandoActividades = false;
    mostrandoFormActividad = false;
    guardandoActividad = false;
    actividadEditando: any = null;
    formActividad: any = {
        nombre: '',
        descripcion: '',
        responsable: '',
        fecha_inicio: '',
        fecha_fin: '',
        estado: 'pendiente',
        anio: new Date().getFullYear(), // Año actual por defecto
        meta_ejecutar: 0, // Cantidad de la meta anual a ejecutar
        valor_ejecutado: 0 // Inicia en 0
    };

    // Estadísticas avanzadas
    estadisticasPorSecretaria: {
        secretaria: string;
        totalMetas: number;
        avance2024: number;
        avance2025: number;
        avance2026: number;
        avance2027: number;
        avancePromedio: number;
    }[] = [];

    estadisticasPorLinea: {
        lineaEstrategica: string;
        totalMetas: number;
        avance2024: number;
        avance2025: number;
        avance2026: number;
        avance2027: number;
        avancePromedio: number;
    }[] = [];

    abrirDialogoAvance(row: PlanIndicativoProducto | null | undefined) {
        // Validaciones de campos vacíos / nulos
        if (!row || !row.codigoIndicadorProducto) {
            this.showToast('No se puede registrar avance: producto inválido.', 'error');
            return;
        }

        const slug = this.entityContext.currentEntity?.slug;
        if (!slug) return;

        this.pdmBackend.getActividades(slug, row.codigoIndicadorProducto).subscribe({
            next: (response) => {
                const actividades = response.actividades || [];
                if (!actividades.length) {
                    this.showToast('Primero debe crear una actividad para este producto.', 'error');
                    return;
                }

                this.avanceDialogData = {
                    codigo: row.codigoIndicadorProducto,
                    avances: row.avances,
                    actividades,
                    entitySlug: slug
                } as any;

                // Usar requestAnimationFrame para asegurar que el DOM esté listo
                requestAnimationFrame(() => {
                    const modalElement = document.getElementById('avanceModal');
                    if (modalElement && bootstrap) {
                        // Si ya existe una instancia, primero disposearla
                        if (this.avanceModalInstance) {
                            this.avanceModalInstance.dispose();
                        }
                        this.avanceModalInstance = new bootstrap.Modal(modalElement);
                        this.avanceModalInstance.show();
                    }
                });
            },
            error: () => this.showToast('No se pudieron cargar las actividades del producto.', 'error')
        });
    }

    onAvanceSave(result: {
        actividadId: number;
        descripcion: string;
        url: string;
        imagenes: Array<{
            archivo: File;
            preview: string;
            base64: string;
            nombre: string;
            tamano: number;
            mimeType: string;
        }>;
    }) {
        if (!this.avanceDialogData) return;
        const slug = this.entityContext.currentEntity?.slug;
        if (!slug) return;

        const row = this.productos.find(p => p.codigoIndicadorProducto === this.avanceDialogData!.codigo);
        if (!row) return;

        // Buscar actividad seleccionada
        const actividades = (this.avanceDialogData as any).actividades || [];
        const actividad = actividades.find((a: any) => a.id === result.actividadId);
        if (!actividad) {
            this.showToast('Seleccione una actividad válida para registrar el avance.', 'error');
            return;
        }

        // El valor ejecutado es la meta_ejecutar de la actividad
        const valorEjecutado = Number(actividad.meta_ejecutar || 0);

        // Preparar imágenes para el backend
        const imagenesPayload = result.imagenes.map(img => {
            const raw = img.base64.split(',')[1] || img.base64;
            return {
                nombre_imagen: img.nombre,
                mime_type: img.mimeType,
                tamano: img.tamano,
                contenido_base64: raw,
                contenido: raw // compatibilidad
            };
        });

        // Crear la ejecución con evidencias
        const payload = {
            actividad_id: result.actividadId,
            valor_ejecutado_incremento: valorEjecutado,
            descripcion: result.descripcion.trim() || undefined,
            url_evidencia: result.url.trim() || undefined,
            imagenes: imagenesPayload.length > 0 ? imagenesPayload : undefined
        };

        this.pdmBackend.createEjecucion(slug, result.actividadId, payload).subscribe({
            next: async (ejecucion) => {
                this.showToast('Ejecución registrada exitosamente', 'success');

                // Recargar datos del PDM para reflejar los cambios
                try {
                    await this.pdmService.descargarYProcesarExcelDesdeBD(slug);
                } catch (error) {
                    console.error('Error al recargar datos:', error);
                }

                // Cerrar modal
                if (this.avanceModalInstance) {
                    this.avanceModalInstance.hide();
                }
                this.avanceDialogData = null;
            },
            error: (err) => {
                console.error('Error al crear ejecución:', err);
                this.showToast('No se pudo registrar la ejecución', 'error');
                // Resetear estado de guardando en el modal
                if (this.avanceDialogData) {
                    (this.avanceDialogData as any).guardando = false;
                }
            }
        });
    }

    onAvanceCancel() {
        if (this.avanceModalInstance) {
            this.avanceModalInstance.hide();
        }
        this.avanceDialogData = null;
    }

    private cargarAvancesParaTodos(slug: string) {
        const productos = this.pdmData?.planIndicativoProductos || [];
        if (!productos.length) return;

        const peticiones = productos.map(p =>
            this.pdmBackend.getAvances(slug, p.codigoIndicadorProducto).pipe(
                catchError(() => of(null))
            )
        );

        forkJoin(peticiones).pipe(takeUntil(this.destroy$)).subscribe((respuestas) => {
            respuestas.forEach((resp, idx) => {
                if (!resp) return;
                const row = productos[idx];
                if (!row.avances) row.avances = {};
                resp.avances.forEach(a => {
                    row.avances![a.anio] = {
                        valor: a.valor_ejecutado,
                        comentario: a.comentario
                    };
                });
                // Si no hay 'avance' global, establecemos promedio de años disponibles
                if (row.avance === undefined || row.avance === null) {
                    const vals = Object.values(row.avances).map(v => v.valor).filter(v => typeof v === 'number');
                    if (vals.length) {
                        row.avance = vals.reduce((a, b) => a + b, 0) / vals.length;
                    }
                }
            });
            this.actualizarTabla();
            // Después de cargar avances por año, calcular avance general basado en actividades
            this.cargarActividadesParaTodos(slug);
        });
    }

    /**
     * Carga actividades por producto y calcula el avance general basado en valor ejecutado vs meta del año
     * Fórmula: avance = (suma_valores_ejecutados / meta_total_anio) * 100
     */
    private cargarActividadesParaTodos(slug: string) {
        const productos = this.pdmData?.planIndicativoProductos || [];
        if (!productos.length) return;

        const codigos = productos.map(p => p.codigoIndicadorProducto);
        this.pdmBackend.getActividadesBulk(slug, codigos).pipe(
            takeUntil(this.destroy$),
            catchError(() => of({ items: {} as Record<string, any[]> }))
        ).subscribe((resp) => {
            productos.forEach((producto) => {
                const actividades = resp.items?.[producto.codigoIndicadorProducto] || [];

                // Inicializar avances si no existe
                if (!producto.avances) producto.avances = {};

                // Calcular avance para cada año basado en actividades
                [2024, 2025, 2026, 2027].forEach(anio => {
                    const metaAnio = this.obtenerMetaAnioProducto(producto, anio);

                    if (metaAnio === 0) {
                        // Si no hay meta para este año, el avance es 0
                        producto.avances![anio] = { valor: 0, comentario: '' };
                    } else {
                        // Sumar todos los valores ejecutados de las actividades de este año
                        const totalEjecutado = actividades
                            .filter((a: any) => a.anio === anio)
                            .reduce((sum: number, a: any) => sum + (a.valor_ejecutado || 0), 0);

                        // Calcular porcentaje de avance
                        const avance = Math.min((totalEjecutado / metaAnio) * 100, 100);
                        producto.avances![anio] = {
                            valor: Math.round(avance * 100) / 100, // Redondear a 2 decimales
                            comentario: producto.avances![anio]?.comentario || ''
                        };
                    }
                });

                // Calcular avance general como promedio de todos los años
                const valores = Object.values(producto.avances).map(a => a.valor).filter(v => typeof v === 'number' && v > 0);
                producto.avance = valores.length ? Math.round((valores.reduce((a, b) => a + b, 0) / valores.length) * 100) / 100 : 0;

                // Calcular estado de la meta para el año actual (para mostrar en la tabla)
                const añoActual = new Date().getFullYear();
                producto.estado = this.calcularEstadoMeta(producto, actividades, añoActual);

                // Calcular y guardar estados por año (para análisis de gráficos)
                producto.estadosPorAnio = {
                    2024: this.calcularEstadoMeta(producto, actividades, 2024),
                    2025: this.calcularEstadoMeta(producto, actividades, 2025),
                    2026: this.calcularEstadoMeta(producto, actividades, 2026),
                    2027: this.calcularEstadoMeta(producto, actividades, 2027)
                };
            });
            this.actualizarTabla();
            this.calcularEstadisticasAvanzadas();
        });
    }

    /**
     * Calcula el estado de una meta basado en el año, actividades y avance
     */
    private calcularEstadoMeta(producto: any, actividades: any[], año: number): EstadoMeta {
        // Si no tiene meta definida para ese año específico
        const metaAnio = this.obtenerMetaAnioProducto(producto, año);
        if (metaAnio === 0) {
            return EstadoMeta.SIN_DEFINIR;
        }

        // Si es una meta futura (años después del actual)
        const añoActual = new Date().getFullYear();
        if (año > añoActual) {
            return EstadoMeta.POR_CUMPLIR;
        }

        // Filtrar actividades del año específico
        const actividadesAnio = actividades.filter((a: any) => a.anio === año);

        // Si no tiene actividades para ese año, está pendiente
        if (actividadesAnio.length === 0) {
            return EstadoMeta.PENDIENTE;
        }

        // Calcular avance ESPECÍFICO del año
        const totalEjecutado = actividadesAnio.reduce((sum: number, a: any) => sum + (a.valor_ejecutado || 0), 0);
        const avanceDelAnio = (totalEjecutado / metaAnio) * 100;

        // Determinar estado basado en el avance del año
        if (avanceDelAnio >= 100) {
            return EstadoMeta.CUMPLIDA;
        } else if (avanceDelAnio > 0) {
            return EstadoMeta.EN_PROGRESO;
        } else {
            return EstadoMeta.PENDIENTE;
        }
    }    /**
     * Obtiene la meta de un producto para un año específico
     */
    private obtenerMetaAnioProducto(producto: any, anio: number): number {
        if (anio === 2024) return producto.meta2024 || 0;
        if (anio === 2025) return producto.meta2025 || 0;
        if (anio === 2026) return producto.meta2026 || 0;
        if (anio === 2027) return producto.meta2027 || 0;
        return 0;
    }

    calcularEstadisticasAvanzadas(): void {
        if (!this.productos.length) return;

        // Estadísticas por secretaría
        const secretariasMap = new Map<string, {
            totalMetas: number;
            avances: { 2024: number[]; 2025: number[]; 2026: number[]; 2027: number[] };
        }>();

        this.productos.forEach(p => {
            const sec = p.secretariaAsignada || 'Sin asignar';
            if (!secretariasMap.has(sec)) {
                secretariasMap.set(sec, {
                    totalMetas: 0,
                    avances: { 2024: [], 2025: [], 2026: [], 2027: [] }
                });
            }
            const stats = secretariasMap.get(sec)!;
            stats.totalMetas++;

            if (p.avances) {
                if (p.avances[2024]) stats.avances[2024].push(p.avances[2024].valor);
                if (p.avances[2025]) stats.avances[2025].push(p.avances[2025].valor);
                if (p.avances[2026]) stats.avances[2026].push(p.avances[2026].valor);
                if (p.avances[2027]) stats.avances[2027].push(p.avances[2027].valor);
            }
        });

        this.estadisticasPorSecretaria = Array.from(secretariasMap.entries()).map(([secretaria, stats]) => {
            const avg2024 = stats.avances[2024].length ? stats.avances[2024].reduce((a, b) => a + b, 0) / stats.avances[2024].length : 0;
            const avg2025 = stats.avances[2025].length ? stats.avances[2025].reduce((a, b) => a + b, 0) / stats.avances[2025].length : 0;
            const avg2026 = stats.avances[2026].length ? stats.avances[2026].reduce((a, b) => a + b, 0) / stats.avances[2026].length : 0;
            const avg2027 = stats.avances[2027].length ? stats.avances[2027].reduce((a, b) => a + b, 0) / stats.avances[2027].length : 0;
            const avancePromedio = (avg2024 + avg2025 + avg2026 + avg2027) / 4;

            return {
                secretaria,
                totalMetas: stats.totalMetas,
                avance2024: avg2024,
                avance2025: avg2025,
                avance2026: avg2026,
                avance2027: avg2027,
                avancePromedio
            };
        }).sort((a, b) => b.avancePromedio - a.avancePromedio);

        // Estadísticas por línea estratégica
        const lineasMap = new Map<string, {
            totalMetas: number;
            avances: { 2024: number[]; 2025: number[]; 2026: number[]; 2027: number[] };
        }>();

        this.productos.forEach(p => {
            const linea = p.lineaEstrategica || 'Sin definir';
            if (!lineasMap.has(linea)) {
                lineasMap.set(linea, {
                    totalMetas: 0,
                    avances: { 2024: [], 2025: [], 2026: [], 2027: [] }
                });
            }
            const stats = lineasMap.get(linea)!;
            stats.totalMetas++;

            if (p.avances) {
                if (p.avances[2024]) stats.avances[2024].push(p.avances[2024].valor);
                if (p.avances[2025]) stats.avances[2025].push(p.avances[2025].valor);
                if (p.avances[2026]) stats.avances[2026].push(p.avances[2026].valor);
                if (p.avances[2027]) stats.avances[2027].push(p.avances[2027].valor);
            }
        });

        this.estadisticasPorLinea = Array.from(lineasMap.entries()).map(([lineaEstrategica, stats]) => {
            const avg2024 = stats.avances[2024].length ? stats.avances[2024].reduce((a, b) => a + b, 0) / stats.avances[2024].length : 0;
            const avg2025 = stats.avances[2025].length ? stats.avances[2025].reduce((a, b) => a + b, 0) / stats.avances[2025].length : 0;
            const avg2026 = stats.avances[2026].length ? stats.avances[2026].reduce((a, b) => a + b, 0) / stats.avances[2026].length : 0;
            const avg2027 = stats.avances[2027].length ? stats.avances[2027].reduce((a, b) => a + b, 0) / stats.avances[2027].length : 0;
            const avancePromedio = (avg2024 + avg2025 + avg2026 + avg2027) / 4;

            return {
                lineaEstrategica,
                totalMetas: stats.totalMetas,
                avance2024: avg2024,
                avance2025: avg2025,
                avance2026: avg2026,
                avance2027: avg2027,
                avancePromedio
            };
        }).sort((a, b) => b.avancePromedio - a.avancePromedio);
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
        // Limpiar el intervalo de auto-refresh
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
    }

    /**
     * Aplica filtros automáticos según el rol y secretaría del usuario
     */
    private async aplicarFiltrosPorRol(): Promise<void> {
        const currentUser = this.authService.getCurrentUserValue();
        if (!currentUser) return;

        // Para secretarios: filtrar productos que tienen actividades asignadas a su secretaría
        if (currentUser.role === 'secretario' && currentUser.secretaria) {
            await this.filtrarProductosConActividadesAsignadas(currentUser.secretaria);
        }

        // Los admin y superadmin pueden ver todo
        // No aplicar filtros automáticos
    }

    private async filtrarProductosConActividadesAsignadas(secretaria: string): Promise<void> {
        const slug = this.entityContext.currentEntity?.slug;
        if (!slug || !this.pdmData) return;

        const productos = this.pdmData.planIndicativoProductos;
        const productosConActividades: string[] = [];
        const codigos = productos.map(p => p.codigoIndicadorProducto);
        const resp = await firstValueFrom(
            this.pdmBackend.getActividadesBulk(slug, codigos).pipe(
                catchError(() => of({ items: {} as Record<string, any[]> }))
            )
        );

        productos.forEach((producto) => {
            const actividades = resp.items?.[producto.codigoIndicadorProducto] || [];
            const tieneActividadesAsignadas = actividades.some((a: any) => a.responsable === secretaria);
            if (tieneActividadesAsignadas) {
                productosConActividades.push(producto.codigoIndicadorProducto);
            }
        });

        // Aplicar filtro para mostrar solo productos con actividades asignadas
        this.productosFiltradosPorActividades = productosConActividades;
        this.actualizarTabla();
    }

    /**
     * Verifica si el usuario actual puede modificar un producto
     */
    puedeModificarProducto(producto: PlanIndicativoProducto): boolean {
        const currentUser = this.authService.getCurrentUserValue();
        if (!currentUser) return false;

        // Superadmin y admin pueden modificar todo
        if (currentUser.role === 'superadmin' || currentUser.role === 'admin') {
            return true;
        }

        // Secretarios solo pueden modificar productos asignados a su secretaría
        if (currentUser.role === 'secretario' && currentUser.secretaria) {
            return producto.secretariaAsignada === currentUser.secretaria;
        }

        return false;
    }

    aplicarFiltros(): void {
        this.actualizarTabla();
    }

    limpiarFiltros(): void {
        this.filtros = {};
        this.actualizarTabla();
    }

    onChartDrillDown(tipo: string, valor: string): void {
        // Aplicar filtro basado en el clic del gráfico
        switch (tipo) {
            case 'sector':
                this.filtros.sector = valor;
                break;
            case 'linea':
                this.filtros.lineaEstrategica = valor;
                break;
            case 'estado':
                this.filtros.estado = valor as any;
                break;
            case 'anio':
                const anio = parseInt(valor);
                if ([2024, 2025, 2026, 2027].includes(anio)) {
                    this.cambiarAnioSeleccionado(anio);
                }
                break;
        }
        this.aplicarFiltros();

        // Scroll suave a la sección de detalle de productos
        setTimeout(() => {
            const element = document.querySelector('.section-header');
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }, 100);

        // Mostrar notificación
        this.showToast(`Filtrado por ${tipo}: ${valor}`, 'info');
    }

    private actualizarTabla(): void {
        this.productos = this.pdmService.obtenerDatosFiltrados(this.filtros);

        // Aplicar filtro adicional para secretarios: solo productos con actividades asignadas
        const currentUser = this.authService.getCurrentUserValue();
        if (currentUser?.role === 'secretario' && this.productosFiltradosPorActividades.length > 0) {
            this.productos = this.productos.filter(p =>
                this.productosFiltradosPorActividades.includes(p.codigoIndicadorProducto)
            );
        }

        this.aplicarFiltroYOrdenamiento();
        this.calcularEstadisticasAvanzadas();
    }

    private aplicarFiltroYOrdenamiento(): void {
        let datos = [...this.productos];

        // Filtro de búsqueda
        const term = (this.searchTerm || '').trim().toLowerCase();
        if (term) {
            datos = datos.filter(data =>
                (data.personalizacion || '').toLowerCase().includes(term) ||
                (data.indicadorProducto || '').toLowerCase().includes(term) ||
                (data.sector || '').toLowerCase().includes(term) ||
                (data.lineaEstrategica || '').toLowerCase().includes(term) ||
                (data.secretariaAsignada || '').toLowerCase().includes(term)
            );
        }

        // Ordenamiento
        if (this.sortColumn) {
            datos.sort((a, b) => {
                const aVal = (a as any)[this.sortColumn];
                const bVal = (b as any)[this.sortColumn];
                const direction = this.sortDirection === 'asc' ? 1 : -1;
                if (aVal < bVal) return -1 * direction;
                if (aVal > bVal) return 1 * direction;
                return 0;
            });
        }

        this.productosFiltrados = datos;
    }

    onSort(column: string): void {
        if (this.sortColumn === column) {
            this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortColumn = column;
            this.sortDirection = 'asc';
        }
        this.aplicarFiltroYOrdenamiento();
    }

    onSearchChange(): void {
        this.currentPage = 1;
        this.aplicarFiltroYOrdenamiento();
    }

    get paginatedData(): PlanIndicativoProducto[] {
        const start = (this.currentPage - 1) * this.itemsPerPage;
        const end = start + this.itemsPerPage;
        return this.productosFiltrados.slice(start, end);
    }

    get totalPages(): number {
        return Math.ceil(this.productosFiltrados.length / this.itemsPerPage);
    }

    get pages(): number[] {
        return Array.from({ length: this.totalPages }, (_, i) => i + 1);
    }

    private generarGraficos(analisis: AnalisisPDM): void {
        // Gráfico de cumplimiento general (doughnut)
        this.chartCumplimiento = {
            labels: ['Cumplidas', 'En Progreso', 'Por Cumplir', 'Pendientes'],
            datasets: [{
                data: [
                    analisis.indicadoresGenerales.metasCumplidas,
                    analisis.indicadoresGenerales.metasEnProgreso,
                    analisis.indicadoresGenerales.metasPorCumplir,
                    analisis.indicadoresGenerales.metasPendientes
                ],
                backgroundColor: [
                    '#10b981',
                    '#3b82f6',
                    '#f59e0b',
                    '#ef4444'
                ],
                borderWidth: 3,
                borderColor: '#ffffff',
                hoverOffset: 8
            }]
        };

        // Gráfico por año (barras)
        this.chartPorAnio = {
            labels: analisis.analisisPorAnio.map(a => a.anio.toString()),
            datasets: [
                {
                    label: 'Total de Metas',
                    data: analisis.analisisPorAnio.map(a => a.totalMetas),
                    backgroundColor: 'rgba(59, 130, 246, 0.8)',
                    borderColor: '#3b82f6',
                    borderWidth: 1,
                    borderRadius: 8,
                    hoverBackgroundColor: '#3b82f6'
                },
                {
                    label: 'Metas Cumplidas',
                    data: analisis.analisisPorAnio.map(a => a.metasCumplidas),
                    backgroundColor: 'rgba(16, 185, 129, 0.8)',
                    borderColor: '#10b981',
                    borderWidth: 1,
                    borderRadius: 8,
                    hoverBackgroundColor: '#10b981'
                }
            ]
        };

        // Gráfico por sector (barras horizontales)
        const topSectores = analisis.analisisPorSector.slice(0, 10);
        this.chartPorSector = {
            labels: topSectores.map(s => this.truncarTexto(s.sector, 35)),
            datasets: [{
                label: '% Cumplimiento',
                data: topSectores.map(s => s.porcentajeCumplimiento),
                backgroundColor: topSectores.map(s => {
                    if (s.porcentajeCumplimiento >= 70) return 'rgba(16, 185, 129, 0.8)';
                    if (s.porcentajeCumplimiento >= 40) return 'rgba(245, 158, 11, 0.8)';
                    return 'rgba(239, 68, 68, 0.8)';
                }),
                borderColor: topSectores.map(s => {
                    if (s.porcentajeCumplimiento >= 70) return '#10b981';
                    if (s.porcentajeCumplimiento >= 40) return '#f59e0b';
                    return '#ef4444';
                }),
                borderWidth: 1,
                borderRadius: 8,
                hoverBackgroundColor: topSectores.map(s => {
                    if (s.porcentajeCumplimiento >= 70) return '#10b981';
                    if (s.porcentajeCumplimiento >= 40) return '#f59e0b';
                    return '#ef4444';
                })
            }]
        };

        // Gráfico de presupuesto por año (línea)
        this.chartPresupuesto = {
            labels: analisis.analisisPorAnio.map(a => a.anio.toString()),
            datasets: [{
                label: 'Presupuesto Total',
                data: analisis.analisisPorAnio.map(a => a.presupuestoTotal),
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                fill: true,
                tension: 0.4,
                pointBackgroundColor: '#3b82f6',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 3,
                pointRadius: 6,
                pointHoverRadius: 8,
                borderWidth: 3
            }]
        };

        // Gráfico ODS - Distribución de metas
        if (analisis.analisisPorODS && analisis.analisisPorODS.length > 0) {
            this.chartODS = {
                labels: analisis.analisisPorODS.map(o => `ODS ${o.codigoODS}`),
                datasets: [{
                    data: analisis.analisisPorODS.map(o => o.totalMetas),
                    backgroundColor: [
                        '#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6',
                        '#1abc9c', '#34495e', '#e67e22', '#95a5a6', '#d35400',
                        '#c0392b', '#2980b9', '#27ae60', '#f1c40f', '#8e44ad',
                        '#16a085', '#2c3e50'
                    ],
                    borderWidth: 3,
                    borderColor: '#ffffff',
                    hoverOffset: 8
                }]
            };

            // Gráfico ODS - Top 5 por presupuesto
            const top5ODS = [...analisis.analisisPorODS]
                .sort((a, b) => b.presupuestoTotal - a.presupuestoTotal)
                .slice(0, 5);

            this.chartODSPresupuesto = {
                labels: top5ODS.map(o => `ODS ${o.codigoODS}`),
                datasets: [{
                    label: 'Presupuesto',
                    data: top5ODS.map(o => o.presupuestoTotal),
                    backgroundColor: 'rgba(16, 185, 129, 0.8)',
                    borderColor: '#10b981',
                    borderWidth: 1,
                    borderRadius: 8,
                    hoverBackgroundColor: '#10b981'
                }]
            };
        }

        // Gráfico SGR - Recursos por sector
        if (analisis.analisisSGR && analisis.analisisSGR.recursosSGRPorSector.length > 0) {
            const topSGR = analisis.analisisSGR.recursosSGRPorSector.slice(0, 8);
            this.chartSGRPorSector = {
                labels: topSGR.map(s => this.truncarTexto(s.sector, 30)),
                datasets: [{
                    label: 'Recursos SGR',
                    data: topSGR.map(s => s.totalRecursosSGR),
                    backgroundColor: 'rgba(245, 158, 11, 0.8)',
                    borderColor: '#f59e0b',
                    borderWidth: 1,
                    borderRadius: 8,
                    hoverBackgroundColor: '#f59e0b'
                }]
            };
        }

        // Gráfico Indicadores de Resultado - Alineación con PND
        if (analisis.analisisIndicadoresResultado) {
            this.chartIndicadoresPND = {
                labels: ['En PND', 'Fuera de PND'],
                datasets: [{
                    data: [
                        analisis.analisisIndicadoresResultado.indicadoresEnPND,
                        analisis.analisisIndicadoresResultado.indicadoresFueraPND
                    ],
                    backgroundColor: [
                        'rgba(16, 185, 129, 0.8)',
                        'rgba(156, 163, 175, 0.8)'
                    ],
                    borderColor: ['#10b981', '#9ca3af'],
                    borderWidth: 3,
                    hoverOffset: 8
                }]
            };

            // Gráfico Indicadores por Línea Estratégica
            if (analisis.analisisIndicadoresResultado.indicadoresPorLinea.length > 0) {
                const topLineas = analisis.analisisIndicadoresResultado.indicadoresPorLinea.slice(0, 8);
                this.chartIndicadoresPorLinea = {
                    labels: topLineas.map(l => this.truncarTexto(l.lineaEstrategica, 30)),
                    datasets: [
                        {
                            label: 'Total Indicadores',
                            data: topLineas.map(l => l.totalIndicadores),
                            backgroundColor: 'rgba(59, 130, 246, 0.8)',
                            borderColor: '#3b82f6',
                            borderWidth: 1,
                            borderRadius: 8,
                            hoverBackgroundColor: '#3b82f6'
                        },
                        {
                            label: 'Indicadores en PND',
                            data: topLineas.map(l => l.indicadoresEnPND),
                            backgroundColor: 'rgba(16, 185, 129, 0.8)',
                            borderColor: '#10b981',
                            borderWidth: 1,
                            borderRadius: 8,
                            hoverBackgroundColor: '#10b981'
                        }
                    ]
                };
            }
        }

        // Gráfico Presupuesto - Ordinario vs SGR
        if (analisis.analisisPresupuestoDetallado) {
            this.chartPresupuestoOrdinarioVsSGR = {
                labels: ['Recursos Ordinarios', 'Recursos SGR'],
                datasets: [{
                    data: [
                        analisis.analisisPresupuestoDetallado.presupuestoOrdinarioTotal,
                        analisis.analisisPresupuestoDetallado.presupuestoSGRTotal
                    ],
                    backgroundColor: [
                        'rgba(59, 130, 246, 0.8)',
                        'rgba(245, 158, 11, 0.8)'
                    ],
                    borderColor: ['#3b82f6', '#f59e0b'],
                    borderWidth: 3,
                    hoverOffset: 8
                }]
            };

            // Gráfico Presupuesto por Año Detallado (Ordinario + SGR)
            this.chartPresupuestoPorAnioDetallado = {
                labels: analisis.analisisPresupuestoDetallado.presupuestoPorAnio.map(p => p.anio.toString()),
                datasets: [
                    {
                        label: 'Ordinario',
                        data: analisis.analisisPresupuestoDetallado.presupuestoPorAnio.map(p => p.ordinario),
                        backgroundColor: 'rgba(59, 130, 246, 0.8)',
                        borderColor: '#3b82f6',
                        borderWidth: 1,
                        borderRadius: 8,
                        stack: 'stack0'
                    },
                    {
                        label: 'SGR',
                        data: analisis.analisisPresupuestoDetallado.presupuestoPorAnio.map(p => p.sgr),
                        backgroundColor: 'rgba(245, 158, 11, 0.8)',
                        borderColor: '#f59e0b',
                        borderWidth: 1,
                        borderRadius: 8,
                        stack: 'stack0'
                    }
                ]
            };

            // Gráfico Presupuesto por Sector Detallado (Top 8)
            const topSectoresPresupuesto = analisis.analisisPresupuestoDetallado.presupuestoPorSector.slice(0, 8);
            this.chartPresupuestoPorSectorDetallado = {
                labels: topSectoresPresupuesto.map(s => this.truncarTexto(s.sector, 30)),
                datasets: [
                    {
                        label: 'Ordinario',
                        data: topSectoresPresupuesto.map(s => s.ordinario),
                        backgroundColor: 'rgba(59, 130, 246, 0.8)',
                        borderColor: '#3b82f6',
                        borderWidth: 1,
                        borderRadius: 8
                    },
                    {
                        label: 'SGR',
                        data: topSectoresPresupuesto.map(s => s.sgr),
                        backgroundColor: 'rgba(245, 158, 11, 0.8)',
                        borderColor: '#f59e0b',
                        borderWidth: 1,
                        borderRadius: 8
                    }
                ]
            };
        }
    }

    truncarTexto(texto: string, maxLength: number): string {
        if (!texto) return '';
        return texto.length > maxLength ? texto.substring(0, maxLength) + '...' : texto;
    }

    formatearMoneda(valor: number | string | undefined): string {
        if (valor === undefined || valor === null) return '$0';
        
        const numero = typeof valor === 'string' ? parseFloat(valor) : valor;
        if (isNaN(numero)) return '$0';
        
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(numero);
    }

    formatearPorcentaje(valor: number): string {
        return `${valor.toFixed(1)}%`;
    }

    obtenerColorEstado(estado: EstadoMeta | undefined): string {
        switch (estado) {
            case EstadoMeta.CUMPLIDA:
                return 'success';
            case EstadoMeta.EN_PROGRESO:
                return 'primary';
            case EstadoMeta.POR_CUMPLIR:
                return 'warn';
            case EstadoMeta.PENDIENTE:
                return 'accent';
            case EstadoMeta.SIN_DEFINIR:
                return 'secondary';
            default:
                return 'secondary';
        }
    }

    obtenerEtiquetaEstado(estado: EstadoMeta | undefined): string {
        switch (estado) {
            case EstadoMeta.CUMPLIDA:
                return 'Cumplida';
            case EstadoMeta.EN_PROGRESO:
                return 'En Progreso';
            case EstadoMeta.POR_CUMPLIR:
                return 'Por Cumplir';
            case EstadoMeta.PENDIENTE:
                return 'Pendiente';
            case EstadoMeta.SIN_DEFINIR:
                return 'Sin Definir';
            default:
                return 'N/A';
        }
    }

    obtenerColorSector(sector: string): string {
        const colores: { [key: string]: string } = {
            'EDUCACIÓN': 'primary',
            'SALUD': 'success',
            'INFRAESTRUCTURA': 'warning',
            'CULTURA': 'info',
            'DEPORTE': 'danger',
            'DESARROLLO SOCIAL': 'secondary',
            'MEDIO AMBIENTE': 'success',
            'SEGURIDAD': 'dark',
            'VIVIENDA': 'warning',
            'ECONÓMICO': 'primary',
            'AGRICULTURA': 'success',
            'TURISMO': 'info',
            'TECNOLOGÍA': 'primary',
            'TRANSPORTE': 'dark'
        };
        const sectorUpper = sector?.toUpperCase() || '';
        for (const key in colores) {
            if (sectorUpper.includes(key)) {
                return colores[key];
            }
        }
        return 'secondary';
    }

    obtenerIconoTendencia(tipo: 'positivo' | 'neutro' | 'negativo'): string {
        switch (tipo) {
            case 'positivo':
                return 'trending_up';
            case 'negativo':
                return 'trending_down';
            default:
                return 'trending_flat';
        }
    }

    obtenerColorTendencia(tipo: 'positivo' | 'neutro' | 'negativo'): string {
        switch (tipo) {
            case 'positivo':
                return 'success';
            case 'negativo':
                return 'warn';
            default:
                return 'primary';
        }
    }

    // Métodos para vista por años
    cambiarAnioSeleccionado(anio: number): void {
        this.anioSeleccionado = anio;
        this.currentPage = 1; // Resetear paginación
    }

    obtenerEstadoDelAnio(producto: PlanIndicativoProducto, anio: number): EstadoMeta {
        return producto.estadosPorAnio?.[anio as 2024 | 2025 | 2026 | 2027] || EstadoMeta.SIN_DEFINIR;
    }

    obtenerMetaDelAnio(producto: PlanIndicativoProducto, anio: number): number {
        switch (anio) {
            case 2024: return producto.meta2024 || producto.programacion2024 || 0;
            case 2025: return producto.meta2025 || producto.programacion2025 || 0;
            case 2026: return producto.meta2026 || producto.programacion2026 || 0;
            case 2027: return producto.meta2027 || producto.programacion2027 || 0;
            default: return 0;
        }
    }

    obtenerPresupuestoDelAnio(producto: PlanIndicativoProducto, anio: number): number {
        switch (anio) {
            case 2024: return producto.total2024 || 0;
            case 2025: return producto.total2025 || 0;
            case 2026: return producto.total2026 || 0;
            case 2027: return producto.total2027 || 0;
            default: return 0;
        }
    }

    obtenerAvanceDelAnio(producto: PlanIndicativoProducto, anio: number): number {
        return producto.avances?.[anio]?.valor || 0;
    }

    contarMetasPorEstado(estado: EstadoMeta, anio: number): number {
        return this.productosFiltrados.filter(p =>
            this.obtenerEstadoDelAnio(p, anio) === estado
        ).length;
    }

    cargarNuevoArchivo(): void {
        const slug = this.entityContext.currentEntity?.slug;
        if (slug) {
            this.router.navigate([`/${slug}/pdm`]);
        }
    }

    actualizarExcel(): void {
        // Navegar a la vista de carga para actualizar el Excel
        const slug = this.entityContext.currentEntity?.slug;
        if (slug) {
            this.router.navigate([`/${slug}/pdm`]);
        }
    }

    async descargarExcelDeBD(): Promise<void> {
        const slug = this.entityContext.currentEntity?.slug;
        if (!slug) {
            this.showToast('No se pudo identificar la entidad', 'error');
            return;
        }

        try {
            this.cargando = true;
            await this.pdmService.descargarExcelAlDispositivo(slug);
            this.showToast('Excel descargado exitosamente', 'success');
        } catch (err: any) {
            this.showToast('Error al descargar Excel: ' + this.extractErrorMsg(err), 'error');
        } finally {
            this.cargando = false;
        }
    }

    recargarDatosDesdeLocalStorage(): void {
        this.cargando = true;
        setTimeout(() => {
            // Forzar recarga desde localStorage
            const datosGuardados = localStorage.getItem('pdmData');
            if (datosGuardados) {
                const data = JSON.parse(datosGuardados);
                this.pdmService['pdmDataSubject'].next(data);
                this.showToast('Datos recargados desde caché local', 'success');
            } else {
                this.showToast('No hay datos en caché local', 'info');
            }
            this.cargando = false;
        }, 500);
    }

    async verificarExcelEnBD(): Promise<void> {
        const slug = this.entityContext.currentEntity?.slug;
        if (!slug) return;

        try {
            const info = await this.pdmService.obtenerInfoExcelBD(slug);
            this.excelEnBD = {
                existe: info.existe,
                nombre: info.nombre_archivo,
                tamano: info.tamanio,
                fecha: info.fecha_carga ? new Date(info.fecha_carga) : undefined
            };
        } catch {
            this.excelEnBD = { existe: false };
        }
    }

    async verificarYCargarDesdeBD(slug: string): Promise<void> {
        // Verificar si hay datos en localStorage
        const datosGuardados = localStorage.getItem('pdmData');

        if (!datosGuardados) {
            // No hay datos locales, intentar descargar desde BD
            try {
                const info = await this.pdmService.obtenerInfoExcelBD(slug);
                if (info.existe) {
                    this.showToast('Descargando datos desde base de datos...', 'info');
                    await this.pdmService.descargarYProcesarExcelDesdeBD(slug);
                    this.showToast('Datos cargados exitosamente', 'success');
                }
            } catch (err: any) {
                console.error('Error al verificar/cargar desde BD:', err);
                // Silencioso, simplemente no hay datos
            }
        }
    }

    formatearTamano(bytes: number): string {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    formatearFechaExcel(fecha?: Date): string {
        if (!fecha) return '';
        return new Date(fecha).toLocaleDateString('es-CO', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    exportarDatos(): void {
        if (!this.pdmData) {
            this.showToast('No hay datos para exportar', 'error');
            return;
        }

        try {
            // Crear un nuevo libro de Excel
            const wb = XLSX.utils.book_new();

            // Exportar productos con filtros aplicados
            const productosExport = this.productosFiltrados.map(p => ({
                'Código': p.codigoIndicadorProducto,
                'Indicador': p.indicadorProducto,
                'Línea Estratégica': p.lineaEstrategica,
                'Sector': p.sector,
                'Programa': p.programa,
                'Producto': p.producto,
                'Unidad Medida': p.unidadMedida,
                'Meta Cuatrienio': p.metaCuatrienio,
                'Programación 2024': p.programacion2024,
                'Programación 2025': p.programacion2025,
                'Programación 2026': p.programacion2026,
                'Programación 2027': p.programacion2027,
                'Total 2024': p.total2024,
                'Total 2025': p.total2025,
                'Total 2026': p.total2026,
                'Total 2027': p.total2027,
                'Estado': p.estado || 'SIN_DEFINIR',
                'Avance %': p.avance ? `${p.avance.toFixed(1)}%` : '0%',
                'Secretaría Asignada': p.secretariaAsignada || ''
            }));

            const wsProductos = XLSX.utils.json_to_sheet(productosExport);
            XLSX.utils.book_append_sheet(wb, wsProductos, 'Productos');

            // Exportar resumen por sector
            if (this.analisis && this.analisis.analisisPorSector) {
                const sectoresExport = this.analisis.analisisPorSector.map(s => ({
                    'Sector': s.sector,
                    'Total Metas': s.totalMetas,
                    'Metas Cumplidas': s.metasCumplidas,
                    '% Cumplimiento': `${s.porcentajeCumplimiento.toFixed(1)}%`,
                    'Presupuesto Total': s.presupuestoTotal
                }));

                const wsSectores = XLSX.utils.json_to_sheet(sectoresExport);
                XLSX.utils.book_append_sheet(wb, wsSectores, 'Resumen por Sector');
            }

            // Exportar resumen por línea estratégica
            if (this.analisis && this.analisis.analisisPorLineaEstrategica) {
                const lineasExport = this.analisis.analisisPorLineaEstrategica.map(l => ({
                    'Línea Estratégica': l.lineaEstrategica,
                    'Total Metas': l.totalMetas,
                    'Metas Cumplidas': l.metasCumplidas,
                    '% Cumplimiento': `${l.porcentajeCumplimiento.toFixed(1)}%`
                }));

                const wsLineas = XLSX.utils.json_to_sheet(lineasExport);
                XLSX.utils.book_append_sheet(wb, wsLineas, 'Resumen por Línea');
            }

            // Generar archivo
            const timestamp = new Date().toISOString().split('T')[0];
            const entitySlug = this.entityContext.currentEntity?.slug || 'Export';
            const fileName = `PDM_Analisis_${entitySlug}_${timestamp}.xlsx`;
            XLSX.writeFile(wb, fileName);

            this.showToast('Datos exportados exitosamente', 'success');
        } catch (error) {
            console.error('Error al exportar datos:', error);
            this.showToast('Error al exportar datos', 'error');
        }
    }

    // ============================================================================
    // MÉTODOS PARA EDICIÓN DE EXCEL
    // ============================================================================

    activarModoEdicion(): void {
        if (!this.authService.isAdminOrSuperAdmin()) {
            this.showToast('No tienes permisos para editar el Excel', 'error');
            return;
        }
        this.modoEdicion = true;
        this.productosModificados.clear();
        this.showToast('Modo edición activado. Haz clic en los campos para editarlos', 'info');
    }

    cancelarEdicion(): void {
        if (this.productosModificados.size > 0) {
            if (!confirm('Tienes cambios sin guardar. ¿Deseas cancelar?')) {
                return;
            }
        }
        this.modoEdicion = false;
        this.productosModificados.clear();
        // Recargar datos originales desde el servicio
        const slug = this.entityContext.currentEntity?.slug;
        if (slug) {
            this.pdmService.descargarYProcesarExcelDesdeBD(slug)
                .then(() => {
                    this.showToast('Datos recargados', 'info');
                })
                .catch(err => {
                    console.error('Error al recargar datos:', err);
                });
        }
    }

    marcarProductoModificado(codigoProducto: string): void {
        this.productosModificados.add(codigoProducto);
    }

    obtenerProgramacionEditable(producto: PlanIndicativoProducto, anio: number): number {
        switch (anio) {
            case 2024: return producto.programacion2024;
            case 2025: return producto.programacion2025;
            case 2026: return producto.programacion2026;
            case 2027: return producto.programacion2027;
            default: return 0;
        }
    }

    actualizarProgramacion(producto: PlanIndicativoProducto, anio: number, valor: number): void {
        const valorNumerico = Number(valor) || 0;
        switch (anio) {
            case 2024: producto.programacion2024 = valorNumerico; break;
            case 2025: producto.programacion2025 = valorNumerico; break;
            case 2026: producto.programacion2026 = valorNumerico; break;
            case 2027: producto.programacion2027 = valorNumerico; break;
        }
        this.marcarProductoModificado(producto.codigoIndicadorProducto);
    }

    abrirModalEdicion(producto: PlanIndicativoProducto): void {
        if (!this.modoEdicion) {
            this.showToast('Activa el modo edición primero', 'info');
            return;
        }
        // Hacer una copia para editar sin modificar el original hasta guardar
        this.productoEditando = JSON.parse(JSON.stringify(producto));
        this.mostrandoModalEdicion = true;
    }

    cerrarModalEdicion(): void {
        this.mostrandoModalEdicion = false;
        this.productoEditando = null;
    }

    guardarProductoEditado(): void {
        if (!this.productoEditando || !this.pdmData) return;

        // Encontrar el producto original en la lista
        const index = this.pdmData.planIndicativoProductos.findIndex(
            p => p.codigoIndicadorProducto === this.productoEditando!.codigoIndicadorProducto
        );

        if (index !== -1) {
            // Actualizar el producto original con los cambios
            this.pdmData.planIndicativoProductos[index] = { ...this.productoEditando };
            this.marcarProductoModificado(this.productoEditando.codigoIndicadorProducto);
            this.showToast('Producto actualizado (recuerda guardar los cambios)', 'success');
            this.cerrarModalEdicion();
            // Refrescar la vista
            this.aplicarFiltros();
        }
    }

    actualizarCampoProducto(campo: keyof PlanIndicativoProducto, valor: any): void {
        if (!this.productoEditando) return;
        (this.productoEditando as any)[campo] = valor;
    }

    async guardarCambiosExcel(): Promise<void> {
        if (!this.pdmData) {
            this.showToast('No hay datos para guardar', 'error');
            return;
        }

        if (this.productosModificados.size === 0) {
            this.showToast('No hay cambios para guardar', 'info');
            return;
        }

        const slug = this.entityContext.currentEntity?.slug;
        if (!slug) {
            this.showToast('No se pudo identificar la entidad', 'error');
            return;
        }

        if (!confirm(`¿Guardar ${this.productosModificados.size} cambio(s) en el Excel?`)) {
            return;
        }

        try {
            this.guardandoCambios = true;
            await this.pdmService.guardarCambiosEnExcel(this.pdmData, slug);
            this.showToast('Cambios guardados exitosamente en el Excel', 'success');
            this.modoEdicion = false;
            this.productosModificados.clear();
            await this.verificarExcelEnBD();
        } catch (err: any) {
            this.showToast('Error al guardar cambios: ' + this.extractErrorMsg(err), 'error');
        } finally {
            this.guardandoCambios = false;
        }
    }

    // Nuevas funciones para interactividad

    volverAlDashboard(): void {
        const slug = this.entityContext.currentEntity?.slug;
        if (slug) {
            this.router.navigate([`/${slug}/dashboard`]);
        } else {
            this.router.navigate(['/dashboard']);
        }
    }

    filtrarPorEstado(estado: string | undefined): void {
        if (estado === undefined) {
            this.filtros.estado = undefined;
        } else {
            this.filtros.estado = estado as EstadoMeta;
        }
        this.aplicarFiltros();
        // Scroll a la tabla
        const tableElement = document.querySelector('.table-responsive');
        if (tableElement) {
            tableElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    filtrarPorAnio(anio: number): void {
        this.filtros.anio = anio;
        this.aplicarFiltros();
        const tableElement = document.querySelector('.table-responsive');
        if (tableElement) tableElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    filtrarPorSecretaria(secretaria: string): void {
        this.filtros.secretaria = secretaria;
        this.aplicarFiltros();
        const tableElement = document.querySelector('.table-responsive');
        if (tableElement) tableElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    filtrarPorLinea(linea: string): void {
        this.filtros.lineaEstrategica = linea;
        this.aplicarFiltros();
        const tableElement = document.querySelector('.table-responsive');
        if (tableElement) tableElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    filtrarPorODS(codigoODS: string): void {
        this.filtros.ods = codigoODS;
        this.aplicarFiltros();
        const tableElement = document.querySelector('.table-responsive');
        if (tableElement) tableElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    /**
     * Abre un producto desde una notificación
     */
    abrirDesdeNotificacion(alert: AlertItem): void {
        // Marcar como leída
        if (!alert.read_at) {
            this.notificationsService.markRead(alert.id).subscribe();
        }

        // Parsear datos de la alerta
        let data: { codigo_indicador_producto?: string; actividad_id?: number } = {};
        try {
            data = alert.data ? JSON.parse(alert.data) : {};
        } catch (e) {
            console.error('Error parseando data de alerta:', e);
            return;
        }

        const { codigo_indicador_producto } = data;
        if (!codigo_indicador_producto) {
            console.warn('Alerta sin codigo_indicador_producto');
            return;
        }

        // Buscar el producto en la lista
        const producto = this.productos.find(p => p.codigoIndicadorProducto === codigo_indicador_producto);
        if (producto) {
            // Abrir el detalle del producto
            this.verDetalleProducto(producto);

            // Scroll al detalle
            setTimeout(() => {
                const detalleElement = document.querySelector('.detalle-producto');
                if (detalleElement) {
                    detalleElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }, 100);

            this.showToast(`Mostrando detalles de: ${producto.indicadorProducto}`, 'info');
        } else {
            this.showToast('Producto no encontrado o sin permisos de acceso', 'error');
        }
    }

    verDetalleProducto(producto: PlanIndicativoProducto): void {
        this.productoSeleccionado = producto;
        this.cargarActividades();
    }

    cerrarDetalle(): void {
        this.productoSeleccionado = null;
        this.actividadesProducto = [];
    }

    abrirDialogoAvanceDesdeDetalle(): void {
        // Evita null: conserva la referencia antes de cerrar el modal
        const prod = this.productoSeleccionado;
        if (prod) {
            if (!this.actividadesProducto || this.actividadesProducto.length === 0) {
                this.showToast('Primero debe crear una actividad para este producto.', 'error');
                return;
            }
            this.cerrarDetalle();
            this.abrirDialogoAvance(prod);
        }
    }

    // Gestión de actividades
    cargarActividades(): void {
        if (!this.productoSeleccionado) return;

        const slug = this.entityContext.currentEntity?.slug;
        if (!slug) return;

        this.cargandoActividades = true;
        this.pdmBackend.getActividades(slug, this.productoSeleccionado.codigoIndicadorProducto).subscribe({
            next: (response) => {
                const currentUser = this.authService.getCurrentUserValue();

                // Si es secretario, filtrar solo sus actividades
                if (currentUser?.role === 'secretario' && currentUser.secretaria) {
                    this.actividadesProducto = response.actividades.filter(
                        (act: any) => act.responsable === currentUser.secretaria
                    );
                } else {
                    this.actividadesProducto = response.actividades;
                }

                this.cargandoActividades = false;

                // Recalcular avance del producto seleccionado basado en valor ejecutado vs meta del año
                const añoActual = new Date().getFullYear();
                const metaAnio = this.obtenerMetaAnioProducto(this.productoSeleccionado!, añoActual);

                if (metaAnio === 0) {
                    this.productoSeleccionado!.avance = 0;
                } else {
                    // Sumar todos los valores ejecutados de las actividades del año actual
                    const totalEjecutado = this.actividadesProducto
                        .filter(a => a.anio === añoActual)
                        .reduce((sum, a) => sum + (a.valor_ejecutado || 0), 0);

                    // Calcular porcentaje de avance
                    const avance = (totalEjecutado / metaAnio) * 100;
                    this.productoSeleccionado!.avance = Math.min(Math.round(avance * 100) / 100, 100);
                }

                // Calcular estado de la meta
                this.productoSeleccionado!.estado = this.calcularEstadoMeta(
                    this.productoSeleccionado!,
                    this.actividadesProducto,
                    añoActual
                );

                // Sincronizar con la fila en la tabla
                const row = this.productos.find(p => p.codigoIndicadorProducto === this.productoSeleccionado!.codigoIndicadorProducto);
                if (row) {
                    row.avance = this.productoSeleccionado!.avance;
                    row.estado = this.productoSeleccionado!.estado;
                    this.actualizarTabla();
                }
            },
            error: (error) => {
                console.error('Error al cargar actividades:', error);
                this.cargandoActividades = false;
                const msg = this.extractErrorMsg(error);
                this.showToast(msg, 'error');
            }
        });
    }

    mostrarFormularioActividad(): void {
        this.actividadEditando = null;
        const añoActual = new Date().getFullYear();
        this.formActividad = {
            nombre: '',
            descripcion: '',
            responsable: '',
            fecha_inicio: '',
            fecha_fin: '',
            estado: 'pendiente',
            anio: añoActual,
            meta_ejecutar: 0,
            valor_ejecutado: 0
        };
        this.mostrandoFormActividad = true;
    }

    editarActividad(actividad: any): void {
        this.actividadEditando = actividad;
        this.formActividad = {
            nombre: actividad.nombre,
            descripcion: actividad.descripcion || '',
            responsable: actividad.responsable || '',
            fecha_inicio: actividad.fecha_inicio ? actividad.fecha_inicio.split('T')[0] : '',
            fecha_fin: actividad.fecha_fin ? actividad.fecha_fin.split('T')[0] : '',
            estado: actividad.estado,
            anio: actividad.anio || new Date().getFullYear(),
            meta_ejecutar: actividad.meta_ejecutar || 0,
            valor_ejecutado: actividad.valor_ejecutado || 0
        };
        this.mostrandoFormActividad = true;
    }

    cerrarFormularioActividad(): void {
        this.mostrandoFormActividad = false;
        this.actividadEditando = null;
    }

    guardarActividad(): void {
        if (!this.formActividad.nombre || !this.productoSeleccionado) return;

        const slug = this.entityContext.currentEntity?.slug;
        if (!slug) return;

        this.guardandoActividad = true;

        // Para nuevas actividades, valor ejecutado siempre es 0
        // Para edición, mantener el valor actual o 0
        const valorEjecutado = this.actividadEditando ? Number(this.formActividad.valor_ejecutado || 0) : 0;

        const payload = {
            ...this.formActividad,
            codigo_indicador_producto: this.productoSeleccionado.codigoIndicadorProducto,
            valor_ejecutado: valorEjecutado
        };

        const request = this.actividadEditando
            ? this.pdmBackend.updateActividad(slug, this.actividadEditando.id, payload)
            : this.pdmBackend.createActividad(slug, payload);

        request.subscribe({
            next: () => {
                this.showToast(
                    this.actividadEditando ? 'Actividad actualizada exitosamente' : 'Actividad creada exitosamente',
                    'success'
                );
                this.cerrarFormularioActividad();
                this.cargarActividades();
                this.guardandoActividad = false;
            },
            error: (error) => {
                console.error('Error al guardar actividad:', error);
                const msg = this.extractErrorMsg(error);
                this.showToast(msg, 'error');
                this.guardandoActividad = false;
            }
        });
    }

    eliminarActividad(actividad: any): void {
        if (!confirm(`¿Está seguro de eliminar la actividad "${actividad.nombre}"?`)) return;

        const slug = this.entityContext.currentEntity?.slug;
        if (!slug) return;

        this.pdmBackend.deleteActividad(slug, actividad.id).subscribe({
            next: () => {
                this.showToast('Actividad eliminada exitosamente', 'success');
                this.cargarActividades();
            },
            error: (error) => {
                console.error('Error al eliminar actividad:', error);
                const msg = this.extractErrorMsg(error);
                this.showToast(msg, 'error');
            }
        });
    }

    obtenerEtiquetaEstadoActividad(estado: string): string {
        const etiquetas: Record<string, string> = {
            'pendiente': 'Pendiente',
            'en_progreso': 'En Progreso',
            'completada': 'Completada',
            'cancelada': 'Cancelada'
        };
        return etiquetas[estado] || estado;
    }

    formatearFecha(fecha: string): string {
        if (!fecha) return '';
        const date = new Date(fecha);
        return date.toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' });
    }

    // Validaciones de formulario de actividad
    validFechaRango(): boolean {
        const inicio = this.formActividad.fecha_inicio;
        const fin = this.formActividad.fecha_fin;
        if (!inicio || !fin) return true; // si falta una, no invalida
        try {
            const d1 = new Date(inicio + 'T00:00:00');
            const d2 = new Date(fin + 'T00:00:00');
            return d1.getTime() <= d2.getTime();
        } catch {
            return true;
        }
    }

    fechasCompletas(): boolean {
        const inicio = this.formActividad.fecha_inicio;
        const fin = this.formActividad.fecha_fin;
        // ambas vacías o ambas con valor
        return (!inicio && !fin) || (!!inicio && !!fin);
    }

    validActividadForm(): boolean {
        const nombreOk = !!(this.formActividad.nombre && this.formActividad.nombre.trim());
        const fechasOk = this.validFechaRango() && this.fechasCompletas();
        const responsableOk = !!(this.formActividad.responsable && this.formActividad.responsable.trim());

        // Validar meta_ejecutar
        const metaEjecutar = Number(this.formActividad.meta_ejecutar ?? 0);
        const disponible = this.obtenerMetaDisponibleAnio(this.formActividad.anio);
        const metaOk = metaEjecutar > 0 && metaEjecutar <= disponible;

        return nombreOk && responsableOk && fechasOk && metaOk;
    }

    /**
     * Obtiene la meta programada del año seleccionado
     */
    obtenerMetaAnio(anio: number): number {
        if (!this.productoSeleccionado) return 0;
        switch (anio) {
            case 2024: return this.productoSeleccionado.programacion2024 || 0;
            case 2025: return this.productoSeleccionado.programacion2025 || 0;
            case 2026: return this.productoSeleccionado.programacion2026 || 0;
            case 2027: return this.productoSeleccionado.programacion2027 || 0;
            default: return 0;
        }
    }

    /**
     * Calcula la meta disponible del año (meta anual - suma de meta_ejecutar de actividades del año)
     */
    obtenerMetaDisponibleAnio(anio: number): number {
        const metaAnio = this.obtenerMetaAnio(anio);
        if (metaAnio <= 0) return 0;

        // Sumar meta_ejecutar de todas las actividades del año (excepto la que se está editando)
        const actividadesDelAnio = this.actividadesProducto.filter(a =>
            a.anio === anio && (!this.actividadEditando || a.id !== this.actividadEditando.id)
        );
        const totalAsignado = actividadesDelAnio.reduce((sum, a) => sum + (a.meta_ejecutar || 0), 0);

        return Math.max(0, metaAnio - totalAsignado);
    }

    /**
     * Verifica si el año tiene presupuesto > 0
     */
    anioTienePresupuesto(anio: number): boolean {
        if (!this.productoSeleccionado) return false;
        switch (anio) {
            case 2024: return (this.productoSeleccionado.total2024 || 0) > 0;
            case 2025: return (this.productoSeleccionado.total2025 || 0) > 0;
            case 2026: return (this.productoSeleccionado.total2026 || 0) > 0;
            case 2027: return (this.productoSeleccionado.total2027 || 0) > 0;
            default: return false;
        }
    }

    /**
     * Obtiene los años disponibles (con presupuesto > 0)
     */
    obtenerAniosDisponibles(): number[] {
        return [2024, 2025, 2026, 2027].filter(anio => this.anioTienePresupuesto(anio));
    }

    /**
     * Obtiene el presupuesto del año seleccionado
     */
    obtenerPresupuestoAnio(anio: number): number {
        if (!this.productoSeleccionado) return 0;
        switch (anio) {
            case 2024: return this.productoSeleccionado.total2024 || 0;
            case 2025: return this.productoSeleccionado.total2025 || 0;
            case 2026: return this.productoSeleccionado.total2026 || 0;
            case 2027: return this.productoSeleccionado.total2027 || 0;
            default: return 0;
        }
    }

    /**
     * Cambia la sección activa del dashboard
     */
    cambiarSeccion(seccion: 'resumen' | 'analisis' | 'presupuesto' | 'ods'): void {
        this.seccionActiva = seccion;
        // Scroll suave al inicio de la sección
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    /**
     * Cambia la vista dentro de Análisis
     */
    cambiarVistaAnalisis(vista: 'cumplimiento' | 'sectores' | 'presupuesto' | 'ods' | 'sgr' | 'indicadores' | 'secretarias' | 'lineas'): void {
        this.vistaAnalisis = vista;
    }

    /**
     * Calcula el avance promedio de todos los productos
     */
    calcularAvancePromedio(): number {
        if (!this.productos || this.productos.length === 0) return 0;
        
        const totalAvance = this.productos.reduce((sum, producto) => {
            const avance = this.obtenerAvanceDelAnio(producto, this.anioSeleccionado);
            return sum + (isNaN(avance) ? 0 : avance);
        }, 0);
        
        const promedio = totalAvance / this.productos.length;
        return Math.round(isNaN(promedio) ? 0 : promedio);
    }

    /**
     * Ver detalles del BPIN desde datos.gov.co (a través del proxy backend)
     */
    async verDetallesBPIN(bpin: string): Promise<void> {
        if (!bpin || bpin === 'N/A') {
            this.showToast('BPIN no disponible', 'info');
            return;
        }

        this.mostrandoModalBPIN = true;
        this.cargandoBPIN = true;
        this.bpinError = null;
        this.bpinData = null;

        try {
            // Usar el proxy del backend para evitar CORS
            const apiUrl = `${environment.apiUrl}/bpin/${bpin}`;
            
            const response = await firstValueFrom(
                this.http.get<BPINData | null>(apiUrl).pipe(
                    catchError(error => {
                        console.error('Error al consultar BPIN:', error);
                        throw error;
                    })
                )
            );

            if (response) {
                this.bpinData = response;
            } else {
                this.bpinError = 'No se encontró información para este BPIN en la base de datos de datos.gov.co';
                this.showToast('BPIN no encontrado en datos.gov.co', 'info');
            }
        } catch (error) {
            console.error('Error al consultar datos.gov.co:', error);
            this.bpinError = 'Error al consultar la información del BPIN. Por favor intente nuevamente.';
            this.showToast('Error al consultar datos del BPIN', 'error');
        } finally {
            this.cargandoBPIN = false;
        }
    }

    /**
     * Cerrar modal de BPIN
     */
    cerrarModalBPIN(): void {
        this.mostrandoModalBPIN = false;
        this.bpinData = null;
        this.bpinError = null;
    }

    /**
     * Calcular avance de una secretaría en un año específico
     */
    calcularAvanceSecretariaPorAnio(secretaria: string, anio: number): number {
        const productosSecretaria = this.productos.filter(p => p.secretariaAsignada === secretaria);
        if (productosSecretaria.length === 0) return 0;

        const totalAvance = productosSecretaria.reduce((sum, producto) => {
            const avance = this.obtenerAvanceDelAnio(producto, anio);
            return sum + (isNaN(avance) ? 0 : avance);
        }, 0);

        const promedio = totalAvance / productosSecretaria.length;
        return Math.round(isNaN(promedio) ? 0 : promedio);
    }

    /**
     * Calcular promedio de avance de una secretaría (todos los años)
     */
    calcularPromedioAvanceSecretaria(secretaria: string): number {
        const avances = [
            this.calcularAvanceSecretariaPorAnio(secretaria, 2024),
            this.calcularAvanceSecretariaPorAnio(secretaria, 2025),
            this.calcularAvanceSecretariaPorAnio(secretaria, 2026),
            this.calcularAvanceSecretariaPorAnio(secretaria, 2027)
        ];

        const total = avances.reduce((sum, avance) => sum + avance, 0);
        const promedio = total / avances.length;
        return Math.round(isNaN(promedio) ? 0 : promedio);
    }

    /**
     * Calcular avance de una línea estratégica en un año específico
     */
    calcularAvanceLineaPorAnio(linea: string, anio: number): number {
        const productosLinea = this.productos.filter(p => p.lineaEstrategica === linea);
        if (productosLinea.length === 0) return 0;

        const totalAvance = productosLinea.reduce((sum, producto) => {
            const avance = this.obtenerAvanceDelAnio(producto, anio);
            return sum + (isNaN(avance) ? 0 : avance);
        }, 0);

        const promedio = totalAvance / productosLinea.length;
        return Math.round(isNaN(promedio) ? 0 : promedio);
    }

    /**
     * Calcular promedio de avance de una línea estratégica (todos los años)
     */
    calcularPromedioAvanceLinea(linea: string): number {
        const avances = [
            this.calcularAvanceLineaPorAnio(linea, 2024),
            this.calcularAvanceLineaPorAnio(linea, 2025),
            this.calcularAvanceLineaPorAnio(linea, 2026),
            this.calcularAvanceLineaPorAnio(linea, 2027)
        ];

        const total = avances.reduce((sum, avance) => sum + avance, 0);
        const promedio = total / avances.length;
        return Math.round(isNaN(promedio) ? 0 : promedio);
    }

    /**
     * Contar productos por secretaría
     */
    contarProductosPorSecretaria(secretaria: string): number {
        return this.productos.filter(p => p.secretariaAsignada === secretaria).length;
    }

    /**
     * Contar productos por línea estratégica
     */
    contarProductosPorLinea(linea: string): number {
        return this.productos.filter(p => p.lineaEstrategica === linea).length;
    }
}
