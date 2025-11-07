import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { EntityService } from '../../services/entity.service';
import { UserService } from '../../services/user.service';
import { AuthService } from '../../services/auth.service';
import { AlertService } from '../../services/alert.service';
import { Entity, EntityWithStats, CreateEntityRequest } from '../../models/entity.model';
import { User, CreateUserRequest } from '../../models/user.model';

@Component({
    selector: 'app-soft-admin',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './soft-admin.html',
    styleUrls: ['./soft-admin.scss']
})
export class SoftAdminComponent implements OnInit {
    entities: EntityWithStats[] = [];
    selectedEntity: EntityWithStats | null = null;
    entityUsers: any[] = [];

    // Vista actual
    currentView: 'entities' | 'create-entity' | 'edit-entity' | 'entity-users' | 'create-admin' | 'edit-user' = 'entities';
    editingUser: any = null;
    editUserForm: any = {
        username: '',
        full_name: '',
        email: '',
        role: 'admin',
        entity_id: undefined,
        password: ''
    };

    // Formularios
    newEntity: CreateEntityRequest = {
        name: '',
        code: '',
        nit: '',
        slug: '',
        description: '',
        address: '',
        phone: '',
        email: '',
        logo_url: '',
        horario_atencion: '',
        tiempo_respuesta: '',
        enable_pqrs: true,
        enable_users_admin: true,
        enable_reports_pdf: true,
        enable_ai_reports: true,
        enable_planes_institucionales: true,
        enable_pdm: true,
        enable_contratacion: true
    };

    editingEntity: Entity | null = null;

    newAdmin: CreateUserRequest = {
        username: '',
        email: '',
        full_name: '',
        role: 'admin',
        entity_id: undefined,
        password: ''
    };

    confirmPassword: string = '';
    confirmEditPassword: string = '';
    loading = false;

    constructor(
        private entityService: EntityService,
        private userService: UserService,
        private authService: AuthService,
        private alertService: AlertService,
        private router: Router
    ) { }

    ngOnInit(): void {
        this.loadEntities();
    }

    loadEntities(): void {
        this.loading = true;
        this.entityService.getEntities().subscribe({
            next: (data) => {
                this.entities = data;
                this.loading = false;
            },
            error: (error) => {
                this.alertService.error('Error al cargar entidades: ' + error.error.detail);
                this.loading = false;
            }
        });
    }

    showCreateEntity(): void {
        this.currentView = 'create-entity';
        this.resetEntityForm();
    }

    showEntities(): void {
        this.currentView = 'entities';
        this.selectedEntity = null;
        this.loadEntities();
    }

    createEntity(): void {
        if (!this.validateEntityForm()) {
            return;
        }

        this.loading = true;
        this.entityService.createEntity(this.newEntity).subscribe({
            next: (entity) => {
                this.alertService.success('Entidad creada exitosamente');
                this.showEntities();
                this.resetEntityForm();
            },
            error: (error) => {
                this.alertService.error('Error al crear entidad: ' + error.error.detail);
                this.loading = false;
            }
        });
    }

    showEditEntity(entity: EntityWithStats): void {
        this.editingEntity = entity;
        this.newEntity = {
            name: entity.name,
            code: entity.code,
            nit: entity.nit || '',
            slug: entity.slug,
            description: entity.description || '',
            address: entity.address || '',
            phone: entity.phone || '',
            email: entity.email || '',
            logo_url: entity.logo_url || '',
            horario_atencion: entity.horario_atencion || '',
            tiempo_respuesta: entity.tiempo_respuesta || '',
            enable_pqrs: (entity as any).enable_pqrs ?? true,
            enable_users_admin: (entity as any).enable_users_admin ?? true,
            enable_reports_pdf: (entity as any).enable_reports_pdf ?? true,
            enable_ai_reports: (entity as any).enable_ai_reports ?? true,
            enable_planes_institucionales: (entity as any).enable_planes_institucionales ?? true,
            enable_pdm: (entity as any).enable_pdm ?? true,
            enable_contratacion: (entity as any).enable_contratacion ?? true
        };
        this.currentView = 'edit-entity';
    }

