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
import { PqrsFormComponent } from '../shared/pqrs-form/pqrs-form.component';

@Component({
    selector: 'app-portal-ciudadano',
    standalone: true,
    imports: [CommonModule, FormsModule, ReactiveFormsModule, PqrsFormComponent],
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
    }

    ngOnInit() {
        this.currentEntity$.subscribe(entity => { this.currentEntity = entity; });
        this.authService.getCurrentUser().subscribe({
            next: user => {
                if (user && user.role === 'ciudadano') {
                    this.currentUser = user;
                    this.isLoggedIn = true;
                    // Agregar delay para asegurar que el token esté completamente configurado
                    setTimeout(() => {
                        this.cargarMisPqrs();
                    }, 300);
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
                                // Cargar PQRS después del login exitoso con delay para asegurar token configurado
                                setTimeout(() => {
                                    this.cargarMisPqrs();
                                }, 400);
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
    }

    verDetalle(pqrs: any) {
        this.pqrsDetalle = pqrs;
    }

    cerrarDetalle() {
        this.pqrsDetalle = null;
    }

    // Maneja el evento cuando se crea una PQRS desde el componente compartido
    onPqrsCreated(radicado: string) {
        this.alertService.success(
            `PQRS radicada exitosamente con número: ${radicado}`,
            'Radicación Exitosa'
        );
        this.cargarMisPqrs();
        this.currentView = 'mis-pqrs';
    }

    navegarANuevaPqrs() {
        const slug = this.entityContext.currentEntity?.slug;
        this.router.navigate(slug ? ['/', slug, 'dashboard'] : ['/'], {
            queryParams: { v: 'nueva-pqrs' }
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
