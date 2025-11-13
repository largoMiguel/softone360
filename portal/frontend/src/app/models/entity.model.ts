export interface Entity {
    id: number;
    name: string;
    code: string;
    nit?: string;              // NIT de la entidad para consultas SECOP
    slug: string;              // URL slug (ej: chiquiza-boyaca)
    description?: string;
    address?: string;
    phone?: string;
    email?: string;
    logo_url?: string;         // URL del logo
    horario_atencion?: string; // Horario de atención
    tiempo_respuesta?: string; // Tiempo de respuesta
    is_active: boolean;
    // Flags de módulos/funcionalidades
    enable_pqrs: boolean;
    enable_users_admin: boolean;
    enable_reports_pdf: boolean;
    enable_ai_reports: boolean;
    enable_planes_institucionales: boolean;
    enable_contratacion: boolean;
    enable_pdm?: boolean;
    created_at: string;
    updated_at?: string;
}

export interface EntityWithStats extends Entity {
    admin_count: number;
    user_count: number;
}

export interface CreateEntityRequest {
    name: string;
    code: string;
    nit?: string;
    slug: string;
    description?: string;
    address?: string;
    phone?: string;
    email?: string;
    logo_url?: string;
    horario_atencion?: string;
    tiempo_respuesta?: string;
    enable_pqrs?: boolean;
    enable_users_admin?: boolean;
    enable_reports_pdf?: boolean;
    enable_ai_reports?: boolean;
    enable_planes_institucionales?: boolean;
    enable_contratacion?: boolean;
    enable_pdm?: boolean;
}

export interface UpdateEntityRequest {
    name?: string;
    code?: string;
    nit?: string;
    slug?: string;
    description?: string;
    address?: string;
    phone?: string;
    email?: string;
    logo_url?: string;
    horario_atencion?: string;
    tiempo_respuesta?: string;
    is_active?: boolean;
    enable_pqrs?: boolean;
    enable_users_admin?: boolean;
    enable_reports_pdf?: boolean;
    enable_ai_reports?: boolean;
    enable_planes_institucionales?: boolean;
    enable_contratacion?: boolean;
    enable_pdm?: boolean;
}
