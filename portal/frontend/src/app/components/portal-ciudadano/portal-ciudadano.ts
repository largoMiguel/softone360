import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { EntityContextService } from '../../services/entity-context.service';
import { AuthService } from '../../services/auth.service';
import { AlertService } from '../../services/alert.service';
import { PqrsService } from '../../services/pqrs.service';
import { User } from '../../models/user.model';
import { Observable } from 'rxjs';
import { Entity } from '../../models/entity.model';

@Component({
    selector: 'app-portal-ciudadano',
    standalone: true,
    imports: [CommonModule, FormsModule, ReactiveFormsModule],
    templateUrl: './portal-ciudadano.html',
    styleUrl: './portal-ciudadano.scss'
})
export class PortalCiudadanoComponent implements OnInit {
    isLoggedIn = false;
    showRegisterForm = false;
    currentUser: User | null = null;
    loginForm: FormGroup;
    registerForm: FormGroup;
    isSubmitting = false;
    currentEntity$!: Observable<Entity | null>;
    currentEntity: Entity | null = null;

    // Vista activa del dashboard
    currentView: 'mis-pqrs' | 'nueva-pqrs' = 'mis-pqrs';

    // Listado de PQRS
    misPqrs: any[] = [];
    loadingPqrs = false;
    pqrsDetalle: any = null;

    // Formulario de nueva PQRS
    pqrsForm: FormGroup;
    archivoAdjunto: File | null = null;
    MAX_FILE_SIZE_MB = 10;
    MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
    creandoPqrs = false;

    constructor(
        private authService: AuthService,
        private router: Router,
        private route: ActivatedRoute,
        private fb: FormBuilder,
        private alertService: AlertService,
        private entityContext: EntityContextService,
        private pqrsService: PqrsService
    ) {
        this.loginForm = this.fb.group({
            username: ['', Validators.required],
            password: ['', Validators.required]
        });

        this.registerForm = this.fb.group({
            username: ['', Validators.required],
            password: ['', [Validators.required, Validators.minLength(6)]],
            password_confirm: ['', Validators.required],
            full_name: ['', Validators.required],
            email: ['', [Validators.required, Validators.email]],
            cedula: ['', Validators.required],
            telefono: [''],
            direccion: ['']
        }, { validators: this.passwordMatchValidator });

        this.currentEntity$ = this.entityContext.currentEntity$;

        // Inicializar formulario de PQRS
        this.pqrsForm = this.fb.group({
            tipo_pqrs: ['peticion', Validators.required],
            asunto: ['', [Validators.required, Validators.maxLength(200)]],
            descripcion: ['', [Validators.required, Validators.minLength(10)]],
            medio_respuesta: ['email', Validators.required],
            direccion_respuesta: [''],
            telefono_respuesta: ['']
        });
    }

    ngOnInit() {
        this.currentEntity$.subscribe(entity => { this.currentEntity = entity; });
        this.authService.getCurrentUser().subscribe({
            next: user => {
                if (user && user.role === 'ciudadano') {
                    this.currentUser = user;
                    this.isLoggedIn = true;
                    this.cargarMisPqrs();
                }
            },
            error: () => { this.isLoggedIn = false; }
        });
    }

    passwordMatchValidator(form: FormGroup) {
        const password = form.get('password');
        const confirmPassword = form.get('password_confirm');
        return password && confirmPassword && password.value === confirmPassword.value ? null : { passwordMismatch: true };
    }

    onLoginSubmit() {
        if (this.loginForm.valid && !this.isSubmitting) {
            this.isSubmitting = true;
            this.authService.login(this.loginForm.value).subscribe({
                next: () => {
                    this.authService.getCurrentUser().subscribe({
                        next: user => {
                            if (user && user.role === 'ciudadano') {
                                this.currentUser = user;
                                this.isLoggedIn = true;
                                this.alertService.success(`Bienvenido ${user.full_name}`, 'Acceso Exitoso');
                            } else {
                                this.alertService.warning('Este portal es solo para ciudadanos.', 'Acceso Restringido');
                                this.authService.logout();
                            }
                            this.isSubmitting = false;
                        },
                        error: () => { this.isSubmitting = false; }
                    });
                },
                error: () => {
                    this.alertService.error('Usuario o contraseña incorrectos', 'Error de Acceso');
                    this.isSubmitting = false;
                }
            });
        }
    }

