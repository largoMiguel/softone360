import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, firstValueFrom } from 'rxjs';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import * as XLSX from 'xlsx';
import {
    PDMData,
    AnalisisPDM,
    LineaEstrategica,
    IndicadorResultado,
    PlanIndicativoProducto,
    IniciativaSGR,
    PlanIndicativoSGR,
    EstadoMeta,
    FiltrosPDM
} from './pdm.models';
import { environment } from '../../../environments/environment';
import { PdmBackendService } from '../../services/pdm-backend.service';

interface ExcelInfoResponse {
    existe: boolean;
    nombre_archivo?: string;
    tamanio?: number;
    fecha_carga?: string;
}

interface ExcelUploadResponse {
    entity_id: number;
    nombre_archivo: string;
    tamanio: number;
    created_at: string;
    mensaje: string;
}

@Injectable({
    providedIn: 'root'
})
export class PdmDataService {
    private readonly CACHE_KEY = 'pdm_data_cache';
    private readonly CACHE_VERSION = '1.0.0';
    private readonly CACHE_EXPIRATION_DAYS = 30;

    private pdmDataSubject = new BehaviorSubject<PDMData | null>(null);
    private analisisSubject = new BehaviorSubject<AnalisisPDM | null>(null);
    private cargandoSubject = new BehaviorSubject<boolean>(false);

    pdmData$ = this.pdmDataSubject.asObservable();
    analisis$ = this.analisisSubject.asObservable();
    cargando$ = this.cargandoSubject.asObservable();

    private http = inject(HttpClient);
    private pdmBackend = inject(PdmBackendService);
    private apiUrl = environment.apiUrl;

    constructor() {
        this.cargarDatosDesdCache();
    }

    /**
     * Carga los datos desde el caché si existen y son válidos
     */
    private cargarDatosDesdCache(): void {
        try {
            const cacheString = localStorage.getItem(this.CACHE_KEY);
            if (!cacheString) return;

            const cache = JSON.parse(cacheString);

            // Validar versión
            if (cache.version !== this.CACHE_VERSION) {
                this.limpiarCache();
                return;
            }

            // Validar expiración
            const fechaCache = new Date(cache.timestamp);
            const fechaActual = new Date();
            const diasDiferencia = Math.floor((fechaActual.getTime() - fechaCache.getTime()) / (1000 * 60 * 60 * 24));

            if (diasDiferencia > this.CACHE_EXPIRATION_DAYS) {
                this.limpiarCache();
                return;
            }

            // Cargar datos
            if (cache.pdmData && cache.analisis) {
                // Recalcular estados según fecha actual
                this.calcularEstadosYAvances(cache.pdmData);

                this.pdmDataSubject.next(cache.pdmData);
                this.analisisSubject.next(cache.analisis);
            }
        } catch (error) {
            console.error('Error al cargar datos desde caché:', error);
            this.limpiarCache();
        }
    }

    /**
     * Guarda los datos en el caché
     */
    private guardarDatosEnCache(pdmData: PDMData, analisis: AnalisisPDM): void {
        try {
            const cache = {
                version: this.CACHE_VERSION,
                timestamp: new Date().toISOString(),
                pdmData,
                analisis
            };
            localStorage.setItem(this.CACHE_KEY, JSON.stringify(cache));
        } catch (error) {
            console.error('Error al guardar datos en caché:', error);
            // Si el localStorage está lleno, limpiar y reintentar
            this.limpiarCache();
            try {
                const cache = {
                    version: this.CACHE_VERSION,
                    timestamp: new Date().toISOString(),
                    pdmData,
                    analisis
                };
                localStorage.setItem(this.CACHE_KEY, JSON.stringify(cache));
            } catch (retryError) {
                console.error('Error al guardar datos en caché (reintento):', retryError);
            }
        }
    }

    /**
     * Limpia el caché
     */
    private limpiarCache(): void {
        localStorage.removeItem(this.CACHE_KEY);
    }

    /**
     * Obtiene información del caché actual
     */
    obtenerInfoCache(): { existe: boolean; fecha?: Date; version?: string } {
        try {
            const cacheString = localStorage.getItem(this.CACHE_KEY);
            if (!cacheString) return { existe: false };

            const cache = JSON.parse(cacheString);
            return {
                existe: true,
                fecha: new Date(cache.timestamp),
                version: cache.version
            };
        } catch (error) {
            return { existe: false };
        }
    }

    /**
     * Verifica si hay datos en caché
     */
    tieneDatosEnCache(): boolean {
        return this.pdmDataSubject.value !== null;
    }

