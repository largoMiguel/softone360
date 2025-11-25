import { Injectable } from '@angular/core';
import type jsPDF from 'jspdf';
import { PlanInstitucional, Meta } from '../models/plan.model';

interface PlanAnalysis {
    introduccion: string;
    analisis_general: string;
    analisis_metas: string;
    recomendaciones: string[];
    conclusiones: string;
}

@Injectable({
    providedIn: 'root'
})
export class PlanReportService {
    // Caché de librerías PDF cargadas dinámicamente
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
     * Genera un reporte PDF completo del plan institucional
     */
    async generatePlanPDFReport(
        plan: PlanInstitucional,
        metas: Meta[],
        aiAnalysis: PlanAnalysis,
        graficos?: { avanceGlobal: string; distribucion: string } | null,
        periodoTexto?: string
    ): Promise<void> {
        const { jsPDF } = await this.loadPdfLibs();
        const doc = new jsPDF();
        let yPos = 20;

        // ========== 1. PORTADA ==========
        this.addPortada(doc, plan, periodoTexto);

        // ========== 2. ALCANCE ==========
        doc.addPage();
        yPos = 20;
        yPos = this.addAlcance(doc, plan, yPos, periodoTexto);

        // ========== 3. INTRODUCCIÓN ==========
        doc.addPage();
        yPos = 20;
        yPos = this.addIntroduccion(doc, aiAnalysis.introduccion, yPos);

        // ========== 4. INFORMACIÓN DEL PLAN ==========
        yPos = this.addInformacionPlan(doc, plan, yPos);

        // ========== 5. RESUMEN DE METAS ==========
        doc.addPage();
        yPos = 20;
        yPos = this.addResumenMetas(doc, metas, yPos);

        // ========== 5.5. GRÁFICOS VISUALES (SI ESTÁN DISPONIBLES) ==========
        if (graficos && graficos.avanceGlobal) {
            yPos = this.addGraficos(doc, graficos, yPos);
        }

        // ========== 6. TABLA DE INDICADORES ==========
        yPos = this.addTablaIndicadores(doc, metas, yPos);

        // ========== 7. ANÁLISIS GENERAL ==========
        doc.addPage();
        yPos = 20;
        yPos = this.addAnalisisGeneral(doc, aiAnalysis.analisis_general, yPos);

        // ========== 8. ANÁLISIS POR METAS ==========
        yPos = this.addAnalisisMetas(doc, aiAnalysis.analisis_metas, yPos);

        // ========== 9. DETALLE DE METAS ==========
        doc.addPage();
        yPos = 20;
        yPos = this.addDetalleMetas(doc, metas, yPos);

        // ========== 10. RESULTADOS POR META ==========
        yPos = this.addResultadosMetas(doc, metas, yPos);

        // ========== 11. METAS POR ESTADO ==========
        yPos = this.addMetasPorEstado(doc, metas, yPos);

        // ========== 12. RECOMENDACIONES ==========
        doc.addPage();
        yPos = 20;
        yPos = this.addRecomendaciones(doc, aiAnalysis.recomendaciones, yPos);

        // ========== 13. CONCLUSIONES ==========
        yPos = this.addConclusiones(doc, aiAnalysis.conclusiones, yPos);

        // ========== NUMERACIÓN DE PÁGINAS ==========
        this.addPageNumbers(doc);

        // ========== GUARDAR PDF ==========
        // Fecha del nombre de archivo en zona horaria de Colombia (YYYY-MM-DD)
        const fileNameDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
        const fileName = `informe-plan-${this.sanitizeFileName(plan.nombre)}-${fileNameDate}.pdf`;
        doc.save(fileName);
    }

