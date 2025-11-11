import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, from, BehaviorSubject, of, throwError } from 'rxjs';
import { map, catchError, switchMap, tap } from 'rxjs/operators';
import * as XLSX from 'xlsx';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';
import {
    PDMData,
    LineaEstrategica,
    IndicadorResultado,
    IniciativaSGR,
    ProductoPlanIndicativo,
    ProductoPlanIndicativoSGR,
    ResumenProducto,
    EstadisticasPDM,
    ActividadPDM,
    EvidenciaActividad,
    ResumenActividadesPorAnio,
    AvanceProducto,
    ProyectoBPIN,
    DashboardAnalytics,
    AnalisisPorEstado,
    AnalisisPorSector,
    AnalisisPorODS,
    AnalisisPorLineaEstrategica,
    AnalisisPresupuestal
} from '../models/pdm.model';

@Injectable({
    providedIn: 'root'
})
export class PdmService {
    private http = inject(HttpClient);
    private authService = inject(AuthService);
    
    // Almacenamiento local de actividades (se sincroniza con backend)
    private actividadesSubject = new BehaviorSubject<ActividadPDM[]>([]);
    public actividades$ = this.actividadesSubject.asObservable();
    
    private readonly STORAGE_KEY = 'pdm_actividades';
    private readonly DATOS_GOV_API = 'https://www.datos.gov.co/resource/cf9k-55fw.json';
    private readonly API_URL = `${environment.apiUrl}/pdm/v2`;
    
    // Slug de la entidad actual (se debe obtener del usuario o contexto)
    private entitySlug: string = '';

    constructor() {
        // Obtener slug de la entidad del AuthService
        this.refreshEntitySlug();
        
        // Cargar actividades desde storage (fallback si no hay conexión)
        this.cargarActividadesDesdeStorage();
    }

    /**
     * Refresca el entitySlug desde el AuthService
     */
    private refreshEntitySlug(): void {
        // Obtener usuario del AuthService en lugar de localStorage
        const user = this.authService.getCurrentUserValue();
        
        if (user) {
            console.log('🔍 Usuario obtenido del AuthService:', user);
            
            // Obtener el slug de la entidad
            this.entitySlug = user.entity?.slug || '';
            
            console.log('🔑 Entity slug obtenido:', this.entitySlug);
            
            if (!this.entitySlug) {
                console.warn('⚠️ No se encontró entity slug en el usuario');
                console.warn('🔍 Usuario tiene entity_id:', user.entity_id);
                console.warn('🔍 Usuario tiene entity:', user.entity);
            }
        } else {
            console.warn('⚠️ No hay usuario en AuthService');
        }
    }