    updateEntity(): void {
        if (!this.validateEntityForm() || !this.editingEntity) {
            return;
        }

        this.loading = true;
        this.entityService.updateEntity(this.editingEntity.id, this.newEntity).subscribe({
            next: (entity) => {
                this.alertService.success('Entidad actualizada exitosamente');
                this.showEntities();
                this.resetEntityForm();
                this.editingEntity = null;
            },
            error: (error) => {
                this.alertService.error('Error al actualizar entidad: ' + error.error.detail);
                this.loading = false;
            }
        });
    }

    viewEntityUsers(entity: EntityWithStats): void {
        this.selectedEntity = entity;
        this.currentView = 'entity-users';
        this.loadEntityUsers(entity.id);
    }

    loadEntityUsers(entityId: number): void {
        this.loading = true;
        this.entityService.getEntityUsers(entityId).subscribe({
            next: (users) => {
                this.entityUsers = users;
                this.loading = false;
            },
            error: (error) => {
                this.alertService.error('Error al cargar usuarios: ' + error.error.detail);
                this.loading = false;
            }
        });
    }

    showEditUser(user: any): void {
        this.editingUser = { ...user };
        this.editUserForm = {
            username: user.username,
            full_name: user.full_name,
            email: user.email,
            role: user.role,
            entity_id: user.entity_id,
            password: ''
        };
        this.confirmEditPassword = '';
        this.currentView = 'edit-user';
    }

    updateUser(): void {
        if (!this.editingUser) return;
        if (!this.editUserForm.username || !this.editUserForm.full_name || !this.editUserForm.email) {
            this.alertService.warning('Usuario, nombre completo y email son obligatorios');
            return;
        }
        const payload: any = {
            username: this.editUserForm.username,
            full_name: this.editUserForm.full_name,
            email: this.editUserForm.email,
            role: this.editUserForm.role,
            entity_id: this.editUserForm.entity_id
        };
        const hasNewPassword = !!(this.editUserForm.password && this.editUserForm.password.length >= 6);

        // Si hay contraseña nueva, validar confirmación y cambiarla primero
        if (hasNewPassword) {
            if (this.editUserForm.password !== this.confirmEditPassword) {
                this.alertService.warning('Las contraseñas no coinciden');
                return;
            }
        }

        this.loading = true;

        const doProfileUpdate = () => this.userService.updateUser(this.editingUser.id, payload).subscribe({
            next: () => {
                this.alertService.success('Usuario actualizado exitosamente');
                if (this.selectedEntity) {
                    this.viewEntityUsers(this.selectedEntity);
                } else {
                    this.currentView = 'entities';
                    this.loadEntities();
                }
                this.editingUser = null;
                this.loading = false;
            },
            error: (error) => {
                this.alertService.error('Error al actualizar usuario: ' + (error.error?.detail || ''));
                this.loading = false;
            }
        });

        if (hasNewPassword) {
            // Cambiar contraseña primero y luego actualizar otros campos
            this.userService.changeUserPassword(this.editingUser.id, this.editUserForm.password).subscribe({
                next: () => doProfileUpdate(),
                error: (error) => {
                    this.alertService.error('No se pudo cambiar la contraseña: ' + (error.error?.detail || ''));
                    this.loading = false;
                }
            });
        } else {
            // Solo actualizar otros campos
            doProfileUpdate();
        }
    }

    cancelEditUser(): void {
        if (this.selectedEntity) {
            this.viewEntityUsers(this.selectedEntity);
        } else {
            this.showEntities();
        }
        this.editingUser = null;
    }

    showCreateAdmin(entity: EntityWithStats): void {
        this.selectedEntity = entity;
        this.currentView = 'create-admin';
        this.resetAdminForm();
        this.newAdmin.entity_id = entity.id;
    }

    createAdmin(): void {
        if (!this.validateAdminForm()) {
            return;
        }

        this.loading = true;
        this.userService.createUser(this.newAdmin).subscribe({
            next: (user) => {
                this.alertService.success('Administrador creado exitosamente');
                if (this.selectedEntity) {
                    this.viewEntityUsers(this.selectedEntity);
                }
                this.resetAdminForm();
            },
            error: (error) => {
                this.alertService.error('Error al crear administrador: ' + error.error.detail);
                this.loading = false;
            }
        });
    }

