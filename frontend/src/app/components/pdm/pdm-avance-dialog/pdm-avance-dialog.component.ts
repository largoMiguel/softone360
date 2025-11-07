import { Component, OnInit, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Actividad } from '../pdm.models';
import { PdmBackendService, EjecucionResponse } from '../../../services/pdm-backend.service';

export interface AvanceDialogData {
    codigo: string;
    avances?: { [anio: number]: { valor: number; comentario?: string } };
    actividades?: Actividad[];
    entitySlug?: string;
}

export interface ImagenSeleccionada {
    archivo: File;
    preview: string;
    base64: string;
    nombre: string;
    tamano: number;
    mimeType: string;
}

@Component({
    selector: 'app-pdm-avance-dialog',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule
    ],
    templateUrl: './pdm-avance-dialog.component.html',
    styleUrls: ['./pdm-avance-dialog.component.scss']
})
export class PdmAvanceDialogComponent implements OnInit {
    @Input() data!: AvanceDialogData;
    @Output() onSave = new EventEmitter<{
        actividadId: number;
        descripcion: string;
        url: string;
        imagenes: ImagenSeleccionada[];
    }>();
    @Output() onCancel = new EventEmitter<void>();

    private pdmBackend = inject(PdmBackendService);

    actividades: Actividad[] = [];
    actividadId: number | null = null;
    actividadSeleccionada: Actividad | null = null;
    descripcion: string = '';
    url: string = '';
    imagenesSeleccionadas: ImagenSeleccionada[] = [];
    error: string | null = null;
    guardando = false;
    cargandoHistorial = false;

    // Historial de ejecuciones
    ejecuciones: EjecucionResponse[] = [];
    totalEjecutado = 0;
    mostrarHistorial = false;

    readonly MAX_IMAGENES = 4;
    readonly MAX_TAMANO_MB = 2;
    readonly MAX_TAMANO_BYTES = this.MAX_TAMANO_MB * 1024 * 1024;

    constructor() { }

    ngOnInit(): void {
        this.actividades = this.data.actividades || [];
        if (this.actividades.length) {
            this.actividadId = this.actividades[0].id ?? null;
            // Inicializar la actividad seleccionada
            if (this.actividadId) {
                this.actividadSeleccionada = this.actividades[0];
                this.cargarHistorialEjecuciones();
            }
        }
    }

    onActividadChange(): void {
        this.error = null;
        // Actualizar la actividad seleccionada
        this.actividadSeleccionada = this.actividades.find(a => a.id === this.actividadId) || null;
        this.cargarHistorialEjecuciones();
    }

    cargarHistorialEjecuciones(): void {
        if (!this.actividadId || !this.data.entitySlug) return;

        this.cargandoHistorial = true;
        this.pdmBackend.getEjecuciones(this.data.entitySlug, this.actividadId).subscribe({
            next: (response) => {
                this.ejecuciones = response.ejecuciones;
                this.totalEjecutado = response.total_ejecutado;
                this.cargandoHistorial = false;
            },
            error: (err) => {
                console.error('Error al cargar historial:', err);
                this.cargandoHistorial = false;
            }
        });
    }

    toggleHistorial(): void {
        this.mostrarHistorial = !this.mostrarHistorial;
    }

    onFileSelected(event: Event): void {
        const input = event.target as HTMLInputElement;
        if (!input.files || input.files.length === 0) return;

        const archivosArray = Array.from(input.files);
        const espacioDisponible = this.MAX_IMAGENES - this.imagenesSeleccionadas.length;

        for (let i = 0; i < Math.min(archivosArray.length, espacioDisponible); i++) {
            const archivo = archivosArray[i];

            // Validar tamaño
            if (archivo.size > this.MAX_TAMANO_BYTES) {
                this.error = `La imagen "${archivo.name}" excede el tamaño máximo de ${this.MAX_TAMANO_MB}MB`;
                continue;
            }

            // Validar tipo
            if (!archivo.type.startsWith('image/')) {
                this.error = `El archivo "${archivo.name}" no es una imagen válida`;
                continue;
            }

            // Leer archivo como base64 y preview
            const reader = new FileReader();
            reader.onload = (e: ProgressEvent<FileReader>) => {
                const base64 = e.target?.result as string;
                this.imagenesSeleccionadas.push({
                    archivo,
                    preview: base64,
                    base64: base64,
                    nombre: archivo.name,
                    tamano: archivo.size,
                    mimeType: archivo.type
                });
            };
            reader.readAsDataURL(archivo);
        }

        // Limpiar el input
        input.value = '';
    }

    eliminarImagenSeleccionada(index: number): void {
        this.imagenesSeleccionadas.splice(index, 1);
        this.error = null;
    }

    formatearTamano(bytes: number): string {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    guardar(): void {
        this.error = null;

        if (!this.actividadId || !this.actividadSeleccionada) {
            this.error = 'Selecciona una actividad.';
            return;
        }

        // Validar que al menos un campo esté presente
        const tieneDescripcion = this.descripcion && this.descripcion.trim().length > 0;
        const tieneUrl = this.url && this.url.trim().length > 0;
        const tieneImagenes = this.imagenesSeleccionadas.length > 0;

        if (!tieneDescripcion && !tieneUrl && !tieneImagenes) {
            this.error = 'Debe proporcionar al menos descripción, URL o imágenes.';
            return;
        }

        this.guardando = true;
        this.onSave.emit({
            actividadId: this.actividadId,
            descripcion: this.descripcion.trim(),
            url: this.url.trim(),
            imagenes: this.imagenesSeleccionadas
        });
    }

    cancelar(): void {
        this.onCancel.emit();
    }
}