    onRegisterSubmit() {
        if (this.registerForm.valid && !this.isSubmitting) {
            this.isSubmitting = true;
            const { password_confirm, ...data } = this.registerForm.value;
            const payload = { ...data, role: 'ciudadano' };
            this.authService.registerCiudadano(payload).subscribe({
                next: () => {
                    this.alertService.success('Cuenta creada. Ya puedes iniciar sesión.', 'Registro Exitoso');
                    this.showRegisterForm = false;
                    this.registerForm.reset();
                    this.isSubmitting = false;
                },
                error: (err) => {
                    const msg = err.error?.detail || 'No se pudo crear la cuenta.';
                    this.alertService.error(msg, 'Error Registro');
                    this.isSubmitting = false;
                }
            });
        }
    }

    toggleView() { this.showRegisterForm = !this.showRegisterForm; }

    logout() {
        this.authService.logout();
        this.isLoggedIn = false;
        this.currentUser = null;
        setTimeout(() => { this.router.navigate(['/']).then(() => window.location.reload()); }, 100);
    }

    volverAInicio() {
        const slug = this.entityContext.currentEntity?.slug;
        if (slug) { this.router.navigate(['/', slug]); } else { this.router.navigate(['/']); }
    }

    // Métodos para PQRS
    cargarMisPqrs() {
        this.loadingPqrs = true;
        this.pqrsService.getMisPqrs().subscribe({
            next: (data) => {
                this.misPqrs = data;
                this.loadingPqrs = false;
            },
            error: (error) => {
                this.alertService.error('Error al cargar PQRS', 'Error');
                this.loadingPqrs = false;
            }
        });
    }

    cambiarVista(vista: 'mis-pqrs' | 'nueva-pqrs') {
        this.currentView = vista;
        if (vista === 'nueva-pqrs') {
            this.pqrsForm.reset({
                tipo_pqrs: 'peticion',
                medio_respuesta: 'email'
            });
            this.archivoAdjunto = null;
        }
    }

    verDetalle(pqrs: any) {
        this.pqrsDetalle = pqrs;
    }

    cerrarDetalle() {
        this.pqrsDetalle = null;
    }

    navegarANuevaPqrs() {
        const slug = this.entityContext.currentEntity?.slug;
        this.router.navigate(slug ? ['/', slug, 'dashboard'] : ['/'], {
            queryParams: { v: 'nueva-pqrs' }
        });
    }

    // Manejo del formulario de PQRS
    onFileSelected(event: any) {
        const file = event.target.files[0];
        if (file) {
            // Validar tamaño
            if (file.size > this.MAX_FILE_SIZE_BYTES) {
                this.alertService.error(
                    `El archivo es demasiado grande. Tamaño máximo: ${this.MAX_FILE_SIZE_MB}MB`,
                    'Archivo muy grande'
                );
                event.target.value = '';
                return;
            }

            // Validar tipo
            const allowedTypes = [
                'application/pdf',
                'image/jpeg',
                'image/jpg',
                'image/png',
                'application/msword',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            ];
            
            if (!allowedTypes.includes(file.type)) {
                this.alertService.error(
                    'Tipo de archivo no permitido. Solo se aceptan: PDF, JPG, PNG, DOC, DOCX',
                    'Tipo no válido'
                );
                event.target.value = '';
                return;
            }

            this.archivoAdjunto = file;
        }
    }

    removerArchivo() {
        this.archivoAdjunto = null;
    }

