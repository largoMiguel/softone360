import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { EntityContextService } from '../../../services/entity-context.service';
import { AuthService } from '../../../services/auth.service';

interface Persona {
    id: number;
    nombres_apellidos: string;
    cargo: string;
    dependencia: string;
}

interface SolicitudCDP {
    id: number;
    numero_cdp?: string;
    fecha_solicitud: string;
    // Tipo de gasto
    tipo_gasto: 'funcionamiento' | 'inversion';
    sector?: string;
    programa_mga?: string;
    // Quien solicita
    quien_solicita_id: number;
    quien_solicita?: Persona;
    // Dependencia que sugiere
    dependencia_sugiere_id: number;
    dependencia_sugiere?: Persona;
    // Solicitud dirigida a
    solicitud_dirigida_id: number;
    solicitud_dirigida?: Persona;
    // Valores
    valor_numeros: number;
    valor_letras: string;
    fuentes_financiacion: string;
    // Producto MGA
    codigo_producto_mga: string;
    producto_mga: string;
    // Objeto contractual
    objeto_contractual: string;
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
    
    // Listas desplegables
    personasDisponibles: Persona[] = [];
    
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
        // Cargar personas disponibles
        this.personasDisponibles = [
            { id: 1, nombres_apellidos: 'HERNAN ALONSO ACOSTA MEDINA', cargo: 'ALCALDE MUNICIPAL', dependencia: 'DESPACHO ALCALDE' },
            { id: 2, nombres_apellidos: 'FREDY ALBERTO LA ROTTA ESPITIA', cargo: 'JEFE OFICINA ASESORA DE PLANEACIÓN', dependencia: 'OFICINA ASESORA DE PLANEACIÓN' },
            { id: 3, nombres_apellidos: 'JULY MARCELA BUITARGO RODRIGUEZ', cargo: 'TESORERA GENERAL', dependencia: 'TESORERÍA GENERAL' },
            { id: 4, nombres_apellidos: 'JUAN PÉREZ', cargo: 'DIRECTOR', dependencia: 'SECRETARÍA DE HACIENDA' }
        ];
        
        // Aquí se cargarían desde el backend
        // Por ahora datos de ejemplo
        this.solicitudes = [
            {
                id: 1,
                numero_cdp: 'CDP-2026-001',
                fecha_solicitud: '2026-01-10',
                tipo_gasto: 'inversion',
                sector: 'Desarrollo Social',
                programa_mga: 'Programa de Inversión',
                quien_solicita_id: 1,
                quien_solicita: this.personasDisponibles[0],
                dependencia_sugiere_id: 2,
                dependencia_sugiere: this.personasDisponibles[1],
                solicitud_dirigida_id: 3,
                solicitud_dirigida: this.personasDisponibles[2],
                valor_numeros: 5000000,
                valor_letras: 'CINCO MILLONES DE PESOS M/CTE',
                fuentes_financiacion: 'Recursos propios',
                codigo_producto_mga: '1702014',
                producto_mga: 'Fortalecimiento institucional',
                objeto_contractual: 'Compra de equipos de cómputo para la alcaldía',
                estado: 'pendiente',
                fecha_creacion: '2026-01-10T10:30:00'
            },
            {
                id: 2,
                numero_cdp: 'CDP-2026-002',
                fecha_solicitud: '2026-01-11',
                tipo_gasto: 'funcionamiento',
                quien_solicita_id: 2,
                quien_solicita: this.personasDisponibles[1],
                dependencia_sugiere_id: 1,
                dependencia_sugiere: this.personasDisponibles[0],
                solicitud_dirigida_id: 3,
                solicitud_dirigida: this.personasDisponibles[2],
                valor_numeros: 3500000,
                valor_letras: 'TRES MILLONES QUINIENTOS MIL PESOS M/CTE',
                fuentes_financiacion: 'SGP',
                codigo_producto_mga: '',
                producto_mga: '',
                objeto_contractual: 'Material de oficina',
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
                s.quien_solicita?.nombres_apellidos.toLowerCase().includes(term) ||
                s.objeto_contractual.toLowerCase().includes(term) ||
                s.codigo_producto_mga.toLowerCase().includes(term)
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
            tipo_gasto: 'funcionamiento',
            valor_numeros: 0,
            valor_letras: '',
            fuentes_financiacion: '',
            codigo_producto_mga: '',
            producto_mga: '',
            objeto_contractual: '',
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

    numeroALetras(num: number): string {
        const unidades = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
        const decenas = ['', '', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
        const especiales = ['DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE'];
        const centenas = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

        if (num === 0) return 'CERO PESOS M/CTE';
        if (num === 100) return 'CIEN PESOS M/CTE';

        let letras = '';

        // Millones
        if (num >= 1000000) {
            const millones = Math.floor(num / 1000000);
            if (millones === 1) {
                letras += 'UN MILLÓN ';
            } else {
                letras += this.convertirGrupo(millones) + ' MILLONES ';
            }
            num %= 1000000;
        }

        // Miles
        if (num >= 1000) {
            const miles = Math.floor(num / 1000);
            if (miles === 1) {
                letras += 'MIL ';
            } else {
                letras += this.convertirGrupo(miles) + ' MIL ';
            }
            num %= 1000;
        }

        // Centenas
        if (num > 0) {
            letras += this.convertirGrupo(num);
        }

        return (letras.trim() + ' PESOS M/CTE').trim();
    }

    private convertirGrupo(num: number): string {
        const unidades = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
        const decenas = ['', '', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
        const especiales = ['DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE'];
        const centenas = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

        let resultado = '';

        const c = Math.floor(num / 100);
        const d = Math.floor((num % 100) / 10);
        const u = num % 10;

        if (c > 0) {
            if (num === 100) {
                resultado += 'CIEN';
            } else {
                resultado += centenas[c];
            }
        }

        if (d === 1) {
            resultado += (resultado ? ' ' : '') + especiales[u];
        } else {
            if (d > 0) {
                resultado += (resultado ? ' ' : '') + decenas[d];
            }
            if (u > 0) {
                resultado += (resultado && d > 0 ? ' Y ' : resultado ? ' ' : '') + unidades[u];
            }
        }

        return resultado;
    }

    onValorChange() {
        if (this.currentSolicitud.valor_numeros && this.currentSolicitud.valor_numeros > 0) {
            this.currentSolicitud.valor_letras = this.numeroALetras(this.currentSolicitud.valor_numeros);
        } else {
            this.currentSolicitud.valor_letras = '';
        }
    }

    getPersonaNombre(id: number): string {
        const persona = this.personasDisponibles.find(p => p.id === id);
        return persona ? persona.nombres_apellidos : '';
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
