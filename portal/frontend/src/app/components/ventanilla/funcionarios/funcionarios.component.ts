import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AsistenciaService } from '../../../services/asistencia.service';
import { Funcionario } from '../../../models/asistencia.model';
import { EntityContextService } from '../../../services/entity-context.service';

@Component({
  selector: 'app-funcionarios',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="funcionarios-container">
      <div class="header-section">
        <h2><i class="bi bi-people"></i> Gestión de Funcionarios</h2>
        <button class="btn btn-primary" (click)="showCreateModal = true">
          <i class="bi bi-plus-circle"></i> Nuevo Funcionario
        </button>
      </div>

      <!-- Filtros -->
      <div class="filters-section">
        <input 
          type="text" 
          class="form-control" 
          placeholder="Buscar por cédula, nombre..." 
          [(ngModel)]="searchTerm"
          (input)="onSearchChange()"
        >
        <select class="form-select" [(ngModel)]="filterActive" (change)="loadFuncionarios()">
          <option [ngValue]="undefined">Todos los estados</option>
          <option [ngValue]="true">Activos</option>
          <option [ngValue]="false">Inactivos</option>
        </select>
      </div>

      <!-- Loading -->
      <div *ngIf="loading" class="text-center my-4">
        <div class="spinner-border text-primary" role="status">
          <span class="visually-hidden">Cargando...</span>
        </div>
      </div>

      <!-- Tabla de funcionarios -->
      <div class="table-responsive" *ngIf="!loading">
        <table class="table table-hover">
          <thead>
            <tr>
              <th>Foto</th>
              <th>Cédula</th>
              <th>Nombre Completo</th>
              <th>Email</th>
              <th>Teléfono</th>
              <th>Cargo</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let funcionario of funcionarios">
              <td>
                <img 
                  *ngIf="funcionario.foto_url" 
                  [src]="funcionario.foto_url" 
                  alt="Foto"
                  class="foto-funcionario"
                >
                <div *ngIf="!funcionario.foto_url" class="foto-placeholder">
                  <i class="bi bi-person-circle"></i>
                </div>
              </td>
              <td><strong>{{ funcionario.cedula }}</strong></td>
              <td>{{ funcionario.nombres }} {{ funcionario.apellidos }}</td>
              <td>{{ funcionario.email || 'N/A' }}</td>
              <td>{{ funcionario.telefono || 'N/A' }}</td>
              <td>{{ funcionario.cargo || 'N/A' }}</td>
              <td>
                <span class="badge" [class.bg-success]="funcionario.is_active" [class.bg-secondary]="!funcionario.is_active">
                  {{ funcionario.is_active ? 'Activo' : 'Inactivo' }}
                </span>
              </td>
              <td>
                <button class="btn btn-sm btn-outline-primary me-2" (click)="editFuncionario(funcionario)" title="Editar">
                  <i class="bi bi-pencil"></i>
                </button>
                <button 
                  class="btn btn-sm me-2" 
                  [class.btn-outline-danger]="funcionario.is_active"
                  [class.btn-outline-success]="!funcionario.is_active"
                  (click)="toggleActive(funcionario)"
                  [title]="funcionario.is_active ? 'Desactivar' : 'Activar'"
                >
                  <i class="bi" [class.bi-x-circle]="funcionario.is_active" [class.bi-check-circle]="!funcionario.is_active"></i>
                </button>
                <button 
                  class="btn btn-sm btn-outline-danger" 
                  (click)="deleteFuncionario(funcionario)"
                  title="Eliminar"
                >
                  <i class="bi bi-trash"></i>
                </button>
              </td>
            </tr>
          </tbody>
        </table>

        <div *ngIf="funcionarios.length === 0" class="alert alert-info">
          <i class="bi bi-info-circle"></i> No se encontraron funcionarios
        </div>
      </div>

      <!-- Modal crear/editar -->
      <div class="modal-backdrop" *ngIf="showCreateModal || showEditModal" (click)="closeModals()"></div>
      <div class="modal-dialog" *ngIf="showCreateModal || showEditModal">
        <div class="modal-content">
          <div class="modal-header">
            <h5>{{ showCreateModal ? 'Nuevo Funcionario' : 'Editar Funcionario' }}</h5>
            <button class="btn-close" (click)="closeModals()"></button>
          </div>
          <div class="modal-body">
            <form>
              <div class="mb-3" *ngIf="showCreateModal">
                <label class="form-label">Cédula *</label>
                <input type="text" class="form-control" [(ngModel)]="formData.cedula" name="cedula" required>
              </div>
              <div class="mb-3">
                <label class="form-label">Nombres *</label>
                <input type="text" class="form-control" [(ngModel)]="formData.nombres" name="nombres" required>
              </div>
              <div class="mb-3">
                <label class="form-label">Apellidos *</label>
                <input type="text" class="form-control" [(ngModel)]="formData.apellidos" name="apellidos" required>
              </div>
              <div class="mb-3">
                <label class="form-label">Email</label>
                <input type="email" class="form-control" [(ngModel)]="formData.email" name="email">
              </div>
              <div class="mb-3">
                <label class="form-label">Teléfono</label>
                <input type="text" class="form-control" [(ngModel)]="formData.telefono" name="telefono">
              </div>
              <div class="mb-3">
                <label class="form-label">Cargo</label>
                <input type="text" class="form-control" [(ngModel)]="formData.cargo" name="cargo">
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="closeModals()">Cancelar</button>
            <button class="btn btn-primary" (click)="saveFuncionario()">
              <i class="bi bi-save"></i> Guardar
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .funcionarios-container {
      padding: 20px;
    }

    .header-section {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 30px;
    }

    .header-section h2 {
      margin: 0;
      color: #333;
      font-weight: bold;
    }

    .filters-section {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 15px;
      margin-bottom: 20px;
    }

    .foto-funcionario {
      width: 50px;
      height: 50px;
      border-radius: 50%;
      object-fit: cover;
    }

    .foto-placeholder {
      width: 50px;
      height: 50px;
      border-radius: 50%;
      background: #f5f5f5;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 2rem;
      color: #999;
    }

    .modal-backdrop {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      z-index: 1040;
    }

    .modal-dialog {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      z-index: 1050;
      width: 90%;
      max-width: 600px;
    }

    .modal-content {
      background: white;
      border-radius: 10px;
      box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
    }

    .modal-header {
      padding: 20px;
      border-bottom: 1px solid #dee2e6;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .modal-header h5 {
      margin: 0;
      font-size: 1.25rem;
      font-weight: bold;
    }

    .modal-body {
      padding: 20px;
    }

    .modal-footer {
      padding: 20px;
      border-top: 1px solid #dee2e6;
      display: flex;
      justify-content: flex-end;
      gap: 10px;
    }

    .btn-close {
      background: none;
      border: none;
      font-size: 1.5rem;
      cursor: pointer;
    }
  `]
})
export class FuncionariosComponent implements OnInit {
  funcionarios: Funcionario[] = [];
  loading = true;
  searchTerm = '';
  filterActive: boolean | undefined = true;
  
  showCreateModal = false;
  showEditModal = false;
  currentFuncionario: Funcionario | null = null;
  
  formData: any = {
    cedula: '',
    nombres: '',
    apellidos: '',
    email: '',
    telefono: '',
    cargo: ''
  };

  private searchTimeout: any;

  constructor(
    private asistenciaService: AsistenciaService,
    private entityContext: EntityContextService
  ) {}

  ngOnInit(): void {
    this.loadFuncionarios();
  }

  loadFuncionarios(): void {
    this.loading = true;
    this.asistenciaService.getFuncionarios(undefined, this.filterActive, this.searchTerm).subscribe({
      next: (data) => {
        this.funcionarios = data;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error al cargar funcionarios:', error);
        this.loading = false;
      }
    });
  }

  onSearchChange(): void {
    clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => {
      this.loadFuncionarios();
    }, 500);
  }

  editFuncionario(funcionario: Funcionario): void {
    this.currentFuncionario = funcionario;
    this.formData = {
      nombres: funcionario.nombres,
      apellidos: funcionario.apellidos,
      email: funcionario.email || '',
      telefono: funcionario.telefono || '',
      cargo: funcionario.cargo || ''
    };
    this.showEditModal = true;
  }

  toggleActive(funcionario: Funcionario): void {
    const newStatus = !funcionario.is_active;
    this.asistenciaService.updateFuncionario(funcionario.id, { is_active: newStatus }).subscribe({
      next: () => {
        funcionario.is_active = newStatus;
      },
      error: (error) => {
        console.error('Error al actualizar estado:', error);
        alert('Error al actualizar el estado del funcionario');
      }
    });
  }

  deleteFuncionario(funcionario: Funcionario): void {
    const confirmacion = confirm(
      `¿Está seguro de eliminar al funcionario ${funcionario.nombres} ${funcionario.apellidos}?\n\n` +
      `Esta acción no se puede deshacer y eliminará también todos los registros de asistencia asociados.`
    );
    
    if (confirmacion) {
      this.asistenciaService.deleteFuncionario(funcionario.id).subscribe({
        next: () => {
          alert('Funcionario eliminado exitosamente');
          this.loadFuncionarios();
        },
        error: (error) => {
          console.error('Error al eliminar funcionario:', error);
          let errorMsg = 'Error al eliminar el funcionario';
          if (error.error?.detail) {
            errorMsg += ': ' + error.error.detail;
          }
          alert(errorMsg);
        }
      });
    }
  }

  saveFuncionario(): void {
    const entityId = this.entityContext.currentEntity?.id;
    
    if (!entityId) {
      alert('Error: No se pudo obtener la entidad actual');
      return;
    }

    if (this.showCreateModal) {
      // Validaciones para crear nuevo
      if (!this.formData.cedula || this.formData.cedula.trim() === '') {
        alert('La cédula es obligatoria');
        return;
      }
      if (!this.formData.nombres || this.formData.nombres.trim() === '') {
        alert('El nombre es obligatorio');
        return;
      }
      if (!this.formData.apellidos || this.formData.apellidos.trim() === '') {
        alert('Los apellidos son obligatorios');
        return;
      }

      // Crear nuevo
      const funcionarioData: any = {
        cedula: this.formData.cedula.trim(),
        nombres: this.formData.nombres.trim(),
        apellidos: this.formData.apellidos.trim(),
        entity_id: entityId
      };

      // Solo agregar campos opcionales si tienen valor
      if (this.formData.email && this.formData.email.trim() !== '') {
        funcionarioData.email = this.formData.email.trim();
      }
      if (this.formData.telefono && this.formData.telefono.trim() !== '') {
        funcionarioData.telefono = this.formData.telefono.trim();
      }
      if (this.formData.cargo && this.formData.cargo.trim() !== '') {
        funcionarioData.cargo = this.formData.cargo.trim();
      }

      console.log('Enviando datos:', funcionarioData);

      this.asistenciaService.createFuncionario(funcionarioData).subscribe({
        next: () => {
          alert('Funcionario creado exitosamente');
          this.closeModals();
          this.loadFuncionarios();
        },
        error: (error) => {
          console.error('Error completo:', error);
          let errorMsg = 'Error al crear el funcionario';
          if (error.error?.detail) {
            errorMsg += ': ' + error.error.detail;
          } else if (error.message) {
            errorMsg += ': ' + error.message;
          } else if (error.status === 0) {
            errorMsg += ': No se pudo conectar con el servidor. Verifica tu conexión o contacta al administrador.';
          }
          alert(errorMsg);
        }
      });
    } else if (this.showEditModal && this.currentFuncionario) {
      // Actualizar
      this.asistenciaService.updateFuncionario(this.currentFuncionario.id, this.formData).subscribe({
        next: () => {
          this.closeModals();
          this.loadFuncionarios();
        },
        error: (error) => {
          console.error('Error al actualizar funcionario:', error);
          alert('Error al actualizar el funcionario: ' + (error.error?.detail || error.message));
        }
      });
    }
  }

  closeModals(): void {
    this.showCreateModal = false;
    this.showEditModal = false;
    this.currentFuncionario = null;
    this.formData = {
      cedula: '',
      nombres: '',
      apellidos: '',
      email: '',
      telefono: '',
      cargo: ''
    };
  }
}
