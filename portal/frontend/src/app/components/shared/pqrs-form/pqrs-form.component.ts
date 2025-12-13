import { Component, OnInit, Output, EventEmitter, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { PqrsService } from '../../../services/pqrs.service';
import { AlertService } from '../../../services/alert.service';
import { User } from '../../../models/user.model';
import { Entity } from '../../../models/entity.model';

@Component({
    selector: 'app-pqrs-form',
    standalone: true,
    imports: [CommonModule, FormsModule, ReactiveFormsModule],
    templateUrl: './pqrs-form.component.html',
    styleUrls: ['./pqrs-form.component.scss']
})
export class PqrsFormComponent implements OnInit {
    @Input() currentUser: User | null = null;
    @Input() currentEntity: Entity | null = null;
    @Input() ocultarPaso1 = false; // Para portal ciudadano
    @Output() pqrsCreated = new EventEmitter<any>();
    @Output() cancelled = new EventEmitter<void>();

    // Pasos del formulario
    pasoActual = 1;
    totalPasos = 5;

    // Datos del formulario
    nuevaPqrs: any = {
        tipo_pqrs: 'peticion',
        asunto: '',
        descripcion: '',
        tipo_identificacion: 'personal',
        tipo_persona: 'natural',
        nombre_ciudadano: '',
        cedula_ciudadano: '',
        email_ciudadano: '',
        telefono_ciudadano: '',
        direccion_ciudadano: '',
        genero: 'otro',
        medio_respuesta: 'email',
        direccion_respuesta: '',
        telefono_respuesta: '',
        tipo_solicitud: 'peticion',
        canal_llegada: 'web',
        dias_respuesta: 15
    };

    archivoAdjunto: File | null = null;
    MAX_FILE_SIZE_MB = 10;
    MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
    isSubmitting = false;

    // Opciones para selects y cards
    canalesLlegada = [
        { value: 'web', label: 'Web/Portal', icon: 'fas fa-globe' },
        { value: 'presencial', label: 'Presencial', icon: 'fas fa-building' },
        { value: 'telefono', label: 'Teléfono', icon: 'fas fa-phone' },
        { value: 'correo', label: 'Correo Postal', icon: 'fas fa-envelope' },
        { value: 'whatsapp', label: 'WhatsApp', icon: 'fab fa-whatsapp' },
        { value: 'redes_sociales', label: 'Redes Sociales', icon: 'fas fa-share-alt' }
    ];

    tiposSolicitud = [
        { value: 'peticion', label: 'Petición', descripcion: 'Solicitud respetuosa para obtener información o respuesta' },
        { value: 'queja', label: 'Queja', descripcion: 'Manifestación de protesta, descontento o inconformidad' },
        { value: 'reclamo', label: 'Reclamo', descripcion: 'Exigencia por incumplimiento o mala prestación del servicio' },
        { value: 'sugerencia', label: 'Sugerencia', descripcion: 'Propuesta para mejorar el servicio o proceso' },
        { value: 'felicitacion', label: 'Felicitación', descripcion: 'Reconocimiento a la buena gestión o atención' },
        { value: 'denuncia', label: 'Denuncia', descripcion: 'Poner en conocimiento una conducta irregular o ilegal' }
    ];

    tiposPqrs = [
        { value: 'peticion', label: 'Petición' },
        { value: 'queja', label: 'Queja' },
        { value: 'reclamo', label: 'Reclamo' },
        { value: 'sugerencia', label: 'Sugerencia' },
        { value: 'felicitacion', label: 'Felicitación' },
        { value: 'denuncia', label: 'Denuncia' }
    ];

    tiposPersona = [
        { value: 'natural', label: 'Persona Natural' },
        { value: 'juridica', label: 'Persona Jurídica' },
        { value: 'nna', label: 'Niños, Niñas y Adolescentes' },
        { value: 'apoderado', label: 'Apoderado' }
    ];

    generos = [
        { value: 'femenino', label: 'Femenino' },
        { value: 'masculino', label: 'Masculino' },
        { value: 'otro', label: 'Otro/Prefiero no decir' }
    ];

    mediosRespuesta = [
        { value: 'email', label: 'Correo Electrónico' },
        { value: 'fisica', label: 'Correspondencia Física' },
        { value: 'telefono', label: 'Teléfono' },
        { value: 'ticket', label: 'Solo Seguimiento por Ticket' }
    ];

    constructor(
        private pqrsService: PqrsService,
        private alertService: AlertService
    ) {}

    ngOnInit() {
        // Pre-llenar datos si hay usuario autenticado
        if (this.currentUser) {
            this.nuevaPqrs.nombre_ciudadano = this.currentUser.full_name || '';
            this.nuevaPqrs.email_ciudadano = this.currentUser.email || '';
            this.nuevaPqrs.cedula_ciudadano = this.currentUser.cedula || '';
            this.nuevaPqrs.telefono_ciudadano = this.currentUser.telefono || '';
            this.nuevaPqrs.direccion_ciudadano = this.currentUser.direccion || '';
        }
        
        // Si se oculta paso 1, empezar en paso 2
        if (this.ocultarPaso1) {
            this.pasoActual = 2;
            this.nuevaPqrs.canal_llegada = 'web';
        }
    }

    siguientePaso() {
        if (this.pasoActual < this.totalPasos) {
            this.pasoActual++;
            // Saltar paso 1 si está oculto
            if (this.ocultarPaso1 && this.pasoActual === 1) {
                this.pasoActual = 2;
            }
        }
    }

    pasoAnterior() {
        const minPaso = this.ocultarPaso1 ? 2 : 1;
        if (this.pasoActual > minPaso) {
            this.pasoActual--;
            // Saltar paso 1 si está oculto
            if (this.ocultarPaso1 && this.pasoActual === 1) {
                this.pasoActual = minPaso;
            }
        }
    }

    irAPaso(paso: number) {
        const minPaso = this.ocultarPaso1 ? 2 : 1;
        if (paso >= minPaso && paso <= this.totalPasos) {
            this.pasoActual = paso;
        }
    }

    onFileSelected(event: any) {
        const file = event.target.files[0];
        if (file) {
            // Validar tamaño
            if (file.size > this.MAX_FILE_SIZE_BYTES) {
                this.alertService.error(
                    `El archivo es demasiado grande. Tamaño máximo: ${this.MAX_FILE_SIZE_MB}MB`,
                    'Archivo muy grande'
                );
                event.target.value = '';
                return;
            }

            // Validar tipo
            const allowedTypes = [
                'application/pdf',
                'image/jpeg',
                'image/jpg',
                'image/png',
                'application/msword',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            ];
            
            if (!allowedTypes.includes(file.type)) {
                this.alertService.error(
                    'Tipo de archivo no permitido. Solo se aceptan: PDF, JPG, PNG, DOC, DOCX',
                    'Tipo no válido'
                );
                event.target.value = '';
                return;
            }

            this.archivoAdjunto = file;
        }
    }

    removerArchivo() {
        this.archivoAdjunto = null;
    }

    validarPasoActual(): boolean {
        switch (this.pasoActual) {
            case 1:
                return !!this.nuevaPqrs.tipo_identificacion;
            case 2:
                if (this.nuevaPqrs.tipo_identificacion === 'personal') {
                    return !!(this.nuevaPqrs.nombre_ciudadano && this.nuevaPqrs.email_ciudadano);
                }
                return true;
            case 3:
                return !!(this.nuevaPqrs.tipo_pqrs && this.nuevaPqrs.asunto && this.nuevaPqrs.descripcion);
            case 4:
                return !!this.nuevaPqrs.medio_respuesta;
            default:
                return true;
        }
    }

    enviarPqrs() {
        if (!this.currentEntity) {
            this.alertService.error('No se pudo obtener información de la entidad', 'Error');
            return;
        }

        this.isSubmitting = true;

        const pqrsData = {
            ...this.nuevaPqrs,
            tipo_solicitud: this.nuevaPqrs.tipo_pqrs,
            entity_id: this.currentEntity.id
        };

        this.pqrsService.createPqrs(pqrsData).subscribe({
            next: (pqrs) => {
                // Si hay archivo, subirlo
                if (this.archivoAdjunto) {
                    this.pqrsService.uploadArchivo(pqrs.id, this.archivoAdjunto).subscribe({
                        next: () => {
                            this.alertService.success(
                                `PQRS radicada exitosamente. Número de radicado: ${pqrs.numero_radicado}`,
                                'PQRS Creada'
                            );
                            this.isSubmitting = false;
                            this.resetForm();
                            this.pqrsCreated.emit(pqrs.numero_radicado);
                        },
                        error: () => {
                            this.alertService.warning(
                                `PQRS radicada con número ${pqrs.numero_radicado}, pero hubo un error al subir el archivo.`,
                                'Archivo no subido'
                            );
                            this.isSubmitting = false;
                            this.resetForm();
                            this.pqrsCreated.emit(pqrs.numero_radicado);
                        }
                    });
                } else {
                    this.alertService.success(
                        `PQRS radicada exitosamente. Número de radicado: ${pqrs.numero_radicado}`,
                        'PQRS Creada'
                    );
                    this.isSubmitting = false;
                    this.resetForm();
                    this.pqrsCreated.emit(pqrs.numero_radicado);
                }
            },
            error: (error) => {
                this.alertService.error(
                    error.error?.detail || 'Error al crear la PQRS',
                    'Error'
                );
                this.isSubmitting = false;
            }
        });
    }

    resetForm() {
        this.pasoActual = this.ocultarPaso1 ? 2 : 1;
        this.nuevaPqrs = {
            tipo_pqrs: 'peticion',
            asunto: '',
            descripcion: '',
            tipo_identificacion: 'personal',
            tipo_persona: 'natural',
            nombre_ciudadano: this.currentUser?.full_name || '',
            cedula_ciudadano: this.currentUser?.cedula || '',
            email_ciudadano: this.currentUser?.email || '',
            telefono_ciudadano: this.currentUser?.telefono || '',
            direccion_ciudadano: this.currentUser?.direccion || '',
            genero: 'otro',
            medio_respuesta: 'email',
            direccion_respuesta: '',
            telefono_respuesta: '',
            tipo_solicitud: 'peticion',
            canal_llegada: 'web',
            dias_respuesta: 15
        };
        this.archivoAdjunto = null;
    }

    cancelar() {
        this.resetForm();
        this.cancelled.emit();
    }

    // Métodos de ayuda para labels
    getCanalLlegadaLabel(value: string): string {
        const canal = this.canalesLlegada.find(c => c.value === value);
        return canal ? canal.label : value;
    }

    getTipoSolicitudLabel(value: string): string {
        const tipo = this.tiposSolicitud.find(t => t.value === value);
        return tipo ? tipo.label : value;
    }

    getMedioRespuestaLabel(value: string): string {
        const medio = this.mediosRespuesta.find(m => m.value === value);
        return medio ? medio.label : value;
    }

    getTipoPersonaLabel(value: string): string {
        const tipo = this.tiposPersona.find(t => t.value === value);
        return tipo ? tipo.label : value;
    }

    getGeneroLabel(value: string): string {
        const genero = this.generos.find(g => g.value === value);
        return genero ? genero.label : value;
    }
}
