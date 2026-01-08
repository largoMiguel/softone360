import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { User } from '../../../models/user.model';

@Component({
    selector: 'app-talento-humano-layout',
    standalone: true,
    imports: [CommonModule, RouterModule],
    templateUrl: './talento-humano-layout.component.html',
    styleUrls: ['./talento-humano-layout.component.scss']
})
export class TalentoHumanoLayoutComponent implements OnInit {
    currentUser: User | null = null;
    entityName: string = '';
    activeTab: string = 'dashboard';

    constructor(
        private authService: AuthService,
        private router: Router
    ) {}

    ngOnInit() {
        this.currentUser = this.authService.getCurrentUserValue();
        if (this.currentUser?.entity) {
            this.entityName = this.currentUser.entity.name;
        }
        
        // Detectar tab activo basado en la URL
        this.detectActiveTab();
    }

    detectActiveTab() {
        const url = this.router.url;
        if (url.includes('/funcionarios')) {
            this.activeTab = 'funcionarios';
        } else if (url.includes('/registros')) {
            this.activeTab = 'registros';
        } else if (url.includes('/equipos')) {
            this.activeTab = 'equipos';
        } else {
            this.activeTab = 'dashboard';
        }
    }

    navigateTo(path: string) {
        this.activeTab = path;
        this.router.navigate(['/talento-humano', path]);
    }

    cerrarSesion() {
        this.authService.logout();
        this.router.navigate(['/asistencia-login']);
    }

    isAdmin(): boolean {
        return this.currentUser?.role === 'admin' || this.currentUser?.role === 'superadmin';
    }
}
