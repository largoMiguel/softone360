import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { NotificationsService, AlertItem } from '../../services/notifications.service';
import { AlertsEventsService } from '../../services/alerts-events.service';
import { Observable, Subject, takeUntil } from 'rxjs';
import { SecretariasService, Secretaria } from '../../services/secretarias.service';
import { AuthService } from '../../services/auth.service';
import { User } from '../../models/user.model';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PlanV2Service } from '../../services/plan-v2.service';
import {
    PlanInstitucional,
    ComponenteProceso,
    Actividad,
    ActividadEjecucion,
    EstadoPlan,
    EstadoComponente,
    LABELS_ESTADO_PLAN,
    LABELS_ESTADO_COMPONENTE,
    BADGE_CLASS_ESTADO_PLAN,
    PlanInstitucionalCreate,
    PlanInstitucionalUpdate,
    ComponenteProcesoCreate,
    ComponenteProcesoUpdate,
    ActividadCreate,
    ActividadUpdate,
    ActividadCompleta,
    ActividadEjecucionCreate,
    EstadisticasPlan
} from '../../models/plan-v2.model';

@Component({
    selector: 'app-planes-institucionales-v2',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './planes-institucionales-v2.html',
    styleUrls: ['./planes-institucionales-v2.scss']
})
export class PlanesInstitucionalesV2Component implements OnInit, OnDestroy {
    private planService = inject(PlanV2Service);
    private authService = inject(AuthService);
    private notificationsService = inject(NotificationsService);
    private alertsEvents = inject(AlertsEventsService);
    private destroy$ = new Subject<void>();
    currentUser: User | null = null;
    private refreshInterval: any;
    alerts$!: Observable<AlertItem[]>;
    unreadCount$!: Observable<number>;

    // Estados y labels
    EstadoPlan = EstadoPlan;
    EstadoComponente = EstadoComponente;
    LABELS_ESTADO_PLAN = LABELS_ESTADO_PLAN;
    LABELS_ESTADO_COMPONENTE = LABELS_ESTADO_COMPONENTE;
    BADGE_CLASS_ESTADO_PLAN = BADGE_CLASS_ESTADO_PLAN;

    // Datos
    cargando = false;
    vistaActual = 'planes' as 'planes' | 'componentes' | 'actividades' | 'detalle-actividad' | 'estadisticas';
    planes: PlanInstitucional[] = [];
    planSeleccionado: PlanInstitucional | null = null;
    componentes: ComponenteProceso[] = [];
    componenteSeleccionado: ComponenteProceso | null = null;
    actividades: Actividad[] = [];
    actividadSeleccionada: ActividadCompleta | null = null;
    estadisticas: EstadisticasPlan | null = null;

    // Filtros
    filtroEstadoPlan: EstadoPlan | '' = '';

    // Modales
    modalAbierto: 'plan' | 'componente' | 'actividad' | 'ejecucion' | null = null;
    modoEdicion = false;

    // Formularios
    planForm: Partial<PlanInstitucionalCreate & { id?: number }> = {};
    componenteForm: Partial<ComponenteProcesoCreate & { id?: number }> = {};
    actividadForm: Partial<ActividadCreate & { id?: number }> = {};
    ejecucionForm: Partial<ActividadEjecucionCreate> = {};

    // Evidencias de imágenes
    imagenesSeleccionadas: Array<{
        archivo: File;
        preview: string;
        base64: string;
        nombre: string;
        tamano: number;
        mimeType: string;
    }> = [];
    guardandoEjecucion = false;
    MAX_IMAGENES = 4;
    MAX_TAMANO_MB = 2;
    MAX_TAMANO_BYTES = this.MAX_TAMANO_MB * 1024 * 1024;

    // Secretarías
    secretarias: Secretaria[] = [];
    private secretariasSvc = inject(SecretariasService);

