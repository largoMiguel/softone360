export interface Funcionario {
  id: number;
  cedula: string;
  nombres: string;
  apellidos: string;
  email?: string;
  telefono?: string;
  cargo?: string;
  foto_url?: string;
  entity_id: number;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

export interface FuncionarioCreate {
  cedula: string;
  nombres: string;
  apellidos: string;
  email?: string;
  telefono?: string;
  cargo?: string;
  entity_id: number;
}

export interface EquipoRegistro {
  id: number;
  uuid: string;
  nombre: string;
  ubicacion?: string;
  entity_id: number;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

export interface EquipoRegistroCreate {
  uuid: string;
  nombre: string;
  ubicacion?: string;
  entity_id: number;
}

export interface RegistroAsistencia {
  id: number;
  funcionario_id: number;
  funcionario_nombres: string;
  funcionario_apellidos: string;
  funcionario_cedula: string;
  funcionario_cargo?: string;
  funcionario_foto_url?: string;
  equipo_nombre: string;
  equipo_ubicacion?: string;
  tipo_registro: 'entrada' | 'salida';
  fecha_hora: string;
  foto_url?: string;
  observaciones?: string;
}

export interface EstadisticasAsistencia {
  total_funcionarios: number;
  total_registros: number;
  registros_hoy: number;
  entradas_hoy: number;
  salidas_hoy: number;
  funcionarios_presentes: number;
  promedio_asistencia_semanal?: number;
}
