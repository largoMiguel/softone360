import { Component, inject, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Location } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { PdmService } from '../../services/pdm.service';
import { PdmEjecucionService } from '../../services/pdm-ejecucion.service';
import { PdmContratosService } from '../../services/pdm-contratos.service';
import { AlertsService, Alert } from '../../services/alerts.service';
import { AuthService } from '../../services/auth.service';
import { NavigationStateService } from '../../services/navigation-state.service';
import { environment } from '../../../environments/environment';
import {
    PDMData,
    ResumenProducto,
    EstadisticasPDM,
    ProductoPlanIndicativo,
    LineaEstrategica,
    IndicadorResultado,
    IniciativaSGR,
    ActividadPDM,
    EvidenciaActividad,
    ResumenActividadesPorAnio,
    AvanceProducto,
    ProyectoBPIN
} from '../../models/pdm.model';
import { PDMEjecucionResumen } from '../../models/pdm-ejecucion.model';
import { ResumenContratos } from '../../models/pdm-contratos.model';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { forkJoin, of, Subscription, Subject } from 'rxjs';
import { catchError, tap, takeUntil } from 'rxjs/operators';

// Registrar los componentes de Chart.js
Chart.register(...registerables, ChartDataLabels);

@Component({
    selector: 'app-pdm',
    standalone: true,
    imports: [CommonModule, FormsModule, ReactiveFormsModule],
    templateUrl: './pdm.html',
    styleUrls: ['./pdm.scss']
})
export class PdmComponent implements OnInit, OnDestroy {
    private pdmService = inject(PdmService);
    private pdmEjecucionService = inject(PdmEjecucionService);
    private pdmContratosService = inject(PdmContratosService);
    private fb = inject(FormBuilder);
    private alertsService = inject(AlertsService);
    private authService = inject(AuthService);
    private location = inject(Location);
    private navState = inject(NavigationStateService);
    private route = inject(ActivatedRoute);

    // Listener para navegación
    private popstateListener: (() => void) | null = null;

    // Estados
    cargando = false;
    cargandoDesdeBackend = false;
    archivoExcelCargado = false;
    datosEnBackend = false;
    vistaActual: 'dashboard' | 'productos' | 'detalle' | 'analytics' | 'analisis-producto' = 'dashboard';

    // Datos
    pdmData: PDMData | null = null;
    resumenProductos: ResumenProducto[] = [];
    estadisticas: EstadisticasPDM | null = null;
    productoSeleccionado: ResumenProducto | null = null;

    // Actividades
    anioSeleccionado = 2024;
    resumenAnioActual: ResumenActividadesPorAnio | null = null;
    avanceProducto: AvanceProducto | null = null;
    
    // Modales
    mostrarModalActividad = false;
    actividadEnEdicion: ActividadPDM | null = null;
    
    // Formularios
    formularioActividad!: FormGroup;

    // Secretarios para dropdown
    secretarios: any[] = [];
    cargandoSecretarios = false;
    
    // Secretarías agrupadas con responsables
    secretariasAgrupadas: any[] = [];

    // ✅ OPTIMIZACIÓN: Variables cacheadas para evitar recálculos en templates
    productosFiltradosCache: ResumenProducto[] = [];
    comparativaPresupuestalCache: { anio: number; pdm: number; ptoDefinitivo: number; pagos: number; porcentaje: number }[] = [];
    estadisticasPorEstadoCache = { pendiente: 0, en_progreso: 0, completado: 0, por_ejecutar: 0, total: 0 };
    metaEjecutadaTotalCache: number = 0;
    puedeCrearEvidenciaCache: boolean = false;
    puedeCargarArchivosEjecucionCache: boolean = false;

    // ✅ OPTIMIZACIÓN: Gestión de subscripciones para evitar memory leaks
    private subscriptions = new Subscription();
    
    // ✅ OPTIMIZACIÓN: Subject para cancelar generación de informes previos
    private cancelarInformeAnterior = new Subject<void>();

    // Filtros
    filtroLinea = '';
    filtroSector = '';
    filtroODS = '';
    filtroTipoAcumulacion = '';
    filtroEstado = '';
    filtroBusqueda = '';
    filtroAnio: number = new Date().getFullYear(); // Año actual por defecto (0 = todos los años)
    filtroSecretaria = ''; // ✅ Nuevo filtro por secretaría
    
    // Años disponibles (incluyendo opción 'Todos' = 0)
    aniosDisponibles: number[] = [0, 2024, 2025, 2026, 2027];
    
    // ✅ OPTIMIZACIÓN: Debounce timer para búsqueda
    private debounceTimer: any = null;
    private readonly DEBOUNCE_DELAY = 300; // ms
    
    // ✅ OPTIMIZACIÓN: Cache para reducir llamadas al backend
    private ultimaActualizacionCache: number = 0;
    private readonly TIEMPO_CACHE_MS = 30000; // 30 segundos
    
    // Modal BPIN
    mostrarModalBPIN = false;
    proyectoBPIN: any = null;
    cargandoBPIN = false;

    // Ejecución Presupuestal
    ejecucionPresupuestal: PDMEjecucionResumen | null = null;
    cargandoEjecucion = false;
    archivoEjecucionCargado = false;
    mostrarModalEjecucion = false;
    anioEjecucionSeleccionado = 2025;
    archivoEjecucionTemporal: File | null = null;

    // ✅ NUEVO: Contratos RPS
    contratosRPS: ResumenContratos | null = null;
    cargandoContratos = false;
    archivoContratosCargado = false;
    mostrarModalContratos = false;
    anioContratosSeleccionado = 2025;
    archivoContratosTemporal: File | null = null;

    // ✅ NUEVO: Indicador de carga de actividades desde backend
    cargandoActividadesBackend = false;
    guardandoEvidencia = false;  // 🔄 Loading para guardar/actualizar evidencia

    // Modal Análisis Producto
    mostrarModalAnalisisProducto = false;
    chartProgresoAnual: any = null;
    chartMetaEjecutado: any = null;
    chartPresupuestoAnual: any = null;

    // Analytics
    dashboardAnalytics: any = null;
    analisisPorSecretaria: any[] = []; // ✅ NUEVO: Análisis por secretaría

    // ✅ NUEVO: Modal y filtros de informe
    mostrarModalFiltrosInforme = false;
    filtrosInformeDisponibles: any = null;
    cargandoFiltrosInforme = false;
    filtrosInforme = {
        anio: new Date().getFullYear() as number | 0, // 0 = todos los años
        secretaria_ids: [] as number[],
        fecha_inicio: '',
        fecha_fin: '',
        estados: [] as string[],
        formato: 'pdf',
        usar_ia: false  // Mejora: resúmenes con IA
    };
    generandoInforme = false;

    // ✅ NUEVO: Modal Plan de Acción
    mostrarModalPlanAccion = false;
    planAccionAnio: number = new Date().getFullYear();
    planAccionSecretariaIds: number[] = [];  // Array para múltiples secretarías
    exportandoPlanAccion = false;

    // Charts
    chartEstados: any = null;
    chartSectores: any = null;
    chartMetasEjecutadas: any = null;
    chartPresupuestoPorAnio: any = null;
    chartODS: any = null;
    chartSectoresDetalle: any = null;
    chartSecretarias: any = null; // ✅ NUEVO

    // Getters para datos filtrados
    get lineasEstrategicas(): string[] {
        if (!this.pdmData) return [];
        return [...new Set(this.pdmData.lineas_estrategicas.map(l => l.linea_estrategica))];
    }
    get sectores(): string[] {
        if (!this.pdmData) return [];
        return [...new Set(this.pdmData.productos_plan_indicativo.map(p => p.sector_mga))].filter(s => s);
    }
    get odsDisponibles(): string[] {
        if (!this.pdmData) return [];
        return [...new Set(this.pdmData.productos_plan_indicativo.map(p => p.ods))].filter(s => s).sort();
    }
    get tiposAcumulacionDisponibles(): string[] {
        if (!this.pdmData) return [];
        return [...new Set(this.pdmData.productos_plan_indicativo.map(p => p.tipo_acumulacion))].filter(s => s).sort();
    }

    get productosFiltrados(): ResumenProducto[] {
        let productos = this.resumenProductos;

        // ✅ FILTRADO EN BACKEND: Ya viene filtrado por rol desde el servidor
        // No hay que aplicar filtro de secretario aquí - el backend lo maneja
        // Los secretarios ya solo recibirán sus productos asignados

        // Si filtroAnio es 0, usar año actual para dashboard principal
        const anioParaFiltro = this.filtroAnio === 0 ? new Date().getFullYear() : this.filtroAnio;

        // Filtrar productos con meta > 0 para el año seleccionado
        productos = productos.filter(p => {
            const meta = this.getMetaAnio(p, anioParaFiltro);
            return meta > 0;
        });

        // Filtros adicionales
        if (this.filtroLinea) {
            productos = productos.filter(p => p.linea_estrategica === this.filtroLinea);
        }

        if (this.filtroSector) {
            productos = productos.filter(p => p.sector === this.filtroSector);
        }

        if (this.filtroODS) {
            productos = productos.filter(p => p.ods === this.filtroODS);
        }

        if (this.filtroTipoAcumulacion) {
            productos = productos.filter(p => p.tipo_acumulacion === this.filtroTipoAcumulacion);
        }

        if (this.filtroEstado) {
            productos = productos.filter(p => 
                this.getEstadoProductoAnio(p, anioParaFiltro) === this.filtroEstado
            );
        }

        // ✅ Nuevo: Filtro por secretaría
        if (this.filtroSecretaria) {
            const secretariaId = parseInt(this.filtroSecretaria, 10);
            productos = productos.filter(p => {
                // El backend ahora retorna responsable_secretaria_id
                const productoSecretariaId = p.responsable_secretaria_id || p.responsable_id;
                return productoSecretariaId && parseInt(String(productoSecretariaId), 10) === secretariaId;
            });
        }

        if (this.filtroBusqueda) {
            const busqueda = this.filtroBusqueda.toLowerCase();
            productos = productos.filter(p =>
                p.producto.toLowerCase().includes(busqueda) ||
                p.codigo.toLowerCase().includes(busqueda) ||
                p.programa_mga?.toLowerCase().includes(busqueda) ||
                p.bpin?.toLowerCase().includes(busqueda)
            );
        }

        return productos;
    }

    /**
     * ✅ OPTIMIZADO: Obtener productos filtrados por estado (para mostrar en dashboard)
     * Cachea resultados para evitar recálculos en cada ciclo de detección de cambios
     */
    getProductosFiltrados(): ResumenProducto[] {
        if (!this.resumenProductos) {
            this.productosFiltradosCache = [];
            return this.productosFiltradosCache;
        }
        
        let productos = [...this.resumenProductos];
        
        // Si filtroAnio es 0, usar año actual para dashboard principal
        const anioParaFiltro = this.filtroAnio === 0 ? new Date().getFullYear() : this.filtroAnio;
        
        // Filtrar productos con meta > 0 para el año seleccionado
        productos = productos.filter(p => {
            const meta = this.getMetaAnio(p, anioParaFiltro);
            return meta > 0;
        });

        // Filtros adicionales
        if (this.filtroLinea) {
            productos = productos.filter(p => p.linea_estrategica === this.filtroLinea);
        }

        if (this.filtroSector) {
            productos = productos.filter(p => p.sector === this.filtroSector);
        }

        if (this.filtroODS) {
            productos = productos.filter(p => p.ods === this.filtroODS);
        }

        if (this.filtroTipoAcumulacion) {
            productos = productos.filter(p => p.tipo_acumulacion === this.filtroTipoAcumulacion);
        }
        
        // Filtrar por estado
        if (this.filtroEstado) {
            productos = productos.filter(p => 
                this.getEstadoProductoAnio(p, anioParaFiltro) === this.filtroEstado
            );
        }
        
        // Filtro por secretaría
        if (this.filtroSecretaria) {
            const secretariaId = parseInt(this.filtroSecretaria, 10);
            productos = productos.filter(p => {
                const productoSecretariaId = p.responsable_secretaria_id || p.responsable_id;
                return productoSecretariaId && parseInt(String(productoSecretariaId), 10) === secretariaId;
            });
        }

        if (this.filtroBusqueda) {
            const busqueda = this.filtroBusqueda.toLowerCase();
            productos = productos.filter(p =>
                p.producto.toLowerCase().includes(busqueda) ||
                p.codigo.toLowerCase().includes(busqueda) ||
                p.programa_mga?.toLowerCase().includes(busqueda) ||
                p.bpin?.toLowerCase().includes(busqueda)
            );
        }
        
        // Ordenar por código de menor a mayor
        productos.sort((a, b) => {
            const codeA = parseInt(a.codigo?.replace(/\D/g, '') || '0', 10);
            const codeB = parseInt(b.codigo?.replace(/\D/g, '') || '0', 10);
            return codeA - codeB;
        });
        
        this.productosFiltradosCache = productos;
        return this.productosFiltradosCache;
    }

    /**
     * ✅ NUEVO: Ordenar productos por código de menor a mayor
     */
    private ordenarProductosPorCodigo(productos: ResumenProducto[]): ResumenProducto[] {
        return productos.sort((a, b) => {
            const codeA = parseInt(a.codigo?.replace(/\D/g, '') || '0', 10);
            const codeB = parseInt(b.codigo?.replace(/\D/g, '') || '0', 10);
            return codeA - codeB;
        });
    }

    /**
     * ✅ OPTIMIZACIÓN: Actualiza todos los caches cuando cambian los filtros
     */
    private actualizarCachesFiltros(): void {
        this.getProductosFiltrados();
        this.getEstadisticasPorEstado();
    }

    /**
     * ✅ Cambia el año del filtro y actualiza los caches
     */
    cambiarAnioFiltro(anio: number): void {
        this.filtroAnio = Number(anio);
        this.actualizarCachesFiltros();
        
        // Limpiar contratos RPS cuando cambia el año
        this.contratosRPS = null;
    }

    /**
     * ✅ Limpia el filtro de estado y actualiza los caches
     */
    limpiarFiltroEstado(): void {
        this.filtroEstado = '';
        this.actualizarCachesFiltros();
    }

    ngOnInit(): void {
        // ✅ Cachear permisos del usuario al inicio
        const currentUser = this.authService.getCurrentUserValue();
        this.puedeCrearEvidenciaCache = currentUser?.role === 'admin' || 
                                        currentUser?.role === 'superadmin' || 
                                        currentUser?.role === 'secretario';
        this.puedeCargarArchivosEjecucionCache = currentUser?.role === 'admin' || 
                                                  currentUser?.role === 'superadmin';
        
        // Esperar a que el entity slug esté disponible antes de verificar datos
        this.verificarDatosBackendConEspera();
        this.cargarSecretarios();
        
        // Verificar si hay que abrir un producto desde una alerta
        this.verificarProductoDesdeAlerta();
        
        // Escuchar query params para acciones desde el sidebar
        this.route.queryParams.subscribe(params => {
            if (params['action'] === 'cargar-ejecucion') {
                // Esperar a que los datos estén cargados
                setTimeout(() => {
                    if (this.archivoExcelCargado) {
                        this.abrirModalEjecucion();
                    }
                }, 500);
            } else if (params['action'] === 'cargar-archivo') {
                setTimeout(() => {
                    if (this.archivoExcelCargado) {
                        this.cargarNuevoArchivo();
                    }
                }, 500);
            }
        });
        
        // Interceptar el botón de retroceso del navegador
        this.popstateListener = () => {
            // Si estamos en una vista que no sea dashboard, usar nuestro método volver()
            if (this.vistaActual !== 'dashboard') {
                this.volver();
            }
        };
        
        window.addEventListener('popstate', this.popstateListener);
    }

    /**
     * Verifica datos del backend con espera para entity slug y autenticación
     * ✅ OPTIMIZADO: 15 intentos máximo (1.5 segundos) para dar tiempo al token
     */
    private verificarDatosBackendConEspera(): void {
        let intentos = 0;
        const MAX_INTENTOS = 15; // Aumentado para dar más tiempo al token
        const verificar = () => {
            intentos++;
            const slug = this.pdmService.getEntitySlug();
            const token = localStorage.getItem('token'); // Verificar también que el token esté disponible
            
            if (slug && token) {
                // Agregar un delay adicional de 200ms para asegurar que el token esté completamente configurado
                setTimeout(() => {
                    this.verificarDatosBackend();
                }, 200);
            } else if (intentos < MAX_INTENTOS) {
                setTimeout(verificar, 100);
            } else {
                console.warn('⚠️ Timeout: Entity slug o token no disponible después de 1.5s');
                console.warn('🔍 Slug disponible:', !!slug, 'Token disponible:', !!token);
                this.cargandoDesdeBackend = false;
            }
        };
        
        verificar();
    }