    ngOnInit(): void {
        this.currentUser = this.authService.getCurrentUserValue();
        // Notificaciones
        this.alerts$ = this.notificationsService.alertsStream;
        this.unreadCount$ = this.notificationsService.unreadCountStream;
        this.notificationsService.fetch(true).subscribe();
        this.alertsEvents.openRequested$
            .pipe(takeUntil(this.destroy$))
            .subscribe(alert => this.abrirDesdeNotificacion(alert));
        this.cargarPlanes();
        this.cargarSecretarias();

        // Auto-refresh cada 60 segundos para actualizar planes y actividades
        this.refreshInterval = setInterval(() => {
            if (!this.authService.isAuthenticated()) {
                // Limpiar intervalo si no hay autenticación
                if (this.refreshInterval) {
                    clearInterval(this.refreshInterval);
                }
                return;
            }

            // Recargar datos según la vista actual
            if (this.vistaActual === 'planes') {
                this.cargarPlanes();
            } else if (this.vistaActual === 'componentes' && this.planSeleccionado) {
                this.cargarComponentes(this.planSeleccionado.id);
            } else if (this.vistaActual === 'actividades' && this.componenteSeleccionado) {
                this.cargarActividades(this.componenteSeleccionado.id);
            } else if (this.vistaActual === 'detalle-actividad' && this.actividadSeleccionada) {
                this.cargarActividadCompleta(this.actividadSeleccionada.id);
            } else if (this.vistaActual === 'estadisticas' && this.planSeleccionado) {
                this.cargarEstadisticas(this.planSeleccionado.id);
            }
        }, 60000);
    }

    ngOnDestroy(): void {
        // Limpiar el intervalo de auto-refresh
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
        this.destroy$.next();
        this.destroy$.complete();
    }

    private abrirDesdeNotificacion(alert: AlertItem): void {
        // Marcar leída
        if (!alert.read_at) this.notificationsService.markRead(alert.id).subscribe();

        let data: { plan_id?: number; componente_id?: number; actividad_id?: number } = {};
        try { data = alert.data ? JSON.parse(alert.data) : {}; } catch { return; }

        const { plan_id, componente_id, actividad_id } = data;
        if (!plan_id) return;

        const abrirComponente = (plan: PlanInstitucional) => {
            this.vistaActual = 'componentes';
            this.planSeleccionado = plan;
            this.cargarComponentes(plan.id);
            if (componente_id) {
                // Pequeño delay para esperar la carga de componentes
                setTimeout(() => {
                    const comp = this.componenteSeleccionado || this.componentes.find(c => c.id === componente_id) || null;
                    if (comp) {
                        this.vistaActual = 'actividades';
                        this.componenteSeleccionado = comp;
                        this.cargarActividades(comp.id);
                        if (actividad_id) {
                            // Abrir detalle de actividad si viene en la alerta
                            setTimeout(() => {
                                this.vistaActual = 'detalle-actividad';
                                this.cargarActividadCompleta(actividad_id);
                            }, 200);
                        }
                    }
                }, 200);
            }
        };

        if (this.planes && this.planes.length) {
            const plan = this.planes.find(p => p.id === plan_id);
            if (plan) { abrirComponente(plan); return; }
        }
        // Si no está cargado aún, cargar y luego abrir
        this.planService.listarPlanes({}).subscribe({
            next: (plist) => {
                this.planes = plist || [];
                const plan = this.planes.find(p => p.id === plan_id);
                if (plan) abrirComponente(plan);
            }
        });
    }

    cargarSecretarias() {
        this.secretariasSvc.listar().subscribe({
            next: (items) => this.secretarias = items || [],
            error: () => this.secretarias = []
        });
    }

    // ==================== TOASTS ====================
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

    // ==================== NAV ====================
    navegarA(vista: typeof this.vistaActual, payload?: any) {
        switch (vista) {
            case 'componentes':
                this.planSeleccionado = payload as PlanInstitucional;
                this.cargarComponentes(this.planSeleccionado.id);
                break;
            case 'actividades':
                this.componenteSeleccionado = payload as ComponenteProceso;
                this.cargarActividades(this.componenteSeleccionado.id);
                break;
            case 'detalle-actividad':
                const act = payload as Actividad;
                this.cargarActividadCompleta(act.id);
                break;
            case 'estadisticas':
                this.planSeleccionado = payload as PlanInstitucional;
                this.cargarEstadisticas(this.planSeleccionado.id);
                break;
        }
        this.vistaActual = vista;
    }

