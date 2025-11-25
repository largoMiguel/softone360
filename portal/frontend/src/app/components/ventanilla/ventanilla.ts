import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { EntityContextService } from '../../services/entity-context.service';
import { FormsModule } from '@angular/forms';
import { PqrsService } from '../../services/pqrs.service';
import { AlertService } from '../../services/alert.service';
import { Observable } from 'rxjs';
import { Entity } from '../../models/entity.model';

@Component({
    selector: 'app-ventanilla',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './ventanilla.html',
    styleUrl: './ventanilla.scss'
})
export class VentanillaComponent implements OnInit {
    // Modal states
    mostrarModalConsulta = false;
    mostrarResultadoConsulta = false;

    // Consulta
    numeroRadicado = '';
    pqrsConsultada: any = null;
    isConsulting = false;

    // Entidad actual (si la ruta incluye slug)
    currentEntity$: Observable<Entity | null>;

    constructor(
        private router: Router,
        private route: ActivatedRoute,
        private pqrsService: PqrsService,
        private alertService: AlertService,
        private entityContext: EntityContextService
    ) {
        this.currentEntity$ = this.entityContext.currentEntity$;
    }

    ngOnInit() {
        // Leer query param 'radicado' si existe (desde email)
        this.route.queryParams.subscribe(params => {
            if (params['radicado']) {
                this.numeroRadicado = params['radicado'];
                // Auto-abrir modal y consultar
                this.mostrarModalConsulta = true;
                setTimeout(() => {
                    this.consultarPqrs();
                }, 300);
            }
        });
    }

    navigateToLogin() {
        const slug = this.entityContext.currentEntity?.slug;
        this.router.navigate(slug ? ['/', slug, 'login'] : ['/']);
    }

    navigateToPortalCiudadano() {
        const slug = this.entityContext.currentEntity?.slug;
        this.router.navigate(slug ? ['/', slug, 'portal-ciudadano'] : ['/']);
    }

    navigateToConsulta() {
        if (!this.pqrsEnabled()) {
            this.alertService.warning('El módulo de PQRS está desactivado para esta entidad.', 'Módulo desactivado');
            return;
        }
        this.mostrarModalConsulta = true;
    }

    cerrarModalConsulta() {
        this.mostrarModalConsulta = false;
        this.numeroRadicado = '';
    }

    cerrarResultadoConsulta() {
        this.mostrarResultadoConsulta = false;
        this.pqrsConsultada = null;
        this.numeroRadicado = '';
    }

    consultarPqrs() {
        if (!this.numeroRadicado.trim()) {
            this.alertService.warning('Por favor ingresa un número de radicado válido.', 'Número Requerido');
            return;
        }

        this.isConsulting = true;

        // Usar endpoint público que no requiere autenticación
        this.pqrsService.consultarPqrsByRadicado(this.numeroRadicado.trim()).subscribe({
            next: (pqrs) => {
                this.pqrsConsultada = pqrs;
                this.mostrarModalConsulta = false;
                this.mostrarResultadoConsulta = true;
                this.isConsulting = false;
            },
            error: (error) => {
                // console.error('Error consultando PQRS:', error);
                if (error.status === 404) {
                    this.alertService.warning(
                        `No se encontró ninguna PQRS con el número de radicado: ${this.numeroRadicado}.\n\nVerifica el número e intenta nuevamente.`,
                        'PQRS No Encontrada'
                    );
                } else {
                    this.alertService.error(
                        'No se pudo consultar la PQRS. Por favor, intenta nuevamente más tarde.',
                        'Error en Consulta'
                    );
                }
                this.isConsulting = false;
            }
        });
    }

    getEstadoLabel(estado: string): string {
        const labels: { [key: string]: string } = {
            'pendiente': 'Pendiente',
            'en_proceso': 'En Proceso',
            'resuelto': 'Resuelto',
            'respondido': 'Respondido',
            'cerrado': 'Cerrado'
        };
        return labels[estado] || estado;
    }

    getEstadoColor(estado: string): string {
        const colores: { [key: string]: string } = {
            'pendiente': 'warning',
            'en_proceso': 'info',
            'resuelto': 'success',
            'respondido': 'primary',
            'cerrado': 'dark'
        };
        return colores[estado] || 'secondary';
    }

    getTipoSolicitudLabel(tipo: string): string {
        const tipos: { [key: string]: string } = {
            'peticion': 'Petición',
            'queja': 'Queja',
            'reclamo': 'Reclamo',
            'sugerencia': 'Sugerencia',
            'felicitacion': 'Felicitación',
            'denuncia': 'Denuncia',
            'solicitud_informacion': 'Solicitud de Información',
            'solicitud_datos_personales': 'Solicitud de Datos Personales',
            'agenda_cita': 'Agenda tu Cita'
        };
        return tipos[tipo] || tipo;
    }

    getCanalLlegadaLabel(canal: string): string {
        const canales: { [key: string]: string } = {
            'correo': 'Correo Electrónico',
            'carta': 'Carta',
            'buzon': 'Buzón de Sugerencias',
            'fisica': 'Entrega Física',
            'presencial': 'Presencial',
            'telefono': 'Teléfono',
            'web': 'Portal Web'
        };
        return canales[canal] || canal;
    }

    getMedioRespuestaLabel(medio: string): string {
        const medios: { [key: string]: string } = {
            'email': 'Correo Electrónico',
            'fisica': 'Correspondencia Física',
            'telefono': 'Teléfono',
            'ticket': 'Seguimiento por Ticket'
        };
        return medios[medio] || medio;
    }

    getTipoIdentificacionLabel(tipo: string): string {
        const tipos: { [key: string]: string } = {
            'personal': 'Personal (con identificación)',
            'anonima': 'Anónima'
        };
        return tipos[tipo] || tipo;
    }

    getTipoPersonaLabel(tipo: string): string {
        const tipos: { [key: string]: string } = {
            'natural': 'Persona Natural',
            'juridica': 'Persona Jurídica',
            'nna': 'Niños, Niñas y Adolescentes',
            'apoderado': 'Apoderado'
        };
        return tipos[tipo] || tipo;
    }

    getGeneroLabel(genero: string): string {
        const generos: { [key: string]: string } = {
            'femenino': 'Femenino',
            'masculino': 'Masculino',
            'otro': 'Otro'
        };
        return generos[genero] || genero;
    }

    // Feature flag: PQRS habilitado en la entidad
    pqrsEnabled(): boolean {
        return this.entityContext.currentEntity?.enable_pqrs ?? false;
    }
}
