import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { PropietarioRUT, AnalisisPredios, CSVParseResult, PredioIGAC, PropietarioIGAC, IGACParseResult } from '../models/predio-analysis.model';

@Injectable({
    providedIn: 'root'
})
export class PredioAnalysisService {
    private apiUrl = `${environment.apiUrl}/predios-analysis`;

    constructor(private http: HttpClient) { }

    /**
     * Parsea archivo CSV de propietarios
     */
    parseCSV(csvContent: string): CSVParseResult {
        const result: CSVParseResult = {
            propietarios: [],
            errores: []
        };

        try {
            const lines = csvContent.split('\n');
            
            // Saltar la primera línea (encabezados)
            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;

                const columns = this.parseCSVLine(line);
                
                // Verificar que tenga al menos 12 columnas
                if (columns.length < 12) {
                    if (columns[0]) { // Solo reportar error si hay datos
                        result.errores.push(`Línea ${i + 1}: Columnas insuficientes`);
                    }
                    continue;
                }

                // Crear objeto PropietarioRUT
                const propietario: PropietarioRUT = {
                    nit: columns[0] || '',
                    nombre_razon_social: columns[1] || '',
                    tipo: columns[2] || '',
                    seccional: columns[3] || '',
                    estado: columns[4] || '',
                    pais: columns[5] || '',
                    departamento: columns[6] || '',
                    municipio: columns[7] || '',
                    direccion: columns[8] || '',
                    telefono1: columns[9] || '',
                    telefono2: columns[10] || '',
                    correo: columns[11] || ''
                };

                // Solo agregar si tiene NIT válido
                if (propietario.nit && propietario.nombre_razon_social) {
                    result.propietarios.push(propietario);
                }
            }
        } catch (error: any) {
            result.errores.push(`Error al parsear CSV: ${error.message}`);
        }

