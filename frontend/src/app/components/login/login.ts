import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { AlertService } from '../../services/alert.service';
import { EntityContextService } from '../../services/entity-context.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './login.html',
  styleUrl: './login.scss'
})
export class LoginComponent implements OnInit {
  loginForm: FormGroup;
  isLoading = false;
  errorMessage = '';

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private alertService: AlertService,
    private entityContext: EntityContextService
  ) {
    this.loginForm = this.fb.group({
      username: ['', [Validators.required]],
      password: ['', [Validators.required]]
    });
  }

  ngOnInit() {
    // Permitir llegar al login incluso si había sesión previa (el guard hará logout suave).
  }

  onSubmit() {
    if (this.loginForm.valid) {
      this.isLoading = true;
      this.errorMessage = '';
      // console.log('Enviando credenciales:', this.loginForm.value);

      this.authService.login(this.loginForm.value).subscribe({
        next: (response) => {
          // console.log('Login exitoso');

          // Verificar si el usuario es ciudadano o superadmin
          this.authService.getCurrentUser().subscribe({
            next: (user) => {
              if (user && user.role === 'ciudadano') {
                // Ciudadano intentando acceder al portal administrativo
                this.alertService.warning(
                  'Este portal es solo para administrativos. Por favor usa el Portal Ciudadano.',
                  'Acceso Restringido'
                );
                this.authService.logout();
                this.isLoading = false;
                // Redirigir al portal ciudadano
                setTimeout(() => {
                  const slug = this.entityContext.currentEntity?.slug || this.router.url.replace(/^\//, '').split('/')[0];
                  this.router.navigate(slug ? ['/', slug, 'portal-ciudadano'] : ['/']);
                }, 2000);
              } else if (user && user.role === 'superadmin') {
                // Super admin redirige a soft-admin
                this.isLoading = false;
                this.router.navigate(['/soft-admin'], { replaceUrl: true });
              } else {
                // Usuario administrativo válido (admin o secretario)
                this.isLoading = false;
                const slug = this.entityContext.currentEntity?.slug || this.router.url.replace(/^\//, '').split('/')[0];
                this.router.navigate(slug ? ['/', slug, 'dashboard'] : ['/'], { replaceUrl: true });
              }
            },
            error: () => {
              this.isLoading = false;
              const slug = this.entityContext.currentEntity?.slug || this.router.url.replace(/^\//, '').split('/')[0];
              this.router.navigate(slug ? ['/', slug, 'dashboard'] : ['/'], { replaceUrl: true });
            }
          });
        },
        error: (error) => {
          // console.error('Error en login:', error);
          this.isLoading = false;

          // Verificar si el error es por usuario inactivo
          const errorDetail = error.error?.detail || 'Error al iniciar sesión';

          if (errorDetail.toLowerCase().includes('inactivo') || errorDetail.toLowerCase().includes('desactivado')) {
            this.alertService.error(
              'Tu cuenta ha sido desactivada. Por favor, contacta al administrador del sistema para más información.',
              'Cuenta Inactiva'
            );
          } else if (error.status === 401) {
            this.alertService.error(
              'El usuario o la contraseña son incorrectos. Por favor, verifica tus credenciales e intenta nuevamente.',
              'Credenciales Incorrectas'
            );
          } else {
            this.alertService.error(errorDetail, 'Error de Inicio de Sesión');
          }

          this.errorMessage = errorDetail;
        }
      });
    } else {
      // console.log('Formulario inválido');
    }
  }
}
