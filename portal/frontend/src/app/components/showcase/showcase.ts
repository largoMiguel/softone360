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

interface Capability {
    icon: string;
    title: string;
    desc: string;
    gradient: string;
}

interface Module {
    name: string;
    icon: string;
    description: string;
    features: string[];
    image: string;
    color: string;
    capabilities?: Capability[];
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
            icon: 'fas fa-map-marked-alt',
            title: 'PDM 360° Inteligente',
            description: 'Seguimiento completo del Plan de Desarrollo Municipal: líneas estratégicas, productos, actividades, indicadores y ejecución presupuestal en un solo lugar.',
            color: '#216ba8'
        },
        {
            icon: 'fas fa-brain',
            title: 'IA Generativa con OpenAI',
            description: 'Generación automática de informes ejecutivos con análisis narrativo, análisis de cumplimiento predictivo y asistencia inteligente en la toma de decisiones.',
            color: '#7c3aed'
        },
        {
            icon: 'fas fa-chart-line',
            title: 'Analytics en Tiempo Real',
            description: 'Dashboards interactivos con Chart.js, KPIs personalizables, comparativas presupuestales multi-año y visualizaciones profesionales para rendición de cuentas.',
            color: '#1cc28e'
        },
        {
            icon: 'fas fa-shield-alt',
            title: 'Seguridad Empresarial',
            description: 'JWT con refresh tokens, cifrado en tránsito y reposo, autenticación por roles granular, rate limiting, auditoría de accesos y cumplimiento GDPR.',
            color: '#e74a3b'
        },
        {
            icon: 'fas fa-cloud-upload-alt',
            title: 'Almacenamiento AWS S3',
            description: 'Evidencias fotográficas, documentos y archivos Excel almacenados en S3 con URLs firmadas, políticas de bucket y control de acceso por entidad.',
            color: '#ff9900'
        },
        {
            icon: 'fas fa-envelope-open-text',
            title: 'Notificaciones AWS SES',
            description: 'Correos transaccionales automáticos para PQRS, correspondencia y alertas del sistema a través de Amazon Simple Email Service con plantillas HTML.',
            color: '#36b9cc'
        },
        {
            icon: 'fas fa-file-pdf',
            title: 'Informes PDF Automáticos',
            description: 'Generación asíncrona de informes en PDF con ReportLab: informes ejecutivos, reportes de ejecución presupuestal, contratos RPS y análisis por secretaría.',
            color: '#e74a3b'
        },
        {
            icon: 'fas fa-database',
            title: 'Caché Redis & Optimización',
            description: 'Sistema de caché con Redis para consultas frecuentes, optimización de queries con SQLAlchemy, paginación y carga diferida para máximo rendimiento.',
            color: '#dc143c'
        },
        {
            icon: 'fas fa-users-cog',
            title: 'Gestión Multiusuario',
            description: 'Roles diferenciados: Superadmin, Admin, Secretario y Ciudadano. Control de acceso por secretaría, entidad y módulo con trazabilidad completa.',
            color: '#858ae3'
        }
    ];
    
    modules: Module[] = [
        {
            name: 'Plan de Desarrollo Municipal (PDM)',
            icon: 'fas fa-map-marked-alt',
            description: 'El corazón del sistema. Gestión integral del PDM con estructura de Líneas Estratégicas → Sectores → Programas → Productos → Actividades. Ejecución presupuestal, contratos RPS, integración BPIN, evidencias fotográficas e informes con IA.',
            features: [
                'Líneas estratégicas, sectores y programas',
                'Productos e indicadores por año (2024–2027)',
                'Actividades con responsable por secretaría',
                'Ejecución presupuestal desde Excel (.xlsx)',
                'Contratos RPS cargados desde archivo',
                'Integración BPIN – datos.gov.co en tiempo real',
                'Evidencias fotográficas en AWS S3',
                'Informes PDF ejecutivos con IA generativa',
                'Dashboard interactivo con Chart.js',
                'Filtros por línea, sector, ODS, secretaría y año'
            ],
            image: 'fas fa-project-diagram',
            color: '#216ba8',
            capabilities: [
                { icon: 'fas fa-sitemap', title: 'Estructura Jerárquica', desc: '5 niveles: Líneas → Sectores → Programas → Productos → Actividades con indicadores.', gradient: 'linear-gradient(135deg,#216ba8,#36b9cc)' },
                { icon: 'fas fa-brain', title: 'IA Generativa OpenAI', desc: 'Informes ejecutivos con narrativa automática, análisis de brechas y logros con GPT-4.', gradient: 'linear-gradient(135deg,#7c3aed,#a855f7)' },
                { icon: 'fas fa-file-pdf', title: 'Informes PDF Asíncronos', desc: 'ReportLab + Matplotlib. Filtros por secretaría, año, estado y ODS incluidos.', gradient: 'linear-gradient(135deg,#e74a3b,#dc2626)' }
            ]
        },
        {
            name: 'PQRS y Peticiones Ciudadanas',
            icon: 'fas fa-comments',
            description: 'Sistema completo de Peticiones, Quejas, Reclamos y Sugerencias con portal ciudadano. Radicación personal y anónima, asignación a funcionarios, seguimiento en tiempo real y notificaciones automáticas vía AWS SES.',
            features: [
                'Radicación personal y anónima',
                'Portal Ventanilla Única Ciudadana',
                'Numeración automática de radicado',
                'Asignación a secretarías y funcionarios',
                'Seguimiento en tiempo real del trámite',
                'Notificaciones automáticas AWS SES',
                'Reportes estadísticos por tipo y estado',
                'Auditoría completa de asignaciones'
            ],
            image: 'fas fa-inbox',
            color: '#1cc28e',
            capabilities: [
                { icon: 'fas fa-inbox', title: 'Radicación Inteligente', desc: 'Personal y anónima con numeración única automática por entidad y período.', gradient: 'linear-gradient(135deg,#1cc28e,#059669)' },
                { icon: 'fas fa-bell', title: 'Notificaciones AWS SES', desc: 'Alertas automáticas al ciudadano en cada cambio de estado del trámite.', gradient: 'linear-gradient(135deg,#36b9cc,#0891b2)' },
                { icon: 'fas fa-chart-pie', title: 'Dashboard Estadístico', desc: 'Análisis en tiempo real por tipo, estado, funcionario y período de gestión.', gradient: 'linear-gradient(135deg,#f6c23e,#d97706)' }
            ]
        },
        {
            name: 'Planes Institucionales',
            icon: 'fas fa-sitemap',
            description: 'Gestión de planes institucionales con componentes, procesos y actividades. Control de ejecución por secretaría, seguimiento de avances y cumplimiento de metas con reportes automatizados.',
            features: [
                'Planes con componentes y procesos',
                'Actividades con responsable por secretaría',
                'Ejecución y seguimiento de avances',
                'Estados: pendiente / en progreso / completado',
                'Reportes de cumplimiento institucional',
                'Control granular por secretaría'
            ],
            image: 'fas fa-tasks',
            color: '#f6c23e',
            capabilities: [
                { icon: 'fas fa-layer-group', title: 'Estructura Modular', desc: 'Plan → Componente → Proceso → Actividad con estados, fechas y responsables.', gradient: 'linear-gradient(135deg,#f6c23e,#d97706)' },
                { icon: 'fas fa-user-tie', title: 'Control por Secretaría', desc: 'Cada secretaría gestiona y actualiza sus actividades con permisos granulares.', gradient: 'linear-gradient(135deg,#216ba8,#2563eb)' },
                { icon: 'fas fa-chart-bar', title: 'Reportes de Cumplimiento', desc: 'Avance por componente, período y secretaría para rendición de cuentas.', gradient: 'linear-gradient(135deg,#1cc28e,#059669)' }
            ]
        },
        {
            name: 'Contratación Pública',
            icon: 'fas fa-file-contract',
            description: 'Consulta y análisis de contratación pública con integración directa a datos.gov.co. SECOP I y SECOP II en tiempo real, con análisis inteligente asistido por IA para contratos, valores y contratistas.',
            features: [
                'Integración SECOP I – datos.gov.co',
                'Integración SECOP II – datos.gov.co',
                'Consulta de procesos y contratos',
                'Análisis con IA OpenAI',
                'Caché Redis para consultas rápidas',
                'Búsqueda por entidad, contratista y valor'
            ],
            image: 'fas fa-handshake',
            color: '#e74a3b',
            capabilities: [
                { icon: 'fas fa-database', title: 'SECOP I & II en Vivo', desc: 'Integración directa con datos.gov.co. Contratos y procesos actualizados en tiempo real.', gradient: 'linear-gradient(135deg,#e74a3b,#dc2626)' },
                { icon: 'fas fa-brain', title: 'Análisis IA OpenAI', desc: 'Revisión inteligente de contratos, cuantías, contratistas y objetos contractuales.', gradient: 'linear-gradient(135deg,#7c3aed,#a855f7)' },
                { icon: 'fas fa-tachometer-alt', title: 'Caché Redis', desc: 'Consultas ultra-rápidas con caché inteligente Redis y rate limiting por usuario.', gradient: 'linear-gradient(135deg,#dc143c,#b91c1c)' }
            ]
        },
        {
            name: 'Correspondencia Oficial',
            icon: 'fas fa-mail-bulk',
            description: 'Módulo de gestión documental para correspondencia oficial. Radicación física o por correo electrónico, numeración automática, seguimiento de estado y control de tiempos de respuesta.',
            features: [
                'Radicación física y electrónica',
                'Numeración automática de radicado',
                'Seguimiento de estado del trámite',
                'Asignación a dependencias',
                'Control de tiempos de respuesta',
                'Historial completo por entidad'
            ],
            image: 'fas fa-envelope-open-text',
            color: '#858ae3',
            capabilities: [
                { icon: 'fas fa-barcode', title: 'Radicado Automático', desc: 'Numeración única CORR-YYYY-XXXXX generada automáticamente por entidad.', gradient: 'linear-gradient(135deg,#858ae3,#6366f1)' },
                { icon: 'fas fa-clock', title: 'Control de Tiempos', desc: 'Seguimiento de plazos con alertas por vencimiento de términos de respuesta.', gradient: 'linear-gradient(135deg,#f6c23e,#d97706)' },
                { icon: 'fas fa-history', title: 'Historial Trazable', desc: 'Auditoría completa de estados, asignaciones, fechas y responsables por radicado.', gradient: 'linear-gradient(135deg,#36b9cc,#0891b2)' }
            ]
        },
        {
            name: 'Control de Asistencia',
            icon: 'fas fa-user-clock',
            description: 'Control de asistencia del talento humano con registro fotográfico en tiempo real. Captura de imagen, almacenamiento en AWS S3, estadísticas y validación por equipo de registro.',
            features: [
                'Registro con foto en tiempo real',
                'Almacenamiento de fotos en AWS S3',
                'Registro de entrada y salida',
                'Estadísticas diarias y mensuales',
                'Validación por equipo de registro',
                'Panel de administración de funcionarios'
            ],
            image: 'fas fa-user-check',
            color: '#36b9cc',
            capabilities: [
                { icon: 'fas fa-camera', title: 'Foto en Tiempo Real', desc: 'Captura fotográfica al momento del registro de entrada o salida del personal.', gradient: 'linear-gradient(135deg,#36b9cc,#0891b2)' },
                { icon: 'fab fa-aws', title: 'Almacenamiento S3', desc: 'Fotos indexadas por fecha en AWS S3 con acceso controlado por política de bucket.', gradient: 'linear-gradient(135deg,#ff9900,#ea580c)' },
                { icon: 'fas fa-chart-bar', title: 'Estadísticas y Reportes', desc: 'Reportes de asistencia diaria, mensual y por funcionario desde el panel admin.', gradient: 'linear-gradient(135deg,#1cc28e,#059669)' }
            ]
        }
    ];
    
    stats: Stat[] = [
        { value: '6', label: 'Módulos Integrados', icon: 'fas fa-cubes' },
        { value: '360°', label: 'Gestión Pública Total', icon: 'fas fa-sync-alt' },
        { value: '99.9%', label: 'Disponibilidad AWS', icon: 'fas fa-server' },
        { value: 'IA', label: 'OpenAI Integrado', icon: 'fas fa-brain' }
    ];
    
    testimonials: Testimonial[] = [];

    benefits: any[] = [
        {
            icon: 'fas fa-rocket',
            title: 'Despliegue en la Nube',
            description: 'Infraestructura 100% en AWS: Elastic Beanstalk para el backend, S3 + CloudFront para el frontend y RDS PostgreSQL para los datos. Alta disponibilidad garantizada.'
        },
        {
            icon: 'fas fa-brain',
            title: 'IA en cada Módulo',
            description: 'Integración nativa con OpenAI GPT para generación de informes narrativos, análisis de contratos y asistencia en la gestión del PDM y planes institucionales.'
        },
        {
            icon: 'fas fa-shield-alt',
            title: 'Seguridad de Nivel Empresarial',
            description: 'Autenticación JWT, rate limiting con SlowAPI, CORS configurado, auditoría de accesos y almacenamiento cifrado. Cumplimiento con estándares de seguridad del sector público.'
        },
        {
            icon: 'fas fa-chart-bar',
            title: 'Reportes Ejecutivos Automáticos',
            description: 'Generación asíncrona de informes PDF con ReportLab y Matplotlib. Comparativas presupuestales multi-año, mapas de calor y visualizaciones de cumplimiento.'
        },
        {
            icon: 'fas fa-building',
            title: 'Multi-Entidad y Multi-Rol',
            description: 'Una sola plataforma para múltiples entidades. Cada entidad tiene su propio portal, datos aislados, roles diferenciados y personalización de logo y nombre.'
        },
        {
            icon: 'fas fa-bolt',
            title: 'Alto Rendimiento',
            description: 'Caché Redis para datos frecuentes, queries optimizadas con SQLAlchemy, paginación eficiente y carga diferida. Respuestas en milisegundos incluso con grandes volúmenes.'
        }
    ];

    useCases: any[] = [
        {
            icon: 'fas fa-city',
            title: 'Alcaldías Municipales',
            description: 'Gestión del PDM cuatrienal, PQRS ciudadanas, contratación pública y correspondencia oficial. Todo integrado en una sola plataforma para la administración municipal.',
            metrics: [
                'PDM con seguimiento 2024–2027',
                'PQRS con portal ciudadano',
                'Contratación SECOP I y II',
                'Informes para rendición de cuentas'
            ]
        },
        {
            icon: 'fas fa-landmark',
            title: 'Gobernaciones y Departamentos',
            description: 'Control de múltiples entidades, planes de desarrollo departamental, gestión de correspondencia masiva y reportes consolidados para órganos de control.',
            metrics: [
                'Gestión multi-secretaría',
                'Planes institucionales por dependencia',
                'Correspondencia oficial centralizada',
                'Control de asistencia del talento humano'
            ]
        },
        {
            icon: 'fas fa-hospital',
            title: 'Entidades Descentralizadas',
            description: 'ESEs, UMATAS, Personerías y demás entidades descentralizadas que requieren gestión de PQRS, correspondencia y cumplimiento de planes institucionales.',
            metrics: [
                'Portal ciudadano propio',
                'Planes institucionales específicos',
                'Notificaciones automáticas por email',
                'Dashboard de seguimiento en tiempo real'
            ]
        }
    ];

    techStack: any[] = [
        { name: 'Angular 20', icon: 'fab fa-angular', color: '#dd0031' },
        { name: 'TypeScript', icon: 'fab fa-js', color: '#3178c6' },
        { name: 'FastAPI', icon: 'fas fa-bolt', color: '#009688' },
        { name: 'Python', icon: 'fab fa-python', color: '#3776ab' },
        { name: 'PostgreSQL', icon: 'fas fa-database', color: '#336791' },
        { name: 'AWS S3', icon: 'fab fa-aws', color: '#ff9900' },
        { name: 'AWS SES', icon: 'fas fa-envelope', color: '#ff9900' },
        { name: 'OpenAI', icon: 'fas fa-brain', color: '#10a37f' },
        { name: 'Redis', icon: 'fas fa-memory', color: '#dc143c' },
        { name: 'Bootstrap 5', icon: 'fab fa-bootstrap', color: '#7952b3' },
        { name: 'Chart.js', icon: 'fas fa-chart-pie', color: '#ff6384' },
        { name: 'ReportLab', icon: 'fas fa-file-pdf', color: '#e74a3b' }
    ];
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
        // Redirigir directamente al login de Control de Asistencia
        this.router.navigate(['/asistencia-login']);
    }

    irAGestionDocumental(): void {
        // Gestión Documental es parte del portal administrativo
        if (this.authService.isAuthenticated()) {
            this.irALogin();
        } else {
            this.router.navigate(['/login']);
        }
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
