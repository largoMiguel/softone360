/**
 * Analizador avanzado de contratos con deduplicación, KPIs extendidos y alertas
 */

import { ProcesoContratacion } from '../models/contratacion.model';

export interface ContratoAlerta {
    tipo: 'vencido' | 'proximo_vencimiento' | 'ejecucion_retrasada';
    contrato: ProcesoContratacion;
    mensaje: string;
    diasDiferencia?: number;
    severidad: 'crítica' | 'advertencia' | 'info';
}

export interface KPIsExtendidos {
    // KPIs básicos
    totalProcesos: number;
    totalAdjudicados: number;
    tasaAdjudicacion: number;
    sumaAdjudicado: number;
    promedioPrecioBase: number;

    // KPIs de ejecución y tiempos
    totalContratosPorAño: Record<string, number>;
    totalContratosPorMes: Record<string, number>;
    modalidadesMasUsadas: Array<{ modalidad: string; cantidad: number; porcentaje: number }>;
    proveedoresMasFrecuentes: Array<{ proveedor: string; cantidad: number; valorTotal: number }>;
    distribucionEstados: Record<string, number>;
    tiempoEjecucionPromedio: number; // en días
    tiempoEjecucionRango: { min: number; max: number }; // en días

    // KPIs de ejecución retrasada
    contratosRetrasados: number;
    porcentajeRetrasados: number;
    contratosVencidos: number;
    porcentajeVencidos: number;
    
    // KPIs de próximos vencimientos (próximos 30 días)
    contratosProximoVencimiento: number;
    porcentajeProximoVencimiento: number;
}

export class ContratacionAnalyzer {
    /**
     * Deduplicar contratos por ID o combinación de campos únicos
     * @param contratos Lista de contratos
     * @returns Lista sin duplicados
     */
    static deduplicarContratos(contratos: ProcesoContratacion[]): ProcesoContratacion[] {
        const seen = new Set<string>();
        const deduplicados: ProcesoContratacion[] = [];

        for (const contrato of contratos) {
            // Prioridad 1: Usar ID del contrato si existe
            let key: string;
            if (contrato.id_contrato) {
                key = `id:${contrato.id_contrato}`;
            } else {
                // Prioridad 2: Usar combinación de campos únicos
                const ref = contrato.referencia_del_contrato || '';
                const nit = contrato.nit_entidad || '';
                const doc = contrato.documento_proveedor || '';
                const fecha = contrato.fecha_de_firma || '';
                key = `${ref}|${nit}|${doc}|${fecha}`;
            }

            if (!seen.has(key)) {
                seen.add(key);
                deduplicados.push(contrato);
            }
        }

        return deduplicados;
    }

