import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet } from '@angular/router';
import { GlobalNavbarComponent } from './components/layout/global-navbar/global-navbar';
import { SidebarComponent } from './components/layout/sidebar/sidebar.component';
import { SidebarService } from './services/sidebar.service';

@Component({
  selector: 'app-root',
  imports: [CommonModule, RouterOutlet, GlobalNavbarComponent, SidebarComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('pqrs-frontend');
  private router = inject(Router);
  protected sidebar = inject(SidebarService);

  get showGlobalNav() {
    const url = this.router.url;
    // Ocultar en rutas públicas: showcase, login, portal-ciudadano, root de entidad, soft-admin
    if (/^\/(\?|#|$)/.test(url)) return false; // Raíz (showcase/home)
    if (/^\/login(\?|#|$|\/)/i.test(url)) return false; // /login
    if (/^\/showcase(\?|#|$|\/)/i.test(url)) return false; // /showcase
    if (/^\/soft-admin(\?|#|$|\/)/i.test(url)) return false; // /soft-admin
    if (/\/portal-ciudadano(\?|#|$|\/)/i.test(url)) return false; // portal ciudadano
    if (/^\/[\w-]+\/?(\?|#|$)/.test(url)) return false; // /slug (ventanilla raíz)
    return true;
  }
}
