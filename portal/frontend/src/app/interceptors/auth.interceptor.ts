import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, throwError, EMPTY, BehaviorSubject, switchMap, filter, take } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { Router } from '@angular/router';
import { EntityContextService } from '../services/entity-context.service';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
    private isRefreshing = false;
    private refreshTokenSubject = new BehaviorSubject<string | null>(null);

    constructor(
        private authService: AuthService,
        private router: Router,
        private entityContext: EntityContextService
    ) { }

    intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
        const token = this.authService.getToken();

        // Si el token existe pero expiró, intentar renovarlo antes de la petición.
        // Excluir explícitamente /auth/login y /auth/refresh para evitar bucles.
        const isAuthEndpoint = req.url.includes('/auth/login') || req.url.includes('/auth/refresh') || req.url.includes('/auth/register');
        if (token && this.authService.isTokenExpired() && !isAuthEndpoint) {
            return this.handleTokenRefresh(req, next);
        }

        const authReq = token ? this.addToken(req, token) : req;

        return next.handle(authReq).pipe(
            catchError((error: HttpErrorResponse) => {
                if (error.status === 401 && !req.url.includes('/auth/refresh') && !req.url.includes('/auth/login')) {
                    return this.handleTokenRefresh(req, next);
                }
                if (error.status === 403) {
                    this.handleUnauthorized();
                    return EMPTY;
                }
                return throwError(() => error);
            })
        );
    }

    private addToken(req: HttpRequest<any>, token: string): HttpRequest<any> {
        const headers: any = { Authorization: `Bearer ${token}` };
        if (!(req.body instanceof FormData)) {
            headers['Content-Type'] = 'application/json';
        }
        return req.clone({ setHeaders: headers });
    }

    private handleTokenRefresh(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
        if (!this.authService.getRefreshToken()) {
            this.handleUnauthorized();
            return EMPTY;
        }

        if (this.isRefreshing) {
            // Esperar a que la renovación en curso termine y reintentar
            return this.refreshTokenSubject.pipe(
                filter(token => token !== null),
                take(1),
                switchMap(token => next.handle(this.addToken(req, token!)))
            );
        }

        this.isRefreshing = true;
        this.refreshTokenSubject.next(null);

        return this.authService.refreshAccessToken().pipe(
            switchMap(response => {
                this.isRefreshing = false;
                this.refreshTokenSubject.next(response.access_token);
                return next.handle(this.addToken(req, response.access_token));
            }),
            catchError((err) => {
                this.isRefreshing = false;
                // Desbloquear requests en espera antes de navegar
                this.refreshTokenSubject.next(null);
                this.handleUnauthorized();
                return throwError(() => err);
            })
        );
    }

    private handleUnauthorized(): void {
        this.authService.logout();

        const currentUrl = this.router.url;
        const slug = (currentUrl || '').replace(/^\//, '').split('/')[0] || this.entityContext.currentEntity?.slug || null;

        this.router.navigate(slug ? ['/', slug, 'login'] : ['/']);
    }
}