    /**
     * Espera a que el entitySlug esté disponible (timeout de 5 segundos)
     * Retorna true si está disponible, false si timeout
     */
    private async waitForEntitySlug(): Promise<boolean> {
        let attempts = 0;
        const maxAttempts = 50; // 5 segundos (50 * 100ms)
        
        while (!this.entitySlug && attempts < maxAttempts) {
            this.refreshEntitySlug();
            if (this.entitySlug) {
                console.log('✅ Entity slug disponible después de', attempts * 100, 'ms');
                return true;
            }
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
        
        if (!this.entitySlug) {
            console.error('❌ Entity slug no disponible después de', maxAttempts * 100, 'ms');
            return false;
        }
        return true;
    }

    /**
     * Establece manualmente el entitySlug (útil si se necesita cambiar dinámicamente)
     */
    public setEntitySlug(slug: string): void {
        this.entitySlug = slug;
        console.log('🔑 Entity slug establecido manualmente:', this.entitySlug);
    }

    /**
     * Obtiene el entitySlug actual
     */
    public getEntitySlug(): string {
        return this.entitySlug;
    }

    /**
     * Lee un archivo Excel y retorna los datos parseados de todas las hojas
     */
    procesarArchivoExcel(file: File): Observable<PDMData> {
        return from(this.leerArchivoExcel(file)).pipe(
            map(workbook => this.parsearWorkbook(workbook))
        );
    }

    /**
     * Lee el archivo Excel y retorna el workbook
     */
    private leerArchivoExcel(file: File): Promise<XLSX.WorkBook> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e: any) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    resolve(workbook);
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = () => reject(reader.error);
            reader.readAsArrayBuffer(file);
        });
    }

    /**
     * Parsea el workbook y extrae los datos de cada hoja
     */
    private parsearWorkbook(workbook: XLSX.WorkBook): PDMData {
        console.log('📊 Hojas encontradas en el Excel:', workbook.SheetNames);
        
        const pdmData: PDMData = {
            lineas_estrategicas: [],
            indicadores_resultado: [],
            iniciativas_sgr: [],
            productos_plan_indicativo: [],
            productos_plan_indicativo_sgr: []
        };

        // Función auxiliar para encontrar hoja por nombre (case-insensitive y flexible)
        const findSheet = (nombres: string[]): string | null => {
            for (const nombre of nombres) {
                const encontrada = workbook.SheetNames.find(s => 
                    s.toLowerCase().trim() === nombre.toLowerCase().trim()
                );
                if (encontrada) return encontrada;
            }
            return null;
        };

        // Parsear cada hoja con búsqueda flexible
        const hojaLineas = findSheet(['LÍNEAS ESTRATÉGICAS', 'LINEAS ESTRATEGICAS', 'Líneas Estratégicas']);
        if (hojaLineas) {
            console.log('✅ Parseando:', hojaLineas);
            pdmData.lineas_estrategicas = this.parsearLineasEstrategicas(workbook.Sheets[hojaLineas]);
            console.log(`   → ${pdmData.lineas_estrategicas.length} líneas estratégicas cargadas`);
        } else {
            console.warn('⚠️ No se encontró la hoja de Líneas Estratégicas');
        }

        const hojaIndicadores = findSheet(['INDICADORES DE RESULTADO', 'Indicadores de Resultado']);
        if (hojaIndicadores) {
            console.log('✅ Parseando:', hojaIndicadores);
            pdmData.indicadores_resultado = this.parsearIndicadoresResultado(workbook.Sheets[hojaIndicadores]);
            console.log(`   → ${pdmData.indicadores_resultado.length} indicadores de resultado cargados`);
        } else {
            console.warn('⚠️ No se encontró la hoja de Indicadores de Resultado');
        }

        const hojaIniciativas = findSheet(['INICIATIVAS SGR', 'Iniciativas SGR']);
        if (hojaIniciativas) {
            console.log('✅ Parseando:', hojaIniciativas);
            pdmData.iniciativas_sgr = this.parsearIniciativasSGR(workbook.Sheets[hojaIniciativas]);
            console.log(`   → ${pdmData.iniciativas_sgr.length} iniciativas SGR cargadas`);
        } else {
            console.warn('⚠️ No se encontró la hoja de Iniciativas SGR');
        }

        const hojaPlanIndicativo = findSheet(['PLAN INDICATIVO - PRODUCTOS', 'Plan Indicativo - Productos', 'PLAN INDICATIVO-PRODUCTOS']);
        if (hojaPlanIndicativo) {
            console.log('✅ Parseando:', hojaPlanIndicativo);
            pdmData.productos_plan_indicativo = this.parsearProductosPlanIndicativo(workbook.Sheets[hojaPlanIndicativo]);
            console.log(`   → ${pdmData.productos_plan_indicativo.length} productos del plan indicativo cargados`);
        } else {
            console.warn('⚠️ No se encontró la hoja de Plan Indicativo - Productos');
        }

        const hojaPlanSGR = findSheet(['PLAN INDICATIVO SGR - PRODUCTOS', 'Plan Indicativo SGR - Productos', 'PLAN INDICATIVO SGR-PRODUCTOS']);
        if (hojaPlanSGR) {
            console.log('✅ Parseando:', hojaPlanSGR);
            pdmData.productos_plan_indicativo_sgr = this.parsearProductosPlanIndicativoSGR(workbook.Sheets[hojaPlanSGR]);
            console.log(`   → ${pdmData.productos_plan_indicativo_sgr.length} productos SGR cargados`);
        } else {
            console.warn('⚠️ No se encontró la hoja de Plan Indicativo SGR - Productos');
        }

        console.log('📈 Resumen de datos cargados:', {
            lineas_estrategicas: pdmData.lineas_estrategicas.length,
            indicadores_resultado: pdmData.indicadores_resultado.length,
            iniciativas_sgr: pdmData.iniciativas_sgr.length,
            productos_plan_indicativo: pdmData.productos_plan_indicativo.length,
            productos_plan_indicativo_sgr: pdmData.productos_plan_indicativo_sgr.length
        });

        return pdmData;
    }

    private parsearLineasEstrategicas(sheet: XLSX.WorkSheet): LineaEstrategica[] {
        const data = XLSX.utils.sheet_to_json<any>(sheet, { header: 1, defval: '' });
        const resultado: LineaEstrategica[] = [];

        // Saltar la fila de encabezado (índice 0)
        for (let i = 1; i < data.length; i++) {
            const row = data[i];
            if (!row[0]) continue; // Saltar filas vacías
            
            // Saltar filas que parezcan encabezados
            const firstCell = String(row[0] || '').toLowerCase();
            if (firstCell.includes('código') || firstCell.includes('dane') || firstCell === 'código dane') {
                continue;
            }

            resultado.push({
                codigo_dane: String(row[0] || ''),
                entidad_territorial: String(row[1] || ''),
                nombre_plan: String(row[2] || ''),
                consecutivo: String(row[3] || ''),
                linea_estrategica: String(row[4] || '')
            });
        }

        return resultado;
    }

    private parsearIndicadoresResultado(sheet: XLSX.WorkSheet): IndicadorResultado[] {
        const data = XLSX.utils.sheet_to_json<any>(sheet, { header: 1, defval: '' });
        const resultado: IndicadorResultado[] = [];

        for (let i = 1; i < data.length; i++) {
            const row = data[i];
            if (!row[0]) continue;
            
            // Saltar filas que parezcan encabezados
            const firstCell = String(row[0] || '').toLowerCase();
            if (firstCell.includes('código') || firstCell.includes('dane') || firstCell === 'código dane') {
                continue;
            }

            resultado.push({
                codigo_dane: String(row[0] || ''),
                entidad_territorial: String(row[1] || ''),
                nombre_plan: String(row[2] || ''),
                consecutivo: String(row[3] || ''),
                linea_estrategica: String(row[4] || ''),
                indicador_resultado: String(row[5] || ''),
                esta_pnd: String(row[6] || ''),
                meta_cuatrienio: Number(row[7]) || 0,
                transformacion_pnd: String(row[8] || '')
            });
        }

        return resultado;
    }

    private parsearIniciativasSGR(sheet: XLSX.WorkSheet): IniciativaSGR[] {
        const data = XLSX.utils.sheet_to_json<any>(sheet, { header: 1, defval: '' });
        const resultado: IniciativaSGR[] = [];

        for (let i = 1; i < data.length; i++) {
            const row = data[i];
            if (!row[0]) continue;
            
            // Saltar filas que parezcan encabezados
            const firstCell = String(row[0] || '').toLowerCase();
            if (firstCell.includes('código') || firstCell.includes('dane') || firstCell === 'código dane') {
                continue;
            }

            resultado.push({
                codigo_dane: String(row[0] || ''),
                entidad_territorial: String(row[1] || ''),
                nombre_plan: String(row[2] || ''),
                consecutivo: String(row[3] || ''),
                linea_estrategica: String(row[4] || ''),
                tipo_iniciativa: String(row[5] || ''),
                sector_mga: String(row[6] || ''),
                iniciativa_sgr: String(row[7] || ''),
                recursos_sgr_indicativos: Number(row[8]) || 0,
                bpin: String(row[9] || '')
            });
        }

        return resultado;
    }

    private parsearProductosPlanIndicativo(sheet: XLSX.WorkSheet): ProductoPlanIndicativo[] {
        const data = XLSX.utils.sheet_to_json<any>(sheet, { header: 1, defval: '' });
        const resultado: ProductoPlanIndicativo[] = [];

        for (let i = 2; i < data.length; i++) { // Saltar encabezados (puede tener 2 filas de encabezado)
            const row = data[i];
            if (!row[0]) continue;

            resultado.push({
                codigo_dane: String(row[0] || ''),
                entidad_territorial: String(row[1] || ''),
                nombre_plan: String(row[2] || ''),
                codigo_indicador_producto: String(row[3] || ''),
                linea_estrategica: String(row[4] || ''),
                codigo_sector: String(row[5] || ''),
                sector_mga: String(row[6] || ''),
                codigo_programa: String(row[7] || ''),
                programa_mga: String(row[8] || ''),
                codigo_producto: String(row[9] || ''),
                producto_mga: String(row[10] || ''),
                codigo_indicador_producto_mga: String(row[11] || ''),
                indicador_producto_mga: String(row[12] || ''),
                personalizacion_indicador: String(row[13] || ''),
                unidad_medida: String(row[14] || ''),
                meta_cuatrienio: Number(row[15]) || 0,
                principal: String(row[16] || ''),
                codigo_ods: String(row[17] || ''),
                ods: String(row[18] || ''),
                tipo_acumulacion: String(row[19] || ''),
                programacion_2024: Number(row[20]) || 0,
                programacion_2025: Number(row[21]) || 0,
                programacion_2026: Number(row[22]) || 0,
                programacion_2027: Number(row[23]) || 0,
                recursos_propios_2024: Number(row[24]) || 0,
                sgp_educacion_2024: Number(row[25]) || 0,
                sgp_salud_2024: Number(row[26]) || 0,
                sgp_deporte_2024: Number(row[27]) || 0,
                sgp_cultura_2024: Number(row[28]) || 0,
                sgp_libre_inversion_2024: Number(row[29]) || 0,
                sgp_libre_destinacion_2024: Number(row[30]) || 0,
                sgp_alimentacion_escolar_2024: Number(row[31]) || 0,
                sgp_municipios_rio_magdalena_2024: Number(row[32]) || 0,
                sgp_apsb_2024: Number(row[33]) || 0,
                credito_2024: Number(row[34]) || 0,
                transferencias_cofinanciacion_departamento_2024: Number(row[35]) || 0,
                transferencias_cofinanciacion_nacion_2024: Number(row[36]) || 0,
                otros_2024: Number(row[37]) || 0,
                total_2024: Number(row[38]) || 0,
                recursos_propios_2025: Number(row[39]) || 0,
                sgp_educacion_2025: Number(row[40]) || 0,
                sgp_salud_2025: Number(row[41]) || 0,
                sgp_deporte_2025: Number(row[42]) || 0,
                sgp_cultura_2025: Number(row[43]) || 0,
                sgp_libre_inversion_2025: Number(row[44]) || 0,
                sgp_libre_destinacion_2025: Number(row[45]) || 0,
                sgp_alimentacion_escolar_2025: Number(row[46]) || 0,
                sgp_municipios_rio_magdalena_2025: Number(row[47]) || 0,
                sgp_apsb_2025: Number(row[48]) || 0,
                credito_2025: Number(row[49]) || 0,
                transferencias_cofinanciacion_departamento_2025: Number(row[50]) || 0,
                transferencias_cofinanciacion_nacion_2025: Number(row[51]) || 0,
                otros_2025: Number(row[52]) || 0,
                total_2025: Number(row[53]) || 0,
                recursos_propios_2026: Number(row[54]) || 0,
                sgp_educacion_2026: Number(row[55]) || 0,
                sgp_salud_2026: Number(row[56]) || 0,
                sgp_deporte_2026: Number(row[57]) || 0,
                sgp_cultura_2026: Number(row[58]) || 0,
                sgp_libre_inversion_2026: Number(row[59]) || 0,
                sgp_libre_destinacion_2026: Number(row[60]) || 0,
                sgp_alimentacion_escolar_2026: Number(row[61]) || 0,
                sgp_municipios_rio_magdalena_2026: Number(row[62]) || 0,
                sgp_apsb_2026: Number(row[63]) || 0,
                credito_2026: Number(row[64]) || 0,
                transferencias_cofinanciacion_departamento_2026: Number(row[65]) || 0,
                transferencias_cofinanciacion_nacion_2026: Number(row[66]) || 0,
                otros_2026: Number(row[67]) || 0,
                total_2026: Number(row[68]) || 0,
                recursos_propios_2027: Number(row[69]) || 0,
                sgp_educacion_2027: Number(row[70]) || 0,
                sgp_salud_2027: Number(row[71]) || 0,
                sgp_deporte_2027: Number(row[72]) || 0,
                sgp_cultura_2027: Number(row[73]) || 0,
                sgp_libre_inversion_2027: Number(row[74]) || 0,
                sgp_libre_destinacion_2027: Number(row[75]) || 0,
                sgp_alimentacion_escolar_2027: Number(row[76]) || 0,
                sgp_municipios_rio_magdalena_2027: Number(row[77]) || 0,
                sgp_apsb_2027: Number(row[78]) || 0,
                credito_2027: Number(row[79]) || 0,
                transferencias_cofinanciacion_departamento_2027: Number(row[80]) || 0,
                transferencias_cofinanciacion_nacion_2027: Number(row[81]) || 0,
                otros_2027: Number(row[82]) || 0,
                total_2027: Number(row[83]) || 0,
                bpin: String(row[84] || '')
            });
        }

        return resultado;
    }

    private parsearProductosPlanIndicativoSGR(sheet: XLSX.WorkSheet): ProductoPlanIndicativoSGR[] {
        const data = XLSX.utils.sheet_to_json<any>(sheet, { header: 1, defval: '' });
        const resultado: ProductoPlanIndicativoSGR[] = [];

        for (let i = 1; i < data.length; i++) {
            const row = data[i];
            if (!row[0]) continue;

            resultado.push({
                codigo_dane: String(row[0] || ''),
                entidad_territorial: String(row[1] || ''),
                nombre_plan: String(row[2] || ''),
                codigo_indicador_producto_sgr: String(row[3] || ''),
                iniciativa_sgr: String(row[4] || ''),
                codigo_sector: String(row[5] || ''),
                sector_mga: String(row[6] || ''),
                codigo_programa: String(row[7] || ''),
                programa_mga: String(row[8] || ''),
                codigo_producto: String(row[9] || ''),
                producto_mga: String(row[10] || ''),
                codigo_indicador_producto_mga: String(row[11] || ''),
                indicador_producto_mga: String(row[12] || ''),
                personalizacion_indicador: String(row[13] || ''),
                unidad_medida: String(row[14] || ''),
                meta_cuatrienio: Number(row[15]) || 0,
                principal: String(row[16] || ''),
                codigo_ods: String(row[17] || ''),
                ods: String(row[18] || ''),
                tipo_acumulacion: String(row[19] || ''),
                cofinanciado_presupuesto_ordinario: String(row[20] || ''),
                programacion_2023_2024: Number(row[21]) || 0,
                programacion_2025_2026: Number(row[22]) || 0,
                programacion_2027_2028: Number(row[23]) || 0,
                recursos_sgr_2023_2024: Number(row[24]) || 0,
                recursos_sgr_2025_2026: Number(row[25]) || 0,
                recursos_sgr_2027_2028: Number(row[26]) || 0,
                bpin: String(row[27] || '')
            });
        }

        return resultado;
    }

    /**
     * Genera resumen de productos con información consolidada
     */
    generarResumenProductos(pdmData: PDMData): ResumenProducto[] {
        console.log('🔨 Generando resumen de productos...');
        console.log('   Productos disponibles:', pdmData.productos_plan_indicativo.length);
        
        if (pdmData.productos_plan_indicativo.length > 0) {
            console.log('   Ejemplo de producto:', pdmData.productos_plan_indicativo[0]);
        }
        
        const resumen = pdmData.productos_plan_indicativo.map(producto => {
            const totalCuatrienio = producto.total_2024 + producto.total_2025 + producto.total_2026 + producto.total_2027;
            
            // Calcular avance real basado en metas ejecutadas con evidencia
            const porcentajeEjecucion = this.calcularAvanceRealProducto(producto.codigo_producto, producto);

            return {
                codigo: producto.codigo_producto,
                producto: producto.indicador_producto_mga || producto.personalizacion_indicador,
                linea_estrategica: producto.linea_estrategica,
                sector: producto.sector_mga,
                programa_mga: producto.programa_mga,
                ods: producto.ods,
                tipo_acumulacion: producto.tipo_acumulacion,
                bpin: producto.bpin,
                meta_cuatrienio: producto.meta_cuatrienio,
                unidad_medida: producto.unidad_medida,
                programacion_2024: producto.programacion_2024,
                programacion_2025: producto.programacion_2025,
                programacion_2026: producto.programacion_2026,
                programacion_2027: producto.programacion_2027,
                total_2024: producto.total_2024,
                total_2025: producto.total_2025,
                total_2026: producto.total_2026,
                total_2027: producto.total_2027,
                total_cuatrienio: totalCuatrienio,
                porcentaje_ejecucion: porcentajeEjecucion,
                detalle_completo: producto,
                responsable_id: (producto as any).responsable_user_id || null,
                responsable_nombre: (producto as any).responsable || undefined
            };
        });
        
        console.log('✅ Resumen generado:', resumen.length, 'productos');
        return resumen;
    }

    /**
     * Calcula estadísticas del PDM
     */
    calcularEstadisticas(pdmData: PDMData): EstadisticasPDM {
        const productos = pdmData.productos_plan_indicativo;
        
    const presupuesto_2024 = productos.reduce((sum, p) => sum + p.total_2024, 0);
    const presupuesto_2025 = productos.reduce((sum, p) => sum + p.total_2025, 0);
    const presupuesto_2026 = productos.reduce((sum, p) => sum + p.total_2026, 0);
    const presupuesto_2027 = productos.reduce((sum, p) => sum + p.total_2027, 0);

        // Presupuesto por línea estratégica
        const presupuestoPorLinea = new Map<string, number>();
        productos.forEach(p => {
            const total = p.total_2024 + p.total_2025 + p.total_2026 + p.total_2027;
            const actual = presupuestoPorLinea.get(p.linea_estrategica) || 0;
            presupuestoPorLinea.set(p.linea_estrategica, actual + total);
        });

        // Presupuesto por sector
        const presupuestoPorSector = new Map<string, number>();
        productos.forEach(p => {
            const total = p.total_2024 + p.total_2025 + p.total_2026 + p.total_2027;
            const actual = presupuestoPorSector.get(p.sector_mga) || 0;
            presupuestoPorSector.set(p.sector_mga, actual + total);
        });

        return {
            total_lineas_estrategicas: pdmData.lineas_estrategicas.length,
            total_productos: productos.length,
            total_iniciativas_sgr: pdmData.iniciativas_sgr.length,
            presupuesto_total: presupuesto_2024 + presupuesto_2025 + presupuesto_2026 + presupuesto_2027,
            presupuestoPorAnio: {
                anio2024: presupuesto_2024,
                anio2025: presupuesto_2025,
                anio2026: presupuesto_2026,
                anio2027: presupuesto_2027
            },
            presupuesto_por_linea: Array.from(presupuestoPorLinea.entries())
                .map(([linea, total]) => ({ linea, total }))
                .sort((a, b) => b.total - a.total),
            presupuesto_por_sector: Array.from(presupuestoPorSector.entries())
                .map(([sector, total]) => ({ sector, total }))
                .sort((a, b) => b.total - a.total)
        };
    }

    // ==================== GESTIÓN DE ACTIVIDADES ====================

    /**
     * Carga actividades desde localStorage
     */
    private cargarActividadesDesdeStorage() {
        try {
            const stored = localStorage.getItem(this.STORAGE_KEY);
            if (stored) {
                const actividades = JSON.parse(stored) as ActividadPDM[];
                this.actividadesSubject.next(actividades);
                console.log('✅ Actividades cargadas desde localStorage:', actividades.length);
            }
        } catch (error) {
            console.error('Error al cargar actividades desde localStorage:', error);
        }
    }

    /**
     * Guarda actividades en localStorage
     */
    private guardarActividadesEnStorage(actividades: ActividadPDM[]) {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(actividades));
            console.log('💾 Actividades guardadas en localStorage:', actividades.length);
        } catch (error) {
            console.error('Error al guardar actividades en localStorage:', error);
        }
    }

    /**
     * Limpia todo el caché de PDM (se llama al logout)
     */
    resetPdmCache(): void {
        console.log('🔄 Limpiando caché de PDM...');
        this.actividadesSubject.next([]);
        this.entitySlug = '';
        localStorage.removeItem(this.STORAGE_KEY);
        console.log('✅ Caché de PDM limpiado');
    }

    /**
     * Obtiene todas las actividades
     */
    obtenerActividades(): ActividadPDM[] {
        return this.actividadesSubject.value;
    }

    /**
     * Obtiene actividades de un producto específico
     */
    obtenerActividadesPorProducto(codigoProducto: string): ActividadPDM[] {
        return this.actividadesSubject.value.filter(a => a.codigo_producto === codigoProducto);
    }

    /**
     * Obtiene actividades de un producto para un año específico
     */
    obtenerActividadesPorProductoYAnio(codigoProducto: string, anio: number): ActividadPDM[] {
        return this.actividadesSubject.value.filter(
            a => a.codigo_producto === codigoProducto && a.anio === anio
        );
    }

    /**
     * Sincroniza las actividades de un producto con las del backend
     * Reemplaza las actividades existentes del producto con las nuevas del backend
     */
    sincronizarActividadesProducto(codigoProducto: string, actividadesBackend: ActividadPDM[]): void {
        const actividadesActuales = this.actividadesSubject.value;
        
        // Filtrar actividades que NO son del producto actual (conservar las de otros productos)
        const actividadesOtrosProductos = actividadesActuales.filter(
            a => a.codigo_producto !== codigoProducto
        );
        
        // Combinar: actividades de otros productos + nuevas actividades del backend
        const actividadesSincronizadas = [...actividadesOtrosProductos, ...actividadesBackend];
        
        console.log(`🔄 Sincronizando actividades del producto ${codigoProducto}:`, {
            antes: actividadesActuales.filter(a => a.codigo_producto === codigoProducto).length,
            despues: actividadesBackend.length,
            total: actividadesSincronizadas.length
        });
        
        // Actualizar el BehaviorSubject con las actividades sincronizadas
        this.actividadesSubject.next(actividadesSincronizadas);
        this.guardarActividadesEnStorage(actividadesSincronizadas);
    }

    /**
     * Calcula la meta disponible para un producto en un año específico
     */
    calcularMetaDisponible(producto: ResumenProducto, anio: number): number {
        let metaProgramada = 0;
        
        switch (anio) {
            case 2024: metaProgramada = producto.programacion_2024; break;
            case 2025: metaProgramada = producto.programacion_2025; break;
            case 2026: metaProgramada = producto.programacion_2026; break;
            case 2027: metaProgramada = producto.programacion_2027; break;
            default: return 0;
        }

        const actividades = this.obtenerActividadesPorProductoYAnio(producto.codigo, anio);
        const metaAsignada = actividades.reduce((sum, a) => sum + a.meta_ejecutar, 0);
        
        return Math.max(0, metaProgramada - metaAsignada);
    }

    /**
     * Valida si se puede crear/actualizar una actividad
     */
    validarMetaActividad(
        producto: ResumenProducto, 
        anio: number, 
        metaEjecutar: number, 
        actividadId?: number
    ): { valido: boolean; mensaje: string; disponible: number } {
        const metaDisponible = this.calcularMetaDisponible(producto, anio);
        
        // Si es edición, sumar la meta de la actividad actual
        let metaActual = 0;
        if (actividadId) {
            const actividad = this.actividadesSubject.value.find(a => a.id === actividadId);
            if (actividad) {
                metaActual = actividad.meta_ejecutar;
            }
        }

        const disponibleConActual = metaDisponible + metaActual;

        if (metaEjecutar <= 0) {
            return {
                valido: false,
                mensaje: 'La meta a ejecutar debe ser mayor a 0',
                disponible: disponibleConActual
            };
        }

        if (metaEjecutar > disponibleConActual) {
            return {
                valido: false,
                mensaje: `La meta a ejecutar excede la disponible (${disponibleConActual} ${producto.unidad_medida})`,
                disponible: disponibleConActual
            };
        }

        return {
            valido: true,
            mensaje: 'Meta válida',
            disponible: disponibleConActual
        };
    }

    /**
     * Crea una nueva actividad (sincroniza con backend)
     */
    crearActividad(actividad: ActividadPDM): Observable<ActividadPDM> {
        // Intentar crear en el backend primero
        if (this.entitySlug) {
            return this.crearActividadEnBackend(actividad).pipe(
                map(actividadCreada => {
                    // Actualizar estado local
                    const actividades = this.actividadesSubject.value;
                    const nuevasActividades = [...actividades, actividadCreada];
                    this.actividadesSubject.next(nuevasActividades);
                    this.guardarActividadesEnStorage(nuevasActividades);
                    console.log('✅ Actividad creada en backend:', actividadCreada);
                    return actividadCreada;
                }),
                catchError(error => {
                    console.warn('⚠️ Error al crear en backend, guardando solo local:', error);
                    // Fallback: guardar solo localmente
                    const actividades = this.actividadesSubject.value;
                    const nuevaActividad: ActividadPDM = {
                        ...actividad,
                        id: Date.now(),
                        fecha_creacion: new Date().toISOString(),
                        fecha_actualizacion: new Date().toISOString()
                    };
                    const nuevasActividades = [...actividades, nuevaActividad];
                    this.actividadesSubject.next(nuevasActividades);
                    this.guardarActividadesEnStorage(nuevasActividades);
                    return of(nuevaActividad);
                })
            );
        }

        // Sin backend: solo local
        const actividades = this.actividadesSubject.value;
        const nuevaActividad: ActividadPDM = {
            ...actividad,
            id: Date.now(),
            fecha_creacion: new Date().toISOString(),
            fecha_actualizacion: new Date().toISOString()
        };
        const nuevasActividades = [...actividades, nuevaActividad];
        this.actividadesSubject.next(nuevasActividades);
        this.guardarActividadesEnStorage(nuevasActividades);
        return of(nuevaActividad);
    }

    /**
     * Actualiza una actividad existente (sincroniza con backend)
     */
    actualizarActividad(id: number, cambios: Partial<ActividadPDM>): Observable<ActividadPDM | null> {
        const actividades = this.actividadesSubject.value;
        const index = actividades.findIndex(a => a.id === id);

        if (index === -1) {
            console.error('❌ Actividad no encontrada:', id);
            return of(null);
        }

        // Intentar actualizar en el backend primero
        if (this.entitySlug) {
            return this.actualizarActividadEnBackend(id, cambios).pipe(
                map(actividadActualizada => {
                    // Actualizar estado local
                    const nuevasActividades = [...actividades];
                    nuevasActividades[index] = actividadActualizada;
                    this.actividadesSubject.next(nuevasActividades);
                    this.guardarActividadesEnStorage(nuevasActividades);
                    console.log('✅ Actividad actualizada en backend:', actividadActualizada);
                    return actividadActualizada;
                }),
                catchError(error => {
                    console.warn('⚠️ Error al actualizar en backend, guardando solo local:', error);
                    // Fallback: actualizar solo localmente
                    const actividadActualizada: ActividadPDM = {
                        ...actividades[index],
                        ...cambios,
                        fecha_actualizacion: new Date().toISOString()
                    };
                    const nuevasActividades = [...actividades];
                    nuevasActividades[index] = actividadActualizada;
                    this.actividadesSubject.next(nuevasActividades);
                    this.guardarActividadesEnStorage(nuevasActividades);
                    return of(actividadActualizada);
                })
            );
        }

        // Sin backend: solo local
        const actividadActualizada: ActividadPDM = {
            ...actividades[index],
            ...cambios,
            fecha_actualizacion: new Date().toISOString()
        };
        const nuevasActividades = [...actividades];
        nuevasActividades[index] = actividadActualizada;
        this.actividadesSubject.next(nuevasActividades);
        this.guardarActividadesEnStorage(nuevasActividades);
        return of(actividadActualizada);
    }

    /**
     * Elimina una actividad (sincroniza con backend)
     */
    eliminarActividad(id: number): Observable<boolean> {
        const actividades = this.actividadesSubject.value;
        const actividadExiste = actividades.some(a => a.id === id);

        if (!actividadExiste) {
            console.error('❌ Actividad no encontrada:', id);
            return of(false);
        }

        // Intentar eliminar en el backend primero
        if (this.entitySlug) {
            return this.eliminarActividadEnBackend(id).pipe(
                map(() => {
                    // Eliminar del estado local
                    const nuevasActividades = actividades.filter(a => a.id !== id);
                    this.actividadesSubject.next(nuevasActividades);
                    this.guardarActividadesEnStorage(nuevasActividades);
                    console.log('🗑️ Actividad eliminada en backend:', id);
                    return true;
                }),
                catchError(error => {
                    console.warn('⚠️ Error al eliminar en backend, eliminando solo local:', error);
                    // Fallback: eliminar solo localmente
                    const nuevasActividades = actividades.filter(a => a.id !== id);
                    this.actividadesSubject.next(nuevasActividades);
                    this.guardarActividadesEnStorage(nuevasActividades);
                    return of(true);
                })
            );
        }

        // Sin backend: solo local
        const nuevasActividades = actividades.filter(a => a.id !== id);
        this.actividadesSubject.next(nuevasActividades);
        this.guardarActividadesEnStorage(nuevasActividades);
        console.log('🗑️ Actividad eliminada localmente:', id);
        return of(true);
    }

    /**
     * Registra evidencia para una actividad (marca como completada, sincroniza con backend)
     */
    registrarEvidencia(actividadId: number, evidencia: EvidenciaActividad): Observable<ActividadPDM | null> {
        // Verificar si es un ID temporal (guardado solo en localStorage)
        const esIdTemporal = actividadId > 1000000000000; // IDs temporales son timestamps (13 dígitos)
        
        if (esIdTemporal) {
            console.error('❌ No se puede registrar evidencia para una actividad no guardada en el servidor');
            return throwError(() => new Error('La actividad debe guardarse en el servidor antes de registrar evidencia. Por favor, verifica tu conexión e intenta guardar la actividad nuevamente.'));
        }

        const evidenciaConFecha: EvidenciaActividad = {
            ...evidencia,
            id: Date.now(),
            actividad_id: actividadId,
            fecha_registro: new Date().toISOString()
        };

        // Intentar registrar en el backend primero
        if (this.entitySlug) {
            return this.registrarEvidenciaEnBackend(actividadId, evidenciaConFecha).pipe(
                switchMap((actividadActualizada: ActividadPDM) => {
                    // Actualizar estado local
                    const actividades = this.actividadesSubject.value;
                    const index = actividades.findIndex(a => a.id === actividadId);
                    if (index !== -1) {
                        const nuevasActividades = [...actividades];
                        nuevasActividades[index] = actividadActualizada;
                        this.actividadesSubject.next(nuevasActividades);
                        this.guardarActividadesEnStorage(nuevasActividades);
                    }
                    console.log('✅ Evidencia registrada en backend:', actividadActualizada);
                    return of(actividadActualizada);
                }),
                catchError(error => {
                    console.warn('⚠️ Error al registrar evidencia en backend, guardando solo local:', error);
                    // Fallback: actualizar solo localmente
                    return this.actualizarActividad(actividadId, {
                        evidencia: evidenciaConFecha,
                        estado: 'COMPLETADA'
                    });
                })
            );
        }

        // Sin backend: solo local
        return this.actualizarActividad(actividadId, {
            evidencia: evidenciaConFecha,
            estado: 'COMPLETADA'
        });
    }

    /**
     * Obtiene el resumen de actividades por año para un producto
     * 
     * LÓGICA DE PROGRESO:
     * - Si NO hay actividades: 0% (POR_EJECUTAR)
     * - Si hay actividades SIN evidencia: 100% en fase de ASIGNACIÓN (EN_PROGRESO)
     * - Si hay algunas actividades CON evidencia: (meta_ejecutada/meta_programada)*100 en VERDE (EN_PROGRESO)
     * - Si TODAS las actividades tienen evidencia: 100% COMPLETADO
     */
    obtenerResumenActividadesPorAnio(producto: ResumenProducto, anio: number): ResumenActividadesPorAnio {
        const actividades = this.obtenerActividadesPorProductoYAnio(producto.codigo, anio);
        
        let metaProgramada = 0;
        switch (anio) {
            case 2024: metaProgramada = producto.programacion_2024; break;
            case 2025: metaProgramada = producto.programacion_2025; break;
            case 2026: metaProgramada = producto.programacion_2026; break;
            case 2027: metaProgramada = producto.programacion_2027; break;
        }

        // Suma de todas las metas asignadas a actividades
        const metaAsignada = actividades.reduce((sum, a) => sum + a.meta_ejecutar, 0);
        
        // Suma de metas de actividades CON evidencia (completadas)
        const metaEjecutada = actividades
            .filter(a => a.evidencia !== undefined)
            .reduce((sum, a) => sum + a.meta_ejecutar, 0);
        
        const actividadesCompletadas = actividades.filter(a => a.evidencia !== undefined).length;
        
        // NUEVA LÓGICA: Porcentaje de avance basado en fases
        let porcentajeAvance = 0;
        
        if (actividades.length === 0) {
            // Sin actividades: 0%
            porcentajeAvance = 0;
        } else if (metaAsignada > 0 && metaEjecutada === 0) {
            // Hay actividades asignadas pero SIN evidencia: mostrar 100% de asignación
            porcentajeAvance = 100;
        } else if (metaEjecutada > 0) {
            // Hay evidencias: mostrar % basado en ejecución vs programado
            porcentajeAvance = metaProgramada > 0 
                ? (metaEjecutada / metaProgramada) * 100 
                : 0;
            // Capping a 100% máximo
            porcentajeAvance = Math.min(porcentajeAvance, 100);
        } else if (metaProgramada > 0) {
            // Si no hay actividades pero hay meta programada: 0%
            porcentajeAvance = 0;
        }

        return {
            anio,
            meta_programada: metaProgramada,
            meta_asignada: metaAsignada,
            meta_ejecutada: metaEjecutada,
            meta_disponible: Math.max(0, metaProgramada - metaAsignada),
            total_actividades: actividades.length,
            actividades_completadas: actividadesCompletadas,
            porcentaje_avance: porcentajeAvance,
            actividades: actividades
        };
    }

    /**
     * Calcula el avance completo de un producto (todos los años)
     */
    calcularAvanceProducto(producto: ResumenProducto): AvanceProducto {
        const anios = [2024, 2025, 2026, 2027];
        const avancePorAnio: { [anio: number]: ResumenActividadesPorAnio } = {};

        let sumaAvances = 0;

        anios.forEach(anio => {
            const resumen = this.obtenerResumenActividadesPorAnio(producto, anio);
            avancePorAnio[anio] = resumen;
            sumaAvances += resumen.porcentaje_avance;
        });

        // El avance total es el promedio de los 4 años
        const porcentajeAvanceTotal = sumaAvances / anios.length;

        return {
            codigo_producto: producto.codigo,
            avance_por_anio: avancePorAnio,
            porcentaje_avance_total: porcentajeAvanceTotal
        };
    }

    /**
     * Calcula el avance real de un producto basado en metas ejecutadas (para usar en ResumenProducto)
     * Retorna el promedio de avance de los 4 años basado en metas
     */
    calcularAvanceRealProducto(codigoProducto: string, producto?: ProductoPlanIndicativo): number {
        if (!producto) {
            // Si no se proporciona el producto, usar lógica anterior (temporal)
            const anios = [2024, 2025, 2026, 2027];
            let sumaAvances = 0;

            anios.forEach(anio => {
                const actividades = this.obtenerActividadesPorProductoYAnio(codigoProducto, anio);
                const actividadesCompletadas = actividades.filter(a => a.evidencia !== undefined).length;
                const porcentajeAvance = actividades.length > 0 
                    ? (actividadesCompletadas / actividades.length) * 100 
                    : 0;
                sumaAvances += porcentajeAvance;
            });

            return sumaAvances / anios.length;
        }

        // Nueva lógica basada en metas ejecutadas
        const anios = [2024, 2025, 2026, 2027];
        const metas = [
            producto.programacion_2024,
            producto.programacion_2025,
            producto.programacion_2026,
            producto.programacion_2027
        ];
        
        let sumaAvances = 0;

        anios.forEach((anio, index) => {
            const metaProgramada = metas[index];
            const actividades = this.obtenerActividadesPorProductoYAnio(codigoProducto, anio);
            
            const metaEjecutada = actividades
                .filter(a => a.evidencia !== undefined)
                .reduce((sum, a) => sum + a.meta_ejecutar, 0);
            
            const porcentajeAvance = metaProgramada > 0 
                ? (metaEjecutada / metaProgramada) * 100 
                : 0;
            
            sumaAvances += porcentajeAvance;
        });

        // Retornar el promedio de los 4 años
        return sumaAvances / anios.length;
    }

    /**
     * Genera análisis completo del PDM para dashboards
     */
    generarDashboardAnalytics(productos: ResumenProducto[], anioFiltro: number): DashboardAnalytics {
        // Análisis por estado
        const porEstado: AnalisisPorEstado[] = [];
        const estadoMap = new Map<string, number>();
        
        productos.forEach(p => {
            const estado = this.getEstadoProducto(p, anioFiltro);
            estadoMap.set(estado, (estadoMap.get(estado) || 0) + 1);
        });

        const coloresEstado: {[key: string]: string} = {
            'COMPLETADO': '#28a745',
            'EN_PROGRESO': '#17a2b8',
            'PENDIENTE': '#ffc107',
            'POR_EJECUTAR': '#6c757d'
        };

        estadoMap.forEach((cantidad, estado) => {
            porEstado.push({
                estado,
                cantidad,
                porcentaje: (cantidad / productos.length) * 100,
                color: coloresEstado[estado] || '#6c757d'
            });
        });

        // Análisis por sector
        const sectorMap = new Map<string, ResumenProducto[]>();
        productos.forEach(p => {
            const sector = p.sector || 'Sin Sector';
            if (!sectorMap.has(sector)) {
                sectorMap.set(sector, []);
            }
            sectorMap.get(sector)!.push(p);
        });

        const porSector: AnalisisPorSector[] = [];
        sectorMap.forEach((prods, sector) => {
            const completados = prods.filter(p => this.getEstadoProducto(p, anioFiltro) === 'COMPLETADO').length;
            const enProgreso = prods.filter(p => this.getEstadoProducto(p, anioFiltro) === 'EN_PROGRESO').length;
            const pendientes = prods.filter(p => this.getEstadoProducto(p, anioFiltro) === 'PENDIENTE').length;
            const avancePromedio = prods.reduce((sum, p) => sum + p.porcentaje_ejecucion, 0) / prods.length;
            const presupuestoTotal = prods.reduce((sum, p) => sum + p.total_cuatrienio, 0);

            porSector.push({
                sector,
                total_productos: prods.length,
                productos_completados: completados,
                productos_en_progreso: enProgreso,
                productos_pendientes: pendientes,
                porcentaje_avance: avancePromedio,
                presupuesto_total: presupuestoTotal
            });
        });

        // Análisis por ODS
        const odsMap = new Map<string, ResumenProducto[]>();
        productos.forEach(p => {
            const ods = p.ods || 'Sin ODS';
            if (!odsMap.has(ods)) {
                odsMap.set(ods, []);
            }
            odsMap.get(ods)!.push(p);
        });

        const porODS: AnalisisPorODS[] = [];
        odsMap.forEach((prods, ods) => {
            const avancePromedio = prods.reduce((sum, p) => sum + p.porcentaje_ejecucion, 0) / prods.length;
            const presupuesto = prods.reduce((sum, p) => sum + p.total_cuatrienio, 0);

            porODS.push({
                ods,
                total_productos: prods.length,
                porcentaje_avance_promedio: avancePromedio,
                presupuesto_asignado: presupuesto
            });
        });

        // Análisis por línea estratégica
        const lineaMap = new Map<string, ResumenProducto[]>();
        productos.forEach(p => {
            if (!lineaMap.has(p.linea_estrategica)) {
                lineaMap.set(p.linea_estrategica, []);
            }
            lineaMap.get(p.linea_estrategica)!.push(p);
        });

        const porLinea: AnalisisPorLineaEstrategica[] = [];
        lineaMap.forEach((prods, linea) => {
            const completados = prods.filter(p => this.getEstadoProducto(p, anioFiltro) === 'COMPLETADO').length;
            const metaTotal = prods.reduce((sum, p) => sum + p.meta_cuatrienio, 0);
            const metaEjecutada = prods.reduce((sum, p) => {
                const avanceDecimal = p.porcentaje_ejecucion / 100;
                return sum + (p.meta_cuatrienio * avanceDecimal);
            }, 0);

            porLinea.push({
                linea,
                total_productos: prods.length,
                productos_completados: completados,
                porcentaje_cumplimiento: (completados / prods.length) * 100,
                meta_total: metaTotal,
                meta_ejecutada: metaEjecutada
            });
        });

        // Análisis presupuestal por año
        const analisisPresup: AnalisisPresupuestal[] = [];
        const anios = [2024, 2025, 2026, 2027];
        
        anios.forEach(anio => {
            let presupuestoProgramado = 0;
            let presupuestoAsignado = 0;

            productos.forEach(p => {
                let presupAnio = 0;
                switch(anio) {
                    case 2024: presupAnio = p.total_2024; break;
                    case 2025: presupAnio = p.total_2025; break;
                    case 2026: presupAnio = p.total_2026; break;
                    case 2027: presupAnio = p.total_2027; break;
                }
                presupuestoProgramado += presupAnio;

                // Presupuesto asignado = actividades creadas
                const actividades = this.obtenerActividadesPorProductoYAnio(p.codigo, anio);
                // Por simplicidad, asumimos distribución proporcional del presupuesto
                if (actividades.length > 0) {
                    presupuestoAsignado += presupAnio;
                }
            });

            analisisPresup.push({
                anio,
                presupuesto_programado: presupuestoProgramado,
                presupuesto_asignado_actividades: presupuestoAsignado,
                porcentaje_asignacion: presupuestoProgramado > 0 
                    ? (presupuestoAsignado / presupuestoProgramado) * 100 
                    : 0
            });
        });

        // Resumen general
        const avanceGlobal = productos.reduce((sum, p) => sum + p.porcentaje_ejecucion, 0) / productos.length;
        const presupuestoTotal = productos.reduce((sum, p) => sum + p.total_cuatrienio, 0);
        const sinActividades = productos.filter(p => {
            return [2024, 2025, 2026, 2027].every(anio => 
                this.obtenerActividadesPorProductoYAnio(p.codigo, anio).length === 0
            );
        }).length;

        return {
            por_estado: porEstado,
            por_sector: porSector,
            por_ods: porODS,
            por_linea_estrategica: porLinea,
            analisis_presupuestal: analisisPresup,
            resumen_general: {
                total_productos: productos.length,
                porcentaje_avance_global: avanceGlobal,
                presupuesto_total: presupuestoTotal,
                productos_sin_actividades: sinActividades
            }
        };
    }

    /**
     * Determina el estado de un producto para un año específico
     */
    private getEstadoProducto(producto: ResumenProducto, anio: number): string {
        const anioActual = new Date().getFullYear();
        const resumen = this.obtenerResumenActividadesPorAnio(producto, anio);
        const avance = resumen.porcentaje_avance;

        if (anio < anioActual) {
            return avance >= 100 ? 'COMPLETADO' : 'PENDIENTE';
        } else if (anio === anioActual) {
            if (avance === 0) return 'PENDIENTE';
            if (avance >= 100) return 'COMPLETADO';
            return 'EN_PROGRESO';
        } else {
            return 'POR_EJECUTAR';
        }
    }

    // ==================== MÉTODOS DE API BACKEND ====================

    /**
     * Verifica si la entidad ya tiene datos del PDM cargados
     */
    verificarEstadoPDM(): Observable<any> {
        if (!this.entitySlug) {
            console.warn('⚠️ Entity slug no disponible aún, refrescando...');
            this.refreshEntitySlug();
        }
        
        if (!this.entitySlug) {
            console.error('❌ No es posible obtener entity slug para verificar estado PDM');
            return of({ tiene_datos: false, total_productos: 0 });
        }
        
        return this.http.get(`${this.API_URL}/${this.entitySlug}/status`).pipe(
            catchError(error => {
                console.error('Error al verificar estado PDM:', error);
                if (error.status === 403) {
                    console.error('❌ Error 403: Permisos insuficientes. Verifica que el entity_slug sea correcto:', this.entitySlug);
                }
                return of({ tiene_datos: false, total_productos: 0 });
            })
        );
    }

    /**
     * Carga todos los datos del PDM desde el backend
     */
    cargarDatosPDMDesdeBackend(): Observable<PDMData> {
        if (!this.entitySlug) {
            console.warn('⚠️ Entity slug no disponible, refrescando...');
            this.refreshEntitySlug();
        }
        
        if (!this.entitySlug) {
            console.error('❌ No es posible cargar datos sin entity slug');
            throw new Error('No hay slug de entidad disponible');
        }
        
        console.log('📥 Cargando datos PDM desde:', `${this.API_URL}/${this.entitySlug}/data`);
        
        return this.http.get<PDMData>(`${this.API_URL}/${this.entitySlug}/data`).pipe(
            catchError(error => {
                console.error('Error al cargar datos PDM:', error);
                if (error.status === 403) {
                    console.error('❌ Error 403: Permisos insuficientes. Entity slug:', this.entitySlug);
                }
                throw error;
            })
        );
    }

    /**
     * Guarda todos los datos del PDM en el backend
     */
    guardarDatosPDMEnBackend(data: PDMData): Observable<any> {
        // Intentar refrescar el slug antes de guardar
        if (!this.entitySlug) {
            this.refreshEntitySlug();
        }
        
        if (!this.entitySlug) {
            console.warn('⚠️ No hay slug de entidad, datos solo disponibles localmente');
            return of({ success: false, message: 'Sin slug de entidad' });
        }
        
        console.log('📤 Enviando datos al backend...', 'Slug:', this.entitySlug);
        
        return this.http.post(`${this.API_URL}/${this.entitySlug}/upload`, data).pipe(
            tap(() => {
                console.log('✅ Datos guardados exitosamente en backend');
            }),
            catchError(error => {
                console.error('Error al guardar datos PDM:', error);
                if (error.status === 403) {
                    console.error('❌ Error 403: Permisos insuficientes. Entity slug:', this.entitySlug);
                }
                return of({ success: false, error: error.message });
            })
        );
    }

    /**
     * Carga actividades de un producto desde el backend
     */
    cargarActividadesDesdeBackend(codigoProducto: string, anio?: number): Observable<ActividadPDM[]> {
        if (!this.entitySlug) {
            console.warn('⚠️ Entity slug no disponible, refrescando...');
            this.refreshEntitySlug();
        }
        
        if (!this.entitySlug) {
            console.error('❌ No es posible cargar actividades sin entity slug');
            return of([]);
        }
        
        let url = `${this.API_URL}/${this.entitySlug}/actividades/${codigoProducto}`;
        if (anio) {
            url += `?anio=${anio}`;
        }
        
        console.log('📥 Cargando actividades desde:', url);
        
        return this.http.get<ActividadPDM[]>(url).pipe(
            catchError(error => {
                console.error('Error al cargar actividades:', error);
                if (error.status === 403) {
                    console.error('❌ Error 403: Permisos insuficientes. Entity slug:', this.entitySlug);
                }
                return of([]);
            })
        );
    }

    /**
     * Carga todas las actividades desde el backend
     */
    cargarTodasActividadesDesdeBackend(): Observable<ActividadPDM[]> {
        // Este método requeriría un endpoint especial en el backend
        // Por ahora, las actividades se cargan por producto
        return of([]);
    }

    /**
     * Crea una actividad en el backend
     */
    crearActividadEnBackend(actividad: ActividadPDM): Observable<ActividadPDM> {
        if (!this.entitySlug) {
            throw new Error('No hay slug de entidad disponible');
        }
        
        return this.http.post<ActividadPDM>(
            `${this.API_URL}/${this.entitySlug}/actividades`,
            actividad
        ).pipe(
            catchError(error => {
                console.error('Error al crear actividad:', error);
                throw error;
            })
        );
    }

    /**
     * Actualiza una actividad en el backend
     */
    actualizarActividadEnBackend(actividadId: number, datos: Partial<ActividadPDM>): Observable<ActividadPDM> {
        if (!this.entitySlug) {
            throw new Error('No hay slug de entidad disponible');
        }
        
        return this.http.put<ActividadPDM>(
            `${this.API_URL}/${this.entitySlug}/actividades/${actividadId}`,
            datos
        ).pipe(
            catchError(error => {
                console.error('Error al actualizar actividad:', error);
                throw error;
            })
        );
    }

    /**
     * Elimina una actividad del backend
     */
    eliminarActividadEnBackend(actividadId: number): Observable<void> {
        if (!this.entitySlug) {
            throw new Error('No hay slug de entidad disponible');
        }
        
        return this.http.delete<void>(
            `${this.API_URL}/${this.entitySlug}/actividades/${actividadId}`
        ).pipe(
            catchError(error => {
                console.error('Error al eliminar actividad:', error);
                throw error;
            })
        );
    }

    /**
     * Registra evidencia de una actividad en el backend
     */
    registrarEvidenciaEnBackend(actividadId: number, evidencia: EvidenciaActividad): Observable<any> {
        if (!this.entitySlug) {
            throw new Error('No hay slug de entidad disponible');
        }
        
        return this.http.post(
            `${this.API_URL}/${this.entitySlug}/actividades/${actividadId}/evidencia`,
            evidencia
        ).pipe(
            catchError(error => {
                console.error('Error al registrar evidencia:', error);
                throw error;
            })
        );
    }

    /**
     * Consulta la información de un proyecto BPIN desde la API de datos.gov.co
     * Usa el proxy del backend para evitar problemas de CORS
     * @param bpin Código BPIN del proyecto
     * @returns Observable con la información del proyecto o null si no se encuentra
     */
    consultarProyectoBPIN(bpin: string): Observable<ProyectoBPIN | null> {
        if (!bpin || bpin.trim() === '') {
            return of(null);
        }

        // Usar el endpoint proxy del backend para evitar CORS
        const url = `${environment.apiUrl}/bpin/${bpin}`;

        return this.http.get<ProyectoBPIN | null>(url).pipe(
            catchError(error => {
                console.error('Error al consultar BPIN:', error);
                return of(null);
            })
        );
    }

    /**
     * Obtiene la lista de usuarios/secretarios de la entidad actual
     */
    obtenerSecretariosEntidad(): Observable<any[]> {
    return this.http.get<any[]>(`${environment.apiUrl}/users/?role=secretario`).pipe(
            tap(resp => {
                console.log('🔍 Respuesta cruda de secretarios:', resp);
            }),
            catchError(error => {
                console.error('❌ Error al obtener secretarios:', error);
                if (error && error.error) {
                    console.error('❌ Detalle error:', error.error);
                }
                return of([]);
            })
        );
    }

    /**
     * Obtiene las actividades asignadas al usuario actual
     */
    obtenerMisActividades(anio?: number): Observable<ActividadPDM[]> {
        if (!this.entitySlug) {
            console.warn('⚠️ No hay slug de entidad disponible');
            return of([]);
        }

        let url = `${this.API_URL}/${this.entitySlug}/mis-actividades`;
        if (anio) {
            url += `?anio=${anio}`;
        }

        return this.http.get<ActividadPDM[]>(url).pipe(
            tap(actividades => {
                console.log('✅ Mis actividades obtenidas:', actividades.length);
            }),
            catchError(error => {
                console.error('❌ Error al obtener mis actividades:', error);
                return of([]);
            })
        );
    }

    /**
     * Asigna un responsable a un producto
     */
    asignarResponsableProducto(codigoProducto: string, responsableUserId: number): Observable<any> {
        if (!this.entitySlug) {
            console.warn('⚠️ No hay slug de entidad disponible');
            return of(null);
        }

        const url = `${this.API_URL}/${this.entitySlug}/productos/${codigoProducto}/responsable?responsable_user_id=${responsableUserId}`;
        
        return this.http.patch(url, {}).pipe(
            tap(response => {
                console.log('✅ Responsable asignado:', response);
            }),
            catchError(error => {
                console.error('❌ Error al asignar responsable:', error);
                throw error;
            })
        );
    }
}
