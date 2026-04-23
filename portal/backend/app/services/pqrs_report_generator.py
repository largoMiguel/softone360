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
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT, TA_RIGHT
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
    
    def _calcular_trimestre(self) -> Dict[str, Any]:
        """
        Calcula el trimestre basado en las fechas del informe.
        Retorna el número de trimestre, fechas de inicio y fin del periodo.
        """
        from datetime import datetime
        
        # Parsear fechas
        fecha_inicio = datetime.strptime(self.fecha_inicio, '%Y-%m-%d')
        fecha_fin = datetime.strptime(self.fecha_fin, '%Y-%m-%d')
        
        # Determinar trimestre basado en el mes de inicio
        mes_inicio = fecha_inicio.month
        
        if 1 <= mes_inicio <= 3:
            trimestre = 1
            texto_periodo = "1° PERIODO (01 de enero a 31 de marzo"
        elif 4 <= mes_inicio <= 6:
            trimestre = 2
            texto_periodo = "2° PERIODO (01 de abril a 30 de junio"
        elif 7 <= mes_inicio <= 9:
            trimestre = 3
            texto_periodo = "3° PERIODO (01 de julio a 30 de septiembre"
        else:  # 10-12
            trimestre = 4
            texto_periodo = "4° PERIODO (01 de octubre a 31 de diciembre"
        
        # Año del informe
        año = fecha_inicio.year
        
        return {
            'trimestre': trimestre,
            'texto_periodo': f"{texto_periodo}",
            'año': str(año)
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
        
        # ***** PORTADA PERSONALIZADA *****
        # Calcular trimestre y mes de generación
        trimestre_info = self._calcular_trimestre()
        _meses_es_portada = {
            1:"Enero",2:"Febrero",3:"Marzo",4:"Abril",5:"Mayo",6:"Junio",
            7:"Julio",8:"Agosto",9:"Septiembre",10:"Octubre",11:"Noviembre",12:"Diciembre"
        }
        _hoy = datetime.now()
        mes_generacion = f"{_meses_es_portada[_hoy.month]} {_hoy.year}"
        
        # Espaciado inicial
        self.story.append(Spacer(1, 0.8*inch))
        
        # Encabezado verde oscuro con título principal
        header_data = [[Paragraph("<b>Informe de Seguimiento</b><br/>Proceso de Peticiones, Quejas, Reclamos, Solicitudes,<br/>Denuncias y Felicitaciones (PQRSDF)", 
                                 ParagraphStyle('HeaderText', 
                                              parent=normal_style, 
                                              alignment=TA_CENTER,
                                              fontSize=14,
                                              textColor=colors.white,
                                              fontName='Helvetica-Bold',
                                              leading=18))]]
        
        header_table = Table(header_data, colWidths=[6.5*inch])
        header_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#2d5016')),  # Verde oscuro
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 20),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 20),
            ('LEFTPADDING', (0, 0), (-1, -1), 20),
            ('RIGHTPADDING', (0, 0), (-1, -1), 20),
        ]))
        self.story.append(header_table)
        self.story.append(Spacer(1, 0.1*inch))
        
        # Nombre de la entidad en caja verde claro
        entity_data = [[Paragraph(f"<b>{self.entity.name.upper()}</b>", 
                                 ParagraphStyle('EntityText', 
                                              parent=normal_style, 
                                              alignment=TA_CENTER,
                                              fontSize=16,
                                              textColor=colors.black,
                                              fontName='Helvetica-Bold'))]]
        
        entity_table = Table(entity_data, colWidths=[6.5*inch])
        entity_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#c3d69b')),  # Verde claro
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 15),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 15),
        ]))
        self.story.append(entity_table)
        self.story.append(Spacer(1, 0.8*inch))
        
        # Periodo trimestral en caja verde claro
        periodo_text = f"<b>{trimestre_info['texto_periodo']}<br/>{trimestre_info['año']}</b>"
        periodo_data = [[Paragraph(periodo_text, 
                                  ParagraphStyle('PeriodoText', 
                                               parent=normal_style, 
                                               alignment=TA_RIGHT,
                                               fontSize=14,
                                               textColor=colors.black,
                                               fontName='Helvetica-Bold',
                                               leading=20))]]
        
        periodo_table = Table(periodo_data, colWidths=[6.5*inch])
        periodo_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#c3d69b')),  # Verde claro
            ('ALIGN', (0, 0), (-1, -1), 'RIGHT'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 15),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 15),
            ('RIGHTPADDING', (0, 0), (-1, -1), 30),
        ]))
        self.story.append(periodo_table)
        self.story.append(Spacer(1, 1.0*inch))
        
        # Mes de generación (alineado a la derecha)
        mes_style = ParagraphStyle(
            'MesStyle',
            parent=normal_style,
            fontSize=14,
            alignment=TA_RIGHT,
            fontName='Helvetica'
        )
        self.story.append(Paragraph(mes_generacion, mes_style))
        self.story.append(PageBreak())

        # ---- Datos dinámicos de la entidad ----
        entity_name      = self.entity.name        # Ej: "Alcaldía Municipal de Sora"
        entity_email     = self.entity.email or "contactenos@entidad.gov.co"
        entity_slug      = self.entity.slug or ""  # Ej: "sora-boyaca"
        entity_website   = f"https://www.{entity_slug}.gov.co" if entity_slug else "el sitio web institucional"
        pqrs_url         = f"{entity_website}/peticiones-quejas-reclamos"

        # Número de trimestre en palabras
        _trimestre_palabras = {1: "primer", 2: "segundo", 3: "tercer", 4: "cuarto"}
        _tri_num = trimestre_info['trimestre']
        trimestre_palabra = _trimestre_palabras.get(_tri_num, "")
        año_informe = trimestre_info['año']

        # Fechas del periodo formateadas en español
        from datetime import datetime as _dt
        _meses_es = {
            1:"enero",2:"febrero",3:"marzo",4:"abril",5:"mayo",6:"junio",
            7:"julio",8:"agosto",9:"septiembre",10:"octubre",11:"noviembre",12:"diciembre"
        }
        _fi = _dt.strptime(self.fecha_inicio, '%Y-%m-%d')
        _ff = _dt.strptime(self.fecha_fin,    '%Y-%m-%d')
        fecha_inicio_larga = f"{_fi.day:02d} de {_meses_es[_fi.month]} de {_fi.year}"
        fecha_fin_larga    = f"{_ff.day:02d} de {_meses_es[_ff.month]} de {_ff.year}"
        periodo_texto = f"{_fi.day:02d} de {_meses_es[_fi.month]} y {_ff.day:02d} de {_meses_es[_ff.month]} de {_ff.year}"

        section_style = ParagraphStyle(
            'SectionHeading',
            parent=heading_style,
            fontSize=11,
            textColor=colors.black,
            fontName='Helvetica-Bold',
            spaceAfter=6,
            spaceBefore=14
        )

        # ***** INTRODUCCIÓN *****
        self.story.append(Paragraph("INTRODUCCIÓN", section_style))
        intro1 = (
            "En cumplimiento al Artículo 76 de la Ley 1474 de 2011, <i>\"En toda entidad pública, "
            "deberá existir por lo menos una dependencia encargada de recibir, tramitar y resolver "
            "las quejas, sugerencias y reclamos que los ciudadanos formulen, y que se relacionen con "
            "el cumplimiento de la misión de la entidad. La Oficina de Control Interno deberá vigilar "
            "que la atención se preste de acuerdo con las normas legales vigentes y rendirá a la "
            "administración de la entidad un informe semestral sobre el particular\"</i> así mismo la "
            "Ley 1755 de 2015 <i>\"Por medio de la cual se regula el Derecho Fundamental de Petición\"</i>. "
            "Decreto 1166 de Julio 19 de 2016 <i>\"Por el cual se adiciona el capítulo 12 al Título 3 "
            "de la Parte 2 del Libro 2 del Decreto 1069 de 2015, Decreto Único Reglamentario del Sector "
            "Justicia y del Derecho, relacionado con la presentación, tratamiento y radicación de las "
            "peticiones presentadas verbalmente\"</i>. Resolución N° 001519 de 24 de agosto de 2020 "
            "<i>\"Por la cual se definen los estándares y directrices para publicar la información "
            "señalada en la Ley 1712 del 2014 y se definen los requisitos materia de acceso a la "
            "información pública, accesibilidad web, seguridad digital, y datos abiertos\"</i>. "
            "Circular 100-010-2021 Directrices para fortalecer la implementación de lenguaje claro."
        )
        self.story.append(Paragraph(intro1, normal_style))
        self.story.append(Spacer(1, 0.1*inch))

        intro2 = (
            f"El {entity_name} realiza el seguimiento a las Peticiones, Quejas, Reclamos, Solicitudes "
            f"y Denuncias (PQRSD) presentadas por los ciudadanos o grupo de ciudadanos con el fin de "
            f"verificar su oportunidad, materialidad, congruencia y veracidad para lo cual se apoya en "
            f"los registros del sistema de información del sitio web institucional, el cual lleva el "
            f"registro desde su radicación hasta la salida de su respuesta, adicionalmente permite "
            f"generar reportes permanentes sobre el estado de las PQRSD, buscando determinar las "
            f"posibles debilidades y fortalezas para ser llevadas a la alta dirección en busca del "
            f"mejoramiento continuo de la Entidad y con ella, afianzar la confianza del ciudadano en "
            f"las instituciones públicas."
        )
        self.story.append(Paragraph(intro2, normal_style))
        self.story.append(Spacer(1, 0.1*inch))

        intro3 = (
            f"Así mismo el {entity_name} en desarrollo del Plan Anual de Auditoría {año_informe} y "
            f"dando cumplimiento a lo estipulado en el Artículo 17 del Decreto 648 de 2017, respecto "
            f"al desarrollo de sus roles de evaluación y seguimiento, liderazgo estratégico y enfoque "
            f"hacia la prevención; efectuó seguimiento a la gestión del {trimestre_palabra} trimestre "
            f"de {año_informe} relacionada con la atención de las PQRS tramitadas por cada una de las "
            f"dependencias que conforman el {entity_name}."
        )
        self.story.append(Paragraph(intro3, normal_style))
        self.story.append(Spacer(1, 0.15*inch))

        # ***** OBJETIVO *****
        self.story.append(Paragraph("OBJETIVO.", section_style))
        objetivo = (
            f"Garantizar la efectividad del ejercicio de los derechos reconocidos en la Constitución "
            f"y facilitar la participación de los ciudadanos en las decisiones que los afectan mediante "
            f"la promoción específica de la participación ciudadana, optimizando el procedimiento de "
            f"atención a las PQRSD."
        )
        self.story.append(Paragraph(objetivo, normal_style))
        self.story.append(Spacer(1, 0.15*inch))

        # ***** ALCANCE *****
        self.story.append(Paragraph("ALCANCE.", section_style))
        alcance = (
            f"El seguimiento se realiza a las PQRSD radicadas durante el periodo comprendido entre "
            f"el {periodo_texto}, con base en la información suministrada por el sistema de PQRS "
            f"del sitio web institucional del {entity_name}."
        )
        self.story.append(Paragraph(alcance, normal_style))
        self.story.append(Spacer(1, 0.15*inch))

        # ***** METODOLOGÍA *****
        self.story.append(Paragraph("METODOLOGÍA.", section_style))
        meto_intro = (
            f"El {entity_name} con los canales de atención busca que los cuales los ciudadanos y "
            f"grupos de interés pueden formular peticiones, quejas, reclamos, sugerencias y denuncias "
            f"sobre temas competencia de la entidad."
        )
        self.story.append(Paragraph(meto_intro, normal_style))
        self.story.append(Spacer(1, 0.08*inch))

        canales = [
            (
                "Canal Virtual",
                f"El {entity_name} ha dispuesto de un link en su página web "
                f"<u>{pqrs_url}</u> para la radicación, a través del cual se pueden formular las "
                f"PQRSD, al igual que el ciudadano las puede radicar a través del correo electrónico "
                f"institucional <u>{entity_email}</u>."
            ),
            (
                "Canal Escrito",
                "Conformado por los mecanismos de recepción de documentos escritos a través de "
                "correo postal o radicación personal o mediante el buzón."
            ),
            (
                "Canal Presencial",
                "Se puede acceder en el contacto directo con el personal de Atención al Ciudadano "
                "a través de la Ventanilla Única en el segundo nivel de servicio, con el fin de "
                "brindar información personalizada frente a peticiones, quejas, reclamos, sugerencias "
                "y denuncias o recibir la misma de manera verbal adelantando el trámite de radicación, "
                "en el evento de ser necesario."
            ),
            (
                "Canal Telefónico",
                f"La Administración municipal ha dispuesto diferentes líneas telefónicas para atender "
                f"las solicitudes y/o quejas que requieran presentar."
            ),
        ]

        canal_label_style = ParagraphStyle(
            'CanalLabel',
            parent=normal_style,
            fontName='Helvetica-Bold',
            fontSize=10
        )
        for titulo, descripcion in canales:
            self.story.append(Paragraph(f"{titulo}:", canal_label_style))
            self.story.append(Paragraph(descripcion, normal_style))
            self.story.append(Spacer(1, 0.05*inch))

        self.story.append(Spacer(1, 0.1*inch))
        self.story.append(Paragraph(
            "A continuación, se relacionan los canales de atención con su especificación del "
            "servicio a prestar:", normal_style
        ))
        self.story.append(Spacer(1, 0.15*inch))

        # ***** CANALES DE SERVICIO *****
        self.story.append(PageBreak())
        self.story.append(Paragraph("1. CANALES DE SERVICIO", section_style))
        canales_intro = (
            f"Los canales de atención que ofrece el {entity_name} son: Presencial, virtual y telefónico:"
        )
        self.story.append(Paragraph(canales_intro, normal_style))
        self.story.append(Spacer(1, 0.1*inch))

        self.story.append(Paragraph("2.1. Atención presencial:", canal_label_style))
        self.story.append(Spacer(1, 0.05*inch))

        presencial_texto = (
            f"Se presta atención personal en cada una de las secretarías dependiendo la necesidad "
            f"del ciudadano en nuestras oficinas ubicadas en {entity_name} en:"
        )
        self.story.append(Paragraph(presencial_texto, normal_style))

        if self.entity.address:
            self.story.append(Paragraph(f"Dirección: {self.entity.address}", normal_style))
        if self.entity.horario_atencion:
            self.story.append(Paragraph(f"Horario de atención: {self.entity.horario_atencion}", normal_style))

        radicacion_texto = (
            f"Para radicación de PQRSDF: Las pueden realizar a través de la ventanilla única ubicada "
            f"en {self.entity.address or 'las instalaciones de la entidad'} en el horario de atención "
            f"mencionado anteriormente. Con el número de radicado, usted podrá realizar el seguimiento "
            f"a su petición, queja, reclamo, sugerencia o denuncia."
        )
        self.story.append(Paragraph(radicacion_texto, normal_style))
        self.story.append(Paragraph(
            "Buzón de sugerencias: Adicionalmente, las peticiones, quejas, reclamos, sugerencias y "
            "denuncias, podrán presentarse utilizando el buzón de sugerencias ubicado en las "
            "instalaciones de la Entidad.", normal_style
        ))
        self.story.append(Spacer(1, 0.08*inch))

        self.story.append(Paragraph("Telefónico: A través de las líneas celulares:", canal_label_style))
        self.story.append(Spacer(1, 0.1*inch))

        # Tabla teléfonos
        phone_val = self.entity.phone or "—"
        phone_data = [
            [Paragraph("<b>SECRETARIA/OFICINA</b>", normal_style),
             Paragraph("<b>LÍNEAS CELULARES</b>", normal_style)],
            ["Despacho", phone_val],
        ]
        phone_table = Table(phone_data, colWidths=[3.5*inch, 3.0*inch])
        phone_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#d9d9d9')),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.black),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ]))
        self.story.append(phone_table)
        self.story.append(Spacer(1, 0.2*inch))

        # ***** INFORME DE GESTIÓN INSTITUCIONAL *****
        self.story.append(Paragraph("INFORME DE GESTIÓN INSTITUCIONAL", section_style))
        gestion_intro = (
            "Con el fin de dar cumplimiento a las respuestas de las distintas PQRSD, la entidad "
            "establece como puntos de control acorde a la Ley 1755 de 2015 Artículo 14. Términos "
            "para resolver las distintas modalidades de peticiones los siguientes:"
        )
        self.story.append(Paragraph(gestion_intro, normal_style))
        self.story.append(Spacer(1, 0.1*inch))

        terminos_data = [
            [Paragraph("<b>CLASE TERMINO</b>", normal_style),
             Paragraph("<b>CLASE TERMINO</b>", normal_style)],
            ["Petición en interés general y particular",
             "Dentro de los quince (15) días siguientes a su recepción"],
            ["Peticiones de Documentos e Información",
             "Dentro los diez (10) días siguientes a su recepción"],
            ["Consultas",
             "Dentro de los treinta (30) días siguientes a su recepción"],
            ["Peticiones entre autoridades",
             "Dentro de los cinco (5) días siguientes a su recepción"],
            ["Informes a concejales",
             "Dentro de los cinco (5) días siguientes a su recepción"],
        ]
        terminos_table = Table(terminos_data, colWidths=[3.25*inch, 3.25*inch])
        terminos_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#d9d9d9')),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.black),
            ('TOPPADDING', (0, 0), (-1, -1), 5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ]))
        self.story.append(terminos_table)
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
