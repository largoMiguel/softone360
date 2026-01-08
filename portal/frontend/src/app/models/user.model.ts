export interface EntityBasic {
    id: number;
    name: string;
    slug: string;
    enable_asistencia?: boolean;
}

export interface User {
    id: number;
    username: string;
    email: string;
    full_name: string;
    role: 'superadmin' | 'admin' | 'secretario' | 'ciudadano';
    is_active?: boolean;
    entity_id?: number;  // ID de la entidad a la que pertenece
    entity?: EntityBasic;  // Datos básicos de la entidad (incluye slug)
    user_type?: 'secretario' | 'contratista' | null;  // Tipo de usuario (para secretarios/contratistas)
    allowed_modules?: string[];  // Módulos permitidos: ["pqrs", "planes_institucionales", "contratacion"]
    is_talento_humano?: boolean;  // Indica si el usuario puede acceder al módulo de Talento Humano
    secretaria?: string;  // Nombre de la secretaría
    secretaria_id?: number;  // ID de la secretaría (para comparaciones)
    cedula?: string;
    telefono?: string;
    direccion?: string;
    created_at?: string;
    updated_at?: string;
}

export interface LoginRequest {
    username: string;
    password: string;
}

export interface LoginResponse {
    access_token: string;
    token_type: string;
    user: User;
}

export interface CreateUserRequest {
    username: string;
    email: string;
    full_name: string;
    role: 'superadmin' | 'admin' | 'secretario' | 'ciudadano';
    entity_id?: number;
    user_type?: 'secretario' | 'contratista' | null;
    allowed_modules?: string[];
    is_talento_humano?: boolean;
    secretaria?: string;
    cedula?: string;
    telefono?: string;
    direccion?: string;
    password: string;
}