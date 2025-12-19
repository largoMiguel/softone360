import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AsistenciaService } from '../../../services/asistencia.service';
import { RegistroAsistencia } from '../../../models/asistencia.model';

interface RegistroAgrupado {
  funcionario_cedula: string;
  funcionario_nombres: string;
  funcionario_apellidos: string;
  fecha: string;
  entradas: RegistroAsistencia[];
  salidas: RegistroAsistencia[];
  foto_url?: string;
  equipo_nombre?: string;
}

@Component({
  selector: 'app-registros-asistencia',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="registros-container">
      <div class="header-section">
        <h2><i class="bi bi-calendar-check"></i> Registros de Asistencia</h2>
        <div class="stats-cards">
          <div class="stat-card entrada">
            <i class="bi bi-box-arrow-in-right"></i>
            <div class="stat-info">
              <span class="stat-label">Entradas</span>
              <span class="stat-value">{{ totalEntradas }}</span>
            </div>
          </div>
          <div class="stat-card salida">
            <i class="bi bi-box-arrow-right"></i>
            <div class="stat-info">
              <span class="stat-label">Salidas</span>
              <span class="stat-value">{{ totalSalidas }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Filtros mejorados -->
      <div class="filters-section">
        <div class="filter-group">
          <label><i class="bi bi-calendar-range"></i> Desde</label>
          <input type="date" class="form-control" [(ngModel)]="fechaDesde" (change)="loadRegistros()">
        </div>
        <div class="filter-group">
          <label><i class="bi bi-calendar-range"></i> Hasta</label>
          <input type="date" class="form-control" [(ngModel)]="fechaHasta" (change)="loadRegistros()">
        </div>
        <div class="filter-group">
          <label><i class="bi bi-funnel"></i> Tipo</label>
          <select class="form-select" [(ngModel)]="tipoFiltro" (change)="loadRegistros()">
            <option value="">Todos</option>
            <option value="entrada">Entradas</option>
            <option value="salida">Salidas</option>
          </select>
        </div>
        <div class="filter-group">
          <label>&nbsp;</label>
          <button class="btn btn-primary w-100" (click)="loadRegistros()">
            <i class="bi bi-search"></i> Buscar
          </button>
        </div>
      </div>

      <!-- Loading -->
      <div *ngIf="loading" class="text-center my-4">
        <div class="spinner-border text-primary"></div>
        <p class="mt-2 text-muted">Cargando registros...</p>
      </div>

      <!-- Vista de tabla horizontal profesional -->
      <div class="tabla-container" *ngIf="!loading && registrosAgrupados.length > 0">
        <table class="tabla-registros">
          <thead>
            <tr>
              <th>Foto</th>
              <th>Funcionario</th>
              <th>Cédula</th>
              <th>Fecha</th>
              <th>Entradas</th>
              <th>Salidas</th>
              <th>Equipo</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let registro of registrosAgrupados" class="fila-registro">
              <td class="col-foto">
                <div class="foto-wrapper">
                  <img *ngIf="registro.foto_url" [src]="registro.foto_url" class="foto-thumbnail" alt="Foto">
                  <div *ngIf="!registro.foto_url" class="foto-placeholder-small">
                    <i class="bi bi-person-circle"></i>
                  </div>
                </div>
              </td>
              <td class="col-nombre">
                <strong>{{ registro.funcionario_nombres }} {{ registro.funcionario_apellidos }}</strong>
              </td>
              <td class="col-cedula">{{ registro.funcionario_cedula }}</td>
              <td class="col-fecha">{{ registro.fecha | date:'dd/MM/yyyy' }}</td>
              <td class="col-entradas">
                <div class="tiempos-lista">
                  <div class="tiempo-badge entrada" *ngFor="let entrada of registro.entradas" (click)="verDetalle(entrada)" title="Click para ver foto">
                    <i class="bi bi-box-arrow-in-right"></i>
                    {{ formatearHora(entrada.fecha_hora) }}
                  </div>
                  <span *ngIf="registro.entradas.length === 0" class="sin-registro">—</span>
                </div>
              </td>
              <td class="col-salidas">
                <div class="tiempos-lista">
                  <div class="tiempo-badge salida" *ngFor="let salida of registro.salidas" (click)="verDetalle(salida)" title="Click para ver foto">
                    <i class="bi bi-box-arrow-right"></i>
                    {{ formatearHora(salida.fecha_hora) }}
                  </div>
                  <span *ngIf="registro.salidas.length === 0" class="sin-registro">—</span>
                </div>
              </td>
              <td class="col-equipo">{{ registro.equipo_nombre || 'N/A' }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Mensaje sin registros -->
      <div *ngIf="!loading && registrosAgrupados.length === 0" class="empty-state">
        <i class="bi bi-inbox"></i>
        <h4>No hay registros</h4>
        <p>No se encontraron registros con los filtros seleccionados</p>
      </div>

      <!-- Modal de detalle -->
      <div class="modal-backdrop" *ngIf="showModal" (click)="closeModal()"></div>
      <div class="modal-dialog" *ngIf="showModal && selectedRegistro">
        <div class="modal-content">
          <div class="modal-header">
            <h5><i class="bi bi-info-circle"></i> Detalle del Registro</h5>
            <button class="btn-close" (click)="closeModal()"></button>
          </div>
          <div class="modal-body">
            <!-- Foto grande -->
            <div class="foto-detalle-container" *ngIf="selectedRegistro.foto_url">
              <img [src]="selectedRegistro.foto_url" class="foto-detalle" alt="Foto del registro">
            </div>
            <div class="foto-detalle-placeholder" *ngIf="!selectedRegistro.foto_url">
              <i class="bi bi-person-circle"></i>
              <p>Sin foto</p>
            </div>

            <!-- Información detallada -->
            <div class="detalle-info">
              <div class="detalle-row">
                <span class="detalle-label">Funcionario:</span>
                <span class="detalle-value">{{ selectedRegistro.funcionario_nombres }} {{ selectedRegistro.funcionario_apellidos }}</span>
              </div>
              <div class="detalle-row">
                <span class="detalle-label">Cédula:</span>
                <span class="detalle-value">{{ selectedRegistro.funcionario_cedula }}</span>
              </div>
              <div class="detalle-row">
                <span class="detalle-label">Tipo de registro:</span>
                <span class="badge" [class.bg-success]="selectedRegistro.tipo_registro === 'entrada'" [class.bg-warning]="selectedRegistro.tipo_registro === 'salida'">
                  {{ selectedRegistro.tipo_registro | uppercase }}
                </span>
              </div>
              <div class="detalle-row">
                <span class="detalle-label">Fecha y hora:</span>
                <span class="detalle-value">{{ selectedRegistro.fecha_hora | date:'dd/MM/yyyy HH:mm:ss' }}</span>
              </div>
              <div class="detalle-row">
                <span class="detalle-label">Equipo:</span>
                <span class="detalle-value">{{ selectedRegistro.equipo_nombre || 'N/A' }}</span>
              </div>
              <div class="detalle-row" *ngIf="selectedRegistro.observaciones">
                <span class="detalle-label">Observaciones:</span>
                <span class="detalle-value">{{ selectedRegistro.observaciones }}</span>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="closeModal()">Cerrar</button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .registros-container { padding: 20px; }
    
    .header-section { 
      display: flex; 
      justify-content: space-between; 
      align-items: center; 
      margin-bottom: 30px; 
      flex-wrap: wrap;
      gap: 20px;
    }
    
    .stats-cards { 
      display: flex; 
      gap: 15px; 
    }
    
    .stat-card { 
      display: flex; 
      align-items: center; 
      gap: 15px; 
      padding: 15px 25px; 
      border-radius: 10px; 
      color: white;
      min-width: 150px;
    }
    
    .stat-card.entrada { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
    .stat-card.salida { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); }
    
    .stat-card i { font-size: 2rem; }
    
    .stat-info { display: flex; flex-direction: column; }
    .stat-label { font-size: 0.9rem; opacity: 0.9; }
    .stat-value { font-size: 1.5rem; font-weight: bold; }
    
    .filters-section { 
      display: grid; 
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); 
      gap: 15px; 
      margin-bottom: 30px; 
      padding: 20px;
      background: #f8f9fa;
      border-radius: 10px;
    }
    
    .filter-group { display: flex; flex-direction: column; }
    .filter-group label { font-weight: 500; margin-bottom: 5px; font-size: 0.9rem; color: #495057; }
    
    .tabla-container {
      background: white;
      border-radius: 10px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      overflow: hidden;
    }
    
    .tabla-registros {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.95rem;
    }
    
    .tabla-registros thead {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }
    
    .tabla-registros th {
      padding: 15px 12px;
      text-align: left;
      font-weight: 600;
      font-size: 0.9rem;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .tabla-registros tbody tr {
      border-bottom: 1px solid #e9ecef;
      transition: background-color 0.2s;
    }
    
    .tabla-registros tbody tr:hover {
      background-color: #f8f9fa;
    }
    
    .tabla-registros tbody tr:last-child {
      border-bottom: none;
    }
    
    .tabla-registros td {
      padding: 15px 12px;
      vertical-align: middle;
    }
    
    .col-foto {
      width: 80px;
      text-align: center;
    }
    
    .foto-wrapper {
      display: flex;
      justify-content: center;
      align-items: center;
    }
    
    .foto-thumbnail {
      width: 50px;
      height: 50px;
      border-radius: 50%;
      object-fit: cover;
      border: 2px solid #667eea;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    
    .foto-placeholder-small {
      width: 50px;
      height: 50px;
      border-radius: 50%;
      background: #e9ecef;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #adb5bd;
      font-size: 1.8rem;
    }
    
    .col-nombre {
      min-width: 200px;
      color: #2c3e50;
    }
    
    .col-cedula {
      min-width: 120px;
      color: #6c757d;
      font-family: 'Courier New', monospace;
    }
    
    .col-fecha {
      min-width: 110px;
      color: #495057;
    }
    
    .col-entradas, .col-salidas {
      min-width: 140px;
    }
    
    .tiempos-lista {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    
    .tiempo-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      border-radius: 20px;
      font-size: 0.85rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
      white-space: nowrap;
    }
    
    .tiempo-badge.entrada {
      background: linear-gradient(135deg, rgba(102, 126, 234, 0.15) 0%, rgba(118, 75, 162, 0.15) 100%);
      color: #5a67d8;
      border: 1px solid rgba(102, 126, 234, 0.3);
    }
    
    .tiempo-badge.entrada:hover {
      background: linear-gradient(135deg, rgba(102, 126, 234, 0.25) 0%, rgba(118, 75, 162, 0.25) 100%);
      transform: translateX(3px);
      box-shadow: 0 2px 6px rgba(102, 126, 234, 0.3);
    }
    
    .tiempo-badge.salida {
      background: linear-gradient(135deg, rgba(240, 147, 251, 0.15) 0%, rgba(245, 87, 108, 0.15) 100%);
      color: #e53e3e;
      border: 1px solid rgba(245, 87, 108, 0.3);
    }
    
    .tiempo-badge.salida:hover {
      background: linear-gradient(135deg, rgba(240, 147, 251, 0.25) 0%, rgba(245, 87, 108, 0.25) 100%);
      transform: translateX(3px);
      box-shadow: 0 2px 6px rgba(245, 87, 108, 0.3);
    }
    
    .tiempo-badge i {
      font-size: 1rem;
    }
    
    .sin-registro {
      color: #adb5bd;
      font-style: italic;
    }
    
    .col-equipo {
      min-width: 150px;
      color: #6c757d;
      font-size: 0.9rem;
    }
    
    .empty-state { 
      text-align: center; 
      padding: 60px 20px; 
      color: #6c757d;
    }
    
    .empty-state i { 
      font-size: 4rem; 
      color: #dee2e6; 
      margin-bottom: 20px;
    }
    
    .empty-state h4 { 
      font-size: 1.5rem; 
      margin-bottom: 10px;
    }
    
    /* Modal */
    .modal-backdrop { 
      position: fixed; 
      top: 0; 
      left: 0; 
      width: 100%; 
      height: 100%; 
      background: rgba(0,0,0,0.5); 
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
      max-height: 90vh;
      overflow-y: auto;
    }
    
    .modal-content { 
      background: white; 
      border-radius: 10px; 
      box-shadow: 0 5px 15px rgba(0,0,0,0.3); 
    }
    
    .modal-header, .modal-body, .modal-footer { padding: 20px; }
    .modal-header { 
      border-bottom: 1px solid #dee2e6; 
      display: flex; 
      justify-content: space-between; 
      align-items: center;
    }
    .modal-footer { 
      border-top: 1px solid #dee2e6; 
      display: flex; 
      justify-content: flex-end; 
      gap: 10px; 
    }
    
    .foto-detalle-container { 
      text-align: center; 
      margin-bottom: 20px;
    }
    
    .foto-detalle { 
      max-width: 100%; 
      max-height: 400px; 
      border-radius: 10px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    
    .foto-detalle-placeholder { 
      text-align: center; 
      padding: 40px; 
      background: #f8f9fa;
      border-radius: 10px;
      margin-bottom: 20px;
    }
    
    .foto-detalle-placeholder i { 
      font-size: 4rem; 
      color: #dee2e6; 
    }
    
    .detalle-info { 
      display: flex; 
      flex-direction: column; 
      gap: 15px; 
    }
    
    .detalle-row { 
      display: flex; 
      justify-content: space-between; 
      align-items: center;
      padding: 12px;
      background: #f8f9fa;
      border-radius: 5px;
    }
    
    .detalle-label { 
      font-weight: 600; 
      color: #495057;
    }
    
    .detalle-value { 
      color: #6c757d;
    }
    
    .btn-close { 
      background: none; 
      border: none; 
      font-size: 1.5rem; 
      cursor: pointer; 
      color: #6c757d;
    }
  `]
})
export class RegistrosAsistenciaComponent implements OnInit {
  registros: RegistroAsistencia[] = [];
  registrosAgrupados: RegistroAgrupado[] = [];
  loading = true;
  fechaDesde = '';
  fechaHasta = '';
  tipoFiltro = '';
  showModal = false;
  selectedRegistro: RegistroAsistencia | null = null;

  get totalEntradas(): number {
    return this.registros.filter(r => r.tipo_registro === 'entrada').length;
  }

  get totalSalidas(): number {
    return this.registros.filter(r => r.tipo_registro === 'salida').length;
  }

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
        this.agruparRegistros();
        this.loading = false;
      },
      error: (error) => {
        console.error('Error:', error);
        this.loading = false;
      }
    });
  }

  agruparRegistros(): void {
    const grupos = new Map<string, RegistroAgrupado>();

    this.registros.forEach(registro => {
      const fecha = new Date(registro.fecha_hora).toISOString().split('T')[0];
      const key = `${registro.funcionario_cedula}-${fecha}`;

      if (!grupos.has(key)) {
        grupos.set(key, {
          funcionario_cedula: registro.funcionario_cedula,
          funcionario_nombres: registro.funcionario_nombres,
          funcionario_apellidos: registro.funcionario_apellidos,
          fecha: fecha,
          entradas: [],
          salidas: [],
          foto_url: registro.foto_url,
          equipo_nombre: registro.equipo_nombre
        });
      }

      const grupo = grupos.get(key)!;
      if (registro.tipo_registro === 'entrada') {
        grupo.entradas.push(registro);
      } else {
        grupo.salidas.push(registro);
      }

      // Actualizar foto si no existe
      if (!grupo.foto_url && registro.foto_url) {
        grupo.foto_url = registro.foto_url;
      }
    });

    this.registrosAgrupados = Array.from(grupos.values())
      .sort((a, b) => {
        // Ordenar por fecha descendente
        return new Date(b.fecha).getTime() - new Date(a.fecha).getTime();
      });
  }

  formatearHora(fechaHora: string): string {
    // Convertir a Date y ajustar a zona horaria de Colombia (UTC-5)
    const fecha = new Date(fechaHora);
    
    // Obtener hora en formato 12h
    let horas = fecha.getHours();
    const minutos = fecha.getMinutes().toString().padStart(2, '0');
    const segundos = fecha.getSeconds().toString().padStart(2, '0');
    const ampm = horas >= 12 ? 'PM' : 'AM';
    
    horas = horas % 12;
    horas = horas ? horas : 12; // Si es 0, mostrar 12
    
    return `${horas}:${minutos}:${segundos} ${ampm}`;
  }

  verDetalle(registro: RegistroAsistencia): void {
    this.selectedRegistro = registro;
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.selectedRegistro = null;
  }
}
