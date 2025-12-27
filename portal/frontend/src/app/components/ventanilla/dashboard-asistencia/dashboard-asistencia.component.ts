import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AsistenciaService } from '../../../services/asistencia.service';
import { EstadisticasAsistencia, RegistroAsistencia } from '../../../models/asistencia.model';

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
                    <div class="tiempo-badge entrada" *ngFor="let entrada of registro.entradas">
                      <i class="bi bi-box-arrow-in-right"></i>
                      {{ formatearHora(entrada.fecha_hora) }}
                    </div>
                    <span *ngIf="registro.entradas.length === 0" class="sin-registro">—</span>
                  </div>
                </td>
                <td class="col-salidas">
                  <div class="tiempos-lista">
                    <div class="tiempo-badge salida" *ngFor="let salida of registro.salidas">
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

    .tabla-container {
      overflow-x: auto;
    }
    
    .tabla-registros {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.9rem;
    }
    
    .tabla-registros thead {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }
    
    .tabla-registros th {
      padding: 12px 10px;
      text-align: left;
      font-weight: 600;
      font-size: 0.85rem;
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
    
    .tabla-registros td {
      padding: 12px 10px;
      vertical-align: middle;
    }
    
    .col-foto {
      width: 70px;
      text-align: center;
    }
    
    .foto-wrapper {
      display: flex;
      justify-content: center;
      align-items: center;
    }
    
    .foto-thumbnail {
      width: 45px;
      height: 45px;
      border-radius: 50%;
      object-fit: cover;
      border: 2px solid #667eea;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    
    .foto-placeholder-small {
      width: 45px;
      height: 45px;
      border-radius: 50%;
      background: #e9ecef;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #adb5bd;
      font-size: 1.5rem;
    }
    
    .col-nombre {
      min-width: 180px;
      color: #2c3e50;
    }
    
    .col-cedula {
      min-width: 110px;
      color: #6c757d;
      font-family: 'Courier New', monospace;
      font-size: 0.85rem;
    }
    
    .col-fecha {
      min-width: 100px;
      color: #495057;
      font-size: 0.85rem;
    }
    
    .col-entradas, .col-salidas {
      min-width: 130px;
    }
    
    .tiempos-lista {
      display: flex;
      flex-direction: column;
      gap: 5px;
    }
    
    .tiempo-badge {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 5px 10px;
      border-radius: 15px;
      font-size: 0.8rem;
      font-weight: 500;
      white-space: nowrap;
    }
    
    .tiempo-badge.entrada {
      background: linear-gradient(135deg, rgba(102, 126, 234, 0.15) 0%, rgba(118, 75, 162, 0.15) 100%);
      color: #5a67d8;
      border: 1px solid rgba(102, 126, 234, 0.3);
    }
    
    .tiempo-badge.salida {
      background: linear-gradient(135deg, rgba(240, 147, 251, 0.15) 0%, rgba(245, 87, 108, 0.15) 100%);
      color: #e53e3e;
      border: 1px solid rgba(245, 87, 108, 0.3);
    }
    
    .tiempo-badge i {
      font-size: 0.9rem;
    }
    
    .sin-registro {
      color: #adb5bd;
      font-style: italic;
      font-size: 0.85rem;
    }
    
    .col-equipo {
      min-width: 120px;
      color: #6c757d;
      font-size: 0.85rem;
    }
  `]
})
export class DashboardAsistenciaComponent implements OnInit {
  estadisticas: EstadisticasAsistencia | null = null;
  registros: RegistroAsistencia[] = [];
  registrosAgrupados: RegistroAgrupado[] = [];
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

    // Cargar últimos 50 registros para poder agrupar
    this.asistenciaService.getRegistros(undefined, undefined, undefined, undefined, undefined, 50, 0).subscribe({
      next: (data) => {
        this.registros = data;
        this.agruparRegistros();
        // Limitar a 10 registros agrupados
        this.registrosAgrupados = this.registrosAgrupados.slice(0, 10);
        this.loading = false;
      },
      error: (error) => {
        console.error('Error al cargar registros:', error);
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

      if (!grupo.foto_url && registro.foto_url) {
        grupo.foto_url = registro.foto_url;
      }
    });

    this.registrosAgrupados = Array.from(grupos.values())
      .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
  }

  formatearHora(fechaHora: string): string {
    const fecha = new Date(fechaHora);
    let horas = fecha.getHours();
    const minutos = fecha.getMinutes().toString().padStart(2, '0');
    const segundos = fecha.getSeconds().toString().padStart(2, '0');
    const ampm = horas >= 12 ? 'PM' : 'AM';
    horas = horas % 12;
    horas = horas ? horas : 12;
    return `${horas}:${minutos}:${segundos} ${ampm}`;
  }
}