    /**
     * Calcular duración real del contrato en días
     */
    static calcularDuracionDias(contrato: ProcesoContratacion): number {
        if (!contrato.fecha_de_inicio_del_contrato || !contrato.fecha_de_fin_del_contrato) {
            return 0;
        }

        const inicio = new Date(contrato.fecha_de_inicio_del_contrato);
        const fin = new Date(contrato.fecha_de_fin_del_contrato);

        if (isNaN(inicio.getTime()) || isNaN(fin.getTime())) {
            return 0;
        }

        const diffTime = fin.getTime() - inicio.getTime();
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    /**
     * Verificar si un contrato está vencido
     */
    static isContratoVencido(contrato: ProcesoContratacion): boolean {
        if (!contrato.fecha_de_fin_del_contrato) return false;

        const fechaFin = new Date(contrato.fecha_de_fin_del_contrato);
        if (isNaN(fechaFin.getTime())) return false;

        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        fechaFin.setHours(0, 0, 0, 0);

        // Normalizar estado
        const estado = this.normalizarEstado(contrato.estado_contrato || '');
        const estadosFinalizados = ['terminado', 'cerrado', 'liquidado', 'cancelado', 'suspendido', 'anulado'];

        // Si ya está finalizado, no se considera "vencido"
        if (estadosFinalizados.includes(estado)) return false;

        // Vencido: fecha de fin pasada y no finalizado
        return fechaFin < hoy;
    }

    /**
     * Calcular días de vencimiento
     */
    static calcularDiasVencimiento(contrato: ProcesoContratacion): number {
        if (!contrato.fecha_de_fin_del_contrato) return 0;

        const fechaFin = new Date(contrato.fecha_de_fin_del_contrato);
        if (isNaN(fechaFin.getTime())) return 0;

        const hoy = new Date();
        const diffTime = hoy.getTime() - fechaFin.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        return diffDays > 0 ? diffDays : 0;
    }

    /**
     * Calcular días hasta vencimiento (negativo si ya vencido)
     */
    static calcularDiasHastaVencimiento(contrato: ProcesoContratacion): number {
        if (!contrato.fecha_de_fin_del_contrato) return Number.MAX_SAFE_INTEGER;

        const fechaFin = new Date(contrato.fecha_de_fin_del_contrato);
        if (isNaN(fechaFin.getTime())) return Number.MAX_SAFE_INTEGER;

        const hoy = new Date();
        const diffTime = fechaFin.getTime() - hoy.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        return diffDays;
    }

    /**
     * Verificar si hay ejecución retrasada
     * Comparar fecha actual con fecha de fin y verificar que aún esté en ejecución
     */
    static isEjecucionRetrasada(contrato: ProcesoContratacion): boolean {
        // Solo contratos activos pueden estar retrasados
        const estado = this.normalizarEstado(contrato.estado_contrato || '');
        const estadosActivos = ['en ejecucion', 'celebrado', 'aprobado', 'modificado', 'activo'];
        if (!estadosActivos.includes(estado)) return false;

        // Sin fecha de fin, no se puede determinar
        if (!contrato.fecha_de_fin_del_contrato) return false;

        const fechaFin = new Date(contrato.fecha_de_fin_del_contrato);
        if (isNaN(fechaFin.getTime())) return false;

        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        fechaFin.setHours(0, 0, 0, 0);

        // Retrasado: ya pasó la fecha de fin pero sigue en ejecución
        return hoy > fechaFin;
    }

    /**
     * Generar alertas para un conjunto de contratos
     */
    static generarAlertas(contratos: ProcesoContratacion[]): ContratoAlerta[] {
        const alertas: ContratoAlerta[] = [];
        const hoy = new Date();

        for (const contrato of contratos) {
            // Alerta 1: Contrato vencido
            if (this.isContratoVencido(contrato)) {
                const diasVencidos = this.calcularDiasVencimiento(contrato);
                alertas.push({
                    tipo: 'vencido',
                    contrato,
                    mensaje: `⚠️ Contrato vencido hace ${diasVencidos} días`,
                    diasDiferencia: diasVencidos,
                    severidad: diasVencidos > 30 ? 'crítica' : 'advertencia'
                });
            }

            // Alerta 2: Próximo vencimiento (próximos 30 días)
            const diasHastaVencimiento = this.calcularDiasHastaVencimiento(contrato);
            if (diasHastaVencimiento > 0 && diasHastaVencimiento <= 30) {
                alertas.push({
                    tipo: 'proximo_vencimiento',
                    contrato,
                    mensaje: `⏰ Vence en ${diasHastaVencimiento} días`,
                    diasDiferencia: diasHastaVencimiento,
                    severidad: diasHastaVencimiento <= 7 ? 'crítica' : 'advertencia'
                });
            }

            // Alerta 3: Ejecución retrasada
            if (this.isEjecucionRetrasada(contrato)) {
                const diasRetrasados = this.calcularDiasVencimiento(contrato);
                alertas.push({
                    tipo: 'ejecucion_retrasada',
                    contrato,
                    mensaje: `⚡ Ejecución retrasada ${diasRetrasados} días`,
                    diasDiferencia: diasRetrasados,
                    severidad: 'crítica'
                });
            }
        }

        return alertas;
    }

    /**
     * Calcular KPIs extendidos
     */
    static calcularKPIsExtendidos(contratos: ProcesoContratacion[]): KPIsExtendidos {
        const toNumber = (v: any): number => {
            if (v === null || v === undefined) return 0;
            if (typeof v === 'number') return v;
            const s = String(v).replace(/[^0-9.-]/g, '');
            const n = Number(s);
            return isNaN(n) ? 0 : n;
        };

        const total = contratos.length;
        const adjudicados = contratos.filter(c => this.isContratoActivo(c)).length;
        const sumaAdjudicado = contratos.reduce((acc, c) => acc + toNumber(c.valor_del_contrato), 0);
        const promedioPrecio = total > 0 ? sumaAdjudicado / total : 0;

        // KPIs por año/mes
        const porAño: Record<string, number> = {};
        const porMes: Record<string, number> = {};

        for (const contrato of contratos) {
            if (contrato.fecha_de_firma) {
                const fecha = new Date(contrato.fecha_de_firma);
                if (!isNaN(fecha.getTime())) {
                    const año = fecha.getFullYear().toString();
                    const mes = `${año}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
                    porAño[año] = (porAño[año] || 0) + 1;
                    porMes[mes] = (porMes[mes] || 0) + 1;
                }
            }
        }

        // Modalidades más usadas
        const modalidadesMap = new Map<string, number>();
        for (const c of contratos) {
            const mod = c.modalidad_de_contratacion || 'N/D';
            modalidadesMap.set(mod, (modalidadesMap.get(mod) || 0) + 1);
        }
        const modalidadesMasUsadas = Array.from(modalidadesMap.entries())
            .map(([mod, count]) => ({
                modalidad: mod,
                cantidad: count,
                porcentaje: (count / total) * 100
            }))
            .sort((a, b) => b.cantidad - a.cantidad);

        // Proveedores más frecuentes
        const proveedoresMap = new Map<string, { cantidad: number; valor: number }>();
        for (const c of contratos) {
            const prov = c.proveedor_adjudicado || 'N/D';
            const valor = toNumber(c.valor_del_contrato);
            const curr = proveedoresMap.get(prov) || { cantidad: 0, valor: 0 };
            proveedoresMap.set(prov, {
                cantidad: curr.cantidad + 1,
                valor: curr.valor + valor
            });
        }
        const proveedoresMasFrecuentes = Array.from(proveedoresMap.entries())
            .map(([prov, data]) => ({
                proveedor: prov,
                cantidad: data.cantidad,
                valorTotal: data.valor
            }))
            .sort((a, b) => b.cantidad - a.cantidad)
            .slice(0, 20);

        // Distribución de estados
        const estadosMap = new Map<string, number>();
        for (const c of contratos) {
            const estado = c.estado_contrato || 'N/D';
            estadosMap.set(estado, (estadosMap.get(estado) || 0) + 1);
        }
        const distribucionEstados: Record<string, number> = {};
        estadosMap.forEach((v, k) => {
            distribucionEstados[k] = v;
        });

        // Tiempo de ejecución promedio
        const duraciones = contratos
            .map(c => this.calcularDuracionDias(c))
            .filter(d => d > 0);
        const tiempoPromedio = duraciones.length > 0 ? duraciones.reduce((a, b) => a + b, 0) / duraciones.length : 0;
        const tiempoMin = duraciones.length > 0 ? Math.min(...duraciones) : 0;
        const tiempoMax = duraciones.length > 0 ? Math.max(...duraciones) : 0;

        // Contratos retrasados
        const retrasados = contratos.filter(c => this.isEjecucionRetrasada(c)).length;
        
        // Contratos vencidos
        const vencidos = contratos.filter(c => this.isContratoVencido(c)).length;

        // Próximos vencimientos (30 días)
        const proximosVencimiento = contratos.filter(c => {
            const dias = this.calcularDiasHastaVencimiento(c);
            return dias > 0 && dias <= 30;
        }).length;

        return {
            totalProcesos: total,
            totalAdjudicados: adjudicados,
            tasaAdjudicacion: total > 0 ? adjudicados / total : 0,
            sumaAdjudicado,
            promedioPrecioBase: promedioPrecio,
            totalContratosPorAño: porAño,
            totalContratosPorMes: porMes,
            modalidadesMasUsadas,
            proveedoresMasFrecuentes,
            distribucionEstados,
            tiempoEjecucionPromedio: Math.round(tiempoPromedio),
            tiempoEjecucionRango: { min: tiempoMin, max: tiempoMax },
            contratosRetrasados: retrasados,
            porcentajeRetrasados: total > 0 ? (retrasados / total) * 100 : 0,
            contratosVencidos: vencidos,
            porcentajeVencidos: total > 0 ? (vencidos / total) * 100 : 0,
            contratosProximoVencimiento: proximosVencimiento,
            porcentajeProximoVencimiento: total > 0 ? (proximosVencimiento / total) * 100 : 0
        };
    }

    /**
     * Verificar si un contrato está activo/en ejecución
     */
    private static isContratoActivo(contrato: ProcesoContratacion): boolean {
        const estado = this.normalizarEstado(contrato.estado_contrato || '');
        const estadosActivos = ['en ejecucion', 'celebrado', 'aprobado', 'modificado', 'activo'];
        return estadosActivos.includes(estado);
    }

    /**
     * Normalizar estado para comparación
     */
    static normalizarEstado(estado: string): string {
        return (estado || '')
            .toString()
            .trim()
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
    }
}
