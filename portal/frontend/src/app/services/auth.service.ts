import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, BehaviorSubject, tap } from 'rxjs';
import { User, LoginRequest, LoginResponse, CreateUserRequest } from '../models/user.model';
import { environment } from '../../environments/environment';

@Injectable({
    providedIn: 'root'
})
export class AuthService {
    private baseUrl = `${environment.apiUrl}/auth/`;
    private currentUserSubject = new BehaviorSubject<User | null>(null);
    public currentUser$ = this.currentUserSubject.asObservable();

    constructor(private http: HttpClient) {
        // Verificar si hay un usuario guardado en localStorage
        const savedUser = localStorage.getItem('user');
        if (savedUser) {
            this.currentUserSubject.next(JSON.parse(savedUser));
        }
    }

    login(credentials: LoginRequest): Observable<LoginResponse> {
        return this.http.post<LoginResponse>(`${this.baseUrl}login`, credentials)
            .pipe(
                tap(response => {
                    // console.log('Login exitoso:', response);
                    // Guardar token y usuario
                    localStorage.setItem('token', response.access_token);
                    localStorage.setItem('user', JSON.stringify(response.user));
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
        // 1. Limpiar token y usuario del localStorage
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('pdm_actividades'); // PDM cache
        localStorage.removeItem('entity_context'); // Entity context
        
        // 2. Limpiar el BehaviorSubject del usuario actual
        this.currentUserSubject.next(null);
        
        // 3. Limpiar sessionStorage también (por si hay datos ahí)
        sessionStorage.clear();
    }

    getCurrentUser(): Observable<User> {
        return this.http.get<User>(`${this.baseUrl}me`);
    }

    getUsers(): Observable<User[]> {
        return this.http.get<User[]>(`${this.baseUrl}users`);
    }

    getToken(): string | null {
        const token = localStorage.getItem('token');
        // console.log('Token obtenido:', token ? 'Presente' : 'No encontrado');
        return token;
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

    getAuthHeaders(): HttpHeaders {
        const token = this.getToken();
        return new HttpHeaders({
            'Authorization': `Bearer ${token}`
        });
    }
}