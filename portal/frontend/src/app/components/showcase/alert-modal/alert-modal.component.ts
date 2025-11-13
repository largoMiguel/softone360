import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

export type AlertType = 'error' | 'warning' | 'success' | 'info';

@Component({
    selector: 'app-alert-modal',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './alert-modal.component.html',
    styleUrl: './alert-modal.component.scss'
})
export class AlertModalComponent {
    @Input() isOpen = false;
    @Input() type: AlertType = 'error';
    @Input() title = 'Información';
    @Input() message = '';
    @Output() onClose = new EventEmitter<void>();

    close(): void {
        this.onClose.emit();
    }

    getIcon(): string {
        switch (this.type) {
            case 'error':
                return 'fas fa-exclamation-circle';
            case 'warning':
                return 'fas fa-exclamation-triangle';
            case 'success':
                return 'fas fa-check-circle';
            case 'info':
                return 'fas fa-info-circle';
            default:
                return 'fas fa-info-circle';
        }
    }
}
