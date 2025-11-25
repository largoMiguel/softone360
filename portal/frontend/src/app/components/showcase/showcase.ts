import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { EntityService } from '../../services/entity.service';
import { AuthService } from '../../services/auth.service';
import { AlertModalComponent } from './alert-modal/alert-modal.component';

interface Feature {
    icon: string;
    title: string;
    description: string;
    color: string;
}

interface Module {
    name: string;
    icon: string;
    description: string;
    features: string[];
    image: string;
    color: string;
}

interface Stat {
    value: string;
    label: string;
    icon: string;
}

interface Testimonial {
    name: string;
    role: string;
    entity: string;
    message: string;
    avatar: string;
}

@Component({
    selector: 'app-showcase',
    standalone: true,
    imports: [CommonModule, RouterModule, AlertModalComponent],
    templateUrl: './showcase.html',
    styleUrls: ['./showcase.scss']
})
export class ShowcaseComponent implements OnInit {
    features: Feature[] = [
        {
            icon: 'fas fa-cogs',
            title: 'Automatización Inteligente',
            description: 'Automática procesos PQRS con flujos inteligentes y asignación automática.',
            color: '#4e73df'
        },
        {
            icon: 'fas fa-chart-line',
            title: 'Analytics Avanzado',
            description: 'Dashboards en tiempo real con métricas de desempeño y KPIs personalizables.',
            color: '#1cc28e'
        },
        {
            icon: 'fas fa-shield-alt',
            title: 'Seguridad Empresarial',
            description: 'Encriptación end-to-end, autenticación multi-factor y cumplimiento normativo.',
            color: '#36b9cc'
        },
        {
            icon: 'fas fa-users',
            title: 'Gestión de Permisos',
            description: 'Control granular de acceso por roles, entidades y procesos específicos.',
            color: '#858ae3'
        },
        {
            icon: 'fas fa-brain',
            title: 'IA Generativa',
            description: 'Reportes automáticos, análisis predictivo y asistencia en procesos.',
            color: '#f6c23e'
        },
        {
            icon: 'fas fa-mobile-alt',
            title: 'Aplicación Móvil',
            description: 'Acceso desde cualquier dispositivo con sincronización en tiempo real.',
            color: '#e74a3b'
        }
    ];
    
    modules: Module[] = [
        {
            name: 'Plan de Desarrollo Municipal',
            icon: 'fas fa-map',
            description: 'Gestione el PDM de su entidad con seguimiento de actividades, productos y presupuestos. Incluye análisis de cumplimiento y reportes ejecutivos con visualizaciones profesionales.',
            features: ['Actividades y Productos', 'Presupuestos', 'Seguimiento de Indicadores', 'Reportes Automáticos'],
            image: 'fas fa-chart-bar',
            color: '#216ba8'
        },
        {
            name: 'PQRS y Peticiones',
            icon: 'fas fa-envelope',
            description: 'Sistema completo de gestión de Peticiones, Quejas, Reclamos y Sugerencias. Automatización de flujos, notificaciones, y seguimiento integral.',
            features: ['Radicar en Línea', 'Seguimiento', 'Notificaciones', 'Reportes Estadísticos'],
            image: 'fas fa-inbox',
            color: '#1cc28e'
        },
        {
            name: 'Contratación Pública',
            icon: 'fas fa-file-contract',
            description: 'Gestiona procesos de contratación desde la planeación hasta la liquidación. Integración con normativa SECOP II y generación de reportes de cumplimiento.',
            features: ['Planeación de Compras', 'Procesos de Selección', 'Seguimiento de Contratos', 'Auditoría y Compliance'],
            image: 'fas fa-handshake',
            color: '#f6c23e'
        }
    ];
    
    stats: Stat[] = [
        { value: '500+', label: 'Entidades Públicas', icon: 'fas fa-building' },
        { value: '1M+', label: 'PQRS Procesados', icon: 'fas fa-check-circle' },
        { value: '99.9%', label: 'Disponibilidad', icon: 'fas fa-server' }
    ];
    
    testimonials: Testimonial[] = [];
    benefits: any[] = [];
    useCases: any[] = [];
    techStack: any[] = [];
    isLoading = false;
    error: string | null = null;
    
    // Para el selector de entidades
    entities: any[] = [];
    showEntityModal = false;

