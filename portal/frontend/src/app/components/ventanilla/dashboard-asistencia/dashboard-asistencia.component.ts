import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AsistenciaService } from '../../../services/asistencia.service';
import { EstadisticasAsistencia, RegistroAsistencia } from '../../../models/asistencia.model';

@Component({
  selector: 'app-dashboard-asistencia',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="dashboard-container">
      <h2><i class="bi bi-speedometer2"></i> Dashboard de Asistencia</h2>

      <!-- Estadísticas -->
      <div class="stats-grid" *ngIf="estadisticas">
        <div class="stat-card primary">
          <div class="stat-icon">
            <i class="bi bi-people"></i>
          </div>
          <div class="stat-content">
            <h3>{{ estadisticas.total_funcionarios }}</h3>
            <p>Funcionarios Registrados</p>
          </div>
        </div>

        <div class="stat-card success">
          <div class="stat-icon">
            <i class="bi bi-box-arrow-in-right"></i>
          </div>
          <div class="stat-content">
            <h3>{{ estadisticas.entradas_hoy }}</h3>
            <p>Entradas Hoy</p>
          </div>
        </div>

        <div class="stat-card warning">
          <div class="stat-icon">
            <i class="bi bi-box-arrow-right"></i>
          </div>
          <div class="stat-content">
            <h3>{{ estadisticas.salidas_hoy }}</h3>
            <p>Salidas Hoy</p>
          </div>
        </div>

        <div class="stat-card info">
          <div class="stat-icon">
            <i class="bi bi-person-check"></i>
          </div>
          <div class="stat-content">
            <h3>{{ estadisticas.funcionarios_presentes }}</h3>
            <p>Funcionarios Presentes</p>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon">
            <i class="bi bi-calendar-week"></i>
          </div>
          <div class="stat-content">
            <h3>{{ estadisticas.promedio_asistencia_semanal?.toFixed(1) || 0 }}</h3>
            <p>Promedio Semanal</p>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon">
            <i class="bi bi-clipboard-data"></i>
          </div>
          <div class="stat-content">
            <h3>{{ estadisticas.total_registros }}</h3>
            <p>Total Registros</p>
          </div>
        </div>
      </div>

      <!-- Últimos registros -->
      <div class="recent-registros">
        <h3><i class="bi bi-clock-history"></i> Últimos Registros</h3>
        
        <div *ngIf="loading" class="text-center">
          <div class="spinner-border text-primary" role="status">
            <span class="visually-hidden">Cargando...</span>
          </div>
        </div>

        <div *ngIf="!loading && registros.length === 0" class="alert alert-info">
          <i class="bi bi-info-circle"></i> No hay registros recientes
        </div>

        <div class="table-responsive" *ngIf="!loading && registros.length > 0">
          <table class="table table-hover">
            <thead>
              <tr>
                <th>Foto</th>
                <th>Funcionario</th>
                <th>Cédula</th>
                <th>Cargo</th>
                <th>Tipo</th>
                <th>Fecha y Hora</th>
                <th>Equipo</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let registro of registros">
                <td>
                  <img 
                    *ngIf="registro.funcionario_foto_url" 
                    [src]="registro.funcionario_foto_url" 
                    alt="Foto"
                    class="foto-funcionario"
                  >
                  <div *ngIf="!registro.funcionario_foto_url" class="foto-placeholder">
                    <i class="bi bi-person-circle"></i>
                  </div>
                </td>
                <td>
                  <strong>{{ registro.funcionario_nombres }} {{ registro.funcionario_apellidos }}</strong>
                </td>
                <td>{{ registro.funcionario_cedula }}</td>
                <td>{{ registro.funcionario_cargo || 'N/A' }}</td>
                <td>
                  <span class="badge" [class.badge-success]="registro.tipo_registro === 'entrada'"
                        [class.badge-warning]="registro.tipo_registro === 'salida'">
                    <i class="bi" [class.bi-box-arrow-in-right]="registro.tipo_registro === 'entrada'"
                       [class.bi-box-arrow-right]="registro.tipo_registro === 'salida'"></i>
                    {{ registro.tipo_registro | titlecase }}
                  </span>
                </td>
                <td>{{ registro.fecha_hora | date:'dd/MM/yyyy HH:mm:ss' }}</td>
                <td>{{ registro.equipo_nombre }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .dashboard-container {
      padding: 20px;
    }

    .dashboard-container h2 {
      margin-bottom: 30px;
      color: #333;
      font-weight: bold;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 20px;
      margin-bottom: 40px;
    }

    .stat-card {
      background: white;
      border-radius: 10px;
      padding: 20px;
      display: flex;
      align-items: center;
      gap: 15px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      transition: transform 0.3s ease, box-shadow 0.3s ease;
    }

    .stat-card:hover {
      transform: translateY(-5px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }

    .stat-icon {
      font-size: 3rem;
      width: 70px;
      height: 70px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      background: #f5f5f5;
    }

    .stat-card.primary .stat-icon {
      background: #e3f2fd;
      color: #1976d2;
    }

    .stat-card.success .stat-icon {
      background: #e8f5e9;
      color: #388e3c;
    }

    .stat-card.warning .stat-icon {
      background: #fff3e0;
      color: #f57c00;
    }

    .stat-card.info .stat-icon {
      background: #e0f2f1;
      color: #00796b;
    }

    .stat-content h3 {
      margin: 0;
      font-size: 2rem;
      font-weight: bold;
      color: #333;
    }

    .stat-content p {
      margin: 5px 0 0 0;
      color: #666;
      font-size: 0.9rem;
    }

    .recent-registros {
      background: white;
      border-radius: 10px;
      padding: 20px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    .recent-registros h3 {
      margin-bottom: 20px;
      color: #333;
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

    .badge {
      padding: 5px 10px;
      border-radius: 5px;
      font-size: 0.85rem;
    }

    .badge-success {
      background: #e8f5e9;
      color: #388e3c;
    }

    .badge-warning {
      background: #fff3e0;
      color: #f57c00;
    }
  `]
})
export class DashboardAsistenciaComponent implements OnInit {
  estadisticas: EstadisticasAsistencia | null = null;
  registros: RegistroAsistencia[] = [];
  loading = true;

  constructor(private asistenciaService: AsistenciaService) {}

  ngOnInit(): void {
    this.loadDashboardData();
  }

  loadDashboardData(): void {
    this.loading = true;

    // Cargar estadísticas
    this.asistenciaService.getEstadisticas().subscribe({
      next: (data) => {
        this.estadisticas = data;
      },
      error: (error) => {
        console.error('Error al cargar estadísticas:', error);
      }
    });

    // Cargar últimos 20 registros
    this.asistenciaService.getRegistros(undefined, undefined, undefined, undefined, undefined, 20, 0).subscribe({
      next: (data) => {
        this.registros = data;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error al cargar registros:', error);
        this.loading = false;
      }
    });
  }
}