    /**
     * Verifica si hay que abrir un producto desde una alerta
     */
    private verificarProductoDesdeAlerta(): void {
        // ✅ IMPORTANTE: El backend debe enviar en la alerta:
        // Para actividades: { actividad_id: number, producto_codigo: string }
        // Para productos: { producto_codigo: string }
        
        // Usar servicio de navegación en lugar de sessionStorage
        const productoCodigo = this.navState.getPdmOpenProducto();
        const actividadId = this.navState.getPdmOpenActividad();
        
        if (productoCodigo || actividadId) {
            if (productoCodigo) {
                this.navState.clearPdmOpenProducto();
            }
            if (actividadId) {
                this.navState.clearPdmOpenActividad();
            }
            
            // Esperar a que se carguen los datos
            const interval = setInterval(() => {
                if (this.resumenProductos.length > 0 && !this.cargandoDesdeBackend) {
                    clearInterval(interval);
                    
                    // Si hay actividadId, encontrar el producto de esa actividad
                    if (actividadId) {
                        // Iterar por productos para encontrar la actividad
                        for (const producto of this.resumenProductos) {
                            const actividades = this.pdmService.obtenerActividadesPorProducto(producto.codigo);
                            const actividad = actividades.find(a => String(a.id) === String(actividadId));
                            if (actividad) {
                                // Abrir el producto y marcar la actividad para desplazarse
                                this.navegarA('detalle', producto);
                                // Guardar ID de actividad para que el componente de detalle la destaque
                                this.navState.setPdmScrollToActividad(actividadId);
                                break;
                            }
                        }
                    } 
                    // Si solo hay código de producto
                    else if (productoCodigo) {
                        const producto = this.resumenProductos.find(p => p.codigo === productoCodigo);
                        if (producto) {
                            this.navegarA('detalle', producto);
                        }
                    }
                }
            }, 500);
            
            // ✅ OPTIMIZADO: Timeout de seguridad de 5 segundos
            setTimeout(() => clearInterval(interval), 5000);
        }
    }

    /**
     * Limpieza al destruir el componente
     */
    ngOnDestroy(): void {
        // ✅ Limpiar debounce timer
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
        
        // ✅ Cancelar cualquier generación de informe en curso
        this.cancelarInformeAnterior.next();
        this.cancelarInformeAnterior.complete();
        
        // ✅ Unsubscribe de todas las subscripciones
        this.subscriptions.unsubscribe();
        
        this.destruirGraficos();
        
        // Remover el listener de popstate
        if (this.popstateListener) {
            window.removeEventListener('popstate', this.popstateListener);
        }
    }

    /**
     * Verifica si hay datos en el backend y los carga automáticamente
     */
    private verificarDatosBackend(): void {
        this.cargandoDesdeBackend = true;

        this.pdmService.verificarEstadoPDM().subscribe({
            next: (estado) => {
                if (estado.tiene_datos) {
                    this.datosEnBackend = true;
                    this.cargarDatosDesdeBackend();
                } else {
                    this.cargandoDesdeBackend = false;
                }
            },
            error: (error) => {
                console.warn('⚠️ Error al verificar estado backend:', error);
                this.cargandoDesdeBackend = false;
                // Continuar normalmente, no mostrar error al usuario
            }
        });
    }

    /**
     * Carga los datos desde el backend
     */
    private cargarDatosDesdeBackend(): void {
        this.pdmService.cargarDatosPDMDesdeBackend().subscribe({
            next: (data) => {
                this.pdmData = data;
                this.resumenProductos = this.ordenarProductosPorCodigo(
                    this.pdmService.generarResumenProductos(data)
                );
                this.estadisticas = this.pdmService.calcularEstadisticas(data);
                this.archivoExcelCargado = true;
                this.vistaActual = 'dashboard';
                this.cargandoDesdeBackend = false;
                this.ultimaActualizacionCache = Date.now(); // ✅ Marcar caché como válido desde la carga inicial
                
                // ✅ Actualizar caches de UI
                this.getProductosFiltrados();
                this.getEstadisticasPorEstado();
                
                // Generar analytics iniciales
                this.generarAnalytics();
                
                // ✅ OPTIMIZACIÓN: Las actividades ya vienen del backend, solo actualizar caches
                this.actualizarCachesFiltros();
                
                this.showToast(`Datos cargados desde el servidor. ${this.resumenProductos.length} productos disponibles.`, 'success');
            },
            error: (error) => {
                console.error('❌ Error al cargar datos desde backend:', error);
                this.cargandoDesdeBackend = false;
                this.showToast('Error al cargar datos desde el servidor. Intente cargar el archivo Excel.', 'error');
            }
        });
    }

    /**
     * Maneja la selección de archivo Excel/CSV de ejecución presupuestal
     */
    onEjecucionFileSelected(event: Event) {
        const input = event.target as HTMLInputElement;
        if (!input.files || input.files.length === 0) {
            this.archivoEjecucionTemporal = null;
            return;
        }

        const file = input.files[0];
        
        // Validar extensión
        const extension = file.name.split('.').pop()?.toLowerCase();
        if (extension !== 'xlsx' && extension !== 'xls' && extension !== 'csv') {
            this.showToast('Por favor seleccione un archivo válido (.xlsx, .xls o .csv)', 'error');
            this.archivoEjecucionTemporal = null;
            return;
        }

        this.archivoEjecucionTemporal = file;
    }

    /**
     * Abre el modal para seleccionar año y archivo de ejecución
     */
    abrirModalEjecucion() {
        this.mostrarModalEjecucion = true;
        this.anioEjecucionSeleccionado = new Date().getFullYear();
        this.archivoEjecucionTemporal = null;
    }

    /**
     * Cierra el modal de ejecución
     */
    cerrarModalEjecucion() {
        this.mostrarModalEjecucion = false;
        this.archivoEjecucionTemporal = null;
    }

    /**
     * Confirma y procesa la carga de ejecución presupuestal
     */
    confirmarCargaEjecucion() {
        // Guardar referencia antes de que el modal limpie la variable
        const file = this.archivoEjecucionTemporal;
        if (!file) {
            this.showToast('Por favor seleccione un archivo', 'error');
            return;
        }
        // Cerrar modal (esto limpia archivoEjecucionTemporal)
        this.cerrarModalEjecucion();
        // Iniciar carga con la referencia guardada
        this.cargarArchivoEjecucion(file);
    }

    /**
     * Carga el archivo de ejecución presupuestal al backend
     */
    private cargarArchivoEjecucion(file: File) {
        if (!file) {
            console.error('⚠️ cargarArchivoEjecucion invocado sin archivo');
            return;
        }
        // Usar bandera específica (evitar confundir con carga del Excel principal)
        this.cargandoEjecucion = true;
        const mensaje = `Cargando ejecución presupuestal para el año ${this.anioEjecucionSeleccionado}...`;
        console.log('📊', mensaje, `FILE(${file.name}, size=${file.size})`);
        
        this.pdmEjecucionService.uploadEjecucion(file, this.anioEjecucionSeleccionado).subscribe({
            next: (response) => {
                this.cargandoEjecucion = false;
                this.archivoEjecucionCargado = true;
                
                const msg = `Ejecución ${this.anioEjecucionSeleccionado} cargada: ${response.registros_insertados} registros. Los datos anteriores han sido actualizados.`;
                this.showToast(msg, 'success');
                
                // Si hay errores, mostrarlos en consola
                if (response.errores && response.errores.length > 0) {
                    console.warn('⚠️ Errores al procesar ejecución:', response.errores);
                }
                
                // Si hay un producto seleccionado, recargar su ejecución
                if (this.productoSeleccionado) {
                    this.cargarEjecucionPresupuestal(this.productoSeleccionado.codigo);
                }
                // Limpiar referencia del archivo después de procesar
                this.archivoEjecucionTemporal = null;
            },
            error: (error) => {
                console.error('❌ Error al cargar ejecución:', error);
                this.cargandoEjecucion = false;
                this.archivoEjecucionTemporal = null;
                const mensaje = error.error?.detail || 'Error al cargar el archivo de ejecución';
                this.showToast(mensaje, 'error');
            }
        });
    }

    // ========== GESTIÓN DE CONTRATOS RPS ==========

    /**
     * ✅ NUEVO: Maneja la selección de archivo Excel/CSV de contratos RPS
     */
    onContratosFileSelected(event: Event) {
        const input = event.target as HTMLInputElement;
        if (!input.files || input.files.length === 0) {
            this.archivoContratosTemporal = null;
            return;
        }

        const file = input.files[0];
        
        // Validar extensión
        const extension = file.name.split('.').pop()?.toLowerCase();
        if (extension !== 'xlsx' && extension !== 'xls' && extension !== 'csv') {
            this.showToast('Por favor seleccione un archivo válido (.xlsx, .xls o .csv)', 'error');
            this.archivoContratosTemporal = null;
            return;
        }

        this.archivoContratosTemporal = file;
    }

    /**
     * ✅ NUEVO: Abre el modal para seleccionar año y archivo de contratos
     */
    abrirModalContratos() {
        this.mostrarModalContratos = true;
        this.anioContratosSeleccionado = new Date().getFullYear();
        this.archivoContratosTemporal = null;
    }

    /**
     * ✅ NUEVO: Cierra el modal de contratos
     */
    cerrarModalContratos() {
        this.mostrarModalContratos = false;
        this.archivoContratosTemporal = null;
    }

    /**
     * ✅ NUEVO: Confirma y procesa la carga de contratos RPS
     */
    confirmarCargaContratos() {
        // Guardar referencia antes de que el modal limpie la variable
        const file = this.archivoContratosTemporal;
        if (!file) {
            this.showToast('Por favor seleccione un archivo', 'error');
            return;
        }
        // Cerrar modal (esto limpia archivoContratosTemporal)
        this.cerrarModalContratos();
        // Iniciar carga con la referencia guardada
        this.cargarArchivoContratos(file);
    }

    /**
     * ✅ NUEVO: Carga el archivo de contratos RPS al backend (procesa EN MEMORIA)
     */
    private cargarArchivoContratos(file: File) {
        if (!file) {
            console.error('⚠️ cargarArchivoContratos invocado sin archivo');
            return;
        }
        
        this.cargandoContratos = true;
        const mensaje = `Procesando contratos RPS para el año ${this.anioContratosSeleccionado}...`;
        console.log('📊', mensaje, `FILE(${file.name}, size=${file.size})`);
        
        // Enviar código del producto seleccionado para filtrar
        const codigoProducto = this.productoSeleccionado?.codigo;
        
        this.pdmContratosService.uploadContratos(file, codigoProducto, this.anioContratosSeleccionado).subscribe({
            next: (response) => {
                this.cargandoContratos = false;
                this.archivoContratosCargado = true;
                
                // ✅ Mostrar datos procesados directamente
                this.contratosRPS = {
                    contratos: response.contratos,
                    total_contratado: response.contratos.reduce((sum, c) => sum + c.valor, 0),
                    cantidad_contratos: response.contratos_agrupados,
                    anio: this.anioContratosSeleccionado
                };
                
                const msg = `✅ Procesados ${response.registros_procesados} registros → ${response.contratos_agrupados} contratos agrupados (Total: ${this.formatearMoneda(this.contratosRPS.total_contratado)})`;
                this.showToast(msg, 'success');
                
                console.log('📊 Contratos procesados:', this.contratosRPS);
                
                // Si hay errores, mostrarlos en consola
                if (response.errores && response.errores.length > 0) {
                    console.warn('⚠️ Errores al procesar contratos:', response.errores);
                }
                
                // Limpiar referencia del archivo después de procesar
                this.archivoContratosTemporal = null;
            },
            error: (error) => {
                console.error('❌ Error al procesar contratos:', error);
                this.cargandoContratos = false;
                this.archivoContratosTemporal = null;
                const mensaje = error.error?.detail || 'Error al procesar el archivo de contratos';
                this.showToast(mensaje, 'error');
            }
        });
    }

    /**
     * Maneja la selección de archivo Excel
     */
    onFileSelected(event: Event) {
        const input = event.target as HTMLInputElement;
        if (!input.files || input.files.length === 0) return;

        const file = input.files[0];
        
        // Validar extensión
        const extension = file.name.split('.').pop()?.toLowerCase();
        if (extension !== 'xlsx' && extension !== 'xls') {
            this.showToast('Por favor seleccione un archivo Excel válido (.xlsx o .xls)', 'error');
            return;
        }

        this.cargarArchivoExcel(file);
    }

    /**
     * Carga y procesa el archivo Excel
     */
    private cargarArchivoExcel(file: File) {
        this.cargando = true;
        this.pdmService.procesarArchivoExcel(file).subscribe({
            next: (data) => {
                try {
                    this.pdmData = data;
                    this.resumenProductos = this.ordenarProductosPorCodigo(
                        this.pdmService.generarResumenProductos(data)
                    );
                    this.estadisticas = this.pdmService.calcularEstadisticas(data);
                    this.archivoExcelCargado = true;
                    this.vistaActual = 'dashboard';
                    
                    // Generar analytics iniciales
                    this.generarAnalytics();
                    
                    // Guardar en backend (no bloqueante)
                    this.guardarEnBackend(data);
                    
                    this.cargando = false;
                    this.showToast(`Archivo Excel cargado exitosamente. ${this.resumenProductos.length} productos encontrados.`, 'success');
                } catch (processingError) {
                    console.error('❌ Error en el procesamiento:', processingError);
                    this.cargando = false;
                    this.showToast(`Error al procesar datos: ${processingError}`, 'error');
                }
            },
            error: (error) => {
                console.error('❌ Error al procesar Excel:', error);
                console.error('Error completo:', JSON.stringify(error, null, 2));
                this.cargando = false;
                this.showToast(`Error al procesar el archivo Excel: ${error.message || 'Error desconocido'}`, 'error');
            }
        });
    }

    /**
     * Guarda los datos del PDM en el backend
     */
    private guardarEnBackend(data: PDMData): void {
        this.pdmService.guardarDatosPDMEnBackend(data).subscribe({
            next: (respuesta) => {
                this.datosEnBackend = true;
                this.showToast('Datos guardados en el servidor correctamente.', 'success');
            },
            error: (error) => {
                console.warn('⚠️ Error al guardar en backend (datos aún disponibles localmente):', error);
                // No mostrar error crítico al usuario, los datos están en memoria
            }
        });
    }

    /**
     * Navega entre vistas y recarga datos según la vista
     */
    navegarA(vista: 'dashboard' | 'productos' | 'detalle' | 'analisis-producto', producto?: ResumenProducto) {
        const vistaAnterior = this.vistaActual;
        
        this.vistaActual = vista;
        
        // Agregar entrada al historial del navegador para poder retroceder correctamente
        if (vistaAnterior !== vista) {
            window.history.pushState(
                { vista, productoCodigo: producto?.codigo },
                '',
                window.location.href
            );
        }
        
        // ✅ NUEVO: Recargar datos según la vista
        if (vista === 'dashboard') {
            this.recargarDashboard();
        } else if (vista === 'productos') {
            this.recargarProductos();
        } else if (vista === 'detalle' && producto) {
            this.productoSeleccionado = producto;
            // Inicializar vista de actividades para el año actual
            const anioActual = new Date().getFullYear();
            this.anioSeleccionado = [2024, 2025, 2026, 2027].includes(anioActual) ? anioActual : 2024;
            // ✅ CORREGIDO: Usar caché en navegación, no forzar backend
            this.actualizarResumenActividades(false);
            // Cargar ejecución presupuestal si está disponible
            this.cargarEjecucionPresupuestal(producto.codigo);
            // ✅ NUEVO: Cargar contratos RPS si están disponibles
            this.cargarContratosRPS(producto.codigo);
            // ✅ Actualizar cache de comparativa presupuestal
            this.getComparativaPresupuestal();
            // ✅ Actualizar cache de meta ejecutada total
            this.obtenerMetaEjecutadaTotal();
        } else if (vista === 'analisis-producto') {
            this.recargarAnalisisProducto();
        }
    }

    /**
     * Vuelve a la vista anterior
     */
    volver() {
        if (this.vistaActual === 'analisis-producto') {
            // Asegurar liberar recursos de charts para evitar bloqueos
            this.destruirGraficosAnalisisProducto();
            this.vistaActual = 'detalle';
        } else if (this.vistaActual === 'detalle') {
            this.vistaActual = 'productos';
            this.productoSeleccionado = null;
            this.ejecucionPresupuestal = null;
        } else if (this.vistaActual === 'productos') {
            this.vistaActual = 'dashboard';
            // ✅ Actualizar caches al volver al dashboard
            this.actualizarCachesFiltros();
        } else if (this.vistaActual === 'analytics') {
            this.vistaActual = 'dashboard';
            // ✅ Actualizar caches al volver al dashboard
            this.actualizarCachesFiltros();
        }
    }