    toggleEntityStatus(entity: EntityWithStats): void {
        const action = entity.is_active ? 'desactivar' : 'activar';

        if (!confirm(`¿Está seguro de ${action} la entidad "${entity.name}"?`)) {
            return;
        }

        this.entityService.toggleEntityStatus(entity.id).subscribe({
            next: () => {
                this.alertService.success(`Entidad ${action}da exitosamente`);
                this.loadEntities();
            },
            error: (error) => {
                this.alertService.error('Error al cambiar estado: ' + error.error.detail);
            }
        });
    }

    deleteEntity(entity: EntityWithStats): void {
        if (!confirm(`¿Está seguro de eliminar la entidad "${entity.name}"? Esto eliminará todos los usuarios asociados.`)) {
            return;
        }

        this.entityService.deleteEntity(entity.id).subscribe({
            next: () => {
                this.alertService.success('Entidad eliminada exitosamente');
                this.loadEntities();
            },
            error: (error) => {
                this.alertService.error('Error al eliminar entidad: ' + error.error.detail);
            }
        });
    }

    toggleUserStatus(user: any): void {
        const action = user.is_active ? 'desactivar' : 'activar';

        if (!confirm(`¿Está seguro de ${action} al usuario "${user.username}"?`)) {
            return;
        }

        this.userService.toggleUserStatus(user.id).subscribe({
            next: () => {
                this.alertService.success(`Usuario ${action}do exitosamente`);
                if (this.selectedEntity) {
                    this.loadEntityUsers(this.selectedEntity.id);
                }
            },
            error: (error) => {
                this.alertService.error('Error al cambiar estado: ' + error.error.detail);
            }
        });
    }

    // Validaciones
    validateEntityForm(): boolean {
        if (!this.newEntity.name || !this.newEntity.code || !this.newEntity.slug) {
            this.alertService.warning('El nombre, código y slug son obligatorios');
            return false;
        }
        return true;
    }

    validateAdminForm(): boolean {
        if (!this.newAdmin.username || !this.newAdmin.email || !this.newAdmin.full_name || !this.newAdmin.password) {
            this.alertService.warning('Todos los campos son obligatorios');
            return false;
        }

        if (this.newAdmin.password !== this.confirmPassword) {
            this.alertService.warning('Las contraseñas no coinciden');
            return false;
        }

        if (this.newAdmin.password.length < 6) {
            this.alertService.warning('La contraseña debe tener al menos 6 caracteres');
            return false;
        }

        return true;
    }

    resetEntityForm(): void {
        this.newEntity = {
            name: '',
            code: '',
            nit: '',
            slug: '',
            description: '',
            address: '',
            phone: '',
            email: '',
            logo_url: '',
            horario_atencion: '',
            tiempo_respuesta: '',
            enable_pqrs: true,
            enable_users_admin: true,
            enable_reports_pdf: true,
            enable_ai_reports: true,
            enable_planes_institucionales: true,
            enable_pdm: true,
            enable_contratacion: true
        };
        this.editingEntity = null;
    }

    generateSlug(): void {
        // Genera un slug a partir del nombre de la entidad
        if (this.newEntity.name) {
            this.newEntity.slug = this.newEntity.name
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '') // Eliminar acentos
                .replace(/[^a-z0-9\s-]/g, '') // Solo letras, números, espacios y guiones
                .trim()
                .replace(/\s+/g, '-') // Espacios a guiones
                .replace(/-+/g, '-'); // Múltiples guiones a uno solo
        }
    }

    resetAdminForm(): void {
        this.newAdmin = {
            username: '',
            email: '',
            full_name: '',
            role: 'admin',
            entity_id: this.selectedEntity?.id,
            password: ''
        };
        this.confirmPassword = '';
    }

    getRoleName(role: string): string {
        const roles: any = {
            'superadmin': 'Super Administrador',
            'admin': 'Administrador',
            'secretario': 'Secretario',
            'ciudadano': 'Ciudadano'
        };
        return roles[role] || role;
    }

    copySlug(slug: string): void {
        const url = `${window.location.origin}/${slug}`;
        navigator.clipboard.writeText(url).then(() => {
            this.alertService.success('URL copiada al portapapeles');
        }).catch(() => {
            this.alertService.error('No se pudo copiar la URL');
        });
    }

    logout(): void {
        this.authService.logout();
        this.alertService.success('Sesión cerrada exitosamente');
        // No existe login global; enviamos al root para que el guard redirija a la entidad por defecto
        this.router.navigate(['/']);
    }
}
