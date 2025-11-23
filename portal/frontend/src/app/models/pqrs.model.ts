export interface PQRS {
    id: number;
    numero_radicado: string;
    canal_llegada: CanalLlegada;
    tipo_identificacion: TipoIdentificacion;
    medio_respuesta: MedioRespuesta;
    nombre_ciudadano?: string;
    cedula_ciudadano?: string;
    telefono_ciudadano?: string;
    email_ciudadano?: string;
    direccion_ciudadano?: string;
    tipo_solicitud: TipoSolicitud;
    asunto?: string;
    descripcion: string;
    estado: EstadoPQRS;
    fecha_solicitud: string;
    fecha_cierre?: string;
    fecha_delegacion?: string;
    fecha_respuesta?: string;
    respuesta?: string;
    created_by_id: number;
    assigned_to_id?: number;
    entity_id: number;
    created_at: string;
    updated_at?: string;
    tipo_persona?: TipoPersona;
    genero?: Genero;
    dias_respuesta?: number;
    archivo_adjunto?: string;
    justificacion_asignacion?: string;
    archivo_respuesta?: string;
}

export interface PQRSWithDetails extends PQRS {
    created_by?: {
        id: number;
        username: string;
        full_name: string;
    };
    assigned_to?: {
        id: number;
        username: string;
        full_name: string;
    };
}

export interface CreatePQRSRequest {
    numero_radicado?: string;
    canal_llegada: CanalLlegada;
    tipo_identificacion: TipoIdentificacion;
    medio_respuesta: MedioRespuesta;
    nombre_ciudadano?: string;
    cedula_ciudadano?: string;
    telefono_ciudadano?: string;
    email_ciudadano?: string;
    direccion_ciudadano?: string;
    tipo_solicitud: TipoSolicitud;
    asunto?: string;
    descripcion: string;
    entity_id: number;
    tipo_persona?: TipoPersona;
    genero?: Genero;
    dias_respuesta?: number;
    archivo_adjunto?: string;
    justificacion_asignacion?: string;
    archivo_respuesta?: string;
}

export interface UpdatePQRSRequest {
    canal_llegada?: CanalLlegada;
    tipo_identificacion?: TipoIdentificacion;
    medio_respuesta?: MedioRespuesta;
    nombre_ciudadano?: string;
    cedula_ciudadano?: string;
    telefono_ciudadano?: string;
    email_ciudadano?: string;
    direccion_ciudadano?: string;
    tipo_solicitud?: TipoSolicitud;
    asunto?: string;
    descripcion?: string;
    estado?: EstadoPQRS;
    respuesta?: string;
    assigned_to_id?: number;
    fecha_solicitud?: string;
    tipo_persona?: TipoPersona;
    genero?: Genero;
    dias_respuesta?: number;
    archivo_adjunto?: string;
    justificacion_asignacion?: string;
    archivo_respuesta?: string;
}

export interface PQRSResponse {
    respuesta: string;
}

export type TipoSolicitud = 'peticion' | 'queja' | 'reclamo' | 'sugerencia' | 'felicitacion' | 'denuncia' | 'solicitud_informacion' | 'solicitud_datos_personales' | 'agenda_cita';
export type EstadoPQRS = 'pendiente' | 'en_proceso' | 'resuelto' | 'cerrado';
export type TipoIdentificacion = 'personal' | 'anonima';
export type MedioRespuesta = 'email' | 'fisica' | 'telefono' | 'ticket';
export type CanalLlegada = 'correo' | 'carta' | 'buzon' | 'fisica' | 'presencial' | 'telefono' | 'web';
export type TipoPersona = 'natural' | 'juridica' | 'nna' | 'apoderado';
export type Genero = 'femenino' | 'masculino' | 'otro';

export const CANALES_LLEGADA: { value: CanalLlegada; label: string; icon?: string }[] = [
    { value: 'correo', label: 'Correo electrónico', icon: 'fas fa-envelope' },
    { value: 'carta', label: 'Carta', icon: 'fas fa-envelope-open-text' },
    { value: 'buzon', label: 'Buzón de sugerencias', icon: 'fas fa-inbox' },
    { value: 'fisica', label: 'Entrega física en oficina', icon: 'fas fa-hand-holding' },
    { value: 'presencial', label: 'Presencial (ventanilla)', icon: 'fas fa-user-tie' },
    { value: 'telefono', label: 'Teléfono', icon: 'fas fa-phone' },
    { value: 'web', label: 'Portal web', icon: 'fas fa-globe' }
];

