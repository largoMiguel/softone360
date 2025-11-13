import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { Meta } from '../models/plan.model';

export interface AIAnalysisRequest {
    totalPqrs: number;
    pendientes: number;
    enProceso: number;
    resueltas: number;
    cerradas: number;
    tiposPqrs: { [key: string]: number };
    tiempoPromedioRespuesta: number;
    tasaResolucion: number;
    tendenciaMensual: any[];
    fechaInicio?: string;
    fechaFin?: string;
}

export interface AIAnalysisResponse {
    introduccion: string;
    analisisGeneral: string;
    analisisTendencias: string;
    recomendaciones: string[];
    conclusiones: string;
}

export interface PlanAnalysisRequest {
    planNombre: string;
    planAnio: number;
    totalMetas: number;
    metasCompletadas: number;
    metasEnProgreso: number;
    metasAtrasadas: number;
    metasNoIniciadas: number;
    avanceGlobal: number;
    metas: Meta[];
}

export interface PlanAnalysisResponse {
    introduccion: string;
    analisis_general: string;
    analisis_metas: string;
    recomendaciones: string[];
    conclusiones: string;
}

import { environment } from '../../environments/environment';

@Injectable({
    providedIn: 'root'
})
export class AiService {
    private apiUrl = `${environment.apiUrl}/ai`;

    constructor(private http: HttpClient) { }

    generateReportAnalysis(data: AIAnalysisRequest): Observable<AIAnalysisResponse> {
        // Por ahora generamos análisis con lógica local
        // En producción, esto se conectaría a OpenAI o similar
        return of(this.generateLocalAnalysis(data));
    }

