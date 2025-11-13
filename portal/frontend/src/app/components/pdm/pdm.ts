import { Component, inject, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Location } from '@angular/common';
import { PdmService } from '../../services/pdm.service';
import { PdmEjecucionService } from '../../services/pdm-ejecucion.service';
import { AlertsService, Alert } from '../../services/alerts.service';
import { AuthService } from '../../services/auth.service';
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
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { forkJoin, of } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';

// Registrar los componentes de Chart.js
Chart.register(...registerables);

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
    private fb = inject(FormBuilder);
    private alertsService = inject(AlertsService);
    private authService = inject(AuthService);
    private location = inject(Location);

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
    mostrarModalEvidencia = false;
    actividadEnEdicion: ActividadPDM | null = null;
    actividadParaEvidencia: ActividadPDM | null = null;
    
    // Formularios
    formularioActividad!: FormGroup;
    formularioEvidencia!: FormGroup;

    // Secretarios para dropdown
    secretarios: any[] = [];
    cargandoSecretarios = false;
    
    // Secretarías agrupadas con responsables
    secretariasAgrupadas: any[] = [];

    // Filtros
    filtroLinea = '';
    filtroSector = '';
    filtroODS = '';
    filtroTipoAcumulacion = '';
    filtroEstado = '';
    filtroBusqueda = '';
    filtroAnio = new Date().getFullYear(); // Año actual por defecto
    filtroSecretaria = ''; // ✅ Nuevo filtro por secretaría
    
    // Años disponibles
    aniosDisponibles = [2024, 2025, 2026, 2027];
    
    // ✅ OPTIMIZACIÓN: Debounce timer para búsqueda
    private debounceTimer: any = null;
    private readonly DEBOUNCE_DELAY = 300; // ms
    
    // Modal BPIN
    mostrarModalBPIN = false;
    proyectoBPIN: any = null;
    cargandoBPIN = false;

    // Ejecución Presupuestal
    ejecucionPresupuestal: PDMEjecucionResumen | null = null;
    cargandoEjecucion = false;
    archivoEjecucionCargado = false;

    // ✅ NUEVO: Indicador de carga de actividades desde backend
    cargandoActividadesBackend = false;

    // Modal Análisis Producto
    mostrarModalAnalisisProducto = false;
    chartProgresoAnual: any = null;
    chartMetaEjecutado: any = null;
    chartPresupuestoAnual: any = null;

    // Analytics
    dashboardAnalytics: any = null;
    analisisPorSecretaria: any[] = []; // ✅ NUEVO: Análisis por secretaría

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

        // Filtrar productos con meta > 0 para el año seleccionado
        productos = productos.filter(p => {
            const meta = this.getMetaAnio(p, this.filtroAnio);
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
                this.getEstadoProductoAnio(p, this.filtroAnio) === this.filtroEstado
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
     * ✅ NUEVO: Obtener productos filtrados por estado (para mostrar en dashboard)
     */
    getProductosFiltrados(): ResumenProducto[] {
        if (!this.resumenProductos) return [];
        
        let productos = [...this.resumenProductos];
        
        // Filtrar por estado
        if (this.filtroEstado) {
            productos = productos.filter(p => 
                this.getEstadoProductoAnio(p, this.filtroAnio) === this.filtroEstado
            );
        }
        
        // Ordenar por código de menor a mayor
        productos.sort((a, b) => {
            const codeA = parseInt(a.codigo?.replace(/\D/g, '') || '0', 10);
            const codeB = parseInt(b.codigo?.replace(/\D/g, '') || '0', 10);
            return codeA - codeB;
        });
        
        return productos;
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
    ngOnInit(): void {
        // Esperar a que el entity slug esté disponible antes de verificar datos
        this.verificarDatosBackendConEspera();
        this.cargarSecretarios();
        
        // Verificar si hay que abrir un producto desde una alerta
        this.verificarProductoDesdeAlerta();
        
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
     * Verifica datos del backend con espera para entity slug
     */
    private verificarDatosBackendConEspera(): void {
        // Esperar en un pequeño intervalo a que el entity slug esté disponible
        let intentos = 0;
        const verificar = () => {
            intentos++;
            const slug = this.pdmService.getEntitySlug();
            
            if (slug) {
                this.verificarDatosBackend();
            } else if (intentos < 50) {
                // Reintentar después de 100ms (máximo 5 segundos)
                setTimeout(verificar, 100);
            } else {
                console.warn('⚠️ Entity slug no disponible después de 5 segundos, continuando sin datos del backend');
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
        
        // Buscar si hay datos de producto o actividad en sessionStorage
        const productoCodigo = sessionStorage.getItem('pdm_open_producto');
        const actividadId = sessionStorage.getItem('pdm_open_actividad');
        
        if (productoCodigo || actividadId) {
            if (productoCodigo) {
                sessionStorage.removeItem('pdm_open_producto');
            }
            if (actividadId) {
                sessionStorage.removeItem('pdm_open_actividad');
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
                                // Guardar ID de actividad para que el componente de detalle la destace
                                sessionStorage.setItem('pdm_scroll_to_actividad', actividadId);
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
            
            // Timeout de seguridad de 10 segundos
            setTimeout(() => clearInterval(interval), 10000);
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
                
                // Generar analytics iniciales
                this.generarAnalytics();
                
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
        if (!input.files || input.files.length === 0) return;

        const file = input.files[0];
        
        // Validar extensión
        const extension = file.name.split('.').pop()?.toLowerCase();
        if (extension !== 'xlsx' && extension !== 'xls' && extension !== 'csv') {
            this.showToast('Por favor seleccione un archivo válido (.xlsx, .xls o .csv)', 'error');
            return;
        }

        this.cargarArchivoEjecucion(file);
    }

    /**
     * Carga el archivo de ejecución presupuestal al backend
     */
    private cargarArchivoEjecucion(file: File) {
        this.cargando = true;
        this.pdmEjecucionService.uploadEjecucion(file).subscribe({
            next: (response) => {
                this.cargando = false;
                this.archivoEjecucionCargado = true;
                
                const mensaje = `Excel de ejecución cargado: ${response.registros_insertados} registros procesados`;
                this.showToast(mensaje, 'success');
                
                // Si hay errores, mostrarlos en consola
                if (response.errores && response.errores.length > 0) {
                    console.warn('⚠️ Errores al procesar ejecución:', response.errores);
                }
                
                // Si hay un producto seleccionado, recargar su ejecución
                if (this.productoSeleccionado) {
                    this.cargarEjecucionPresupuestal(this.productoSeleccionado.codigo);
                }
            },
            error: (error) => {
                console.error('❌ Error al cargar ejecución:', error);
                this.cargando = false;
                const mensaje = error.error?.detail || 'Error al cargar el archivo de ejecución';
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
            // Cargar actividades desde backend al abrir el detalle del producto
            this.actualizarResumenActividades(true);
            // Cargar ejecución presupuestal si está disponible
            this.cargarEjecucionPresupuestal(producto.codigo);
        } else if (vista === 'analisis-producto') {
            this.recargarAnalisisProducto();
        }
    }

    /**
     * Vuelve a la vista anterior
     */
    volver() {
        if (this.vistaActual === 'analisis-producto') {
            this.vistaActual = 'detalle';
        } else if (this.vistaActual === 'detalle') {
            this.vistaActual = 'productos';
            this.productoSeleccionado = null;
            this.ejecucionPresupuestal = null;
        } else if (this.vistaActual === 'productos') {
            this.vistaActual = 'dashboard';
        } else if (this.vistaActual === 'analytics') {
            this.vistaActual = 'dashboard';
        }
    }

    /**
     * Carga la ejecución presupuestal para un producto PDM
     */
    private cargarEjecucionPresupuestal(codigoProducto: string): void {
        this.cargandoEjecucion = true;
        this.ejecucionPresupuestal = null;

        this.pdmEjecucionService.getEjecucionPorProducto(codigoProducto).subscribe({
            next: (ejecucion) => {
                this.ejecucionPresupuestal = ejecucion;
                this.cargandoEjecucion = false;
            },
            error: (error) => {
                this.ejecucionPresupuestal = null;
                this.cargandoEjecucion = false;
            }
        });
    }

    /**
     * Recarga el dashboard con datos frescos del backend
     */
    private recargarDashboard(): void {
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
                this.productoSeleccionado = null;
                this.cargandoDesdeBackend = false;
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
     * Recarga la lista de productos con datos frescos del backend
     * IMPORTANTE: Ahora también sincroniza actividades de todos los productos
     */
    private recargarProductos(): void {
        if (!this.datosEnBackend) {
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
                
                // ✅ CRÍTICO: Cargar actividades de TODOS los productos
                this.cargarActividadesTodosProductos().then(() => {
                    // IMPORTANTE: Recalcular avance DESPUÉS de sincronizar actividades
                    this.resumenProductos = this.pdmService.generarResumenProductos(data);
                    this.estadisticas = this.pdmService.calcularEstadisticas(data);
                });
                
                this.cargandoDesdeBackend = false;
            },
            error: (error) => {
                console.warn('⚠️ Error al recargar productos:', error);
                this.cargandoDesdeBackend = false;
            }
        });
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
     */
    private recargarAnalisisProducto(): void {
        if (!this.productoSeleccionado) {
            console.warn('⚠️ No hay producto seleccionado');
            return;
        }
        
        // Crear gráficos con datos actuales
        setTimeout(() => {
            this.crearGraficosAnalisisProducto();
        }, 100);
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
    onCambioFiltro() {
    }

    /**
     * ✅ OPTIMIZACIÓN: Se ejecuta cuando cambia el filtro de línea estratégica
     * Solo filtra en memoria, SIN hacer petición al backend
     */
    onCambioFiltroLinea() {
        // ✅ NO llamar a recargarSegunFiltros() - solo filtrar en memoria
    }

    /**
     * ✅ OPTIMIZACIÓN: Se ejecuta cuando cambia el filtro de sector
     * Solo filtra en memoria, SIN hacer petición al backend
     */
    onCambioFiltroSector() {
        // ✅ NO llamar a recargarSegunFiltros() - solo filtrar en memoria
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
            // ✅ NO llamar a recargarSegunFiltros() - solo filtrar en memoria
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
        // ✅ LUEGO: SIEMPRE intentar cargar desde backend si se solicita
        // No importa si datosEnBackend es false, intentamos cargar de todas formas
        if (cargarDesdeBackend) {
            this.cargarActividadesDesdeBackend();
        }
    }

    /**
     * Carga las actividades desde el backend para el producto seleccionado
     * ✅ Con indicador visual de carga
     */
    private cargarActividadesDesdeBackend() {
        if (!this.productoSeleccionado) return;

        // ✅ MOSTRAR indicador de carga
        this.cargandoActividadesBackend = true;

        // Verificar que el entity slug esté disponible
        const slug = this.pdmService.getEntitySlug();
        if (!slug) {
            console.warn('⚠️ Entity slug no disponible aún, esperando...');
            let intentos = 0;
            const reintentar = () => {
                intentos++;
                const slugActual = this.pdmService.getEntitySlug();
                if (slugActual) {
                    this.cargarActividadesDesdeBackend();
                } else if (intentos < 30) {
                    setTimeout(reintentar, 100);
                } else {
                    console.error('❌ No se puede cargar del backend sin entity slug');
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

        this.formularioActividad = this.fb.group({
            nombre: ['', [Validators.required, Validators.minLength(5)]],
            descripcion: ['', [Validators.required, Validators.minLength(10)]],
            responsable_secretaria_id: [null, Validators.required],
            estado: ['PENDIENTE', Validators.required],
            fecha_inicio: ['', Validators.required],
            fecha_fin: ['', Validators.required],
            meta_ejecutar: [0, [Validators.required, Validators.min(0.01), Validators.max(metaDisponible)]]
        });

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
            meta_ejecutar: [actividad.meta_ejecutar, [Validators.required, Validators.min(0.01), Validators.max(validacion.disponible)]]
        });

        // Cargar lista de secretarios
        this.cargarSecretarios();

        this.mostrarModalActividad = true;
    }

    /**
     * Guarda una actividad (crear o actualizar)
     */
    guardarActividad() {
        if (!this.formularioActividad.valid || !this.productoSeleccionado) return;

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
            responsable_secretaria_id: valores.responsable_secretaria_id, // ID de la secretaría responsable
            estado: valores.estado,
            fecha_inicio: new Date(valores.fecha_inicio).toISOString(),
            fecha_fin: new Date(valores.fecha_fin).toISOString(),
            meta_ejecutar: valores.meta_ejecutar
        };

        if (this.actividadEnEdicion) {
            // Actualizar
            this.pdmService.actualizarActividad(this.actividadEnEdicion.id!, actividadData).subscribe({
                next: () => {
                    this.showToast('Actividad actualizada exitosamente', 'success');
                    this.cerrarModalActividad();
                    this.actualizarResumenActividades();
                },
                error: () => {
                    this.showToast('Error al actualizar la actividad', 'error');
                }
            });
        } else {
            // Crear
            this.pdmService.crearActividad(actividadData).subscribe({
                next: () => {
                    this.showToast('Actividad creada exitosamente', 'success');
                    this.cerrarModalActividad();
                    this.actualizarResumenActividades();
                },
                error: () => {
                    this.showToast('Error al crear la actividad', 'error');
                }
            });
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
                this.showToast('Actividad eliminada exitosamente', 'success');
                this.actualizarResumenActividades();
            },
            error: () => {
                this.showToast('Error al eliminar la actividad', 'error');
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
     * Abre el modal para registrar evidencia
     */
    abrirModalEvidencia(actividad: ActividadPDM) {
        if (actividad.evidencia) {
            this.showToast('Esta actividad ya tiene evidencia registrada', 'info');
            return;
        }

        this.actividadParaEvidencia = actividad;
        this.formularioEvidencia = this.fb.group({
            descripcion: ['', [Validators.required, Validators.minLength(10)]],
            url_evidencia: [''],
            imagenes: [[]]
        }, {
            validators: this.validarEvidenciaRequerida
        });

        this.mostrarModalEvidencia = true;
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
     * Validador custom: debe haber URL o al menos una imagen
     */
    validarEvidenciaRequerida(group: FormGroup): {[key: string]: boolean} | null {
        const url = group.get('url_evidencia')?.value;
        const imagenes = group.get('imagenes')?.value || [];
        
        const tieneUrl = url && url.trim() !== '';
        const tieneImagenes = imagenes.length > 0;
        
        if (!tieneUrl && !tieneImagenes) {
            return { evidenciaRequerida: true };
        }
        
        return null;
    }

    /**
     * Maneja la carga de imágenes para evidencia
     */
    onImagenesSeleccionadas(event: Event) {
        const input = event.target as HTMLInputElement;
        if (!input.files) return;

        const files = Array.from(input.files);
        
        // Validar cantidad
        if (files.length > 4) {
            this.showToast('Máximo 4 imágenes permitidas', 'error');
            return;
        }

        // Validar tamaño (2MB por imagen)
        const maxSize = 2 * 1024 * 1024; // 2MB
        const archivosGrandes = files.filter(f => f.size > maxSize);
        if (archivosGrandes.length > 0) {
            this.showToast('Cada imagen debe pesar máximo 2MB', 'error');
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

        Promise.all(promesas).then(imagenes => {
            this.formularioEvidencia.patchValue({ imagenes });
        }).catch(() => {
            this.showToast('Error al procesar las imágenes', 'error');
        });
    }

    /**
     * Guarda la evidencia y marca la actividad como completada
     */
    guardarEvidencia() {
        if (!this.formularioEvidencia.valid || !this.actividadParaEvidencia) return;

        const valores = this.formularioEvidencia.value;
        const evidencia: EvidenciaActividad = {
            descripcion: valores.descripcion,
            url_evidencia: valores.url_evidencia || undefined,
            imagenes: valores.imagenes || [],
            fecha_registro: new Date().toISOString()
        };

        this.pdmService.registrarEvidencia(this.actividadParaEvidencia.id!, evidencia).subscribe({
            next: () => {
                this.showToast('Evidencia registrada exitosamente. Actividad completada.', 'success');
                this.cerrarModalEvidencia();
                // Recargar actividades desde backend para reflejar el estado actualizado
                this.actualizarResumenActividades(true);
            },
            error: () => {
                this.showToast('Error al registrar la evidencia', 'error');
            }
        });
    }

    /**
     * Cierra el modal de evidencia
     */
    cerrarModalEvidencia() {
        this.mostrarModalEvidencia = false;
        this.actividadParaEvidencia = null;
        this.formularioEvidencia.reset();
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
     * Abre una imagen en una nueva ventana para verla en grande
     */
    verImagenGrande(imagenBase64: string) {
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
                        <img src="${imagenBase64}" alt="Evidencia">
                    </body>
                </html>
            `);
        }
    }

    /**
     * Obtiene el avance de un producto para un año específico
     */
    getAvanceAnio(producto: ResumenProducto, anio: number): number {
        const resumen = this.pdmService.obtenerResumenActividadesPorAnio(producto, anio);
        return resumen.porcentaje_avance;
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
        if (producto.codigo === '2201029') {
        }

        // Año futuro: siempre POR_EJECUTAR
        if (anio > new Date().getFullYear()) {
            return 'POR_EJECUTAR';
        }

        // ✅ Basado en el avance calculado
        // Estado COMPLETADO: avance EXACTAMENTE 100%
        if (avance === 100) {
            if (producto.codigo === '2201029') {
            }
            return 'COMPLETADO';
        }
        
        if (avance === 0 && resumenActividades.total_actividades === 0) {
            return 'PENDIENTE'; // Sin actividades creadas aún
        }
        
        // Si tiene actividades: EN_PROGRESO
        if (resumenActividades.total_actividades > 0) {
            if (producto.codigo === '2201029') {
            }
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
    getEstadisticasPorEstado(): {
        pendiente: number;
        en_progreso: number;
        completado: number;
        por_ejecutar: number;
        total: number;
    } {
        // Filtrar solo productos con meta > 0 para el año seleccionado
        const productos = this.resumenProductos.filter(producto => {
            const meta = this.getMetaAnio(producto, this.filtroAnio);
            return meta > 0;
        });

        let pendiente = 0;
        let en_progreso = 0;
        let completado = 0;
        let por_ejecutar = 0;

        productos.forEach(producto => {
            const estado = this.getEstadoProductoAnio(producto, this.filtroAnio);
            switch (estado) {
                case 'PENDIENTE': pendiente++; break;
                case 'EN_PROGRESO': en_progreso++; break;
                case 'COMPLETADO': completado++; break;
                case 'POR_EJECUTAR': por_ejecutar++; break;
            }
        });

        return {
            pendiente,
            en_progreso,
            completado,
            por_ejecutar,
            total: productos.length
        };
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
     */
    obtenerMetaEjecutadaTotal(): number {
        const anios = [2024, 2025, 2026, 2027];
        return anios.reduce((total, anio) => total + this.obtenerMetaEjecutada(anio), 0);
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
     */
    generarAnalytics(): void {
        this.dashboardAnalytics = this.pdmService.generarDashboardAnalytics(
            this.resumenProductos,
            this.filtroAnio
        );
        // ✅ NUEVO: Generar análisis por secretaría
        this.analisisPorSecretaria = this.pdmService.generarAnaliasisPorSecretaria(
            this.resumenProductos,
            this.filtroAnio
        );
    }

    /**
     * ✅ NUEVO: Ver análisis detallado del producto
     */
    verAnalisisProducto(producto: ResumenProducto): void {
        this.navegarA('analisis-producto', producto);
    }

    /**
     * Navega a la vista de analytics y recarga datos del backend
     * CRÍTICO: Ahora también sincroniza actividades antes de generar gráficos
     */
    verAnalytics(): void {
        // ✅ CRÍTICO: Mostrar indicador de carga
        this.vistaActual = 'analytics';
        this.cargandoDesdeBackend = true;
        
        if (!this.datosEnBackend) {
            // Sin datos en backend, usar lo que hay en memoria
            this.generarAnalytics();
            this.cargandoDesdeBackend = false;
            setTimeout(() => this.crearGraficos(), 100);
            return;
        }
        
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
                            padding: 15
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

        // Calcular metas totales y ejecutadas por año
        anios.forEach(anio => {
            let metaTotal = 0;
            let metaEjecutada = 0;

            this.resumenProductos.forEach(producto => {
                const metaAnio = this.getMetaAnio(producto, anio);
                const avanceAnio = this.getAvanceAnio(producto, anio);
                
                metaTotal += metaAnio;
                metaEjecutada += (metaAnio * avanceAnio / 100);
            });

            metasTotales.push(metaTotal);
            metasEjecutadas.push(metaEjecutada);
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
                            text: 'Valor de Meta',
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
                                return `${label}: ${value.toLocaleString('es-CO')} (${porcentaje}% del total)`;
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
                maintainAspectRatio: true,
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
                                return [
                                    `Avance: ${item.porcentaje_avance_promedio.toFixed(1)}%`,
                                    `Productos: ${item.total_productos}`,
                                    `Completados: ${item.completados}`,
                                    `En Progreso: ${item.en_progreso}`,
                                    `Pendientes: ${item.pendientes}`,
                                    `Actividades: ${item.actividades_completadas}/${item.total_actividades}`
                                ];
                            }
                        }
                    }
                },
                scales: {
                    x: {
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
     */
    filtrarPorLinea(): void {
        this.navegarA('productos');
        
        // Scroll a los filtros
        setTimeout(() => {
            const filtrosElement = document.querySelector('.filtros-section');
            if (filtrosElement) {
                filtrosElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }, 300);
    }

    /**
     * Filtra productos por iniciativa SGR desde stat-card clickeable
     */
    filtrarPorIniciativa(): void {
        this.navegarA('productos');
        
        // Scroll a los filtros
        setTimeout(() => {
            const filtrosElement = document.querySelector('.filtros-section');
            if (filtrosElement) {
                filtrosElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }, 300);
    }

}
