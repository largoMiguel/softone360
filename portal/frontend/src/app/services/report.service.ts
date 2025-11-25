import { Injectable } from '@angular/core';
import { PQRSWithDetails } from '../models/pqrs.model';
import type jsPDF from 'jspdf';

@Injectable({
    providedIn: 'root'
})
export class ReportService {

    constructor() { }

    private pdfLibsPromise?: Promise<{ jsPDF: any; autoTable: any }>;
    private _autoTable: any;

    private async loadPdfLibs(): Promise<{ jsPDF: any; autoTable: any }> {
        if (!this.pdfLibsPromise) {
            this.pdfLibsPromise = Promise.all([
                import('jspdf'),
                import('jspdf-autotable')
            ]).then(([jsPdfMod, autoTableMod]) => {
                const jsPDFClass = jsPdfMod.default;
                const autoTableFn = (autoTableMod as any).default || (autoTableMod as any);
                this._autoTable = autoTableFn;
                return { jsPDF: jsPDFClass, autoTable: autoTableFn };
            });
        }
        return this.pdfLibsPromise;
    }

    /**
     * Genera un reporte en formato PDF con análisis de IA, gráficos y tablas
     */
    async generatePDFReport(
        pqrsList: PQRSWithDetails[],
        charts: { estados: string; tipos: string; tendencias: string },
        aiAnalysis: any,
        analytics: any,
        fechaInicio: string,
        fechaFin: string
    ): Promise<void> {
        const { jsPDF } = await this.loadPdfLibs();
        const doc = new jsPDF('p', 'mm', 'letter');
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        let yPosition = 20;

        // Función auxiliar para agregar nueva página si es necesario
        const checkAddPage = (requiredSpace: number) => {
            if (yPosition + requiredSpace > pageHeight - 20) {
                doc.addPage();
                yPosition = 20;
                return true;
            }
            return false;
        };

        // Función para agregar texto con wrap
        const addWrappedText = (text: string, x: number, maxWidth: number, fontSize: number = 10, align: 'left' | 'center' | 'justify' = 'justify') => {
            doc.setFontSize(fontSize);
            const lines = doc.splitTextToSize(text, maxWidth);
            lines.forEach((line: string) => {
                checkAddPage(7);
                doc.text(line, x, yPosition, { align: align });
                yPosition += 5;
            });
        };

        // ***** PORTADA *****
        // Logo o encabezado
        doc.setFillColor(102, 126, 234);
        doc.rect(0, 0, pageWidth, 40, 'F');

        doc.setTextColor(255, 255, 255);
        doc.setFontSize(24);
        doc.setFont('helvetica', 'bold');
        doc.text('INFORME DE PQRS', pageWidth / 2, 20, { align: 'center' });

        doc.setFontSize(14);
        doc.setFont('helvetica', 'normal');
        doc.text('Alcaldía Municipal de Chiquiza', pageWidth / 2, 30, { align: 'center' });

        yPosition = 60;

        // Fecha del reporte
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        const fechaReporte = new Date().toLocaleDateString('es-CO', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        doc.text(`Fecha de Generación: ${fechaReporte}`, 20, yPosition);
        yPosition += 10;

        // ***** ALCANCE *****
        checkAddPage(30);
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(102, 126, 234);
        doc.text('ALCANCE', 20, yPosition);
        yPosition += 8;

        doc.setTextColor(0, 0, 0);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        const alcanceText = `El seguimiento se realiza a las PQRSD radicadas durante el período comprendido entre ${fechaInicio} y ${fechaFin}, con base en la información suministrada por el sistema de PQRS del sitio web institucional del municipio de Chiquiza.`;
        addWrappedText(alcanceText, 20, pageWidth - 40, 10, 'justify');
        yPosition += 5;

        // ***** INTRODUCCIÓN *****
        doc.addPage();
        yPosition = 20;

        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(102, 126, 234);
        doc.text('INTRODUCCIÓN', 20, yPosition);
        yPosition += 8;

        doc.setTextColor(0, 0, 0);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        addWrappedText(aiAnalysis.introduccion, 20, pageWidth - 40, 9, 'justify');
        yPosition += 5;

        // ***** DASHBOARD ANALYTICS *****
        checkAddPage(50);
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(102, 126, 234);
        doc.text('INDICADORES GENERALES', 20, yPosition);
        yPosition += 10;

        // Tabla de indicadores
        const indicadores = [
            ['Total de PQRS', analytics.totalPqrs.toString()],
            ['PQRS Pendientes', analytics.pendientes.toString()],
            ['PQRS En Proceso', analytics.enProceso.toString()],
            ['PQRS Resueltas', analytics.resueltas.toString()],
            ['PQRS Cerradas', analytics.cerradas.toString()],
            ['Tasa de Resolución', `${analytics.tasaResolucion}%`],
            ['Tiempo Promedio de Respuesta', `${analytics.tiempoPromedioRespuesta} días`]
        ];

        this._autoTable(doc, {
            startY: yPosition,
            head: [['Indicador', 'Valor']],
            body: indicadores,
            theme: 'grid',
            headStyles: { fillColor: [102, 126, 234], textColor: 255, fontStyle: 'bold' },
            styles: { fontSize: 10, cellPadding: 3 },
            columnStyles: {
                0: { fontStyle: 'bold', cellWidth: 120 },
                1: { halign: 'center', cellWidth: 'auto' }
            }
        });

        yPosition = (doc as any).lastAutoTable.finalY + 10;

        // ***** TABLA DE PQRS POR TIPO *****
        checkAddPage(40);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(102, 126, 234);
        doc.text('Distribución por Tipo de PQRS', 20, yPosition);
        yPosition += 8;

        const tiposData: any[][] = [];
        const tiposPqrs = analytics.tiposPqrs || {};
        Object.entries(tiposPqrs).forEach(([tipo, cantidad]: [string, any]) => {
            const porcentaje = ((cantidad / analytics.totalPqrs) * 100).toFixed(1);
            tiposData.push([this.capitalizeFirst(tipo), cantidad.toString(), `${porcentaje}%`]);
        });

        this._autoTable(doc, {
            startY: yPosition,
            head: [['Tipo', 'Cantidad', 'Porcentaje']],
            body: tiposData,
            theme: 'striped',
            headStyles: { fillColor: [102, 126, 234], textColor: 255, fontStyle: 'bold' },
            styles: { fontSize: 10, cellPadding: 3 },
            columnStyles: {
                0: { cellWidth: 100 },
                1: { halign: 'center', cellWidth: 40 },
                2: { halign: 'center', cellWidth: 40 }
            }
        });

        yPosition = (doc as any).lastAutoTable.finalY + 10;

        // ***** TABLA DE PQRS POR ESTADO *****
        checkAddPage(40);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(102, 126, 234);
        doc.text('Distribución por Estado', 20, yPosition);
        yPosition += 8;

        const estadosData = [
            ['Pendiente', analytics.pendientes.toString(), `${((analytics.pendientes / analytics.totalPqrs) * 100).toFixed(1)}%`],
            ['En Proceso', analytics.enProceso.toString(), `${((analytics.enProceso / analytics.totalPqrs) * 100).toFixed(1)}%`],
            ['Resuelta', analytics.resueltas.toString(), `${((analytics.resueltas / analytics.totalPqrs) * 100).toFixed(1)}%`],
            ['Cerrada', analytics.cerradas.toString(), `${((analytics.cerradas / analytics.totalPqrs) * 100).toFixed(1)}%`]
        ];

        this._autoTable(doc, {
            startY: yPosition,
            head: [['Estado', 'Cantidad', 'Porcentaje']],
            body: estadosData,
            theme: 'striped',
            headStyles: { fillColor: [76, 175, 80], textColor: 255, fontStyle: 'bold' },
            styles: { fontSize: 10, cellPadding: 3 },
            columnStyles: {
                0: { cellWidth: 100 },
                1: { halign: 'center', cellWidth: 40 },
                2: { halign: 'center', cellWidth: 40 }
            }
        });

        yPosition = (doc as any).lastAutoTable.finalY + 10;

        // ***** GRÁFICOS *****
        doc.addPage();
        yPosition = 20;

        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(102, 126, 234);
        doc.text('GRÁFICOS ESTADÍSTICOS', 20, yPosition);
        yPosition += 10;

        // Gráfico de Estados
        if (charts.estados) {
            doc.setFontSize(12);
            doc.setTextColor(0, 0, 0);
            doc.text('Distribución por Estado', 20, yPosition);
            yPosition += 5;
            try {
                doc.addImage(charts.estados, 'PNG', 20, yPosition, 80, 60);
                yPosition += 65;
            } catch (error) {
                // console.error('Error al agregar gráfico de estados:', error);
            }
        }

        checkAddPage(70);

        // Gráfico de Tipos
        if (charts.tipos) {
            doc.setFontSize(12);
            doc.text('Distribución por Tipo', 20, yPosition);
            yPosition += 5;
            try {
                doc.addImage(charts.tipos, 'PNG', 20, yPosition, 170, 60);
                yPosition += 65;
            } catch (error) {
                // console.error('Error al agregar gráfico de tipos:', error);
            }
        }

        // ***** ANÁLISIS GENERAL *****
        doc.addPage();
        yPosition = 20;

        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(102, 126, 234);
        doc.text('ANÁLISIS GENERAL', 20, yPosition);
        yPosition += 8;

        doc.setTextColor(0, 0, 0);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        addWrappedText(aiAnalysis.analisisGeneral, 20, pageWidth - 40, 10, 'justify');
        yPosition += 5;

        // ***** ANÁLISIS DE TENDENCIAS *****
        checkAddPage(30);
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(102, 126, 234);
        doc.text('ANÁLISIS DE TENDENCIAS', 20, yPosition);
        yPosition += 8;

        doc.setTextColor(0, 0, 0);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        addWrappedText(aiAnalysis.analisisTendencias, 20, pageWidth - 40, 10, 'justify');
        yPosition += 5;

        // Gráfico de Tendencias
        if (charts.tendencias) {
            checkAddPage(70);
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text('Tendencia Mensual', 20, yPosition);
            yPosition += 5;
            try {
                doc.addImage(charts.tendencias, 'PNG', 20, yPosition, 170, 60);
                yPosition += 65;
            } catch (error) {
                // console.error('Error al agregar gráfico de tendencias:', error);
            }
        }

        // ***** RECOMENDACIONES *****
        doc.addPage();
        yPosition = 20;

        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(102, 126, 234);
        doc.text('RECOMENDACIONES', 20, yPosition);
        yPosition += 8;

        doc.setTextColor(0, 0, 0);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');

        aiAnalysis.recomendaciones.forEach((recomendacion: string, index: number) => {
            checkAddPage(15);
            doc.setFont('helvetica', 'bold');
            doc.text(`${index + 1}.`, 20, yPosition);
            doc.setFont('helvetica', 'normal');
            addWrappedText(recomendacion, 28, pageWidth - 48, 10, 'justify');
            yPosition += 3;
        });

        // ***** TABLA DETALLE DE PQRS *****
        doc.addPage();
        yPosition = 20;

        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(102, 126, 234);
        doc.text('DETALLE DE PQRS RECIENTES', 20, yPosition);
        yPosition += 8;

        const pqrsRecientes = pqrsList.slice(0, 20);
        const pqrsData = pqrsRecientes.map(pqrs => [
            pqrs.numero_radicado,
            this.capitalizeFirst(pqrs.tipo_solicitud),
            this.getEstadoLabel(pqrs.estado),
            new Date(pqrs.fecha_solicitud).toLocaleDateString('es-CO'),
            pqrs.assigned_to?.full_name || 'Sin asignar'
        ]);

        this._autoTable(doc, {
            startY: yPosition,
            head: [['Radicado', 'Tipo', 'Estado', 'Fecha', 'Asignado a']],
            body: pqrsData,
            theme: 'grid',
            headStyles: { fillColor: [102, 126, 234], textColor: 255, fontStyle: 'bold', fontSize: 9 },
            styles: { fontSize: 8, cellPadding: 2 },
            columnStyles: {
                0: { cellWidth: 35 },
                1: { cellWidth: 30 },
                2: { cellWidth: 25 },
                3: { cellWidth: 30 },
                4: { cellWidth: 'auto' }
            }
        });

        yPosition = (doc as any).lastAutoTable.finalY + 10;

        // ***** TABLA ESTADÍSTICAS POR SECRETARIO *****
        checkAddPage(40);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(102, 126, 234);
        doc.text('Rendimiento por Secretario', 20, yPosition);
        yPosition += 8;

        // Agrupar PQRS por secretario
        const pqrsPorSecretario: { [key: string]: { total: number; pendientes: number; resueltas: number } } = {};
        pqrsList.forEach(pqrs => {
            const secretario = pqrs.assigned_to?.full_name || 'Sin asignar';
            if (!pqrsPorSecretario[secretario]) {
                pqrsPorSecretario[secretario] = { total: 0, pendientes: 0, resueltas: 0 };
            }
            pqrsPorSecretario[secretario].total++;
            if (pqrs.estado === 'pendiente') pqrsPorSecretario[secretario].pendientes++;
            if (pqrs.estado === 'resuelto' || pqrs.estado === 'cerrado') pqrsPorSecretario[secretario].resueltas++;
        });

        const secretariosData = Object.entries(pqrsPorSecretario).map(([nombre, stats]) => [
            nombre,
            stats.total.toString(),
            stats.pendientes.toString(),
            stats.resueltas.toString(),
            `${((stats.resueltas / stats.total) * 100).toFixed(1)}%`
        ]);

        this._autoTable(doc, {
            startY: yPosition,
            head: [['Secretario', 'Total', 'Pendientes', 'Resueltas', 'Eficiencia']],
            body: secretariosData,
            theme: 'striped',
            headStyles: { fillColor: [156, 39, 176], textColor: 255, fontStyle: 'bold', fontSize: 9 },
            styles: { fontSize: 9, cellPadding: 2 },
            columnStyles: {
                0: { cellWidth: 70 },
                1: { halign: 'center', cellWidth: 25 },
                2: { halign: 'center', cellWidth: 30 },
                3: { halign: 'center', cellWidth: 30 },
                4: { halign: 'center', cellWidth: 'auto' }
            }
        });

        yPosition = (doc as any).lastAutoTable.finalY + 10;

        // ***** CONCLUSIONES *****
        doc.addPage();
        yPosition = 20;

        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(102, 126, 234);
        doc.text('CONCLUSIONES', 20, yPosition);
        yPosition += 8;

        doc.setTextColor(0, 0, 0);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        addWrappedText(aiAnalysis.conclusiones, 20, pageWidth - 40, 10, 'justify');

        // ***** PIE DE PÁGINA *****
        const totalPages = doc.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(128, 128, 128);
            doc.text(
                `Página ${i} de ${totalPages} - Informe PQRS Alcaldía Municipal de Chiquiza`,
                pageWidth / 2,
                pageHeight - 10,
                { align: 'center' }
            );
        }

        // Guardar el PDF
        const nombreArchivo = `informe-pqrs-${fechaInicio}-${fechaFin}.pdf`;
        doc.save(nombreArchivo);
    }

    // Método auxiliar para capitalizar
    private capitalizeFirst(text: string): string {
        if (!text) return '';
        return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
    }

    // Método auxiliar para obtener etiqueta de estado
    private getEstadoLabel(estado: string): string {
        const labels: { [key: string]: string } = {
            'pendiente': 'Pendiente',
            'en_proceso': 'En Proceso',
            'resuelto': 'Resuelto',
            'cerrado': 'Cerrado'
        };
        return labels[estado] || estado;
    }
}