    private addPortada(doc: jsPDF, plan: PlanInstitucional, periodoTexto?: string): void {
        const pageWidth = doc.internal.pageSize.getWidth();

        // Fondo de encabezado
        doc.setFillColor(102, 126, 234);
        doc.rect(0, 0, pageWidth, 80, 'F');

        // Título
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(24);
        doc.setFont('helvetica', 'bold');
        doc.text('INFORME DE SEGUIMIENTO', pageWidth / 2, 30, { align: 'center' });

        doc.setFontSize(20);
        doc.text('PLAN INSTITUCIONAL', pageWidth / 2, 45, { align: 'center' });

        // Nombre del plan
        doc.setFillColor(52, 73, 94);
        doc.rect(0, 80, pageWidth, 50, 'F');

        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        const planText = this.splitText(doc, plan.nombre, pageWidth - 40);
        let textY = 95;
        planText.forEach(line => {
            doc.text(line, pageWidth / 2, textY, { align: 'center' });
            textY += 8;
        });

        // Información adicional
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');

        const infoY = 150;
        doc.text(`Año: ${plan.anio}`, pageWidth / 2, infoY, { align: 'center' });
        doc.text(`Estado: ${this.getEstadoTexto(plan.estado)}`, pageWidth / 2, infoY + 10, { align: 'center' });

        const periodoMostrar = periodoTexto || `${this.formatDate(plan.fecha_inicio)} - ${this.formatDate(plan.fecha_fin)}`;
        doc.text(`Período: ${periodoMostrar}`, pageWidth / 2, infoY + 20, { align: 'center' });

        // Fecha de generación
        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        doc.text(`Informe generado el: ${new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' })}`,
            pageWidth / 2, 280, { align: 'center' });
    }

    private addAlcance(doc: jsPDF, plan: PlanInstitucional, yPos: number, periodoTexto?: string): number {
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(102, 126, 234);
        doc.text('ALCANCE DEL INFORME', 20, yPos);
        yPos += 10;

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);

        const periodoInfo = periodoTexto || `desde ${this.formatDate(plan.fecha_inicio)} hasta ${this.formatDate(plan.fecha_fin)}`;
        const alcanceText = `Este informe presenta el estado de seguimiento y cumplimiento del plan institucional "${plan.nombre}" correspondiente al año ${plan.anio}. El análisis comprende el período ${periodoInfo}.`;

        const lines = doc.splitTextToSize(alcanceText, 170);
        lines.forEach((line: string) => {
            doc.text(line, 20, yPos);
            yPos += 7;
        });

        yPos += 5;
        doc.text(`El informe evalúa el avance de las metas establecidas y proporciona recomendaciones para su cumplimiento.`, 20, yPos);
        yPos += 7;

