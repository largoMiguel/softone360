import { Component, inject, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Location } from '@angular/common';
import { PdmService } from '../../services/pdm.service';
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
import { Chart, ChartConfiguration, registerables } from 'chart.js';

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

    // Filtros
    filtroLinea = '';
    filtroSector = '';
    filtroBusqueda = '';
    filtroAnio = new Date().getFullYear(); // Año actual por defecto
    
    // Años disponibles
    aniosDisponibles = [2024, 2025, 2026, 2027];
    
    // Modal BPIN
    mostrarModalBPIN = false;
    proyectoBPIN: any = null;
    cargandoBPIN = false;

    // Modal Análisis Producto
    mostrarModalAnalisisProducto = false;
    chartProgresoAnual: Chart | null = null;
    chartMetaEjecutado: Chart | null = null;
    chartPresupuestoAnual: Chart | null = null;

    // Analytics
    dashboardAnalytics: any = null;

    // Charts
    chartEstados: Chart | null = null;
    chartSectores: Chart | null = null;
    chartMetasEjecutadas: Chart | null = null;
    chartPresupuestoPorAnio: Chart | null = null;
    chartODS: Chart | null = null;
    chartSectoresDetalle: Chart | null = null;

    // Getters para datos filtrados
    get lineasEstrategicas(): string[] {
        if (!this.pdmData) return [];
        return [...new Set(this.pdmData.lineas_estrategicas.map(l => l.linea_estrategica))];
    }
    get sectores(): string[] {
        if (!this.pdmData) return [];
        return [...new Set(this.pdmData.productos_plan_indicativo.map(p => p.sector_mga))].filter(s => s);
    }

    get productosFiltrados(): ResumenProducto[] {
        let productos = this.resumenProductos;

        // Si el usuario es SECRETARIO, solo mostrar sus productos asignados
        const currentUser = this.authService.getCurrentUserValue();
        if (currentUser && currentUser.role === 'secretario') {
            productos = productos.filter(p => p.responsable_id === currentUser.id);
        }

        // Filtrar productos con meta > 0 para el año seleccionado
        productos = productos.filter(p => {
            const meta = this.getMetaAnio(p, this.filtroAnio);
            return meta > 0;
        });

        if (this.filtroLinea) {
            productos = productos.filter(p => p.linea_estrategica === this.filtroLinea);
        }

        if (this.filtroSector) {
            productos = productos.filter(p => p.sector === this.filtroSector);
        }

        if (this.filtroBusqueda) {
            const busqueda = this.filtroBusqueda.toLowerCase();
            productos = productos.filter(p =>
                p.producto.toLowerCase().includes(busqueda) ||
                p.codigo.toLowerCase().includes(busqueda)
            );
        }

        return productos;
    }

    /**
     * Inicialización del componente
     */
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
                console.log('⬅️ Retroceso interceptado, usando navegación interna');
                this.volver();
            }
        };
        
        window.addEventListener('popstate', this.popstateListener);
    }

    /**
     * Verifica datos del backend con espera para entity slug
     */
    private verificarDatosBackendConEspera(): void {
        console.log('🔍 Esperando entity slug disponible...');
        
        // Esperar en un pequeño intervalo a que el entity slug esté disponible
        let intentos = 0;
        const verificar = () => {
            intentos++;
            const slug = this.pdmService.getEntitySlug();
            
            if (slug) {
                console.log('✅ Entity slug disponible:', slug);
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
        const productoCodigo = sessionStorage.getItem('pdm_open_producto');
        if (productoCodigo) {
            sessionStorage.removeItem('pdm_open_producto');
            
            // Esperar a que se carguen los datos
            const interval = setInterval(() => {
                if (this.resumenProductos.length > 0 && !this.cargandoDesdeBackend) {
                    clearInterval(interval);
                    
                    // Buscar el producto
                    const producto = this.resumenProductos.find(p => p.codigo === productoCodigo);
                    if (producto) {
                        console.log('🎯 Abriendo producto desde alerta:', productoCodigo);
                        this.navegarA('detalle', producto);
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
        console.log('🔍 Verificando estado PDM en backend...');
        this.cargandoDesdeBackend = true;

        this.pdmService.verificarEstadoPDM().subscribe({
            next: (estado) => {
                console.log('✅ Estado PDM:', estado);
                
                if (estado.tiene_datos) {
                    this.datosEnBackend = true;
                    console.log(`📦 Encontrados ${estado.total_productos} productos, cargando datos...`);
                    this.cargarDatosDesdeBackend();
                } else {
                    console.log('ℹ️ No hay datos en backend, esperando carga de Excel');
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
                console.log('✅ Datos cargados desde backend:', data);
                this.pdmData = data;
                
                console.log('🔍 Generando resumen de productos...');
                this.resumenProductos = this.pdmService.generarResumenProductos(data);
                console.log('📦 Resumen productos:', this.resumenProductos.length, 'productos');
                
                console.log('📊 Calculando estadísticas...');
                this.estadisticas = this.pdmService.calcularEstadisticas(data);
                console.log('📈 Estadísticas:', this.estadisticas);
                
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
        console.log('🔄 Iniciando carga de archivo:', file.name, 'Tamaño:', file.size, 'bytes');

        this.pdmService.procesarArchivoExcel(file).subscribe({
            next: (data) => {
                console.log('✅ Datos recibidos del servicio:', data);
                
                try {
                    this.pdmData = data;
                    
                    console.log('🔍 Generando resumen de productos...');
                    this.resumenProductos = this.pdmService.generarResumenProductos(data);
                    console.log('📦 Resumen productos:', this.resumenProductos.length, 'productos');
                    
                    console.log('📊 Calculando estadísticas...');
                    this.estadisticas = this.pdmService.calcularEstadisticas(data);
                    console.log('📈 Estadísticas:', this.estadisticas);
                    
                    this.archivoExcelCargado = true;
                    this.vistaActual = 'dashboard';
                    
                    // Generar analytics iniciales
                    console.log('📈 Generando analytics...');
                    this.generarAnalytics();
                    
                    // Guardar en backend (no bloqueante)
                    console.log('💾 Guardando datos en backend...');
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
                console.log('✅ Datos guardados en backend:', respuesta);
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
            console.log('📊 Navegando a dashboard, recargando datos...');
            this.recargarDashboard();
        } else if (vista === 'productos') {
            console.log('📦 Navegando a productos, recargando lista...');
            this.recargarProductos();
        } else if (vista === 'detalle' && producto) {
            console.log('📋 Navegando a detalle del producto:', producto.codigo);
            this.productoSeleccionado = producto;
            // Inicializar vista de actividades para el año actual
            const anioActual = new Date().getFullYear();
            this.anioSeleccionado = [2024, 2025, 2026, 2027].includes(anioActual) ? anioActual : 2024;
            // Cargar actividades desde backend al abrir el detalle del producto
            this.actualizarResumenActividades(true);
        } else if (vista === 'analisis-producto') {
            console.log('📈 Navegando a análisis del producto');
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
        } else if (this.vistaActual === 'productos') {
            this.vistaActual = 'dashboard';
        } else if (this.vistaActual === 'analytics') {
            this.vistaActual = 'dashboard';
        }
    }

    /**
     * Recarga el dashboard con datos frescos del backend
     */
    private recargarDashboard(): void {
        console.log('📈 Recargando dashboard con datos frescos...');
        
        if (!this.datosEnBackend) {
            console.log('ℹ️ No hay datos en backend, mostrando dashboard en blanco');
            return;
        }
        
        this.cargandoDesdeBackend = true;
        this.pdmService.cargarDatosPDMDesdeBackend().subscribe({
            next: (data) => {
                console.log('✅ Dashboard recargado con datos frescos');
                this.pdmData = data;
                this.resumenProductos = this.pdmService.generarResumenProductos(data);
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
     */
    private recargarProductos(): void {
        console.log('📦 Recargando lista de productos...');
        
        if (!this.datosEnBackend) {
            console.log('ℹ️ No hay datos en backend');
            this.productoSeleccionado = null;
            return;
        }
        
        this.cargandoDesdeBackend = true;
        this.pdmService.cargarDatosPDMDesdeBackend().subscribe({
            next: (data) => {
                console.log('✅ Lista de productos recargada');
                this.pdmData = data;
                this.resumenProductos = this.pdmService.generarResumenProductos(data);
                this.estadisticas = this.pdmService.calcularEstadisticas(data);
                this.productoSeleccionado = null;
                this.limpiarFiltros();
                this.cargandoDesdeBackend = false;
            },
            error: (error) => {
                console.warn('⚠️ Error al recargar productos:', error);
                this.cargandoDesdeBackend = false;
            }
        });
    }

    /**
     * Recarga el análisis del producto actual
     */
    private recargarAnalisisProducto(): void {
        console.log('📊 Recargando análisis del producto...');
        
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
     */
    private recargarSegunFiltros(): void {
        console.log('🔄 Recargando datos según filtros aplicados...');
        
        if (!this.datosEnBackend) {
            console.log('ℹ️ No hay datos en backend para recargar');
            return;
        }
        
        this.cargandoDesdeBackend = true;
        this.pdmService.cargarDatosPDMDesdeBackend().subscribe({
            next: (data) => {
                console.log('✅ Datos recargados según filtros');
                this.pdmData = data;
                this.resumenProductos = this.pdmService.generarResumenProductos(data);
                this.estadisticas = this.pdmService.calcularEstadisticas(data);
                this.cargandoDesdeBackend = false;
                
                // Los getters (productosFiltrados) ya aplicarán los filtros automáticamente
                console.log(`📦 ${this.productosFiltrados.length} productos después de filtros`);
            },
            error: (error) => {
                console.warn('⚠️ Error al recargar según filtros:', error);
                this.cargandoDesdeBackend = false;
            }
        });
    }

    /**
     * Limpia los filtros y recarga datos del backend
     */
    limpiarFiltros() {
        console.log('🔄 Limpiando filtros y recargando datos...');
        this.filtroLinea = '';
        this.filtroSector = '';
        this.filtroBusqueda = '';
        
        // ✅ NUEVO: Recargar datos al limpiar filtros
        this.recargarSegunFiltros();
    }

    /**
     * Se ejecuta cuando cambia el filtro de línea estratégica
     */
    onCambioFiltroLinea() {
        console.log('🔄 Filtro de línea cambió a:', this.filtroLinea);
        this.recargarSegunFiltros();
    }

    /**
     * Se ejecuta cuando cambia el filtro de sector
     */
    onCambioFiltroSector() {
        console.log('🔄 Filtro de sector cambió a:', this.filtroSector);
        this.recargarSegunFiltros();
    }

    /**
     * Se ejecuta cuando cambia el filtro de búsqueda
     */
    onCambioFiltroBusqueda() {
        console.log('🔄 Filtro de búsqueda cambió a:', this.filtroBusqueda);
        this.recargarSegunFiltros();
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
     */
    private actualizarResumenActividades(cargarDesdeBackend: boolean = false) {
        if (!this.productoSeleccionado) return;
        
        // Cargar actividades desde el backend solo si se solicita explícitamente
        if (cargarDesdeBackend && this.datosEnBackend) {
            this.cargarActividadesDesdeBackend();
            return; // El callback actualizará la vista
        }
        
        this.resumenAnioActual = this.pdmService.obtenerResumenActividadesPorAnio(
            this.productoSeleccionado,
            this.anioSeleccionado
        );
        this.avanceProducto = this.pdmService.calcularAvanceProducto(this.productoSeleccionado);
    }

    /**
     * Carga las actividades desde el backend para el producto seleccionado
     */
    private cargarActividadesDesdeBackend() {
        if (!this.productoSeleccionado) return;

        // Verificar que el entity slug esté disponible
        const slug = this.pdmService.getEntitySlug();
        if (!slug) {
            console.warn('⚠️ Entity slug no disponible aún, esperando...');
            let intentos = 0;
            const reintentar = () => {
                intentos++;
                const slugActual = this.pdmService.getEntitySlug();
                if (slugActual) {
                    console.log('✅ Entity slug disponible después de espera');
                    this.cargarActividadesDesdeBackend();
                } else if (intentos < 30) {
                    setTimeout(reintentar, 100);
                } else {
                    console.error('❌ No se puede cargar del backend sin entity slug');
                    this.actualizarResumenActividades(false);
                }
            };
            setTimeout(reintentar, 100);
            return;
        }

        this.pdmService.cargarActividadesDesdeBackend(this.productoSeleccionado.codigo).subscribe({
            next: (actividades) => {
                console.log(`✅ ${actividades.length} actividades cargadas desde backend para producto ${this.productoSeleccionado?.codigo}`);
                
                // CRÍTICO: Sincronizar las actividades cargadas con el BehaviorSubject del servicio
                // Esto reemplaza las actividades del producto actual con las del backend
                this.pdmService.sincronizarActividadesProducto(this.productoSeleccionado!.codigo, actividades);
                
                console.log('📊 Actividades por año:', actividades.map(a => ({ id: a.id, descripcion: a.descripcion, anio: a.anio })));
                
                // Actualizar la vista con las actividades sincronizadas
                this.resumenAnioActual = this.pdmService.obtenerResumenActividadesPorAnio(
                    this.productoSeleccionado!,
                    this.anioSeleccionado
                );
                this.avanceProducto = this.pdmService.calcularAvanceProducto(this.productoSeleccionado!);
                
                console.log('📈 Resumen año actual:', this.resumenAnioActual);
            },
            error: (error) => {
                console.warn('⚠️ Error al cargar actividades desde backend:', error);
                if (error.status === 403) {
                    console.error('❌ Error 403: Verifica que tengas permisos para esta entidad');
                }
                // Continuar con actividades locales si las hay
                this.actualizarResumenActividades(false);
            }
        });
    }

    /**
     * Cambia el año seleccionado y recarga datos del backend
     */
    seleccionarAnio(anio: number) {
        console.log(`📅 Cambio de año: ${this.anioSeleccionado} → ${anio}`);
        this.anioSeleccionado = anio;
        
        // ✅ MEJORADO: Recargar actividades y actualizar estadísticas
        this.actualizarResumenActividades(true);
        
        // Si estamos en analytics, regenerar con datos del nuevo año
        if (this.vistaActual === 'analytics') {
            console.log('📊 Regenerando analytics para el año:', anio);
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
            responsable: [responsableNombre, [Validators.required, Validators.minLength(3)]],
            responsable_user_id: [responsableProducto], // Preseleccionar responsable del producto
            estado: ['PENDIENTE', Validators.required],
            fecha_inicio: ['', Validators.required],
            fecha_fin: ['', Validators.required],
            meta_ejecutar: [0, [Validators.required, Validators.min(0.01), Validators.max(metaDisponible)]]
        });

        // Deshabilitar el campo responsable si el producto ya tiene uno asignado
        if (responsableProducto) {
            this.formularioActividad.get('responsable_user_id')?.disable();
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
            responsable: [actividad.responsable, [Validators.required, Validators.minLength(3)]],
            responsable_user_id: [actividad.responsable_user_id || null],
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
            responsable: valores.responsable,
            responsable_user_id: valores.responsable_user_id, // Incluir ID del usuario responsable (incluso si está disabled)
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
    cargarSecretarios() {
        this.cargandoSecretarios = true;
        this.pdmService.obtenerSecretariosEntidad().subscribe({
            next: (secretarios) => {
                this.secretarios = secretarios;
                this.cargandoSecretarios = false;
                console.log('✅ Secretarios cargados:', secretarios.length);
            },
            error: (error) => {
                console.error('❌ Error al cargar secretarios:', error);
                this.cargandoSecretarios = false;
                this.secretarios = [];
            }
        });
    }

    /**
     * Maneja el cambio de responsable en el dropdown
     */
    onResponsableChange(event: Event) {
        const select = event.target as HTMLSelectElement;
        const userId = select.value ? parseInt(select.value) : null;
        
        if (userId) {
            // Buscar el secretario seleccionado
            const secretario = this.secretarios.find(s => s.id === userId);
            if (secretario) {
                // Actualizar el campo responsable (nombre) para compatibilidad backward
                this.formularioActividad.patchValue({
                    responsable: secretario.full_name,
                    responsable_user_id: userId
                });
                console.log('✅ Responsable seleccionado:', secretario.full_name);
            }
        } else {
            // Si se deselecciona, limpiar campos
            this.formularioActividad.patchValue({
                responsable: '',
                responsable_user_id: null
            });
        }
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
    getEstadoProductoAnio(producto: ResumenProducto, anio: number): string {
        const anioActual = new Date().getFullYear();
        const avance = this.getAvanceAnio(producto, anio);

        if (anio < anioActual) {
            // Año pasado
            return avance >= 100 ? 'COMPLETADO' : 'PENDIENTE';
        } else if (anio === anioActual) {
            // Año actual
            if (avance === 0) return 'PENDIENTE';
            if (avance >= 100) return 'COMPLETADO';
            return 'EN_PROGRESO';
        } else {
            // Años futuros
            return 'POR_EJECUTAR';
        }
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
    }

    /**
     * Navega a la vista de analytics y recarga datos del backend
     */
    verAnalytics(): void {
        console.log('📊 Abriendo analytics, recargando datos del servidor...');
        
        // ✅ NUEVO: Recargar datos del backend antes de generar analytics
        if (this.datosEnBackend) {
            this.cargandoDesdeBackend = true;
            this.pdmService.cargarDatosPDMDesdeBackend().subscribe({
                next: (data) => {
                    console.log('✅ Datos recargados del backend para analytics');
                    this.pdmData = data;
                    this.resumenProductos = this.pdmService.generarResumenProductos(data);
                    this.estadisticas = this.pdmService.calcularEstadisticas(data);
                    this.cargandoDesdeBackend = false;
                    
                    // Generar analytics con datos frescos
                    this.generarAnalytics();
                    this.vistaActual = 'analytics';
                    
                    // Esperar a que el DOM se actualice para crear los charts
                    setTimeout(() => {
                        this.crearGraficos();
                    }, 100);
                },
                error: (error) => {
                    console.warn('⚠️ Error al recargar datos para analytics:', error);
                    this.cargandoDesdeBackend = false;
                    
                    // Continuar con datos en caché
                    this.generarAnalytics();
                    this.vistaActual = 'analytics';
                    setTimeout(() => this.crearGraficos(), 100);
                }
            });
        } else {
            // Sin datos en backend, usar lo que hay en memoria
            this.generarAnalytics();
            this.vistaActual = 'analytics';
            setTimeout(() => this.crearGraficos(), 100);
        }
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
     * Filtra secretarios por secretaría (sector)
     */
    secretariosPorSecretaria(sector: string): any[] {
        if (!sector || !this.secretarios || this.secretarios.length === 0) {
            return this.secretarios;
        }
        
        // Intentar filtrar por secretaría que coincida con el sector
        // Por ejemplo, si el sector es "Salud y protección social", buscar secretarios de la Secretaría de Salud
        const secretariosFiltrados = this.secretarios.filter(s => {
            const secretariaNombre = s.secretaria?.toLowerCase() || '';
            const sectorNombre = sector.toLowerCase();
            return secretariaNombre.includes(sectorNombre) || sectorNombre.includes(secretariaNombre);
        });
        
        // Si no hay coincidencias, retornar todos
        return secretariosFiltrados.length > 0 ? secretariosFiltrados : this.secretarios;
    }

    /**
     * Asigna un responsable a un producto
     */
    asignarResponsable(producto: ResumenProducto, event: Event): void {
        const select = event.target as HTMLSelectElement;
        const responsableId = parseInt(select.value);
        
        if (!responsableId) {
            return;
        }

        this.pdmService.asignarResponsableProducto(producto.codigo, responsableId).subscribe({
            next: (response) => {
                console.log('✅ Responsable asignado:', response);
                
                // Actualizar el producto en la lista
                producto.responsable_id = response.responsable_id;
                producto.responsable_nombre = response.responsable_nombre;
                
                this.showToast(`Responsable asignado correctamente al producto ${producto.codigo}`, 'success');
            },
            error: (error) => {
                console.error('❌ Error al asignar responsable:', error);
                this.showToast('Error al asignar responsable', 'error');
                
                // Revertir selección
                select.value = producto.responsable_id?.toString() || '';
            }
        });
    }

}
