import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { EntityContextService } from '../../services/entity-context.service';
import { AuthService } from '../../services/auth.service';
import { PqrsService } from '../../services/pqrs.service';
import { AlertService } from '../../services/alert.service';
import { User } from '../../models/user.model';
import { PQRSWithDetails, TIPOS_IDENTIFICACION, MEDIOS_RESPUESTA } from '../../models/pqrs.model';
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
    // Estados de vista
    isLoggedIn = false;
    showRegisterForm = false;
    showNuevaPqrsForm = false;

    // Usuario actual
    currentUser: User | null = null;

    // Formularios
    loginForm: FormGroup;
    registerForm: FormGroup;
    nuevaPqrsForm: FormGroup;

    // Estados
    isLoading = false;
    isSubmitting = false;
    isSubmittingPqrs = false;

    // PQRS del ciudadano
    misPqrs: PQRSWithDetails[] = [];
    selectedPqrs: PQRSWithDetails | null = null;
    showDetails = false;

    // Constantes para el formulario
    tiposIdentificacion = TIPOS_IDENTIFICACION;
    mediosRespuesta = MEDIOS_RESPUESTA;

    // Para tracking de tipo y medio seleccionados
    tipo: string = 'personal';
    medio: string = 'ticket';

    // Entidad actual (para branding por slug)
    currentEntity$!: Observable<Entity | null>;
    currentEntity: Entity | null = null;

    constructor(
        private authService: AuthService,
        private pqrsService: PqrsService,
        private router: Router,
        private fb: FormBuilder,
        private alertService: AlertService,
        private entityContext: EntityContextService
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

        // Formulario de nueva PQRS
        this.nuevaPqrsForm = this.fb.group({
            tipo_identificacion: ['personal', Validators.required],
            nombre_ciudadano: [''],
            cedula_ciudadano: [''],
            tipo_solicitud: ['', Validators.required],
            asunto: [''],  // Opcional - el backend asigna "Sin asunto" si está vacío
            descripcion: ['', Validators.required],
            medio_respuesta: ['ticket', Validators.required],
            email_ciudadano: [''],
            direccion_ciudadano: [''],
            telefono_ciudadano: ['']
        });

        // Exponer entidad actual al template
        this.currentEntity$ = this.entityContext.currentEntity$;
    }

    ngOnInit() {
        // Suscribirse al contexto de entidad
        this.currentEntity$.subscribe(entity => {
            this.currentEntity = entity;
        });

        // Verificar si ya está autenticado
        this.authService.getCurrentUser().subscribe({
            next: (user) => {
                if (user && user.role === 'ciudadano') {
                    this.currentUser = user;
                    this.isLoggedIn = true;
                    this.loadMisPqrs();
                }
            },
            error: () => {
                this.isLoggedIn = false;
            }
        });

        // Listener para tipo_identificacion
        this.nuevaPqrsForm.get('tipo_identificacion')?.valueChanges.subscribe(tipo => {
            this.tipo = tipo;
            const nombreControl = this.nuevaPqrsForm.get('nombre_ciudadano');
            const cedulaControl = this.nuevaPqrsForm.get('cedula_ciudadano');
            const asuntoControl = this.nuevaPqrsForm.get('asunto');

            if (tipo === 'personal') {
                nombreControl?.setValidators([Validators.required]);
                cedulaControl?.setValidators([Validators.required]);
                asuntoControl?.setValidators([Validators.required]);
            } else {
                // PQRS Anónima: solo descripción obligatoria
                nombreControl?.clearValidators();
                cedulaControl?.clearValidators();
                asuntoControl?.clearValidators();
            }

            nombreControl?.updateValueAndValidity();
            cedulaControl?.updateValueAndValidity();
            asuntoControl?.updateValueAndValidity();
        });

        // Listener para medio_respuesta
        this.nuevaPqrsForm.get('medio_respuesta')?.valueChanges.subscribe(medio => {
            this.medio = medio;
            const emailControl = this.nuevaPqrsForm.get('email_ciudadano');
            const direccionControl = this.nuevaPqrsForm.get('direccion_ciudadano');
            const telefonoControl = this.nuevaPqrsForm.get('telefono_ciudadano');

            // Limpiar validadores
            emailControl?.clearValidators();
            direccionControl?.clearValidators();
            telefonoControl?.clearValidators();

            // Establecer validadores según medio
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
    }

    passwordMatchValidator(form: FormGroup) {
        const password = form.get('password');
        const confirmPassword = form.get('password_confirm');
        return password && confirmPassword && password.value === confirmPassword.value
            ? null
            : { passwordMismatch: true };
    }

    onLoginSubmit() {
        if (this.loginForm.valid && !this.isSubmitting) {
            this.isSubmitting = true;

            this.authService.login(this.loginForm.value).subscribe({
                next: (response) => {
                    // Verificar que sea un usuario ciudadano
                    this.authService.getCurrentUser().subscribe({
                        next: (user) => {
                            if (user && user.role === 'ciudadano') {
                                this.currentUser = user;
                                this.isLoggedIn = true;
                                this.alertService.success(`Bienvenido ${user.full_name}`, 'Acceso Exitoso');
                                this.loadMisPqrs();
                            } else {
                                this.alertService.warning('Este portal es solo para ciudadanos. Por favor usa el Portal Administrativo.', 'Acceso Restringido');
                                this.authService.logout();
                            }
                            this.isSubmitting = false;
                        }
                    });
                },
                error: (error) => {
                    // console.error('Error en login:', error);
                    this.alertService.error('Usuario o contraseña incorrectos', 'Error de Acceso');
                    this.isSubmitting = false;
                }
            });
        }
    }

    onRegisterSubmit() {
        if (this.registerForm.valid && !this.isSubmitting) {
            this.isSubmitting = true;

            const { password_confirm, ...userData } = this.registerForm.value;
            const registerData = {
                ...userData,
                role: 'ciudadano'
            };

            this.authService.registerCiudadano(registerData).subscribe({
                next: (response) => {
                    this.alertService.success('Cuenta creada exitosamente. Ya puedes iniciar sesión.', 'Registro Exitoso');
                    this.showRegisterForm = false;
                    this.registerForm.reset();
                    this.isSubmitting = false;
                },
                error: (error) => {
                    // console.error('Error en registro:', error);
                    const errorMessage = error.error?.detail || 'No se pudo crear la cuenta. Verifica que el usuario y email no existan.';
                    this.alertService.error(errorMessage, 'Error en Registro');
                    this.isSubmitting = false;
                }
            });
        }
    }

    loadMisPqrs() {
        this.isLoading = true;
        this.pqrsService.getPqrs().subscribe({
            next: (pqrsList) => {
                // El backend ya filtra las PQRS del ciudadano actual
                // por created_by_id, cedula o email
                this.misPqrs = pqrsList;
                this.isLoading = false;
            },
            error: (error) => {
                // console.error('Error cargando PQRS:', error);
                this.isLoading = false;
            }
        });
    }

    verDetalles(pqrs: PQRSWithDetails) {
        this.selectedPqrs = pqrs;
        this.showDetails = true;
    }

    cerrarDetalles() {
        this.selectedPqrs = null;
        this.showDetails = false;
    }

    toggleView() {
        this.showRegisterForm = !this.showRegisterForm;
    }

    logout() {
        console.log('🔐 Iniciando logout desde portal-ciudadano...');
        this.authService.logout();
        this.isLoggedIn = false;
        this.currentUser = null;
        this.misPqrs = [];
        
        setTimeout(() => {
            this.router.navigate(['/']).then(() => {
                console.log('✅ Logout completado. Recargando página...');
                window.location.reload();
            });
        }, 100);
    }

    volverAInicio() {
        const slug = this.entityContext.currentEntity?.slug;
        if (slug) {
            this.router.navigate(['/', slug]);
        } else {
            this.router.navigate(['/']);
        }
    }

    toggleNuevaPqrsForm() {
        this.showNuevaPqrsForm = !this.showNuevaPqrsForm;
        if (!this.showNuevaPqrsForm) {
            this.nuevaPqrsForm.reset({
                tipo_identificacion: 'personal',
                medio_respuesta: 'ticket'
            });
        }
    }

    onSubmitPqrs() {
        if (this.nuevaPqrsForm.valid && !this.isSubmittingPqrs) {
            this.isSubmittingPqrs = true;

            // Obtener entity_id del contexto actual
            if (!this.currentEntity) {
                this.alertService.error('No se pudo determinar la entidad. Por favor, recargue la página.', 'Error');
                this.isSubmittingPqrs = false;
                return;
            }

            const formData = {
                ...this.nuevaPqrsForm.value,
                entity_id: this.currentEntity.id
            };

            // Si es anónima, asignar valores por defecto
            if (formData.tipo_identificacion === 'anonima') {
                formData.nombre_ciudadano = 'Anónimo';
                formData.cedula_ciudadano = 'N/A';
            }

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

            this.pqrsService.createPqrs(formData).subscribe({
                next: (response) => {
                    this.alertService.success(
                        `PQRS creada exitosamente. Radicado: ${response.numero_radicado}`,
                        'PQRS Creada'
                    );
                    this.nuevaPqrsForm.reset({
                        tipo_identificacion: 'personal',
                        medio_respuesta: 'ticket'
                    });
                    this.showNuevaPqrsForm = false;
                    this.loadMisPqrs(); // Recargar lista
                    this.isSubmittingPqrs = false;
                },
                error: (error) => {
                    // console.error('Error creando PQRS:', error);
                    const errorMessage = error.error?.detail || 'No se pudo crear la PQRS. Intente nuevamente.';
                    this.alertService.error(errorMessage, 'Error');
                    this.isSubmittingPqrs = false;
                }
            });
        }
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

    getEstadoColor(estado: string): string {
        const colores: { [key: string]: string } = {
            'pendiente': 'warning',
            'en_proceso': 'info',
            'resuelto': 'success',
            'respondido': 'primary',
            'cerrado': 'dark'
        };
        return colores[estado] || 'secondary';
    }

    // Getters para estadísticas (evitan usar filter en la plantilla)
    get totalPqrs(): number {
        return this.misPqrs.length;
    }

    get pqrsEnProceso(): number {
        return this.misPqrs.filter(p => p.estado === 'pendiente' || p.estado === 'en_proceso').length;
    }

    get pqrsResueltas(): number {
        return this.misPqrs.filter(p => p.estado === 'resuelto' || p.estado === 'cerrado').length;
    }

    // Feature flag: PQRS habilitado
    pqrsEnabled(): boolean {
        return this.entityContext.currentEntity?.enable_pqrs ?? false;
    }
}