        return yPos + 10;
    }

    private addGraficos(doc: jsPDF, graficos: { avanceGlobal: string; distribucion: string }, yPos: number): number {
        if (yPos > 180) {
            doc.addPage();
            yPos = 20;
        }

        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(102, 126, 234);
        doc.text('GRÁFICOS VISUALES', 20, yPos);
        yPos += 10;

        // Agregar gráfico de avance global
        if (graficos.avanceGlobal) {
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(52, 73, 94);
            doc.text('Avance Global del Plan', 20, yPos);
            yPos += 10;

            try {
                doc.addImage(graficos.avanceGlobal, 'PNG', 60, yPos, 80, 80);
                yPos += 90;
            } catch (error) {
                // console.error('Error agregando imagen de avance global:', error);
            }
        }

        // Agregar nota explicativa
        doc.setFontSize(9);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(100, 100, 100);
        doc.text('* Gráficos generados automáticamente al momento de crear el informe', 20, yPos);
        yPos += 15;

        return yPos;
    }

    private addIntroduccion(doc: jsPDF, introduccion: string, yPos: number): number {
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(102, 126, 234);
        doc.text('INTRODUCCIÓN', 20, yPos);
        yPos += 10;

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);

        const lines = doc.splitTextToSize(introduccion, 170);
        lines.forEach((line: string) => {
            if (yPos > 270) {
                doc.addPage();
                yPos = 20;
            }
            doc.text(line, 20, yPos);
            yPos += 7;
        });

        return yPos + 10;
    }

    private addInformacionPlan(doc: jsPDF, plan: PlanInstitucional, yPos: number): number {
        if (yPos > 220) {
            doc.addPage();
            yPos = 20;
        }

        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(102, 126, 234);
        doc.text('INFORMACIÓN DEL PLAN', 20, yPos);
        yPos += 10;

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);

        doc.text(`Nombre: ${plan.nombre}`, 20, yPos);
        yPos += 7;

        const descripcionLines = doc.splitTextToSize(`Descripción: ${plan.descripcion}`, 170);
        descripcionLines.forEach((line: string) => {
            doc.text(line, 20, yPos);
            yPos += 7;
        });

        doc.text(`Año: ${plan.anio}`, 20, yPos);
        yPos += 7;
        doc.text(`Estado: ${this.getEstadoTexto(plan.estado)}`, 20, yPos);
        yPos += 7;
        doc.text(`Fecha de Inicio: ${this.formatDate(plan.fecha_inicio)}`, 20, yPos);
        yPos += 7;
        doc.text(`Fecha de Finalización: ${this.formatDate(plan.fecha_fin)}`, 20, yPos);
        yPos += 7;

        return yPos + 10;
    }

    private addResumenMetas(doc: jsPDF, metas: Meta[], yPos: number): number {
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(102, 126, 234);
        doc.text('RESUMEN DE METAS', 20, yPos);
        yPos += 10;

        const totalMetas = metas.length;
        const metasCompletadas = metas.filter(m => m.estado === 'completada').length;
        const metasEnProgreso = metas.filter(m => m.estado === 'en_progreso').length;
        const metasAtrasadas = metas.filter(m => m.estado === 'atrasada').length;
        const metasNoIniciadas = metas.filter(m => m.estado === 'no_iniciada').length;

        const avanceTotal = metas.length > 0
            ? Math.round(metas.reduce((sum, m) => sum + this.getPorcentajeAvance(m), 0) / metas.length)
            : 0;

        this._autoTable(doc, {
            startY: yPos,
            head: [['Indicador', 'Cantidad', 'Porcentaje']],
            body: [
                ['Total de Metas', totalMetas.toString(), '100%'],
                ['Metas Completadas', metasCompletadas.toString(), `${Math.round((metasCompletadas / totalMetas) * 100)}%`],
                ['Metas En Progreso', metasEnProgreso.toString(), `${Math.round((metasEnProgreso / totalMetas) * 100)}%`],
                ['Metas Atrasadas', metasAtrasadas.toString(), `${Math.round((metasAtrasadas / totalMetas) * 100)}%`],
                ['Metas No Iniciadas', metasNoIniciadas.toString(), `${Math.round((metasNoIniciadas / totalMetas) * 100)}%`],
                ['Avance Global del Plan', '', `${avanceTotal}%`]
            ],
            theme: 'grid',
            headStyles: { fillColor: [102, 126, 234], fontSize: 10, fontStyle: 'bold' },
            styles: { fontSize: 9 },
            columnStyles: {
                0: { cellWidth: 100 },
                1: { cellWidth: 40, halign: 'center' },
                2: { cellWidth: 40, halign: 'center' }
            }
        });

        return (doc as any).lastAutoTable.finalY + 15;
    }

    private addTablaIndicadores(doc: jsPDF, metas: Meta[], yPos: number): number {
        if (yPos > 200) {
            doc.addPage();
            yPos = 20;
        }

        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(102, 126, 234);
        doc.text('TABLA DE INDICADORES', 20, yPos);
        yPos += 10;

        const tableData = metas.map(meta => [
            meta.nombre,
            meta.indicador,
            `${meta.avance_actual} / ${meta.meta_numerica}`,
            `${this.getPorcentajeAvance(meta)}%`,
            this.getEstadoTexto(meta.estado)
        ]);

        this._autoTable(doc, {
            startY: yPos,
            head: [['Meta', 'Indicador', 'Avance', '%', 'Estado']],
            body: tableData,
            theme: 'striped',
            headStyles: { fillColor: [102, 126, 234], fontSize: 9, fontStyle: 'bold' },
            styles: { fontSize: 8, cellPadding: 3 },
            columnStyles: {
                0: { cellWidth: 60 },
                1: { cellWidth: 50 },
                2: { cellWidth: 30, halign: 'center' },
                3: { cellWidth: 20, halign: 'center' },
                4: { cellWidth: 30, halign: 'center' }
            }
        });

        return (doc as any).lastAutoTable.finalY + 15;
    }

    private addAnalisisGeneral(doc: jsPDF, analisis: string, yPos: number): number {
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(102, 126, 234);
        doc.text('ANÁLISIS GENERAL', 20, yPos);
        yPos += 10;

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);

        const lines = doc.splitTextToSize(analisis, 170);
        lines.forEach((line: string) => {
            if (yPos > 270) {
                doc.addPage();
                yPos = 20;
            }
            doc.text(line, 20, yPos);
            yPos += 7;
        });

        return yPos + 10;
    }

    private addAnalisisMetas(doc: jsPDF, analisis: string, yPos: number): number {
        if (yPos > 220) {
            doc.addPage();
            yPos = 20;
        }

        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(102, 126, 234);
        doc.text('ANÁLISIS POR METAS', 20, yPos);
        yPos += 10;

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);

        const lines = doc.splitTextToSize(analisis, 170);
        lines.forEach((line: string) => {
            if (yPos > 270) {
                doc.addPage();
                yPos = 20;
            }
            doc.text(line, 20, yPos);
            yPos += 7;
        });

        return yPos + 10;
    }

    private addDetalleMetas(doc: jsPDF, metas: Meta[], yPos: number): number {
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(102, 126, 234);
        doc.text('DETALLE DE METAS', 20, yPos);
        yPos += 10;

        const tableData = metas.map(meta => [
            meta.nombre,
            meta.responsable,
            this.formatDate(meta.fecha_inicio),
            this.formatDate(meta.fecha_fin),
            `${this.getPorcentajeAvance(meta)}%`,
            this.getEstadoTexto(meta.estado)
        ]);

        this._autoTable(doc, {
            startY: yPos,
            head: [['Meta', 'Responsable', 'F. Inicio', 'F. Fin', 'Avance', 'Estado']],
            body: tableData,
            theme: 'grid',
            headStyles: { fillColor: [102, 126, 234], fontSize: 9, fontStyle: 'bold' },
            styles: { fontSize: 8, cellPadding: 2 },
            columnStyles: {
                0: { cellWidth: 50 },
                1: { cellWidth: 45 },
                2: { cellWidth: 25 },
                3: { cellWidth: 25 },
                4: { cellWidth: 20, halign: 'center' },
                5: { cellWidth: 25, halign: 'center' }
            }
        });

        return (doc as any).lastAutoTable.finalY + 15;
    }

    private addResultadosMetas(doc: jsPDF, metas: Meta[], yPos: number): number {
        // Filtrar solo metas que tengan resultado
        const metasConResultado = metas.filter(m => m.resultado && m.resultado.trim() !== '');

        if (metasConResultado.length === 0) {
            return yPos;
        }

        if (yPos > 200) {
            doc.addPage();
            yPos = 20;
        }

        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(102, 126, 234);
        doc.text('RESULTADOS Y OBSERVACIONES POR META', 20, yPos);
        yPos += 10;

        doc.setFontSize(9);
        doc.setTextColor(100, 100, 100);
        doc.text('Esta sección presenta los logros alcanzados y observaciones relevantes de cada meta', 20, yPos);
        yPos += 15;

        metasConResultado.forEach((meta, index) => {
            // Verificar espacio disponible
            if (yPos > 240) {
                doc.addPage();
                yPos = 20;
            }

            // Nombre de la meta
            doc.setFontSize(11);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(52, 73, 94);
            const metaNumero = `${index + 1}. ${meta.nombre}`;
            const metaLines = doc.splitTextToSize(metaNumero, 170);
            metaLines.forEach((line: string) => {
                if (yPos > 270) {
                    doc.addPage();
                    yPos = 20;
                }
                doc.text(line, 20, yPos);
                yPos += 6;
            });

            // Información de la meta
            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(100, 100, 100);
            const infoMeta = `Responsable: ${meta.responsable} | Avance: ${this.getPorcentajeAvance(meta)}% (${meta.avance_actual}/${meta.meta_numerica}) | Estado: ${this.getEstadoTexto(meta.estado)}`;
            doc.text(infoMeta, 20, yPos);
            yPos += 8;

            // Resultado/Observaciones
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(0, 0, 0);
            const resultadoLines = doc.splitTextToSize(meta.resultado || '', 170);
            resultadoLines.forEach((line: string) => {
                if (yPos > 270) {
                    doc.addPage();
                    yPos = 20;
                }
                doc.text(line, 20, yPos);
                yPos += 6;
            });

            // Separador
            yPos += 8;
            if (index < metasConResultado.length - 1) {
                doc.setDrawColor(200, 200, 200);
                doc.line(20, yPos, 190, yPos);
                yPos += 10;
            }
        });

        return yPos + 10;
    }

    private addMetasPorEstado(doc: jsPDF, metas: Meta[], yPos: number): number {
        if (yPos > 200) {
            doc.addPage();
            yPos = 20;
        }

        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(102, 126, 234);
        doc.text('DISTRIBUCIÓN DE METAS POR ESTADO', 20, yPos);
        yPos += 10;

        const metasPorEstado = {
            'no_iniciada': metas.filter(m => m.estado === 'no_iniciada'),
            'en_progreso': metas.filter(m => m.estado === 'en_progreso'),
            'completada': metas.filter(m => m.estado === 'completada'),
            'atrasada': metas.filter(m => m.estado === 'atrasada')
        };

        const tableData = Object.entries(metasPorEstado).map(([estado, metasEstado]) => [
            this.getEstadoTexto(estado),
            metasEstado.length.toString(),
            metasEstado.map(m => m.nombre).join(', ') || 'N/A'
        ]);

        this._autoTable(doc, {
            startY: yPos,
            head: [['Estado', 'Cantidad', 'Metas']],
            body: tableData,
            theme: 'striped',
            headStyles: { fillColor: [102, 126, 234], fontSize: 10, fontStyle: 'bold' },
            styles: { fontSize: 9, cellPadding: 3 },
            columnStyles: {
                0: { cellWidth: 35 },
                1: { cellWidth: 25, halign: 'center' },
                2: { cellWidth: 130 }
            }
        });

        return (doc as any).lastAutoTable.finalY + 15;
    }

    private addRecomendaciones(doc: jsPDF, recomendaciones: string[], yPos: number): number {
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(102, 126, 234);
        doc.text('RECOMENDACIONES', 20, yPos);
        yPos += 10;

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);

        recomendaciones.forEach((recomendacion, index) => {
            if (yPos > 270) {
                doc.addPage();
                yPos = 20;
            }

            doc.setFont('helvetica', 'bold');
            doc.text(`${index + 1}.`, 20, yPos);
            doc.setFont('helvetica', 'normal');

            const lines = doc.splitTextToSize(recomendacion, 165);
            lines.forEach((line: string, lineIndex: number) => {
                if (yPos > 270) {
                    doc.addPage();
                    yPos = 20;
                }
                doc.text(line, lineIndex === 0 ? 28 : 28, yPos);
                yPos += 7;
            });

            yPos += 3;
        });

        return yPos + 10;
    }

    private addConclusiones(doc: jsPDF, conclusiones: string, yPos: number): number {
        if (yPos > 220) {
            doc.addPage();
            yPos = 20;
        }

        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(102, 126, 234);
        doc.text('CONCLUSIONES', 20, yPos);
        yPos += 10;

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);

        const lines = doc.splitTextToSize(conclusiones, 170);
        lines.forEach((line: string) => {
            if (yPos > 270) {
                doc.addPage();
                yPos = 20;
            }
            doc.text(line, 20, yPos);
            yPos += 7;
        });

        return yPos + 10;
    }

    private addPageNumbers(doc: jsPDF): void {
        const pageCount = doc.getNumberOfPages();
        const pageWidth = doc.internal.pageSize.getWidth();

        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(9);
            doc.setTextColor(100, 100, 100);
            doc.text(`Página ${i} de ${pageCount}`, pageWidth / 2, 290, { align: 'center' });
        }
    }

    // Utilidades
    private getPorcentajeAvance(meta: Meta): number {
        if (meta.meta_numerica === 0) return 0;
        return Math.min(100, Math.round((meta.avance_actual / meta.meta_numerica) * 100));
    }

    private getEstadoTexto(estado: string): string {
        const textos: { [key: string]: string } = {
            'activo': 'Activo',
            'finalizado': 'Finalizado',
            'suspendido': 'Suspendido',
            'no_iniciada': 'No Iniciada',
            'en_progreso': 'En Progreso',
            'completada': 'Completada',
            'atrasada': 'Atrasada'
        };
        return textos[estado] || estado;
    }

    private formatDate(dateString: string): string {
        const date = new Date(dateString);
        return date.toLocaleDateString('es-CO', { timeZone: 'America/Bogota' });
    }

    private splitText(doc: jsPDF, text: string, maxWidth: number): string[] {
        return doc.splitTextToSize(text, maxWidth);
    }

    private sanitizeFileName(name: string): string {
        return name.toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9-]/g, '')
            .substring(0, 50);
    }
}
