import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AsistenciaService } from '../../../services/asistencia.service';
import { EquipoRegistro } from '../../../models/asistencia.model';

@Component({
  selector: 'app-equipos-registro',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="equipos-container">
      <div class="header-section">
        <h2><i class="bi bi-pc-display"></i> Equipos de Registro</h2>
        <button class="btn btn-primary" (click)="showCreateModal = true">
          <i class="bi bi-plus-circle"></i> Nuevo Equipo
        </button>
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
                <button class="btn btn-sm btn-outline-primary" (click)="editEquipo(equipo)">
                  <i class="bi bi-pencil"></i>
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
            <h5>Nuevo Equipo</h5>
            <button class="btn-close" (click)="closeModal()"></button>
          </div>
          <div class="modal-body">
            <div class="mb-3">
              <label class="form-label">UUID del Equipo *</label>
              <input type="text" class="form-control" [(ngModel)]="formData.uuid" placeholder="UUID único del equipo">
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
    .header-section { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; }
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
  formData: any = { uuid: '', nombre: '', ubicacion: '' };

  constructor(private asistenciaService: AsistenciaService) {}

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
    // TODO: Implementar edición
    console.log('Editar equipo:', equipo);
  }

  saveEquipo(): void {
    this.asistenciaService.createEquipo({
      ...this.formData,
      entity_id: 1 // TODO: Obtener del contexto
    }).subscribe({
      next: () => {
        this.closeModal();
        this.loadEquipos();
      },
      error: (error) => {
        console.error('Error:', error);
        alert('Error al crear el equipo');
      }
    });
  }

  closeModal(): void {
    this.showCreateModal = false;
    this.formData = { uuid: '', nombre: '', ubicacion: '' };
  }
}