    volver() {
        if (this.vistaActual === 'componentes') this.vistaActual = 'planes';
        else if (this.vistaActual === 'actividades') this.vistaActual = 'componentes';
        else if (this.vistaActual === 'detalle-actividad') this.vistaActual = 'actividades';
        else if (this.vistaActual === 'estadisticas') this.vistaActual = 'planes';
    }

    // ==================== LOADERS ====================
    cargarPlanes() {
        this.cargando = true;
        this.planService.listarPlanes({ estado: this.filtroEstadoPlan || undefined }).subscribe({
            next: (data) => (this.planes = data),
            error: () => (this.planes = []),
            complete: () => (this.cargando = false)
        });
    }

    cargarComponentes(planId: number) {
        this.cargando = true;
        this.planService.listarComponentes(planId).subscribe({
            next: (data) => (this.componentes = data),
            error: () => (this.componentes = []),
            complete: () => (this.cargando = false)
        });
    }

    cargarActividades(componenteId: number) {
        this.cargando = true;
        this.planService.listarActividades(componenteId).subscribe({
            next: (data) => (this.actividades = data),
            error: () => (this.actividades = []),
            complete: () => (this.cargando = false)
        });
    }

    cargarActividadCompleta(actividadId: number) {
        this.cargando = true;
        this.planService.obtenerActividadCompleta(actividadId).subscribe({
            next: (data) => {
                this.actividadSeleccionada = data;
                // Cargar evidencias para cada ejecución
                if (data.actividades_ejecucion && data.actividades_ejecucion.length > 0) {
                    data.actividades_ejecucion.forEach(ejecucion => {
                        this.cargarEvidenciasEjecucion(ejecucion);
                    });
                }
            },
            error: () => (this.actividadSeleccionada = null),
            complete: () => (this.cargando = false)
        });
    }

    private cargarEvidenciasEjecucion(ejecucion: ActividadEjecucion) {
        this.planService.listarEvidencias(ejecucion.id).subscribe({
            next: (evidencias) => {
                ejecucion.evidencias = evidencias;
            },
            error: (err) => {
                console.error('Error al cargar evidencias:', err);
                ejecucion.evidencias = [];
            }
        });
    }

    cargarEstadisticas(planId: number) {
        this.cargando = true;
        this.planService.obtenerEstadisticasPlan(planId).subscribe({
            next: (data) => (this.estadisticas = data),
            error: () => (this.estadisticas = null),
            complete: () => (this.cargando = false)
        });
    }

    // ==================== HELPERS UI ====================
    formatearFecha(fecha?: string) {
        if (!fecha) return '';
        const d = new Date(fecha);
        return d.toLocaleDateString();
    }

    formatearMoneda(valor?: number) {
        if (valor == null) return '';
        return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(valor);
    }

    getEstadosBadgeClass(estado: EstadoComponente | EstadoPlan, tipo: 'componente' | 'plan' = 'componente') {
        if (tipo === 'plan') return this.BADGE_CLASS_ESTADO_PLAN[estado as EstadoPlan];
        return 'badge bg-info';
    }

    // ==================== MODALES ====================
    abrirModalPlan(plan?: PlanInstitucional) {
        this.modoEdicion = !!plan;
        if (plan) {
            this.planForm = {
                id: plan.id,
                anio: plan.anio,
                nombre: plan.nombre,
                descripcion: plan.descripcion,
                fecha_inicio: (plan.fecha_inicio || '').slice(0, 10),
                fecha_fin: (plan.fecha_fin || '').slice(0, 10),
                estado: plan.estado,
                responsable_elaboracion: plan.responsable_elaboracion
            } as any;
        } else {
            this.planForm = {
                anio: new Date().getFullYear(),
                estado: this.EstadoPlan.FORMULACION
            } as any;
        }
        this.modalAbierto = 'plan';
    }

