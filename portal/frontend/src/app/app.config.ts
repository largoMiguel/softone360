import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZoneChangeDetection, LOCALE_ID } from '@angular/core';
import { provideRouter, withHashLocation } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { registerLocaleData } from '@angular/common';
import localeEsCO from '@angular/common/locales/es-CO';

import { routes } from './app.routes';

// Registrar locale español de Colombia
registerLocaleData(localeEsCO, 'es-CO');

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    // Usar HashLocationStrategy para mejor compatibilidad con S3 website hosting
    // En S3, las rutas con "/" no funcionan bien sin CloudFront
    // Con hash: http://example.com/#/chiquiza-boyaca/pdm en lugar de http://example.com/chiquiza-boyaca/pdm
    provideRouter(routes, withHashLocation()),
    provideHttpClient(withInterceptors([
      (req, next) => {
        const token = localStorage.getItem('token');
        if (token) {
          req = req.clone({
            setHeaders: {
              Authorization: `Bearer ${token}`
            }
          });
        }
        return next(req);
      }
    ])),
    provideAnimations(),
    { provide: LOCALE_ID, useValue: 'es-CO' }
  ]
};
