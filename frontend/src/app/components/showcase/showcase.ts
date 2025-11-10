import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

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
    imports: [CommonModule, RouterModule],
    templateUrl: './showcase.html',
    styleUrls: ['./showcase.scss']
})
export class ShowcaseComponent implements OnInit {
    features: Feature[] = [];
    modules: Module[] = [];
    stats: Stat[] = [];
    testimonials: Testimonial[] = [];
    benefits: any[] = [];
    useCases: any[] = [];
    techStack: any[] = [];
    isLoading = true;
    error: string | null = null;

    constructor(private http: HttpClient) { }

    ngOnInit(): void {
        this.loadShowcaseData();
    }

    loadShowcaseData(): void {
        const apiUrl = `${environment.apiUrl}/showcase`;
        this.http.get(apiUrl).subscribe({
            next: (data: any) => {
                this.features = data.features || [];
                this.modules = data.modules || [];
                this.stats = data.stats || [];
                this.testimonials = data.testimonials || [];
                this.benefits = data.benefits || [];
                this.useCases = data.useCases || [];
                this.techStack = data.techStack || [];
                this.isLoading = false;
                // Animaciones de entrada después de cargar
                this.animateOnScroll();
            },
            error: (error) => {
                console.error('Error cargando showcase:', error);
                this.error = 'Error al cargar la información del showcase';
                this.isLoading = false;
            }
        });
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
}
