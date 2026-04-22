"""
Generador de Informes de PQRS en PDF con overlay de template institucional
Genera PDFs con análisis estadístico, gráficos y puede usar template PDF personalizado

Características:
- Generación de gráficos con matplotlib (backend)
- Overlay de template PDF institucional (membrete)
- Análisis con IA opcional (OpenAI)
- Exportación a S3
- Estructura profesional con tablas e indicadores
"""

from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, Image as RLImage, Frame, PageTemplate
)
from reportlab.platypus.doctemplate import BaseDocTemplate
from reportlab.lib.utils import ImageReader
from io import BytesIO
from datetime import datetime
from typing import List, Dict, Any, Optional
import tempfile
import os

# Configurar matplotlib para uso en servidor
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np
from matplotlib import patches
plt.rcParams['font.family'] = 'DejaVu Sans'

class PQRSReportGenerator:
    """Generador de informes PQRS con overlay de template institucional"""
    
    def __init__(
        self,
        entity,
        pqrs_list: List,
        analytics: Dict[str, Any],
        ai_analysis: Optional[Dict[str, Any]] = None,
        fecha_inicio: str = None,
        fecha_fin: str = None
    ):
        self.entity = entity
        self.pqrs_list = pqrs_list
        self.analytics = analytics
        self.ai_analysis = ai_analysis or self._default_analysis()
        self.fecha_inicio = fecha_inicio
        self.fecha_fin = fecha_fin
        self.buffer = BytesIO()
        self.styles = getSampleStyleSheet()
        self.story = []
        
    def _default_analysis(self) -> Dict[str, Any]:
        """Análisis por defecto cuando no hay IA"""
        return {
            "introduccion": "Informe generado automáticamente del sistema de PQRS.",
            "analisisGeneral": "Análisis estadístico de las PQRS registradas en el período seleccionado.",
            "analisisTendencias": "Tendencias identificadas en el período de análisis.",
            "recomendaciones": [
                "Continuar con el seguimiento periódico de las PQRS",
                "Mantener los tiempos de respuesta dentro de los estándares",
                "Fortalecer los canales de comunicación con los ciudadanos"
            ],
            "conclusiones": "Las PQRS reflejan la interacción entre la ciudadanía y la entidad."
        }
    
    def generate_charts(self) -> Dict[str, BytesIO]:
        """
        Genera gráficos estadísticos con matplotlib
        Retorna diccionario con buffers de imágenes PNG
        """
        charts = {}
        
        # Gráfico 1: Distribución por Estado (Pie Chart)
        fig1, ax1 = plt.subplots(figsize=(6, 4))
        estados = ['Pendiente', 'En Proceso', 'Resuelto', 'Cerrado']
        valores = [
            self.analytics.get('pendientes', 0),
            self.analytics.get('enProceso', 0),
            self.analytics.get('resueltas', 0),
            self.analytics.get('cerradas', 0)
        ]
        colores = ['#FFA726', '#42A5F5', '#66BB6A', '#78909C']
        
        ax1.pie(valores, labels=estados, autopct='%1.1f%%', colors=colores, startangle=90)
        ax1.set_title('Distribución por Estado', fontsize=12, fontweight='bold')
        
        buffer1 = BytesIO()
        plt.savefig(buffer1, format='png', dpi=150, bbox_inches='tight')
        buffer1.seek(0)
        charts['estados'] = buffer1
        plt.close(fig1)
        
        # Gráfico 2: Distribución por Tipo (Bar Chart)
        fig2, ax2 = plt.subplots(figsize=(8, 4))
        tipos_pqrs = self.analytics.get('tiposPqrs', {})
        
        if tipos_pqrs:
            tipos = list(tipos_pqrs.keys())
            cantidades = list(tipos_pqrs.values())
            
            # Capitalizar tipos
            tipos_capitalizados = [t.replace('_', ' ').title() for t in tipos]
            
            bars = ax2.barh(tipos_capitalizados, cantidades, color='#667EEA')
            ax2.set_xlabel('Cantidad', fontsize=10)
            ax2.set_title('Distribución por Tipo de Solicitud', fontsize=12, fontweight='bold')
            ax2.grid(axis='x', alpha=0.3)
            
            # Añadir valores en las barras
            for i, bar in enumerate(bars):
                width = bar.get_width()
                ax2.text(width, bar.get_y() + bar.get_height()/2, 
                        f' {int(width)}', ha='left', va='center', fontsize=9)
        
        buffer2 = BytesIO()
        plt.savefig(buffer2, format='png', dpi=150, bbox_inches='tight')
        buffer2.seek(0)
        charts['tipos'] = buffer2
        plt.close(fig2)
        
        # Gráfico 3: Tendencia Mensual (Line Chart) - simulado si no hay datos
        fig3, ax3 = plt.subplots(figsize=(8, 4))
        
        # Agrupar PQRS por mes
        meses_dict = {}
        for pqrs in self.pqrs_list:
            fecha = datetime.fromisoformat(str(pqrs.get('fecha_solicitud', '')).replace('Z', '+00:00'))
            mes_key = fecha.strftime('%Y-%m')
            meses_dict[mes_key] = meses_dict.get(mes_key, 0) + 1
        
        if meses_dict:
            meses_ordenados = sorted(meses_dict.keys())
            valores_meses = [meses_dict[m] for m in meses_ordenados]
            meses_labels = [datetime.strptime(m, '%Y-%m').strftime('%b %Y') for m in meses_ordenados]
            
            ax3.plot(meses_labels, valores_meses, marker='o', linewidth=2, color='#10B981', markersize=6)
            ax3.set_xlabel('Mes', fontsize=10)
            ax3.set_ylabel('Cantidad de PQRS', fontsize=10)
            ax3.set_title('Tendencia Mensual', fontsize=12, fontweight='bold')
            ax3.grid(True, alpha=0.3)
            plt.xticks(rotation=45, ha='right')
        
        buffer3 = BytesIO()
        plt.savefig(buffer3, format='png', dpi=150, bbox_inches='tight')
        buffer3.seek(0)
        charts['tendencias'] = buffer3
        plt.close(fig3)
        
        return charts
    
    @staticmethod
    def _detect_template_margins(template_pdf_bytes: bytes):
        """
        Analiza el template PDF y detecta automáticamente el espacio
        que ocupan el encabezado (arriba) y el pie de página (abajo),
        sin importar la posición exacta en cada entidad.
        Retorna (top_margin_inches, bottom_margin_inches).
        """
        import fitz
        doc = fitz.open(stream=template_pdf_bytes, filetype="pdf")
        page = doc[0]
        page_height = page.rect.height   # puntos PDF
        mid_y = page_height / 2
        PADDING_PT = 14  # margen extra de seguridad en puntos

        header_bottom = 0.0   # borde inferior del encabezado
        footer_top    = page_height  # borde superior del pie

        # Bloques de texto
        for block in page.get_text("blocks"):
            x0, y0, x1, y1 = block[:4]
            if y1 < mid_y:
                header_bottom = max(header_bottom, y1)
            elif y0 > mid_y:
                footer_top = min(footer_top, y0)

        # Trazados vectoriales (líneas, rectángulos, etc.)
        for draw in page.get_drawings():
            r = draw.get("rect")
            if r:
                if r.y1 < mid_y:
                    header_bottom = max(header_bottom, r.y1)
                elif r.y0 > mid_y:
                    footer_top = min(footer_top, r.y0)

        # Imágenes incrustadas (p.ej. logo)
        for img in page.get_image_info(xrefs=True):
            bbox = img.get("bbox")
            if bbox:
                y0, y1 = bbox[1], bbox[3]
                if y1 < mid_y:
                    header_bottom = max(header_bottom, y1)
                elif y0 > mid_y:
                    footer_top = min(footer_top, y0)

        doc.close()

        top_in    = (header_bottom + PADDING_PT) / 72.0
        bottom_in = (page_height - footer_top + PADDING_PT) / 72.0

        # Límites razonables
        top_in    = round(max(0.75, min(3.5, top_in)), 3)
        bottom_in = round(max(0.5,  min(2.5, bottom_in)), 3)

        print(f"📐 Márgenes detectados → top: {top_in}in  bottom: {bottom_in}in")
        return top_in, bottom_in

    def _create_content_pdf(self, top_margin: float = 1.6, bottom_margin: float = 1.0) -> BytesIO:
        """
        Crea el PDF con el contenido del informe (sin template, solo contenido).
        El template se aplica en generate_pdf() como post-proceso via PyMuPDF.
        """
        buffer = BytesIO()

        doc = SimpleDocTemplate(
            buffer,
            pagesize=letter,
            topMargin=top_margin*inch,
            bottomMargin=bottom_margin*inch,
            leftMargin=0.75*inch,
            rightMargin=0.75*inch
        )
        
        # Estilos
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=self.styles['Heading1'],
            fontSize=18,
            textColor=colors.HexColor('#667EEA'),
            spaceAfter=12,
            alignment=TA_CENTER,
            fontName='Helvetica-Bold'
        )
        
        heading_style = ParagraphStyle(
            'CustomHeading',
            parent=self.styles['Heading2'],
            fontSize=14,
            textColor=colors.HexColor('#667EEA'),
            spaceAfter=10,
            fontName='Helvetica-Bold'
        )
        
        normal_style = ParagraphStyle(
            'CustomNormal',
            parent=self.styles['Normal'],
            fontSize=10,
            alignment=TA_JUSTIFY,
            spaceAfter=8
        )
        
        # ***** PORTADA *****
        self.story.append(Spacer(1, 0.5*inch))
        self.story.append(Paragraph("INFORME DE PQRS", title_style))
        self.story.append(Paragraph(self.entity.name, 
                                   ParagraphStyle('Subtitle', parent=heading_style, alignment=TA_CENTER)))
        self.story.append(Spacer(1, 0.3*inch))
        
        # Fecha del reporte
        fecha_reporte = datetime.now().strftime('%d de %B de %Y')
        self.story.append(Paragraph(f"<b>Fecha de Generación:</b> {fecha_reporte}", normal_style))
        self.story.append(Spacer(1, 0.3*inch))
        
        # ***** ALCANCE *****
        self.story.append(Paragraph("ALCANCE", heading_style))
        alcance = f"El seguimiento se realiza a las PQRSD radicadas durante el período comprendido entre {self.fecha_inicio} y {self.fecha_fin}, con base en la información del sistema de PQRS institucional."
        self.story.append(Paragraph(alcance, normal_style))
        self.story.append(Spacer(1, 0.2*inch))
        
        # ***** INTRODUCCIÓN *****
        self.story.append(PageBreak())
        self.story.append(Paragraph("INTRODUCCIÓN", heading_style))
        self.story.append(Paragraph(self.ai_analysis['introduccion'], normal_style))
        self.story.append(Spacer(1, 0.2*inch))
        
        # ***** INDICADORES GENERALES *****
        self.story.append(Paragraph("INDICADORES GENERALES", heading_style))
        
        indicadores_data = [
            ['Indicador', 'Valor'],
            ['Total de PQRS', str(self.analytics.get('totalPqrs', 0))],
            ['PQRS Pendientes', str(self.analytics.get('pendientes', 0))],
            ['PQRS En Proceso', str(self.analytics.get('enProceso', 0))],
            ['PQRS Resueltas', str(self.analytics.get('resueltas', 0))],
            ['PQRS Cerradas', str(self.analytics.get('cerradas', 0))],
            ['Tasa de Resolución', f"{self.analytics.get('tasaResolucion', 0)}%"],
            ['Tiempo Promedio de Respuesta', f"{self.analytics.get('tiempoPromedioRespuesta', 0)} días"]
        ]
        
        indicadores_table = Table(indicadores_data, colWidths=[4*inch, 2*inch])
        indicadores_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#667EEA')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('ALIGN', (1, 1), (1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 10),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey)
        ]))
        
        self.story.append(indicadores_table)
        self.story.append(Spacer(1, 0.3*inch))
        
        # ***** GRÁFICOS *****
        self.story.append(PageBreak())
        self.story.append(Paragraph("GRÁFICOS ESTADÍSTICOS", heading_style))
        
        charts = self.generate_charts()
        
        if 'estados' in charts:
            self.story.append(Paragraph("Distribución por Estado", normal_style))
            img = RLImage(charts['estados'], width=4*inch, height=2.5*inch)
            self.story.append(img)
            self.story.append(Spacer(1, 0.2*inch))
        
        if 'tipos' in charts:
            self.story.append(Paragraph("Distribución por Tipo", normal_style))
            img = RLImage(charts['tipos'], width=5*inch, height=2.5*inch)
            self.story.append(img)
            self.story.append(Spacer(1, 0.2*inch))
        
        # ***** ANÁLISIS GENERAL *****
        self.story.append(PageBreak())
        self.story.append(Paragraph("ANÁLISIS GENERAL", heading_style))
        self.story.append(Paragraph(self.ai_analysis['analisisGeneral'], normal_style))
        self.story.append(Spacer(1, 0.2*inch))
        
        # ***** TENDENCIAS *****
        if 'tendencias' in charts:
            self.story.append(Paragraph("ANÁLISIS DE TENDENCIAS", heading_style))
            self.story.append(Paragraph(self.ai_analysis['analisisTendencias'], normal_style))
            img = RLImage(charts['tendencias'], width=5*inch, height=2.5*inch)
            self.story.append(img)
            self.story.append(Spacer(1, 0.2*inch))
        
        # ***** RECOMENDACIONES *****
        self.story.append(PageBreak())
        self.story.append(Paragraph("RECOMENDACIONES", heading_style))
        
        for i, rec in enumerate(self.ai_analysis['recomendaciones'], 1):
            self.story.append(Paragraph(f"{i}. {rec}", normal_style))
        
        self.story.append(Spacer(1, 0.2*inch))
        
        # ***** DETALLE DE PQRS *****
        self.story.append(PageBreak())
        self.story.append(Paragraph("DETALLE DE PQRS RECIENTES", heading_style))
        
        pqrs_recientes = self.pqrs_list[:20]  # Primeras 20
        pqrs_data = [['Radicado', 'Tipo', 'Estado', 'Fecha']]
        
        for pqrs in pqrs_recientes:
            fecha = datetime.fromisoformat(str(pqrs.get('fecha_solicitud', '')).replace('Z', '+00:00'))
            pqrs_data.append([
                pqrs.get('numero_radicado', 'N/A'),
                pqrs.get('tipo_solicitud', 'N/A').replace('_', ' ').title(),
                pqrs.get('estado', 'N/A').replace('_', ' ').title(),
                fecha.strftime('%Y-%m-%d')
            ])
        
        pqrs_table = Table(pqrs_data, colWidths=[1.5*inch, 1.5*inch, 1.5*inch, 1.5*inch])
        pqrs_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#667EEA')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 9),
            ('FONTSIZE', (0, 1), (-1, -1), 8),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.lightgrey])
        ]))
        
        self.story.append(pqrs_table)
        self.story.append(Spacer(1, 0.2*inch))
        
        # ***** CONCLUSIONES *****
        self.story.append(PageBreak())
        self.story.append(Paragraph("CONCLUSIONES", heading_style))
        self.story.append(Paragraph(self.ai_analysis['conclusiones'], normal_style))
        
        # Construir PDF
        doc.build(self.story)
        buffer.seek(0)
        return buffer

    def generate_pdf(self) -> BytesIO:
        """
        Genera el PDF final.
        Si hay template: descarga desde S3 via boto3, detecta márgenes
        automáticamente, genera el contenido con esos márgenes y aplica
        el template vectorial como fondo en cada página.
        """
        import fitz  # PyMuPDF
        import boto3 as _boto3
        import traceback

        template_pdf_bytes = None
        top_margin    = 1.6   # valores por defecto sin template
        bottom_margin = 1.0

        if self.entity.pdf_template_url:
            try:
                S3_BUCKET = "softone360-pqrs-archivos"
                S3_REGION = "us-east-1"

                marker = f"{S3_BUCKET}.s3.{S3_REGION}.amazonaws.com/"
                if marker not in self.entity.pdf_template_url:
                    print(f"⚠️ URL de template inesperada: {self.entity.pdf_template_url}")
                else:
                    s3_key = self.entity.pdf_template_url.split(marker)[1]
                    print(f"📥 Descargando template S3: {s3_key}")
                    s3 = _boto3.client('s3', region_name=S3_REGION)
                    s3_resp = s3.get_object(Bucket=S3_BUCKET, Key=s3_key)
                    template_pdf_bytes = s3_resp['Body'].read()
                    print(f"✅ Template descargado: {len(template_pdf_bytes)} bytes")

                    # Detectar márgenes automáticamente según el template
                    top_margin, bottom_margin = self._detect_template_margins(template_pdf_bytes)

            except Exception as e:
                print(f"⚠️ Error descargando template: {e}")
                traceback.print_exc()
                template_pdf_bytes = None

        # Generar contenido con los márgenes correctos para este template
        content_buffer = self._create_content_pdf(
            top_margin=top_margin,
            bottom_margin=bottom_margin
        )

        if not template_pdf_bytes:
            return content_buffer

        try:
            # Abrir template PDF como documento vectorial (sin rasterizar)
            template_doc = fitz.open(stream=template_pdf_bytes, filetype="pdf")
            print(f"✅ Template abierto: {len(template_doc)} página(s)")

            # Post-procesar: insertar template como Form XObject vectorial debajo del contenido
            content_buffer.seek(0)
            content_doc = fitz.open(stream=content_buffer.read(), filetype="pdf")

            for i, page in enumerate(content_doc):
                # show_pdf_page inserta la página como Form XObject (vectorial, no imagen)
                # overlay=False → va DETRÁS del contenido existente
                page.show_pdf_page(page.rect, template_doc, 0, overlay=False)
                print(f"   ✅ Página {i+1}: membrete vectorial insertado como fondo")

            template_doc.close()
            total_pages = len(content_doc)

            # Actualizar numeración de página en cada página
            for i, page in enumerate(content_doc):
                nuevo_texto = f"Página {i+1} de {total_pages}"
                # Buscar cualquier variante de "Página X de Y" en el template
                for patron in ["Página 1 de 1", "Pagina 1 de 1", "página 1 de 1"]:
                    rects = page.search_for(patron)
                    for rect in rects:
                        # Tapar el texto original con un rectángulo blanco
                        page.draw_rect(rect, color=None, fill=(1, 1, 1))
                        # Escribir el nuevo número de página en la misma posición
                        page.insert_text(
                            (rect.x0, rect.y1 - 1),
                            nuevo_texto,
                            fontsize=rect.height * 0.85,
                            color=(0, 0, 0)
                        )
                        print(f"   ✅ Página {i+1}: numeración actualizada → {nuevo_texto}")

            final_buffer = BytesIO()
            content_doc.save(final_buffer)
            content_doc.close()
            final_buffer.seek(0)

            print(f"✅ PDF con membrete institucional generado")
            return final_buffer

        except Exception as e:
            print(f"⚠️ Error aplicando template: {e}")
            traceback.print_exc()
            content_buffer.seek(0)
            return content_buffer
    
    def save_to_file(self, filename: str):
        """Guarda el PDF en un archivo"""
        pdf_buffer = self.generate_pdf()
        with open(filename, 'wb') as f:
            f.write(pdf_buffer.read())
        print(f"✅ PDF guardado: {filename}")
