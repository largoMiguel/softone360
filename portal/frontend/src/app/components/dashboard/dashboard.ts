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
import { CorrespondenciaService } from '../../services/correspondencia.service';
import { User } from '../../models/user.model';
import { EntityContextService } from '../../services/entity-context.service';
import { PQRSWithDetails, ESTADOS_PQRS, EstadoPQRS, UpdatePQRSRequest, PQRSResponse, TIPOS_IDENTIFICACION, MEDIOS_RESPUESTA, CANALES_LLEGADA, TIPOS_SOLICITUD, TIPOS_PERSONA, GENEROS, TIPOS_DOCUMENTO } from '../../models/pqrs.model';
import { CorrespondenciaWithDetails, ESTADOS_CORRESPONDENCIA, TIPOS_RADICACION, TIPOS_SOLICITUD_CORRESPONDENCIA, TIEMPOS_RESPUESTA, CreateCorrespondencia, UpdateCorrespondencia, EstadoCorrespondencia, TipoRadicacion } from '../../models/correspondencia.model';
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
  tiposDocumento = TIPOS_DOCUMENTO;
  
  // Constantes para Correspondencia
  estadosCorrespondencia = ESTADOS_CORRESPONDENCIA;
  tiposRadicacion = TIPOS_RADICACION;
  tiposSolicitudCorrespondencia = TIPOS_SOLICITUD_CORRESPONDENCIA;
  tiemposRespuesta = TIEMPOS_RESPUESTA;
  
  // Listas de correspondencia
  correspondenciaList: CorrespondenciaWithDetails[] = [];
  correspondenciaSeleccionada: CorrespondenciaWithDetails | null = null;
  mostrarFormularioCorrespondencia: boolean = false;
  mostrarFormularioRespuestaCorrespondencia: boolean = false;
  mostrarDashboardCorrespondencia: boolean = true;
  filtroEstadoListadoCorrespondencia: string = '';
  correspondenciaEditando: CorrespondenciaWithDetails | null = null;
  respuestaCorrespondenciaTexto: string = '';
  nuevaCorrespondenciaForm: FormGroup;
  nextRadicadoCorrespondencia: string = '';
  loadingRadicadoCorrespondencia: boolean = false;

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
  totalPasos: number = 5; // Ahora incluye paso de resumen
  tipo: string = 'personal';
  medio: string = 'email';
  nextRadicado: string = '';
  loadingRadicado: boolean = false;
  
  // Validación de archivos
  readonly MAX_FILE_SIZE_MB = 10;
  readonly MAX_FILE_SIZE_BYTES = this.MAX_FILE_SIZE_MB * 1024 * 1024;
  
  // Guardado temporal (borrador)
  private readonly BORRADOR_KEY = 'pqrs_borrador';

  // Alertas (campana en navbar)
  showAlertsPanel = false;
  alerts$!: import('rxjs').Observable<AlertItem[]>;
  unreadCount$!: import('rxjs').Observable<number>;
  // Realce visual al abrir detalle desde alerta
  highlightDetalle = false;

  // Fechas e IA para el informe
  fechaInicio: string = '';
  fechaFin: string = '';
  mostrarSelectorFechas: boolean = false;
  filtroSecretario: string = '';
  filtroEstado: string = '';
  filtroTipo: string = '';
  usarIa: boolean = true;

  // Alertas IA de anomalías
  alertasIA: any[] = [];
  loadingAlertasIA: boolean = false;
  mostrarAlertasIA: boolean = false;

  // Histórico de informes generados
  historicoInformes: any[] = [];
  loadingHistorico: boolean = false;
  mostrarHistorico: boolean = false;

  // Fechas para el informe de correspondencia
  fechaInicioCorrespondencia: string = '';
  fechaFinCorrespondencia: string = '';
  mostrarSelectorFechasCorrespondencia: boolean = false;
  filtroEstadoCorrespondencia: string = '';
  filtroTipoCorrespondencia: string = '';

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
  selectedFileCorrespondenciaSolicitud: File | null = null;
  selectedFileCorrespondenciaRespuesta: File | null = null;
  justificacionAsignacion: string = '';

  // Datos para gráficos
  estadosChartData: ChartData<'doughnut'> = { labels: [], datasets: [] };
  tiposChartData: ChartData<'bar'> = { labels: [], datasets: [] };
  tendenciasChartData: ChartData<'line'> = { labels: [], datasets: [] };

  // Datos para gráficos de correspondencia
  correspondenciaEstadosChartData: ChartData<'doughnut'> = { labels: [], datasets: [] };
  correspondenciaTiposChartData: ChartData<'bar'> = { labels: [], datasets: [] };
  correspondenciaTendenciasChartData: ChartData<'line'> = { labels: [], datasets: [] };
  correspondenciaTiemposRespuestaChartData: ChartData<'pie'> = { labels: [], datasets: [] };

  doughnutChartType: ChartType = 'doughnut';
  barChartType: ChartType = 'bar';
  lineChartType: ChartType = 'line';
  pieChartType: ChartType = 'pie';

  // Control de paginación para "Mis PQRS"
  itemsPorPagina: number = 20;
  paginaActual: number = 1;

  // Control de paginación para "PQRS Recientes" en dashboard
  paginaActualDashboard: number = 1;

  // Control de alerta de PQRS próximas a vencer (mostrar solo una vez)
  alertaVencerMostrada: boolean = false;

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
    pdm: false,
    correspondencia: false,
    presupuesto: false
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
    private alertsEvents: AlertsEventsService,
    private correspondenciaService: CorrespondenciaService
  ) {
    // Inicializar streams de alertas con el servicio inyectado
    this.alerts$ = this.notificationsService.alertsStream;
    this.unreadCount$ = this.notificationsService.unreadCountStream;
    
    // Formulario de PQRS
    this.nuevaPqrsForm = this.fb.group({
      canal_llegada: ['web', Validators.required],
      tipo_identificacion: ['personal', Validators.required],
      medio_respuesta: ['email', Validators.required],
      tipo_solicitud: ['', Validators.required],
      cedula_ciudadano: [''],
      tipo_documento: ['CC'],
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

    // Escuchar cambios en tipo_documento para auto-completar tipo_persona y genero
    this.nuevaPqrsForm.get('tipo_documento')?.valueChanges.subscribe(doc => {
      if (doc === 'NIT') {
        this.nuevaPqrsForm.patchValue({ tipo_persona: 'juridica', genero: 'otro' });
      }
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
        emailControl?.setValidators([Validators.required, this.multipleEmailsValidator.bind(this)]);
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
      is_talento_humano: [false],
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
      tipo_documento: ['CC'],
      cedula_ciudadano: ['', Validators.required],
      nombre_ciudadano: ['', Validators.required],
      telefono_ciudadano: [''],
      email_ciudadano: [''],
      direccion_ciudadano: [''],
      asunto: ['', Validators.required],
      descripcion: ['', Validators.required],
      fecha_solicitud: ['', Validators.required]
    });

    // Formulario de correspondencia
    this.nuevaCorrespondenciaForm = this.fb.group({
      fecha_envio: [new Date().toISOString().split('T')[0], Validators.required],
      procedencia: [{ value: 'PERSONERIA MUNICIPAL', disabled: true }, Validators.required],
      destinacion: ['', Validators.required],
      numero_folios: [1, [Validators.required, Validators.min(1)]],
      tipo_radicacion: ['correo', Validators.required],
      correo_electronico: [''],
      direccion_radicacion: [''],
      tipo_solicitud: ['sugerencia', Validators.required],
      tiempo_respuesta_dias: [10],
      observaciones: ['']
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

  // Validador personalizado para múltiples correos electrónicos
  multipleEmailsValidator(control: any) {
    if (!control.value) {
      return null; // Si está vacío, no validar aquí (usar Validators.required si es necesario)
    }

    const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    const emails = control.value.split(/[,;]\s*/); // Separar por coma o punto y coma
    
    for (const email of emails) {
      const trimmedEmail = email.trim();
      if (trimmedEmail && !emailPattern.test(trimmedEmail)) {
        return { invalidEmails: true };
      }
    }
    
    return null;
  }

  ngOnInit() {
    // Sincronizar la vista activa con el query param ?v de la URL (controlado por la barra global)
    const qpSub = this.route.queryParamMap.subscribe(params => {
      const v = (params.get('v') || 'welcome') as string;
      const allowed: Record<string, true> = {
        'welcome': true,
        'dashboard': true,
        'mis-pqrs': true,
        'nueva-pqrs': true,
        'usuarios': true,
        'correspondencia': true
      };
      if (allowed[v]) {
        this.activeView = v;
      } else if (!params.has('v')) {
        this.activeView = 'welcome';
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
      this.loadCorrespondencias();
      // Redirigir a welcome si la vista activa ya no está habilitada para esta entidad
      if (this.activeView === 'correspondencia' && !this.correspondenciaEnabled()) {
        this.activeView = 'welcome';
      }
      if ((this.activeView === 'dashboard' || this.activeView === 'mis-pqrs' || this.activeView === 'nueva-pqrs') && !this.pqrsEnabled()) {
        this.activeView = 'welcome';
      }
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
    const topViews = new Set(['dashboard', 'mis-pqrs', 'nueva-pqrs', 'usuarios', 'welcome', 'correspondencia']);
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
      this.pasoActual = 1;  // Siempre iniciar en el primer paso
      this.loadNextRadicado();
      // Verificar si hay borrador guardado
      setTimeout(() => this.verificarBorrador(), 300);
    }
  }

  navigateTo(route: string) {
    const slug = this.entityContext.currentEntity?.slug;
    if (!slug) return;
    this.router.navigate([`/${slug}/${route}`]);
  }

  private updateQueryParamV(view?: string) {
    const qp: any = { ...this.route.snapshot.queryParams };
    if (!view || view === 'welcome') {
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
    // Cargar todas las PQRS (hasta 10000) para análisis y estadísticas correctas
    this.pqrsService.getPqrs({ skip: 0, limit: 10000 }).subscribe({
      next: (data) => {
        this.pqrsList = data;
        this.isLoading = false;
        this.paginaActual = 1; // Resetear a primera página de "Mis PQRS"
        this.paginaActualDashboard = 1; // Resetear a primera página de PQRS Recientes
        this.updateCharts();
        // Verificar PQRS próximas a vencer (solo mostrar once)
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

  /**
   * Retorna los PQRS filtrados para la vista actual (con paginación)
   * Se usa en la tabla de "Mis PQRS"
   */
  getMisPqrsDelMisView(): PQRSWithDetails[] {
    const misPqrs = this.getMisPqrs(); // Obtener lista filtrada
    const inicio = (this.paginaActual - 1) * this.itemsPorPagina;
    const fin = inicio + this.itemsPorPagina;
    return misPqrs.slice(inicio, fin);
  }

  /**
   * Calcula el total de páginas para la vista "Mis PQRS"
   */
  getTotalPaginasDelMisView(): number {
    return Math.ceil(this.getMisPqrs().length / this.itemsPorPagina);
  }

  /**
   * Obtiene el rango de items mostrados en la página actual
   */
  getRangoItemosActualesDelMisView(): { inicio: number; fin: number; total: number } {
    const misPqrs = this.getMisPqrs();
    const inicio = (this.paginaActual - 1) * this.itemsPorPagina + 1;
    const fin = Math.min(this.paginaActual * this.itemsPorPagina, misPqrs.length);
    return { inicio, fin, total: misPqrs.length };
  }

  /**
   * Obtiene un array de números de página para mostrar en el paginador
   */
  getNumerosPaginasDelMisView(): number[] {
    const totalPaginas = this.getTotalPaginasDelMisView();
    const paginas: number[] = [];
    const maxPaginasMostradas = 5;

    if (totalPaginas <= maxPaginasMostradas) {
      // Si hay pocas páginas, mostrar todas
      for (let i = 1; i <= totalPaginas; i++) {
        paginas.push(i);
      }
    } else {
      // Mostrar páginas alrededor de la actual
      let inicio = Math.max(1, this.paginaActual - 2);
      let fin = Math.min(totalPaginas, this.paginaActual + 2);

      if (fin - inicio + 1 < maxPaginasMostradas) {
        if (inicio === 1) {
          fin = Math.min(totalPaginas, inicio + maxPaginasMostradas - 1);
        } else {
          inicio = Math.max(1, fin - maxPaginasMostradas + 1);
        }
      }

      if (inicio > 1) {
        paginas.push(1);
        if (inicio > 2) paginas.push(-1); // Representa "..."
      }

      for (let i = inicio; i <= fin; i++) {
        paginas.push(i);
      }

      if (fin < totalPaginas) {
        if (fin < totalPaginas - 1) paginas.push(-1); // Representa "..."
        paginas.push(totalPaginas);
      }
    }

    return paginas;
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
    this.paginaActual = 1; // Resetear a primera página
  }

  // Filtrar por estado desde las tarjetas de estadísticas y navegar a Mis PQRS
  filtrarPorEstado(estado: string): void {
    // Limpiar filtros previos
    this.limpiarFiltrosGenerales();

    // Aplicar el nuevo filtro de estado (string vacío = todos)
    if (estado) {
      this.filtroGeneralEstado = estado;
    }

    // Resetear a primera página
    this.paginaActual = 1;

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
      // Validar que si el estado es 'cerrado', debe tener respuesta
      if (this.selectedEstado === 'cerrado' && !this.selectedPqrs.respuesta) {
        this.alertService.warning(
          'No se puede cerrar la PQRS sin haber enviado una respuesta al ciudadano. Por favor, envíe primero la respuesta.',
          'Respuesta Requerida'
        );
        return;
      }

      // Validar que si el medio de respuesta es email y el correo falló, no se puede cerrar
      if (this.selectedEstado === 'cerrado'
          && this.selectedPqrs.medio_respuesta === 'email'
          && this.selectedPqrs.email_enviado === false) {
        this.alertService.error(
          'No se puede cerrar esta PQRS: el correo de respuesta no fue entregado al ciudadano. '
          + 'Reintente el envío desde la sección de respuesta oficial.',
          'Email No Entregado'
        );
        return;
      }

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

      // Si hay archivo, saltar email en create (se enviará desde upload con el link del archivo)
      const hasFile = !!(this.selectedFile);
      this.pqrsService.createPqrs(formData, hasFile).subscribe({
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
                this.limpiarBorrador(); // Limpiar borrador después de crear exitosamente
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
                this.limpiarBorrador(); // Limpiar borrador después de advertencia
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
            this.limpiarBorrador(); // Limpiar borrador después de crear exitosamente
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
      tipo_documento: (pqrs as any).tipo_documento || 'CC',
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
      tipo_documento: formValue.tipo_documento || null,
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

  // Seleccionar archivo para correspondencia (solicitud o respuesta)
  onFileSelectedCorrespondencia(event: any, tipo: 'solicitud' | 'respuesta'): void {
    const file = event.target.files[0];
    if (file) {
      // Validar tamaño (máximo 10MB)
      if (file.size > 10 * 1024 * 1024) {
        this.alertService.error('El archivo no puede superar 10MB', 'Error');
        event.target.value = '';
        return;
      }
      
      if (tipo === 'solicitud') {
        this.selectedFileCorrespondenciaSolicitud = file;
      } else {
        this.selectedFileCorrespondenciaRespuesta = file;
      }
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
      
      // Si tiene acceso a Talento Humano, agregar módulo de asistencia
      if (userData.is_talento_humano) {
        allowed_modules.push('asistencia');
      }

      // Agregar el rol de secretario y los módulos
      const createData = {
        ...userData,
        role: 'secretario',
        allowed_modules,
        is_talento_humano: userData.is_talento_humano || false
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
        // Determinar mensaje según resultado del email
        let mensaje = `La respuesta ha sido enviada exitosamente y el estado de la PQRS N° ${this.selectedPqrs?.numero_radicado} ha cambiado a "Resuelto".`;
        if (response.medio_respuesta === 'email') {
          if (response.email_enviado === true) {
            mensaje += ' El correo fue entregado exitosamente al ciudadano.';
          } else if (response.email_enviado === false) {
            mensaje = `Respuesta guardada para la PQRS N° ${this.selectedPqrs?.numero_radicado}, pero el correo NO pudo ser entregado. Use el botón "Reintentar envío" para volver a enviarlo.`;
          }
        }
        const isEmailError = response.medio_respuesta === 'email' && response.email_enviado === false;
        if (isEmailError) {
          this.alertService.warning(mensaje, 'Revise el Correo del Ciudadano');
        } else {
          this.alertService.success(mensaje, 'Respuesta Enviada');
        }
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

  retryEmail(): void {
    if (!this.selectedPqrs) return;
    this.pqrsService.retryEmail(this.selectedPqrs.id).subscribe({
      next: (res) => {
        if (res.success) {
          this.alertService.success('El correo fue reenviado y entregado exitosamente al ciudadano.', 'Email Entregado');
        } else {
          this.alertService.error(
            `No se pudo reenviar el correo: ${res.message}. Verifique que el correo del ciudadano sea correcto.`,
            'Error de Entrega'
          );
        }
        // Recargar para reflejar el nuevo estado de email_enviado
        if (this.selectedPqrs) {
          this.pqrsService.getPqrsById(this.selectedPqrs.id).subscribe({
            next: (pqrsActualizada) => {
              const index = this.pqrsList.findIndex(p => p.id === pqrsActualizada.id);
              if (index !== -1) this.pqrsList[index] = pqrsActualizada;
              this.selectedPqrs = pqrsActualizada;
            }
          });
        }
      },
      error: (error) => {
        const msg = this.extractErrorMessage(error);
        this.alertService.error(msg, 'Error al Reenviar Email');
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

  // ========== MÉTODOS DE PAGINACIÓN PARA "MIS PQRS" ==========
  
  /**
   * Obtiene los PQRS para la página actual (20 items por página)
   */
  getPqrsDelMisView(): PQRSWithDetails[] {
    const inicio = (this.paginaActual - 1) * this.itemsPorPagina;
    const fin = inicio + this.itemsPorPagina;
    return this.pqrsList.slice(inicio, fin);
  }

  /**
   * Calcula el total de páginas disponibles
   */
  getTotalPaginas(): number {
    return Math.ceil(this.pqrsList.length / this.itemsPorPagina);
  }

  /**
   * Obtiene el rango de items mostrados en la página actual
   */
  getRangoItemosActuales(): { inicio: number; fin: number; total: number } {
    const inicio = (this.paginaActual - 1) * this.itemsPorPagina + 1;
    const fin = Math.min(this.paginaActual * this.itemsPorPagina, this.pqrsList.length);
    return { inicio, fin, total: this.pqrsList.length };
  }

  /**
   * Navega a una página específica
   */
  irAPagina(numero: number): void {
    const totalPaginas = this.getTotalPaginas();
    if (numero >= 1 && numero <= totalPaginas) {
      this.paginaActual = numero;
    }
  }

  /**
   * Va a la página anterior
   */
  irAPaginaAnterior(): void {
    if (this.paginaActual > 1) {
      this.paginaActual--;
    }
  }

  /**
   * Va a la página siguiente
   */
  irAPaginaSiguiente(): void {
    const totalPaginas = this.getTotalPaginas();
    if (this.paginaActual < totalPaginas) {
      this.paginaActual++;
    }
  }

  /**
   * Obtiene un array de números de página para mostrar en el paginador
   */
  getNumerosPaginas(): number[] {
    const totalPaginas = this.getTotalPaginas();
    const paginas: number[] = [];
    const maxPaginasMostradas = 5;

    if (totalPaginas <= maxPaginasMostradas) {
      // Si hay pocas páginas, mostrar todas
      for (let i = 1; i <= totalPaginas; i++) {
        paginas.push(i);
      }
    } else {
      // Mostrar páginas alrededor de la actual
      let inicio = Math.max(1, this.paginaActual - 2);
      let fin = Math.min(totalPaginas, this.paginaActual + 2);

      if (fin - inicio + 1 < maxPaginasMostradas) {
        if (inicio === 1) {
          fin = Math.min(totalPaginas, inicio + maxPaginasMostradas - 1);
        } else {
          inicio = Math.max(1, fin - maxPaginasMostradas + 1);
        }
      }

      if (inicio > 1) {
        paginas.push(1);
        if (inicio > 2) paginas.push(-1); // Representa "..."
      }

      for (let i = inicio; i <= fin; i++) {
        paginas.push(i);
      }

      if (fin < totalPaginas) {
        if (fin < totalPaginas - 1) paginas.push(-1); // Representa "..."
        paginas.push(totalPaginas);
      }
    }

    return paginas;
  }

  // ========== MÉTODOS DE PAGINACIÓN PARA "PQRS RECIENTES" EN DASHBOARD ==========

  /**
   * Obtiene los PQRS recientes para la página actual del dashboard (20 items por página)
   */
  getPqrsRecientesPaginadas(): PQRSWithDetails[] {
    const inicio = (this.paginaActualDashboard - 1) * this.itemsPorPagina;
    const fin = inicio + this.itemsPorPagina;
    return this.pqrsList.slice(inicio, fin);
  }

  /**
   * Calcula el total de páginas para PQRS recientes
   */
  getTotalPaginasRecientes(): number {
    return Math.ceil(this.pqrsList.length / this.itemsPorPagina);
  }

  /**
   * Obtiene el rango de items mostrados para PQRS recientes
   */
  getRangoItemosRecientes(): { inicio: number; fin: number; total: number } {
    const inicio = (this.paginaActualDashboard - 1) * this.itemsPorPagina + 1;
    const fin = Math.min(this.paginaActualDashboard * this.itemsPorPagina, this.pqrsList.length);
    return { inicio, fin, total: this.pqrsList.length };
  }

  /**
   * Va a una página específica en PQRS recientes
   */
  irAPaginaRecientes(numero: number): void {
    const totalPaginas = this.getTotalPaginasRecientes();
    if (numero >= 1 && numero <= totalPaginas) {
      this.paginaActualDashboard = numero;
    }
  }

  /**
   * Va a la página anterior en PQRS recientes
   */
  irAPaginaAnteriorRecientes(): void {
    if (this.paginaActualDashboard > 1) {
      this.paginaActualDashboard--;
    }
  }

  /**
   * Va a la página siguiente en PQRS recientes
   */
  irAPaginaSiguienteRecientes(): void {
    const totalPaginas = this.getTotalPaginasRecientes();
    if (this.paginaActualDashboard < totalPaginas) {
      this.paginaActualDashboard++;
    }
  }

  /**
   * Obtiene un array de números de página para PQRS recientes
   */
  getNumerosPagenasRecientes(): number[] {
    const totalPaginas = this.getTotalPaginasRecientes();
    const paginas: number[] = [];
    const maxPaginasMostradas = 5;

    if (totalPaginas <= maxPaginasMostradas) {
      for (let i = 1; i <= totalPaginas; i++) {
        paginas.push(i);
      }
    } else {
      let inicio = Math.max(1, this.paginaActualDashboard - 2);
      let fin = Math.min(totalPaginas, this.paginaActualDashboard + 2);

      if (fin - inicio + 1 < maxPaginasMostradas) {
        if (inicio === 1) {
          fin = Math.min(totalPaginas, inicio + maxPaginasMostradas - 1);
        } else {
          inicio = Math.max(1, fin - maxPaginasMostradas + 1);
        }
      }

      if (inicio > 1) {
        paginas.push(1);
        if (inicio > 2) paginas.push(-1);
      }

      for (let i = inicio; i <= fin; i++) {
        paginas.push(i);
      }

      if (fin < totalPaginas) {
        if (fin < totalPaginas - 1) paginas.push(-1);
        paginas.push(totalPaginas);
      }
    }

    return paginas;
  }

  // ========== FIN MÉTODOS DE PAGINACIÓN ==========


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
  // Solo muestra la alerta una vez al iniciar sesión
  async verificarPqrsProximasVencer(): Promise<void> {
    // Solo mostrar la alerta una vez
    if (this.alertaVencerMostrada) {
      return;
    }

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
      this.alertaVencerMostrada = true; // Marcar como mostrada
    } else {
      // Aunque no haya PQRS próximas a vencer, marcamos como mostrada para no revisar constantemente
      this.alertaVencerMostrada = true;
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
    const tiposLabels = ['Petición', 'Queja', 'Reclamo', 'Sugerencia', 'Felicitación', 'Denuncia', 'Solicitud Info', 'Datos Personales', 'Agendar Cita'];
    const tiposData = [
      this.getPqrsPorTipo('peticion'),
      this.getPqrsPorTipo('queja'),
      this.getPqrsPorTipo('reclamo'),
      this.getPqrsPorTipo('sugerencia'),
      this.getPqrsPorTipo('felicitacion'),
      this.getPqrsPorTipo('denuncia'),
      this.getPqrsPorTipo('solicitud_informacion'),
      this.getPqrsPorTipo('solicitud_datos_personales'),
      this.getPqrsPorTipo('agenda_cita')
    ];

    this.tiposChartData = {
      labels: tiposLabels,
      datasets: [{
        label: 'PQRS por Tipo',
        data: tiposData,
        backgroundColor: [
          'rgba(33, 107, 168, 0.7)',      // Petición
          'rgba(255, 193, 7, 0.7)',       // Queja
          'rgba(220, 53, 69, 0.7)',       // Reclamo
          'rgba(40, 167, 69, 0.7)',       // Sugerencia
          'rgba(111, 66, 193, 0.7)',      // Felicitación
          'rgba(23, 162, 184, 0.7)',      // Denuncia
          'rgba(241, 108, 33, 0.7)',      // Solicitud Info
          'rgba(108, 117, 125, 0.7)',     // Datos Personales
          'rgba(37, 110, 137, 0.7)'       // Agendar Cita
        ],
        borderColor: [
          'rgba(33, 107, 168, 1)',
          'rgba(255, 193, 7, 1)',
          'rgba(220, 53, 69, 1)',
          'rgba(40, 167, 69, 1)',
          'rgba(111, 66, 193, 1)',
          'rgba(23, 162, 184, 1)',
          'rgba(241, 108, 33, 1)',
          'rgba(108, 117, 125, 1)',
          'rgba(37, 110, 137, 1)'
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

  updateCorrespondenciaCharts(): void {
    // Gráfico de estados de correspondencia (Doughnut)
    const estadosLabels = ['Enviada', 'En Proceso', 'Resuelta', 'Cerrada'];
    const estadosData = [
      this.correspondenciaList.filter(c => c.estado === 'enviada').length,
      this.correspondenciaList.filter(c => c.estado === 'en_proceso').length,
      this.correspondenciaList.filter(c => c.estado === 'resuelta').length,
      this.correspondenciaList.filter(c => c.estado === 'cerrada').length,
    ];

    this.correspondenciaEstadosChartData = {
      labels: estadosLabels,
      datasets: [{
        data: estadosData,
        backgroundColor: [
          '#ffc107',
          '#17a2b8',
          '#28a745',
          '#6c757d'
        ],
        hoverBackgroundColor: [
          '#ffca2c',
          '#1fc8e3',
          '#48c774',
          '#868e96'
        ]
      }]
    };

    // Gráfico de tipos de solicitud (Barras)
    const tiposLabels = ['Sugerencia', 'Petición', 'Queja', 'Reclamo', 'Felicitación', 'Info', 'Otro'];
    const tiposData = [
      this.correspondenciaList.filter(c => c.tipo_solicitud === 'sugerencia').length,
      this.correspondenciaList.filter(c => c.tipo_solicitud === 'peticion').length,
      this.correspondenciaList.filter(c => c.tipo_solicitud === 'queja').length,
      this.correspondenciaList.filter(c => c.tipo_solicitud === 'reclamo').length,
      this.correspondenciaList.filter(c => c.tipo_solicitud === 'felicitacion').length,
      this.correspondenciaList.filter(c => c.tipo_solicitud === 'solicitud_informacion').length,
      this.correspondenciaList.filter(c => c.tipo_solicitud === 'otro').length
    ];

    this.correspondenciaTiposChartData = {
      labels: tiposLabels,
      datasets: [{
        label: 'Correspondencia por Tipo',
        data: tiposData,
        backgroundColor: [
          'rgba(40, 167, 69, 0.7)',
          'rgba(33, 107, 168, 0.7)',
          'rgba(255, 193, 7, 0.7)',
          'rgba(220, 53, 69, 0.7)',
          'rgba(111, 66, 193, 0.7)',
          'rgba(23, 162, 184, 0.7)',
          'rgba(108, 117, 125, 0.7)'
        ],
        borderColor: [
          'rgba(40, 167, 69, 1)',
          'rgba(33, 107, 168, 1)',
          'rgba(255, 193, 7, 1)',
          'rgba(220, 53, 69, 1)',
          'rgba(111, 66, 193, 1)',
          'rgba(23, 162, 184, 1)',
          'rgba(108, 117, 125, 1)'
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
      return this.correspondenciaList.filter(c => {
        const fecha = new Date(c.fecha_envio);
        return fecha.toDateString() === dia.toDateString();
      }).length;
    });

    this.correspondenciaTendenciasChartData = {
      labels: tendenciasLabels,
      datasets: [{
        label: 'Correspondencia Recibida',
        data: tendenciasData,
        borderColor: '#28a745',
        backgroundColor: 'rgba(40, 167, 69, 0.1)',
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#28a745',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointRadius: 5,
        pointHoverRadius: 7
      }]
    };

    // Gráfico de tiempos de respuesta (Pie)
    const tiemposLabels = ['5 días', '10 días', '15 días'];
    const tiemposData = [
      this.correspondenciaList.filter(c => c.tiempo_respuesta_dias === 5).length,
      this.correspondenciaList.filter(c => c.tiempo_respuesta_dias === 10).length,
      this.correspondenciaList.filter(c => c.tiempo_respuesta_dias === 15).length
    ];

    this.correspondenciaTiemposRespuestaChartData = {
      labels: tiemposLabels,
      datasets: [{
        data: tiemposData,
        backgroundColor: [
          '#28a745',
          '#ffc107',
          '#dc3545'
        ],
        hoverBackgroundColor: [
          '#48c774',
          '#ffca2c',
          '#e4606d'
        ]
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

  /** Cargar alertas IA de anomalías en PQRS */
  cargarAlertasIA(): void {
    this.loadingAlertasIA = true;
    this.pqrsService.getAlertasIA().subscribe({
      next: (data) => {
        this.alertasIA = data.alertas || [];
        this.loadingAlertasIA = false;
        this.mostrarAlertasIA = true;
      },
      error: (err) => {
        console.error('Error cargando alertas IA:', err);
        this.loadingAlertasIA = false;
      }
    });
  }

  /** Cargar histórico de informes generados */
  cargarHistoricoInformes(): void {
    this.loadingHistorico = true;
    this.pqrsService.getHistoricoInformes().subscribe({
      next: (data) => {
        this.historicoInformes = data.informes || [];
        this.loadingHistorico = false;
        this.mostrarHistorico = true;
      },
      error: (err) => {
        console.error('Error cargando histórico:', err);
        this.loadingHistorico = false;
        this.historicoInformes = [];
      }
    });
  }

  getNivelAlertaClass(nivel: string): string {
    const map: Record<string, string> = {
      'critica': 'danger',
      'advertencia': 'warning',
      'informacion': 'info'
    };
    return map[nivel] || 'secondary';
  }

  getNivelAlertaIcon(nivel: string): string {
    const map: Record<string, string> = {
      'critica': 'fas fa-exclamation-circle',
      'advertencia': 'fas fa-exclamation-triangle',
      'informacion': 'fas fa-info-circle'
    };
    return map[nivel] || 'fas fa-bell';
  }

  /**
   * Genera informe PQRS en el backend con gráficos profesionales
   * y template institucional personalizado
   */
  generarInformeBackend(): void {
    if (!this.fechaInicio || !this.fechaFin) {
      this.alertService.error('Debes seleccionar un rango de fechas');
      return;
    }

    const request = {
      fecha_inicio: this.fechaInicio,
      fecha_fin: this.fechaFin,
      estado: this.filtroEstado || undefined,
      tipo: this.filtroTipo || undefined,
      usar_ia: this.usarIa
    };

    this.alertService.info('Generando informe en el servidor...');

    this.pqrsService.generarInformePdf(request).subscribe({
      next: (response: any) => {
        // Cerrar modal de generación
        this.mostrarSelectorFechas = false;

        // Construir mensaje de éxito detallado
        let mensaje = `
          <div style="text-align: left;">
            <strong>✅ Informe generado exitosamente</strong><br><br>
            <strong>📊 Estadísticas:</strong><br>
            • Total PQRS: ${response.total_pqrs}<br>
            • Tasa de resolución: ${response.tasa_resolucion}%<br>
            • Tamaño: ${response.file_size_mb} MB<br>
            ${response.used_template ? '• ✅ Con template institucional<br>' : '• ℹ️ Sin template personalizado<br>'}
            ${response.used_ai ? '• 🤖 Con análisis IA incluido<br>' : ''}
            <br>
            <strong>🔗 Descarga:</strong><br>
            <a href="${response.download_url}" target="_blank" style="color: #007bff;">
              Click aquí para descargar
            </a><br>
            <small style="color: #666;">Válido por 7 días</small>
          </div>
        `;

        this.alertService.success(mensaje, 'Informe Generado');

        // Auto-abrir PDF en nueva pestaña
        window.open(response.download_url, '_blank');
      },
      error: (error: any) => {
        const errorMsg = error.error?.detail || error.message || 'Error desconocido';
        this.alertService.error(`Error al generar informe: ${errorMsg}`);
      }
    });
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
    return this.entityContext.currentEntity?.enable_contratacion ?? false;
  }

  pdmEnabled(): boolean {
    return this.entityContext.currentEntity?.enable_pdm ?? true;
  }

  correspondenciaEnabled(): boolean {
    return this.entityContext.currentEntity?.enable_correspondencia ?? false;
  }

  canAccessCorrespondencia(): boolean {
    return this.correspondenciaEnabled() && this.userHasModule('correspondencia');
  }

  presupuestoEnabled(): boolean {
    return this.entityContext.currentEntity?.enable_presupuesto ?? false;
  }

  // Métodos auxiliares para gestión de usuarios
  hasAnyModuleSelected(): boolean {
    const form = this.nuevoSecretarioForm;
    return form.get('module_pqrs')?.value ||
      form.get('module_planes')?.value ||
      form.get('module_contratacion')?.value ||
      form.get('module_pdm')?.value ||
      form.get('is_talento_humano')?.value;
  }

  getModuleName(module: string): string {
    const names: Record<string, string> = {
      'pqrs': 'PQRS',
      'planes_institucionales': 'Planes',
      'contratacion': 'Contratación',
      'pdm': 'PDM',
      'asistencia': 'Control de Asistencia'
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
      pdm: usuario.allowed_modules?.includes('pdm') || false,
      correspondencia: usuario.allowed_modules?.includes('correspondencia') || false,
      presupuesto: usuario.allowed_modules?.includes('presupuesto') || false
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
    if (this.modulosSeleccionados.correspondencia) modules.push('correspondencia');
    if (this.modulosSeleccionados.presupuesto) modules.push('presupuesto');

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
      // Guardar borrador al avanzar de paso
      this.guardarBorrador();
    }
  }

  pasoAnterior(): void {
    if (this.pasoActual > 1) {
      this.pasoActual--;
      // Guardar borrador al retroceder
      this.guardarBorrador();
    }
  }

  irAPaso(paso: number): void {
    if (paso >= 1 && paso <= this.totalPasos) {
      this.pasoActual = paso;
      // Guardar borrador al cambiar de paso
      this.guardarBorrador();
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
    // Limpiar borrador al resetear
    this.limpiarBorrador();
  }
  
  // Guardar borrador automáticamente
  guardarBorrador(): void {
    try {
      const borrador = {
        formData: this.nuevaPqrsForm.value,
        pasoActual: this.pasoActual,
        tipo: this.tipo,
        medio: this.medio,
        timestamp: new Date().toISOString()
      };
      localStorage.setItem(this.BORRADOR_KEY, JSON.stringify(borrador));
      console.log('💾 Borrador guardado automáticamente');
    } catch (error) {
      console.error('Error guardando borrador:', error);
    }
  }
  
  // Cargar borrador si existe
  cargarBorrador(): boolean {
    try {
      const borradorStr = localStorage.getItem(this.BORRADOR_KEY);
      if (!borradorStr) return false;
      
      const borrador = JSON.parse(borradorStr);
      const timestamp = new Date(borrador.timestamp);
      const ahora = new Date();
      const diferenciaHoras = (ahora.getTime() - timestamp.getTime()) / (1000 * 60 * 60);
      
      // Solo cargar si el borrador tiene menos de 24 horas
      if (diferenciaHoras > 24) {
        this.limpiarBorrador();
        return false;
      }
      
      // Restaurar datos del formulario
      this.nuevaPqrsForm.patchValue(borrador.formData);
      this.pasoActual = borrador.pasoActual || 1;
      this.tipo = borrador.tipo || 'personal';
      this.medio = borrador.medio || 'email';
      
      return true;
    } catch (error) {
      console.error('Error cargando borrador:', error);
      return false;
    }
  }
  
  // Limpiar borrador
  limpiarBorrador(): void {
    try {
      localStorage.removeItem(this.BORRADOR_KEY);
      console.log('🗑️ Borrador eliminado');
    } catch (error) {
      console.error('Error limpiando borrador:', error);
    }
  }
  
  // Preguntar si desea cargar borrador
  async verificarBorrador(): Promise<void> {
    const borradorStr = localStorage.getItem(this.BORRADOR_KEY);
    if (!borradorStr) return;
    
    try {
      const borrador = JSON.parse(borradorStr);
      const timestamp = new Date(borrador.timestamp);
      const diferenciaHoras = (timestamp.getTime() - new Date().getTime()) / (1000 * 60 * 60);
      
      if (Math.abs(diferenciaHoras) > 24) {
        this.limpiarBorrador();
        return;
      }
      
      const resultado = await this.alertService.confirm(
        '¿Deseas continuar con el borrador guardado?',
        'Borrador Encontrado'
      );
      
      if (resultado) {
        this.cargarBorrador();
        this.alertService.info('Borrador cargado correctamente', 'Borrador Restaurado');
      } else {
        this.limpiarBorrador();
      }
    } catch (error) {
      console.error('Error verificando borrador:', error);
      this.limpiarBorrador();
    }
  }
  
  seleccionarCanal(valor: string): void {
    this.nuevaPqrsForm.patchValue({ canal_llegada: valor });
    setTimeout(() => this.siguientePaso(), 250);
  }

  seleccionarTipoSolicitud(valor: string): void {
    this.nuevaPqrsForm.patchValue({ tipo_solicitud: valor });
    setTimeout(() => this.siguientePaso(), 250);
  }

  seleccionarTipoIdentificacion(tipoValue: string): void {
    this.nuevaPqrsForm.patchValue({tipo_identificacion: tipoValue});
    this.tipo = tipoValue;
    setTimeout(() => this.siguientePaso(), 250);
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

  // Métodos de estadísticas para correspondencia
  getTotalCorrespondencias(): number {
    return this.correspondenciaList.length;
  }

  getCorrespondenciasEnviadas(): number {
    return this.correspondenciaList.filter(c => c.estado === 'enviada').length;
  }

  getCorrespondenciasEnProceso(): number {
    return this.correspondenciaList.filter(c => c.estado === 'en_proceso').length;
  }

  getCorrespondenciasResueltas(): number {
    return this.correspondenciaList.filter(c => c.estado === 'resuelta').length;
  }

  getCorrespondenciasCerradas(): number {
    return this.correspondenciaList.filter(c => c.estado === 'cerrada').length;
  }

  getCorrespondenciasFiltradas(): CorrespondenciaWithDetails[] {
    if (!this.filtroEstadoListadoCorrespondencia) return this.correspondenciaList;
    return this.correspondenciaList.filter(c => c.estado === this.filtroEstadoListadoCorrespondencia);
  }

  filtrarCorrespondenciaPorEstado(estado: string): void {
    this.filtroEstadoListadoCorrespondencia = estado;
    this.mostrarDashboardCorrespondencia = false;
    this.mostrarFormularioCorrespondencia = false;
    this.correspondenciaSeleccionada = null;
    this.mostrarFormularioRespuestaCorrespondencia = false;
  }

  // Métodos para informe de correspondencia
  mostrarFormularioInformeCorrespondencia(): void {
    // Establecer fechas por defecto (último mes)
    const fechaFin = new Date();
    const fechaInicio = new Date();
    fechaInicio.setMonth(fechaInicio.getMonth() - 1);

    this.fechaInicioCorrespondencia = fechaInicio.toISOString().split('T')[0];
    this.fechaFinCorrespondencia = fechaFin.toISOString().split('T')[0];

    // Resetear filtros
    this.filtroEstadoCorrespondencia = '';
    this.filtroTipoCorrespondencia = '';

    this.mostrarSelectorFechasCorrespondencia = true;
  }

  cancelarInformeCorrespondencia(): void {
    this.mostrarSelectorFechasCorrespondencia = false;
    this.filtroEstadoCorrespondencia = '';
    this.filtroTipoCorrespondencia = '';
  }

  async generarInformeCorrespondencia(): Promise<void> {
    if (!this.fechaInicioCorrespondencia || !this.fechaFinCorrespondencia) {
      this.alertService.warning('Debes seleccionar el rango de fechas para el informe.', 'Fechas Requeridas');
      return;
    }

    const inicio = new Date(this.fechaInicioCorrespondencia + 'T00:00:00');
    const fin = new Date(this.fechaFinCorrespondencia + 'T23:59:59');

    if (inicio > fin) {
      this.alertService.warning('La fecha inicial no puede ser posterior a la fecha final.', 'Fechas Inválidas');
      return;
    }

    try {
      this.mostrarSelectorFechasCorrespondencia = false;

      this.alertService.info('Generando informe de correspondencia... Por favor espera.', 'Generando Informe');

      // Filtrar correspondencias por rango de fechas y otros criterios
      let correspondenciasFiltradas = this.correspondenciaList.filter(corr => {
        const fechaEnvio = new Date(corr.fecha_envio);
        const fechaNormalizada = new Date(fechaEnvio.getFullYear(), fechaEnvio.getMonth(), fechaEnvio.getDate());
        const inicioNormalizado = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate());
        const finNormalizado = new Date(fin.getFullYear(), fin.getMonth(), fin.getDate());
        return fechaNormalizada >= inicioNormalizado && fechaNormalizada <= finNormalizado;
      });

      // Aplicar filtros adicionales
      if (this.filtroEstadoCorrespondencia) {
        correspondenciasFiltradas = correspondenciasFiltradas.filter(c => c.estado === this.filtroEstadoCorrespondencia);
      }

      if (this.filtroTipoCorrespondencia) {
        correspondenciasFiltradas = correspondenciasFiltradas.filter(c => c.tipo_solicitud === this.filtroTipoCorrespondencia);
      }

      if (correspondenciasFiltradas.length === 0) {
        this.alertService.warning('No hay correspondencias en el rango de fechas seleccionado.', 'Sin Datos');
        return;
      }

      // Calcular estadísticas
      const totalCorrespondencias = correspondenciasFiltradas.length;
      const porEstado = {
        enviada: correspondenciasFiltradas.filter(c => c.estado === 'enviada').length,
        en_proceso: correspondenciasFiltradas.filter(c => c.estado === 'en_proceso').length,
        resuelta: correspondenciasFiltradas.filter(c => c.estado === 'resuelta').length,
        cerrada: correspondenciasFiltradas.filter(c => c.estado === 'cerrada').length
      };

      const porTipo = {
        sugerencia: correspondenciasFiltradas.filter(c => c.tipo_solicitud === 'sugerencia').length,
        peticion: correspondenciasFiltradas.filter(c => c.tipo_solicitud === 'peticion').length,
        queja: correspondenciasFiltradas.filter(c => c.tipo_solicitud === 'queja').length,
        reclamo: correspondenciasFiltradas.filter(c => c.tipo_solicitud === 'reclamo').length,
        felicitacion: correspondenciasFiltradas.filter(c => c.tipo_solicitud === 'felicitacion').length,
        solicitud_informacion: correspondenciasFiltradas.filter(c => c.tipo_solicitud === 'solicitud_informacion').length,
        otro: correspondenciasFiltradas.filter(c => c.tipo_solicitud === 'otro').length
      };

      const correoElectronico = correspondenciasFiltradas.filter(c => c.tipo_radicacion === 'correo').length;
      const radicacionFisica = correspondenciasFiltradas.filter(c => c.tipo_radicacion === 'fisico').length;

      // Crear resumen para el informe
      const resumenInforme = `
INFORME DE CORRESPONDENCIA OFICIAL
Período: ${this.fechaInicioCorrespondencia} al ${this.fechaFinCorrespondencia}
Entidad: ${this.entityContext.currentEntity?.name || 'N/A'}
Fecha de Generación: ${new Date().toLocaleDateString('es-ES')}

═══════════════════════════════════════════════════════════

RESUMEN EJECUTIVO:

Total de Correspondencias: ${totalCorrespondencias}

DISTRIBUCIÓN POR ESTADO:
• Enviadas: ${porEstado.enviada} (${((porEstado.enviada / totalCorrespondencias) * 100).toFixed(1)}%)
• En Proceso: ${porEstado.en_proceso} (${((porEstado.en_proceso / totalCorrespondencias) * 100).toFixed(1)}%)
• Resueltas: ${porEstado.resuelta} (${((porEstado.resuelta / totalCorrespondencias) * 100).toFixed(1)}%)
• Cerradas: ${porEstado.cerrada} (${((porEstado.cerrada / totalCorrespondencias) * 100).toFixed(1)}%)

DISTRIBUCIÓN POR TIPO DE SOLICITUD:
• Sugerencia: ${porTipo.sugerencia}
• Petición: ${porTipo.peticion}
• Queja: ${porTipo.queja}
• Reclamo: ${porTipo.reclamo}
• Felicitación: ${porTipo.felicitacion}
• Solicitud de Información: ${porTipo.solicitud_informacion}
• Otro: ${porTipo.otro}

TIPO DE RADICACIÓN:
• Correo Electrónico: ${correoElectronico} (${((correoElectronico / totalCorrespondencias) * 100).toFixed(1)}%)
• Radicación Física: ${radicacionFisica} (${((radicacionFisica / totalCorrespondencias) * 100).toFixed(1)}%)

═══════════════════════════════════════════════════════════

DETALLE DE CORRESPONDENCIAS:
`;

      // Generar PDF usando el servicio de reportes con los datos de correspondencia
      const entityName = this.entityContext.currentEntity?.name || 'Entidad';
      const reportData = {
        tipo: 'correspondencia',
        fecha_inicio: this.fechaInicioCorrespondencia,
        fecha_fin: this.fechaFinCorrespondencia,
        entity_name: entityName,
        total: totalCorrespondencias,
        por_estado: porEstado,
        por_tipo: porTipo,
        correspondencias: correspondenciasFiltradas.map(c => ({
          numero_radicado: c.numero_radicado,
          fecha_envio: c.fecha_envio,
          procedencia: c.procedencia,
          destinacion: c.destinacion,
          tipo_solicitud: this.getTipoSolicitudCorrespondenciaLabel(c.tipo_solicitud),
          estado: this.getEstadoCorrespondenciaLabel(c.estado),
          tipo_radicacion: c.tipo_radicacion === 'correo' ? 'Correo Electrónico' : 'Radicación Física'
        }))
      };

      // Por ahora mostrar alerta de éxito (el backend del informe se puede implementar después)
      this.alertService.success(
        `Informe generado con éxito.\n\nTotal de correspondencias: ${totalCorrespondencias}\n\nResueltas: ${porEstado.resuelta}\nEn proceso: ${porEstado.en_proceso}`,
        'Informe de Correspondencia'
      );

      console.log('Resumen del informe:', resumenInforme);
      console.log('Datos del informe:', reportData);

    } catch (error) {
      console.error('Error generando informe:', error);
      this.alertService.error('Error al generar el informe de correspondencia', 'Error');
    }
  }

  getTipoSolicitudCorrespondenciaLabel(tipo: string): string {
    const tipos: { [key: string]: string } = {
      'sugerencia': 'Sugerencia',
      'peticion': 'Petición',
      'queja': 'Queja',
      'reclamo': 'Reclamo',
      'felicitacion': 'Felicitación',
      'solicitud_informacion': 'Solicitud de Información',
      'otro': 'Otro'
    };
    return tipos[tipo] || tipo;
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

  // ==================== MÉTODOS DE CORRESPONDENCIA ====================

  loadCorrespondencias(): void {
    this.correspondenciaService.getCorrespondencias().subscribe({
      next: (data) => {
        this.correspondenciaList = data;
        this.updateCorrespondenciaCharts();
      },
      error: (error) => {
        console.error('Error cargando correspondencias:', error);
        this.alertService.error('Error al cargar correspondencias', 'Error');
      }
    });
  }

  mostrarFormularioNuevaCorrespondencia(): void {
    this.correspondenciaEditando = null;
    this.mostrarFormularioCorrespondencia = true;
    
    // Establecer procedencia con el nombre de la entidad actual
    const procedencia = this.entityContext.currentEntity?.name || 'PERSONERIA MUNICIPAL';
    this.nuevaCorrespondenciaForm.patchValue({
      procedencia: procedencia
    });
    
    this.loadNextRadicadoCorrespondencia();
  }

  editarCorrespondencia(correspondencia: CorrespondenciaWithDetails): void {
    this.correspondenciaEditando = correspondencia;
    this.mostrarDashboardCorrespondencia = false;
    this.correspondenciaSeleccionada = null;
    this.mostrarFormularioCorrespondencia = true;
    this.nuevaCorrespondenciaForm.patchValue({
      fecha_envio: correspondencia.fecha_envio,
      procedencia: correspondencia.procedencia,
      destinacion: correspondencia.destinacion,
      numero_folios: correspondencia.numero_folios,
      tipo_radicacion: correspondencia.tipo_radicacion,
      tipo_solicitud: correspondencia.tipo_solicitud,
      tiempo_respuesta_dias: correspondencia.tiempo_respuesta_dias,
      correo_electronico: correspondencia.correo_electronico || '',
      direccion_radicacion: correspondencia.direccion_radicacion || '',
      observaciones: correspondencia.observaciones || ''
    });
  }

  ocultarFormularioCorrespondencia(): void {
    this.mostrarFormularioCorrespondencia = false;
    this.correspondenciaEditando = null;
    
    // Limpiar archivo seleccionado
    this.selectedFileCorrespondenciaSolicitud = null;
    
    // Establecer procedencia con el nombre de la entidad actual al resetear
    const procedencia = this.entityContext.currentEntity?.name || 'PERSONERIA MUNICIPAL';
    this.nuevaCorrespondenciaForm.reset({
      fecha_envio: new Date().toISOString().split('T')[0],
      procedencia: procedencia,
      numero_folios: 1,
      tipo_radicacion: 'correo',
      tipo_solicitud: 'sugerencia',
      tiempo_respuesta_dias: 10
    });
  }

  loadNextRadicadoCorrespondencia(): void {
    this.loadingRadicadoCorrespondencia = true;
    this.correspondenciaService.getNextRadicado().subscribe({
      next: (response) => {
        this.nextRadicadoCorrespondencia = response.numero_radicado;
        this.loadingRadicadoCorrespondencia = false;
      },
      error: (error) => {
        console.error('Error obteniendo siguiente radicado:', error);
        this.loadingRadicadoCorrespondencia = false;
      }
    });
  }

  onTipoRadicacionChange(): void {
    const tipoRadicacion = this.nuevaCorrespondenciaForm.get('tipo_radicacion')?.value;
    
    if (tipoRadicacion === 'correo') {
      this.nuevaCorrespondenciaForm.get('correo_electronico')?.setValidators([Validators.required, Validators.email]);
      this.nuevaCorrespondenciaForm.get('direccion_radicacion')?.clearValidators();
    } else if (tipoRadicacion === 'fisico') {
      this.nuevaCorrespondenciaForm.get('direccion_radicacion')?.setValidators([Validators.required]);
      this.nuevaCorrespondenciaForm.get('correo_electronico')?.clearValidators();
    }
    
    this.nuevaCorrespondenciaForm.get('correo_electronico')?.updateValueAndValidity();
    this.nuevaCorrespondenciaForm.get('direccion_radicacion')?.updateValueAndValidity();
  }

  submitNuevaCorrespondencia(): void {
    if (this.nuevaCorrespondenciaForm.invalid) {
      this.alertService.error('Por favor completa todos los campos requeridos', 'Error');
      return;
    }

    if (!this.currentUser || !this.currentUser.entity_id) {
      this.alertService.error('No se pudo obtener la información del usuario', 'Error');
      return;
    }

    this.isSubmitting = true;

    // Modo edición
    if (this.correspondenciaEditando) {
      const formData = this.nuevaCorrespondenciaForm.getRawValue();
      this.correspondenciaService.updateCorrespondencia(this.correspondenciaEditando.id, formData).subscribe({
        next: () => {
          this.alertService.success('Correspondencia actualizada exitosamente', 'Éxito');
          this.ocultarFormularioCorrespondencia();
          this.loadCorrespondencias();
          this.isSubmitting = false;
        },
        error: (error) => {
          console.error('Error actualizando correspondencia:', error);
          const errorMsg = this.extractErrorMessage(error);
          this.alertService.error(errorMsg, 'Error');
          this.isSubmitting = false;
        }
      });
      return;
    }
    
    // Usar getRawValue() para incluir campos deshabilitados como "procedencia"
    const formData = this.nuevaCorrespondenciaForm.getRawValue();
    const data: CreateCorrespondencia = {
      ...formData,
      entity_id: this.currentUser.entity_id
    };

    this.correspondenciaService.createCorrespondencia(data).subscribe({
      next: (response) => {
        // Si hay archivo seleccionado, subirlo
        if (this.selectedFileCorrespondenciaSolicitud && response.id) {
          this.correspondenciaService.uploadArchivoSolicitud(response.id, this.selectedFileCorrespondenciaSolicitud).subscribe({
            next: (uploadResponse) => {
              console.log('Archivo de solicitud subido:', uploadResponse);
              this.alertService.success('Correspondencia y archivo creados exitosamente', 'Éxito');
              this.ocultarFormularioCorrespondencia();
              this.loadCorrespondencias();
              this.isSubmitting = false;
              this.selectedFileCorrespondenciaSolicitud = null;
            },
            error: (uploadError) => {
              console.error('Error subiendo archivo:', uploadError);
              this.alertService.warning('Correspondencia creada pero hubo un error al subir el archivo', 'Advertencia');
              this.ocultarFormularioCorrespondencia();
              this.loadCorrespondencias();
              this.isSubmitting = false;
              this.selectedFileCorrespondenciaSolicitud = null;
            }
          });
        } else {
          // No hay archivo, solo mostrar mensaje de éxito
          this.alertService.success('Correspondencia creada exitosamente', 'Éxito');
          this.ocultarFormularioCorrespondencia();
          this.loadCorrespondencias();
          this.isSubmitting = false;
        }
      },
      error: (error) => {
        console.error('Error creando correspondencia:', error);
        const errorMsg = this.extractErrorMessage(error);
        this.alertService.error(errorMsg, 'Error');
        this.isSubmitting = false;
        this.selectedFileCorrespondenciaSolicitud = null;
      }
    });
  }

  verDetallesCorrespondencia(correspondencia: CorrespondenciaWithDetails): void {
    this.correspondenciaSeleccionada = correspondencia;
  }

  cerrarDetallesCorrespondencia(): void {
    this.correspondenciaSeleccionada = null;
  }

  actualizarEstadoCorrespondencia(correspondencia: CorrespondenciaWithDetails, nuevoEstado: EstadoCorrespondencia): void {
    this.correspondenciaService.updateCorrespondencia(correspondencia.id, { estado: nuevoEstado }).subscribe({
      next: () => {
        this.alertService.success('Estado actualizado correctamente', 'Éxito');
        this.loadCorrespondencias();
        if (this.correspondenciaSeleccionada?.id === correspondencia.id) {
          this.correspondenciaSeleccionada.estado = nuevoEstado;
        }
      },
      error: (error) => {
        console.error('Error actualizando estado:', error);
        this.alertService.error('Error al actualizar el estado', 'Error');
      }
    });
  }

  eliminarCorrespondencia(id: number): void {
    if (!confirm('¿Estás seguro de que deseas eliminar esta correspondencia?')) {
      return;
    }

    this.correspondenciaService.deleteCorrespondencia(id).subscribe({
      next: () => {
        this.alertService.success('Correspondencia eliminada correctamente', 'Éxito');
        this.loadCorrespondencias();
        if (this.correspondenciaSeleccionada?.id === id) {
          this.correspondenciaSeleccionada = null;
        }
      },
      error: (error) => {
        console.error('Error eliminando correspondencia:', error);
        this.alertService.error('Error al eliminar la correspondencia', 'Error');
      }
    });
  }

  mostrarFormularioRespuestaCorrespondenciaFn(correspondencia: CorrespondenciaWithDetails): void {
    this.correspondenciaSeleccionada = correspondencia;
    this.mostrarFormularioRespuestaCorrespondencia = true;
    this.respuestaCorrespondenciaTexto = '';
    this.selectedFileCorrespondenciaRespuesta = null;
  }

  cerrarFormularioRespuestaCorrespondencia(): void {
    this.mostrarFormularioRespuestaCorrespondencia = false;
    this.correspondenciaSeleccionada = null;
    this.mostrarDashboardCorrespondencia = true;
    this.respuestaCorrespondenciaTexto = '';
    this.selectedFileCorrespondenciaRespuesta = null;
  }

  enviarRespuestaCorrespondencia(): void {
    if (!this.correspondenciaSeleccionada) {
      return;
    }

    if (!this.respuestaCorrespondenciaTexto.trim() && !this.selectedFileCorrespondenciaRespuesta) {
      this.alertService.error('Debes proporcionar una respuesta en texto o adjuntar un archivo', 'Error');
      return;
    }

    this.isSubmitting = true;

    // Primero subir el archivo si existe
    if (this.selectedFileCorrespondenciaRespuesta) {
      this.correspondenciaService.uploadArchivoRespuesta(this.correspondenciaSeleccionada.id, this.selectedFileCorrespondenciaRespuesta).subscribe({
        next: (uploadResponse) => {
          console.log('Archivo de respuesta subido:', uploadResponse);
          // Luego actualizar la correspondencia con la respuesta y estado
          this.actualizarCorrespondenciaConRespuesta();
        },
        error: (uploadError) => {
          console.error('Error subiendo archivo de respuesta:', uploadError);
          this.alertService.error('Error al subir el archivo adjunto. Intente nuevamente.', 'Error');
          this.isSubmitting = false;
        }
      });
    } else {
      // Si no hay archivo, solo actualizar con el texto
      this.actualizarCorrespondenciaConRespuesta();
    }
  }

  private actualizarCorrespondenciaConRespuesta(): void {
    if (!this.correspondenciaSeleccionada) return;

    const updateData: UpdateCorrespondencia = {
      estado: 'resuelta',
      respuesta: this.respuestaCorrespondenciaTexto.trim()
    };

    this.correspondenciaService.updateCorrespondencia(this.correspondenciaSeleccionada.id, updateData).subscribe({
      next: (response) => {
        this.alertService.success('Respuesta enviada y correspondencia marcada como resuelta', 'Éxito');
        this.cerrarFormularioRespuestaCorrespondencia();
        this.loadCorrespondencias();
        this.isSubmitting = false;
        if (this.correspondenciaSeleccionada) {
          this.correspondenciaSeleccionada.estado = 'resuelta';
          this.correspondenciaSeleccionada.respuesta = this.respuestaCorrespondenciaTexto.trim();
        }
      },
      error: (error) => {
        console.error('Error actualizando correspondencia:', error);
        const errorMsg = this.extractErrorMessage(error);
        this.alertService.error(errorMsg, 'Error');
        this.isSubmitting = false;
      }
    });
  }

  getEstadoCorrespondenciaLabel(estado: EstadoCorrespondencia): string {
    return this.estadosCorrespondencia[estado]?.label || estado;
  }

  getEstadoCorrespondenciaColor(estado: EstadoCorrespondencia): string {
    return this.estadosCorrespondencia[estado]?.color || 'text-secondary';
  }

  getTipoRadicacionLabel(tipo: TipoRadicacion): string {
    return this.tiposRadicacion[tipo] || tipo;
  }
}


