import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
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
export class VentanillaComponent {
    // Modal states
    mostrarModalRadicacion = false;
    mostrarModalConsulta = false;
    mostrarResultadoConsulta = false;

    // Formulario de radicación
    radicacionForm = {
        tipo_solicitud: '',
        cedula_ciudadano: '',
        nombre_ciudadano: '',
        telefono_ciudadano: '',
        email_ciudadano: '',
        direccion_ciudadano: '',
        asunto: '',
        descripcion: ''
    };

    // Consulta
    numeroRadicado = '';
    pqrsConsultada: any = null;
    isSubmitting = false;
    isConsulting = false;

    // Entidad actual (si la ruta incluye slug)
    currentEntity$: Observable<Entity | null>;

    constructor(
        private router: Router,
        private pqrsService: PqrsService,
        private alertService: AlertService,
        private entityContext: EntityContextService
    ) {
        this.currentEntity$ = this.entityContext.currentEntity$;
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

    navigateToRadicacion() {
        if (!this.pqrsEnabled()) {
            this.alertService.warning('El módulo de PQRS está desactivado para esta entidad.', 'Módulo desactivado');
            return;
        }
        this.mostrarModalRadicacion = true;
    }

    cerrarModalRadicacion() {
        this.mostrarModalRadicacion = false;
        this.resetFormularioRadicacion();
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

    resetFormularioRadicacion() {
        this.radicacionForm = {
            tipo_solicitud: '',
            cedula_ciudadano: '',
            nombre_ciudadano: '',
            telefono_ciudadano: '',
            email_ciudadano: '',
            direccion_ciudadano: '',
            asunto: '',
            descripcion: ''
        };
    }

    generarNumeroRadicado(): string {
        // Ya no se genera en frontend. El backend asigna el número secuencial (YYYYMMDDNNN).
        // Esta función se mantiene por compatibilidad pero no se usa.
        return '';
    }

    submitRadicacion() {
        // Validar campos requeridos
        if (!this.radicacionForm.tipo_solicitud || !this.radicacionForm.cedula_ciudadano ||
            !this.radicacionForm.nombre_ciudadano || !this.radicacionForm.asunto ||
            !this.radicacionForm.descripcion) {
            this.alertService.warning('Por favor completa todos los campos obligatorios marcados con *', 'Campos Requeridos');
            return;
        }

        // Validar que hay una entidad actual
        const currentEntity = this.entityContext.currentEntity;
        if (!currentEntity) {
            this.alertService.error('No se pudo determinar la entidad actual', 'Error');
            return;
        }

        this.isSubmitting = true;

        // Construir objeto PQRS con todos los campos requeridos
        const pqrsData: any = {
            tipo_identificacion: 'personal',  // Ventanilla siempre es personal (requiere cédula)
            medio_respuesta: this.radicacionForm.email_ciudadano ? 'email' : 'ticket',  // Email si lo tiene, sino ticket
            tipo_solicitud: this.radicacionForm.tipo_solicitud,
            nombre_ciudadano: this.radicacionForm.nombre_ciudadano,
            cedula_ciudadano: this.radicacionForm.cedula_ciudadano,
            asunto: this.radicacionForm.asunto,
            descripcion: this.radicacionForm.descripcion,
            telefono_ciudadano: this.radicacionForm.telefono_ciudadano || null,
            email_ciudadano: this.radicacionForm.email_ciudadano || null,
            direccion_ciudadano: this.radicacionForm.direccion_ciudadano || null,
            entity_id: currentEntity.id  // Agregar entity_id desde el contexto
        };

        // Convertir strings vacíos a null para campos opcionales
        if (!pqrsData.telefono_ciudadano || pqrsData.telefono_ciudadano.trim() === '') {
            pqrsData.telefono_ciudadano = null;
        }
        if (!pqrsData.email_ciudadano || pqrsData.email_ciudadano.trim() === '') {
            pqrsData.email_ciudadano = null;
        }
        if (!pqrsData.direccion_ciudadano || pqrsData.direccion_ciudadano.trim() === '') {
            pqrsData.direccion_ciudadano = null;
        }

        this.pqrsService.createPqrs(pqrsData).subscribe({
            next: (response) => {
                this.alertService.success(
                    `Tu PQRS ha sido radicada exitosamente.\n\nNúmero de radicado: ${response.numero_radicado}\n\nGuarda este número para consultar el estado de tu solicitud.`,
                    'PQRS Radicada'
                );
                this.cerrarModalRadicacion();
                this.isSubmitting = false;
            },
            error: (error) => {
                // console.error('Error radicando PQRS:', error);
                this.alertService.error(
                    'No se pudo radicar la PQRS. Por favor, intenta nuevamente o contacta con la administración.',
                    'Error al Radicar'
                );
                this.isSubmitting = false;
            }
        });
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

    // Feature flag: PQRS habilitado en la entidad
    pqrsEnabled(): boolean {
        return this.entityContext.currentEntity?.enable_pqrs ?? false;
    }
}
