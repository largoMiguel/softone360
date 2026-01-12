import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-certificacion-bpp',
    standalone: true,
    imports: [CommonModule],
    template: `
        <div class="container-fluid py-4">
            <div class="row">
                <div class="col">
                    <h2 class="mb-3">
                        <i class="fas fa-certificate me-2"></i>Certificación de BPP
                    </h2>
                    <div class="alert alert-info">
                        <i class="fas fa-info-circle me-2"></i>
                        Módulo en construcción
                    </div>
                </div>
            </div>
        </div>
    `
})
export class CertificacionBPPComponent { }
