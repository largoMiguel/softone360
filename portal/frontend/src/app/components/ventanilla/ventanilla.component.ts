import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-ventanilla',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="ventanilla-container">
      <div class="ventanilla-header">
        <h1>
          <i class="bi bi-clock-history"></i>
          Control de Asistencia
        </h1>
        <p>Gestión de funcionarios y registro de asistencia</p>
      </div>

      <div class="ventanilla-nav">
        <a [routerLink]="['./dashboard']" routerLinkActive="active" class="nav-item">
          <i class="bi bi-speedometer2"></i>
          Dashboard
        </a>
        <a [routerLink]="['./funcionarios']" routerLinkActive="active" class="nav-item">
          <i class="bi bi-people"></i>
          Funcionarios
        </a>
        <a [routerLink]="['./registros']" routerLinkActive="active" class="nav-item">
          <i class="bi bi-calendar-check"></i>
          Registros
        </a>
        <a [routerLink]="['./equipos']" routerLinkActive="active" class="nav-item">
          <i class="bi bi-pc-display"></i>
          Equipos
        </a>
      </div>

      <div class="ventanilla-content">
        <router-outlet></router-outlet>
      </div>
    </div>
  `,
  styles: [`
    .ventanilla-container {
      padding: 20px;
    }

    .ventanilla-header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 30px;
      border-radius: 10px;
      margin-bottom: 20px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }

    .ventanilla-header h1 {
      margin: 0;
      font-size: 2rem;
      font-weight: bold;
    }

    .ventanilla-header p {
      margin: 10px 0 0 0;
      opacity: 0.9;
    }

    .ventanilla-nav {
      display: flex;
      gap: 10px;
      margin-bottom: 20px;
      flex-wrap: wrap;
    }

    .nav-item {
      padding: 12px 24px;
      background: white;
      border: 2px solid #e0e0e0;
      border-radius: 8px;
      text-decoration: none;
      color: #333;
      font-weight: 500;
      transition: all 0.3s ease;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .nav-item:hover {
      background: #f5f5f5;
      border-color: #667eea;
      transform: translateY(-2px);
    }

    .nav-item.active {
      background: #667eea;
      color: white;
      border-color: #667eea;
    }

    .ventanilla-content {
      background: white;
      border-radius: 10px;
      padding: 20px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }
  `]
})
export class VentanillaComponent implements OnInit {
  constructor() {}

  ngOnInit(): void {}
}
