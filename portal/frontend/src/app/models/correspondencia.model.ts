// Tipos de radicación
export type TipoRadicacion = 'fisico' | 'correo';

// Tipos de solicitud para correspondencia
export type TipoSolicitudCorrespondencia = 'sugerencia' | 'peticion' | 'queja' | 'reclamo' | 'felicitacion' | 'solicitud_informacion' | 'otro';

// Estados de correspondencia
export type EstadoCorrespondencia = 'enviada' | 'en_proceso' | 'resuelta' | 'cerrada';

// Modelo principal de Correspondencia
export interface Correspondencia {
  id: number;
  numero_radicado: string;
  fecha_envio: string; // Date en formato ISO
  procedencia: string;
  destinacion: string;
  numero_folios: number;
  tipo_radicacion: TipoRadicacion;
  correo_electronico?: string | null;
  direccion_radicacion?: string | null;
  tipo_solicitud: TipoSolicitudCorrespondencia;
  archivo_solicitud?: string | null;
  archivo_respuesta?: string | null;
  estado: EstadoCorrespondencia;
  tiempo_respuesta_dias?: number | null;
  observaciones?: string | null;
  respuesta?: string | null;
  created_at: string;
  updated_at?: string | null;
  fecha_respuesta?: string | null;
  created_by_id?: number | null;
  assigned_to_id?: number | null;
  entity_id: number;
}

// Modelo con detalles adicionales (nombres de usuarios)
export interface CorrespondenciaWithDetails extends Correspondencia {
  created_by_name?: string | null;
  assigned_to_name?: string | null;
}

// Modelo para creación de correspondencia
export interface CreateCorrespondencia {
  fecha_envio: string;
  procedencia?: string;
  destinacion: string;
  numero_folios: number;
  tipo_radicacion: TipoRadicacion;
  correo_electronico?: string | null;
  direccion_radicacion?: string | null;
  tipo_solicitud: TipoSolicitudCorrespondencia;
  archivo_solicitud?: string | null;
  archivo_respuesta?: string | null;
  estado?: EstadoCorrespondencia;
  tiempo_respuesta_dias?: number | null;
  observaciones?: string | null;
  respuesta?: string | null;
  assigned_to_id?: number | null;
  entity_id: number;
}

// Modelo para actualización de correspondencia
export interface UpdateCorrespondencia {
  fecha_envio?: string;
  procedencia?: string;
  destinacion?: string;
  numero_folios?: number;
  tipo_radicacion?: TipoRadicacion;
  correo_electronico?: string | null;
  direccion_radicacion?: string | null;
  tipo_solicitud?: TipoSolicitudCorrespondencia;
  archivo_solicitud?: string | null;
  archivo_respuesta?: string | null;
  estado?: EstadoCorrespondencia;
  tiempo_respuesta_dias?: number | null;
  observaciones?: string | null;
  respuesta?: string | null;
  assigned_to_id?: number | null;
}

// Constantes para tipos de radicación
export const TIPOS_RADICACION: { [key in TipoRadicacion]: string } = {
  fisico: 'Físico',
  correo: 'Correo Electrónico'
};

// Constantes para tipos de solicitud
export const TIPOS_SOLICITUD_CORRESPONDENCIA: { [key in TipoSolicitudCorrespondencia]: string } = {
  sugerencia: 'Sugerencia',
  peticion: 'Petición',
  queja: 'Queja',
  reclamo: 'Reclamo',
  felicitacion: 'Felicitación',
  solicitud_informacion: 'Solicitud de Información',
  otro: 'Otro'
};

// Constantes para estados
export const ESTADOS_CORRESPONDENCIA: { [key in EstadoCorrespondencia]: { label: string; color: string; bgColor: string } } = {
  enviada: { label: 'Enviada', color: 'text-info', bgColor: 'bg-info' },
  en_proceso: { label: 'En Proceso', color: 'text-warning', bgColor: 'bg-warning' },
  resuelta: { label: 'Resuelta', color: 'text-success', bgColor: 'bg-success' },
  cerrada: { label: 'Cerrada', color: 'text-secondary', bgColor: 'bg-secondary' }
};

// Opciones de tiempo de respuesta (en días)
export const TIEMPOS_RESPUESTA = [
  { value: 5, label: '5 días' },
  { value: 10, label: '10 días' },
  { value: 15, label: '15 días' }
];