export const TIPOS_SOLICITUD: { value: TipoSolicitud; label: string; descripcion: string }[] = [
    { 
        value: 'peticion', 
        label: 'Petición', 
        descripcion: 'Derecho fundamental que tiene toda persona a presentar solicitudes respetuosas a las autoridades por motivos de interés general o particular y a obtener su pronta resolución.' 
    },
    { 
        value: 'queja', 
        label: 'Queja', 
        descripcion: 'Manifestación de protesta, censura, descontento o inconformidad que formula una persona en relación con una conducta que considera irregular de uno o varios servidores públicos en desarrollo de sus funciones.' 
    },
    { 
        value: 'reclamo', 
        label: 'Reclamo', 
        descripcion: 'Derecho que tiene toda persona de exigir, reivindicar o demandar una solución, ya sea por motivo general o particular, referente a la presentación indebida de un servicio o a la falta de atención de una solicitud.' 
    },
    { 
        value: 'sugerencia', 
        label: 'Sugerencia', 
        descripcion: 'Manifestación de una idea o propuesta para mejorar el servicio o la gestión de la entidad.' 
    },
    { 
        value: 'felicitacion', 
        label: 'Felicitación', 
        descripcion: 'Manifestación de la alegría y satisfacción de un servicio brindado o la gestión de la entidad.' 
    },
    { 
        value: 'denuncia', 
        label: 'Denuncia', 
        descripcion: 'Puesta en conocimiento ante una autoridad competente de una conducta posiblemente irregular, para que se adelante la correspondiente investigación penal, disciplinaria, fiscal, administrativa - sancionatoria o ético profesional.' 
    },
    { 
        value: 'solicitud_informacion', 
        label: 'Solicitud de información', 
        descripcion: 'Petición formulada para acceder a información pública, sin necesidad de que los solicitantes acrediten su personalidad, el tipo de interés, las causas por las cuáles presentan su solicitud o los fines a los cuáles habrán de destinar los datos solicitados.' 
    },
    { 
        value: 'solicitud_datos_personales', 
        label: 'Solicitud de datos personales', 
        descripcion: 'Solicitud de cambio y/o eliminación de información correspondiente a los datos personales del usuario que requieran correcciones o actualizaciones.' 
    },
    { 
        value: 'agenda_cita', 
        label: 'Agenda tu cita', 
        descripcion: 'Solicitud para agendar una cita presencial o virtual con la entidad.' 
    }
];

export const ESTADOS_PQRS: { value: EstadoPQRS; label: string; color: string }[] = [
    { value: 'pendiente', label: 'Pendiente', color: 'warning' },
    { value: 'en_proceso', label: 'En Proceso', color: 'info' },
    { value: 'resuelto', label: 'Resuelto', color: 'success' },
    { value: 'cerrado', label: 'Cerrado', color: 'secondary' }
];

export const TIPOS_IDENTIFICACION: { value: TipoIdentificacion; label: string }[] = [
    { value: 'personal', label: 'A nombre personal (con identificación)' },
    { value: 'anonima', label: 'Anónima (solo descripción)' }
];

export const MEDIOS_RESPUESTA: { value: MedioRespuesta; label: string; icon?: string }[] = [
    { value: 'email', label: 'Por correo electrónico', icon: 'fas fa-envelope' },
    { value: 'fisica', label: 'Por correspondencia física', icon: 'fas fa-mail-bulk' },
    { value: 'telefono', label: 'Por teléfono', icon: 'fas fa-phone' },
    { value: 'ticket', label: 'Seguimiento por ticket', icon: 'fas fa-ticket-alt' }
];

export const TIPOS_PERSONA: { value: TipoPersona; label: string }[] = [
    { value: 'natural', label: 'Persona natural' },
    { value: 'juridica', label: 'Persona jurídica' },
    { value: 'nna', label: 'Niños, Niñas y Adolescentes' },
    { value: 'apoderado', label: 'Apoderado' }
];

export const GENEROS: { value: Genero; label: string }[] = [
    { value: 'femenino', label: 'Femenino' },
    { value: 'masculino', label: 'Masculino' },
    { value: 'otro', label: 'Otro' }
];