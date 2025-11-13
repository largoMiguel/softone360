import { Injectable } from '@angular/core';

export interface AlertConfig {
    title: string;
    message: string;
    type: 'success' | 'error' | 'warning' | 'info' | 'confirm';
    confirmText?: string;
    cancelText?: string;
    icon?: string;
}

@Injectable({
    providedIn: 'root'
})
export class AlertService {
    private alertContainer: HTMLElement | null = null;

    constructor() {
        this.initializeContainer();
    }

    private initializeContainer() {
        if (typeof document !== 'undefined') {
            this.alertContainer = document.createElement('div');
            this.alertContainer.id = 'custom-alert-container';
            this.alertContainer.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 9999;
        display: none;
        align-items: center;
        justify-content: center;
        background-color: rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(2px);
      `;
            document.body.appendChild(this.alertContainer);
        }
    }

    success(message: string, title: string = '¡Éxito!'): Promise<boolean> {
        return this.showAlert({
            title,
            message,
            type: 'success',
            icon: 'fa-check-circle',
            confirmText: 'Aceptar'
        });
    }

    error(message: string, title: string = 'Error'): Promise<boolean> {
        return this.showAlert({
            title,
            message,
            type: 'error',
            icon: 'fa-times-circle',
            confirmText: 'Aceptar'
        });
    }

    warning(message: string, title: string = 'Advertencia'): Promise<boolean> {
        return this.showAlert({
            title,
            message,
            type: 'warning',
            icon: 'fa-exclamation-triangle',
            confirmText: 'Aceptar'
        });
    }

    info(message: string, title: string = 'Información'): Promise<boolean> {
        return this.showAlert({
            title,
            message,
            type: 'info',
            icon: 'fa-info-circle',
            confirmText: 'Aceptar'
        });
    }

    confirm(message: string, title: string = 'Confirmar acción'): Promise<boolean> {
        return this.showAlert({
            title,
            message,
            type: 'confirm',
            icon: 'fa-question-circle',
            confirmText: 'Confirmar',
            cancelText: 'Cancelar'
        });
    }

    private showAlert(config: AlertConfig): Promise<boolean> {
        return new Promise((resolve) => {
            if (!this.alertContainer) {
                resolve(false);
                return;
            }

            const colors = {
                success: { bg: '#10b981', light: '#d1fae5', border: '#059669' },
                error: { bg: '#ef4444', light: '#fee2e2', border: '#dc2626' },
                warning: { bg: '#f59e0b', light: '#fef3c7', border: '#d97706' },
                info: { bg: '#3b82f6', light: '#dbeafe', border: '#2563eb' },
                confirm: { bg: '#8b5cf6', light: '#ede9fe', border: '#7c3aed' }
            };

            const color = colors[config.type];

            const modal = document.createElement('div');
            modal.style.cssText = `
        background: white;
        border-radius: 16px;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
        max-width: 440px;
        width: 90%;
        padding: 0;
        animation: slideIn 0.3s ease-out;
        overflow: hidden;
      `;

            modal.innerHTML = `
        <style>
          @keyframes slideIn {
            from {
              opacity: 0;
              transform: translateY(-20px) scale(0.95);
            }
            to {
              opacity: 1;
              transform: translateY(0) scale(1);
            }
          }
          @keyframes slideOut {
            from {
              opacity: 1;
              transform: translateY(0) scale(1);
            }
            to {
              opacity: 0;
              transform: translateY(-20px) scale(0.95);
            }
          }
          .alert-btn {
            padding: 10px 24px;
            border-radius: 8px;
            border: none;
            font-weight: 600;
            font-size: 14px;
            cursor: pointer;
            transition: all 0.2s;
            min-width: 100px;
          }
          .alert-btn:hover {
            transform: translateY(-1px);
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
          }
          .alert-btn:active {
            transform: translateY(0);
          }
        </style>
        <div style="background: ${color.light}; padding: 24px; border-bottom: 3px solid ${color.border};">
          <div style="display: flex; align-items: center; gap: 16px;">
            <div style="
              width: 56px;
              height: 56px;
              border-radius: 50%;
              background: white;
              display: flex;
              align-items: center;
              justify-content: center;
              flex-shrink: 0;
              box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
            ">
              <i class="fas ${config.icon}" style="font-size: 28px; color: ${color.bg};"></i>
            </div>
            <div style="flex: 1;">
              <h3 style="margin: 0 0 4px 0; color: #111827; font-size: 20px; font-weight: 700;">${config.title}</h3>
            </div>
          </div>
        </div>
        <div style="padding: 24px;">
          <p style="margin: 0 0 24px 0; color: #4b5563; font-size: 15px; line-height: 1.6; white-space: pre-wrap;">${config.message}</p>
          <div style="display: flex; gap: 12px; justify-content: flex-end;">
            ${config.type === 'confirm' ? `
              <button class="alert-btn" id="cancelBtn" style="background: #f3f4f6; color: #374151;">
                ${config.cancelText}
              </button>
            ` : ''}
            <button class="alert-btn" id="confirmBtn" style="background: ${color.bg}; color: white;">
              ${config.confirmText}
            </button>
          </div>
        </div>
      `;

            this.alertContainer.innerHTML = '';
            this.alertContainer.appendChild(modal);
            this.alertContainer.style.display = 'flex';

            const closeAlert = (result: boolean) => {
                modal.style.animation = 'slideOut 0.2s ease-in';
                setTimeout(() => {
                    if (this.alertContainer) {
                        this.alertContainer.style.display = 'none';
                        this.alertContainer.innerHTML = '';
                    }
                    resolve(result);
                }, 200);
            };

            const confirmBtn = modal.querySelector('#confirmBtn');
            const cancelBtn = modal.querySelector('#cancelBtn');

            if (confirmBtn) {
                confirmBtn.addEventListener('click', () => closeAlert(true));
            }

            if (cancelBtn) {
                cancelBtn.addEventListener('click', () => closeAlert(false));
            }

            // Cerrar con ESC
            const handleKeyPress = (e: KeyboardEvent) => {
                if (e.key === 'Escape') {
                    closeAlert(false);
                    document.removeEventListener('keydown', handleKeyPress);
                }
            };
            document.addEventListener('keydown', handleKeyPress);

            // Cerrar al hacer clic fuera
            this.alertContainer.addEventListener('click', (e) => {
                if (e.target === this.alertContainer) {
                    closeAlert(false);
                }
            });
        });
    }
}
