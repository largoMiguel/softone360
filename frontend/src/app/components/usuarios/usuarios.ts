import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UsersService, UserResponse, UserCreatePayload } from '../../services/users.service';

@Component({
    selector: 'app-usuarios',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './usuarios.html',
    styleUrls: ['./usuarios.scss']
})
export class UsuariosComponent implements OnInit {
    private usersService = inject(UsersService);

    cargando = false;
    usuarios: UserResponse[] = [];
    secretarias: string[] = [];

    modalAbierto: boolean = false;
    creando = false;

    // Formulario de creación
    form: Partial<UserCreatePayload> = {
        role: 'SECRETARIO'
    };

    // VERSION: 1.1 - Mostrar secretaría en tabla
    version = '1.1';

    ngOnInit(): void {
        this.cargar();
        this.cargarSecretarias();
    }

    cargar() {
        this.cargando = true;
        this.usersService.listar().subscribe({
            next: (data) => (this.usuarios = data),
            error: () => (this.usuarios = []),
            complete: () => (this.cargando = false)
        });
    }

    /**
     * Carga la lista de secretarías existentes para autocompletar
     */
    cargarSecretarias() {
        this.usersService.obtenerSecretarias().subscribe({
            next: (data) => {
                this.secretarias = data;
                console.log('✅ Secretarías cargadas:', this.secretarias);
            },
            error: (err) => {
                console.error('❌ Error al cargar secretarías:', err);
                this.secretarias = [];
            }
        });
    }

    abrirModal() {
        this.modalAbierto = true;
        this.creando = true;
        this.form = { role: 'SECRETARIO' };
    }

    cerrarModal() {
        this.modalAbierto = false;
        this.creando = false;
    }

    crearUsuario() {
        if (!this.form.username || !this.form.email || !this.form.full_name || !this.form.password || !this.form.role) {
            return;
        }

        const payload: UserCreatePayload = {
            username: this.form.username!,
            email: this.form.email!,
            full_name: this.form.full_name!,
            password: this.form.password!,
            role: this.form.role!,
            user_type: this.form.user_type ?? 'secretario',
            // Enviar nombre de secretaría: se creará automáticamente en la tabla secretarias
            secretaria: (this.form.secretaria || '').trim() || null,
            allowed_modules: this.form.allowed_modules ?? null
        };

        this.cargando = true;
        this.usersService.crear(payload).subscribe({
            next: () => {
                this.cerrarModal();
                this.cargar();
                this.cargarSecretarias();  // Recargar secretarías por si se agregó una nueva
            },
            error: () => {
                this.cargando = false;
            }
        });
    }

    eliminarUsuario(u: UserResponse) {
        if (!confirm(`¿Eliminar usuario ${u.username}?`)) return;
        
        this.cargando = true;
        this.usersService.eliminar(u.id).subscribe({
            next: (response) => {
                // Mostrar mensaje detallado
                let mensaje = `✅ Usuario ${u.username} eliminado`;
                if (u.secretaria) {
                    mensaje += `\n✅ La Secretaría "${u.secretaria}" permanece activa`;
                    if (response.otros_usuarios_en_secretaria && response.otros_usuarios_en_secretaria > 0) {
                        mensaje += ` (${response.otros_usuarios_en_secretaria} otro(s) usuario(s))`;
                    }
                }
                
                console.log(mensaje);
                alert(mensaje);
                this.cargar();
            },
            error: (err) => {
                console.error('❌ Error al eliminar usuario:', err);
                alert('Error al eliminar usuario: ' + (err.error?.detail || err.message));
                this.cargando = false;
            }
        });
    }
}
