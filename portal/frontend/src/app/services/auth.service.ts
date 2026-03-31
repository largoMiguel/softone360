import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject, tap } from 'rxjs';
import { User, LoginRequest, LoginResponse, CreateUserRequest } from '../models/user.model';
import { environment } from '../../environments/environment';
import { NavigationStateService } from './navigation-state.service';

@Injectable({
    providedIn: 'root'
})
export class AuthService {
    private baseUrl = `${environment.apiUrl}/auth/`;
    private currentUserSubject = new BehaviorSubject<User | null>(null);
    public currentUser$ = this.currentUserSubject.asObservable();
    private navState = inject(NavigationStateService);

    constructor(private http: HttpClient) {
        // Verificar si hay un usuario guardado en sessionStorage
        const savedUser = sessionStorage.getItem('user');
        if (savedUser) {
            try {
                this.currentUserSubject.next(JSON.parse(savedUser));
            } catch {
                sessionStorage.removeItem('user');
            }
        }
    }

    login(credentials: LoginRequest): Observable<LoginResponse> {
        return this.http.post<LoginResponse>(`${this.baseUrl}login`, credentials)
            .pipe(
                tap(response => {
                    sessionStorage.setItem('token', response.access_token);
                    sessionStorage.setItem('refresh_token', response.refresh_token);
                    sessionStorage.setItem('user', JSON.stringify(response.user));
                    this.currentUserSubject.next(response.user);
                })
            );
    }

    register(userData: CreateUserRequest): Observable<User> {
        return this.http.post<User>(`${this.baseUrl}register`, userData);
    }

    registerCiudadano(userData: CreateUserRequest): Observable<User> {
        return this.http.post<User>(`${this.baseUrl}register-ciudadano`, userData);
    }

    logout(): void {
        // 1. Limpiar token y usuario del sessionStorage
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('refresh_token');
        sessionStorage.removeItem('user');
        
        // 2. Limpiar el BehaviorSubject del usuario actual
        this.currentUserSubject.next(null);
        
        // 3. Limpiar estado de navegación en memoria
        this.navState.clearAll();
    }

    getCurrentUser(): Observable<User> {
        return this.http.get<User>(`${this.baseUrl}me`);
    }

    getUsers(): Observable<User[]> {
        return this.http.get<User[]>(`${this.baseUrl}users`);
    }

    getToken(): string | null {
        return sessionStorage.getItem('token');
    }

    getRefreshToken(): string | null {
        return sessionStorage.getItem('refresh_token');
    }

    /**
     * Renueva el access token usando el refresh token almacenado.
     */
    refreshAccessToken(): Observable<{ access_token: string; token_type: string }> {
        const refreshToken = this.getRefreshToken();
        return this.http.post<{ access_token: string; token_type: string }>(
            `${this.baseUrl}refresh`,
            { refresh_token: refreshToken }
        ).pipe(
            tap(response => {
                sessionStorage.setItem('token', response.access_token);
            })
        );
    }

    /**
     * Verifica si el token JWT ha expirado
     */
    isTokenExpired(): boolean {
        const token = this.getToken();
        if (!token) return true;

        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            const exp = payload.exp;
            if (!exp) return false;

            const now = Math.floor(Date.now() / 1000);
            return now >= exp;
        } catch {
            return true;
        }
    } 

    isAuthenticated(): boolean {
        const token = this.getToken();
        if (!token) return false;

        // Validar que el token no esté vencido
        if (this.isTokenExpired()) {
            this.logout();
            return false;
        }

        return true;
    }

    isAdmin(): boolean {
        const user = this.currentUserSubject.value;
        return user ? user.role === 'admin' : false;
    }

    isSuperAdmin(): boolean {
        const user = this.currentUserSubject.value;
        return user ? user.role === 'superadmin' : false;
    }

    isAdminOrSuperAdmin(): boolean {
        const user = this.currentUserSubject.value;
        return user ? (user.role === 'admin' || user.role === 'superadmin') : false;
    }

    getCurrentUserValue(): User | null {
        return this.currentUserSubject.value;
    }

    /**
     * Actualiza el usuario actual en memoria y sessionStorage
     */
    updateCurrentUser(user: User): void {
        sessionStorage.setItem('user', JSON.stringify(user));
        this.currentUserSubject.next(user);
    }

    getAuthHeaders(): HttpHeaders {
        const token = this.getToken();
        return new HttpHeaders({
            'Authorization': `Bearer ${token}`
        });
    }
}