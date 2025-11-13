import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withHashLocation } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';

import { routes } from './app.routes';

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
    provideAnimations()
  ]
};