    private generateLocalAnalysis(data: AIAnalysisRequest): AIAnalysisResponse {
        const tasaResolucionPorcentaje = (data.tasaResolucion * 100).toFixed(1);
        const totalCerradas = data.resueltas + data.cerradas;
        const porcentajePendientes = ((data.pendientes / data.totalPqrs) * 100).toFixed(1);
        const porcentajeEnProceso = ((data.enProceso / data.totalPqrs) * 100).toFixed(1);

        // Introducción predeterminada + análisis IA
        const introduccionLegal = `En cumplimiento al Artículo 76 de la Ley 1474 de 2011, "En toda entidad pública, deberá existir por lo menos una dependencia encargada de recibir, tramitar y resolver las quejas, sugerencias y reclamos que los ciudadanos formulen, y que se relacionen con el cumplimiento de la misión de la entidad. La Oficina de Control Interno deberá vigilar que la atención se preste de acuerdo con las normas legales vigentes y rendirá a la administración de la entidad un informe semestral sobre el particular", así mismo la Ley 1755 de 2015 "por medio de la cual se regula el Derecho Fundamental de Petición". Decreto 1166 de Julio 19 de 2016 "Por el cual se adiciona el capítulo 12 al Título 3 de la Parte 2 del Libro 2 del Decreto 1069 de 2015, Decreto Único Reglamentario del Sector Justicia y del Derecho, relacionado con la presentación, tratamiento y radicación de las peticiones presentadas verbalmente". Resolución N° 001519 de 24 de agosto de 2020 "Por la cual se definen los estándares y directrices para publicar la información señalada en la Ley 1712 del 2014 y se definen los requisitos materia de acceso a la información pública, accesibilidad web, seguridad digital, y datos abiertos". Circular 100010-2021 Directrices para fortalecer la implementación de lenguaje claro.

El Municipio de Chiquiza realiza el seguimiento a las Peticiones, Quejas, Reclamos, Solicitudes y Denuncias (PQRSD) presentadas por los ciudadanos o grupo de ciudadanos con el fin de verificar su oportunidad, materialidad, congruencia y veracidad para lo cual se apoya en los registros del sistema de información del sitio web institucional, el cual lleva el registro desde su radicación hasta la salida de su respuesta, adicionalmente permite generar reportes permanentes sobre el estado de las PQRSD, buscando determinar las posibles debilidades y fortalezas para ser llevadas a la alta dirección en busca del mejoramiento continuo de la Entidad y con ella, afianzar la confianza del ciudadano en las instituciones públicas.

Así mismo Secretaría de Gobierno con funciones de control interno en desarrollo del Plan Anual de Auditoría 2024 y dando cumplimiento a lo estipulado en el Artículo 17 del Decreto 648 de 2017, respecto al desarrollo de sus roles de evaluación y seguimiento, liderazgo estratégico y enfoque hacia la prevención; efectuó seguimiento a la gestión del tercer trimestre de 2024 relacionada con la atención de las PQRS tramitadas por cada una de las dependencias que conforman la alcaldía municipal de Chiquiza.`;

        const introduccionAnalisis = `\n\nEl presente informe analiza el desempeño del sistema de PQRS durante el período evaluado. Se han registrado un total de ${data.totalPqrs} solicitudes, las cuales han sido categorizadas y procesadas según su naturaleza y prioridad. Este análisis busca identificar tendencias, evaluar la eficiencia en la gestión de respuestas y proporcionar recomendaciones estratégicas para mejorar la calidad del servicio ciudadano.`;

        const introduccion = introduccionLegal + introduccionAnalisis;

        // Análisis General
        let analisisGeneral = `Durante el período analizado, se gestionaron ${data.totalPqrs} PQRS en total. `;

        if (data.tasaResolucion >= 0.8) {
            analisisGeneral += `El sistema muestra un excelente desempeño con una tasa de resolución del ${tasaResolucionPorcentaje}%, indicando una gestión eficiente de las solicitudes ciudadanas. `;
        } else if (data.tasaResolucion >= 0.6) {
            analisisGeneral += `El sistema presenta un desempeño satisfactorio con una tasa de resolución del ${tasaResolucionPorcentaje}%, aunque existe margen de mejora. `;
        } else {
            analisisGeneral += `Se identifica una oportunidad de mejora significativa, con una tasa de resolución del ${tasaResolucionPorcentaje}%, lo que requiere atención prioritaria. `;
        }

        analisisGeneral += `Actualmente, ${data.pendientes} solicitudes (${porcentajePendientes}%) están pendientes de atención, ${data.enProceso} (${porcentajeEnProceso}%) se encuentran en proceso, y ${totalCerradas} han sido resueltas o cerradas.`;

        // Análisis de Tendencias
        const tipoMasComun = Object.entries(data.tiposPqrs).sort((a, b) => b[1] - a[1])[0];
        const analisisTendencias = `El análisis de los tipos de solicitud revela que "${tipoMasComun[0]}" representa el ${((tipoMasComun[1] / data.totalPqrs) * 100).toFixed(1)}% del total, siendo la categoría predominante. El tiempo promedio de respuesta es de ${data.tiempoPromedioRespuesta} días, lo cual ${data.tiempoPromedioRespuesta <= 15 ? 'cumple satisfactoriamente con los estándares establecidos' : 'supera los tiempos recomendados y requiere optimización'}. Esta información sugiere áreas específicas que demandan mayor atención por parte de la administración municipal.`;

        // Recomendaciones
        const recomendaciones: string[] = [];

        if (data.pendientes > data.totalPqrs * 0.2) {
            recomendaciones.push('Implementar un plan de acción inmediato para reducir el backlog de solicitudes pendientes, asignando recursos adicionales a las áreas con mayor carga de trabajo.');
        }

        if (data.tiempoPromedioRespuesta > 15) {
            recomendaciones.push('Establecer un sistema de alertas automáticas para solicitudes próximas a vencer, mejorando así los tiempos de respuesta y la satisfacción ciudadana.');
        }

        if (tipoMasComun[1] > data.totalPqrs * 0.4) {
            recomendaciones.push(`Crear un equipo especializado o protocolo específico para atender "${tipoMasComun[0]}", dado su alto volumen, lo que permitirá respuestas más ágiles y especializadas.`);
        }

        recomendaciones.push('Capacitar continuamente al personal en atención al ciudadano y manejo del sistema PQRS, enfocándose en la calidad de las respuestas y resolución efectiva de casos.');

        recomendaciones.push('Implementar encuestas de satisfacción post-resolución para medir la calidad percibida del servicio y obtener retroalimentación directa de los ciudadanos.');

        if (data.tasaResolucion < 0.7) {
            recomendaciones.push('Realizar un análisis detallado de las causas de la baja tasa de resolución, identificando cuellos de botella en los procesos y proponiendo mejoras estructurales.');
        }

        // Conclusiones
        let conclusiones = `El sistema de PQRS de la Alcaldía ${data.tasaResolucion >= 0.7 ? 'demuestra un funcionamiento efectivo' : 'presenta oportunidades significativas de mejora'} en la gestión de solicitudes ciudadanas. `;

        if (data.tiempoPromedioRespuesta <= 15 && data.tasaResolucion >= 0.8) {
            conclusiones += 'Los indicadores de tiempo de respuesta y tasa de resolución reflejan un compromiso sólido con la atención ciudadana. ';
        }

        conclusiones += 'La implementación de las recomendaciones propuestas contribuirá a fortalecer la relación entre la administración municipal y la ciudadanía, mejorando la percepción de eficiencia y transparencia en la gestión pública. Es fundamental mantener un monitoreo constante de estos indicadores para garantizar la mejora continua del servicio.';

        return {
            introduccion,
            analisisGeneral,
            analisisTendencias,
            recomendaciones,
            conclusiones
        };
    }