    crearPqrs() {
        if (this.pqrsForm.invalid) {
            this.alertService.warning('Por favor completa todos los campos requeridos', 'Formulario incompleto');
            return;
        }

        if (!this.currentUser || !this.currentEntity) {
            this.alertService.error('No se pudo obtener información del usuario o entidad', 'Error');
            return;
        }

        this.creandoPqrs = true;

        const formValue = this.pqrsForm.value;
        const pqrsData = {
            tipo_pqrs: formValue.tipo_pqrs,
            asunto: formValue.asunto,
            descripcion: formValue.descripcion,
            medio_respuesta: formValue.medio_respuesta,
            tipo_identificacion: 'personal' as const,
            tipo_solicitud: formValue.tipo_pqrs,
            canal_llegada: 'web' as const,
            nombre_ciudadano: this.currentUser.full_name,
            cedula_ciudadano: this.currentUser.cedula || '',
            email_ciudadano: this.currentUser.email,
            telefono_ciudadano: this.currentUser.telefono || '',
            direccion_ciudadano: this.currentUser.direccion || '',
            direccion_respuesta: formValue.direccion_respuesta || null,
            telefono_respuesta: formValue.telefono_respuesta || null,
            entity_id: this.currentEntity.id
        };

        this.pqrsService.createPqrs(pqrsData).subscribe({
            next: (pqrs) => {
                // Si hay archivo, subirlo
                if (this.archivoAdjunto) {
                    this.pqrsService.uploadArchivo(pqrs.id, this.archivoAdjunto).subscribe({
                        next: () => {
                            this.alertService.success(
                                `PQRS radicada exitosamente. Número de radicado: ${pqrs.numero_radicado}`,
                                'PQRS Creada'
                            );
                            this.pqrsForm.reset({ tipo_pqrs: 'peticion', medio_respuesta: 'email' });
                            this.archivoAdjunto = null;
                            this.creandoPqrs = false;
                            this.cargarMisPqrs();
                            this.cambiarVista('mis-pqrs');
                        },
                        error: () => {
                            this.alertService.warning(
                                `PQRS radicada con número ${pqrs.numero_radicado}, pero hubo un error al subir el archivo.`,
                                'Archivo no subido'
                            );
                            this.creandoPqrs = false;
                            this.cargarMisPqrs();
                            this.cambiarVista('mis-pqrs');
                        }
                    });
                } else {
                    this.alertService.success(
                        `PQRS radicada exitosamente. Número de radicado: ${pqrs.numero_radicado}`,
                        'PQRS Creada'
                    );
                    this.pqrsForm.reset({ tipo_pqrs: 'peticion', medio_respuesta: 'email' });
                    this.creandoPqrs = false;
                    this.cargarMisPqrs();
                    this.cambiarVista('mis-pqrs');
                }
            },
            error: (error) => {
                this.alertService.error(
                    error.error?.detail || 'Error al crear la PQRS',
                    'Error'
                );
                this.creandoPqrs = false;
            }
        });
    }

    getEstadoClass(estado: string): string {
        const estados: { [key: string]: string } = {
            'radicada': 'badge bg-primary',
            'en_tramite': 'badge bg-warning',
            'en_proceso': 'badge bg-info',
            'resuelta': 'badge bg-success',
            'cerrada': 'badge bg-secondary',
            'rechazada': 'badge bg-danger'
        };
        return estados[estado] || 'badge bg-secondary';
    }

    getEstadoLabel(estado: string): string {
        const estados: { [key: string]: string } = {
            'radicada': 'Radicada',
            'en_tramite': 'En Trámite',
            'en_proceso': 'En Proceso',
            'resuelta': 'Resuelta',
            'cerrada': 'Cerrada',
            'rechazada': 'Rechazada'
        };
        return estados[estado] || estado;
    }

    getTipoPqrsLabel(tipo: string): string {
        const tipos: { [key: string]: string } = {
            'peticion': 'Petición',
            'queja': 'Queja',
            'reclamo': 'Reclamo',
            'sugerencia': 'Sugerencia',
            'felicitacion': 'Felicitación',
            'denuncia': 'Denuncia'
        };
        return tipos[tipo] || tipo;
    }
}