    abrirModalComponente(componente?: ComponenteProceso) {
        if (!this.planSeleccionado) return;
        this.modoEdicion = !!componente;
        this.componenteForm = componente
            ? { id: componente.id, plan_id: componente.plan_id, nombre: componente.nombre, estado: componente.estado }
            : { plan_id: this.planSeleccionado.id };
        this.modalAbierto = 'componente';
    }

    abrirModalActividad(actividad?: Actividad) {
        if (!this.componenteSeleccionado) return;
        this.modoEdicion = !!actividad;
        this.actividadForm = actividad ? { id: actividad.id, componente_id: actividad.componente_id, objetivo_especifico: actividad.objetivo_especifico, fecha_inicio_prevista: (actividad.fecha_inicio_prevista || '').slice(0, 10), fecha_fin_prevista: (actividad.fecha_fin_prevista || '').slice(0, 10), responsable: actividad.responsable } : { componente_id: this.componenteSeleccionado.id };
        this.modalAbierto = 'actividad';
    }

    abrirModalEjecucion() {
        if (!this.actividadSeleccionada) return;
        this.ejecucionForm = { actividad_id: this.actividadSeleccionada.id };
        this.modalAbierto = 'ejecucion';
    }

    cerrarModal() {
        this.modalAbierto = null;
        this.modoEdicion = false;
        // Limpiar imágenes seleccionadas al cerrar modal
        this.imagenesSeleccionadas = [];
        this.guardandoEjecucion = false;
    }

    // ==================== ACCIONES ====================
    guardarPlan() {
        if (!this.modalAbierto || this.modalAbierto !== 'plan') return;
        const { id, ...payload } = this.planForm as any;
        if (id) {
            this.planService.actualizarPlan(id, payload as PlanInstitucionalUpdate).subscribe({
                next: () => {
                    this.cerrarModal();
                    this.cargarPlanes();
                    this.showToast('Plan actualizado exitosamente', 'success');
                },
                error: (err) => {
                    this.showToast('Error al actualizar el plan', 'error');
                }
            });
        } else {
            this.planService.crearPlan(payload as PlanInstitucionalCreate).subscribe({
                next: () => {
                    this.cerrarModal();
                    this.cargarPlanes();
                    this.showToast('Plan creado exitosamente', 'success');
                },
                error: (err) => {
                    this.showToast('Error al crear el plan', 'error');
                }
            });
        }
    }

    eliminarPlan(plan: PlanInstitucional) {
        if (!confirm('¿Eliminar plan?')) return;
        this.planService.eliminarPlan(plan.id).subscribe({
            next: () => {
                this.cargarPlanes();
                this.showToast('Plan eliminado exitosamente', 'success');
            },
            error: (err) => {
                this.showToast('Error al eliminar el plan', 'error');
            }
        });
    }

    guardarComponente() {
        if (!this.planSeleccionado) return;
        const { id, ...payload } = this.componenteForm as any;
        if (id) {
            this.planService.actualizarComponente(id, payload as ComponenteProcesoUpdate).subscribe({
                next: () => {
                    this.cerrarModal();
                    this.cargarComponentes(this.planSeleccionado!.id);
                    this.showToast('Componente actualizado exitosamente', 'success');
                },
                error: (err) => {
                    this.showToast('Error al actualizar el componente', 'error');
                }
            });
        } else {
            this.planService.crearComponente(this.planSeleccionado.id, payload as ComponenteProcesoCreate).subscribe({
                next: () => {
                    this.cerrarModal();
                    this.cargarComponentes(this.planSeleccionado!.id);
                    this.showToast('Componente creado exitosamente', 'success');
                },
                error: (err) => {
                    this.showToast('Error al crear el componente', 'error');
                }
            });
        }
    }