    // Método para análisis con IA real (OpenAI) - para implementar en el backend
    generateAIReportAnalysis(data: AIAnalysisRequest): Observable<AIAnalysisResponse> {
        return this.http.post<AIAnalysisResponse>(`${this.apiUrl}/generate-report`, data).pipe(
            catchError(() => {
                // Fallback a análisis local si falla la IA
                return of(this.generateLocalAnalysis(data));
            })
        );
    }

    /**
     * Genera análisis para planes institucionales
     */
    generatePlanAnalysis(data: PlanAnalysisRequest): Observable<PlanAnalysisResponse> {
        return of(this.generateLocalPlanAnalysis(data));
    }

    private generateLocalPlanAnalysis(data: PlanAnalysisRequest): PlanAnalysisResponse {
        const porcentajeCompletadas = ((data.metasCompletadas / data.totalMetas) * 100).toFixed(1);
        const porcentajeEnProgreso = ((data.metasEnProgreso / data.totalMetas) * 100).toFixed(1);
        const porcentajeAtrasadas = ((data.metasAtrasadas / data.totalMetas) * 100).toFixed(1);
        const porcentajeNoIniciadas = ((data.metasNoIniciadas / data.totalMetas) * 100).toFixed(1);

        // Introducción
        const introduccion = `El presente informe tiene como objetivo evaluar el avance y cumplimiento del plan institucional "${data.planNombre}" correspondiente al año ${data.planAnio}. Este plan estratégico constituye una herramienta fundamental para el fortalecimiento de la gestión pública municipal, estableciendo metas claras y medibles que contribuyen al desarrollo integral del municipio y al mejoramiento de la calidad de vida de sus habitantes.

El seguimiento sistemático de las metas institucionales permite identificar oportunamente los logros alcanzados, los desafíos pendientes y las áreas que requieren atención prioritaria. A través de este análisis, la administración municipal puede tomar decisiones informadas, ajustar estrategias y asegurar el uso eficiente de los recursos públicos.

El plan cuenta con ${data.totalMetas} metas definidas, cada una con indicadores específicos que permiten medir objetivamente el progreso hacia los objetivos institucionales. Este informe analiza el estado actual de cada meta, evalúa el avance global del plan y proporciona recomendaciones estratégicas para optimizar su implementación.`;

        // Análisis General
        let analisisGeneral = `El plan institucional "${data.planNombre}" presenta un avance global del ${data.avanceGlobal}%. `;

        if (data.avanceGlobal >= 80) {
            analisisGeneral += `Este resultado refleja un desempeño sobresaliente en la ejecución del plan, evidenciando un compromiso efectivo con el cumplimiento de los objetivos institucionales. `;
        } else if (data.avanceGlobal >= 60) {
            analisisGeneral += `Este resultado muestra un progreso satisfactorio en la implementación del plan, aunque existen oportunidades para acelerar el cumplimiento de algunas metas. `;
        } else if (data.avanceGlobal >= 40) {
            analisisGeneral += `Este resultado indica un avance moderado que requiere atención y acciones correctivas para garantizar el cumplimiento de los objetivos en los plazos establecidos. `;
        } else {
            analisisGeneral += `Este resultado evidencia un nivel de avance bajo que requiere intervención urgente y replanteo de estrategias para recuperar el ritmo de implementación. `;
        }

        analisisGeneral += `Del total de ${data.totalMetas} metas definidas, ${data.metasCompletadas} (${porcentajeCompletadas}%) han sido completadas exitosamente, ${data.metasEnProgreso} (${porcentajeEnProgreso}%) se encuentran en ejecución activa, ${data.metasAtrasadas} (${porcentajeAtrasadas}%) presentan retrasos significativos, y ${data.metasNoIniciadas} (${porcentajeNoIniciadas}%) aún no han iniciado su implementación.`;

        if (data.metasCompletadas >= data.totalMetas * 0.5) {
            analisisGeneral += ` La alta tasa de metas completadas refleja una gestión eficiente y capacidad de ejecución robusta por parte de los equipos responsables.`;
        }

        if (data.metasAtrasadas > data.totalMetas * 0.3) {
            analisisGeneral += ` El número considerable de metas atrasadas requiere análisis detallado de las causas y definición de planes de recuperación específicos.`;
        }

        // Análisis por Metas
        let analisisMetas = `El análisis detallado de las metas revela patrones importantes para la gestión del plan:\n\n`;

        // Metas con mejor desempeño
        const metasOrdenadas = [...data.metas].sort((a, b) => {
            const avanceA = (a.avance_actual / a.meta_numerica) * 100;
            const avanceB = (b.avance_actual / b.meta_numerica) * 100;
            return avanceB - avanceA;
        });

        if (metasOrdenadas.length > 0) {
            const mejoresMetas = metasOrdenadas.slice(0, Math.min(3, metasOrdenadas.length));
            analisisMetas += `**Metas de Alto Desempeño:**\n`;
            mejoresMetas.forEach((meta, index) => {
                const avance = ((meta.avance_actual / meta.meta_numerica) * 100).toFixed(1);
                analisisMetas += `${index + 1}. "${meta.nombre}" - Avance: ${avance}% (${meta.avance_actual}/${meta.meta_numerica}). Responsable: ${meta.responsable}.\n`;
            });

            // Metas que requieren atención
            const metasAtrasadas = data.metas.filter(m => m.estado === 'atrasada' ||
                (m.avance_actual / m.meta_numerica) < 0.5);

            if (metasAtrasadas.length > 0) {
                analisisMetas += `\n**Metas que Requieren Atención Prioritaria:**\n`;
                metasAtrasadas.slice(0, Math.min(3, metasAtrasadas.length)).forEach((meta, index) => {
                    const avance = ((meta.avance_actual / meta.meta_numerica) * 100).toFixed(1);
                    analisisMetas += `${index + 1}. "${meta.nombre}" - Avance: ${avance}% (${meta.avance_actual}/${meta.meta_numerica}). Estado: ${meta.estado}. Responsable: ${meta.responsable}.\n`;
                });
            }
        }

        analisisMetas += `\nLa distribución de responsabilidades muestra que el éxito del plan depende de la coordinación efectiva entre diferentes áreas de la administración municipal. Es fundamental fortalecer los mecanismos de seguimiento y apoyo a los responsables de las metas que presentan mayores desafíos.`;

        // Recomendaciones
        const recomendaciones: string[] = [];

        if (data.metasAtrasadas > 0) {
            recomendaciones.push(`Establecer reuniones de seguimiento semanal con los responsables de las ${data.metasAtrasadas} metas atrasadas, identificando obstáculos específicos y definiendo planes de acción correctivos con plazos concretos.`);
        }

        if (data.metasNoIniciadas > 0) {
            recomendaciones.push(`Iniciar de manera inmediata la ejecución de las ${data.metasNoIniciadas} metas pendientes, asignando recursos necesarios y estableciendo cronogramas de implementación detallados.`);
        }

        if (data.avanceGlobal < 60) {
            recomendaciones.push('Realizar una evaluación exhaustiva de los factores que limitan el avance del plan, considerando aspectos presupuestales, técnicos, humanos y de coordinación interinstitucional.');
        }

        recomendaciones.push('Implementar un sistema de alertas tempranas que permita identificar desviaciones en el cumplimiento de metas antes de que se conviertan en retrasos significativos.');

        recomendaciones.push('Fortalecer las capacidades técnicas de los equipos responsables mediante programas de capacitación específicos y asistencia técnica especializada en áreas críticas.');

        recomendaciones.push('Establecer mecanismos de reconocimiento y estímulo para los equipos que logren cumplir o superar sus metas, promoviendo una cultura de alto desempeño institucional.');

        if (data.metasCompletadas / data.totalMetas >= 0.3) {
            recomendaciones.push('Documentar y socializar las buenas prácticas identificadas en las metas exitosas, creando una base de conocimiento que pueda replicarse en otras áreas.');
        }

        recomendaciones.push('Mantener comunicación constante con la ciudadanía sobre el avance del plan institucional, fortaleciendo la transparencia y rendición de cuentas de la gestión pública.');

        // Conclusiones
        let conclusiones = `El plan institucional "${data.planNombre}" se encuentra `;

        if (data.avanceGlobal >= 70) {
            conclusiones += `en una fase avanzada de implementación con resultados favorables. `;
        } else if (data.avanceGlobal >= 40) {
            conclusiones += `en una fase intermedia de ejecución que requiere fortalecer algunas áreas críticas. `;
        } else {
            conclusiones += `en una etapa inicial que demanda acciones urgentes para recuperar el ritmo de implementación. `;
        }

        conclusiones += `Con un avance global del ${data.avanceGlobal}% y ${data.metasCompletadas} metas completadas de ${data.totalMetas}, se evidencia `;

        if (data.metasCompletadas >= data.totalMetas * 0.5) {
            conclusiones += `un nivel significativo de cumplimiento que refleja el compromiso institucional con los objetivos estratégicos.`;
        } else {
            conclusiones += `la necesidad de redoblar esfuerzos para alcanzar los objetivos planteados en los plazos establecidos.`;
        }

        conclusiones += `\n\nLa implementación efectiva de las recomendaciones propuestas, junto con un seguimiento riguroso y un liderazgo institucional comprometido, permitirá consolidar los logros alcanzados y superar los desafíos identificados. Es fundamental mantener la perspectiva de que el plan institucional no es solo un instrumento de gestión administrativa, sino una herramienta de transformación social que impacta directamente en la calidad de vida de los ciudadanos.`;

        conclusiones += `\n\nLa administración municipal debe continuar promoviendo la cultura de planeación estratégica, medición de resultados y mejoramiento continuo, garantizando que cada meta contribuya efectivamente al desarrollo sostenible del municipio y al fortalecimiento de la confianza ciudadana en las instituciones públicas.`;

        return {
            introduccion,
            analisis_general: analisisGeneral,
            analisis_metas: analisisMetas,
            recomendaciones,
            conclusiones
        };
    }
}