    /**
     * Abre el modal de filtros para generar informe
     */
    generarInforme(): void {
        // Abrir modal de filtros
        this.mostrarModalFiltrosInforme = true;
        
        // Cargar filtros disponibles
        this.cargarFiltrosInforme();
    }

    /**
     * Carga los filtros disponibles para el informe desde el backend
     */
    cargarFiltrosInforme(): void {
        this.cargandoFiltrosInforme = true;
        
        this.pdmService.obtenerFiltrosInforme().subscribe({
            next: (filtros) => {
                this.filtrosInformeDisponibles = filtros;
                this.cargandoFiltrosInforme = false;
                
                console.log('✅ Filtros obtenidos:', filtros);
                console.log('   Es admin:', filtros.es_admin);
                console.log('   Secretarías disponibles:', filtros.secretarias?.length || 0);
                
                // Si es secretario (no admin), preseleccionar su secretaría
                if (!filtros.es_admin && filtros.secretarias && filtros.secretarias.length > 0) {
                    this.filtrosInforme.secretaria_ids = filtros.secretarias.map((s: any) => s.id);
                    console.log('   → Secretaría preseleccionada:', this.filtrosInforme.secretaria_ids);
                }
            },
            error: (error) => {
                console.error('❌ Error al cargar filtros:', error);
                this.cargandoFiltrosInforme = false;
                alert('Error al cargar filtros. Por favor intente nuevamente.');
            }
        });
    }

    /**
     * Cierra el modal de filtros de informe
     */
    cerrarModalFiltrosInforme(): void {
        this.mostrarModalFiltrosInforme = false;
        // Resetear filtros
        this.filtrosInforme = {
            anio: new Date().getFullYear() as number | 0,
            secretaria_ids: [],
            fecha_inicio: '',
            fecha_fin: '',
            estados: [],
            formato: 'pdf',  // Formato por defecto
            usar_ia: false
        };
    }

    /**
     * Toggle de secretaría en el filtro (para selección múltiple)
     */
    toggleSecretariaInforme(secretariaId: number): void {
        const index = this.filtrosInforme.secretaria_ids.indexOf(secretariaId);
        if (index > -1) {
            this.filtrosInforme.secretaria_ids.splice(index, 1);
        } else {
            this.filtrosInforme.secretaria_ids.push(secretariaId);
        }
    }

    /**
     * Toggle de estado en el filtro
     */
    toggleEstadoInforme(estado: string): void {
        const index = this.filtrosInforme.estados.indexOf(estado);
        if (index > -1) {
            this.filtrosInforme.estados.splice(index, 1);
        } else {
            this.filtrosInforme.estados.push(estado);
        }
    }

    /**
     * Verifica si una secretaría está seleccionada
     */
    isSecretariaSeleccionada(secretariaId: number): boolean {
        return this.filtrosInforme.secretaria_ids.includes(secretariaId);
    }

    /**
     * Verifica si un estado está seleccionado
     */
    isEstadoSeleccionado(estado: string): boolean {
        return this.filtrosInforme.estados.includes(estado);
    }

    /**
     * Obtiene el nombre de una secretaría por su ID
     */
    getNombreSecretaria(secretariaId: number): string {
        if (!this.filtrosInformeDisponibles || !this.filtrosInformeDisponibles.secretarias) {
            return '';
        }
        const secretaria = this.filtrosInformeDisponibles.secretarias.find((s: any) => s.id === secretariaId);
        return secretaria ? secretaria.nombre : '';
    }

    /**
     * ✨ NUEVO: Genera el informe con los filtros seleccionados (ASÍNCRONO).
     * El usuario recibirá una notificación cuando esté listo.
     */
    confirmarGenerarInforme(): void {
        // Prevenir múltiples clics
        if (this.generandoInforme) {
            console.warn('⚠️ Ya hay un informe generándose, espere por favor...');
            return;
        }
        
        console.log('📊 Solicitando generación de informe con filtros:', this.filtrosInforme);
        
        this.generandoInforme = true;
        
        // Preparar filtros (eliminar arrays vacíos y valores vacíos)
        const filtros: any = {};
        
        if (this.filtrosInforme.secretaria_ids.length > 0) {
            filtros.secretaria_ids = this.filtrosInforme.secretaria_ids;
        }
        if (this.filtrosInforme.fecha_inicio) {
            filtros.fecha_inicio = this.filtrosInforme.fecha_inicio;
        }
        if (this.filtrosInforme.fecha_fin) {
            filtros.fecha_fin = this.filtrosInforme.fecha_fin;
        }
        if (this.filtrosInforme.estados.length > 0) {
            filtros.estados = this.filtrosInforme.estados;
        }
        if (this.filtrosInforme.formato) {
            filtros.formato = this.filtrosInforme.formato;
        }
        if (this.filtrosInforme.usar_ia) {
            filtros.usar_ia = this.filtrosInforme.usar_ia;
        }
        
        const formatoNombre = this.filtrosInforme.formato === 'pdf' ? 'PDF' : 
                             this.filtrosInforme.formato === 'docx' ? 'Word' : 'Excel';
        
        const anioTexto = this.filtrosInforme.anio === 0 ? 'todos los años' : `año ${this.filtrosInforme.anio}`;
        
        // ✨ NUEVO: Solicitar generación asíncrona
        this.pdmService.solicitarInformeAsync(this.filtrosInforme.anio, filtros)
            .subscribe({
            next: (response) => {
                console.log(`✅ Informe ${formatoNombre} solicitado correctamente:`, response);
                
                this.generandoInforme = false;
                this.cerrarModalFiltrosInforme();
                
                // Mostrar mensaje de éxito con instrucciones
                alert(`✅ INFORME ${formatoNombre.toUpperCase()} SOLICITADO\n\n` +
                      `Año: ${anioTexto}\n\n` +
                      `Tu informe se está generando en segundo plano.\n\n` +
                      `Recibirás una notificación 🔔 cuando esté listo para descargar.\n\n` +
                      `Puedes seguir trabajando mientras tanto.`);
            },
            error: (error) => {
                console.error('❌ Error solicitando informe:', error);
                this.generandoInforme = false;
                
                let mensaje = `❌ ERROR AL SOLICITAR INFORME\n\nAño solicitado: ${anioTexto}\n\n`;
                
                if (error.status === 404) {
                    mensaje += 'No hay productos para los filtros especificados.';
                } else if (error.status === 403) {
                    mensaje += 'No tiene permisos para generar este informe.';
                } else if (error.status === 400) {
                    mensaje += error.error?.detail || 'Parámetros inválidos.';
                } else if (error.status === 500) {
                    mensaje += 'Error interno del servidor.';
                    if (error.error?.detail) {
                        mensaje += `\n\nDetalle: ${error.error.detail}`;
                    }
                } else if (error.error?.detail) {
                    mensaje += error.error.detail;
                } else {
                    mensaje += 'Ocurrió un error inesperado.';
                }
                
                alert(mensaje);
            }
        });
    }

    /**
     * Carga la ejecución presupuestal para un producto PDM
     * Filtra por el año seleccionado en actividades
     */
    private cargarEjecucionPresupuestal(codigoProducto: string, anio?: number): void {
        this.cargandoEjecucion = true;
        this.ejecucionPresupuestal = null;

        // Usar el año seleccionado en actividades si no se proporciona uno específico
        const anioFiltro = anio || this.anioSeleccionado;

        this.pdmEjecucionService.getEjecucionPorProducto(codigoProducto, anioFiltro).subscribe({
            next: (ejecucion) => {
                this.ejecucionPresupuestal = ejecucion;
                this.cargandoEjecucion = false;
                // ✅ Actualizar cache de comparativa presupuestal
                this.getComparativaPresupuestal();
            },
            error: (error) => {
                // No mostrar error 404, es normal que no haya ejecución para todos los productos
                if (error.status !== 404) {
                    console.warn('⚠️ Error al cargar ejecución presupuestal:', error);
                }
                this.ejecucionPresupuestal = null;
                this.cargandoEjecucion = false;
                // ✅ Actualizar cache incluso si no hay ejecución
                this.getComparativaPresupuestal();
            }
        });
    }

    /**
     * ✅ NUEVO: Carga los contratos RPS para un producto PDM
     * Filtra por el año seleccionado en actividades
     */
    private cargarContratosRPS(codigoProducto: string, anio?: number): void {
        this.cargandoContratos = true;
        this.contratosRPS = null;

        // Usar el año seleccionado en actividades si no se proporciona uno específico
        const anioFiltro = anio || this.anioSeleccionado;

        this.pdmContratosService.getContratosPorProducto(codigoProducto, anioFiltro).subscribe({
            next: (contratos) => {
                this.contratosRPS = contratos;
                this.cargandoContratos = false;
                console.log(`✅ Contratos RPS cargados: ${contratos.cantidad_contratos} contratos, total: ${contratos.total_contratado}`);
            },
            error: (error) => {
                // No mostrar error 404, es normal que no haya contratos para todos los productos
                if (error.status !== 404) {
                    console.warn('⚠️ Error al cargar contratos RPS:', error);
                }
                this.contratosRPS = null;
                this.cargandoContratos = false;
            }
        });
    }

    /**
     * Obtiene la comparativa presupuestal entre PDM y Ejecución por año
     * Solo muestra el año actualmente seleccionado en el tab de actividades
     * ✅ OPTIMIZADO: Cachea resultados para evitar recálculos
     */
    getComparativaPresupuestal(): { anio: number; pdm: number; ptoDefinitivo: number; pagos: number; porcentaje: number }[] {
        if (!this.productoSeleccionado) {
            this.comparativaPresupuestalCache = [];
            return this.comparativaPresupuestalCache;
        }

        // Si no hay ejecución cargada (404 para ese año) mostrar ejecución = 0
        const tieneEjecucion = !!this.ejecucionPresupuestal;
        const ptoDefinitivo = tieneEjecucion ? Number(this.ejecucionPresupuestal!.totales.pto_definitivo || 0) : 0;
        const pagos = tieneEjecucion ? Number(this.ejecucionPresupuestal!.totales.pagos || 0) : 0;

        // Mostrar SOLO el año seleccionado
        const anio = this.anioSeleccionado;
        const pdm = this.productoSeleccionado![`total_${anio}` as keyof ResumenProducto] as number || 0;
        // El porcentaje se calcula: PAGOS / PTO. DEFINITIVO (lo ejecutado del presupuesto real asignado)
        const porcentaje = ptoDefinitivo > 0 ? (pagos / ptoDefinitivo) * 100 : 0;

        this.comparativaPresupuestalCache = [{ anio, pdm, ptoDefinitivo, pagos, porcentaje }];
        return this.comparativaPresupuestalCache;
    }    /**
     * Recarga el dashboard con datos frescos del backend (con caché)
     */
    private recargarDashboard(): void {
        if (!this.datosEnBackend) {
            return;
        }
        
        // ✅ Si los datos son recientes, solo regenerar analytics sin recargar
        const ahora = Date.now();
        if (ahora - this.ultimaActualizacionCache < this.TIEMPO_CACHE_MS && this.pdmData) {
            this.generarAnalytics();
            return;
        }
        
        this.cargandoDesdeBackend = true;
        this.pdmService.cargarDatosPDMDesdeBackend().subscribe({
            next: (data) => {
                this.pdmData = data;
                this.resumenProductos = this.ordenarProductosPorCodigo(
                    this.pdmService.generarResumenProductos(data)
                );
                this.estadisticas = this.pdmService.calcularEstadisticas(data);
                this.productoSeleccionado = null;
                this.generarAnalytics();
                
                // ✅ OPTIMIZACIÓN: Actividades ya vienen del backend
                this.actualizarCachesFiltros();
                this.cargandoDesdeBackend = false;
                this.ultimaActualizacionCache = Date.now();
                this.showToast('Datos actualizados desde el servidor', 'success');
            },
            error: (error) => {
                console.warn('⚠️ Error al recargar dashboard:', error);
                this.cargandoDesdeBackend = false;
                this.showToast('Error al actualizar datos', 'error');
            }
        });
    }

    /**
     * Recarga la lista de productos con datos frescos del backend (con caché)
     * IMPORTANTE: Ahora también sincroniza actividades de todos los productos
     */
    private recargarProductos(): void {
        if (!this.datosEnBackend) {
            this.productoSeleccionado = null;
            return;
        }
        
        // ✅ Si los datos son recientes, solo limpiar selección sin recargar
        const ahora = Date.now();
        if (ahora - this.ultimaActualizacionCache < this.TIEMPO_CACHE_MS && this.pdmData) {
            this.productoSeleccionado = null;
            return;
        }
        
        this.cargandoDesdeBackend = true;
        this.pdmService.cargarDatosPDMDesdeBackend().subscribe({
            next: (data) => {
                this.pdmData = data;
                this.resumenProductos = this.ordenarProductosPorCodigo(
                    this.pdmService.generarResumenProductos(data)
                );
                this.estadisticas = this.pdmService.calcularEstadisticas(data);
                this.productoSeleccionado = null;
                this.limpiarFiltros();
                
                // ✅ OPTIMIZACIÓN: Actividades ya vienen del backend
                this.resumenProductos = this.pdmService.generarResumenProductos(data);
                this.estadisticas = this.pdmService.calcularEstadisticas(data);
                this.generarAnalytics();
                this.actualizarCachesFiltros();
                this.ultimaActualizacionCache = Date.now();
                this.cargandoDesdeBackend = false;
            },
            error: (error) => {
                console.warn('⚠️ Error al recargar productos:', error);
                this.cargandoDesdeBackend = false;
            }
        });
    }
    
    /**
     * Invalida el caché forzando una recarga en la próxima navegación
     */
    private invalidarCache(): void {
        this.ultimaActualizacionCache = 0;
    }

    /**
     * Carga actividades de todos los productos en paralelo
     * Sincroniza automáticamente en el servicio
     * Retorna una Promise que se resuelve cuando todas las actividades están sincronizadas
     */
    private cargarActividadesTodosProductos(): Promise<void> {
        return new Promise((resolve) => {
            if (!this.resumenProductos.length) {
                resolve();
                return;
            }
            // Crear peticiones en paralelo para todos los productos
            const peticiones = this.resumenProductos.map(producto =>
                this.pdmService.cargarActividadesDesdeBackend(producto.codigo)
                    .pipe(
                        tap(actividades => {
                            // Sincronizar en el servicio
                            this.pdmService.sincronizarActividadesProducto(producto.codigo, actividades);
                        }),
                        catchError(error => {
                            console.warn(`  ⚠️ ${producto.codigo}: Error -`, error.status);
                            return of([]); // Continuar con productos siguientes
                        })
                    )
            );
            
            // Ejecutar todas en paralelo
            forkJoin(peticiones).subscribe({
                next: () => {
                    resolve();
                },
                error: (error) => {
                    console.error('❌ Error en forkJoin de actividades:', error);
                    resolve(); // Resolver de todas formas
                }
            });
        });
    }

    /**
     * Recarga el análisis del producto actual
     * ✅ OPTIMIZADO: Sin timeout innecesario
     */
    private recargarAnalisisProducto(): void {
        if (!this.productoSeleccionado) {
            console.warn('⚠️ No hay producto seleccionado');
            return;
        }
        
        this.crearGraficosAnalisisProducto();
    }

    /**
     * Recarga los datos según los filtros aplicados
     * Incluye sincronización de actividades
     */
    private recargarSegunFiltros(): void {
        if (!this.datosEnBackend) {
            return;
        }
        
        this.cargandoDesdeBackend = true;
        this.pdmService.cargarDatosPDMDesdeBackend().subscribe({
            next: (data) => {
                this.pdmData = data;
                this.resumenProductos = this.ordenarProductosPorCodigo(
                    this.pdmService.generarResumenProductos(data)
                );
                this.estadisticas = this.pdmService.calcularEstadisticas(data);
                
                // ✅ Cargar actividades de productos que coincidan con filtros
                const productosFiltrados = this.productosFiltrados;
                if (productosFiltrados.length > 0) {
                    const peticiones = productosFiltrados.map(producto =>
                        this.pdmService.cargarActividadesDesdeBackend(producto.codigo)
                            .pipe(
                                tap(actividades => {
                                    this.pdmService.sincronizarActividadesProducto(producto.codigo, actividades);
                                }),
                                catchError(error => of([]))
                            )
                    );
                    
                    forkJoin(peticiones).subscribe(() => {
                        this.cargandoDesdeBackend = false;
                    });
                } else {
                    this.cargandoDesdeBackend = false;
                }
            },
            error: (error) => {
                console.warn('⚠️ Error al recargar según filtros:', error);
                this.cargandoDesdeBackend = false;
            }
        });
    }

