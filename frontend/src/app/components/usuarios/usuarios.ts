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

    modalAbierto: boolean = false;
    creando = false;

    // Formulario de creación
    form: Partial<UserCreatePayload> = {
        role: 'SECRETARIO'
    };

    ngOnInit(): void {
        this.cargar();
    }

    cargar() {
        this.cargando = true;
        this.usersService.listar().subscribe({
            next: (data) => (this.usuarios = data),
            error: () => (this.usuarios = []),
            complete: () => (this.cargando = false)
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
            // Requisito: no cargar lista de Secretaría; solo pedir nombre libre
            secretaria: (this.form.secretaria || '').trim() || null,
            // No seteamos entity_id aquí; el backend lo forzará para ADMIN
            allowed_modules: this.form.allowed_modules ?? null
        };

        this.cargando = true;
        this.usersService.crear(payload).subscribe({
            next: () => {
                this.cerrarModal();
                this.cargar();
            },
            error: () => {
                this.cargando = false;
            }
        });
    }

    eliminarUsuario(u: UserResponse) {
        if (!confirm(`¿Eliminar usuario ${u.username}?`)) return;
        this.usersService.eliminar(u.id).subscribe(() => this.cargar());
    }
}