    // Para el modal de alertas
    showAlert = false;
    alertType: 'error' | 'warning' | 'success' | 'info' = 'error';
    alertTitle = '';
    alertMessage = '';

    constructor(
        private http: HttpClient, 
        private router: Router,
        private entityService: EntityService,
        private authService: AuthService
    ) { }

    ngOnInit(): void {
        // Showcase carga instantáneamente con datos por defecto
        // No depende de la BD
        this.animateOnScroll();
    }

    animateOnScroll(): void {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('animate-in');
                    }
                });
            },
            { threshold: 0.1 }
        );

        // Observar elementos con clase 'animate'
        setTimeout(() => {
            document.querySelectorAll('.animate').forEach((el) => observer.observe(el));
        }, 100);
    }

    scrollToSection(sectionId: string): void {
        const element = document.getElementById(sectionId);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    contactarWhatsApp(mensaje: string = ''): void {
        const telefono = '573102432469'; // Número en formato internacional sin +
        const mensajeDefault = mensaje || 'Hola, me gustaría solicitar una demostración de SoftOne360 para mi entidad.';
        const url = `https://wa.me/${telefono}?text=${encodeURIComponent(mensajeDefault)}`;
        window.open(url, '_blank');
    }

    // Nuevos métodos para los portales de acceso
    irALogin(): void {
        // Si ya hay una sesión activa, redirigir directamente al dashboard
        if (this.authService.isAuthenticated()) {
            const user = this.authService.getCurrentUserValue();
            
            if (user) {
                // Redirigir según el rol del usuario
                if (user.role === 'ciudadano') {
                    // Ciudadano va al portal ciudadano
                    const slug = user.entity?.slug;
                    this.router.navigate(slug ? ['/', slug, 'portal-ciudadano'] : ['/']);
                } else if (user.role === 'superadmin') {
                    // Superadmin va a soft-admin
                    this.router.navigate(['/soft-admin']);
                } else if (user.role === 'admin' || user.role === 'secretario') {
                    // Admin/Secretario va al dashboard
                    const slug = user.entity?.slug;
                    this.router.navigate(slug ? ['/', slug, 'dashboard'] : ['/']);
                }
                return;
            }
        }
        
        // Si no hay sesión activa, ir al login
        this.router.navigate(['/login']);
    }

    abrirSelectorEntidades(): void {
        // Cargar entidades usando el servicio
        this.entityService.getPublicEntities().subscribe({
            next: (entities) => {
                this.entities = entities;
                this.showEntityModal = true;
            },
            error: (error) => {
                console.error('Error cargando entidades:', error);
                
                // Determinar el tipo de error y mostrar modal
                let mensaje = '';
                let tipo: 'error' | 'warning' | 'success' | 'info' = 'error';
                
                if (error.status === 0) {
                    // Error de conexión
                    mensaje = 'El servicio no está disponible en este momento. Por favor, intente más tarde.';
                    tipo = 'error';
                } else if (error.status === 404) {
                    mensaje = 'No hay entidades disponibles.';
                    tipo = 'warning';
                } else if (error.status === 401 || error.status === 403) {
                    mensaje = 'No tienes permisos para acceder a las entidades.';
                    tipo = 'error';
                } else if (error.status >= 500) {
                    mensaje = 'Error en el servidor. Por favor, intente más tarde.';
                    tipo = 'error';
                } else {
                    mensaje = 'Error al cargar las entidades. Por favor, intente nuevamente.';
                    tipo = 'error';
                }
                
                this.mostrarAlerta(tipo, 'Error', mensaje);
            }
        });
    }

    seleccionarEntidad(entity: any): void {
        this.showEntityModal = false;
        this.router.navigate([`/${entity.slug}`]);
    }

    cerrarModal(): void {
        this.showEntityModal = false;
    }

    irATalento(): void {
        // Por el momento no hace nada
        this.mostrarAlerta('info', 'Próximamente', 'Módulo de Talento Humano próximamente');
    }

    mostrarAlerta(tipo: 'error' | 'warning' | 'success' | 'info', title: string, mensaje: string): void {
        this.alertType = tipo;
        this.alertTitle = title;
        this.alertMessage = mensaje;
        this.showAlert = true;
    }

    cerrarAlerta(): void {
        this.showAlert = false;
    }
}
