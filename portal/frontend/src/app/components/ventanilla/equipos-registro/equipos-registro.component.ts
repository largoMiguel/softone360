import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AsistenciaService } from '../../../services/asistencia.service';
import { EquipoRegistro } from '../../../models/asistencia.model';
import { EntityContextService } from '../../../services/entity-context.service';

@Component({
  selector: 'app-equipos-registro',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="equipos-container">
      <div class="header-section">
        <h2><i class="bi bi-pc-display"></i> Equipos de Registro</h2>
        <div class="header-actions">
          <div class="alert alert-info mb-2">
            <i class="bi bi-info-circle"></i>
            <strong>Instrucciones:</strong> Ejecuta la aplicación de escritorio en el equipo que deseas registrar. 
            Copia el UUID que aparece en pantalla y pégalo en el formulario.
          </div>
          <button class="btn btn-primary" (click)="showCreateModal = true">
            <i class="bi bi-plus-circle"></i> Nuevo Equipo
          </button>
        </div>
      </div>

      <div *ngIf="loading" class="text-center my-4">
        <div class="spinner-border text-primary"></div>
      </div>

      <div class="table-responsive" *ngIf="!loading">
        <table class="table table-hover">
          <thead>
            <tr>
              <th>UUID</th>
              <th>Nombre</th>
              <th>Ubicación</th>
              <th>Estado</th>
              <th>Fecha Registro</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let equipo of equipos">
              <td><code>{{ equipo.uuid }}</code></td>
              <td>{{ equipo.nombre }}</td>
              <td>{{ equipo.ubicacion || 'N/A' }}</td>
              <td>
                <span class="badge" [class.bg-success]="equipo.is_active" [class.bg-secondary]="!equipo.is_active">
                  {{ equipo.is_active ? 'Activo' : 'Inactivo' }}
                </span>
              </td>
              <td>{{ equipo.created_at | date:'dd/MM/yyyy' }}</td>
              <td>
                <button class="btn btn-sm btn-outline-primary me-2" (click)="editEquipo(equipo)" title="Editar">
                  <i class="bi bi-pencil"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger" (click)="deleteEquipo(equipo)" title="Eliminar">
                  <i class="bi bi-trash"></i>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
        <div *ngIf="equipos.length === 0" class="alert alert-info">
          No hay equipos registrados
        </div>
      </div>

      <!-- Modal -->
      <div class="modal-backdrop" *ngIf="showCreateModal" (click)="closeModal()"></div>
      <div class="modal-dialog" *ngIf="showCreateModal">
        <div class="modal-content">
          <div class="modal-header">
            <h5>{{ isEditMode ? 'Editar Equipo' : 'Nuevo Equipo' }}</h5>
            <button class="btn-close" (click)="closeModal()"></button>
          </div>
          <div class="modal-body">
            <div class="mb-3">
              <label class="form-label">UUID del Equipo *</label>
              <input type="text" class="form-control" [(ngModel)]="formData.uuid" placeholder="Pega aquí el UUID de la app de escritorio" required>
              <small class="text-muted">
                <i class="bi bi-lightbulb"></i> 
                Copia el UUID que aparece en la aplicación de escritorio del equipo que deseas registrar.
              </small>
            </div>
            <div class="mb-3">
              <label class="form-label">Nombre *</label>
              <input type="text" class="form-control" [(ngModel)]="formData.nombre" placeholder="Ej: Recepción Principal">
            </div>
            <div class="mb-3">
              <label class="form-label">Ubicación</label>
              <input type="text" class="form-control" [(ngModel)]="formData.ubicacion" placeholder="Ej: Edificio A, Piso 1">
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="closeModal()">Cancelar</button>
            <button class="btn btn-primary" (click)="saveEquipo()">Guardar</button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .equipos-container { padding: 20px; }
    .header-section { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px; }
    .header-actions { display: flex; flex-direction: column; align-items: flex-end; gap: 10px; max-width: 600px; }
    .alert { padding: 12px; border-radius: 5px; font-size: 0.9rem; }
    .alert-info { background: #cfe2ff; border: 1px solid #b6d4fe; color: #084298; }
    .modal-backdrop { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 1040; }
    .modal-dialog { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 1050; width: 90%; max-width: 600px; }
    .modal-content { background: white; border-radius: 10px; box-shadow: 0 5px 15px rgba(0,0,0,0.3); }
    .modal-header, .modal-body, .modal-footer { padding: 20px; }
    .modal-header { border-bottom: 1px solid #dee2e6; display: flex; justify-content: space-between; }
    .modal-footer { border-top: 1px solid #dee2e6; display: flex; justify-content: flex-end; gap: 10px; }
  `]
})
export class EquiposRegistroComponent implements OnInit {
  equipos: EquipoRegistro[] = [];
  loading = true;
  showCreateModal = false;
  isEditMode = false;
  editingId: number | null = null;
  formData: any = { uuid: '', nombre: '', ubicacion: '' };

  constructor(
    private asistenciaService: AsistenciaService,
    private entityContext: EntityContextService
  ) {}

  ngOnInit(): void {
    this.loadEquipos();
  }

  loadEquipos(): void {
    this.loading = true;
    this.asistenciaService.getEquipos().subscribe({
      next: (data) => {
        this.equipos = data;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error:', error);
        this.loading = false;
      }
    });
  }

  editEquipo(equipo: EquipoRegistro): void {
    this.isEditMode = true;
    this.editingId = equipo.id;
    this.formData = {
      uuid: equipo.uuid,
      nombre: equipo.nombre,
      ubicacion: equipo.ubicacion || '',
      is_active: equipo.is_active
    };
    this.showCreateModal = true;
  }

  deleteEquipo(equipo: EquipoRegistro): void {
    if (!confirm(`¿Estás seguro de eliminar el equipo "${equipo.nombre}"?`)) {
      return;
    }

    this.asistenciaService.deleteEquipo(equipo.id).subscribe({
      next: () => {
        alert('Equipo eliminado exitosamente');
        this.loadEquipos();
      },
      error: (error) => {
        console.error('Error:', error);
        alert('Error al eliminar el equipo: ' + (error.error?.detail || error.message));
      }
    });
  }

  saveEquipo(): void {
    // Validar que el UUID no esté vacío
    if (!this.formData.uuid || this.formData.uuid.trim() === '') {
      alert('Por favor ingresa el UUID del equipo');
      return;
    }

    if (this.isEditMode && this.editingId) {
      // Modo edición - no enviar UUID (es inmutable)
      const updateData = {
        nombre: this.formData.nombre,
        ubicacion: this.formData.ubicacion,
        is_active: this.formData.is_active
      };
      
      this.asistenciaService.updateEquipo(this.editingId, updateData).subscribe({
        next: () => {
          alert('Equipo actualizado exitosamente');
          this.closeModal();
          this.loadEquipos();
        },
        error: (error) => {
          console.error('Error:', error);
          alert('Error al actualizar el equipo: ' + (error.error?.detail || error.message));
        }
      });
    } else {
      // Modo creación
      const entityId = this.entityContext.currentEntity?.id;
      
      if (!entityId) {
        alert('Error: No se pudo obtener la entidad actual');
        return;
      }

      this.asistenciaService.createEquipo({
        ...this.formData,
        entity_id: entityId
      }).subscribe({
        next: () => {
          alert('Equipo registrado exitosamente');
          this.closeModal();
          this.loadEquipos();
        },
        error: (error) => {
          console.error('Error:', error);
          alert('Error al crear el equipo: ' + (error.error?.detail || error.message));
        }
      });
    }
  }

  closeModal(): void {
    this.showCreateModal = false;
    this.isEditMode = false;
    this.editingId = null;
    this.formData = { uuid: '', nombre: '', ubicacion: '' };
  }
}