    /**
     * ✅ OPTIMIZACIÓN: Limpia los filtros
     * SOLO filtra en memoria, NO recarga del backend
     */
    limpiarFiltros() {
        this.filtroLinea = '';
        this.filtroSector = '';
        this.filtroODS = '';
        this.filtroTipoAcumulacion = '';
        this.filtroEstado = '';
        this.filtroBusqueda = '';
        this.filtroSecretaria = ''; // ✅ Agregar filtro de secretaría
        // ✅ NO llamar a recargarSegunFiltros() - solo filtrar en memoria
    }

    /**
     * ✅ OPTIMIZACIÓN: Se ejecuta cuando cambia cualquier filtro
     * Solo filtra en memoria, SIN hacer petición al backend
     */
    /**
     * ✅ Se ejecuta cuando cambia cualquier filtro
     * Actualiza el cache de productos filtrados
     */
    onCambioFiltro() {
        this.actualizarCachesFiltros();
    }

    /**
     * ✅ OPTIMIZACIÓN: Se ejecuta cuando cambia el filtro de línea estratégica
     * Solo filtra en memoria, SIN hacer petición al backend
     */
    onCambioFiltroLinea() {
        this.actualizarCachesFiltros();
    }

    /**
     * ✅ OPTIMIZACIÓN: Se ejecuta cuando cambia el filtro de sector
     * Solo filtra en memoria, SIN hacer petición al backend
     */
    onCambioFiltroSector() {
        this.actualizarCachesFiltros();
    }

    /**
     * ✅ OPTIMIZACIÓN: Se ejecuta cuando cambia el filtro de búsqueda
     * Implementa DEBOUNCE para evitar múltiples peticiones mientras se escribe
     * Solo filtra en memoria después del debounce
     */
    onCambioFiltroBusqueda() {
        // Cancelar debounce anterior
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
        
        // ✅ Establecer nuevo debounce
        this.debounceTimer = setTimeout(() => {
            this.actualizarCachesFiltros();
            this.debounceTimer = null;
        }, this.DEBOUNCE_DELAY);
    }

    /**
     * ✅ Filtra productos por estado (Pendiente)
     * Se ejecuta al hacer click en el card de "Pendientes"
     */
    filtrarPorEstadoPendiente() {
        // ✅ CAMBIO: No navegar a 'productos', solo cambiar el filtro en la vista actual
        if (this.vistaActual === 'dashboard') {
            // En dashboard, filtrar y mostrar tabla en la misma vista
            this.filtroEstado = this.filtroEstado === 'PENDIENTE' ? '' : 'PENDIENTE';
        } else {
            // En vista productos, solo cambiar filtro sin navegar
            this.filtroEstado = this.filtroEstado === 'PENDIENTE' ? '' : 'PENDIENTE';
        }
        this.getProductosFiltrados(); // ✅ Actualizar cache
    }

    /**
     * ✅ Filtra productos por estado (En Progreso)
     * Se ejecuta al hacer click en el card de "En Progreso"
     */
    filtrarPorEstadoEnProgreso() {
        // ✅ CAMBIO: No navegar a 'productos', solo cambiar el filtro en la vista actual
        if (this.vistaActual === 'dashboard') {
            this.filtroEstado = this.filtroEstado === 'EN_PROGRESO' ? '' : 'EN_PROGRESO';
        } else {
            this.filtroEstado = this.filtroEstado === 'EN_PROGRESO' ? '' : 'EN_PROGRESO';
        }
        this.getProductosFiltrados(); // ✅ Actualizar cache
    }

    /**
     * ✅ Filtra productos por estado (Completado)
     * Se ejecuta al hacer click en el card de "Completados"
     */
    filtrarPorEstadoCompletado() {
        // ✅ CAMBIO: No navegar a 'productos', solo cambiar el filtro en la vista actual
        if (this.vistaActual === 'dashboard') {
            this.filtroEstado = this.filtroEstado === 'COMPLETADO' ? '' : 'COMPLETADO';
        } else {
            this.filtroEstado = this.filtroEstado === 'COMPLETADO' ? '' : 'COMPLETADO';
        }
        this.getProductosFiltrados(); // ✅ Actualizar cache
    }

    /**
     * ✅ Filtra productos por estado (Por Ejecutar)
     * Se ejecuta al hacer click en el card de "Por Ejecutar"
     */
    filtrarPorEstadoPorEjecutar() {
        // ✅ CAMBIO: No navegar a 'productos', solo cambiar el filtro en la vista actual
        if (this.vistaActual === 'dashboard') {
            this.filtroEstado = this.filtroEstado === 'POR_EJECUTAR' ? '' : 'POR_EJECUTAR';
        } else {
            this.filtroEstado = this.filtroEstado === 'POR_EJECUTAR' ? '' : 'POR_EJECUTAR';
        }
        this.getProductosFiltrados(); // ✅ Actualizar cache
    }

    /**
     * Formatea valores monetarios
     */
    formatearMoneda(valor: string | number): string {
        if (!valor) return '$0';
        const numero = typeof valor === 'string' ? parseFloat(valor) : valor;
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(numero);
    }

    /**
     * Formatea números con separadores de miles
     */
    formatearNumero(valor: number): string {
        return new Intl.NumberFormat('es-CO').format(valor);
    }

    /**
     * Obtiene el color de la barra de progreso según el porcentaje
     */
    getColorProgreso(porcentaje: number): string {
        if (porcentaje < 25) return 'bg-danger';
        if (porcentaje < 50) return 'bg-warning';
        if (porcentaje < 75) return 'bg-info';
        return 'bg-success';
    }

