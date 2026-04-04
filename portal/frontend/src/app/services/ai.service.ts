import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';

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
    entityName?: string;
}

export interface AIAnalysisResponse {
    introduccion: string;
    analisisGeneral: string;
    analisisTendencias: string;
    recomendaciones: string[];
    conclusiones: string;
}



@Injectable({
    providedIn: 'root'
})
export class AiService {
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
        const entityName = data.entityName || 'la Entidad';

        // Introducción predeterminada + análisis IA
        const introduccionLegal = `En cumplimiento al Artículo 76 de la Ley 1474 de 2011, "En toda entidad pública, deberá existir por lo menos una dependencia encargada de recibir, tramitar y resolver las quejas, sugerencias y reclamos que los ciudadanos formulen, y que se relacionen con el cumplimiento de la misión de la entidad. La Oficina de Control Interno deberá vigilar que la atención se preste de acuerdo con las normas legales vigentes y rendirá a la administración de la entidad un informe semestral sobre el particular", así mismo la Ley 1755 de 2015 "por medio de la cual se regula el Derecho Fundamental de Petición". Decreto 1166 de Julio 19 de 2016 "Por el cual se adiciona el capítulo 12 al Título 3 de la Parte 2 del Libro 2 del Decreto 1069 de 2015, Decreto Único Reglamentario del Sector Justicia y del Derecho, relacionado con la presentación, tratamiento y radicación de las peticiones presentadas verbalmente". Resolución N° 001519 de 24 de agosto de 2020 "Por la cual se definen los estándares y directrices para publicar la información señalada en la Ley 1712 del 2014 y se definen los requisitos materia de acceso a la información pública, accesibilidad web, seguridad digital, y datos abiertos". Circular 100010-2021 Directrices para fortalecer la implementación de lenguaje claro.

${entityName} realiza el seguimiento a las Peticiones, Quejas, Reclamos, Solicitudes y Denuncias (PQRSD) presentadas por los ciudadanos o grupo de ciudadanos con el fin de verificar su oportunidad, materialidad, congruencia y veracidad para lo cual se apoya en los registros del sistema de información del sitio web institucional, el cual lleva el registro desde su radicación hasta la salida de su respuesta, adicionalmente permite generar reportes permanentes sobre el estado de las PQRSD, buscando determinar las posibles debilidades y fortalezas para ser llevadas a la alta dirección en busca del mejoramiento continuo de la Entidad y con ella, afianzar la confianza del ciudadano en las instituciones públicas.

Así mismo Secretaría de Gobierno con funciones de control interno en desarrollo del Plan Anual de Auditoría 2024 y dando cumplimiento a lo estipulado en el Artículo 17 del Decreto 648 de 2017, respecto al desarrollo de sus roles de evaluación y seguimiento, liderazgo estratégico y enfoque hacia la prevención; efectuó seguimiento a la gestión del tercer trimestre de 2024 relacionada con la atención de las PQRS tramitadas por cada una de las dependencias que conforman ${entityName}.`;

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
        let conclusiones = `El sistema de PQRS de ${entityName} ${data.tasaResolucion >= 0.7 ? 'demuestra un funcionamiento efectivo' : 'presenta oportunidades significativas de mejora'} en la gestión de solicitudes ciudadanas. `;

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
}