        return result;
    }

    /**
     * Parsea archivo IGAC principal con predios y propietarios
     */
    parseIGAC(csvContent: string): IGACParseResult {
        const result: IGACParseResult = {
            predios: [],
            errores: []
        };

        try {
            const lines = csvContent.split('\n');
            const headers = this.parseCSVLine(lines[0]);
            
            // Buscar índices de columnas importantes (pueden variar)
            const nitIndex = this.findColumnIndex(headers, ['nit', 'cedula', 'cc', 'identificacion']);
            const nombreIndex = this.findColumnIndex(headers, ['nombre', 'razon_social', 'propietario']);
            const direccionIndex = this.findColumnIndex(headers, ['direccion', 'dir', 'ubicacion']);
            const areaIndex = this.findColumnIndex(headers, ['area', 'superficie', 'hectareas']);
            const fichaIndex = this.findColumnIndex(headers, ['ficha', 'numero_ficha', 'codigo']);
            const matriculaIndex = this.findColumnIndex(headers, ['matricula', 'matricula_inmobiliaria']);
            
            console.log('📋 Columnas detectadas en IGAC:', {
                nitIndex, nombreIndex, direccionIndex, areaIndex, fichaIndex, matriculaIndex
            });

            // Agrupar por predio (puede haber múltiples propietarios por predio)
            const prediosMap = new Map<string, PredioIGAC>();

            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;

                const columns = this.parseCSVLine(line);
                
                // Identificador único del predio (ficha o matrícula)
                const fichaId = fichaIndex >= 0 ? columns[fichaIndex] : '';
                const matriculaId = matriculaIndex >= 0 ? columns[matriculaIndex] : '';
                const predioId = fichaId || matriculaId || `predio_${i}`;

                // Obtener o crear predio
                let predio = prediosMap.get(predioId);
                if (!predio) {
                    predio = {
                        numeroFicha: fichaId,
                        matriculaInmobiliaria: matriculaId,
                        direccion: direccionIndex >= 0 ? columns[direccionIndex] : '',
                        area: areaIndex >= 0 ? parseFloat(columns[areaIndex]) || 0 : 0,
                        propietarios: [],
                        propietariosDetallados: []
                    };
                    prediosMap.set(predioId, predio);
                }

                // Agregar propietario
                const nit = nitIndex >= 0 ? columns[nitIndex]?.trim() : '';
                const nombre = nombreIndex >= 0 ? columns[nombreIndex] : '';
                
                if (nit) {
                    const propietario: PropietarioIGAC = {
                        nit: nit,
                        nombre: nombre
                    };
                    
                    // Evitar duplicados
                    const existe = predio.propietarios.some(p => p.nit === nit);
                    if (!existe) {
                        predio.propietarios.push(propietario);
                    }
                }
            }

            result.predios = Array.from(prediosMap.values());
            console.log(`✅ Parseados ${result.predios.length} predios del archivo IGAC`);

        } catch (error: any) {
            result.errores.push(`Error al parsear archivo IGAC: ${error.message}`);
            console.error('❌ Error parseando IGAC:', error);
        }

        return result;
    }

    /**
     * Encuentra índice de columna por varios nombres posibles
     */
    private findColumnIndex(headers: string[], possibleNames: string[]): number {
        const normalizedHeaders = headers.map(h => this.normalizeText(h));
        
        for (const name of possibleNames) {
            const normalizedName = this.normalizeText(name);
            const index = normalizedHeaders.findIndex(h => h.includes(normalizedName));
            if (index >= 0) return index;
        }
        
        return -1;
    }

    /**
     * Normaliza texto para comparación
     */
    private normalizeText(text: string): string {
        return text.toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Quitar acentos
            .replace(/[^a-z0-9]/g, ''); // Solo letras y números
    }

    /**
     * Complementa información de predios con datos de archivos RUT
     */
    complementarPrediosConRUT(predios: PredioIGAC[], propietariosRUT: PropietarioRUT[]): PredioIGAC[] {
        // Crear mapa de búsqueda rápida por NIT
        const rutMap = new Map<string, PropietarioRUT>();
        propietariosRUT.forEach(prop => {
            rutMap.set(prop.nit.trim(), prop);
        });

        console.log(`🔍 Complementando ${predios.length} predios con ${propietariosRUT.length} registros RUT`);

        let encontrados = 0;
        let noEncontrados = 0;

        // Complementar cada predio
        predios.forEach(predio => {
            predio.propietariosDetallados = [];
            
            predio.propietarios.forEach(propIGAC => {
                const propRUT = rutMap.get(propIGAC.nit.trim());
                
                if (propRUT) {
                    predio.propietariosDetallados!.push(propRUT);
                    encontrados++;
                } else {
                    // Crear registro básico con info de IGAC
                    const propBasico: PropietarioRUT = {
                        nit: propIGAC.nit,
                        nombre_razon_social: propIGAC.nombre || 'Sin información',
                        tipo: '',
                        seccional: '',
                        estado: 'Sin información RUT',
                        pais: '',
                        departamento: '',
                        municipio: '',
                        direccion: '',
                        telefono1: '',
                        telefono2: '',
                        correo: ''
                    };
                    predio.propietariosDetallados!.push(propBasico);
                    noEncontrados++;
                }
            });
        });

        console.log(`✅ Propietarios encontrados: ${encontrados}`);
        console.log(`⚠️ Propietarios no encontrados: ${noEncontrados}`);

        return predios;
    }

    /**
     * Parsea una línea CSV respetando comillas
     */
    private parseCSVLine(line: string): string[] {
        const result: string[] = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];

            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ';' && !inQuotes) {
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        
        result.push(current.trim());
        return result;
    }

    /**
     * Analiza predios con propietarios complementados
     */
    analizarPredios(predios: PredioIGAC[]): AnalisisPredios {
        // Recolectar todos los propietarios únicos
        const propietariosUnicos = new Map<string, PropietarioRUT>();
        let propietariosEncontrados = 0;
        let propietariosNoEncontrados = 0;

        predios.forEach(predio => {
            predio.propietariosDetallados?.forEach(prop => {
                if (!propietariosUnicos.has(prop.nit)) {
                    propietariosUnicos.set(prop.nit, prop);
                    
                    if (prop.estado === 'Sin información RUT') {
                        propietariosNoEncontrados++;
                    } else {
                        propietariosEncontrados++;
                    }
                }
            });
        });

        const propietarios = Array.from(propietariosUnicos.values());
        
        // Calcular distribución por cantidad de propietarios
        const prediosPorCantidad: { [key: string]: number } = {};
        predios.forEach(predio => {
            const cantidad = predio.propietarios.length;
            const key = cantidad === 1 ? '1 propietario' : 
                       cantidad === 2 ? '2 propietarios' :
                       cantidad <= 5 ? '3-5 propietarios' :
                       '6+ propietarios';
            prediosPorCantidad[key] = (prediosPorCantidad[key] || 0) + 1;
        });

        const analisis: AnalisisPredios = {
            totalPredios: predios.length,
            totalPropietarios: propietarios.length,
            propietariosEncontrados,
            propietariosNoEncontrados,
            propietariosPorEstado: {},
            propietariosPorDepartamento: {},
            propietariosPorMunicipio: {},
            propietariosPorTipo: {},
            propietariosSinContacto: 0,
            propietariosConCorreo: 0,
            prediosPorCantidadPropietarios: prediosPorCantidad,
            topMunicipios: [],
            topDepartamentos: [],
            distribuciones: {
                estadosActivos: 0,
                estadosSuspendidos: 0,
                estadosCancelados: 0,
                personasNaturales: 0,
                personasJuridicas: 0
            },
            predios
        };

        // Analizar cada propietario
        propietarios.forEach(prop => {
            // Estado
            if (!analisis.propietariosPorEstado[prop.estado]) {
                analisis.propietariosPorEstado[prop.estado] = 0;
            }
            analisis.propietariosPorEstado[prop.estado]++;

            // Distribuciones de estado
            if (prop.estado.toUpperCase().includes('ACTIVO')) {
                analisis.distribuciones.estadosActivos++;
            } else if (prop.estado.toUpperCase().includes('SUSPENSION')) {
                analisis.distribuciones.estadosSuspendidos++;
            } else if (prop.estado.toUpperCase().includes('CANCELADO')) {
                analisis.distribuciones.estadosCancelados++;
            }

            // Departamento
            if (prop.departamento) {
                if (!analisis.propietariosPorDepartamento[prop.departamento]) {
                    analisis.propietariosPorDepartamento[prop.departamento] = 0;
                }
                analisis.propietariosPorDepartamento[prop.departamento]++;
            }

            // Municipio
            if (prop.municipio) {
                if (!analisis.propietariosPorMunicipio[prop.municipio]) {
                    analisis.propietariosPorMunicipio[prop.municipio] = 0;
                }
                analisis.propietariosPorMunicipio[prop.municipio]++;
            }

            // Tipo
            if (!analisis.propietariosPorTipo[prop.tipo]) {
                analisis.propietariosPorTipo[prop.tipo] = 0;
            }
            analisis.propietariosPorTipo[prop.tipo]++;

            // Distribuciones de tipo
            if (prop.tipo.toUpperCase().includes('NATURAL')) {
                analisis.distribuciones.personasNaturales++;
            } else if (prop.tipo.toUpperCase().includes('JURIDICA')) {
                analisis.distribuciones.personasJuridicas++;
            }

            // Contacto
            if (!prop.telefono1 && !prop.telefono2 && !prop.correo) {
                analisis.propietariosSinContacto++;
            }

            if (prop.correo) {
                analisis.propietariosConCorreo++;
            }
        });

        // Top 10 municipios
        analisis.topMunicipios = Object.entries(analisis.propietariosPorMunicipio)
            .map(([municipio, cantidad]) => ({ municipio, cantidad }))
            .sort((a, b) => b.cantidad - a.cantidad)
            .slice(0, 10);

        // Top 10 departamentos
        analisis.topDepartamentos = Object.entries(analisis.propietariosPorDepartamento)
            .map(([departamento, cantidad]) => ({ departamento, cantidad }))
            .sort((a, b) => b.cantidad - a.cantidad)
            .slice(0, 10);

        return analisis;
    }

    /**
     * Analiza lista de propietarios y genera estadísticas (método legacy)
     */
    analizarPropietarios(propietarios: PropietarioRUT[]): AnalisisPredios {
        const analisis: AnalisisPredios = {
            totalPredios: 0,
            totalPropietarios: propietarios.length,
            propietariosEncontrados: propietarios.length,
            propietariosNoEncontrados: 0,
            propietariosPorEstado: {},
            propietariosPorDepartamento: {},
            propietariosPorMunicipio: {},
            propietariosPorTipo: {},
            propietariosSinContacto: 0,
            propietariosConCorreo: 0,
            prediosPorCantidadPropietarios: {},
            topMunicipios: [],
            topDepartamentos: [],
            distribuciones: {
                estadosActivos: 0,
                estadosSuspendidos: 0,
                estadosCancelados: 0,
                personasNaturales: 0,
                personasJuridicas: 0
            }
        };

        // Analizar cada propietario
        propietarios.forEach(prop => {
            // Estado
            if (!analisis.propietariosPorEstado[prop.estado]) {
                analisis.propietariosPorEstado[prop.estado] = 0;
            }
            analisis.propietariosPorEstado[prop.estado]++;

            // Distribuciones de estado
            if (prop.estado.toUpperCase().includes('ACTIVO')) {
                analisis.distribuciones.estadosActivos++;
            } else if (prop.estado.toUpperCase().includes('SUSPENSION')) {
                analisis.distribuciones.estadosSuspendidos++;
            } else if (prop.estado.toUpperCase().includes('CANCELADO')) {
                analisis.distribuciones.estadosCancelados++;
            }

            // Departamento
            if (prop.departamento) {
                if (!analisis.propietariosPorDepartamento[prop.departamento]) {
                    analisis.propietariosPorDepartamento[prop.departamento] = 0;
                }
                analisis.propietariosPorDepartamento[prop.departamento]++;
            }

            // Municipio
            if (prop.municipio) {
                if (!analisis.propietariosPorMunicipio[prop.municipio]) {
                    analisis.propietariosPorMunicipio[prop.municipio] = 0;
                }
                analisis.propietariosPorMunicipio[prop.municipio]++;
            }

            // Tipo
            if (!analisis.propietariosPorTipo[prop.tipo]) {
                analisis.propietariosPorTipo[prop.tipo] = 0;
            }
            analisis.propietariosPorTipo[prop.tipo]++;

            // Distribuciones de tipo
            if (prop.tipo.toUpperCase().includes('NATURAL')) {
                analisis.distribuciones.personasNaturales++;
            } else if (prop.tipo.toUpperCase().includes('JURIDICA')) {
                analisis.distribuciones.personasJuridicas++;
            }

            // Contacto
            if (!prop.telefono1 && !prop.telefono2 && !prop.correo) {
                analisis.propietariosSinContacto++;
            }

            if (prop.correo) {
                analisis.propietariosConCorreo++;
            }
        });

        // Top 10 municipios
        analisis.topMunicipios = Object.entries(analisis.propietariosPorMunicipio)
            .map(([municipio, cantidad]) => ({ municipio, cantidad }))
            .sort((a, b) => b.cantidad - a.cantidad)
            .slice(0, 10);

        // Top 10 departamentos
        analisis.topDepartamentos = Object.entries(analisis.propietariosPorDepartamento)
            .map(([departamento, cantidad]) => ({ departamento, cantidad }))
            .sort((a, b) => b.cantidad - a.cantidad)
            .slice(0, 10);

        return analisis;
    }

    /**
     * Procesa múltiples archivos CSV
     */
    procesarArchivosCSV(files: File[]): Observable<AnalisisPredios> {
        const formData = new FormData();
        files.forEach((file, index) => {
            formData.append(`files`, file);
        });

        return this.http.post<AnalisisPredios>(`${this.apiUrl}/procesar`, formData);
    }

    /**
     * Lee archivo como texto
     */
    readFileAsText(file: File): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target?.result as string);
            reader.onerror = (e) => reject(e);
            reader.readAsText(file, 'UTF-8');
        });
    }
}