    eliminarComponente(componente: ComponenteProceso) {
        if (!componente || !this.planSeleccionado) return;
        if (!this.esAdmin()) return;
        if (!confirm(`¿Eliminar el componente "${componente.nombre}"?`)) return;
        this.planService.eliminarComponente(componente.id).subscribe({
            next: () => {
                this.showToast('Componente eliminado exitosamente', 'success');
                this.cargarComponentes(this.planSeleccionado!.id);
            },
            error: () => this.showToast('Error al eliminar el componente', 'error')
        });
    }

    guardarActividad() {
        if (!this.componenteSeleccionado) return;
        const { id, ...payload } = this.actividadForm as any;
        if (id) {
            this.planService.actualizarActividad(id, payload as ActividadUpdate).subscribe({
                next: () => {
                    this.cerrarModal();
                    this.cargarActividades(this.componenteSeleccionado!.id);
                    this.showToast('Actividad actualizada exitosamente', 'success');
                },
                error: (err) => {
                    this.showToast('Error al actualizar la actividad', 'error');
                }
            });
        } else {
            this.planService.crearActividad(this.componenteSeleccionado.id, payload as ActividadCreate).subscribe({
                next: () => {
                    this.cerrarModal();
                    this.cargarActividades(this.componenteSeleccionado!.id);
                    this.showToast('Actividad creada exitosamente', 'success');
                },
                error: (err) => {
                    this.showToast('Error al crear la actividad', 'error');
                }
            });
        }
    }

    eliminarActividad(actividad: Actividad) {
        if (!actividad || !this.componenteSeleccionado) return;
        if (!this.esAdmin()) return;
        if (!confirm('¿Eliminar esta actividad?')) return;
        this.planService.eliminarActividad(actividad.id).subscribe({
            next: () => {
                this.showToast('Actividad eliminada exitosamente', 'success');
                this.cargarActividades(this.componenteSeleccionado!.id);
            },
            error: () => this.showToast('Error al eliminar la actividad', 'error')
        });
    }

    guardarEjecucion() {
        if (!this.actividadSeleccionada || !this.ejecucionForm.descripcion) return;

        // Validación requerida: Debe existir al menos una URL de evidencia o una imagen seleccionada
        const tieneUrl = !!this.ejecucionForm.evidencia_url && this.ejecucionForm.evidencia_url.trim().length > 0;
        const tieneImagenes = this.imagenesSeleccionadas.length > 0;
        if (!tieneUrl && !tieneImagenes) {
            this.showToast('Debes proporcionar una URL de evidencia o al menos una imagen antes de registrar la ejecución.', 'error');
            return;
        }

        this.guardandoEjecucion = true;
        const actividadId = this.actividadSeleccionada.id;

        // Primero crear la ejecución
        this.planService.crearEjecucion(actividadId, this.ejecucionForm as ActividadEjecucionCreate).subscribe({
            next: (ejecucion) => {
                // Si hay imágenes seleccionadas, subirlas
                if (this.imagenesSeleccionadas.length > 0) {
                    this.subirEvidencias(ejecucion.id);
                } else {
                    this.finalizarGuardadoEjecucion(actividadId);
                }
            },
            error: (err) => {
                console.error('Error al crear ejecución:', err);
                this.showToast('Error al guardar la ejecución. Por favor intente nuevamente.', 'error');
                this.guardandoEjecucion = false;
            }
        });
    }

    private subirEvidencias(ejecucionId: number) {
        const actividadId = this.actividadSeleccionada!.id;
        let evidenciasSubidas = 0;
        const totalEvidencias = this.imagenesSeleccionadas.length;

        this.imagenesSeleccionadas.forEach((img, index) => {
            const evidenciaData = {
                tipo: 'imagen',
                contenido: img.base64,
                nombre_archivo: img.nombre,
                mime_type: img.mimeType,
                orden: index
            };

            this.planService.crearEvidencia(ejecucionId, evidenciaData).subscribe({
                next: () => {
                    evidenciasSubidas++;
                    if (evidenciasSubidas === totalEvidencias) {
                        this.finalizarGuardadoEjecucion(actividadId);
                    }
                },
                error: (err) => {
                    console.error('Error al subir evidencia:', err);
                    evidenciasSubidas++;
                    if (evidenciasSubidas === totalEvidencias) {
                        this.finalizarGuardadoEjecucion(actividadId);
                    }
                }
            });
        });
    }