    /**
     * Muestra un toast de notificación
     */
    private showToast(message: string, type: 'success' | 'error' | 'info' = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast align-items-center text-white bg-${type === 'error' ? 'danger' : type === 'success' ? 'success' : 'primary'} border-0`;
        toast.setAttribute('role', 'alert');
        toast.setAttribute('aria-live', 'assertive');
        toast.setAttribute('aria-atomic', 'true');
        toast.innerHTML = `
            <div class="d-flex">
                <div class="toast-body">${message}</div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
            </div>
        `;

        const container = document.getElementById('toast-container') || (() => {
            const c = document.createElement('div');
            c.id = 'toast-container';
            c.className = 'toast-container position-fixed top-0 end-0 p-3';
            c.style.zIndex = '9999';
            document.body.appendChild(c);
            return c;
        })();

        container.appendChild(toast);
        const bsToast = new (window as any).bootstrap.Toast(toast);
        bsToast.show();
        toast.addEventListener('hidden.bs.toast', () => toast.remove());
    }

    /**
     * Reinicia el componente para cargar un nuevo archivo
     */
    cargarNuevoArchivo() {
        this.pdmData = null;
        this.resumenProductos = [];
        this.estadisticas = null;
        this.productoSeleccionado = null;
        this.archivoExcelCargado = false;
        this.vistaActual = 'dashboard';
        this.limpiarFiltros();
    }

    // ==================== GESTIÓN DE ACTIVIDADES ====================

    /**
     * Actualiza el resumen de actividades al seleccionar un producto o cambiar de año
     * ✅ CORREGIDO: Primero actualiza con datos locales, luego sincroniza con backend
     */
    private actualizarResumenActividades(cargarDesdeBackend: boolean = false) {
        if (!this.productoSeleccionado) return;
        
        // ✅ IMPORTANTE: Actualizar PRIMERO con datos locales para que la UI no quede en blanco
        // Esto asegura que el botón de "Nueva Actividad" se muestre aunque esté actualizándose
        this.resumenAnioActual = this.pdmService.obtenerResumenActividadesPorAnio(
            this.productoSeleccionado,
            this.anioSeleccionado
        );
        this.avanceProducto = this.pdmService.calcularAvanceProducto(this.productoSeleccionado);

        // ✅ Recalcular y actualizar el porcentaje_ejecucion del producto seleccionado y en la lista
        const nuevoAvance = this.pdmService.calcularAvanceRealProducto(
            this.productoSeleccionado.codigo,
            this.productoSeleccionado.detalle_completo as any
        );
        console.log('🔄 actualizarResumenActividades - Nuevo avance calculado:', nuevoAvance.toFixed(2) + '%');
        this.productoSeleccionado.porcentaje_ejecucion = Math.min(100, Number(nuevoAvance.toFixed(2)));
        const idx = this.resumenProductos.findIndex(p => p.codigo === this.productoSeleccionado!.codigo);
        if (idx !== -1) {
            this.resumenProductos[idx] = { ...this.resumenProductos[idx], porcentaje_ejecucion: this.productoSeleccionado.porcentaje_ejecucion };
        }
        // ✅ LUEGO: SIEMPRE intentar cargar desde backend si se solicita
        // No importa si datosEnBackend es false, intentamos cargar de todas formas
        if (cargarDesdeBackend) {
            this.cargarActividadesDesdeBackend();
        }
    }

    /**
     * Carga las actividades desde el backend para el producto seleccionado
     * ✅ Con indicador visual de carga y timeouts optimizados
     */
    private cargarActividadesDesdeBackend() {
        if (!this.productoSeleccionado) return;

        // ✅ MOSTRAR indicador de carga
        this.cargandoActividadesBackend = true;

        // Verificar que el entity slug esté disponible
        const slug = this.pdmService.getEntitySlug();
        if (!slug) {
            console.warn('⚠️ Entity slug no disponible, esperando inicialización...');
            let intentos = 0;
            const MAX_INTENTOS = 5; // Reducido de 30 a 5 intentos (500ms total)
            const reintentar = () => {
                intentos++;
                const slugActual = this.pdmService.getEntitySlug();
                if (slugActual) {
                    console.log('✅ Entity slug disponible, cargando actividades');
                    this.cargarActividadesDesdeBackend();
                } else if (intentos < MAX_INTENTOS) {
                    setTimeout(reintentar, 100);
                } else {
                    console.error('❌ Timeout: Entity slug no disponible después de 500ms');
                    this.cargandoActividadesBackend = false;
                }
            };
            setTimeout(reintentar, 100);
            return;
        }

        this.pdmService.cargarActividadesDesdeBackend(this.productoSeleccionado.codigo).subscribe({
            next: (actividades) => {
                // CRÍTICO: Sincronizar las actividades cargadas con el BehaviorSubject del servicio
                // Esto reemplaza las actividades del producto actual con las del backend
                this.pdmService.sincronizarActividadesProducto(this.productoSeleccionado!.codigo, actividades);
                
                
                // Actualizar la vista con las actividades sincronizadas
                this.resumenAnioActual = this.pdmService.obtenerResumenActividadesPorAnio(
                    this.productoSeleccionado!,
                    this.anioSeleccionado
                );
                this.avanceProducto = this.pdmService.calcularAvanceProducto(this.productoSeleccionado!);

                // ✅ Recalcular y actualizar porcentaje_ejecucion tras sincronización del backend
                const nuevoAvance = this.pdmService.calcularAvanceRealProducto(
                    this.productoSeleccionado!.codigo,
                    this.productoSeleccionado!.detalle_completo as any
                );
                this.productoSeleccionado!.porcentaje_ejecucion = Math.min(100, Number(nuevoAvance.toFixed(2)));
                const idx = this.resumenProductos.findIndex(p => p.codigo === this.productoSeleccionado!.codigo);
                if (idx !== -1) {
                    this.resumenProductos[idx] = { ...this.resumenProductos[idx], porcentaje_ejecucion: this.productoSeleccionado!.porcentaje_ejecucion };
                }
                // ✅ OCULTAR indicador de carga
                this.cargandoActividadesBackend = false;
            },
            error: (error) => {
                console.warn('⚠️ Error al cargar actividades desde backend:', error);
                if (error.status === 403) {
                    console.error('❌ Error 403: Verifica que tengas permisos para esta entidad');
                }
                // ✅ OCULTAR indicador de carga incluso en error
                this.cargandoActividadesBackend = false;
                // Continuar con actividades locales si las hay
                this.actualizarResumenActividades(false);
            }
        });
    }

    /**
     * Cambia el año seleccionado y recarga datos del backend
     */
    seleccionarAnio(anio: number) {
        this.anioSeleccionado = anio;
        
        // ✅ MEJORADO: Recargar actividades y actualizar estadísticas
        this.actualizarResumenActividades(true);
        
        // ✅ Actualizar cache de comparativa presupuestal
        this.getComparativaPresupuestal();
        
        // ✅ NUEVO: Recargar ejecución presupuestal para el nuevo año
        if (this.productoSeleccionado) {
            this.cargarEjecucionPresupuestal(this.productoSeleccionado.codigo, anio);
        }
        
        // Si estamos en analytics, regenerar con datos del nuevo año
        if (this.vistaActual === 'analytics') {
            this.generarAnalytics();
            setTimeout(() => this.crearGraficos(), 100);
        }
    }

    /**
     * Abre el modal para crear una nueva actividad
     */
    abrirModalNuevaActividad() {
        if (!this.productoSeleccionado) return;

        this.actividadEnEdicion = null;
        const metaDisponible = this.pdmService.calcularMetaDisponible(
            this.productoSeleccionado,
            this.anioSeleccionado
        );

        // Obtener responsable del producto si existe
        const responsableProducto = this.productoSeleccionado.responsable_id || null;
        const responsableNombre = this.productoSeleccionado.responsable_nombre || '';

        // Fechas preseleccionadas: 1 de enero y 31 de diciembre del año seleccionado
        const fechaInicio = `${this.anioSeleccionado}-01-01`;
        const fechaFin = `${this.anioSeleccionado}-12-31`;

        // Obtener secretaria_id del usuario actual si es secretario
        const currentUser = this.authService.getCurrentUserValue();
        const esSecretario = currentUser?.role === 'secretario';
        const secretariaId = esSecretario ? currentUser?.secretaria_id : null;

        this.formularioActividad = this.fb.group({
            nombre: ['', [Validators.required, Validators.minLength(5)]],
            descripcion: ['', [Validators.required, Validators.minLength(10)]],
            responsable_secretaria_id: [secretariaId, Validators.required],
            estado: ['COMPLETADA', Validators.required], // Siempre COMPLETADA al tener evidencia
            fecha_inicio: [fechaInicio, Validators.required],
            fecha_fin: [fechaFin, Validators.required],
            meta_ejecutar: [0, [Validators.required, Validators.min(0.01), Validators.max(metaDisponible)]],
            // Campos de evidencia OBLIGATORIOS
            evidencia_url: [''],
            imagenes: [[]]
        });

        // Si es secretario, deshabilitar el campo de secretaría
        if (esSecretario) {
            this.formularioActividad.get('responsable_secretaria_id')?.disable();
        }

        // Cargar lista de secretarios
        this.cargarSecretarios();

        this.mostrarModalActividad = true;
    }

    /**
     * Abre el modal para editar una actividad existente
     */
    abrirModalEditarActividad(actividad: ActividadPDM) {
        if (!this.productoSeleccionado) return;

        this.actividadEnEdicion = actividad;
        const validacion = this.pdmService.validarMetaActividad(
            this.productoSeleccionado,
            this.anioSeleccionado,
            0,
            actividad.id
        );

        this.formularioActividad = this.fb.group({
            nombre: [actividad.nombre, [Validators.required, Validators.minLength(5)]],
            descripcion: [actividad.descripcion, [Validators.required, Validators.minLength(10)]],
            responsable_secretaria_id: [actividad.responsable_secretaria_id || null, Validators.required],
            estado: [actividad.estado, Validators.required],
            fecha_inicio: [actividad.fecha_inicio.split('T')[0], Validators.required],
            fecha_fin: [actividad.fecha_fin.split('T')[0], Validators.required],
            meta_ejecutar: [actividad.meta_ejecutar, [Validators.required, Validators.min(0.01), Validators.max(validacion.disponible)]],
            // Prefill evidencia si existe
            evidencia_url: [actividad.evidencia?.url_evidencia || ''],
            imagenes: [actividad.evidencia?.imagenes ? [...actividad.evidencia.imagenes] : []]
        });

        // Cargar lista de secretarios
        this.cargarSecretarios();

        this.mostrarModalActividad = true;
    }

    /**
     * Guarda una actividad (crear o actualizar) con evidencia OBLIGATORIA
     */
    guardarActividad() {
        if (!this.formularioActividad.valid || !this.productoSeleccionado) return;

        // Verificar que hay evidencia (obligatorio)
        if (!this.tieneEvidenciaValida()) {
            this.showToast('Debe proporcionar al menos una URL de evidencia o cargar imágenes', 'error');
            return;
        }

        // Usar getRawValue() para obtener también valores de campos deshabilitados
        const valores = this.formularioActividad.getRawValue();
        
        // Validar meta disponible
        const validacion = this.pdmService.validarMetaActividad(
            this.productoSeleccionado,
            this.anioSeleccionado,
            valores.meta_ejecutar,
            this.actividadEnEdicion?.id
        );

        if (!validacion.valido) {
            this.showToast(validacion.mensaje, 'error');
            return;
        }

        const actividadData: ActividadPDM = {
            codigo_producto: this.productoSeleccionado.codigo,
            anio: this.anioSeleccionado,
            nombre: valores.nombre,
            descripcion: valores.descripcion,
            responsable_secretaria_id: valores.responsable_secretaria_id,
            estado: 'COMPLETADA', // Siempre COMPLETADA porque evidencia es obligatoria
            fecha_inicio: new Date(valores.fecha_inicio).toISOString(),
            fecha_fin: new Date(valores.fecha_fin).toISOString(),
            meta_ejecutar: valores.meta_ejecutar
        };

        if (this.actividadEnEdicion) {
            // Actualizar actividad existente
            this.pdmService.actualizarActividad(this.actividadEnEdicion.id!, actividadData).subscribe({
                next: (actividadActualizada) => {
                    // Siempre registrar evidencia (obligatoria)
                    if (actividadActualizada?.id) {
                        this.registrarEvidenciaActividad(actividadActualizada.id, valores);
                    } else {
                        this.invalidarCache(); // ✅ Invalidar caché después de actualizar
                        this.showToast('Actividad actualizada exitosamente', 'success');
                        this.guardandoEvidencia = false;
                        this.cerrarModalActividad();
                        this.actualizarResumenActividades(true);
                    }
                },
                error: () => {
                    this.guardandoEvidencia = false;
                    this.showToast('Error al actualizar la evidencia de ejecución', 'error');
                }
            });
        } else {
            // Crear nueva actividad
            this.pdmService.crearActividad(actividadData).subscribe({
                next: (actividadCreada) => {
                    // Siempre registrar evidencia (obligatoria)
                    if (actividadCreada?.id) {
                        this.registrarEvidenciaActividad(actividadCreada.id, valores);
                    } else {
                        this.invalidarCache(); // ✅ Invalidar caché después de crear
                        this.showToast('Evidencia de ejecución creada exitosamente', 'success');
                        this.guardandoEvidencia = false;
                        this.cerrarModalActividad();
                        this.actualizarResumenActividades(true);
                    }
                },
                error: () => {
                    this.guardandoEvidencia = false;
                    this.showToast('Error al crear la evidencia de ejecución', 'error');
                }
            });
        }
    }

    /**
     * Registra la evidencia de una actividad
     */
    private registrarEvidenciaActividad(actividadId: number, valores: any) {
        const evidenciaData: EvidenciaActividad = {
            descripcion: valores.descripcion,
            url_evidencia: valores.evidencia_url || undefined,
            imagenes: valores.imagenes && valores.imagenes.length > 0 ? valores.imagenes : [],
            fecha_registro: new Date().toISOString()
        };

        const actividadOriginal = this.actividadEnEdicion;
        const yaTieneEvidencia = !!actividadOriginal?.evidencia?.id;

        const accion$ = yaTieneEvidencia
            ? this.pdmService.actualizarEvidenciaEnBackend(actividadId, evidenciaData)
            : this.pdmService.registrarEvidencia(actividadId, evidenciaData);

        accion$.subscribe({
            next: () => {
                this.showToast(yaTieneEvidencia ? 'Evidencia actualizada exitosamente' : 'Evidencia de ejecución registrada exitosamente', 'success');
                this.guardandoEvidencia = false;
                this.cerrarModalActividad();
                this.cargandoActividadesBackend = true;
                // ✅ OPTIMIZADO: Usar requestAnimationFrame en lugar de setTimeout
                requestAnimationFrame(() => {
                    if (this.productoSeleccionado) {
                        this.pdmService.cargarActividadesDesdeBackend(this.productoSeleccionado.codigo, this.anioSeleccionado)
                            .subscribe({
                                next: (actividades) => {
                                    this.pdmService.sincronizarActividadesProducto(
                                        this.productoSeleccionado!.codigo,
                                        actividades
                                    );
                                    this.actualizarResumenActividades(false);
                                    this.cargandoActividadesBackend = false;
                                },
                                error: (error) => {
                                    console.warn('⚠️ Error refetch evidencia:', error);
                                    this.cargandoActividadesBackend = false;
                                    this.actualizarResumenActividades(false);
                                }
                            });
                    }
                });
            },
            error: () => {
                this.guardandoEvidencia = false;
                this.showToast(yaTieneEvidencia ? 'Error al actualizar la evidencia' : 'Error al registrar la evidencia de ejecución', 'error');
                this.cerrarModalActividad();
                this.actualizarResumenActividades(true);
            }
        });
    }

    /**
     * Exporta el PDM completo a un archivo Excel
     */
    exportarExcel() {
        if (!this.resumenProductos || this.resumenProductos.length === 0) {
            this.showToast('No hay datos para exportar', 'info');
            return;
        }

        try {
            // Importar dinámicamente la librería XLSX
            import('xlsx').then((XLSX) => {
                const workbook = XLSX.utils.book_new();

                // 📊 Hoja 1: Resumen de Productos
                const productosData = this.resumenProductos.map(p => ({
                    'Código': p.codigo,
                    'Producto': p.producto,
                    'Unidad de Medida': p.unidad_medida,
                    'Meta 2024': p.programacion_2024,
                    'Meta 2025': p.programacion_2025,
                    'Meta 2026': p.programacion_2026,
                    'Meta 2027': p.programacion_2027,
                    'Presupuesto 2024': p.total_2024,
                    'Presupuesto 2025': p.total_2025,
                    'Presupuesto 2026': p.total_2026,
                    'Presupuesto 2027': p.total_2027,
                    'Línea Estratégica': p.linea_estrategica,
                    'ODS': p.ods,
                    'Sector': p.sector,
                    'BPIN': p.bpin || 'N/A'
                }));
                const wsProductos = XLSX.utils.json_to_sheet(productosData);
                XLSX.utils.book_append_sheet(workbook, wsProductos, 'Productos');

                // 📋 Hoja 2: Actividades y Evidencias
                const actividadesData: any[] = [];
                this.resumenProductos.forEach(producto => {
                    const actividades = this.pdmService.obtenerActividadesPorProducto(producto.codigo);
                    actividades.forEach((act: ActividadPDM) => {
                        actividadesData.push({
                            'Código Producto': producto.codigo,
                            'Producto': producto.producto,
                            'Año': act.anio,
                            'Nombre Actividad': act.nombre,
                            'Descripción': act.descripcion,
                            'Estado': act.estado || 'PENDIENTE',
                            'Secretaría': act.responsable_secretaria_nombre || 'Sin asignar',
                            'Meta a Ejecutar': act.meta_ejecutar,
                            'Fecha Inicio': act.fecha_inicio,
                            'Fecha Fin': act.fecha_fin,
                            'Tiene Evidencia': (act as any).tiene_evidencia ? 'Sí' : 'No',
                            'URL Evidencia': '',
                            'Descripción Evidencia': '',
                            'Cantidad Imágenes': 0,
                            'Fecha Registro Evidencia': ''
                        });
                    });
                });
                if (actividadesData.length > 0) {
                    const wsActividades = XLSX.utils.json_to_sheet(actividadesData);
                    XLSX.utils.book_append_sheet(workbook, wsActividades, 'Actividades');
                }

                // 📈 Hoja 3: Resumen por Secretaría
                if (this.analisisPorSecretaria && this.analisisPorSecretaria.length > 0) {
                    const secretariasData = this.analisisPorSecretaria.map(s => ({
                        'Secretaría': s.nombre_secretaria,
                        'Total Productos': s.total_productos,
                        'Completados': s.productos_completados,
                        'En Progreso': s.productos_en_progreso,
                        'Pendientes': s.productos_pendientes,
                        'Por Ejecutar': s.productos_por_ejecutar,
                        'Avance %': s.porcentaje_avance_promedio.toFixed(2),
                        'Total Actividades': s.total_actividades,
                        'Actividades Completadas': s.actividades_completadas,
                        'Presupuesto Total': s.presupuesto_total
                    }));
                    const wsSecretarias = XLSX.utils.json_to_sheet(secretariasData);
                    XLSX.utils.book_append_sheet(workbook, wsSecretarias, 'Por Secretaría');
                }

                // 💾 Generar y descargar el archivo
                const fecha = new Date().toISOString().split('T')[0];
                const nombreArchivo = `PDM_Completo_${fecha}.xlsx`;
                XLSX.writeFile(workbook, nombreArchivo);
                
                this.showToast('Excel exportado exitosamente', 'success');
            }).catch(error => {
                console.error('Error al importar XLSX:', error);
                this.showToast('Error al exportar el archivo Excel', 'error');
            });
        } catch (error) {
            console.error('Error al exportar Excel:', error);
            this.showToast('Error al generar el archivo Excel', 'error');
        }
    }

    /**
     * Elimina una actividad
     */
    eliminarActividad(actividad: ActividadPDM) {
        let mensaje = `¿Está seguro de eliminar la actividad "${actividad.nombre}"?`;
        
        // Si tiene evidencia, advertir que se eliminará también
        if (actividad.evidencia) {
            mensaje += '\n\nADVERTENCIA: Esta actividad tiene evidencia adjunta que también será eliminada permanentemente.';
        }
        
        if (!confirm(mensaje)) return;

        this.pdmService.eliminarActividad(actividad.id!).subscribe({
            next: () => {
                this.invalidarCache(); // ✅ Invalidar caché después de eliminar
                this.showToast('Evidencia de ejecución eliminada exitosamente', 'success');
                this.actualizarResumenActividades(true);
            },
            error: () => {
                this.showToast('Error al eliminar la evidencia de ejecución', 'error');
            }
        });
    }

    /**
     * Cierra el modal de actividad
     */
    cerrarModalActividad() {
        this.mostrarModalActividad = false;
        this.actividadEnEdicion = null;
        this.formularioActividad.reset();
    }

    /**
     * Verifica si el usuario actual es Admin o SuperAdmin
     */
    isAdmin(): boolean {
        return this.authService.isAdminOrSuperAdmin();
    }

    /**
     * Verifica si el usuario puede crear evidencias (Admin o Secretario)
     */
    /**
     * ✅ OPTIMIZADO: Usa cache en lugar de llamar getCurrentUserValue() cada vez
     */
    puedeCrearEvidencia(): boolean {
        return this.puedeCrearEvidenciaCache;
    }

    /**
     * Verifica si el usuario puede cargar archivos de ejecución presupuestal (solo Admin)
     * ✅ OPTIMIZADO: Usa cache en lugar de llamar getCurrentUserValue() cada vez
     */
    puedeCargarArchivosEjecucion(): boolean {
        return this.puedeCargarArchivosEjecucionCache;
    }


    /**
     * Carga la lista de secretarios de la entidad
     */
    /**
     * Carga los secretarios de la entidad y los agrupa por secretaría
     */
    cargarSecretarios() {
        this.cargandoSecretarios = true;
        this.pdmService.obtenerSecretariosEntidad().subscribe({
            next: (secretarios) => {
                this.secretarios = secretarios;
                // Agrupar por secretaría
                this.agruparSecretariosporSecretaria();
            },
            error: (error) => {
                console.error('❌ Error al cargar secretarios:', error);
                this.cargandoSecretarios = false;
                this.secretarios = [];
                this.secretariasAgrupadas = [];
            }
        });
    }

    /**
     * Agrupa los secretarios por secretaría para mostrar en dropdowns
     */
    private agruparSecretariosporSecretaria() {
        const secretariaMap = new Map<number | string, any[]>();
        this.secretarios.forEach((sec, idx) => {
            const nomSec = sec.secretaria || 'Sin Secretaría';
            const secretariaId = sec.secretaria_id;
            
            
            // Solo usar secretaria_id si es un número válido
            let clave: number | string;
            if (typeof secretariaId === 'number' && !isNaN(secretariaId) && secretariaId > 0) {
                clave = secretariaId;
            } else {
                // Si no hay ID válido, usar el nombre como clave (fallback)
                clave = nomSec;
            }
            
            if (!secretariaMap.has(clave)) {
                secretariaMap.set(clave, []);
            }
            secretariaMap.get(clave)!.push(sec);
        });

        // Convertir a array de objetos, asegurando que id sea siempre un número válido o cero
        this.secretariasAgrupadas = Array.from(secretariaMap.entries()).map(([id, responsables]) => {
            // Validar y garantizar que id sea un número válido
            let validId: number;
            if (typeof id === 'number' && !isNaN(id)) {
                validId = id;
            } else {
                // Si id no es un número, intentar extraer de algún usuario
                const idFromUser = responsables.find(r => typeof r.secretaria_id === 'number' && r.secretaria_id > 0)?.secretaria_id;
                validId = idFromUser || 0;
            }
            return {
                nombre: responsables[0]?.secretaria || 'Sin Secretaría',
                responsables,
                id: validId  // ID numérico garantizado
            };
        });
        this.cargandoSecretarios = false;
    }


    /**
     * Maneja la carga de imágenes para evidencia
     * ✅ CORREGIDO: Validar tamaño considerando el aumento por Base64 encoding (~33%)
     * Límite ajustado a 1.5MB para que al convertir a Base64 no exceda ~2MB
     */
    onImagenesSeleccionadas(event: Event) {
        const input = event.target as HTMLInputElement;
        if (!input.files) return;

        const files = Array.from(input.files);
        
        // Validar cantidad (máximo 4 imágenes)
        if (files.length > 4) {
            this.showToast('Máximo 4 imágenes permitidas', 'error');
            return;
        }

        // ✅ Validar tamaño ANTES de Base64 (2MB = ~2.66MB después de Base64)
        // Base64 aumenta el tamaño en ~33%, 4 imágenes × 2MB = ~10.64MB total en Base64
        const maxSize = 2 * 1024 * 1024; // 2MB por imagen
        const archivosGrandes = files.filter(f => f.size > maxSize);
        if (archivosGrandes.length > 0) {
            const tamañosExcedidos = archivosGrandes.map(f => `${f.name}: ${(f.size / (1024 * 1024)).toFixed(2)}MB`).join(', ');
            this.showToast(`Las siguientes imágenes exceden el límite de 2MB: ${tamañosExcedidos}. Por favor, comprime las imágenes antes de subirlas.`, 'error');
            // Limpiar el input para que el usuario pueda seleccionar otros archivos
            input.value = '';
            return;
        }

        // Convertir a Base64
        const promesas = files.map(file => {
            return new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
        });

        Promise.all(promesas).then(imagenesNuevas => {
            // Obtener imágenes actuales del FormControl
            const imagenesControl = this.formularioActividad.get('imagenes');
            const actuales: string[] = imagenesControl?.value || [];

            // Calcular cuántas podemos agregar (máximo 4 total)
            const disponibles = 4 - actuales.length;
            
            if (disponibles <= 0) {
                this.showToast('Ya tienes el máximo de 4 imágenes. Elimina alguna para agregar nuevas.', 'error');
                return;
            }

            // Tomar solo las que caben
            const aAgregar = imagenesNuevas.slice(0, disponibles);
            
            // Crear nuevo array con todas las imágenes
            const todasLasImagenes = [...actuales, ...aAgregar];
            
            // Actualizar el FormControl
            imagenesControl?.setValue(todasLasImagenes);
            
            if (aAgregar.length < imagenesNuevas.length) {
                this.showToast(`Se agregaron ${aAgregar.length} de ${imagenesNuevas.length} imágenes (máximo 4 total)`, 'info');
            } else {
                this.showToast(`${aAgregar.length} imagen(es) agregada(s)`, 'success');
            }
        }).catch((error) => {
            console.error('❌ Error al procesar imágenes:', error);
            this.showToast('Error al procesar las imágenes', 'error');
        });
    }

    /**
     * Elimina una imagen de la lista
     */
    eliminarImagen(index: number) {
        const imagenesActuales = this.formularioActividad.get('imagenes')?.value || [];
        imagenesActuales.splice(index, 1);
        this.formularioActividad.patchValue({ imagenes: imagenesActuales });
    }

    /**
     * Valida que haya evidencia (URL o imágenes) - OBLIGATORIO
     */
    tieneEvidenciaValida(): boolean {
        const url = this.formularioActividad.get('evidencia_url')?.value;
        const imagenes = this.formularioActividad.get('imagenes')?.value || [];
        
        const tieneUrl = url && url.trim() !== '';
        const tieneImagenes = imagenes.length > 0;
        
        return tieneUrl || tieneImagenes;
    }


    /**
     * Obtiene el color del badge según el estado de la actividad
     */
    getColorEstado(estado: string): string {
        switch (estado) {
            case 'COMPLETADA': return 'success';
            case 'EN_PROGRESO': return 'info';
            case 'PENDIENTE': return 'warning';
            case 'CANCELADA': return 'danger';
            default: return 'secondary';
        }
    }

    /**
     * Obtiene el nombre del responsable de una actividad
     */
    getNombreResponsable(actividad: ActividadPDM): string {
        // Mostrar secretaría si está asignada
        if (actividad.responsable_secretaria_nombre) {
            return `🏢 ${actividad.responsable_secretaria_nombre}`;
        }
        
        // Si hay campo responsable legacy, mostrar también
        if (actividad.responsable) {
            return `� ${actividad.responsable}`;
        }
        
        return '⚠️ Sin asignar';
    }

    /**
     * Obtiene el texto del estado en español
     */
    getTextoEstado(estado: string): string {
        switch (estado) {
            case 'COMPLETADA': return 'Completada';
            case 'EN_PROGRESO': return 'En Progreso';
            case 'PENDIENTE': return 'Pendiente';
            case 'CANCELADA': return 'Cancelada';
            default: return estado;
        }
    }

    /**
     * Obtiene las imágenes a mostrar de una evidencia (prioriza S3 sobre Base64)
     */
    obtenerImagenesParaMostrar(evidencia?: EvidenciaActividad): string[] {
        if (!evidencia) {
            console.log('🔍 obtenerImagenesParaMostrar: No hay evidencia');
            return [];
        }

        console.log('🔍 obtenerImagenesParaMostrar llamado con:', {
            tiene_imagenes_s3: evidencia.imagenes_s3_urls?.length || 0,
            tiene_imagenes_base64: evidencia.imagenes?.length || 0,
            migrated_to_s3: evidencia.migrated_to_s3
        });

        // 1. Priorizar URLs S3 si existen (incluso si migrated_to_s3 es false/undefined por cache)
        if (evidencia.imagenes_s3_urls && evidencia.imagenes_s3_urls.length > 0) {
            console.log('✅ DECISIÓN: Mostrando imágenes desde S3:', evidencia.imagenes_s3_urls);
            return evidencia.imagenes_s3_urls;
        }

        // 2. Fallback a imagenes Base64 (legacy o evidencias no migradas)
        if (evidencia.imagenes && evidencia.imagenes.length > 0) {
            console.log('⚠️ DECISIÓN: Mostrando imágenes Base64 (legacy), cantidad:', evidencia.imagenes.length);
            // Convertir a data URLs si es Base64 puro
            return evidencia.imagenes.map(img => {
                // Si ya tiene prefijo data:image, retornar tal cual
                if (img.startsWith('http://') || img.startsWith('https://') || img.startsWith('data:image/')) {
                    return img;
                }
                // Si es Base64 puro, agregar prefijo
                return `data:image/jpeg;base64,${img}`;
            });
        }

        console.log('❌ DECISIÓN: No hay imágenes para mostrar');
        return [];
    }

    /**
     * Carga la evidencia de una actividad bajo demanda (optimización para evitar OOM en backend)
     */
    cargarEvidenciaActividad(actividad: ActividadPDM) {
        if (!actividad.id || actividad.evidencia || !actividad.tiene_evidencia) {
            return; // Ya está cargada o no tiene evidencia
        }

        // Marcar como cargando
        actividad.cargandoEvidencia = true;

        console.log(`🔄 Cargando evidencia para actividad ${actividad.id}...`);

        this.pdmService.obtenerEvidenciaActividad(actividad.id).subscribe({
            next: (evidencia) => {
                console.log(`📥 Evidencia recibida del backend para actividad ${actividad.id}:`, {
                    tiene_imagenes: evidencia?.imagenes?.length || 0,
                    tiene_s3_urls: evidencia?.imagenes_s3_urls?.length || 0,
                    migrated_to_s3: evidencia?.migrated_to_s3,
                    evidencia: evidencia
                });
                if (evidencia) {
                    actividad.evidencia = evidencia;
                }
                actividad.cargandoEvidencia = false;
            },
            error: (error) => {
                console.error('❌ Error cargando evidencia:', error);
                actividad.cargandoEvidencia = false;
            }
        });
    }

    /**
     * Abre una imagen en una nueva ventana para verla en grande
     */
    verImagenGrande(imagenBase64: string) {
        console.log('🖼️ Abriendo imagen:', imagenBase64.substring(0, 100));
        const ventana = window.open('', '_blank');
        if (ventana) {
            ventana.document.write(`
                <html>
                    <head>
                        <title>Evidencia - Imagen</title>
                        <style>
                            body { margin: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #000; }
                            img { max-width: 100%; max-height: 100vh; object-fit: contain; }
                        </style>
                    </head>
                    <body>
                        <img src="${imagenBase64}" alt="Evidencia" onerror="document.body.innerHTML='<p style=color:white>Error cargando imagen: ${imagenBase64.substring(0, 100)}</p>'">
                    </body>
                </html>
            `);
        }
    }

    /**
     * Handler cuando una imagen se carga correctamente
     */
    onImageLoad(event: Event, url: string) {
        console.log('✅ Imagen cargada OK:', url);
    }

    /**
     * Handler cuando una imagen falla al cargar
     */
    onImageError(event: Event, url: string) {
        console.error('❌ Error cargando imagen:', url);
        const img = event.target as HTMLImageElement;
        console.error('Error details:', {
            src: img.src,
            naturalWidth: img.naturalWidth,
            naturalHeight: img.naturalHeight,
            complete: img.complete
        });
    }

    /**
     * Obtiene el avance de un producto para un año específico
     */
    getAvanceAnio(producto: ResumenProducto, anio: number): number {
        const resumen = this.pdmService.obtenerResumenActividadesPorAnio(producto, anio);
        return resumen.porcentaje_avance;
    }

    /**
     * Helper para obtener año como número (convierte 'todos' a año actual)
     */
    getFiltroAnioNumero(): number {
        return this.filtroAnio;
    }

    /**
     * Obtiene la meta programada para un año específico
     */
    getMetaAnio(producto: ResumenProducto, anio: number): number {
        switch (anio) {
            case 2024: return producto.programacion_2024;
            case 2025: return producto.programacion_2025;
            case 2026: return producto.programacion_2026;
            case 2027: return producto.programacion_2027;
            default: return 0;
        }
    }

    /**
     * Obtiene el presupuesto para un año específico
     */
    getPresupuestoAnio(producto: ResumenProducto, anio: number): number {
        switch (anio) {
            case 2024: return producto.total_2024;
            case 2025: return producto.total_2025;
            case 2026: return producto.total_2026;
            case 2027: return producto.total_2027;
            default: return 0;
        }
    }

    /**
     * Obtiene el número de años con metas programadas > 0
     */
    getAniosConMetas(producto: ResumenProducto): number {
        let count = 0;
        if (producto.programacion_2024 > 0) count++;
        if (producto.programacion_2025 > 0) count++;
        if (producto.programacion_2026 > 0) count++;
        if (producto.programacion_2027 > 0) count++;
        return count;
    }

    /**
     * Determina el estado de un producto para un año específico
     * - Año pasado sin completar = PENDIENTE
     * - Año actual sin avance = PENDIENTE
     * - Año actual con avance < 100% = EN_PROGRESO
     * - Año actual con avance = 100% = COMPLETADO
     * - Años futuros = POR_EJECUTAR
     */
    /**
     * Obtiene el estado del producto para un año específico
     * NUEVA LÓGICA DE PROGRESO:
     * - POR_EJECUTAR: Años futuros o sin actividades asignadas (0% avance)
     * - EN_PROGRESO: Actividades asignadas o en ejecución (0-99% avance)
     * - COMPLETADO: Todas las actividades tienen evidencia (100% avance)
     */
    getEstadoProductoAnio(producto: ResumenProducto, anio: number): string {
        const avance = this.getAvanceAnio(producto, anio);
        const resumenActividades = this.pdmService.obtenerResumenActividadesPorAnio(producto, anio);

        // DEBUG: Log para entender qué está pasando

        // Año futuro: siempre POR_EJECUTAR
        if (anio > new Date().getFullYear()) {
            return 'POR_EJECUTAR';
        }

        // ✅ Basado en el avance calculado
        // Estado COMPLETADO: avance EXACTAMENTE 100%
        if (avance === 100) {
            return 'COMPLETADO';
        }
        
        if (avance === 0 && resumenActividades.total_actividades === 0) {
            return 'PENDIENTE'; // Sin actividades creadas aún
        }
        
        // Si tiene actividades: EN_PROGRESO
        if (resumenActividades.total_actividades > 0) {
            return 'EN_PROGRESO';
        }

        return 'PENDIENTE';
    }

    /**
     * Obtiene el color del badge según el estado
     */
    getColorEstadoProducto(estado: string): string {
        switch (estado) {
            case 'COMPLETADO': return 'success';
            case 'EN_PROGRESO': return 'info';
            case 'PENDIENTE': return 'warning';
            case 'POR_EJECUTAR': return 'secondary';
            default: return 'secondary';
        }
    }

    /**
     * Obtiene el texto del estado en español
     */
    getTextoEstadoProducto(estado: string): string {
        switch (estado) {
            case 'COMPLETADO': return 'Completado';
            case 'EN_PROGRESO': return 'En Progreso';
            case 'PENDIENTE': return 'Pendiente';
            case 'POR_EJECUTAR': return 'Por Ejecutar';
            default: return estado;
        }
    }

    /**
     * Calcula las estadísticas por estado para el año seleccionado
     * Solo considera productos cuya meta sea mayor a 0 para el año filtrado
     */
    /**
     * ✅ OPTIMIZADO: Obtiene estadísticas de productos por estado
     * Cachea resultados para evitar recálculos en cada ciclo de detección de cambios
     */
    getEstadisticasPorEstado(): {
        pendiente: number;
        en_progreso: number;
        completado: number;
        por_ejecutar: number;
        total: number;
    } {
        // Si filtroAnio es 0, usar año actual para dashboard principal
        const anioParaFiltro = this.filtroAnio === 0 ? new Date().getFullYear() : this.filtroAnio;
        
        // Filtrar solo productos con meta > 0 para el año seleccionado
        const productos = this.resumenProductos.filter(producto => {
            const meta = this.getMetaAnio(producto, anioParaFiltro);
            return meta > 0;
        });

        let pendiente = 0;
        let en_progreso = 0;
        let completado = 0;
        let por_ejecutar = 0;

        productos.forEach(producto => {
            const estado = this.getEstadoProductoAnio(producto, anioParaFiltro);
            switch (estado) {
                case 'PENDIENTE': pendiente++; break;
                case 'EN_PROGRESO': en_progreso++; break;
                case 'COMPLETADO': completado++; break;
                case 'POR_EJECUTAR': por_ejecutar++; break;
            }
        });

        this.estadisticasPorEstadoCache = {
            pendiente,
            en_progreso,
            completado,
            por_ejecutar,
            total: productos.length
        };
        
        return this.estadisticasPorEstadoCache;
    }

    /**
     * Abre el modal con información del proyecto BPIN
     */
    abrirModalBPIN(bpin: string): void {
        if (!bpin || bpin.trim() === '') {
            return;
        }

        this.mostrarModalBPIN = true;
        this.cargandoBPIN = true;
        this.proyectoBPIN = null;

        this.pdmService.consultarProyectoBPIN(bpin).subscribe({
            next: (proyecto) => {
                this.proyectoBPIN = proyecto;
                this.cargandoBPIN = false;
            },
            error: (error) => {
                console.error('Error al consultar BPIN:', error);
                this.cargandoBPIN = false;
            }
        });
    }

    /**
     * Cierra el modal de BPIN
     */
    cerrarModalBPIN(): void {
        this.mostrarModalBPIN = false;
        this.proyectoBPIN = null;
    }

    /**
     * Navega a la vista de análisis detallado del producto
     */
    abrirModalAnalisisProducto(): void {
        if (!this.productoSeleccionado) return;
        
        this.vistaActual = 'analisis-producto';
        
        // Esperar a que el DOM se renderice
        setTimeout(() => {
            this.crearGraficosAnalisisProducto();
        }, 100);
    }

    /**
     * Vuelve de la vista de análisis del producto (ya no se usa, se usa volver())
     */
    cerrarModalAnalisisProducto(): void {
        this.vistaActual = 'detalle';
        this.destruirGraficosAnalisisProducto();
    }

    /**
     * Obtiene la meta programada para un año específico
     */
    obtenerMetaProgramada(anio: number): number {
        if (!this.productoSeleccionado) return 0;
        
        switch (anio) {
            case 2024: return this.productoSeleccionado.programacion_2024 || 0;
            case 2025: return this.productoSeleccionado.programacion_2025 || 0;
            case 2026: return this.productoSeleccionado.programacion_2026 || 0;
            case 2027: return this.productoSeleccionado.programacion_2027 || 0;
            default: return 0;
        }
    }

    /**
     * Obtiene la meta ejecutada para un año específico
     */
    obtenerMetaEjecutada(anio: number): number {
        if (!this.productoSeleccionado) return 0;
        
        // Obtener actividades del producto para el año específico
        const resumenAnio = this.pdmService.obtenerResumenActividadesPorAnio(
            this.productoSeleccionado,
            anio
        );
        
        return resumenAnio.meta_ejecutada;
    }

    /**
     * Calcula el porcentaje de ejecución para un año
     */
    obtenerPorcentajeAnio(anio: number): number {
        const programada = this.obtenerMetaProgramada(anio);
        const ejecutada = this.obtenerMetaEjecutada(anio);
        
        if (programada === 0) return 0;
        return (ejecutada / programada) * 100;
    }

    /**
     * Obtiene la meta ejecutada total sumando todos los años
     * ✅ OPTIMIZADO: Cachea resultado
     */
    obtenerMetaEjecutadaTotal(): number {
        const anios = [2024, 2025, 2026, 2027];
        this.metaEjecutadaTotalCache = anios.reduce((total, anio) => total + this.obtenerMetaEjecutada(anio), 0);
        return this.metaEjecutadaTotalCache;
    }

    /**
     * Crea los gráficos para el análisis del producto
     */
    crearGraficosAnalisisProducto(): void {
        if (!this.productoSeleccionado) return;

        // Destruir gráficos anteriores
        this.destruirGraficosAnalisisProducto();

        const anios = [2024, 2025, 2026, 2027];
        const metasProgramadas = anios.map(anio => this.obtenerMetaProgramada(anio));
        const metasEjecutadas = anios.map(anio => this.obtenerMetaEjecutada(anio));
        const porcentajes = anios.map(anio => this.obtenerPorcentajeAnio(anio));

        // Gráfico 1: Progreso por Año (línea)
        const ctxProgreso = document.getElementById('chartProgresoAnual') as HTMLCanvasElement;
        if (ctxProgreso) {
            this.chartProgresoAnual = new Chart(ctxProgreso, {
                type: 'line',
                data: {
                    labels: anios,
                    datasets: [{
                        label: '% de Avance',
                        data: porcentajes,
                        borderColor: '#0d6efd',
                        backgroundColor: 'rgba(13, 110, 253, 0.1)',
                        fill: true,
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: { display: true },
                        tooltip: {
                            callbacks: {
                                label: (context) => `${(context.parsed.y || 0).toFixed(1)}%`
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            max: 100,
                            ticks: {
                                callback: (value) => value + '%'
                            }
                        }
                    }
                }
            });
        }

        // Gráfico 2: Meta vs Ejecutado (barras agrupadas)
        const ctxMeta = document.getElementById('chartMetaEjecutado') as HTMLCanvasElement;
        if (ctxMeta) {
            this.chartMetaEjecutado = new Chart(ctxMeta, {
                type: 'bar',
                data: {
                    labels: anios,
                    datasets: [
                        {
                            label: 'Meta Programada',
                            data: metasProgramadas,
                            backgroundColor: '#0dcaf0',
                            borderColor: '#0dcaf0',
                            borderWidth: 1
                        },
                        {
                            label: 'Meta Ejecutada',
                            data: metasEjecutadas,
                            backgroundColor: '#198754',
                            borderColor: '#198754',
                            borderWidth: 1
                        }
                    ]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: { display: true },
                        tooltip: {
                            callbacks: {
                                label: (context) => `${context.dataset.label}: ${(context.parsed.y || 0).toFixed(2)} ${this.productoSeleccionado?.unidad_medida || ''}`
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true
                        }
                    }
                }
            });
        }

        // Gráfico 3: Presupuesto por Año (barras)
        const ctxPresupuesto = document.getElementById('chartPresupuestoAnual') as HTMLCanvasElement;
        if (ctxPresupuesto) {
            const presupuestos = anios.map(anio => {
                const key = `total_${anio}` as keyof typeof this.productoSeleccionado;
                return this.productoSeleccionado![key] as number || 0;
            });

            this.chartPresupuestoAnual = new Chart(ctxPresupuesto, {
                type: 'bar',
                data: {
                    labels: anios,
                    datasets: [{
                        label: 'Presupuesto Anual',
                        data: presupuestos,
                        backgroundColor: ['#ffc107', '#fd7e14', '#dc3545', '#6610f2'],
                        borderColor: ['#ffc107', '#fd7e14', '#dc3545', '#6610f2'],
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                label: (context) => this.formatearMoneda(context.parsed.y || 0)
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                callback: (value) => {
                                    const num = value as number;
                                    return '$' + (num / 1000000).toFixed(1) + 'M';
                                }
                            }
                        }
                    }
                }
            });
        }
    }

    /**
     * Destruye los gráficos del análisis del producto
     */
    destruirGraficosAnalisisProducto(): void {
        if (this.chartProgresoAnual) {
            this.chartProgresoAnual.destroy();
            this.chartProgresoAnual = null;
        }
        if (this.chartMetaEjecutado) {
            this.chartMetaEjecutado.destroy();
            this.chartMetaEjecutado = null;
        }
        if (this.chartPresupuestoAnual) {
            this.chartPresupuestoAnual.destroy();
            this.chartPresupuestoAnual = null;
        }
    }

    /**
     * Genera los análisis para los dashboards analíticos
     * Filtra por año y opcionalmente por secretaría
     */
    generarAnalytics(): void {
        console.log('📈 Generando analytics - filtroAnio:', this.filtroAnio, 'tipo:', typeof this.filtroAnio);
        console.log('📦 Productos disponibles:', this.resumenProductos.length);
        
        // Filtrar productos según filtroSecretaria
        let productosFiltrados = this.resumenProductos;
        
        if (this.filtroSecretaria) {
            const secretariaId = parseInt(this.filtroSecretaria, 10);
            productosFiltrados = this.resumenProductos.filter(p => {
                const productoSecretariaId = p.responsable_secretaria_id || p.responsable_id;
                return productoSecretariaId && parseInt(String(productoSecretariaId), 10) === secretariaId;
            });
        }
        
        console.log('📦 Productos filtrados por secretaría:', productosFiltrados.length);
        
        // Convertir filtroAnio a número, 0 significa "todos los años"
        const anioParaAnalisis = this.filtroAnio === 0 ? 0 : parseInt(String(this.filtroAnio), 10);
        console.log('🎯 Año para análisis:', anioParaAnalisis);
        
        this.dashboardAnalytics = this.pdmService.generarDashboardAnalytics(
            productosFiltrados,
            anioParaAnalisis
        );
        
        console.log('✅ Dashboard analytics generado:', this.dashboardAnalytics.resumen_general);
        
        // ✅ Generar análisis por secretaría
        this.analisisPorSecretaria = this.pdmService.generarAnaliasisPorSecretaria(
            productosFiltrados,
            anioParaAnalisis
        );
    }
    
    /**
     * ✅ NUEVO: Cambia los filtros de analytics y regenera gráficos
     */
    cambiarFiltrosAnalytics(): void {
        console.log('🔄 Cambiando filtros analytics - Año:', this.filtroAnio, 'Tipo:', typeof this.filtroAnio);
        console.log('📊 Secretaría:', this.filtroSecretaria);
        
        // Regenerar analytics con los nuevos filtros
        this.generarAnalytics();
        
        // Regenerar gráficos después de un pequeño delay
        setTimeout(() => this.crearGraficos(), 100);
    }

    /**
     * ✅ NUEVO: Ver análisis detallado del producto
     */
    verAnalisisProducto(producto: ResumenProducto): void {
        console.log('👁️ verAnalisisProducto:', producto.codigo, '- Avance actual:', producto.porcentaje_ejecucion + '%');
        this.navegarA('analisis-producto', producto);
    }

    /**
     * Navega a la vista de analytics y recarga datos del backend
     * CRÍTICO: Ahora también sincroniza actividades antes de generar gráficos
     */
    verAnalytics(): void {
        this.vistaActual = 'analytics';
        
        // ✅ Asegurar que secretarías estén cargadas para el filtro
        if (this.secretariasAgrupadas.length === 0) {
            this.cargarSecretarios();
        }
        
        if (!this.datosEnBackend) {
            // Sin datos en backend, usar lo que hay en memoria
            this.cargandoDesdeBackend = false;
            this.generarAnalytics();
            setTimeout(() => this.crearGraficos(), 100);
            return;
        }
        
        // ✅ Si los datos son recientes, usar caché sin recargar
        const ahora = Date.now();
        if (ahora - this.ultimaActualizacionCache < this.TIEMPO_CACHE_MS && this.pdmData) {
            this.cargandoDesdeBackend = false;
            this.generarAnalytics();
            setTimeout(() => this.crearGraficos(), 100);
            return;
        }
        
        // Si no hay caché válido, recargar desde el servidor
        this.cargandoDesdeBackend = true;
        
        // Cargar datos base
        this.pdmService.cargarDatosPDMDesdeBackend().subscribe({
            next: (data) => {
                this.pdmData = data;
                this.resumenProductos = this.ordenarProductosPorCodigo(
                    this.pdmService.generarResumenProductos(data)
                );
                this.estadisticas = this.pdmService.calcularEstadisticas(data);
                
                // ✅ PASO CRÍTICO: Cargar actividades de TODOS los productos
                this.cargarActividadesTodosProductos().then(() => {
                    // IMPORTANTE: Recalcular después de que actividades estén sincronizadas
                    this.resumenProductos = this.pdmService.generarResumenProductos(data);
                    this.estadisticas = this.pdmService.calcularEstadisticas(data);
                    
                    // Generar analytics con datos actualizados
                    this.generarAnalytics();
                    this.ultimaActualizacionCache = Date.now(); // ✅ Actualizar timestamp del caché
                    
                    setTimeout(() => {
                        this.crearGraficos();
                        this.cargandoDesdeBackend = false;
                        this.showToast('Datos de análisis cargados correctamente', 'success');
                    }, 200);
                });
            },
            error: (error) => {
                console.warn('⚠️ Error al recargar datos para analytics:', error);
                this.cargandoDesdeBackend = false;
                
                // Continuar con datos en caché
                this.generarAnalytics();
                setTimeout(() => this.crearGraficos(), 100);
                this.showToast('Se muestran datos en caché (sin conexión)', 'info');
            }
        });
    }

    /**
     * Crea los gráficos visuales para la sección de analytics
     */
    crearGraficos(): void {
        if (!this.dashboardAnalytics) return;

        // Destruir charts anteriores si existen
        this.destruirGraficos();

        // 1. Gráfico de torta - Distribución por Estado
        this.crearGraficoEstados();

        // 2. Gráfico de barras - Análisis por Sector
        this.crearGraficoSectores();

        // 3. Gráfico de barras - Metas vs Ejecutadas por Año
        this.crearGraficoMetasEjecutadas();

        // 4. Gráfico de barras - Presupuesto por Año
        this.crearGraficoPresupuestoPorAnio();

        // 5. Gráfico de dona - ODS
        this.crearGraficoODS();

        // 6. Gráfico de barras horizontales - Sectores Detalle
        this.crearGraficoSectoresDetalle();

        // 7. Gráfico de barras horizontales - Desempeño por Secretaría
        this.crearGraficoSecretarias();
    }

    /**
     * Destruye los gráficos existentes
     */
    destruirGraficos(): void {
        if (this.chartEstados) {
            this.chartEstados.destroy();
            this.chartEstados = null;
        }
        if (this.chartSectores) {
            this.chartSectores.destroy();
            this.chartSectores = null;
        }
        if (this.chartMetasEjecutadas) {
            this.chartMetasEjecutadas.destroy();
            this.chartMetasEjecutadas = null;
        }
        if (this.chartPresupuestoPorAnio) {
            this.chartPresupuestoPorAnio.destroy();
            this.chartPresupuestoPorAnio = null;
        }
        if (this.chartODS) {
            this.chartODS.destroy();
            this.chartODS = null;
        }
        if (this.chartSectoresDetalle) {
            this.chartSectoresDetalle.destroy();
            this.chartSectoresDetalle = null;
        }
        if (this.chartSecretarias) {
            this.chartSecretarias.destroy();
            this.chartSecretarias = null;
        }
    }

    /**
     * Gráfico de torta - Distribución por Estado
     */
    crearGraficoEstados(): void {
        const canvas = document.getElementById('chartEstados') as HTMLCanvasElement;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const data = this.dashboardAnalytics.por_estado;
        
        this.chartEstados = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: data.map((d: any) => d.estado),
                datasets: [{
                    data: data.map((d: any) => d.cantidad),
                    backgroundColor: data.map((d: any) => d.color),
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            font: {
                                size: 12
                            },
                            padding: 15,
                            generateLabels: (chart) => {
                                const datasets = chart.data.datasets;
                                const total = (datasets[0].data as number[]).reduce((sum, val) => sum + val, 0);
                                return chart.data.labels?.map((label, i) => {
                                    const value = (datasets[0].data as number[])[i];
                                    const percentage = ((value / total) * 100).toFixed(1);
                                    return {
                                        text: `${label}: ${value} (${percentage}%)`,
                                        fillStyle: (datasets[0].backgroundColor as string[])[i],
                                        hidden: false,
                                        index: i
                                    };
                                }) || [];
                            }
                        }
                    },
                    title: {
                        display: true,
                        text: `Distribución de Productos por Estado (${this.filtroAnio})`,
                        font: {
                            size: 16,
                            weight: 'bold'
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                const label = context.label || '';
                                const value = context.parsed || 0;
                                const total = data.reduce((sum: number, d: any) => sum + d.cantidad, 0);
                                const percentage = ((value / total) * 100).toFixed(1);
                                return `${label}: ${value} productos (${percentage}%)`;
                            }
                        }
                    },
                    datalabels: {
                        display: true,
                        color: '#fff',
                        font: {
                            weight: 'bold',
                            size: 14
                        },
                        formatter: (value: number, context: any) => {
                            const total = (context.chart.data.datasets[0].data as number[]).reduce((sum: number, val: number) => sum + val, 0);
                            const percentage = ((value / total) * 100).toFixed(0);
                            return `${value}\n(${percentage}%)`;
                        }
                    }
                }
            }
        });
    }

    /**
     * Gráfico de barras - Análisis por Sector
     */
    crearGraficoSectores(): void {
        const canvas = document.getElementById('chartSectores') as HTMLCanvasElement;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const data = this.dashboardAnalytics.por_sector.slice(0, 10); // Top 10 sectores
        
        this.chartSectores = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.map((d: any) => d.sector.length > 30 ? d.sector.substring(0, 30) + '...' : d.sector),
                datasets: [
                    {
                        label: 'Completados',
                        data: data.map((d: any) => d.productos_completados),
                        backgroundColor: '#28a745',
                        borderColor: '#28a745',
                        borderWidth: 1
                    },
                    {
                        label: 'En Progreso',
                        data: data.map((d: any) => d.productos_en_progreso),
                        backgroundColor: '#17a2b8',
                        borderColor: '#17a2b8',
                        borderWidth: 1
                    },
                    {
                        label: 'Pendientes',
                        data: data.map((d: any) => d.productos_pendientes),
                        backgroundColor: '#ffc107',
                        borderColor: '#ffc107',
                        borderWidth: 1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        stacked: true,
                        ticks: {
                            font: {
                                size: 10
                            }
                        }
                    },
                    y: {
                        stacked: true,
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Número de Productos'
                        }
                    }
                },
                plugins: {
                    legend: {
                        position: 'top'
                    },
                    title: {
                        display: true,
                        text: `Top 10 Sectores - Estado de Productos (${this.filtroAnio})`,
                        font: {
                            size: 16,
                            weight: 'bold'
                        }
                    },
                    datalabels: {
                        display: true,
                        color: '#fff',
                        font: {
                            weight: 'bold',
                            size: 11
                        },
                        formatter: (value: any) => value > 0 ? value : '',
                        anchor: 'center',
                        align: 'center'
                    }
                }
            }
        });
    }

    /**
     * Gráfico de barras - Metas Totales vs Ejecutadas por Año
     */
    crearGraficoMetasEjecutadas(): void {
        const canvas = document.getElementById('chartMetasEjecutadas') as HTMLCanvasElement;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const anios = [2024, 2025, 2026, 2027];
        const metasTotales: number[] = [];
        const metasEjecutadas: number[] = [];

        // Calcular METAS como conteos (no presupuesto)
        // - Meta Total: número de productos con programacion_anio > 0
        // - Meta Ejecutada: número de productos con evidencia que cumple (según resumen anual)
        anios.forEach(anio => {
            let totalProductosConMeta = 0;
            let totalProductosCumplidos = 0;

            this.resumenProductos.forEach(producto => {
                const metaAnio = this.getMetaAnio(producto, anio);
                if (metaAnio && metaAnio > 0) {
                    totalProductosConMeta += 1;
                    const resumenAnual = this.pdmService.obtenerResumenActividadesPorAnio(producto, anio);
                    if (resumenAnual.meta_ejecutada >= resumenAnual.meta_programada && resumenAnual.meta_programada > 0) {
                        totalProductosCumplidos += 1;
                    }
                }
            });

            metasTotales.push(totalProductosConMeta);
            metasEjecutadas.push(totalProductosCumplidos);
        });
        
        this.chartMetasEjecutadas = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: anios.map(a => a.toString()),
                datasets: [
                    {
                        label: 'Meta Total Programada',
                        data: metasTotales,
                        backgroundColor: 'rgba(54, 162, 235, 0.7)',
                        borderColor: 'rgba(54, 162, 235, 1)',
                        borderWidth: 2
                    },
                    {
                        label: 'Meta Ejecutada',
                        data: metasEjecutadas,
                        backgroundColor: 'rgba(75, 192, 192, 0.7)',
                        borderColor: 'rgba(75, 192, 192, 1)',
                        borderWidth: 2
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Año',
                            font: {
                                size: 14,
                                weight: 'bold'
                            }
                        }
                    },
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Número de Metas (productos)',
                            font: {
                                size: 14,
                                weight: 'bold'
                            }
                        },
                        ticks: {
                            callback: (value) => {
                                return value.toLocaleString('es-CO');
                            }
                        }
                    }
                },
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            font: {
                                size: 13
                            },
                            padding: 15
                        }
                    },
                    title: {
                        display: true,
                        text: 'Metas Totales vs Ejecutadas por Año (2024-2027)',
                        font: {
                            size: 16,
                            weight: 'bold'
                        },
                        padding: {
                            bottom: 20
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                const label = context.dataset.label || '';
                                const value = context.parsed.y || 0;
                                const total = metasTotales[context.dataIndex];
                                const porcentaje = total > 0 ? ((value / total) * 100).toFixed(1) : '0';
                                return `${label}: ${value} (${porcentaje}% del total)`;
                            }
                        }
                    },
                    datalabels: {
                        display: true,
                        font: {
                            weight: 'bold',
                            size: 12
                        },
                        labels: {
                            // Etiqueta para el número (arriba de la barra)
                            value: {
                                anchor: 'end',
                                align: 'top',
                                color: '#444',
                                font: {
                                    weight: 'bold',
                                    size: 12
                                },
                                formatter: (value: any) => value
                            },
                            // Etiqueta para el porcentaje (dentro de la barra)
                            percentage: {
                                anchor: 'center',
                                align: 'center',
                                color: (context: any) => {
                                    const datasetIndex = context.datasetIndex;
                                    return datasetIndex === 0 ? '#28a745' : '#dc3545';
                                },
                                font: {
                                    weight: 'bold',
                                    size: 14
                                },
                                formatter: (value: any, context: any) => {
                                    const datasetIndex = context.datasetIndex;
                                    const dataIndex = context.dataIndex;
                                    const total = metasTotales[dataIndex];
                                    
                                    if (datasetIndex === 0) {
                                        return '100%';
                                    } else {
                                        const porcentaje = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
                                        return `${porcentaje}%`;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });
    }

    /**
     * Gráfico de barras - Presupuesto por Año
     */
    crearGraficoPresupuestoPorAnio(): void {
        const canvas = document.getElementById('chartPresupuestoPorAnio') as HTMLCanvasElement;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const data = this.dashboardAnalytics.analisis_presupuestal;
        
        this.chartPresupuestoPorAnio = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.map((d: any) => d.anio.toString()),
                datasets: [
                    {
                        label: 'Programado',
                        data: data.map((d: any) => d.presupuesto_programado),
                        backgroundColor: 'rgba(153, 102, 255, 0.6)',
                        borderColor: 'rgba(153, 102, 255, 1)',
                        borderWidth: 1
                    },
                    {
                        label: 'Con Actividades',
                        data: data.map((d: any) => d.presupuesto_asignado_actividades),
                        backgroundColor: 'rgba(255, 159, 64, 0.6)',
                        borderColor: 'rgba(255, 159, 64, 1)',
                        borderWidth: 1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Año'
                        }
                    },
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Presupuesto (COP)'
                        },
                        ticks: {
                            callback: (value) => {
                                return '$' + (value as number).toLocaleString('es-CO');
                            }
                        }
                    }
                },
                plugins: {
                    legend: {
                        position: 'top'
                    },
                    title: {
                        display: true,
                        text: 'Análisis Presupuestal por Año',
                        font: {
                            size: 16,
                            weight: 'bold'
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                const label = context.dataset.label || '';
                                const value = context.parsed.y || 0;
                                return `${label}: $${value.toLocaleString('es-CO')}`;
                            }
                        }
                    },
                    datalabels: {
                        display: true,
                        anchor: 'end',
                        align: 'top',
                        color: '#444',
                        font: {
                            weight: 'bold',
                            size: 10
                        },
                        formatter: (value: any) => {
                            const millones = value / 1000000;
                            return millones >= 1 ? `$${millones.toFixed(1)}M` : `$${(value / 1000).toFixed(0)}K`;
                        }
                    }
                }
            }
        });
    }

    /**
     * Gráfico de dona - Objetivos de Desarrollo Sostenible
     */
    crearGraficoODS(): void {
        const canvas = document.getElementById('chartODS') as HTMLCanvasElement;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const data = this.dashboardAnalytics.por_ods.slice(0, 10); // Top 10 ODS
        
        // Colores vibrantes para ODS
        const colores = [
            '#E5243B', '#DDA63A', '#4C9F38', '#C5192D', '#FF3A21',
            '#26BDE2', '#FCC30B', '#A21942', '#FD6925', '#DD1367'
        ];
        
        this.chartODS = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: data.map((d: any) => {
                    const ods = d.ods.length > 40 ? d.ods.substring(0, 40) + '...' : d.ods;
                    return `${ods} (${d.total_productos})`;
                }),
                datasets: [{
                    data: data.map((d: any) => d.total_productos),
                    backgroundColor: colores,
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            font: {
                                size: 11
                            },
                            padding: 10,
                            boxWidth: 15
                        }
                    },
                    title: {
                        display: true,
                        text: `Top 10 Objetivos de Desarrollo Sostenible (${this.filtroAnio})`,
                        font: {
                            size: 16,
                            weight: 'bold'
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                const item = data[context.dataIndex];
                                const productos = item.total_productos;
                                const avance = item.porcentaje_avance_promedio.toFixed(1);
                                const presupuesto = item.presupuesto_asignado.toLocaleString('es-CO');
                                return [
                                    `Productos: ${productos}`,
                                    `Avance: ${avance}%`,
                                    `Presupuesto: $${presupuesto}`
                                ];
                            }
                        }
                    },
                    datalabels: {
                        display: true,
                        color: '#fff',
                        font: {
                            weight: 'bold',
                            size: 11
                        },
                        formatter: (value: any, context: any) => {
                            const total = (context.chart.data.datasets[0].data as number[]).reduce((a: number, b: number) => a + b, 0);
                            const percentage = ((value / total) * 100).toFixed(0);
                            return `${value}\n(${percentage}%)`;
                        }
                    }
                }
            }
        });
    }

    /**
     * Gráfico de barras horizontales - Análisis Detallado por Sector
     */
    crearGraficoSectoresDetalle(): void {
        const canvas = document.getElementById('chartSectoresDetalle') as HTMLCanvasElement;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const data = this.dashboardAnalytics.por_sector.slice(0, 8); // Top 8 sectores
        
        this.chartSectoresDetalle = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.map((d: any) => d.sector.length > 35 ? d.sector.substring(0, 35) + '...' : d.sector),
                datasets: [{
                    label: '% Avance Promedio',
                    data: data.map((d: any) => d.porcentaje_avance),
                    backgroundColor: data.map((d: any) => {
                        const avance = d.porcentaje_avance;
                        if (avance >= 75) return 'rgba(40, 167, 69, 0.7)';
                        if (avance >= 50) return 'rgba(255, 193, 7, 0.7)';
                        if (avance >= 25) return 'rgba(255, 152, 0, 0.7)';
                        return 'rgba(220, 53, 69, 0.7)';
                    }),
                    borderColor: data.map((d: any) => {
                        const avance = d.porcentaje_avance;
                        if (avance >= 75) return 'rgba(40, 167, 69, 1)';
                        if (avance >= 50) return 'rgba(255, 193, 7, 1)';
                        if (avance >= 25) return 'rgba(255, 152, 0, 1)';
                        return 'rgba(220, 53, 69, 1)';
                    }),
                    borderWidth: 2
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        beginAtZero: true,
                        max: 100,
                        title: {
                            display: true,
                            text: 'Porcentaje de Avance (%)',
                            font: {
                                size: 14,
                                weight: 'bold'
                            }
                        },
                        ticks: {
                            callback: (value) => value + '%'
                        }
                    },
                    y: {
                        ticks: {
                            font: {
                                size: 11
                            }
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    title: {
                        display: true,
                        text: `Top 8 Sectores - Porcentaje de Avance (${this.filtroAnio})`,
                        font: {
                            size: 16,
                            weight: 'bold'
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                const item = data[context.dataIndex];
                                return [
                                    `Avance: ${item.porcentaje_avance.toFixed(1)}%`,
                                    `Productos: ${item.total_productos}`,
                                    `Completados: ${item.productos_completados}`,
                                    `En Progreso: ${item.productos_en_progreso}`,
                                    `Pendientes: ${item.productos_pendientes}`
                                ];
                            }
                        }
                    },
                    datalabels: {
                        display: true,
                        anchor: 'end',
                        align: 'end',
                        color: '#444',
                        font: {
                            weight: 'bold',
                            size: 11
                        },
                        formatter: (value: any) => `${value.toFixed(1)}%`
                    }
                }
            }
        });
    }

    /**
     * Crea gráfico de desempeño por secretaría
     */
    crearGraficoSecretarias() {
        if (!this.analisisPorSecretaria || this.analisisPorSecretaria.length === 0) {
            return;
        }

        const canvasElement = document.getElementById('chartSecretarias') as HTMLCanvasElement;
        if (!canvasElement) {
            return;
        }

        // Ordenar por avance descendente para mejor visualización
        const secretariasOrdenadas = [...this.analisisPorSecretaria].sort((a, b) => 
            b.porcentaje_avance_promedio - a.porcentaje_avance_promedio
        );

        // Colores según desempeño
        const getColor = (avance: number) => {
            if (avance >= 80) return 'rgba(75, 192, 75, 0.7)'; // Verde
            if (avance >= 50) return 'rgba(255, 206, 86, 0.7)'; // Amarillo
            if (avance >= 20) return 'rgba(255, 159, 64, 0.7)'; // Naranja
            return 'rgba(255, 99, 132, 0.7)'; // Rojo
        };

        const data = {
            labels: secretariasOrdenadas.map(s => s.nombre_secretaria),
            datasets: [{
                label: 'Avance Promedio (%)',
                data: secretariasOrdenadas.map(s => s.porcentaje_avance_promedio),
                backgroundColor: secretariasOrdenadas.map(s => getColor(s.porcentaje_avance_promedio)),
                borderColor: secretariasOrdenadas.map(s => getColor(s.porcentaje_avance_promedio).replace('0.7', '1')),
                borderWidth: 2
            }]
        };

        const ctx = canvasElement.getContext('2d');
        if (!ctx) return;

        // Destruir gráfico anterior si existe
        if (this.chartSecretarias) {
            this.chartSecretarias.destroy();
        }

        this.chartSecretarias = new Chart(ctx, {
            type: 'bar',
            data: data,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y',
                plugins: {
                    legend: {
                        display: true,
                        position: 'top'
                    },
                    title: {
                        display: true,
                        text: 'Desempeño por Secretaría'
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                const item = secretariasOrdenadas[context.dataIndex];
                                const completados = item.productos_completados ?? 0;
                                const enProgreso = item.productos_en_progreso ?? 0;
                                const pendientes = item.productos_pendientes ?? 0;
                                const porEjecutar = item.productos_por_ejecutar ?? 0;
                                const actividades = `${(item.actividades_completadas ?? 0)}/${(item.total_actividades ?? 0)}`;
                                return [
                                    `Avance: ${item.porcentaje_avance_promedio.toFixed(1)}%`,
                                    `Productos: ${item.total_productos}`,
                                    `Completados: ${completados}`,
                                    `En Progreso: ${enProgreso}`,
                                    `Pendientes: ${pendientes}`,
                                    `Por Ejecutar: ${porEjecutar}`,
                                    `Actividades: ${actividades}`
                                ];
                            }
                        }
                    },
                    datalabels: {
                        display: true,
                        anchor: 'end',
                        align: 'end',
                        color: '#444',
                        font: {
                            weight: 'bold',
                            size: 11
                        },
                        formatter: (value: any) => `${value.toFixed(1)}%`
                    }
                },
                scales: {
                    y: {
                        ticks: {
                            autoSkip: false,
                            font: {
                                size: 12
                            }
                        }
                    },
                    x: {
                        beginAtZero: true,
                        max: 100,
                        ticks: {
                            callback: (value) => value + '%'
                        }
                    }
                },
                layout: {
                    padding: {
                        left: 10,
                        right: 20
                    }
                }
            }
        });
    }

    /**
     * Filtra secretarios por secretaría (sector)
     */
    secretariosPorSecretaria(sector: string): any[] {
        if (!sector) {
            return this.secretarios;
        }
        
        // Buscar en secretarías agrupadas
        const secretariaEncontrada = this.secretariasAgrupadas.find(s => 
            s.nombre.toLowerCase().includes(sector.toLowerCase()) || 
            sector.toLowerCase().includes(s.nombre.toLowerCase())
        );
        
        if (secretariaEncontrada) {
            return secretariaEncontrada.responsables;
        }
        
        // Fallback: filtrar por coincidencia en el campo secretaria del usuario
        const secretariosFiltrados = this.secretarios.filter(s => {
            const secretariaNombre = s.secretaria?.toLowerCase() || '';
            const sectorNombre = sector.toLowerCase();
            return secretariaNombre.includes(sectorNombre) || sectorNombre.includes(secretariaNombre);
        });
        
        return secretariosFiltrados.length > 0 ? secretariosFiltrados : this.secretarios;
    }

    /**
     * Asigna una SECRETARÍA como responsable de un producto
     * ✅ Todos los usuarios de esa secretaría verán el producto
     */
    asignarResponsable(producto: ResumenProducto, event: Event): void {
        const select = event.target as HTMLSelectElement;
        let selectedValue = select.value;
        if (!selectedValue || selectedValue === '') {
            console.error('❌ No se seleccionó ninguna secretaría');
            return;
        }

        // Convertir a número si es posible
        let secretariaIdNumerico = parseInt(selectedValue, 10);
        
        
        if (isNaN(secretariaIdNumerico)) {
            console.error('❌ El valor seleccionado no es un número válido:', selectedValue);
            return;
        }

        // Buscar la secretaría en secretariasAgrupadas para obtener su nombre
        const secretariaSeleccionada = this.secretariasAgrupadas.find(s => {
            // Comparar como números
            const sIdNum = typeof s.id === 'number' ? s.id : parseInt(String(s.id), 10);
            return sIdNum === secretariaIdNumerico;
        });
        
        if (!secretariaSeleccionada) {
            console.error('❌ Secretaría no encontrada en la lista');
            return;
        }

        const secretariaNombre = secretariaSeleccionada.nombre;
        this.pdmService.asignarResponsableProducto(producto.codigo, secretariaIdNumerico).subscribe({
            next: (response) => {
                // Actualizar el producto en la lista
                const nuevoId = response.responsable_secretaria_id;
                const nuevoNombre = response.responsable_secretaria_nombre;
                producto.responsable_secretaria_id = nuevoId; // ✅ Usar responsable_secretaria_id
                producto.responsable_secretaria_nombre = nuevoNombre; // ✅ Usar responsable_secretaria_nombre
                
                // Forzar actualización del select al nuevo valor
                select.value = nuevoId?.toString() || '';
                this.showToast(`Secretaría "${nuevoNombre}" asignada al producto ${producto.codigo}`, 'success');
            },
            error: (error) => {
                console.error('❌ Error al asignar secretaría:', error);
                this.showToast('Error al asignar secretaría: ' + (error.error?.detail || error.message), 'error');
                
                // Revertir selección
                select.value = producto.responsable_secretaria_id?.toString() || '';
            }
        });
    }

    /**
     * Filtra productos por línea estratégica desde stat-card clickeable
     * ✅ OPTIMIZADO: requestAnimationFrame en lugar de setTimeout
     */
    filtrarPorLinea(): void {
        this.navegarA('productos');
        
        requestAnimationFrame(() => {
            const filtrosElement = document.querySelector('.filtros-section');
            if (filtrosElement) {
                filtrosElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    }

    /**
     * Filtra productos por iniciativa SGR desde stat-card clickeable
     * ✅ OPTIMIZADO: requestAnimationFrame en lugar de setTimeout
     */
    filtrarPorIniciativa(): void {
        this.navegarA('productos');
        
        requestAnimationFrame(() => {
            const filtrosElement = document.querySelector('.filtros-section');
            if (filtrosElement) {
                filtrosElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    }

    // ============================================
    // ✅ PLAN DE ACCIÓN - EXPORTACIÓN EXCEL
    // ============================================

    /**
     * Abre el modal para exportar Plan de Acción
     */
    abrirModalPlanAccion(): void {
        this.mostrarModalPlanAccion = true;
        this.planAccionAnio = new Date().getFullYear();
        this.planAccionSecretariaIds = [];  // Vacío = todas
        
        // Cargar filtros disponibles (secretarías) si no están cargados
        if (!this.filtrosInformeDisponibles) {
            this.cargarFiltrosInforme();
        }
    }

    /**
     * Cierra el modal de Plan de Acción
     */
    cerrarModalPlanAccion(): void {
        this.mostrarModalPlanAccion = false;
        this.planAccionAnio = new Date().getFullYear();
        this.planAccionSecretariaIds = [];
        this.exportandoPlanAccion = false;
    }

    /**
     * Toggle para seleccionar/deseleccionar todas las secretarías
     */
    toggleTodasSecretarias(): void {
        // Toggle: si hay alguna seleccionada, limpiar; si está vacío, mantener vacío
        if (this.planAccionSecretariaIds.length > 0) {
            this.planAccionSecretariaIds = [];
        }
        // No hacer nada si ya está vacío (ya está en modo "todas")
    }

    /**
     * Toggle para agregar/quitar una secretaría de la selección
     */
    toggleSecretaria(secretariaId: number): void {
        const index = this.planAccionSecretariaIds.indexOf(secretariaId);
        if (index > -1) {
            // Ya está seleccionada, quitarla
            this.planAccionSecretariaIds.splice(index, 1);
        } else {
            // No está seleccionada, agregarla
            this.planAccionSecretariaIds.push(secretariaId);
        }
    }

    /**
     * Confirma y ejecuta la exportación del Plan de Acción
     */
    confirmarExportarPlanAccion(): void {
        const slug = this.pdmService.getEntitySlug();
        if (!slug) {
            alert('Error: No se pudo obtener la entidad actual');
            return;
        }

        this.exportandoPlanAccion = true;

        // Construir URL usando environment directamente
        let url = `${environment.apiUrl}/pdm/informes/${slug}/exportar/plan-accion/${this.planAccionAnio}`;
        
        // Agregar secretarías si están seleccionadas (solo para admins)
        if (this.isAdmin() && this.planAccionSecretariaIds.length > 0) {
            const params = this.planAccionSecretariaIds.map(id => `secretaria_ids=${id}`).join('&');
            url += `?${params}`;
        }

        console.log('📥 Exportando Plan de Acción:', url);

        // Descargar archivo
        this.pdmService.descargarArchivo(url, `plan-accion-${this.planAccionAnio}.xlsx`).subscribe({
            next: () => {
                console.log('✅ Plan de Acción exportado');
                this.exportandoPlanAccion = false;
                this.cerrarModalPlanAccion();
                alert('Plan de Acción exportado exitosamente');
            },
            error: (error) => {
                console.error('❌ Error exportando Plan de Acción:', error);
                this.exportandoPlanAccion = false;
                const mensaje = error.error?.detail || error.message || 'Error desconocido';
                alert(`Error al exportar Plan de Acción: ${mensaje}`);
            }
        });
    }

}
