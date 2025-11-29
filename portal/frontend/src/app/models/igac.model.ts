export interface Propietario {
  nombre: string;
  numeroPropietario: number;
  totalPropietarios: number;
  tipoDocumento: string;
  numeroDocumento: string;
  direccion: string;
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
