import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AsistenciaService } from '../../../services/asistencia.service';
import { RegistroAsistencia } from '../../../models/asistencia.model';

@Component({
  selector: 'app-registros-asistencia',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="registros-container">
      <h2><i class="bi bi-calendar-check"></i> Registros de Asistencia</h2>

      <!-- Filtros -->
      <div class="filters-section">
        <input type="date" class="form-control" [(ngModel)]="fechaDesde" (change)="loadRegistros()">
        <input type="date" class="form-control" [(ngModel)]="fechaHasta" (change)="loadRegistros()">
        <select class="form-select" [(ngModel)]="tipoFiltro" (change)="loadRegistros()">
          <option value="">Todos los tipos</option>
          <option value="entrada">Entradas</option>
          <option value="salida">Salidas</option>
        </select>
        <button class="btn btn-primary" (click)="loadRegistros()">
          <i class="bi bi-search"></i> Buscar
        </button>
      </div>

      <!-- Loading -->
      <div *ngIf="loading" class="text-center my-4">
        <div class="spinner-border text-primary"></div>
      </div>

      <!-- Tabla -->
      <div class="table-responsive" *ngIf="!loading">
        <table class="table table-hover">
          <thead>
            <tr>
              <th>Foto</th>
              <th>Funcionario</th>
              <th>Cédula</th>
              <th>Tipo</th>
              <th>Fecha y Hora</th>
              <th>Equipo</th>
              <th>Observaciones</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let registro of registros">
              <td>
                <img *ngIf="registro.foto_url" [src]="registro.foto_url" class="foto-small" alt="Foto">
                <i *ngIf="!registro.foto_url" class="bi bi-person-circle" style="font-size: 2rem;"></i>
              </td>
              <td>{{ registro.funcionario_nombres }} {{ registro.funcionario_apellidos }}</td>
              <td>{{ registro.funcionario_cedula }}</td>
              <td>
                <span class="badge" [class.bg-success]="registro.tipo_registro === 'entrada'" [class.bg-warning]="registro.tipo_registro === 'salida'">
                  {{ registro.tipo_registro | titlecase }}
                </span>
              </td>
              <td>{{ registro.fecha_hora | date:'dd/MM/yyyy HH:mm:ss' }}</td>
              <td>{{ registro.equipo_nombre }}</td>
              <td>{{ registro.observaciones || 'N/A' }}</td>
            </tr>
          </tbody>
        </table>
        <div *ngIf="registros.length === 0" class="alert alert-info">
          No se encontraron registros con los filtros seleccionados
        </div>
      </div>
    </div>
  `,
  styles: [`
    .registros-container { padding: 20px; }
    .filters-section { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 20px; }
    .foto-small { width: 50px; height: 50px; border-radius: 50%; object-fit: cover; }
  `]
})
export class RegistrosAsistenciaComponent implements OnInit {
  registros: RegistroAsistencia[] = [];
  loading = true;
  fechaDesde = '';
  fechaHasta = '';
  tipoFiltro = '';

  constructor(private asistenciaService: AsistenciaService) {}

  ngOnInit(): void {
    // Cargar registros de hoy por defecto
    const today = new Date().toISOString().split('T')[0];
    this.fechaDesde = today;
    this.fechaHasta = today;
    this.loadRegistros();
  }

  loadRegistros(): void {
    this.loading = true;
    this.asistenciaService.getRegistros(
      undefined, 
      undefined, 
      this.fechaDesde || undefined, 
      this.fechaHasta || undefined, 
      this.tipoFiltro || undefined, 
      200, 
      0
    ).subscribe({
      next: (data) => {
        this.registros = data;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error:', error);
        this.loading = false;
      }
    });
  }
}
