import { Component, OnInit, OnDestroy, ViewChild, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { PqrsService } from '../../services/pqrs.service';
import { UserService } from '../../services/user.service';
import { AlertService } from '../../services/alert.service';
import { AiService } from '../../services/ai.service';
import { ReportService } from '../../services/report.service';
import { SecretariasService } from '../../services/secretarias.service';
import { User } from '../../models/user.model';
import { EntityContextService } from '../../services/entity-context.service';
import { PQRSWithDetails, ESTADOS_PQRS, EstadoPQRS, UpdatePQRSRequest, PQRSResponse, TIPOS_IDENTIFICACION, MEDIOS_RESPUESTA, CANALES_LLEGADA, TIPOS_SOLICITUD, TIPOS_PERSONA, GENEROS } from '../../models/pqrs.model';
import { BaseChartDirective } from 'ng2-charts';
import { Chart, ChartConfiguration, ChartData, ChartType, registerables } from 'chart.js';
import { Subscription, combineLatest, filter } from 'rxjs';
import { NotificationsService, AlertItem } from '../../services/notifications.service';
import { AlertsEventsService } from '../../services/alerts-events.service';

// Registrar todos los componentes de Chart.js
Chart.register(...registerables);

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, BaseChartDirective],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss'
})
export class DashboardComponent implements OnInit, OnDestroy {
  @ViewChild(BaseChartDirective) chart?: BaseChartDirective;

  currentUser: User | null = null;
  pqrsList: PQRSWithDetails[] = [];
  usuariosList: User[] = [];
  secretariosList: User[] = [];
  secretariasSugeridas: string[] = [];
  isLoading = true;
  isLoadingUsuarios = false;
  isSubmitting = false;
  estadosColor = ESTADOS_PQRS;
  tiposIdentificacion = TIPOS_IDENTIFICACION;
  mediosRespuesta = MEDIOS_RESPUESTA;
  canalesLlegada = CANALES_LLEGADA;
  tiposSolicitud = TIPOS_SOLICITUD;
  tiposPersona = TIPOS_PERSONA;
  generos = GENEROS;
  activeView = 'dashboard';
  nuevaPqrsForm: FormGroup;
  nuevoSecretarioForm: FormGroup;
  selectedPqrs: PQRSWithDetails | null = null;
  respuestaTexto = '';
  selectedSecretarioId: number | null = null;
  selectedSecretariaFilter: string = '';
  selectedEstado: string = '';
  private subscriptions = new Subscription();
  private refreshInterval: any;
  
  // Control de pasos del formulario PQRS
  pasoActual: number = 1;
  totalPasos: number = 4;
  tipo: string = 'personal';
  medio: string = 'email';
  nextRadicado: string = '';
  loadingRadicado: boolean = false;

  // Alertas (campana en navbar)
  showAlertsPanel = false;
  alerts$!: import('rxjs').Observable<AlertItem[]>;
  unreadCount$!: import('rxjs').Observable<number>;
  // Realce visual al abrir detalle desde alerta
  highlightDetalle = false;

  // Fechas para el informe
  fechaInicio: string = '';
  fechaFin: string = '';
  mostrarSelectorFechas: boolean = false;
  filtroSecretario: string = '';
  filtroEstado: string = '';
  filtroTipo: string = '';

  // Filtros generales para la vista
  filtroGeneralSecretario: string = '';
  filtroGeneralEstado: string = '';
  filtroGeneralTipo: string = '';
  textoBusqueda: string = '';

  // Para edición de PQRS
  mostrarFormularioEdicion: boolean = false;
  pqrsEditando: PQRSWithDetails | null = null;
  editarPqrsForm: FormGroup;
  selectedFileEdit: File | null = null;
  selectedFileRespuesta: File | null = null;
  justificacionAsignacion: string = '';

  // Datos para gráficos
  estadosChartData: ChartData<'doughnut'> = { labels: [], datasets: [] };
  tiposChartData: ChartData<'bar'> = { labels: [], datasets: [] };
  tendenciasChartData: ChartData<'line'> = { labels: [], datasets: [] };

  doughnutChartType: ChartType = 'doughnut';
  barChartType: ChartType = 'bar';
  lineChartType: ChartType = 'line';

  chartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'bottom'
      }
    }
  };

  // Modal de edición de módulos
  mostrarModalModulos = false;
  usuarioEditandoModulos: User | null = null;
  modulosSeleccionados = {
    pqrs: false,
    planes_institucionales: false,
    contratacion: false,
    pdm: false
  };
  guardandoModulos = false;

  // Helper para manejar errores de manera consistente
  private extractErrorMessage(error: any): string {
    if (!error) return 'Error desconocido';

    // Si es un string directo
    if (typeof error === 'string') return error;

    // Si tiene error.error
    if (error.error) {
      if (typeof error.error === 'string') return error.error;

      // Si tiene detail
      if (error.error.detail) {
        if (typeof error.error.detail === 'string') return error.error.detail;

        // Si detail es un array (errores de validación Pydantic)
        if (Array.isArray(error.error.detail)) {
          return error.error.detail
            .map((e: any) => {
              if (typeof e === 'string') return e;
              if (e.msg) return `${e.loc ? e.loc.join('.') + ': ' : ''}${e.msg}`;
              return JSON.stringify(e);
            })
            .join('; ');
        }

        // Si detail es un objeto
        return JSON.stringify(error.error.detail);
      }

      // Si tiene message
      if (error.error.message) return error.error.message;
    }

    // Si error tiene message directo
    if (error.message) return error.message;

    // Si error tiene statusText
    if (error.statusText) return error.statusText;

    // Último recurso
    return 'Error al procesar la solicitud';
  }

  constructor(
    private authService: AuthService,
    private pqrsService: PqrsService,
    private userService: UserService,
    private router: Router,
    private route: ActivatedRoute,
    private fb: FormBuilder,
    private alertService: AlertService,
    private aiService: AiService,
    private reportService: ReportService,
    private secretariasSvc: SecretariasService,
    public entityContext: EntityContextService,
    private notificationsService: NotificationsService,
    private alertsEvents: AlertsEventsService
  ) {
    // Inicializar streams de alertas con el servicio inyectado
    this.alerts$ = this.notificationsService.alertsStream;
    this.unreadCount$ = this.notificationsService.unreadCountStream;
    this.nuevaPqrsForm = this.fb.group({
      canal_llegada: ['web', Validators.required],
      tipo_identificacion: ['personal', Validators.required],
      medio_respuesta: ['email', Validators.required],
      tipo_solicitud: ['', Validators.required],
      cedula_ciudadano: [''],
      nombre_ciudadano: [''],
      telefono_ciudadano: [''],
      email_ciudadano: [''],
      direccion_ciudadano: [''],
      asunto: [''],
      descripcion: ['', Validators.required],
      tipo_persona: [''],
      genero: [''],
      dias_respuesta: ['', [Validators.min(1), Validators.max(365)]],
      archivo_adjunto: ['']
    });

    // Escuchar cambios en tipo_identificacion para ajustar validaciones
    this.nuevaPqrsForm.get('tipo_identificacion')?.valueChanges.subscribe(tipo => {
      const cedulaControl = this.nuevaPqrsForm.get('cedula_ciudadano');
      const nombreControl = this.nuevaPqrsForm.get('nombre_ciudadano');
      const asuntoControl = this.nuevaPqrsForm.get('asunto');

      if (tipo === 'personal') {
        // PQRS Personal: cedula, nombre y asunto obligatorios
        cedulaControl?.setValidators([Validators.required]);
        nombreControl?.setValidators([Validators.required]);
        asuntoControl?.setValidators([Validators.required]);
      } else {
        // PQRS Anónima: solo descripción obligatoria
        cedulaControl?.clearValidators();
        nombreControl?.clearValidators();
        asuntoControl?.clearValidators();
      }

      cedulaControl?.updateValueAndValidity();
      nombreControl?.updateValueAndValidity();
      asuntoControl?.updateValueAndValidity();
    });

    // Escuchar cambios en medio_respuesta para ajustar validaciones
    this.nuevaPqrsForm.get('medio_respuesta')?.valueChanges.subscribe(medio => {
      this.medio = medio; // Actualizar variable para controlar campos condicionales
      const emailControl = this.nuevaPqrsForm.get('email_ciudadano');
      const direccionControl = this.nuevaPqrsForm.get('direccion_ciudadano');
      const telefonoControl = this.nuevaPqrsForm.get('telefono_ciudadano');

      // Limpiar validaciones primero
      emailControl?.clearValidators();
      direccionControl?.clearValidators();
      telefonoControl?.clearValidators();

      // Agregar validación según el medio seleccionado
      if (medio === 'email') {
        emailControl?.setValidators([Validators.required, Validators.email]);
      } else if (medio === 'fisica') {
        direccionControl?.setValidators([Validators.required]);
      } else if (medio === 'telefono') {
        telefonoControl?.setValidators([Validators.required]);
      }

      emailControl?.updateValueAndValidity();
      direccionControl?.updateValueAndValidity();
      telefonoControl?.updateValueAndValidity();
    });

    this.nuevoSecretarioForm = this.fb.group({
      full_name: ['', Validators.required],
      username: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      secretaria: [''],
      user_type: ['', Validators.required],
      module_pqrs: [false],
      module_planes: [false],
      module_contratacion: [false],
      module_pdm: [false],
      password: ['', [Validators.required, Validators.minLength(6)]],
      password_confirm: ['', Validators.required]
    }, { validators: this.passwordMatchValidator });

    this.editarPqrsForm = this.fb.group({
      tipo_solicitud: ['', Validators.required],
      canal_llegada: ['web', Validators.required],
      medio_respuesta: ['email', Validators.required],
      tipo_persona: [''],
      genero: [''],
      dias_respuesta: [15, [Validators.required, Validators.min(1), Validators.max(90)]],
      cedula_ciudadano: ['', Validators.required],
      nombre_ciudadano: ['', Validators.required],
      telefono_ciudadano: [''],
      email_ciudadano: [''],
      direccion_ciudadano: [''],
      asunto: ['', Validators.required],
      descripcion: ['', Validators.required],
      fecha_solicitud: ['', Validators.required]
    });
  }

  // Validador personalizado para confirmar contraseñas
  passwordMatchValidator(form: FormGroup) {
    const password = form.get('password');
    const confirmPassword = form.get('password_confirm');
    return password && confirmPassword && password.value === confirmPassword.value
      ? null
      : { passwordMismatch: true };
  }

  ngOnInit() {
    // Sincronizar la vista activa con el query param ?v de la URL (controlado por la barra global)
    const qpSub = this.route.queryParamMap.subscribe(params => {
      const v = (params.get('v') || 'dashboard') as string;
      const allowed: Record<string, true> = {
        'dashboard': true,
        'mis-pqrs': true,
        'nueva-pqrs': true,
        'usuarios': true
      };
      if (allowed[v]) {
        this.activeView = v;
      } else if (!params.has('v')) {
        this.activeView = 'dashboard';
      }
    });
    this.subscriptions.add(qpSub);

    // Suscribirse a solicitudes de apertura desde la barra global
    const alertsOpenSub = this.alertsEvents.openRequested$.subscribe((a) => this.abrirAlerta(a));
    this.subscriptions.add(alertsOpenSub);

    // Combinar usuario y entidad para cargar datos solo cuando ambos estén listos
    // y recargar cuando cualquiera cambie
    const combined = combineLatest([
      this.authService.currentUser$,
      this.entityContext.currentEntity$
    ]).pipe(
      filter(([user, entity]) => user !== null && entity !== null)
    ).subscribe(([user, entity]) => {
      this.currentUser = user;
      // Limpiar y recargar datos con el nuevo contexto
      this.limpiarDatos();
      this.loadPqrs();
      this.loadSecretarios();
      // Cargar lista de secretarías sugeridas (distintas) para la entidad
      const eid = this.entityContext.currentEntity?.id;
      this.secretariasSvc.listar(eid).subscribe({
        next: (items) => (this.secretariasSugeridas = (items || []).map(i => i.nombre)),
        error: () => (this.secretariasSugeridas = [])
      });
      // Traer conteo de alertas no leídas para el badge
      this.notificationsService.fetch(true).subscribe();
    });
    this.subscriptions.add(combined);

    // Mantener el manejo de errores de autenticación para casos sin usuario
    const authErrorCheck = this.authService.getCurrentUser().subscribe({
      error: () => {
        const slug = this.router.url.replace(/^\//, '').split('/')[0];
        this.router.navigate(slug ? ['/', slug, 'login'] : ['/'], { replaceUrl: true });
      }
    });
    this.subscriptions.add(authErrorCheck);

    // Escuchar solicitud de apertura del formulario de informe desde la barra global
    const openReportSub = this.alertsEvents.openReportFormRequested$.subscribe(() => {
      // Asegurar que estamos en el dashboard principal
      this.setActiveView('dashboard');
      this.mostrarFormularioInforme();
    });
    this.subscriptions.add(openReportSub);

    // Auto-refresh cada 60 segundos para cargar nuevas PQRS y alertas
    this.refreshInterval = setInterval(() => {
      if (!this.authService.isAuthenticated()) {
        if (this.refreshInterval) {
          clearInterval(this.refreshInterval);
        }
        return;
      }

      if (this.entityContext.currentEntity) {
        this.loadPqrs();
        this.notificationsService.fetch(true).subscribe();
      }
    }, 60000);
  }

  ngOnDestroy() {
    // Limpiar todas las suscripciones
    this.subscriptions.unsubscribe();
    // Limpiar el intervalo de auto-refresh
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
  }

  // Cerrar panel de alertas al hacer click fuera
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
      // Al abrir, cargar alertas (solo no leídas primero)
      this.notificationsService.fetch(true).subscribe();
    }
  }

  verTodasAlertas() {
    // Cargar todas las alertas en el panel
    this.notificationsService.fetch(false).subscribe();
  }

  marcarLeida(alert: AlertItem, event?: MouseEvent) {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    if (!alert.read_at) {
      this.notificationsService.markRead(alert.id).subscribe();
    }
  }

  private parseAlertData(alert: AlertItem): { pqrs_id?: number } {
    if (!alert.data) return {};
    try {
      return JSON.parse(alert.data);
    } catch {
      try {
        // Intento tolerante: reemplazar comillas simples por dobles (por datos antiguos no-JSON)
        const safe = alert.data.replace(/'/g, '"');
        return JSON.parse(safe);
      } catch {
        return {};
      }
    }
  }

  async abrirAlerta(alert: AlertItem, event?: MouseEvent) {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }

    // Marcar como leída si aplica
    if (!alert.read_at) {
      this.notificationsService.markRead(alert.id).subscribe();
    }

    // Intentar abrir detalle de PQRS
    const { pqrs_id } = this.parseAlertData(alert);
    if (!pqrs_id) return;

    // Si ya está en memoria
    const local = this.pqrsList.find(p => p.id === pqrs_id);
    if (local) {
      this.verDetallesPqrs(local);
      this.resaltarDetalle();
      this.showAlertsPanel = false;
      return;
    }

    // Buscar por API y abrir
    try {
      const pqrs = await this.pqrsService.getPqrsById(pqrs_id).toPromise();
      if (pqrs) {
        this.verDetallesPqrs(pqrs);
        this.resaltarDetalle();
        this.showAlertsPanel = false;
      }
    } catch {
      // Silencioso si no tiene permisos o no existe
    }
  }

  private resaltarDetalle() {
    // Realzar visualmente el encabezado del detalle y desplazar a la vista
    this.highlightDetalle = true;
    setTimeout(() => (this.highlightDetalle = false), 1800);
    // Desplazar el contenedor del detalle a la vista si existe
    setTimeout(() => {
      const el = document.querySelector('.detalle-pqrs-view');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 50);
  }

  marcarTodasLeidas(event?: MouseEvent) {
    if (event) event.stopPropagation();
    this.notificationsService.markAllRead().subscribe();
  }

  /**
   * Limpia los datos del componente
   */
  private limpiarDatos(): void {
    this.pqrsList = [];
    this.usuariosList = [];
    this.secretariosList = [];
    this.selectedPqrs = null;
    this.pqrsEditando = null;
    // Mantener la vista activa (sin forzar 'dashboard') para no pisar el query param v
  }

  setActiveView(view: string) {
    this.activeView = view;
    // Actualizar ?v= en la URL para mantener sincronizada la pestaña global
    const topViews = new Set(['dashboard', 'mis-pqrs', 'nueva-pqrs', 'usuarios']);
    if (topViews.has(view)) {
      this.updateQueryParamV(view);
    }
    // Cargar secretarías al abrir formulario de crear usuario
    if (view === 'crear-secretario') {
      const eid = this.entityContext.currentEntity?.id;
      this.secretariasSvc.listar(eid).subscribe({
        next: (items) => (this.secretariasSugeridas = (items || []).map(i => i.nombre)),
        error: () => (this.secretariasSugeridas = [])
      });
    }
    // Cargar próximo radicado al abrir formulario de nueva PQRS
    if (view === 'nueva-pqrs') {
      this.loadNextRadicado();
    }
  }

  private updateQueryParamV(view?: string) {
    const qp: any = { ...this.route.snapshot.queryParams };
    if (!view || view === 'dashboard') {
      delete qp['v'];
    } else {
      qp['v'] = view;
    }
    this.router.navigate([], { relativeTo: this.route, queryParams: qp, replaceUrl: true });
  }

  loadNextRadicado() {
    this.loadingRadicado = true;
    this.pqrsService.getNextRadicado().subscribe({
      next: (data) => {
        this.nextRadicado = data.next_radicado;
        this.loadingRadicado = false;
      },
      error: (error) => {
        console.error('Error cargando próximo radicado:', error);
        this.nextRadicado = '';
        this.loadingRadicado = false;
      }
    });
  }

  loadPqrs() {
    this.isLoading = true;
    this.pqrsService.getPqrs().subscribe({
      next: (data) => {
        this.pqrsList = data;
        this.isLoading = false;
        this.updateCharts();
        // Verificar PQRS próximas a vencer
        this.verificarPqrsProximasVencer();
      },
      error: (error) => {
        // console.error('Error cargando PQRS:', error);
        this.isLoading = false;
        if (error.status === 401) {
          this.setActiveView('dashboard');
        }
      }
    });
  }

  loadSecretarios() {
    this.userService.getSecretarios().subscribe({
      next: (data) => {
        this.secretariosList = data;
      },
      error: (error) => {
        console.error('Error cargando secretarios:', error);
        const msg = this.extractErrorMessage(error);
        this.alertService.error(msg, 'Error al Cargar');
      }
    });
  }

  loadUsuarios() {
    this.isLoadingUsuarios = true;
    this.userService.getUsers().subscribe({
      next: (data) => {
        this.usuariosList = data;
        this.isLoadingUsuarios = false;
      },
      error: (error) => {
        console.error('Error cargando usuarios:', error);
        const msg = this.extractErrorMessage(error);
        this.alertService.error(msg, 'Error al Cargar Usuarios');
        this.isLoadingUsuarios = false;
      }
    });
  }

  verDetallesPqrs(pqrs: any) {
    this.selectedPqrs = pqrs;
    this.setActiveView('detalle-pqrs');
  }

  cerrarDetalles() {
    this.selectedPqrs = null;
    this.setActiveView('dashboard');
  }

  getMisPqrs(): PQRSWithDetails[] {
    let pqrsBase: PQRSWithDetails[] = [];

    // Obtener lista base según rol
    if (this.isAdmin()) {
      pqrsBase = this.pqrsList;
    } else if (this.isSecretario() && this.currentUser) {
      pqrsBase = this.pqrsList.filter(pqrs => pqrs.assigned_to_id === this.currentUser!.id);
    }

    // Aplicar filtros generales
    return this.aplicarFiltrosGenerales(pqrsBase);
  }

  // Aplica los filtros generales a una lista de PQRS
  aplicarFiltrosGenerales(pqrsList: PQRSWithDetails[]): PQRSWithDetails[] {
    let resultado = [...pqrsList];

    // Filtro por secretario
    if (this.filtroGeneralSecretario) {
      resultado = resultado.filter(pqrs =>
        pqrs.assigned_to_id?.toString() === this.filtroGeneralSecretario
      );
    }

    // Filtro por estado
    if (this.filtroGeneralEstado) {
      resultado = resultado.filter(pqrs => pqrs.estado === this.filtroGeneralEstado);
    }

    // Filtro por tipo
    if (this.filtroGeneralTipo) {
      resultado = resultado.filter(pqrs => pqrs.tipo_solicitud === this.filtroGeneralTipo);
    }

    // Filtro por texto de búsqueda
    if (this.textoBusqueda.trim()) {
      const busqueda = this.textoBusqueda.toLowerCase().trim();
      resultado = resultado.filter(pqrs =>
        pqrs.numero_radicado.toLowerCase().includes(busqueda) ||
        (pqrs.nombre_ciudadano || '').toLowerCase().includes(busqueda) ||
        (pqrs.asunto || '').toLowerCase().includes(busqueda) ||
        pqrs.descripcion.toLowerCase().includes(busqueda) ||
        (pqrs.cedula_ciudadano || '').includes(busqueda)
      );
    }

    return resultado;
  }

  // Limpiar filtros generales
  limpiarFiltrosGenerales(): void {
    this.filtroGeneralSecretario = '';
    this.filtroGeneralEstado = '';
    this.filtroGeneralTipo = '';
    this.textoBusqueda = '';
  }

  // Filtrar por estado desde las tarjetas de estadísticas y navegar a Mis PQRS
  filtrarPorEstado(estado: string): void {
    // Limpiar filtros previos
    this.limpiarFiltrosGenerales();

    // Aplicar el nuevo filtro de estado (string vacío = todos)
    if (estado) {
      this.filtroGeneralEstado = estado;
    }

    // Cambiar a la vista de Mis PQRS
    this.setActiveView('mis-pqrs');
  }

  mostrarAsignacion(pqrs: any): void {
    this.selectedPqrs = pqrs;
    this.selectedSecretarioId = null;
    this.selectedSecretariaFilter = '';
    // Recargar secretarios para asegurar que la lista esté actualizada
    this.loadSecretarios();
  }

  getUsuariosPorSecretaria(nombreSecretaria: string): User[] {
    return this.secretariosList.filter(u =>
      u.is_active &&
      (u.secretaria || '').toLowerCase() === nombreSecretaria.toLowerCase()
    );
  }

  mostrarCambioEstado(pqrs: any): void {
    this.selectedPqrs = pqrs;
    this.selectedEstado = pqrs.estado || '';
  }
  confirmarAsignacion(): void {
    if (!this.selectedPqrs || !this.selectedSecretarioId) {
      this.alertService.warning('Por favor selecciona una secretaría para continuar');
      return;
    }

    // selectedSecretarioId ahora contiene el nombre de la secretaría
    const nombreSecretaria = this.selectedSecretarioId as any;

    // Buscar usuarios activos de esa secretaría
    const usuariosDisponibles = this.getUsuariosPorSecretaria(nombreSecretaria);

    if (usuariosDisponibles.length === 0) {
      this.alertService.warning(
        `No hay usuarios activos en la secretaría "${nombreSecretaria}". Por favor, crea un usuario para esta secretaría primero.`
      );
      return;
    }

    // Asignar al primer usuario disponible (o implementar lógica de rotación)
    const usuarioAsignado = usuariosDisponibles[0];

    this.pqrsService.assignPqrs(this.selectedPqrs.id, usuarioAsignado.id, this.justificacionAsignacion).subscribe({
      next: (response) => {
        this.alertService.success(
          `La PQRS N° ${this.selectedPqrs?.numero_radicado} ha sido asignada exitosamente a la secretaría "${nombreSecretaria}".`
        );
        
        // Actualizar PQRS en lista local
        if (this.selectedPqrs) {
          const index = this.pqrsList.findIndex(p => p.id === this.selectedPqrs!.id);
          if (index !== -1) {
            this.pqrsList[index].assigned_to_id = usuarioAsignado.id;
            this.pqrsList[index].justificacion_asignacion = this.justificacionAsignacion;
          }
          // Actualizar selectedPqrs también
          this.selectedPqrs.assigned_to_id = usuarioAsignado.id;
          this.selectedPqrs.justificacion_asignacion = this.justificacionAsignacion;
        }
        
        this.justificacionAsignacion = '';

        const closeButton = document.querySelector('#asignacionModal .btn-close') as HTMLElement;
        if (closeButton) {
          closeButton.click();
        }
      },
      error: (error) => {
        console.error('Error asignando PQRS:', error);
        this.alertService.error(this.extractErrorMessage(error), 'Error al Asignar PQRS');
      }
    });
  }

  confirmarCambioEstado(): void {
    if (this.selectedPqrs && this.selectedEstado) {
      const estadoLabel = this.getEstadoLabel(this.selectedEstado);

      const updateData: UpdatePQRSRequest = {
        estado: this.selectedEstado as EstadoPQRS
      };

      this.pqrsService.updatePqrs(this.selectedPqrs.id, updateData).subscribe({
        next: (response) => {
          // console.log('Estado actualizado exitosamente:', response);
          this.alertService.success(
            `El estado de la PQRS N° ${this.selectedPqrs?.numero_radicado} ha sido cambiado a "${estadoLabel}".`
          );
          this.loadPqrs();

          const closeButton = document.querySelector('#estadoModal .btn-close') as HTMLElement;
          if (closeButton) {
            closeButton.click();
          }
        },
        error: (error) => {
          console.error('Error actualizando estado:', error);
          const msg = this.extractErrorMessage(error);
          this.alertService.error(msg, 'Error al Cambiar Estado');
        }
      });
    }
  }

  async eliminarPqrs(pqrs: PQRSWithDetails): Promise<void> {
    const confirmacion = await this.alertService.confirm(
      `¿Está seguro de que desea eliminar esta PQRS?\n\n` +
      `Radicado: ${pqrs.numero_radicado}\n` +
      `Ciudadano: ${pqrs.nombre_ciudadano}\n` +
      `Asunto: ${pqrs.asunto}\n\n` +
      `Esta acción no se puede deshacer.`,
      'Confirmar Eliminación'
    );

    if (confirmacion) {
      this.pqrsService.deletePqrs(pqrs.id).subscribe({
        next: () => {
          // console.log('PQRS eliminada exitosamente');
          this.alertService.success(
            `La PQRS N° ${pqrs.numero_radicado} ha sido eliminada correctamente.`
          );

          // Si estábamos viendo los detalles de esta PQRS, volver al dashboard
          if (this.selectedPqrs?.id === pqrs.id) {
            this.setActiveView('dashboard');
            this.selectedPqrs = null;
          }

          // Recargar la lista de PQRS
          this.loadPqrs();
        },
        error: (error) => {
          console.error('Error eliminando PQRS:', error);
          this.alertService.error(this.extractErrorMessage(error), 'Error al Eliminar');
        }
      });
    }
  }

  onSubmitNuevaPqrs() {
    if (this.nuevaPqrsForm.valid && !this.isSubmitting) {
      this.isSubmitting = true;

      const formData = this.nuevaPqrsForm.value;
      // El número de radicado lo genera el backend; no enviarlo desde el frontend

      // Agregar entity_id desde el contexto de entidad actual
      const currentEntity = this.entityContext.currentEntity;
      if (!currentEntity) {
        this.alertService.error('No se pudo determinar la entidad actual', 'Error');
        this.isSubmitting = false;
        return;
      }
      formData.entity_id = currentEntity.id;

      // Convertir cadenas vacías a null para campos opcionales (evita error de validación de email)
      if (!formData.email_ciudadano || formData.email_ciudadano.trim() === '') {
        formData.email_ciudadano = null;
      }
      if (!formData.telefono_ciudadano || formData.telefono_ciudadano.trim() === '') {
        formData.telefono_ciudadano = null;
      }
      if (!formData.direccion_ciudadano || formData.direccion_ciudadano.trim() === '') {
        formData.direccion_ciudadano = null;
      }
      if (!formData.asunto || formData.asunto.trim() === '') {
        formData.asunto = null;
      }
      if (!formData.nombre_ciudadano || formData.nombre_ciudadano.trim() === '') {
        formData.nombre_ciudadano = null;
      }
      if (!formData.cedula_ciudadano || formData.cedula_ciudadano.trim() === '') {
        formData.cedula_ciudadano = null;
      }

      // Convertir strings vacías a null para nuevos campos opcionales
      if (!formData.tipo_persona || formData.tipo_persona.trim() === '') {
        formData.tipo_persona = null;
      }
      if (!formData.genero || formData.genero.trim() === '') {
        formData.genero = null;
      }
      // dias_respuesta: Si no se especifica, enviar null (backend usará 15 por defecto)
      if (!formData.dias_respuesta || formData.dias_respuesta === '' || formData.dias_respuesta === 0) {
        formData.dias_respuesta = null;
      }

      // NO enviar archivo_adjunto al crear PQRS (se actualiza después del upload)
      formData.archivo_adjunto = null;

      this.pqrsService.createPqrs(formData).subscribe({
        next: (response) => {
          // Si hay archivo seleccionado, subirlo ahora
          if (this.selectedFile && response.id) {
            this.pqrsService.uploadArchivo(response.id, this.selectedFile).subscribe({
              next: (uploadResponse) => {
                console.log('✅ Archivo subido exitosamente:', uploadResponse);
                this.alertService.success(
                  `La PQRS ha sido creada exitosamente con el radicado N° ${response.numero_radicado}.\n\nArchivo adjunto subido correctamente.\n\nPuedes consultarla en cualquier momento usando este número.`,
                  'PQRS Creada'
                );
                this.nuevaPqrsForm.reset();
                this.selectedFile = null;
                this.isSubmitting = false;
                this.setActiveView('dashboard');
                this.loadPqrs();
              },
              error: (uploadError) => {
                console.error('❌ Error subiendo archivo:', uploadError);
                this.alertService.warning(
                  `La PQRS fue creada con el radicado N° ${response.numero_radicado}, pero hubo un error al subir el archivo adjunto.\n\nPuedes intentar subirlo nuevamente desde la vista de edición.`,
                  'PQRS Creada con Advertencia'
                );
                this.nuevaPqrsForm.reset();
                this.selectedFile = null;
                this.isSubmitting = false;
                this.setActiveView('dashboard');
                this.loadPqrs();
              }
            });
          } else {
            // Sin archivo adjunto
            this.alertService.success(
              `La PQRS ha sido creada exitosamente con el radicado N° ${response.numero_radicado}.\n\nPuedes consultarla en cualquier momento usando este número.`,
              'PQRS Creada'
            );
            this.nuevaPqrsForm.reset();
            this.selectedFile = null;
            this.isSubmitting = false;
            this.setActiveView('dashboard');
            this.loadPqrs();
          }
        },
        error: (error) => {
          console.error('Error creando PQRS:', error);
          this.alertService.error(this.extractErrorMessage(error), 'Error al Crear PQRS');
          this.isSubmitting = false;
        }
      });
    }
  }

  // Generar número de radicado con formato YYYYMMDDNNN
  generarNumeroRadicado(): string {
    // Ya no se usa; el backend genera el radicado secuencial (YYYYMMDDNNN)
    return '';
  }

  // Mostrar formulario de edición
  mostrarEdicionPqrs(pqrs: PQRSWithDetails): void {
    this.pqrsEditando = pqrs;
    this.selectedFileEdit = null;

    // Convertir la fecha al formato requerido por input datetime-local (YYYY-MM-DDTHH:MM)
    const fechaSolicitud = new Date(pqrs.fecha_solicitud);
    const fechaFormatted = fechaSolicitud.toISOString().slice(0, 16);

    this.editarPqrsForm.patchValue({
      tipo_solicitud: pqrs.tipo_solicitud,
      canal_llegada: pqrs.canal_llegada || 'web',
      medio_respuesta: pqrs.medio_respuesta || 'email',
      tipo_persona: pqrs.tipo_persona || '',
      genero: pqrs.genero || '',
      dias_respuesta: pqrs.dias_respuesta || 15,
      cedula_ciudadano: pqrs.cedula_ciudadano,
      nombre_ciudadano: pqrs.nombre_ciudadano,
      telefono_ciudadano: pqrs.telefono_ciudadano || '',
      email_ciudadano: pqrs.email_ciudadano || '',
      direccion_ciudadano: pqrs.direccion_ciudadano || '',
      asunto: pqrs.asunto,
      descripcion: pqrs.descripcion,
      fecha_solicitud: fechaFormatted
    });
    this.mostrarFormularioEdicion = true;
  }

  // Cancelar edición
  cancelarEdicion(): void {
    this.mostrarFormularioEdicion = false;
    this.pqrsEditando = null;
    this.selectedFileEdit = null;
    this.editarPqrsForm.reset();
  }

  // Alias para abrir formulario de edición desde el botón
  abrirFormularioEdicion(pqrs: PQRSWithDetails): void {
    this.mostrarEdicionPqrs(pqrs);
  }

  // Guardar cambios de edición
  guardarEdicion(): void {
    if (this.editarPqrsForm.valid && this.pqrsEditando && !this.isSubmitting) {
      this.isSubmitting = true;

      const formValue = this.editarPqrsForm.value;

      // Si hay un nuevo archivo, subirlo primero
      if (this.selectedFileEdit) {
        this.pqrsService.uploadArchivo(this.pqrsEditando.id, this.selectedFileEdit).subscribe({
          next: (uploadResponse) => {
            // Archivo subido, ahora actualizar la PQRS con la nueva URL
            this.actualizarPqrsConDatos(formValue, uploadResponse.archivo_url);
          },
          error: (error) => {
            console.error('Error subiendo archivo:', error);
            this.alertService.error('Error al subir el archivo. Los demás cambios se guardarán sin modificar el archivo.', 'Advertencia');
            this.actualizarPqrsConDatos(formValue);
          }
        });
      } else {
        // No hay nuevo archivo, solo actualizar datos
        this.actualizarPqrsConDatos(formValue);
      }
    }
  }

  // Método auxiliar para actualizar PQRS con datos del formulario
  private actualizarPqrsConDatos(formValue: any, archivoUrl?: string): void {
    const updateData: UpdatePQRSRequest = {
      tipo_solicitud: formValue.tipo_solicitud,
      canal_llegada: formValue.canal_llegada,
      medio_respuesta: formValue.medio_respuesta,
      tipo_persona: formValue.tipo_persona || null,
      genero: formValue.genero || null,
      dias_respuesta: formValue.dias_respuesta,
      cedula_ciudadano: formValue.cedula_ciudadano,
      nombre_ciudadano: formValue.nombre_ciudadano,
      telefono_ciudadano: formValue.telefono_ciudadano || null,
      email_ciudadano: formValue.email_ciudadano || null,
      direccion_ciudadano: formValue.direccion_ciudadano || null,
      asunto: formValue.asunto,
      descripcion: formValue.descripcion,
      fecha_solicitud: formValue.fecha_solicitud ? new Date(formValue.fecha_solicitud).toISOString() : undefined,
      archivo_adjunto: archivoUrl || undefined
    };

    this.pqrsService.updatePqrs(this.pqrsEditando!.id, updateData).subscribe({
      next: (pqrsActualizada) => {
        this.alertService.success('La PQRS ha sido actualizada exitosamente.', 'PQRS Actualizada');
        
        // Actualizar selectedPqrs con los nuevos datos para que el botón de descarga aparezca
        if (this.selectedPqrs && this.selectedPqrs.id === pqrsActualizada.id) {
          this.selectedPqrs = { ...this.selectedPqrs, ...pqrsActualizada };
        }
        
        this.cancelarEdicion();
        this.loadPqrs();
        this.isSubmitting = false;
      },
      error: (error) => {
        console.error('Error actualizando PQRS:', error);
        const msg = this.extractErrorMessage(error);
        this.alertService.error(msg, 'Error al Actualizar');
        this.isSubmitting = false;
      }
    });
  }

  // Método para manejar selección de archivo en edición
  onFileSelectedEdit(event: any): void {
    const file = event.target.files[0];
    if (file) {
      // Validar tamaño (máximo 10MB)
      if (file.size > 10 * 1024 * 1024) {
        this.alertService.error('El archivo no puede superar 10MB', 'Error');
        event.target.value = '';
        return;
      }
      this.selectedFileEdit = file;
    }
  }

  // Seleccionar archivo para respuesta
  onFileSelectedRespuesta(event: any): void {
    const file = event.target.files[0];
    if (file) {
      // Validar tamaño (máximo 10MB)
      if (file.size > 10 * 1024 * 1024) {
        this.alertService.error('El archivo no puede superar 10MB', 'Error');
        event.target.value = '';
        return;
      }
      this.selectedFileRespuesta = file;
    }
  }

  // Método para extraer nombre de archivo de URL
  getFilenameFromUrl(url: string): string {
    if (!url) return '';
    const parts = url.split('/');
    return parts[parts.length - 1];
  }

  // Método para obtener URL del archivo de respuesta
  getArchivoRespuestaUrl(archivo: string): string {
    if (!archivo) return '';
    // Si ya es una URL completa, retornarla directamente
    if (archivo.startsWith('http://') || archivo.startsWith('https://')) {
      return archivo;
    }
    // Si es solo el nombre del archivo, construir la URL de S3
    return `https://softone360-pqrs-archivos.s3.us-east-1.amazonaws.com/${archivo}`;
  }

  onSubmitNuevoSecretario() {
    if (this.nuevoSecretarioForm.valid && !this.isSubmitting && this.hasAnyModuleSelected()) {
      this.isSubmitting = true;

      const { password_confirm, module_pqrs, module_planes, module_contratacion, module_pdm, ...userData } = this.nuevoSecretarioForm.value;

      // Construir array de módulos permitidos
      const allowed_modules: string[] = [];
      if (module_pqrs) allowed_modules.push('pqrs');
      if (module_planes) allowed_modules.push('planes_institucionales');
      if (module_contratacion) allowed_modules.push('contratacion');
      if (module_pdm) allowed_modules.push('pdm');

      // Agregar el rol de secretario y los módulos
      const createData = {
        ...userData,
        role: 'secretario',
        allowed_modules
      };

      this.userService.createUser(createData).subscribe({
        next: (response) => {
          const tipoLabel = userData.user_type === 'secretario' ? 'Secretario' : 'Contratista';
          this.alertService.success(
            `El ${tipoLabel.toLowerCase()} ${userData.full_name} ha sido creado exitosamente.\n\nUsuario: ${userData.username}\nMódulos: ${allowed_modules.map(m => this.getModuleName(m)).join(', ')}`,
            `${tipoLabel} Creado`
          );
          this.nuevoSecretarioForm.reset();
          this.isSubmitting = false;
          this.setActiveView('usuarios');
          this.loadUsuarios();
          // Refrescar sugerencias de secretarías (se va acumulando)
          const eid = this.entityContext.currentEntity?.id;
          this.secretariasSvc.listar(eid).subscribe({
            next: (items) => (this.secretariasSugeridas = (items || []).map(i => i.nombre)),
            error: () => { }
          });
        },
        error: (error) => {
          console.error('Error creando usuario:', error);
          const msg = this.extractErrorMessage(error);
          this.alertService.error(msg, 'Error al Crear Usuario');
          this.isSubmitting = false;
        }
      });
    }
  }

  enviarRespuesta() {
    if (this.selectedPqrs && this.respuestaTexto.trim()) {
      // Si hay archivo seleccionado, primero subirlo
      if (this.selectedFileRespuesta) {
        this.pqrsService.uploadArchivoRespuesta(this.selectedPqrs.id, this.selectedFileRespuesta).subscribe({
          next: (uploadResponse) => {
            console.log('Archivo de respuesta subido:', uploadResponse);
            // Después de subir el archivo, actualizar la PQRS con la respuesta
            this.actualizarRespuestaPqrs();
            this.selectedFileRespuesta = null;
          },
          error: (error) => {
            console.error('Error subiendo archivo de respuesta:', error);
            this.alertService.error(
              'Error al subir el archivo adjunto. Intente nuevamente.',
              'Error'
            );
          }
        });
      } else {
        // Si no hay archivo, solo actualizar la respuesta
        this.actualizarRespuestaPqrs();
      }
    }
  }

  private actualizarRespuestaPqrs() {
    if (!this.selectedPqrs) return;

    const responseData: PQRSResponse = {
      respuesta: this.respuestaTexto.trim()
    };

    this.pqrsService.respondPqrs(this.selectedPqrs.id, responseData).subscribe({
      next: (response) => {
        this.alertService.success(
          `La respuesta ha sido enviada exitosamente y el estado de la PQRS N° ${this.selectedPqrs?.numero_radicado} ha cambiado a "Resuelto".`,
          'Respuesta Enviada'
        );
        this.respuestaTexto = '';
        
        // Recargar la PQRS actualizada desde el servidor para obtener todos los campos
        if (this.selectedPqrs) {
          this.pqrsService.getPqrsById(this.selectedPqrs.id).subscribe({            next: (pqrsActualizada) => {
              // Actualizar en lista local
              const index = this.pqrsList.findIndex(p => p.id === pqrsActualizada.id);
              if (index !== -1) {
                this.pqrsList[index] = pqrsActualizada;
              }
              this.selectedPqrs = pqrsActualizada;
              this.updateCharts();
            },
            error: (err) => {
              console.error('Error recargando PQRS:', err);
              // Si falla, al menos actualizar lo básico
              if (this.selectedPqrs) {
                this.selectedPqrs.respuesta = this.respuestaTexto.trim();
                this.selectedPqrs.estado = 'resuelto';
              }
            }
          });
        }
      },
      error: (error) => {
        console.error('Error enviando respuesta:', error);
        const msg = this.extractErrorMessage(error);
        this.alertService.error(msg, 'Error al Enviar Respuesta');
      }
    });
  }

  isAdmin(): boolean {
    return this.currentUser?.role === 'admin';
  }

  isSecretario(): boolean {
    return this.currentUser?.role === 'secretario';
  }

  canChangeStatus(): boolean {
    return this.isAdmin() || this.isSecretario();
  }

  isEstadoResuelto(): boolean {
    return this.selectedPqrs?.estado === 'resuelto';
  }

  esReasignacion(): boolean {
    // Es reasignación si la PQRS ya tiene un usuario asignado
    // O si el usuario actual es secretario (siempre será reasignación para secretarios)
    return !!(this.selectedPqrs?.assigned_to_id) || this.isSecretario();
  }

  mostrarBotonRechazar(): boolean {
    // Secretario puede rechazar/reasignar si la PQRS está asignada a él y no está resuelta
    return this.isSecretario() && 
           !!this.selectedPqrs && 
           !!this.currentUser &&
           this.selectedPqrs.assigned_to_id === this.currentUser.id && 
           !this.isEstadoResuelto();
  }

  canEditPqrs(pqrs: PQRSWithDetails): boolean {
    // Admin puede editar todas
    if (this.isAdmin()) return true;

    // Secretario solo puede editar las que tiene asignadas
    if (this.isSecretario() && this.currentUser) {
      return pqrs.assigned_to_id === this.currentUser.id;
    }

    return false;
  }

  getEstadoColor(estado: string): string {
    const estadosColorMap: { [key: string]: string } = {
      'pendiente': 'warning',
      'en_proceso': 'info',
      'resuelto': 'success',
      'respondido': 'primary',
      'cerrado': 'dark'
    };
    return estadosColorMap[estado] || 'secondary';
  }

  getEstadoLabel(estado: string): string {
    const labels: { [key: string]: string } = {
      'pendiente': 'Pendiente',
      'en_proceso': 'En Proceso',
      'resuelto': 'Resuelto',
      'respondido': 'Respondido',
      'cerrado': 'Cerrado'
    };
    return labels[estado] || estado;
  }

  toggleUsuarioEstado(usuario: User): void {
    // No permitir que el usuario se desactive a sí mismo
    if (usuario.id === this.currentUser?.id) {
      // console.warn('No se puede cambiar el estado del usuario actual.');
      return;
    }

    // Llamar al servicio para alternar el estado
    this.userService.toggleUserStatus(usuario.id).subscribe({
      next: (updatedUser) => {
        // Actualizar la lista de usuarios en memoria
        this.usuariosList = this.usuariosList.map(u => u.id === updatedUser.id ? updatedUser : u);

        // Si el usuario es secretario, actualizar también la lista de secretarios
        if (updatedUser.role === 'secretario') {
          const exists = this.secretariosList.some(s => s.id === updatedUser.id);
          if (updatedUser.is_active && !exists) {
            this.secretariosList = [...this.secretariosList, updatedUser];
          } else if (!updatedUser.is_active && exists) {
            this.secretariosList = this.secretariosList.filter(s => s.id !== updatedUser.id);
          } else {
            this.secretariosList = this.secretariosList.map(s => s.id === updatedUser.id ? updatedUser : s);
          }
        }

        // console.log('Estado de usuario actualizado:', updatedUser);
      },
      error: (error) => {
        console.error('Error alternando estado de usuario:', error);
        const msg = this.extractErrorMessage(error);
        this.alertService.error(msg, 'Error al Cambiar Estado');
      }
    });
  }

  async eliminarUsuario(usuario: User): Promise<void> {
    // No permitir que el usuario se elimine a sí mismo
    if (usuario.id === this.currentUser?.id) {
      this.alertService.warning(
        'No puedes eliminar tu propia cuenta de usuario.\n\nSi necesitas eliminar esta cuenta, solicita a otro administrador que lo haga.',
        'Acción No Permitida'
      );
      return;
    }

    const confirmacion = await this.alertService.confirm(
      `¿Está seguro de que desea eliminar este usuario?\n\n` +
      `Nombre: ${usuario.full_name}\n` +
      `Usuario: ${usuario.username}\n` +
      `Rol: ${usuario.role}\n\n` +
      `Esta acción no se puede deshacer y todas las PQRS asignadas a este usuario quedarán sin asignar.`,
      'Confirmar Eliminación'
    );

    if (confirmacion) {
      this.userService.deleteUser(usuario.id).subscribe({
        next: () => {
          // console.log('Usuario eliminado exitosamente');
          this.alertService.success(
            `El usuario ${usuario.full_name} ha sido eliminado correctamente del sistema.`
          );

          // Recargar las listas de usuarios desde el servidor
          this.loadUsuarios();
          this.loadSecretarios();
        },
        error: (error) => {
          console.error('Error eliminando usuario:', error);
          const msg = this.extractErrorMessage(error);
          this.alertService.error(msg, 'Error al Eliminar Usuario');
        }
      });
    }
  }

  // Métodos de estadísticas
  getTotalPqrs(): number {
    return this.pqrsList.length;
  }

  getPqrsPendientes(): number {
    return this.pqrsList.filter(p => p.estado === 'pendiente').length;
  }

  getPqrsEnProceso(): number {
    return this.pqrsList.filter(p => p.estado === 'en_proceso').length;
  }

  getPqrsResueltas(): number {
    return this.pqrsList.filter(p => p.estado === 'resuelto' || p.estado === 'cerrado').length;
  }

  getPqrsDelMes(): number {
    const hoy = new Date();
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    return this.pqrsList.filter(p => {
      const fecha = new Date(p.fecha_solicitud);
      return fecha >= inicioMes;
    }).length;
  }

  getPqrsSinAsignar(): number {
    return this.pqrsList.filter(p => !p.assigned_to_id).length;
  }

  getPromedioRespuesta(): number {
    const respondidas = this.pqrsList.filter(p => p.respuesta && p.fecha_respuesta);
    if (respondidas.length === 0) return 0;

    const tiempos = respondidas.map(p => {
      const inicio = new Date(p.fecha_solicitud);
      const fin = new Date(p.fecha_respuesta!);
      return (fin.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24); // días
    });

    const promedio = tiempos.reduce((a, b) => a + b, 0) / tiempos.length;
    return Math.round(promedio * 10) / 10;
  }

  getPqrsPorTipo(tipo: string): number {
    return this.pqrsList.filter(p => p.tipo_solicitud === tipo).length;
  }

  // Calcula los días restantes para responder una PQRS usando el campo dias_respuesta
  getDiasRestantes(pqrs: PQRSWithDetails): number {
    // Si ya está resuelta o cerrada, no hay días restantes
    if (pqrs.estado === 'resuelto' || pqrs.estado === 'cerrado') return 0;

    // Usar dias_respuesta de la PQRS o 15 días por defecto si no está definido
    const diasMaximosRespuesta = pqrs.dias_respuesta || 15;

    // Fecha de solicitud (inicio del conteo)
    const fechaSolicitud = new Date(pqrs.fecha_solicitud);

    // Fecha actual (hoy)
    const hoy = new Date();

    // Normalizar a medianoche para comparar solo fechas, no horas
    const fechaSolicitudNormalizada = new Date(fechaSolicitud.getFullYear(), fechaSolicitud.getMonth(), fechaSolicitud.getDate());
    const hoyNormalizado = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());

    // Calcular diferencia en milisegundos
    const diferenciaMs = hoyNormalizado.getTime() - fechaSolicitudNormalizada.getTime();

    // Convertir a días (positivo si hoy es después, negativo si es antes)
    const diasTranscurridos = Math.floor(diferenciaMs / (1000 * 60 * 60 * 24));

    // Calcular días restantes usando los días asignados a la PQRS
    const diasRestantes = diasMaximosRespuesta - diasTranscurridos;

    // Si el resultado es negativo, significa que ya se venció (retornar 0)
    // Si es positivo, retornar los días que quedan
    return Math.max(0, diasRestantes);
  }

  // Obtiene los días vencidos usando el campo dias_respuesta de la PQRS
  getDiasVencidos(pqrs: PQRSWithDetails): number {
    if (pqrs.estado === 'resuelto' || pqrs.estado === 'cerrado') return 0;

    // Usar dias_respuesta de la PQRS o 15 días por defecto
    const diasMaximosRespuesta = pqrs.dias_respuesta || 15;

    const fechaSolicitud = new Date(pqrs.fecha_solicitud);
    const hoy = new Date();

    const fechaSolicitudNormalizada = new Date(fechaSolicitud.getFullYear(), fechaSolicitud.getMonth(), fechaSolicitud.getDate());
    const hoyNormalizado = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());

    const diferenciaMs = hoyNormalizado.getTime() - fechaSolicitudNormalizada.getTime();
    const diasTranscurridos = Math.floor(diferenciaMs / (1000 * 60 * 60 * 24));

    // Si pasaron más días que los asignados, retornar cuántos días de vencimiento lleva
    const diasVencidos = diasTranscurridos - diasMaximosRespuesta;

    return Math.max(0, diasVencidos);
  }

  // Verifica si la PQRS está vencida
  estaVencida(pqrs: PQRSWithDetails): boolean {
    if (pqrs.estado === 'resuelto' || pqrs.estado === 'cerrado') return false;
    return this.getDiasVencidos(pqrs) > 0;
  }  // Obtiene el color según los días restantes
  getColorDiasRestantes(diasRestantes: number): string {
    if (diasRestantes <= 2) return 'text-danger fw-bold';
    if (diasRestantes <= 5) return 'text-warning fw-bold';
    return 'text-success';
  }

  // Verifica PQRS próximas a vencer (5 días o menos)
  async verificarPqrsProximasVencer(): Promise<void> {
    const pqrsProximasVencer = this.pqrsList.filter(pqrs => {
      if (pqrs.estado === 'resuelto' || pqrs.estado === 'cerrado') return false;
      const diasRestantes = this.getDiasRestantes(pqrs);
      return diasRestantes <= 5 && diasRestantes >= 0;
    });

    if (pqrsProximasVencer.length > 0) {
      const mensaje = `Tienes ${pqrsProximasVencer.length} PQRS próximas a vencer en los próximos 5 días:\n\n` +
        pqrsProximasVencer.slice(0, 5).map(p =>
          `• ${p.numero_radicado} - ${p.asunto} (${this.getDiasRestantes(p)} días restantes)`
        ).join('\n') +
        (pqrsProximasVencer.length > 5 ? `\n\n...y ${pqrsProximasVencer.length - 5} más.` : '');

      await this.alertService.warning(mensaje, 'PQRS Próximas a Vencer');
    }
  }

  updateCharts(): void {
    // Gráfico de estados (Doughnut)
    const estadosLabels = ['Pendiente', 'En Proceso', 'Resuelto', 'Cerrado'];
    const estadosData = [
      this.pqrsList.filter(p => p.estado === 'pendiente').length,
      this.pqrsList.filter(p => p.estado === 'en_proceso').length,
      this.pqrsList.filter(p => p.estado === 'resuelto').length,
      this.pqrsList.filter(p => p.estado === 'cerrado').length,
    ];

    this.estadosChartData = {
      labels: estadosLabels,
      datasets: [{
        data: estadosData,
        backgroundColor: [
          '#ffc107',
          '#17a2b8',
          '#28a745',
          '#343a40'
        ],
        hoverBackgroundColor: [
          '#ffca2c',
          '#1fc8e3',
          '#48c774',
          '#495057'
        ]
      }]
    };

    // Gráfico de tipos (Barras)
    const tiposLabels = ['Petición', 'Queja', 'Reclamo', 'Sugerencia'];
    const tiposData = [
      this.getPqrsPorTipo('peticion'),
      this.getPqrsPorTipo('queja'),
      this.getPqrsPorTipo('reclamo'),
      this.getPqrsPorTipo('sugerencia')
    ];

    this.tiposChartData = {
      labels: tiposLabels,
      datasets: [{
        label: 'PQRS por Tipo',
        data: tiposData,
        backgroundColor: [
          'rgba(33, 107, 168, 0.7)',
          'rgba(255, 193, 7, 0.7)',
          'rgba(220, 53, 69, 0.7)',
          'rgba(40, 167, 69, 0.7)'
        ],
        borderColor: [
          'rgba(33, 107, 168, 1)',
          'rgba(255, 193, 7, 1)',
          'rgba(220, 53, 69, 1)',
          'rgba(40, 167, 69, 1)'
        ],
        borderWidth: 2
      }]
    };

    // Gráfico de tendencias (últimos 7 días)
    const ultimos7Dias = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return d;
    });

    const tendenciasLabels = ultimos7Dias.map(d =>
      d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })
    );

    const tendenciasData = ultimos7Dias.map(dia => {
      return this.pqrsList.filter(p => {
        const fecha = new Date(p.fecha_solicitud);
        return fecha.toDateString() === dia.toDateString();
      }).length;
    });

    this.tendenciasChartData = {
      labels: tendenciasLabels,
      datasets: [{
        label: 'PQRS Recibidas',
        data: tendenciasData,
        borderColor: '#216ba8',
        backgroundColor: 'rgba(33, 107, 168, 0.1)',
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#216ba8',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointRadius: 5,
        pointHoverRadius: 7
      }]
    };

    // Actualizar el gráfico si existe
    if (this.chart) {
      this.chart.update();
    }
  }

  openReportForm(): void {
    this.mostrarFormularioInforme();
  }

  mostrarFormularioInforme(): void {
    const enableReports = this.reportsPdfEnabled();
    if (!enableReports) {
      this.alertService.warning('El módulo de Reportes PDF está desactivado para esta entidad.', 'Módulo desactivado');
      return;
    }

    // Establecer fechas por defecto (último mes)
    const fechaFin = new Date();
    const fechaInicio = new Date();
    fechaInicio.setMonth(fechaInicio.getMonth() - 1);

    this.fechaInicio = fechaInicio.toISOString().split('T')[0];
    this.fechaFin = fechaFin.toISOString().split('T')[0];

    // Resetear filtros
    this.filtroSecretario = '';
    this.filtroEstado = '';
    this.filtroTipo = '';

    this.mostrarSelectorFechas = true;
  }

  cancelarInforme(): void {
    this.mostrarSelectorFechas = false;
    this.filtroSecretario = '';
    this.filtroEstado = '';
    this.filtroTipo = '';
  }

  async generarInforme(): Promise<void> {
    if (!this.fechaInicio || !this.fechaFin) {
      this.alertService.warning('Debes seleccionar el rango de fechas para el informe.', 'Fechas Requeridas');
      return;
    }

    // Convertir fechas a formato comparable (solo fecha, sin hora)
    const inicio = new Date(this.fechaInicio + 'T00:00:00');
    const fin = new Date(this.fechaFin + 'T23:59:59');

    if (inicio > fin) {
      this.alertService.warning('La fecha inicial no puede ser posterior a la fecha final.', 'Fechas Inválidas');
      return;
    }

    try {
      // Cerrar el selector de fechas
      this.mostrarSelectorFechas = false;

      this.alertService.info('Generando informe con análisis de IA... Por favor espera.', 'Generando Informe');

      // Filtrar PQRS por rango de fechas y otros criterios
      let pqrsFiltered = this.pqrsList.filter(pqrs => {
        const fechaSolicitud = new Date(pqrs.fecha_solicitud);
        // Normalizar a solo fecha para comparación
        const fechaSolicitudSolo = new Date(fechaSolicitud.getFullYear(), fechaSolicitud.getMonth(), fechaSolicitud.getDate());
        const inicioSolo = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate());
        const finSolo = new Date(fin.getFullYear(), fin.getMonth(), fin.getDate());

        return fechaSolicitudSolo >= inicioSolo && fechaSolicitudSolo <= finSolo;
      });

      // Aplicar filtro de secretario si está seleccionado
      if (this.filtroSecretario) {
        pqrsFiltered = pqrsFiltered.filter(pqrs =>
          pqrs.assigned_to_id?.toString() === this.filtroSecretario
        );
      }

      // Aplicar filtro de estado si está seleccionado
      if (this.filtroEstado) {
        pqrsFiltered = pqrsFiltered.filter(pqrs => pqrs.estado === this.filtroEstado);
      }

      // Aplicar filtro de tipo si está seleccionado
      if (this.filtroTipo) {
        pqrsFiltered = pqrsFiltered.filter(pqrs => pqrs.tipo_solicitud === this.filtroTipo);
      }

      // console.log('Total PQRS:', this.pqrsList.length);
      // console.log('PQRS filtradas:', pqrsFiltered.length);
      // console.log('Rango:', this.fechaInicio, 'a', this.fechaFin);
      if (this.pqrsList.length > 0) {
        // console.log('Primera PQRS fecha:', this.pqrsList[0].fecha_solicitud);
      } if (pqrsFiltered.length === 0) {
        this.alertService.warning('No hay PQRS en el rango de fechas seleccionado.', 'Sin Datos');
        return;
      }

      // Preparar datos para el análisis de IA
      const tiposPqrs: { [key: string]: number } = {};
      pqrsFiltered.forEach(pqrs => {
        tiposPqrs[pqrs.tipo_solicitud] = (tiposPqrs[pqrs.tipo_solicitud] || 0) + 1;
      });

      // Calcular tiempo promedio de respuesta
      const pqrsConRespuesta = pqrsFiltered.filter(p => p.fecha_respuesta);
      let tiempoPromedioRespuesta = 0;

      if (pqrsConRespuesta.length > 0) {
        const tiempoTotal = pqrsConRespuesta.reduce((acc, pqrs) => {
          const fechaSolicitud = new Date(pqrs.fecha_solicitud).getTime();
          const fechaRespuesta = new Date(pqrs.fecha_respuesta!).getTime();
          const dias = (fechaRespuesta - fechaSolicitud) / (1000 * 60 * 60 * 24);
          return acc + dias;
        }, 0);
        tiempoPromedioRespuesta = Math.round(tiempoTotal / pqrsConRespuesta.length);
      }

      const totalPqrs = pqrsFiltered.length;
      const pendientes = pqrsFiltered.filter(p => p.estado === 'pendiente').length;
      const enProceso = pqrsFiltered.filter(p => p.estado === 'en_proceso').length;
      const resueltas = pqrsFiltered.filter(p => p.estado === 'resuelto').length;
      const cerradas = pqrsFiltered.filter(p => p.estado === 'cerrado').length;
      const tasaResolucion = totalPqrs > 0 ? (resueltas + cerradas) / totalPqrs : 0;

      const aiRequest = {
        totalPqrs,
        pendientes,
        enProceso,
        resueltas,
        cerradas,
        tiposPqrs,
        tiempoPromedioRespuesta,
        tasaResolucion,
        tendenciaMensual: [] as any[],
        fechaInicio: this.fechaInicio,
        fechaFin: this.fechaFin
      };

      // Obtener análisis (respetando flag de IA)
      const enableAI = this.entityContext.currentEntity?.enable_ai_reports ?? true;
      const aiAnalysis = enableAI
        ? await this.aiService.generateReportAnalysis(aiRequest).toPromise()
        : {
          introduccion: 'Informe generado sin análisis de IA.',
          analisisGeneral: 'El análisis automatizado está desactivado para esta entidad.',
          analisisTendencias: '',
          recomendaciones: [],
          conclusiones: ''
        };

      // Preparar analytics
      const analytics = {
        totalPqrs,
        pendientes,
        enProceso,
        resueltas,
        cerradas,
        tiposPqrs,
        tasaResolucion: (tasaResolucion * 100).toFixed(1),
        tiempoPromedioRespuesta
      };

      // Capturar gráficos como imágenes
      const charts = await this.captureCharts();

      // Formatear fechas para el PDF
      const fechaInicioFormat = inicio.toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' });
      const fechaFinFormat = fin.toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' });

      // Generar PDF del reporte directamente
      this.reportService.generatePDFReport(
        pqrsFiltered,
        charts,
        aiAnalysis,
        analytics,
        fechaInicioFormat,
        fechaFinFormat
      );

      this.alertService.success('El informe PDF ha sido generado y descargado exitosamente.', 'Informe Generado');

    } catch (error) {
      // console.error('Error generando informe:', error);
      this.alertService.error(
        'Ocurrió un error al generar el informe. Por favor, intenta nuevamente.',
        'Error al Generar Informe'
      );
    }
  }

  private async captureCharts(): Promise<{ estados: string; tipos: string; tendencias: string }> {
    const canvas1 = document.getElementById('estadosChart') as HTMLCanvasElement;
    const canvas2 = document.getElementById('tiposChart') as HTMLCanvasElement;
    const canvas3 = document.getElementById('tendenciasChart') as HTMLCanvasElement;

    return {
      estados: canvas1?.toDataURL('image/png') || '',
      tipos: canvas2?.toDataURL('image/png') || '',
      tendencias: canvas3?.toDataURL('image/png') || ''
    };
  }

  private getPeriodoAnalisis(): string {
    if (this.pqrsList.length === 0) return 'Sin datos';

    const fechas = this.pqrsList.map(p => new Date(p.fecha_solicitud).getTime());
    const fechaMin = new Date(Math.min(...fechas));
    const fechaMax = new Date(Math.max(...fechas));

    const opciones: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric' };
    return `${fechaMin.toLocaleDateString('es-CO', opciones)} - ${fechaMax.toLocaleDateString('es-CO', opciones)}`;
  }

  logout() {
    this.authService.logout();
    
    setTimeout(() => {
      const slug = this.router.url.replace(/^\//, '').split('/')[0];
      const loginUrl = slug ? `/${slug}/login` : '/';
      
      this.router.navigate([loginUrl]).then(() => {

        window.location.reload();
      });
    }, 100);
  }

  // Feature flags por entidad (con fallback a true)
  pqrsEnabled(): boolean {
    return this.entityContext.currentEntity?.enable_pqrs ?? false;
  }

  usersAdminEnabled(): boolean {
    return this.entityContext.currentEntity?.enable_users_admin ?? false;
  }

  planesEnabled(): boolean {
    return this.entityContext.currentEntity?.enable_planes_institucionales ?? false;
  }

  reportsPdfEnabled(): boolean {
    return this.entityContext.currentEntity?.enable_reports_pdf ?? false;
  }

  contratacionEnabled(): boolean {
    return (this.entityContext.currentEntity as any)?.enable_contratacion ?? false;
  }

  pdmEnabled(): boolean {
    return (this.entityContext.currentEntity as any)?.enable_pdm ?? true;
  }

  // Métodos auxiliares para gestión de usuarios
  hasAnyModuleSelected(): boolean {
    const form = this.nuevoSecretarioForm;
    return form.get('module_pqrs')?.value ||
      form.get('module_planes')?.value ||
      form.get('module_contratacion')?.value ||
      form.get('module_pdm')?.value;
  }

  getModuleName(module: string): string {
    const names: Record<string, string> = {
      'pqrs': 'PQRS',
      'planes_institucionales': 'Planes',
      'contratacion': 'Contratación',
      'pdm': 'PDM'
    };
    return names[module] || module;
  }

  // Verificar si el usuario tiene acceso a un módulo específico
  userHasModule(moduleName: string): boolean {
    // Admin siempre tiene acceso a todo
    if (this.isAdmin()) return true;

    // Si no tiene allowed_modules definido, tiene acceso a todo (comportamiento legacy)
    if (!this.currentUser?.allowed_modules || this.currentUser.allowed_modules.length === 0) {
      return true;
    }

    // Verificar si el módulo está en la lista de permitidos
    return this.currentUser.allowed_modules.includes(moduleName);
  }

  // Verificar si el módulo está activo Y el usuario tiene permiso
  canAccessPqrs(): boolean {
    return this.pqrsEnabled() && this.userHasModule('pqrs');
  }

  canAccessPlanes(): boolean {
    return this.planesEnabled() && this.userHasModule('planes_institucionales');
  }

  canAccessContratacion(): boolean {
    return this.contratacionEnabled() && this.userHasModule('contratacion');
  }

  canAccessPdm(): boolean {
    return this.pdmEnabled() && this.userHasModule('pdm');
  }

  // Etiqueta legible del usuario para la barra superior
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

  // Getter para acceso fácil a la entidad
  get entity() {
    return this.entityContext.currentEntity;
  }

  // Gestión de módulos
  abrirModalModulos(usuario: User): void {
    this.usuarioEditandoModulos = usuario;
    // Inicializar checkboxes según los módulos actuales del usuario
    this.modulosSeleccionados = {
      pqrs: usuario.allowed_modules?.includes('pqrs') || false,
      planes_institucionales: usuario.allowed_modules?.includes('planes_institucionales') || false,
      contratacion: usuario.allowed_modules?.includes('contratacion') || false,
      pdm: usuario.allowed_modules?.includes('pdm') || false
    };
    this.mostrarModalModulos = true;
  }

  cerrarModalModulos(): void {
    this.mostrarModalModulos = false;
    this.usuarioEditandoModulos = null;
    this.guardandoModulos = false;
  }

  async guardarModulos(): Promise<void> {
    if (!this.usuarioEditandoModulos) return;

    this.guardandoModulos = true;

    // Construir array de módulos seleccionados
    const modules: string[] = [];
    if (this.modulosSeleccionados.pqrs) modules.push('pqrs');
    if (this.modulosSeleccionados.planes_institucionales) modules.push('planes_institucionales');
    if (this.modulosSeleccionados.contratacion) modules.push('contratacion');
    if (this.modulosSeleccionados.pdm) modules.push('pdm');

    try {
      const updated = await this.userService.updateUserModules(this.usuarioEditandoModulos.id!, modules).toPromise();

      // Actualizar en la lista local
      const index = this.usuariosList.findIndex(u => u.id === this.usuarioEditandoModulos!.id);
      if (index !== -1 && updated) {
        this.usuariosList[index] = updated;
      }

      this.alertService.success(
        'Módulos actualizados',
        `Los módulos de ${this.usuarioEditandoModulos.full_name} han sido actualizados correctamente.`
      );

      this.cerrarModalModulos();
    } catch (error: any) {
      console.error('Error al actualizar módulos:', error);
      this.alertService.error(
        'Error al actualizar módulos',
        error.error?.detail || 'No se pudieron actualizar los módulos del usuario.'
      );
      this.guardandoModulos = false;
    }
  }
  
  // Métodos para navegación de pasos del formulario PQRS
  siguientePaso(): void {
    if (this.pasoActual < this.totalPasos) {
      this.pasoActual++;
    }
  }
  
  pasoAnterior(): void {
    if (this.pasoActual > 1) {
      this.pasoActual--;
    }
  }
  
  irAPaso(paso: number): void {
    if (paso >= 1 && paso <= this.totalPasos) {
      this.pasoActual = paso;
    }
  }
  
  selectedFile: File | null = null;

  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file && file.type === 'application/pdf') {
      if (file.size > 10 * 1024 * 1024) { // 10 MB
        this.alertService.error('El archivo no debe superar 10 MB', 'Error');
        event.target.value = '';
        return;
      }
      this.selectedFile = file;
      this.alertService.success('Archivo seleccionado: ' + file.name, 'Éxito');
    } else {
      this.alertService.error('Solo se permiten archivos PDF', 'Error');
      event.target.value = '';
    }
  }

  resetearFormularioPqrs(): void {
    this.nuevaPqrsForm.reset({
      canal_llegada: 'web',
      tipo_identificacion: 'personal',
      medio_respuesta: 'email'
    });
    this.pasoActual = 1;
    this.tipo = 'personal';
    this.medio = 'email';
    this.selectedFile = null;
  }
  
  seleccionarTipoIdentificacion(tipoValue: string): void {
    this.nuevaPqrsForm.patchValue({tipo_identificacion: tipoValue});
    this.tipo = tipoValue;
  }

  // Métodos helper para labels de nuevos campos
  getTipoPersonaLabel(tipo: string): string {
    const tipos: { [key: string]: string } = {
      'natural': 'Persona Natural',
      'juridica': 'Persona Jurídica',
      'nna': 'Niños, Niñas y Adolescentes',
      'apoderado': 'Apoderado'
    };
    return tipos[tipo] || tipo;
  }

  getGeneroLabel(genero: string): string {
    const generos: { [key: string]: string } = {
      'femenino': 'Femenino',
      'masculino': 'Masculino',
      'otro': 'Otro'
    };
    return generos[genero] || genero;
  }

  getTipoSolicitudLabel(tipo: string): string {
    const tipos: { [key: string]: string } = {
      'peticion': 'Petición',
      'queja': 'Queja',
      'reclamo': 'Reclamo',
      'sugerencia': 'Sugerencia',
      'felicitacion': 'Felicitación',
      'denuncia': 'Denuncia',
      'solicitud_informacion': 'Solicitud de Información',
      'solicitud_datos_personales': 'Solicitud de Datos Personales',
      'agenda_cita': 'Agenda tu Cita'
    };
    return tipos[tipo] || tipo;
  }

  getCanalLlegadaLabel(canal: string): string {
    const canales: { [key: string]: string } = {
      'correo': 'Correo Electrónico',
      'carta': 'Carta',
      'buzon': 'Buzón de Sugerencias',
      'fisica': 'Entrega Física',
      'presencial': 'Presencial',
      'telefono': 'Teléfono',
      'web': 'Portal Web'
    };
    return canales[canal] || canal;
  }

  getMedioRespuestaLabel(medio: string): string {
    const medios: { [key: string]: string } = {
      'email': 'Correo Electrónico',
      'fisica': 'Correspondencia Física',
      'telefono': 'Teléfono',
      'ticket': 'Seguimiento por Ticket'
    };
    return medios[medio] || medio;
  }

  getTipoIdentificacionLabel(tipo: string): string {
    const tipos: { [key: string]: string } = {
      'personal': 'Personal (con identificación)',
      'anonima': 'Anónima'
    };
    return tipos[tipo] || tipo;
  }

  // Método para descargar archivo adjunto
  descargarArchivo(pqrs: PQRSWithDetails): void {
    if (!pqrs.archivo_adjunto) {
      this.alertService.error('Esta PQRS no tiene archivo adjunto', 'Error');
      return;
    }

    this.pqrsService.getArchivoDownloadUrl(pqrs.id).subscribe({
      next: (response) => {
        // Abrir la URL de descarga en una nueva pestaña
        window.open(response.download_url, '_blank');
        this.alertService.success('Descargando archivo...', 'Éxito');
      },
      error: (error) => {
        console.error('Error obteniendo URL de descarga:', error);
        this.alertService.error('Error al obtener el archivo. Por favor intenta nuevamente.', 'Error');
      }
    });
  }
}