    private finalizarGuardadoEjecucion(actividadId: number) {
        this.guardandoEjecucion = false;
        this.imagenesSeleccionadas = [];
        this.cerrarModal();
        this.cargarActividadCompleta(actividadId);
        this.showToast('Ejecución registrada exitosamente', 'success');
    }

    // ==================== MANEJO DE IMÁGENES ====================

    onFileSelected(event: Event) {
        const input = event.target as HTMLInputElement;
        if (!input.files || input.files.length === 0) return;

        const archivosArray = Array.from(input.files);
        const espacioDisponible = this.MAX_IMAGENES - this.imagenesSeleccionadas.length;

        for (let i = 0; i < Math.min(archivosArray.length, espacioDisponible); i++) {
            const archivo = archivosArray[i];

            // Validar tamaño
            if (archivo.size > this.MAX_TAMANO_BYTES) {
                alert(`La imagen "${archivo.name}" excede el tamaño máximo de ${this.MAX_TAMANO_MB}MB`);
                continue;
            }

            // Validar tipo
            if (!archivo.type.startsWith('image/')) {
                alert(`El archivo "${archivo.name}" no es una imagen válida`);
                continue;
            }

            // Leer archivo como base64 y preview
            const reader = new FileReader();
            reader.onload = (e: ProgressEvent<FileReader>) => {
                const base64 = e.target?.result as string;
                this.imagenesSeleccionadas.push({
                    archivo,
                    preview: base64,
                    base64: base64,
                    nombre: archivo.name,
                    tamano: archivo.size,
                    mimeType: archivo.type
                });
            };
            reader.readAsDataURL(archivo);
        }

        // Limpiar el input
        input.value = '';
    }

    eliminarImagenSeleccionada(index: number) {
        this.imagenesSeleccionadas.splice(index, 1);
    }

    formatearTamano(bytes: number): string {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    verImagenCompleta(base64Imagen: string) {
        // Abrir imagen en nueva ventana
        const ventana = window.open('', '_blank');
        if (ventana) {
            ventana.document.write(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Evidencia</title>
                    <style>
                        body { margin: 0; display: flex; justify-content: center; align-items: center; 
                               min-height: 100vh; background: #000; }
                        img { max-width: 95%; max-height: 95vh; object-fit: contain; }
                    </style>
                </head>
                <body>
                    <img src="${base64Imagen}" alt="Evidencia" />
                </body>
                </html>
            `);
        }
    }

    // ==================== PERMISOS ====================

    esAdmin(): boolean {
        return this.currentUser?.role === 'admin' || this.currentUser?.role === 'superadmin';
    }

    esSecretario(): boolean {
        return this.currentUser?.role === 'secretario';
    }

    puedeEditarActividad(): boolean {
        // Solo admins pueden editar actividades
        return this.esAdmin();
    }

    puedeRegistrarEjecucion(actividad: Actividad | null): boolean {
        if (!actividad) return false;

        // Admin puede registrar en cualquier actividad
        if (this.esAdmin()) return true;

        // Secretario solo puede registrar en actividades de su secretaría
        if (this.esSecretario() && this.currentUser?.secretaria) {
            return actividad.responsable === this.currentUser.secretaria;
        }

        return false;
    }

    mostrarMensajePermiso(actividad: Actividad): string {
        if (!this.esSecretario()) return '';

        if (actividad.responsable === this.currentUser?.secretaria) {
            return '';
        }

        return `Esta actividad está asignada a "${actividad.responsable}". Solo puedes registrar avances en actividades asignadas a "${this.currentUser?.secretaria}".`;
    }
}
