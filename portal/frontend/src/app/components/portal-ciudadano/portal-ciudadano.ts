import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { EntityContextService } from '../../services/entity-context.service';
import { AuthService } from '../../services/auth.service';
import { AlertService } from '../../services/alert.service';
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

    constructor(
        private authService: AuthService,
        private router: Router,
        private route: ActivatedRoute,
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

        this.currentEntity$ = this.entityContext.currentEntity$;
    }

    ngOnInit() {
        this.currentEntity$.subscribe(entity => { this.currentEntity = entity; });
        this.authService.getCurrentUser().subscribe({
            next: user => {
                if (user && user.role === 'ciudadano') {
                    this.currentUser = user;
                    this.isLoggedIn = true;
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
}
