import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, throwError, EMPTY } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { Router } from '@angular/router';
import { EntityContextService } from '../services/entity-context.service';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
    private isRedirecting = false;

    constructor(
        private authService: AuthService,
        private router: Router,
        private entityContext: EntityContextService
    ) { }

    intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
        const token = this.authService.getToken();

        // Validar que el token no esté vencido antes de hacer la petición
        if (token && this.authService.isTokenExpired()) {
            this.handleUnauthorized();
            return EMPTY; // No hacer la petición
        }

        if (token) {
            // No establecer Content-Type para FormData (el navegador lo hace automáticamente con boundary)
            const headers: any = {
                Authorization: `Bearer ${token}`
            };
            
            // Solo agregar Content-Type si no es FormData
            if (!(req.body instanceof FormData)) {
                headers['Content-Type'] = 'application/json';
            }
            
            const authReq = req.clone({
                setHeaders: headers
            });

            return next.handle(authReq).pipe(
                catchError((error: HttpErrorResponse) => {
                    if (error.status === 401 || error.status === 403) {
                        this.handleUnauthorized();
                        return EMPTY; // No propagar el error
                    }
                    return throwError(() => error);
                })
            );
        }

        return next.handle(req);
    }

    private handleUnauthorized(): void {
        // Evitar múltiples redirecciones simultáneas
        if (this.isRedirecting) {
            return;
        }

        this.isRedirecting = true;
        this.authService.logout();

        const currentUrl = this.router.url;
        const slug = (currentUrl || '').replace(/^\//, '').split('/')[0] || this.entityContext.currentEntity?.slug || null;

        this.router.navigate(slug ? ['/', slug, 'login'] : ['/']).then(() => {
            this.isRedirecting = false;
        });
    }
}