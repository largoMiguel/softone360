export interface Propietario {
  nombre: string;
  numeroPropietario: number;
  totalPropietarios: number;
  tipoDocumento: string;
  numeroDocumento: string;
  direccion: string;
  // Datos adicionales del Reporte RUT
  razonSocial?: string;
  tipo?: string;
  seccional?: string;
  estado?: string;
  pais?: string;
  departamento?: string;
  municipio?: string;
  direccionRut?: string;
  telefono1?: string;
  telefono2?: string;
  correo?: string;
}

export interface ReporteRut {
  nit: string;
  razonSocial: string;
  tipo: string;
  seccional: string;
  estado: string;
  pais: string;
  departamento: string;
  municipio: string;
  direccion: string;
  telefono1: string;
  telefono2: string;
  correo: string;
}

export interface Predio {
  numeroPredialNacion: string;
  numeroPredial: string;
  codigoPredialAnterior: string;
  clasePredio: string;
  vereda: string;
  predio: string;
  mejora: string;
  destinacionEconomica: string;
  areaHectareas: number;
  areaMetros: number;
  areaConstruida: number;
  vigencia: number;
  avaluo: number;
  propietarios: Propietario[];
}

export interface PredioRaw {
  'Número Predial Nacion': string;
  'Numero Predal': string;
  'Código Predial Anterior': string;
  'Clase Predio': string;
  'Vereda': string;
  'Predio': string;
  'Mejora': string;
  'Propietario': string;
  'Número de Propietario': string;
  'Total Propietarios': string;
  'Tipo de Documento': string;
  'Número de Documento': string;
  'Dirección': string;
  'Destinación Económica': string;
  'Área en Hectareas': string;
  'Área en Metros': string;
  'Área Construida': string;
  'Vigencia': string;
  'Avaluo': string;
}
