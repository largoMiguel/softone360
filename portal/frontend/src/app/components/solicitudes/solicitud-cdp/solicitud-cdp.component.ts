import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { EntityContextService } from '../../../services/entity-context.service';
import { AuthService } from '../../../services/auth.service';

interface SolicitudCDP {
    id: number;
    numero_cdp?: string;
    fecha_solicitud: string;
    solicitante: string;
    dependencia: string;
    rubro_presupuestal: string;
    valor: number;
    descripcion: string;
    estado: 'pendiente' | 'aprobado' | 'rechazado';
    observaciones?: string;
    fecha_creacion: string;
}

@Component({
    selector: 'app-solicitud-cdp',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './solicitud-cdp.component.html',
    styleUrls: ['./solicitud-cdp.component.scss']
})
export class SolicitudCDPComponent implements OnInit {
    private router = inject(Router);
    private entityContext = inject(EntityContextService);
    private authService = inject(AuthService);

    Math = Math; // Exponer Math al template

    solicitudes: SolicitudCDP[] = [];
    filteredSolicitudes: SolicitudCDP[] = [];
    
    // Modal
    showModal = false;
    isEditMode = false;
    currentSolicitud: Partial<SolicitudCDP> = {};
    
    // Filtros
    searchTerm = '';
    filterEstado: string = 'todos';
    
    // Paginación
    currentPage = 1;
    itemsPerPage = 10;
    totalPages = 1;

    ngOnInit() {
        this.loadSolicitudes();
    }

    loadSolicitudes() {
        // Aquí se cargarían desde el backend
        // Por ahora datos de ejemplo
        this.solicitudes = [
            {
                id: 1,
                numero_cdp: 'CDP-2026-001',
                fecha_solicitud: '2026-01-10',
                solicitante: 'Juan Pérez',
                dependencia: 'Secretaría de Hacienda',
                rubro_presupuestal: '2.3.1.01.001',
                valor: 5000000,
                descripcion: 'Compra de equipos de cómputo',
                estado: 'pendiente',
                fecha_creacion: '2026-01-10T10:30:00'
            },
            {
                id: 2,
                numero_cdp: 'CDP-2026-002',
                fecha_solicitud: '2026-01-11',
                solicitante: 'María García',
                dependencia: 'Secretaría de Educación',
                rubro_presupuestal: '2.1.2.03.002',
                valor: 3500000,
                descripcion: 'Material pedagógico',
                estado: 'aprobado',
                fecha_creacion: '2026-01-11T14:20:00'
            }
        ];
        
        this.applyFilters();
    }

    applyFilters() {
        let filtered = [...this.solicitudes];
        
        // Filtro por búsqueda
        if (this.searchTerm) {
            const term = this.searchTerm.toLowerCase();
            filtered = filtered.filter(s => 
                s.numero_cdp?.toLowerCase().includes(term) ||
                s.solicitante.toLowerCase().includes(term) ||
                s.dependencia.toLowerCase().includes(term) ||
                s.descripcion.toLowerCase().includes(term)
            );
        }
        
        // Filtro por estado
        if (this.filterEstado !== 'todos') {
            filtered = filtered.filter(s => s.estado === this.filterEstado);
        }
        
        this.filteredSolicitudes = filtered;
        this.totalPages = Math.ceil(filtered.length / this.itemsPerPage);
        this.currentPage = 1;
    }

    get paginatedSolicitudes(): SolicitudCDP[] {
        const start = (this.currentPage - 1) * this.itemsPerPage;
        const end = start + this.itemsPerPage;
        return this.filteredSolicitudes.slice(start, end);
    }

    openCreateModal() {
        this.isEditMode = false;
        this.currentSolicitud = {
            fecha_solicitud: new Date().toISOString().split('T')[0],
            estado: 'pendiente'
        };
        this.showModal = true;
    }

    openEditModal(solicitud: SolicitudCDP) {
        this.isEditMode = true;
        this.currentSolicitud = { ...solicitud };
        this.showModal = true;
    }

    closeModal() {
        this.showModal = false;
        this.currentSolicitud = {};
    }

    saveSolicitud() {
        if (this.isEditMode) {
            // Actualizar
            const index = this.solicitudes.findIndex(s => s.id === this.currentSolicitud.id);
            if (index !== -1) {
                this.solicitudes[index] = { ...this.currentSolicitud } as SolicitudCDP;
            }
        } else {
            // Crear nueva
            const newSolicitud: SolicitudCDP = {
                ...this.currentSolicitud,
                id: this.solicitudes.length + 1,
                numero_cdp: `CDP-2026-${String(this.solicitudes.length + 1).padStart(3, '0')}`,
                fecha_creacion: new Date().toISOString()
            } as SolicitudCDP;
            this.solicitudes.unshift(newSolicitud);
        }
        
        this.applyFilters();
        this.closeModal();
    }

    deleteSolicitud(id: number) {
        if (confirm('¿Está seguro de eliminar esta solicitud?')) {
            this.solicitudes = this.solicitudes.filter(s => s.id !== id);
            this.applyFilters();
        }
    }

    getEstadoBadgeClass(estado: string): string {
        const classes: { [key: string]: string } = {
            'pendiente': 'badge-warning',
            'aprobado': 'badge-success',
            'rechazado': 'badge-danger'
        };
        return classes[estado] || 'badge-secondary';
    }

    formatCurrency(value: number): string {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0
        }).format(value);
    }

    nextPage() {
        if (this.currentPage < this.totalPages) {
            this.currentPage++;
        }
    }

    prevPage() {
        if (this.currentPage > 1) {
            this.currentPage--;
        }
    }
}
