import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { AlertService } from '../../../services/alert.service';

@Component({
    selector: 'app-login-asistencia',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './login-asistencia.component.html',
    styleUrls: ['./login-asistencia.component.scss']
})
export class LoginAsistenciaComponent {
    credentials = {
        username: '',
        password: ''
    };
    
    isLoading = false;
    showPassword = false;

    constructor(
        private authService: AuthService,
        private router: Router,
        private alertService: AlertService
    ) {}

    onSubmit(): void {
        if (!this.credentials.username || !this.credentials.password) {
            this.alertService.error('Por favor ingrese email y contraseña');
            return;
        }

        this.isLoading = true;
        
        this.authService.login(this.credentials).subscribe({
            next: (response) => {
                const user = this.authService.getCurrentUserValue();
                
                if (!user) {
                    this.alertService.error('Error al obtener información del usuario');
                    this.isLoading = false;
                    return;
                }

                // Verificar que el usuario tenga entidad asociada
                if (!user.entity || !user.entity.slug) {
                    this.alertService.error('Usuario sin entidad asociada. Contacte al administrador.');
                    this.authService.logout();
                    this.isLoading = false;
                    return;
                }

                // Verificar que tenga rol de secretario, admin o superadmin
                if (!['secretario', 'admin', 'superadmin'].includes(user.role)) {
                    this.alertService.error('No tiene permisos para acceder al Control de Asistencia');
                    this.authService.logout();
                    this.isLoading = false;
                    return;
                }

                // Redirigir al dashboard de asistencia de su entidad
                this.alertService.success('Bienvenido al Control de Asistencia');
                this.router.navigate(['/talento-humano/dashboard']);
            },
            error: (error) => {
                console.error('Error en login:', error);
                this.isLoading = false;
                
                if (error.status === 401) {
                    this.alertService.error('Email o contraseña incorrectos');
                } else if (error.status === 0) {
                    this.alertService.error('No se pudo conectar con el servidor. Verifique su conexión.');
                } else {
                    this.alertService.error('Error al iniciar sesión. Intente nuevamente.');
                }
            }
        });
    }

    togglePassword(): void {
        this.showPassword = !this.showPassword;
    }

    volverAlInicio(): void {
        this.router.navigate(['/']);
    }
}