    /**
     * Procesa un archivo Excel con las 5 hojas del PDM
     */
    procesarArchivoExcel(file: File): Promise<PDMData> {
        return new Promise((resolve, reject) => {
            this.cargandoSubject.next(true);

            const reader = new FileReader();

            reader.onload = (e: any) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });

                    // Validar que existan las hojas necesarias
                    const hojasRequeridas = [
                        'Líneas estratégicas',
                        'Indicadores de resultado',
                        'Plan indicativo - Productos',
                        'Iniciativas SGR',
                        'Plan indicativo SGR - Produc'
                    ];

                    const pdmData: PDMData = {
                        lineasEstrategicas: this.procesarLineasEstrategicas(workbook),
                        indicadoresResultado: this.procesarIndicadoresResultado(workbook),
                        planIndicativoProductos: this.procesarPlanIndicativoProductos(workbook),
                        iniciativasSGR: this.procesarIniciativasSGR(workbook),
                        planIndicativoSGR: this.procesarPlanIndicativoSGR(workbook),
                        metadata: {
                            fechaCarga: new Date(),
                            nombreArchivo: file.name,
                            totalRegistros: 0
                        }
                    };

                    // Calcular total de registros
                    pdmData.metadata.totalRegistros =
                        pdmData.lineasEstrategicas.length +
                        pdmData.indicadoresResultado.length +
                        pdmData.planIndicativoProductos.length +
                        pdmData.iniciativasSGR.length +
                        pdmData.planIndicativoSGR.length;

                    // Calcular estados y avances
                    this.calcularEstadosYAvances(pdmData);

                    // Actualizar sujetos
                    this.pdmDataSubject.next(pdmData);

                    // Generar análisis
                    const analisis = this.generarAnalisis(pdmData);
                    this.analisisSubject.next(analisis);

                    // Guardar en caché
                    this.guardarDatosEnCache(pdmData, analisis);

                    this.cargandoSubject.next(false);
                    resolve(pdmData);
                } catch (error) {
                    this.cargandoSubject.next(false);
                    reject(error);
                }
            };

            reader.onerror = (error) => {
                this.cargandoSubject.next(false);
                reject(error);
            };

            reader.readAsArrayBuffer(file);
        });
    }

    private procesarLineasEstrategicas(workbook: XLSX.WorkBook): LineaEstrategica[] {
        const nombreHoja = this.encontrarHoja(workbook, ['Líneas estratégicas', 'LÍNEAS ESTRATÉGICAS', 'Lineas estrategicas']);
        if (!nombreHoja) return [];

        const worksheet = workbook.Sheets[nombreHoja];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        return this.mapearDatos(jsonData, (row: any[]) => ({
            codigoDane: this.limpiarValor(row[0]),
            entidadTerritorial: this.limpiarValor(row[1]),
            nombrePlan: this.limpiarValor(row[2]),
            consecutivo: this.limpiarValor(row[3]),
            lineaEstrategica: this.limpiarValor(row[4])
        }));
    }

    private procesarIndicadoresResultado(workbook: XLSX.WorkBook): IndicadorResultado[] {
        const nombreHoja = this.encontrarHoja(workbook, ['Indicadores de resultado', 'INDICADORES DE RESULTADO']);
        if (!nombreHoja) return [];

        const worksheet = workbook.Sheets[nombreHoja];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        return this.mapearDatos(jsonData, (row: any[]) => ({
            codigoDane: this.limpiarValor(row[0]),
            entidadTerritorial: this.limpiarValor(row[1]),
            nombrePlan: this.limpiarValor(row[2]),
            consecutivo: this.limpiarValor(row[3]),
            lineaEstrategica: this.limpiarValor(row[4]),
            indicadorResultado: this.limpiarValor(row[5]),
            estaEnPND: this.limpiarValor(row[6]),
            metaCuatrienio: this.convertirNumero(row[7]),
            transformacionPND: this.limpiarValor(row[8])
        }));
    }

    private procesarPlanIndicativoProductos(workbook: XLSX.WorkBook): PlanIndicativoProducto[] {
        const nombreHoja = this.encontrarHoja(workbook, ['Plan indicativo - Productos', 'PLAN INDICATIVO', 'Plan indicativo']);
        if (!nombreHoja) return [];

        const worksheet = workbook.Sheets[nombreHoja];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        return this.mapearDatos(jsonData, (row: any[]) => ({
            codigoDane: this.limpiarValor(row[0]),
            entidadTerritorial: this.limpiarValor(row[1]),
            nombrePlan: this.limpiarValor(row[2]),
            codigoIndicador: this.limpiarValor(row[3]),
            lineaEstrategica: this.limpiarValor(row[4]),
            codigoSector: this.limpiarValor(row[5]),
            sector: this.limpiarValor(row[6]),
            codigoPrograma: this.limpiarValor(row[7]),
            programa: this.limpiarValor(row[8]),
            codigoProducto: this.limpiarValor(row[9]),
            producto: this.limpiarValor(row[10]),
            codigoIndicadorProducto: this.limpiarValor(row[11]),
            indicadorProducto: this.limpiarValor(row[12]),
            personalizacion: this.limpiarValor(row[13]),
            unidadMedida: this.limpiarValor(row[14]),
            metaCuatrienio: this.convertirNumero(row[15]),
            principal: this.limpiarValor(row[16]),
            codigoODS: this.limpiarValor(row[17]),
            ods: this.limpiarValor(row[18]),
            tipoAcumulacion: this.limpiarValor(row[19]),
            programacion2024: this.convertirNumero(row[20]),
            programacion2025: this.convertirNumero(row[21]),
            programacion2026: this.convertirNumero(row[22]),
            programacion2027: this.convertirNumero(row[23]),
            total2024: this.convertirNumero(row[38]),
            total2025: this.convertirNumero(row[53]),
            total2026: this.convertirNumero(row[68]),
            total2027: this.convertirNumero(row[83]),
            bpin: this.limpiarValor(row[84]),
            // Inicializar metas con las programaciones
            meta2024: this.convertirNumero(row[20]),
            meta2025: this.convertirNumero(row[21]),
            meta2026: this.convertirNumero(row[22]),
            meta2027: this.convertirNumero(row[23])
        }));
    }

    private procesarIniciativasSGR(workbook: XLSX.WorkBook): IniciativaSGR[] {
        const nombreHoja = this.encontrarHoja(workbook, ['Iniciativas SGR', 'INICIATIVAS SGR']);
        if (!nombreHoja) return [];

        const worksheet = workbook.Sheets[nombreHoja];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        return this.mapearDatos(jsonData, (row: any[]) => ({
            codigoDane: this.limpiarValor(row[0]),
            entidadTerritorial: this.limpiarValor(row[1]),
            nombrePlan: this.limpiarValor(row[2]),
            consecutivo: this.limpiarValor(row[3]),
            lineaEstrategica: this.limpiarValor(row[4]),
            tipoIniciativa: this.limpiarValor(row[5]),
            sector: this.limpiarValor(row[6]),
            iniciativaSGR: this.limpiarValor(row[7]),
            recursosSGR: this.convertirNumero(row[8]),
            bpin: this.limpiarValor(row[9])
        }));
    }

    private procesarPlanIndicativoSGR(workbook: XLSX.WorkBook): PlanIndicativoSGR[] {
        const nombreHoja = this.encontrarHoja(workbook, ['Plan indicativo SGR - Produc', 'Plan indicativo SGR', 'PLAN INDICATIVO SGR']);
        if (!nombreHoja) return [];

        const worksheet = workbook.Sheets[nombreHoja];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        return this.mapearDatos(jsonData, (row: any[]) => ({
            codigoDane: this.limpiarValor(row[0]),
            entidadTerritorial: this.limpiarValor(row[1]),
            nombrePlan: this.limpiarValor(row[2]),
            codigoIndicador: this.limpiarValor(row[3]),
            iniciativaSGR: this.limpiarValor(row[4]),
            codigoSector: this.limpiarValor(row[5]),
            sector: this.limpiarValor(row[6]),
            codigoPrograma: this.limpiarValor(row[7]),
            programa: this.limpiarValor(row[8]),
            codigoProducto: this.limpiarValor(row[9]),
            producto: this.limpiarValor(row[10]),
            codigoIndicadorProducto: this.limpiarValor(row[11]),
            indicadorProducto: this.limpiarValor(row[12]),
            personalizacion: this.limpiarValor(row[13]),
            unidadMedida: this.limpiarValor(row[14]),
            metaCuatrienio: this.convertirNumero(row[15]),
            principal: this.limpiarValor(row[16]),
            codigoODS: this.limpiarValor(row[17]),
            ods: this.limpiarValor(row[18]),
            tipoAcumulacion: this.limpiarValor(row[19]),
            cofinanciado: this.limpiarValor(row[20]),
            programacion20232024: this.convertirNumero(row[21]),
            programacion20252026: this.convertirNumero(row[22]),
            programacion20272028: this.convertirNumero(row[23]),
            recursosSGR20232024: this.convertirNumero(row[24]),
            recursosSGR20252026: this.convertirNumero(row[25]),
            recursosSGR20272028: this.convertirNumero(row[26]),
            bpin: this.limpiarValor(row[27])
        }));
    }

    private calcularEstadosYAvances(pdmData: PDMData): void {
        const añoActual = new Date().getFullYear();

        pdmData.planIndicativoProductos.forEach(producto => {
            const presupuestoTotalProducto = (producto.total2024 || 0) + (producto.total2025 || 0) + (producto.total2026 || 0) + (producto.total2027 || 0);

            // Si no tiene presupuesto, marcamos como Sin Definir y avance 0
            if (presupuestoTotalProducto <= 0) {
                producto.avance = 0;
                producto.estado = EstadoMeta.SIN_DEFINIR;
                return;
            }

            // NUEVA LÓGICA: Calcular avance basándose en actividades con ejecución real
            const actividades = producto.actividades || [];

            // Calcular meta total del cuatrienio
            const metaTotalCuatrienio = producto.metaCuatrienio || 0;

            // Sumar valor_ejecutado de todas las actividades (lo realmente ejecutado)
            const totalValorEjecutado = actividades.reduce((sum, act) => sum + (act.valor_ejecutado || 0), 0);

            // Si no hay actividades con ejecución registrada, el avance es 0
            if (totalValorEjecutado === 0) {
                producto.avance = 0;
                const tieneActividadesAsignadas = actividades.some(act => (act.meta_ejecutar || 0) > 0);
                producto.estado = tieneActividadesAsignadas ? EstadoMeta.POR_CUMPLIR : EstadoMeta.SIN_DEFINIR;
                return;
            }

            // Calcular avance: lo ejecutado vs la meta total del producto
            producto.avance = metaTotalCuatrienio > 0 ? (totalValorEjecutado / metaTotalCuatrienio) * 100 : 0;

            // Determinar estado basándose en avance real
            if (producto.avance >= 100) {
                producto.estado = EstadoMeta.CUMPLIDA;
            } else if (producto.avance >= 50) {
                producto.estado = EstadoMeta.EN_PROGRESO;
            } else if (producto.avance > 0) {
                producto.estado = EstadoMeta.PENDIENTE;
            } else {
                producto.estado = EstadoMeta.POR_CUMPLIR;
            }
        });
    }

    private generarAnalisis(pdmData: PDMData): AnalisisPDM {
        const productos = pdmData.planIndicativoProductos;
        const productosConPresupuesto = productos.filter(p =>
            (p.total2024 || 0) + (p.total2025 || 0) + (p.total2026 || 0) + (p.total2027 || 0) > 0
        );

        // Indicadores generales
        const totalMetas = productosConPresupuesto.length;
        const metasCumplidas = productosConPresupuesto.filter(p => p.estado === EstadoMeta.CUMPLIDA).length;
        const metasEnProgreso = productosConPresupuesto.filter(p => p.estado === EstadoMeta.EN_PROGRESO).length;
        const metasPorCumplir = productosConPresupuesto.filter(p => p.estado === EstadoMeta.POR_CUMPLIR).length;
        const metasPendientes = productosConPresupuesto.filter(p => p.estado === EstadoMeta.PENDIENTE).length;
        const porcentajeCumplimiento = totalMetas > 0 ? (metasCumplidas / totalMetas) * 100 : 0;

        // Análisis por año
        const analisisPorAnio = [2024, 2025, 2026, 2027].map(anio => {
            // Solo cuentan las metas cuyo producto tiene presupuesto > 0 en ese año
            const metasAnio = productosConPresupuesto.filter(p => {
                const totalAnio = anio === 2024 ? p.total2024 :
                    anio === 2025 ? p.total2025 :
                        anio === 2026 ? p.total2026 :
                            p.total2027;
                return (totalAnio || 0) > 0;
            });

            const presupuestoTotal = productos.reduce((sum, p) => {
                const total = anio === 2024 ? p.total2024 :
                    anio === 2025 ? p.total2025 :
                        anio === 2026 ? p.total2026 :
                            p.total2027;
                return sum + total;
            }, 0);

            // Usar estado específico del año si existe, sino usar estado general
            const metasCumplidasAnio = metasAnio.filter(p => {
                const estadoDelAnio = p.estadosPorAnio?.[anio as 2024 | 2025 | 2026 | 2027];
                return estadoDelAnio === EstadoMeta.CUMPLIDA;
            }).length;

            return {
                anio,
                totalMetas: metasAnio.length,
                metasCumplidas: metasCumplidasAnio,
                porcentajeCumplimiento: metasAnio.length > 0
                    ? (metasCumplidasAnio / metasAnio.length) * 100
                    : 0,
                presupuestoTotal
            };
        });

        // Análisis por sector
        const sectoresUnicos = [...new Set(productosConPresupuesto.map(p => p.sector))].filter(s => s);
        const analisisPorSector = sectoresUnicos.map(sector => {
            const metasSector = productosConPresupuesto.filter(p => p.sector === sector);
            const cumplidas = metasSector.filter(p => p.estado === EstadoMeta.CUMPLIDA).length;
            const presupuestoTotal = metasSector.reduce((sum, p) =>
                sum + p.total2024 + p.total2025 + p.total2026 + p.total2027, 0);

            return {
                sector,
                totalMetas: metasSector.length,
                metasCumplidas: cumplidas,
                porcentajeCumplimiento: metasSector.length > 0 ? (cumplidas / metasSector.length) * 100 : 0,
                presupuestoTotal
            };
        }).sort((a, b) => b.porcentajeCumplimiento - a.porcentajeCumplimiento);

        // Análisis por línea estratégica
        const lineasUnicas = [...new Set(productosConPresupuesto.map(p => p.lineaEstrategica))].filter(l => l);
        const analisisPorLineaEstrategica = lineasUnicas.map(linea => {
            const metasLinea = productosConPresupuesto.filter(p => p.lineaEstrategica === linea);
            const cumplidas = metasLinea.filter(p => p.estado === EstadoMeta.CUMPLIDA).length;

            return {
                lineaEstrategica: linea,
                totalMetas: metasLinea.length,
                metasCumplidas: cumplidas,
                porcentajeCumplimiento: metasLinea.length > 0 ? (cumplidas / metasLinea.length) * 100 : 0
            };
        }).sort((a, b) => b.porcentajeCumplimiento - a.porcentajeCumplimiento);

        // Análisis por ODS (Objetivos de Desarrollo Sostenible)
        const odsMap = new Map<string, { nombre: string; metas: typeof productos }>();
        productosConPresupuesto.forEach(p => {
            if (p.codigoODS && p.ods) {
                const key = `${p.codigoODS}`;
                if (!odsMap.has(key)) {
                    odsMap.set(key, { nombre: p.ods, metas: [] });
                }
                odsMap.get(key)!.metas.push(p);
            }
        });

        const analisisPorODS = Array.from(odsMap.entries()).map(([codigo, data]) => {
            const cumplidas = data.metas.filter(p => p.estado === EstadoMeta.CUMPLIDA).length;
            const presupuestoTotal = data.metas.reduce((sum, p) =>
                sum + p.total2024 + p.total2025 + p.total2026 + p.total2027, 0);

            return {
                codigoODS: codigo,
                nombreODS: data.nombre,
                totalMetas: data.metas.length,
                metasCumplidas: cumplidas,
                porcentajeCumplimiento: data.metas.length > 0 ? (cumplidas / data.metas.length) * 100 : 0,
                presupuestoTotal
            };
        }).sort((a, b) => b.totalMetas - a.totalMetas);

        // Análisis de Iniciativas SGR
        const iniciativasSGR = pdmData.iniciativasSGR || [];
        const recursosSGRTotales = iniciativasSGR.reduce((sum, i) => sum + (i.recursosSGR || 0), 0);

        const sgrPorSector = new Map<string, { total: number; count: number }>();
        iniciativasSGR.forEach(i => {
            const sector = i.sector || 'Sin sector';
            if (!sgrPorSector.has(sector)) {
                sgrPorSector.set(sector, { total: 0, count: 0 });
            }
            const data = sgrPorSector.get(sector)!;
            data.total += i.recursosSGR || 0;
            data.count += 1;
        });

        const recursosSGRPorSector = Array.from(sgrPorSector.entries())
            .map(([sector, data]) => ({
                sector,
                totalRecursosSGR: data.total,
                numeroIniciativas: data.count
            }))
            .sort((a, b) => b.totalRecursosSGR - a.totalRecursosSGR);

        const analisisSGR = {
            totalIniciativas: iniciativasSGR.length,
            recursosSGRTotales,
            recursosSGRPorSector,
            iniciativasConBPIN: iniciativasSGR.filter(i => i.bpin && i.bpin.trim() !== '').length,
            iniciativasSinBPIN: iniciativasSGR.filter(i => !i.bpin || i.bpin.trim() === '').length
        };

        // Análisis de Indicadores de Resultado
        const indicadoresResultado = pdmData.indicadoresResultado || [];
        const totalIndicadores = indicadoresResultado.length;
        const indicadoresEnPND = indicadoresResultado.filter(i =>
            i.estaEnPND && i.estaEnPND.toLowerCase() === 'si'
        ).length;
        const indicadoresFueraPND = totalIndicadores - indicadoresEnPND;
        const porcentajeAlineacionPND = totalIndicadores > 0
            ? (indicadoresEnPND / totalIndicadores) * 100
            : 0;

        // Agrupar indicadores por línea estratégica
        const indicadoresPorLineaMap = new Map<string, {
            total: number;
            enPND: number;
            metaTotal: number;
        }>();

        indicadoresResultado.forEach(ind => {
            const linea = ind.lineaEstrategica || 'Sin línea';
            if (!indicadoresPorLineaMap.has(linea)) {
                indicadoresPorLineaMap.set(linea, { total: 0, enPND: 0, metaTotal: 0 });
            }
            const data = indicadoresPorLineaMap.get(linea)!;
            data.total += 1;
            if (ind.estaEnPND && ind.estaEnPND.toLowerCase() === 'si') {
                data.enPND += 1;
            }
            data.metaTotal += ind.metaCuatrienio || 0;
        });

        const indicadoresPorLinea = Array.from(indicadoresPorLineaMap.entries())
            .map(([linea, data]) => ({
                lineaEstrategica: linea,
                totalIndicadores: data.total,
                indicadoresEnPND: data.enPND,
                metaCuatrienioTotal: data.metaTotal
            }))
            .sort((a, b) => b.totalIndicadores - a.totalIndicadores);

        // Agrupar por transformaciones PND
        const transformacionesMap = new Map<string, number>();
        indicadoresResultado.forEach(ind => {
            if (ind.transformacionPND && ind.transformacionPND.trim() !== '') {
                const transformacion = ind.transformacionPND;
                transformacionesMap.set(
                    transformacion,
                    (transformacionesMap.get(transformacion) || 0) + 1
                );
            }
        });

        const transformacionesPND = Array.from(transformacionesMap.entries())
            .map(([transformacion, count]) => ({
                transformacion,
                numeroIndicadores: count
            }))
            .sort((a, b) => b.numeroIndicadores - a.numeroIndicadores);

        const analisisIndicadoresResultado = {
            totalIndicadores,
            indicadoresEnPND,
            indicadoresFueraPND,
            porcentajeAlineacionPND,
            indicadoresPorLinea,
            transformacionesPND
        };

        // Análisis de Presupuesto Detallado (Ordinario vs SGR)
        // Calcular presupuesto ordinario (de planIndicativoProductos)
        const presupuestoOrdinarioTotal = productos.reduce((sum, p) =>
            sum + p.total2024 + p.total2025 + p.total2026 + p.total2027, 0);

        // Calcular presupuesto SGR (de planIndicativoSGR)
        const productosSGR = pdmData.planIndicativoSGR || [];
        const presupuestoSGRTotal = productosSGR.reduce((sum, p) =>
            sum + (p.recursosSGR20232024 || 0) + (p.recursosSGR20252026 || 0) + (p.recursosSGR20272028 || 0), 0);

        const presupuestoGrandTotal = presupuestoOrdinarioTotal + presupuestoSGRTotal;
        const porcentajeOrdinario = presupuestoGrandTotal > 0
            ? (presupuestoOrdinarioTotal / presupuestoGrandTotal) * 100
            : 0;
        const porcentajeSGR = presupuestoGrandTotal > 0
            ? (presupuestoSGRTotal / presupuestoGrandTotal) * 100
            : 0;

        // Presupuesto por año (combinando ordinario y SGR)
        const presupuestoPorAnio = [
            {
                anio: 2024,
                ordinario: productos.reduce((sum, p) => sum + p.total2024, 0),
                sgr: productosSGR.reduce((sum, p) => sum + (p.recursosSGR20232024 || 0) / 2, 0), // Aproximado
                total: 0
            },
            {
                anio: 2025,
                ordinario: productos.reduce((sum, p) => sum + p.total2025, 0),
                sgr: productosSGR.reduce((sum, p) => sum + (p.recursosSGR20252026 || 0) / 2, 0),
                total: 0
            },
            {
                anio: 2026,
                ordinario: productos.reduce((sum, p) => sum + p.total2026, 0),
                sgr: productosSGR.reduce((sum, p) => sum + (p.recursosSGR20252026 || 0) / 2, 0),
                total: 0
            },
            {
                anio: 2027,
                ordinario: productos.reduce((sum, p) => sum + p.total2027, 0),
                sgr: productosSGR.reduce((sum, p) => sum + (p.recursosSGR20272028 || 0) / 2, 0),
                total: 0
            }
        ];
        presupuestoPorAnio.forEach(p => p.total = p.ordinario + p.sgr);

        // Presupuesto por sector (combinando ordinario y SGR)
        const presupuestoPorSectorMap = new Map<string, { ordinario: number; sgr: number }>();

        productos.forEach(p => {
            const sector = p.sector || 'Sin sector';
            if (!presupuestoPorSectorMap.has(sector)) {
                presupuestoPorSectorMap.set(sector, { ordinario: 0, sgr: 0 });
            }
            const data = presupuestoPorSectorMap.get(sector)!;
            data.ordinario += p.total2024 + p.total2025 + p.total2026 + p.total2027;
        });

        productosSGR.forEach(p => {
            const sector = p.sector || 'Sin sector';
            if (!presupuestoPorSectorMap.has(sector)) {
                presupuestoPorSectorMap.set(sector, { ordinario: 0, sgr: 0 });
            }
            const data = presupuestoPorSectorMap.get(sector)!;
            data.sgr += (p.recursosSGR20232024 || 0) + (p.recursosSGR20252026 || 0) + (p.recursosSGR20272028 || 0);
        });

        const presupuestoPorSector = Array.from(presupuestoPorSectorMap.entries())
            .map(([sector, data]) => ({
                sector,
                ordinario: data.ordinario,
                sgr: data.sgr,
                total: data.ordinario + data.sgr
            }))
            .sort((a, b) => b.total - a.total);

        const analisisPresupuestoDetallado = {
            presupuestoOrdinarioTotal,
            presupuestoSGRTotal,
            porcentajeOrdinario,
            porcentajeSGR,
            presupuestoPorAnio,
            presupuestoPorSector
        };

        // Generar tendencias
        const tendencias = this.generarTendencias(analisisPorAnio, analisisPorSector);

        // Generar recomendaciones
        const recomendaciones = this.generarRecomendaciones(
            porcentajeCumplimiento,
            analisisPorSector,
            analisisPorLineaEstrategica
        );

        // Generar alertas
        const alertas = this.generarAlertas(analisisPorSector, analisisPorAnio);

        // Detectar inconsistencias
        const inconsistencias = this.detectarInconsistencias(pdmData);

        return {
            indicadoresGenerales: {
                totalMetas,
                metasCumplidas,
                metasEnProgreso,
                metasPorCumplir,
                metasPendientes,
                porcentajeCumplimiento
            },
            analisisPorAnio,
            analisisPorSector,
            analisisPorLineaEstrategica,
            analisisPorODS,
            analisisSGR,
            analisisIndicadoresResultado,
            analisisPresupuestoDetallado,
            tendencias,
            recomendaciones,
            alertas,
            inconsistencias
        };
    }

    private generarTendencias(
        analisisPorAnio: any[],
        analisisPorSector: any[]
    ): { descripcion: string; tipo: 'positivo' | 'neutro' | 'negativo' }[] {
        const tendencias: { descripcion: string; tipo: 'positivo' | 'neutro' | 'negativo' }[] = [];

        // Tendencia general por años
        const cumplimientos = analisisPorAnio.map(a => a.porcentajeCumplimiento);
        let tendenciaGeneral = 0;
        for (let i = 1; i < cumplimientos.length; i++) {
            tendenciaGeneral += cumplimientos[i] - cumplimientos[i - 1];
        }

        if (tendenciaGeneral > 0) {
            tendencias.push({
                descripcion: `Se observa una tendencia positiva en el cumplimiento de metas a lo largo del cuatrienio, con un incremento promedio de ${(tendenciaGeneral / (cumplimientos.length - 1)).toFixed(1)}% anual.`,
                tipo: 'positivo'
            });
        } else if (tendenciaGeneral < 0) {
            tendencias.push({
                descripcion: `Se identifica una tendencia negativa en el cumplimiento, con una disminución promedio de ${Math.abs(tendenciaGeneral / (cumplimientos.length - 1)).toFixed(1)}% anual.`,
                tipo: 'negativo'
            });
        }

        // Mejor sector
        if (analisisPorSector.length > 0) {
            const mejorSector = analisisPorSector[0];
            tendencias.push({
                descripcion: `El sector "${mejorSector.sector}" presenta el mejor desempeño con un ${mejorSector.porcentajeCumplimiento.toFixed(1)}% de cumplimiento.`,
                tipo: 'positivo'
            });

            // Peor sector (si existe)
            const peorSector = analisisPorSector[analisisPorSector.length - 1];
            if (peorSector.porcentajeCumplimiento < 50) {
                tendencias.push({
                    descripcion: `El sector "${peorSector.sector}" requiere atención especial, con solo un ${peorSector.porcentajeCumplimiento.toFixed(1)}% de cumplimiento.`,
                    tipo: 'negativo'
                });
            }
        }

        return tendencias;
    }

    private generarRecomendaciones(
        porcentajeGeneral: number,
        analisisPorSector: any[],
        analisisPorLinea: any[]
    ): string[] {
        const recomendaciones: string[] = [];

        if (porcentajeGeneral < 50) {
            recomendaciones.push(
                'El porcentaje de cumplimiento general es bajo. Se recomienda realizar una evaluación exhaustiva de los factores que están impidiendo el avance de las metas programadas.'
            );
        }

        // Sectores con bajo cumplimiento
        const sectoresBajos = analisisPorSector.filter(s => s.porcentajeCumplimiento < 40);
        if (sectoresBajos.length > 0) {
            recomendaciones.push(
                `Se identificaron ${sectoresBajos.length} sector(es) con cumplimiento inferior al 40%. Se sugiere priorizar recursos y atención en: ${sectoresBajos.map(s => s.sector).join(', ')}.`
            );
        }

        // Líneas estratégicas rezagadas
        const lineasRezagadas = analisisPorLinea.filter(l => l.porcentajeCumplimiento < 30);
        if (lineasRezagadas.length > 0) {
            recomendaciones.push(
                `Existen líneas estratégicas con avance crítico. Se recomienda reevaluar la viabilidad y pertinencia de las metas asociadas.`
            );
        }

        // Recomendación positiva
        const sectoresAltos = analisisPorSector.filter(s => s.porcentajeCumplimiento >= 70);
        if (sectoresAltos.length > 0) {
            recomendaciones.push(
                `Se destacan ${sectoresAltos.length} sector(es) con cumplimiento superior al 70%. Se sugiere documentar las buenas prácticas implementadas para replicarlas en otros sectores.`
            );
        }

        return recomendaciones;
    }

    private generarAlertas(analisisPorSector: any[], analisisPorAnio: any[]): string[] {
        const alertas: string[] = [];

        // Alertas por sector crítico
        const sectoresCriticos = analisisPorSector.filter(s => s.porcentajeCumplimiento < 25);
        sectoresCriticos.forEach(sector => {
            alertas.push(
                `⚠️ CRÍTICO: El sector "${sector.sector}" presenta un cumplimiento del ${sector.porcentajeCumplimiento.toFixed(1)}%. Se requiere intervención inmediata.`
            );
        });

        // Alertas por año con bajo presupuesto ejecutado
        const anioActual = new Date().getFullYear();
        const añosAnteriores = analisisPorAnio.filter(a => a.anio < anioActual);
        añosAnteriores.forEach(anio => {
            if (anio.porcentajeCumplimiento < 50) {
                alertas.push(
                    `⚠️ El año ${anio.anio} cerró con un cumplimiento del ${anio.porcentajeCumplimiento.toFixed(1)}%. Esto puede comprometer las metas del cuatrienio.`
                );
            }
        });

        return alertas;
    }

    private detectarInconsistencias(pdmData: PDMData): any[] {
        const inconsistencias: any[] = [];

        // Productos sin sector
        const sinSector = pdmData.planIndicativoProductos.filter(p => !p.sector || p.sector.trim() === '');
        if (sinSector.length > 0) {
            inconsistencias.push({
                tipo: 'Productos sin sector definido',
                descripcion: 'Existen productos sin sector asignado',
                cantidad: sinSector.length
            });
        }

        // Productos sin línea estratégica
        const sinLinea = pdmData.planIndicativoProductos.filter(p => !p.lineaEstrategica || p.lineaEstrategica.trim() === '');
        if (sinLinea.length > 0) {
            inconsistencias.push({
                tipo: 'Productos sin línea estratégica',
                descripcion: 'Existen productos sin línea estratégica asignada',
                cantidad: sinLinea.length
            });
        }

        // Productos sin programación
        const sinProgramacion = pdmData.planIndicativoProductos.filter(p =>
            p.programacion2024 === 0 &&
            p.programacion2025 === 0 &&
            p.programacion2026 === 0 &&
            p.programacion2027 === 0
        );
        if (sinProgramacion.length > 0) {
            inconsistencias.push({
                tipo: 'Productos sin programación',
                descripcion: 'Existen productos sin programación para ningún año del cuatrienio',
                cantidad: sinProgramacion.length
            });
        }

        // Productos con programación pero sin presupuesto
        const sinPresupuesto = pdmData.planIndicativoProductos.filter(p =>
            (p.programacion2024 > 0 || p.programacion2025 > 0 || p.programacion2026 > 0 || p.programacion2027 > 0) &&
            p.total2024 === 0 && p.total2025 === 0 && p.total2026 === 0 && p.total2027 === 0
        );
        if (sinPresupuesto.length > 0) {
            inconsistencias.push({
                tipo: 'Productos programados sin presupuesto',
                descripcion: 'Existen productos con programación pero sin presupuesto asignado',
                cantidad: sinPresupuesto.length
            });
        }

        return inconsistencias;
    }

    // Métodos auxiliares
    private encontrarHoja(workbook: XLSX.WorkBook, nombresAlternativos: string[]): string | null {
        for (const nombre of nombresAlternativos) {
            if (workbook.Sheets[nombre]) {
                return nombre;
            }
        }
        // Buscar por coincidencia parcial
        for (const nombreHoja of workbook.SheetNames) {
            for (const nombreAlt of nombresAlternativos) {
                if (nombreHoja.toLowerCase().includes(nombreAlt.toLowerCase())) {
                    return nombreHoja;
                }
            }
        }
        return null;
    }

    private mapearDatos<T>(jsonData: any[], mapper: (row: any[]) => T): T[] {
        // Saltar las primeras filas de encabezado
        const datos = jsonData.slice(2); // Asume que las primeras 2 filas son encabezados
        return datos
            .filter(row => row && row.length > 0 && row[0]) // Filtrar filas vacías
            .map(mapper)
            .filter(item => Object.values(item as any).some(v => v !== '' && v !== null && v !== undefined));
    }

    private limpiarValor(valor: any): string {
        if (valor === null || valor === undefined) return '';
        return String(valor).trim();
    }

    private convertirNumero(valor: any): number {
        if (valor === null || valor === undefined || valor === '') return 0;
        const num = typeof valor === 'number' ? valor : parseFloat(String(valor).replace(/[^0-9.-]/g, ''));
        return isNaN(num) ? 0 : num;
    }

    // Métodos públicos para obtener datos filtrados
    obtenerDatosFiltrados(filtros: FiltrosPDM): PlanIndicativoProducto[] {
        const data = this.pdmDataSubject.value;
        if (!data) return [];

        let productos = [...data.planIndicativoProductos];

        // Filtro por año (cuenta solo si el producto tiene presupuesto > 0 en ese año)
        if (filtros.anio) {
            productos = productos.filter(p => {
                switch (filtros.anio) {
                    case 2024: return (p.total2024 || 0) > 0;
                    case 2025: return (p.total2025 || 0) > 0;
                    case 2026: return (p.total2026 || 0) > 0;
                    case 2027: return (p.total2027 || 0) > 0;
                    default: return true;
                }
            });
        }

        if (filtros.sector) {
            productos = productos.filter(p => p.sector === filtros.sector);
        }

        if (filtros.lineaEstrategica) {
            productos = productos.filter(p => p.lineaEstrategica === filtros.lineaEstrategica);
        }

        if (filtros.estado) {
            productos = productos.filter(p => p.estado === filtros.estado);
        }

        if (filtros.secretaria) {
            if (filtros.secretaria === 'SIN_ASIGNAR') {
                productos = productos.filter(p => !p.secretariaAsignada || p.secretariaAsignada.trim() === '');
            } else {
                productos = productos.filter(p => p.secretariaAsignada === filtros.secretaria);
            }
        }

        if (filtros.ods) {
            productos = productos.filter(p => p.codigoODS === filtros.ods);
        }

        if (filtros.bpin) {
            productos = productos.filter(p => p.bpin && p.bpin.trim() !== '');
        }

        return productos;
    }

    obtenerSectoresUnicos(): string[] {
        const data = this.pdmDataSubject.value;
        if (!data) return [];
        return [...new Set(data.planIndicativoProductos.map(p => p.sector))].filter(s => s).sort();
    }

    obtenerLineasEstrategicasUnicas(): string[] {
        const data = this.pdmDataSubject.value;
        if (!data) return [];
        return [...new Set(data.planIndicativoProductos.map(p => p.lineaEstrategica))].filter(l => l).sort();
    }

    obtenerSecretariasUnicas(): string[] {
        const data = this.pdmDataSubject.value;
        if (!data) return [];
        return [...new Set(data.planIndicativoProductos.map(p => p.secretariaAsignada).filter(Boolean) as string[])]
            .filter(s => s)
            .sort();
    }

    limpiarDatos(): void {
        this.pdmDataSubject.next(null);
        this.analisisSubject.next(null);
        this.limpiarCache();
    }

    // ============================================================================
    // MÉTODOS PARA GESTIÓN DE ARCHIVO EXCEL EN BD
    // ============================================================================

    /**
     * Sube un archivo Excel a la base de datos
     */
    async subirExcelABaseDatos(file: File, entitySlug: string): Promise<ExcelUploadResponse> {
        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await firstValueFrom(
                this.http.post<ExcelUploadResponse>(
                    `${this.apiUrl}/pdm/${entitySlug}/upload-excel`,
                    formData
                )
            );
            return response;
        } catch (error) {
            console.error('Error al subir Excel a BD:', error);
            throw error;
        }
    }

    /**
     * Obtiene información sobre el archivo Excel almacenado en BD
     */
    async obtenerInfoExcelBD(entitySlug: string): Promise<ExcelInfoResponse> {
        try {
            const response = await firstValueFrom(
                this.http.get<ExcelInfoResponse>(
                    `${this.apiUrl}/pdm/${entitySlug}/excel-info`
                )
            );
            return response;
        } catch (error) {
            console.error('Error al obtener info de Excel:', error);
            throw error;
        }
    }

    /**
     * Descarga el archivo Excel desde la base de datos y lo procesa
     */
    async descargarYProcesarExcelDesdeBD(entitySlug: string): Promise<PDMData> {
        this.cargandoSubject.next(true);

        try {
            // Descargar el archivo como blob
            const blob = await firstValueFrom(
                this.http.get(
                    `${this.apiUrl}/pdm/${entitySlug}/download-excel`,
                    { responseType: 'blob' }
                )
            );

            // Convertir blob a File para procesarlo con la lógica existente
            const file = new File([blob], 'pdm.xlsx', {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            });

            // Procesar el archivo usando la lógica existente
            const pdmData = await this.procesarArchivoExcel(file);

            // Cargar actividades desde el backend para cada producto
            const codigos = pdmData.planIndicativoProductos.map(p => p.codigoIndicadorProducto);
            if (codigos.length > 0) {
                try {
                    const actividadesResp = await firstValueFrom(
                        this.pdmBackend.getActividadesBulk(entitySlug, codigos)
                    );

                    // Asociar actividades a cada producto
                    pdmData.planIndicativoProductos.forEach(producto => {
                        producto.actividades = actividadesResp.items[producto.codigoIndicadorProducto] || [];
                    });
                } catch (error) {
                    console.warn('Error al cargar actividades desde backend:', error);
                    // Continuar sin actividades si falla
                }
            }

            // 🔥 CRÍTICO: Cargar asignaciones de secretarías desde el backend
            try {
                const assignmentsResp = await firstValueFrom(
                    this.pdmBackend.getAssignments(entitySlug)
                );
                
                const assignmentsMap = assignmentsResp.assignments || {};
                console.log('🔥 Asignaciones cargadas en servicio:', assignmentsMap);
                
                // Aplicar asignaciones a cada producto
                pdmData.planIndicativoProductos.forEach(producto => {
                    const sec = assignmentsMap[producto.codigoIndicadorProducto];
                    if (sec !== undefined && sec !== null) {
                        producto.secretariaAsignada = sec;
                        console.log(`  ✅ ${producto.codigoIndicadorProducto} → ${sec}`);
                    } else {
                        producto.secretariaAsignada = undefined;
                    }
                });
            } catch (error) {
                console.warn('⚠️ Error al cargar asignaciones desde backend:', error);
                // Continuar sin asignaciones si falla
            }

            return pdmData;
        } catch (error) {
            this.cargandoSubject.next(false);
            console.error('Error al descargar y procesar Excel desde BD:', error);
            throw error;
        }
    }

    /**
     * Elimina el archivo Excel de la base de datos
     */
    async eliminarExcelDeBD(entitySlug: string): Promise<void> {
        try {
            await firstValueFrom(
                this.http.delete(
                    `${this.apiUrl}/pdm/${entitySlug}/delete-excel`
                )
            );
        } catch (error) {
            console.error('Error al eliminar Excel de BD:', error);
            throw error;
        }
    }

    /**
     * Descarga el Excel de la base de datos directamente al dispositivo del usuario
     */
    async descargarExcelAlDispositivo(entitySlug: string): Promise<void> {
        try {
            // Obtener info del archivo primero
            const info = await this.obtenerInfoExcelBD(entitySlug);
            const nombreArchivo = info.nombre_archivo || 'PDM.xlsx';

            // Descargar el blob
            const blob = await firstValueFrom(
                this.http.get(
                    `${this.apiUrl}/pdm/${entitySlug}/download-excel`,
                    { responseType: 'blob' }
                )
            );

            // Crear un enlace temporal y descargar
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = nombreArchivo;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Error al descargar Excel al dispositivo:', error);
            throw error;
        }
    }

    /**
     * Flujo completo: Primera carga
     * 1. Sube el Excel a BD
     * 2. Procesa el archivo localmente
     * 3. Guarda datos en localStorage
     */
    async primeraCargaExcel(file: File, entitySlug: string): Promise<PDMData> {
        this.cargandoSubject.next(true);

        try {
            // 1. Subir a BD
            await this.subirExcelABaseDatos(file, entitySlug);

            // 2. Procesar localmente
            const pdmData = await this.procesarArchivoExcel(file);

            // 3. 🔥 CRÍTICO: Cargar asignaciones de secretarías desde el backend
            try {
                const assignmentsResp = await firstValueFrom(
                    this.pdmBackend.getAssignments(entitySlug)
                );
                
                const assignmentsMap = assignmentsResp.assignments || {};
                console.log('🔥 Asignaciones cargadas después de subir Excel:', assignmentsMap);
                
                // Aplicar asignaciones a cada producto
                pdmData.planIndicativoProductos.forEach(producto => {
                    const sec = assignmentsMap[producto.codigoIndicadorProducto];
                    if (sec !== undefined && sec !== null) {
                        producto.secretariaAsignada = sec;
                    } else {
                        producto.secretariaAsignada = undefined;
                    }
                });

                // Guardar datos actualizados en localStorage
                localStorage.setItem('pdmData', JSON.stringify(pdmData));
                this.pdmDataSubject.next(pdmData);
            } catch (error) {
                console.warn('⚠️ Error al cargar asignaciones después de subir Excel:', error);
                // Continuar sin asignaciones si falla
            }

            // Los datos ya se guardan en cache en procesarArchivoExcel
            return pdmData;
        } catch (error) {
            this.cargandoSubject.next(false);
            throw error;
        }
    }

    /**
     * Flujo completo: Análisis y seguimiento
     * 1. Descarga Excel de BD
     * 2. Procesa localmente
     * 3. Guarda datos en localStorage
     */
    async cargarExcelParaAnalisis(entitySlug: string): Promise<PDMData> {
        return this.descargarYProcesarExcelDesdeBD(entitySlug);
    }

    /**
     * Regenera el archivo Excel con los datos modificados y lo sube a la BD
     */
    async guardarCambiosEnExcel(pdmData: PDMData, entitySlug: string): Promise<void> {
        this.cargandoSubject.next(true);

        try {
            // Crear un nuevo libro de Excel
            const wb = XLSX.utils.book_new();

            // 1. Hoja: Líneas Estratégicas
            if (pdmData.lineasEstrategicas.length > 0) {
                const wsLineas = XLSX.utils.json_to_sheet(pdmData.lineasEstrategicas);
                XLSX.utils.book_append_sheet(wb, wsLineas, 'LÍNEAS ESTRATÉGICAS');
            }

            // 2. Hoja: Indicadores de Resultado
            if (pdmData.indicadoresResultado.length > 0) {
                const wsIndicadores = XLSX.utils.json_to_sheet(pdmData.indicadoresResultado);
                XLSX.utils.book_append_sheet(wb, wsIndicadores, 'INDICADORES DE RESULTADO');
            }

            // 3. Hoja: Plan Indicativo de Productos (principal)
            if (pdmData.planIndicativoProductos.length > 0) {
                // Limpiar campos calculados antes de exportar
                const productosLimpios = pdmData.planIndicativoProductos.map(p => {
                    const { estado, avance, estadosPorAnio, meta2024, meta2025, meta2026, meta2027,
                        secretariaAsignada, avances, actividades, ...resto } = p;
                    return resto;
                });
                const wsProductos = XLSX.utils.json_to_sheet(productosLimpios);
                XLSX.utils.book_append_sheet(wb, wsProductos, 'PLAN INDICATIVO DE PRODUCT');
            }

            // 4. Hoja: Iniciativas SGR
            if (pdmData.iniciativasSGR.length > 0) {
                const wsIniciativas = XLSX.utils.json_to_sheet(pdmData.iniciativasSGR);
                XLSX.utils.book_append_sheet(wb, wsIniciativas, 'INICIATIVAS SGR');
            }

            // 5. Hoja: Plan Indicativo SGR
            if (pdmData.planIndicativoSGR.length > 0) {
                const wsPlanSGR = XLSX.utils.json_to_sheet(pdmData.planIndicativoSGR);
                XLSX.utils.book_append_sheet(wb, wsPlanSGR, 'PLAN INDICATIVO SGR');
            }

            // Convertir el libro a un blob
            const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
            const blob = new Blob([wbout], {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            });

            // Crear un File desde el Blob
            const fileName = pdmData.metadata.nombreArchivo || 'PDM.xlsx';
            const file = new File([blob], fileName, {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            });

            // Subir a la base de datos
            await this.subirExcelABaseDatos(file, entitySlug);

            // Recalcular análisis y actualizar caché local
            const analisis = this.generarAnalisis(pdmData);
            this.guardarDatosEnCache(pdmData, analisis);

            this.cargandoSubject.next(false);
        } catch (error) {
            this.cargandoSubject.next(false);
            console.error('Error al guardar cambios en Excel:', error);
            throw error;
        }
    }
}
