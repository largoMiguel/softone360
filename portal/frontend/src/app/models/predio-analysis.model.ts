// Modelos para análisis de predios y propietarios

export interface PropietarioRUT {
    nit: string;
    nombre_razon_social: string;
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

// Propietario del archivo IGAC
export interface PropietarioIGAC {
    nit: string;
    nombre?: string;
    porcentaje?: number;
}

// Predio del archivo IGAC principal
export interface PredioIGAC {
    numeroFicha?: string;
    matriculaInmobiliaria?: string;
    cedula?: string;
    direccion?: string;
    area?: number;
    propietarios: PropietarioIGAC[];
    propietariosDetallados?: PropietarioRUT[]; // Información complementada
}

export interface Predio {
    codigo: string;
    direccion: string;
    area: number;
    propietarios: PropietarioRUT[];
}

export interface AnalisisPredios {
    totalPredios: number;
    totalPropietarios: number;
    propietariosEncontrados: number; // Propietarios con info complementada
    propietariosNoEncontrados: number; // Sin info en archivos RUT
    propietariosPorEstado: { [estado: string]: number };
    propietariosPorDepartamento: { [departamento: string]: number };
    propietariosPorMunicipio: { [municipio: string]: number };
    propietariosPorTipo: { [tipo: string]: number };
    propietariosSinContacto: number;
    propietariosConCorreo: number;
    prediosPorCantidadPropietarios: { [cantidad: string]: number };
    topMunicipios: Array<{ municipio: string; cantidad: number }>;
    topDepartamentos: Array<{ departamento: string; cantidad: number }>;
    distribuciones: {
        estadosActivos: number;
        estadosSuspendidos: number;
        estadosCancelados: number;
        personasNaturales: number;
        personasJuridicas: number;
    };
    predios?: PredioIGAC[]; // Lista de predios con propietarios
}

export interface CSVParseResult {
    propietarios: PropietarioRUT[];
    errores: string[];
}

export interface IGACParseResult {
    predios: PredioIGAC[];
    errores: string[];
}
