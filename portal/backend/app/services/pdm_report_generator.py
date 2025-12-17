"""
Generador de Informes PDF para Plan de Desarrollo Municipal (PDM)
Basado en el diseño del documento institucional oficial
"""

from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT, TA_RIGHT
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, Image as RLImage, KeepTogether
)
from io import BytesIO
from datetime import datetime
from typing import List, Dict, Any
import os
import base64
from collections import defaultdict

# Configurar matplotlib para uso en servidor (sin display)
import matplotlib
matplotlib.use('Agg')  # Backend sin UI para servidor
import matplotlib.pyplot as plt
# Configurar fuente predeterminada para evitar errores
plt.rcParams['font.family'] = 'DejaVu Sans'

from sqlalchemy.orm import Session
from app.models.pdm import PdmActividadEvidencia
from app.models.user import User

class PDMReportGenerator:
    """Generador de informes PDF con estructura general"""
    
    def __init__(self, entity, productos: List, actividades: List, anio: int, db: Session = None, filtros: dict = None):
        self.entity = entity
        self.productos = productos
        self.actividades = actividades
        self.anio = anio
        self.db = db
        self.filtros = filtros or {}
        self.buffer = BytesIO()
        self.doc = None
        self.styles = None
        self.story = []
        self.page_number = 0
        
    def add_header_footer(self, canvas, doc):
        """Encabezado y pie de página estándar"""
        canvas.saveState()
        
        # ENCABEZADO
        canvas.setFont('Helvetica', 8)
        # Código de formulario estándar
        canvas.drawString(0.5*inch, 10.5*inch, "FM-PDM-001")
        canvas.drawString(0.5*inch, 10.3*inch, "Versión: 1.0")
        
        # Número de página y título
        canvas.drawRightString(8*inch, 10.5*inch, f"Página {doc.page}")
        canvas.drawRightString(8*inch, 10.3*inch, "INFORME DE GESTIÓN INSTITUCIONAL")
        
        # Línea separadora
        canvas.setStrokeColor(colors.HexColor('#003366'))
        canvas.line(0.5*inch, 10.2*inch, 8*inch, 10.2*inch)
        
        # PIE DE PÁGINA
        canvas.setFont('Helvetica', 7)
        footer_text = f"Plan de Desarrollo Municipal - {self.entity.name}"
        canvas.drawCentredString(4.25*inch, 0.5*inch, footer_text)
        
        canvas.restoreState()
    
    def generate_portada(self):
        """Genera la portada estándar"""
        # Título principal
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=self.styles['Title'],
            fontSize=24,
            textColor=colors.HexColor('#003366'),
            alignment=TA_CENTER,
            spaceAfter=12
        )
        
        self.story.append(Spacer(1, 2*inch))
        self.story.append(Paragraph("INFORME DE GESTIÓN", title_style))
        self.story.append(Paragraph(str(self.anio), title_style))
        self.story.append(Spacer(1, 0.3*inch))
        
        # Nombre del plan
        plan_style = ParagraphStyle(
            'PlanTitle',
            parent=self.styles['Heading1'],
            fontSize=18,
            textColor=colors.HexColor('#003366'),
            alignment=TA_CENTER
        )
        
        self.story.append(Paragraph("PLAN DE DESARROLLO MUNICIPAL", plan_style))
        self.story.append(Spacer(1, 0.3*inch))
        
        # Entidad
        entity_style = ParagraphStyle(
            'EntityName',
            parent=self.styles['Heading2'],
            fontSize=16,
            alignment=TA_CENTER,
            textColor=colors.HexColor('#666666')
        )
        self.story.append(Paragraph(self.entity.name.upper(), entity_style))
        self.story.append(Spacer(1, 0.5*inch))
        
        # Información de filtros si existen
        if self.filtros:
            filter_info = []
            if self.filtros.get('secretarias'):
                secs = ', '.join(self.filtros['secretarias'])
                filter_info.append(f"Secretarías: {secs}")
            if self.filtros.get('fecha_inicio') or self.filtros.get('fecha_fin'):
                inicio = self.filtros.get('fecha_inicio', 'N/A')
                fin = self.filtros.get('fecha_fin', 'N/A')
                filter_info.append(f"Período: {inicio} a {fin}")
            if self.filtros.get('estados'):
                estados = ', '.join(self.filtros['estados'])
                filter_info.append(f"Estados: {estados}")
            
            if filter_info:
                filter_style = ParagraphStyle(
                    'FilterInfo',
                    parent=self.styles['Normal'],
                    fontSize=10,
                    alignment=TA_CENTER,
                    textColor=colors.HexColor('#666666'),
                    spaceAfter=6
                )
                self.story.append(Spacer(1, 0.3*inch))
                for info in filter_info:
                    self.story.append(Paragraph(info, filter_style))
        
        # Subtítulo
        subtitle_style = ParagraphStyle(
            'Subtitle',
            parent=self.styles['Heading2'],
            fontSize=14,
            alignment=TA_CENTER,
            textColor=colors.HexColor('#666666')
        )
        
        self.story.append(Spacer(1, 0.5*inch))
        self.story.append(Paragraph("INFORME DE RENDICIÓN DE CUENTAS", subtitle_style))
        
        self.story.append(PageBreak())
    
    def generate_introduccion(self):
        """Genera la página de introducción"""
        title_style = ParagraphStyle(
            'SectionTitle',
            parent=self.styles['Heading1'],
            fontSize=16,
            textColor=colors.HexColor('#003366'),
            spaceAfter=12,
            spaceBefore=12
        )
        
        self.story.append(Paragraph("INTRODUCCIÓN", title_style))
        
        intro_text = f"""
        Los planes de desarrollo de las entidades territoriales son la carta de navegación y la principal 
        herramienta de planeación para su desarrollo integral. Son un instrumento político y técnico, 
        construido de forma democrática y pluralista, donde se concretan las decisiones, acciones, 
        medios y recursos que orientan el desarrollo del territorio.
        <br/><br/>
        El presente informe de gestión da cuenta del estado de ejecución del Plan de Desarrollo Municipal 
        para la vigencia {self.anio}, presentando los resultados alcanzados a partir de las metas establecidas, 
        los recursos administrativos, financieros y humanos ejecutados.
        <br/><br/>
        Este documento contiene información sobre el avance de productos, actividades y evidencias de 
        gestión, organizado por líneas estratégicas, sectores y objetivos de desarrollo sostenible.
        """
        
        justify_style = ParagraphStyle(
            'Justify',
            parent=self.styles['BodyText'],
            alignment=TA_JUSTIFY,
            fontSize=10
        )
        
        self.story.append(Paragraph(intro_text, justify_style))
        self.story.append(PageBreak())
    
    def calcular_avance_producto(self, producto):
        """Calcula el avance de un producto basado en programación vs meta cuatrienio"""
        try:
            if not producto.meta_cuatrienio or producto.meta_cuatrienio == 0:
                return 0
            
            # Calcular la suma de lo ejecutado hasta el año actual
            anios_validos = [2024, 2025, 2026, 2027]
            total_ejecutado = 0
            
            for anio in anios_validos:
                if anio <= self.anio:  # Solo contar años hasta el año del informe
                    programado = getattr(producto, f'programacion_{anio}', 0) or 0
                    total_ejecutado += programado
            
            # Calcular porcentaje de avance
            avance = (total_ejecutado / producto.meta_cuatrienio) * 100
            return min(100, avance)  # Máximo 100%
        except Exception as e:
            print(f"      ⚠️ Error calculando avance para {producto.codigo_producto}: {e}")
            return 0
    
    def generate_grafico_lineas(self):
        """Genera gráfico de avance por líneas estratégicas"""
        # Calcular avance por línea estratégica
        lineas_data = {}
        for prod in self.productos:
            linea = prod.linea_estrategica or 'Sin Línea'
            if linea not in lineas_data:
                lineas_data[linea] = {'total': 0, 'suma_avance': 0}
            
            lineas_data[linea]['total'] += 1
            avance = self.calcular_avance_producto(prod)
            lineas_data[linea]['suma_avance'] += avance
        
        # Calcular promedios
        lineas = []
        avances = []
        for linea, data in lineas_data.items():
            if data['total'] > 0:
                promedio = data['suma_avance'] / data['total']
                lineas.append(linea[:30])  # Truncar nombres largos
                avances.append(promedio)
        
        if not lineas:
            print("⚠️  No hay líneas estratégicas para graficar")
            return
        
        try:
            print(f"   📊 Generando gráfico con {len(lineas)} líneas estratégicas...")
            
            # Crear gráfico
            fig, ax = plt.subplots(figsize=(8, max(len(lineas) * 0.5, 3)))
            colors_bar = ['#003366' if a >= 70 else '#FF6B35' if a < 50 else '#FFA500' for a in avances]
            
            ax.barh(lineas, avances, color=colors_bar)
            ax.set_xlabel('% Avance', fontsize=10)
            ax.set_title('Avance por Línea Estratégica', fontsize=12, fontweight='bold')
            ax.set_xlim(0, 100)
            
            # Agregar etiquetas de porcentaje
            for i, v in enumerate(avances):
                ax.text(v + 2, i, f'{v:.1f}%', va='center', fontsize=9)
            
            plt.tight_layout()
            
            # Convertir a imagen para PDF
            img_buffer = BytesIO()
            plt.savefig(img_buffer, format='png', dpi=150, bbox_inches='tight')
            img_buffer.seek(0)
            plt.close(fig)  # Cerrar figura específica
            
            img = RLImage(img_buffer, width=6.5*inch, height=max(len(lineas) * 0.5*inch, 3*inch))
            self.story.append(img)
            self.story.append(Spacer(1, 0.3*inch))
            
            print(f"   ✅ Gráfico generado correctamente")
            
        except Exception as e:
            print(f"   ❌ Error generando gráfico: {str(e)}")
            import traceback
            traceback.print_exc()
            # Agregar texto alternativo si falla el gráfico
            error_style = ParagraphStyle(
                'ErrorText',
                parent=self.styles['BodyText'],
                fontSize=10,
                textColor=colors.red,
                alignment=TA_CENTER
            )
            self.story.append(Paragraph(
                "[Gráfico no disponible - Error en generación]",
                error_style
            ))
            self.story.append(Spacer(1, 0.3*inch))
        finally:
            # Limpiar todas las figuras de matplotlib
            plt.close('all')
        # Convertir a imagen para PDF
        img_buffer = BytesIO()
        plt.savefig(img_buffer, format='png', dpi=150, bbox_inches='tight')
        img_buffer.seek(0)
        plt.close()
        
        img = RLImage(img_buffer, width=6.5*inch, height=len(lineas) * 0.5*inch)
        self.story.append(img)
        self.story.append(Spacer(1, 0.3*inch))
    
    def generate_seccion_lineas(self):
        """Genera sección de avance por líneas estratégicas"""
        title_style = ParagraphStyle(
            'SectionTitle',
            parent=self.styles['Heading1'],
            fontSize=14,
            textColor=colors.HexColor('#003366'),
            spaceAfter=12,
            fontName='Helvetica-Bold'
        )
        
        self.story.append(Paragraph(
            "AVANCE DE CUMPLIMIENTO DE METAS PLAN DE DESARROLLO POR LÍNEAS ESTRATÉGICAS",
            title_style
        ))
        
        desc_text = """
        Las líneas estratégicas (también conocidas como pilares, ejes o dimensiones) son las grandes 
        apuestas o enfoques prioritarios que una administración define para guiar y centrar sus acciones 
        durante el periodo de vigencia del Plan de Desarrollo y su principal función es organizar y 
        orientar la gestión pública.
        """
        
        justify_style = ParagraphStyle(
            'Justify',
            parent=self.styles['BodyText'],
            alignment=TA_JUSTIFY,
            fontSize=10,
            spaceAfter=12
        )
        
        self.story.append(Paragraph(desc_text, justify_style))
        self.story.append(Spacer(1, 0.2*inch))
        
        # Agregar gráfico
        self.generate_grafico_lineas()
        
        self.story.append(PageBreak())
    
    def generate_tabla_productos(self):
        """Genera tabla detallada de productos por línea estratégica"""
        # Agrupar productos por línea
        productos_por_linea = {}
        for prod in self.productos:
            linea = prod.linea_estrategica or 'Sin Línea Estratégica'
            if linea not in productos_por_linea:
                productos_por_linea[linea] = []
            productos_por_linea[linea].append(prod)
        
        title_style = ParagraphStyle(
            'SectionTitle',
            parent=self.styles['Heading1'],
            fontSize=14,
            textColor=colors.HexColor('#003366'),
            spaceAfter=12,
            fontName='Helvetica-Bold'
        )
        
        self.story.append(Paragraph(
            "DESCRIPCIÓN DE CUMPLIMIENTO DE METAS PLAN DE DESARROLLO POR LÍNEAS ESTRATÉGICAS",
            title_style
        ))
        self.story.append(Spacer(1, 0.2*inch))
        
        for linea, productos in productos_por_linea.items():
            # Encabezado de línea
            linea_style = ParagraphStyle(
                'LineaTitle',
                parent=self.styles['Heading2'],
                fontSize=11,
                textColor=colors.white,
                backColor=colors.HexColor('#003366'),
                alignment=TA_CENTER,
                fontName='Helvetica-Bold',
                leftIndent=6,
                rightIndent=6,
                spaceAfter=6,
                spaceBefore=6
            )
            
            # Tabla de encabezado de línea (cell merged)
            header_data = [[Paragraph(linea.upper(), linea_style)]]
            header_table = Table(header_data, colWidths=[7*inch])
            header_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#003366')),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ('TOPPADDING', (0, 0), (-1, -1), 8),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ]))
            
            self.story.append(header_table)
            self.story.append(Spacer(1, 0.1*inch))
            
            # Tabla de productos
            data = [[
                Paragraph('<b>PRODUCTO(S)</b>', self.styles['Normal']),
                Paragraph('<b>INDICADOR DE PRODUCTO</b>', self.styles['Normal']),
                Paragraph('<b>AVANCE FÍSICO</b>', self.styles['Normal']),
                Paragraph('<b>AVANCE FINANCIERO</b>', self.styles['Normal'])
            ]]
            
            for prod in productos:
                producto_text = prod.producto_mga or prod.codigo_producto
                indicador_text = prod.indicador_producto_mga or prod.personalizacion_indicador or 'N/A'
                
                # Calcular avance físico usando nuestra función
                avance_porcentaje = self.calcular_avance_producto(prod)
                avance_fisico = f"{avance_porcentaje:.1f}%"
                
                # Calcular avance financiero (suma de totales ejecutados vs programados)
                total_programado = (
                    (prod.total_2024 or 0) +
                    (prod.total_2025 or 0) +
                    (prod.total_2026 or 0) +
                    (prod.total_2027 or 0)
                )
                
                # Para avance financiero usamos el mismo porcentaje por ahora
                # En el futuro se puede calcular con datos reales de ejecución presupuestal
                avance_financiero = f"{avance_porcentaje:.1f}%"
                
                data.append([
                    Paragraph(producto_text[:100], self.styles['Normal']),
                    Paragraph(indicador_text[:100], self.styles['Normal']),
                    Paragraph(avance_fisico, self.styles['Normal']),
                    Paragraph(avance_financiero, self.styles['Normal'])
                ])
            
            table = Table(data, colWidths=[2.5*inch, 2.5*inch, 1*inch, 1*inch])
            table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#003366')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 9),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
                ('TOPPADDING', (0, 0), (-1, 0), 8),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
                ('FONTSIZE', (0, 1), (-1, -1), 8),
                ('TOPPADDING', (0, 1), (-1, -1), 6),
                ('BOTTOMPADDING', (0, 1), (-1, -1), 6),
            ]))
            
            self.story.append(table)
            self.story.append(Spacer(1, 0.3*inch))
        
        # No agregar PageBreak al final para permitir continuidad
    
    def generate_seccion_sectores(self):
        """Genera sección de avance por sectores MGA"""
        title_style = ParagraphStyle(
            'SectionTitle',
            parent=self.styles['Heading1'],
            fontSize=14,
            textColor=colors.HexColor('#003366'),
            spaceAfter=12,
            fontName='Helvetica-Bold'
        )
        
        self.story.append(Paragraph(
            "AVANCE DE CUMPLIMIENTO DE METAS PLAN DE DESARROLLO POR SECTORES",
            title_style
        ))
        
        desc_text = """
        Los sectores del Plan de Desarrollo se refieren a las áreas temáticas o campos de 
        acción específicos en los que se organiza la gestión pública para abordar las 
        necesidades y prioridades de una entidad territorial. En esencia, son la división 
        funcional de la acción estatal para abordar de manera sistemática y organizada los 
        diferentes aspectos del desarrollo territorial.
        """
        
        justify_style = ParagraphStyle(
            'Justify',
            parent=self.styles['BodyText'],
            alignment=TA_JUSTIFY,
            fontSize=10,
            spaceAfter=12
        )
        
        self.story.append(Paragraph(desc_text, justify_style))
        self.story.append(Spacer(1, 0.2*inch))
        
        # Generar gráfico de sectores
        self.generate_grafico_sectores()
        
        self.story.append(PageBreak())
    
    def generate_grafico_sectores(self):
        """Genera gráfico de barras por sectores MGA"""
        sectores_data = defaultdict(lambda: {'total': 0, 'suma_avance': 0})
        
        for prod in self.productos:
            sector = prod.sector_mga or 'Sin Sector'
            sectores_data[sector]['total'] += 1
            avance = self.calcular_avance_producto(prod)
            sectores_data[sector]['suma_avance'] += avance
        
        sectores = []
        avances = []
        for sector, data in sectores_data.items():
            if data['total'] > 0:
                promedio = data['suma_avance'] / data['total']
                sectores.append(sector[:30])
                avances.append(promedio)
        
        if not sectores:
            print("⚠️  No hay sectores para graficar")
            return
        
        try:
            print(f"   📊 Generando gráfico con {len(sectores)} sectores...")
            
            fig, ax = plt.subplots(figsize=(8, max(len(sectores) * 0.5, 3)))
            colors_bar = ['#003366' if a >= 70 else '#FF6B35' if a < 50 else '#FFA500' for a in avances]
            
            ax.barh(sectores, avances, color=colors_bar)
            ax.set_xlabel('% Avance', fontsize=10)
            ax.set_title('Avance por Sector MGA', fontsize=12, fontweight='bold')
            ax.set_xlim(0, 100)
            
            for i, v in enumerate(avances):
                ax.text(v + 2, i, f'{v:.1f}%', va='center', fontsize=9)
            
            plt.tight_layout()
            
            img_buffer = BytesIO()
            plt.savefig(img_buffer, format='png', dpi=150, bbox_inches='tight')
            img_buffer.seek(0)
            plt.close(fig)
            
            img = RLImage(img_buffer, width=6.5*inch, height=max(len(sectores) * 0.5*inch, 3*inch))
            self.story.append(img)
            self.story.append(Spacer(1, 0.3*inch))
            
            print(f"   ✅ Gráfico de sectores generado correctamente")
            
        except Exception as e:
            print(f"   ❌ Error generando gráfico de sectores: {str(e)}")
            error_style = ParagraphStyle(
                'ErrorText',
                parent=self.styles['BodyText'],
                fontSize=10,
                textColor=colors.red,
                alignment=TA_CENTER
            )
            self.story.append(Paragraph(
                "[Gráfico de sectores no disponible - Error en generación]",
                error_style
            ))
            self.story.append(Spacer(1, 0.3*inch))
        finally:
            plt.close('all')
    
    def generate_seccion_ods(self):
        """Genera sección de avance por Objetivos de Desarrollo Sostenible"""
        title_style = ParagraphStyle(
            'SectionTitle',
            parent=self.styles['Heading1'],
            fontSize=14,
            textColor=colors.HexColor('#003366'),
            spaceAfter=12,
            fontName='Helvetica-Bold'
        )
        
        self.story.append(Paragraph(
            "AVANCE DE CUMPLIMIENTO DE METAS PLAN DE DESARROLLO POR OBJETIVOS DE DESARROLLO SOSTENIBLE",
            title_style
        ))
        
        desc_text = """
        Los Objetivos de Desarrollo Sostenible (ODS) son un conjunto de 17 objetivos globales 
        establecidos por las Naciones Unidas en 2015 como parte de la Agenda 2030 para el 
        Desarrollo Sostenible. Estos objetivos son un llamado universal a la acción para poner 
        fin a la pobreza, proteger el planeta y garantizar que todas las personas gocen de paz 
        y prosperidad para 2030.
        """
        
        justify_style = ParagraphStyle(
            'Justify',
            parent=self.styles['BodyText'],
            alignment=TA_JUSTIFY,
            fontSize=10,
            spaceAfter=12
        )
        
        self.story.append(Paragraph(desc_text, justify_style))
        self.story.append(Spacer(1, 0.2*inch))
        
        # Generar gráfico ODS
        self.generate_grafico_ods()
        
        self.story.append(PageBreak())
    
    def generate_grafico_ods(self):
        """Genera gráfico de barras por ODS"""
        ods_data = defaultdict(lambda: {'total': 0, 'suma_avance': 0})
        
        for prod in self.productos:
            ods = prod.ods or 'Sin ODS'
            ods_data[ods]['total'] += 1
            avance = self.calcular_avance_producto(prod)
            ods_data[ods]['suma_avance'] += avance
        
        ods_list = []
        avances = []
        for ods, data in ods_data.items():
            if data['total'] > 0:
                promedio = data['suma_avance'] / data['total']
                ods_list.append(ods[:40])
                avances.append(promedio)
        
        if not ods_list:
            print("⚠️  No hay ODS para graficar")
            return
        
        try:
            print(f"   📊 Generando gráfico con {len(ods_list)} ODS...")
            
            fig, ax = plt.subplots(figsize=(8, max(len(ods_list) * 0.5, 3)))
            colors_bar = ['#003366' if a >= 70 else '#FF6B35' if a < 50 else '#FFA500' for a in avances]
            
            ax.barh(ods_list, avances, color=colors_bar)
            ax.set_xlabel('% Avance', fontsize=10)
            ax.set_title('Avance por ODS', fontsize=12, fontweight='bold')
            ax.set_xlim(0, 100)
            
            for i, v in enumerate(avances):
                ax.text(v + 2, i, f'{v:.1f}%', va='center', fontsize=9)
            
            plt.tight_layout()
            
            img_buffer = BytesIO()
            plt.savefig(img_buffer, format='png', dpi=150, bbox_inches='tight')
            img_buffer.seek(0)
            plt.close(fig)
            
            img = RLImage(img_buffer, width=6.5*inch, height=max(len(ods_list) * 0.5*inch, 3*inch))
            self.story.append(img)
            self.story.append(Spacer(1, 0.3*inch))
            
            print(f"   ✅ Gráfico de ODS generado correctamente")
            
        except Exception as e:
            print(f"   ❌ Error generando gráfico de ODS: {str(e)}")
            error_style = ParagraphStyle(
                'ErrorText',
                parent=self.styles['BodyText'],
                fontSize=10,
                textColor=colors.red,
                alignment=TA_CENTER
            )
            self.story.append(Paragraph(
                "[Gráfico de ODS no disponible - Error en generación]",
                error_style
            ))
            self.story.append(Spacer(1, 0.3*inch))
        finally:
            plt.close('all')
    
    def generate_tabla_productos_detallada(self):
        """Genera tabla detallada por producto con actividades, evidencias e imágenes"""
        from app.models.pdm import PdmActividadEvidencia
        
        title_style = ParagraphStyle(
            'SectionTitle',
            parent=self.styles['Heading1'],
            fontSize=14,
            textColor=colors.HexColor('#003366'),
            spaceAfter=12,
            fontName='Helvetica-Bold'
        )
        
        self.story.append(PageBreak())
        self.story.append(Paragraph(
            "EJECUCIÓN PLAN DE ACCIÓN - DETALLE POR PRODUCTO",
            title_style
        ))
        self.story.append(Spacer(1, 0.3*inch))
        
        # Agrupar actividades por producto
        actividades_por_producto = defaultdict(list)
        for act in self.actividades:
            if act.anio == self.anio:  # Solo actividades del año del informe
                actividades_por_producto[act.codigo_producto].append(act)
        
        # Procesar cada producto (máximo 10 para no saturar el PDF)
        productos_procesados = 0
        max_productos = 10
        
        for prod in self.productos[:max_productos]:
            print(f"   📦 Procesando producto: {prod.codigo_producto}")
            
            # ENCABEZADO DEL PRODUCTO
            producto_nombre = prod.producto_mga or prod.codigo_producto
            indicador_nombre = prod.indicador_producto_mga or prod.personalizacion_indicador or 'N/A'
            
            # Tabla de encabezado de producto
            header_data = [
                [Paragraph(f'<b>PRODUCTO:</b> {producto_nombre}', self.styles['Normal'])],
                [Paragraph(f'<b>INDICADOR:</b> {indicador_nombre}', self.styles['Normal'])]
            ]
            
            header_table = Table(header_data, colWidths=[7*inch])
            header_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#E8F4F8')),
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ('TOPPADDING', (0, 0), (-1, -1), 6),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
                ('LEFTPADDING', (0, 0), (-1, -1), 10),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ]))
            
            self.story.append(header_table)
            self.story.append(Spacer(1, 0.1*inch))
            
            # AVANCES
            avance = self.calcular_avance_producto(prod)
            data_avance = [[
                Paragraph('<b>AVANCE FÍSICO</b>', self.styles['Normal']),
                Paragraph('<b>AVANCE FINANCIERO</b>', self.styles['Normal'])
            ], [
                Paragraph(f'{avance:.1f}%', self.styles['Normal']),
                Paragraph(f'{avance:.1f}%', self.styles['Normal'])
            ]]
            
            avance_table = Table(data_avance, colWidths=[3.5*inch, 3.5*inch])
            avance_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#003366')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
                ('TOPPADDING', (0, 0), (-1, -1), 6),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ]))
            
            self.story.append(avance_table)
            self.story.append(Spacer(1, 0.1*inch))
            
            # ACTIVIDADES DEL PRODUCTO
            actividades = actividades_por_producto.get(prod.codigo_producto, [])
            
            if actividades:
                # Encabezado de actividades
                act_header = [[
                    Paragraph('<b>Meta y/o Actividades</b>', self.styles['Normal']),
                    Paragraph('<b>Informe de Ejecución</b>', self.styles['Normal'])
                ]]
                
                for actividad in actividades[:5]:  # Máximo 5 actividades por producto
                    meta_text = f"{actividad.nombre}\n{actividad.descripcion or ''}"
                    
                    # Informe de ejecución
                    informe = f"<b>Actividad:</b> {actividad.nombre}<br/>"
                    informe += f"<b>Estado:</b> {actividad.estado}<br/>"
                    informe += f"<b>Meta a ejecutar:</b> {actividad.meta_ejecutar}"
                    
                    if actividad.responsable_secretaria:
                        informe += f"<br/><b>Responsable:</b> {actividad.responsable_secretaria.nombre}"
                    
                    act_header.append([
                        Paragraph(meta_text[:300], self.styles['Normal']),
                        Paragraph(informe, self.styles['Normal'])
                    ])
                
                act_table = Table(act_header, colWidths=[3.5*inch, 3.5*inch])
                act_table.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#003366')),
                    ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                    ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                    ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                    ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
                    ('TOPPADDING', (0, 0), (-1, -1), 6),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
                    ('LEFTPADDING', (0, 0), (-1, -1), 6),
                ]))
                
                self.story.append(act_table)
                self.story.append(Spacer(1, 0.1*inch))
                
                # RESPONSABLE Y RECURSOS
                total_recursos = (
                    (prod.total_2024 or 0) if self.anio >= 2024 else 0 +
                    (prod.total_2025 or 0) if self.anio >= 2025 else 0 +
                    (prod.total_2026 or 0) if self.anio >= 2026 else 0 +
                    (prod.total_2027 or 0) if self.anio >= 2027 else 0
                )
                
                recursos_data = [[
                    Paragraph('<b>Cantidad Meta Física</b>', self.styles['Normal']),
                    Paragraph('<b>Recursos Ejecutados</b>', self.styles['Normal']),
                    Paragraph('<b>Responsable</b>', self.styles['Normal'])
                ], [
                    Paragraph(str(prod.meta_cuatrienio or 0), self.styles['Normal']),
                    Paragraph(f'${total_recursos:,.0f}', self.styles['Normal']),
                    Paragraph(prod.responsable_secretaria.nombre if prod.responsable_secretaria else 'N/A', self.styles['Normal'])
                ]]
                
                recursos_table = Table(recursos_data, colWidths=[2.33*inch, 2.33*inch, 2.34*inch])
                recursos_table.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#003366')),
                    ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                    ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                    ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
                    ('TOPPADDING', (0, 0), (-1, -1), 6),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
                ]))
                
                self.story.append(recursos_table)
                self.story.append(Spacer(1, 0.1*inch))
                
                # EVIDENCIAS E IMÁGENES
                evidencias_encontradas = False
                for actividad in actividades:
                    if self.db and actividad.evidencia:
                        evidencias_encontradas = True
                        evidencia = actividad.evidencia
                        
                        # Texto de evidencia
                        evidencia_header = [[Paragraph('<b>REGISTRO DE EVIDENCIA</b>', self.styles['Normal'])]]
                        evidencia_header.append([Paragraph(evidencia.descripcion or 'Sin descripción', self.styles['Normal'])])
                        
                        evidencia_table = Table(evidencia_header, colWidths=[7*inch])
                        evidencia_table.setStyle(TableStyle([
                            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#003366')),
                            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
                            ('TOPPADDING', (0, 0), (-1, -1), 6),
                            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
                            ('LEFTPADDING', (0, 0), (-1, -1), 6),
                        ]))
                        
                        self.story.append(evidencia_table)
                        self.story.append(Spacer(1, 0.1*inch))
                        
                        # Imágenes de evidencia
                        if evidencia.imagenes and isinstance(evidencia.imagenes, list):
                            print(f"      📷 Procesando {len(evidencia.imagenes)} imágenes...")
                            
                            for idx, img_base64 in enumerate(evidencia.imagenes[:3]):  # Máximo 3 imágenes
                                try:
                                    # Decodificar base64
                                    if img_base64.startswith('data:image'):
                                        img_base64 = img_base64.split(',')[1]
                                    
                                    img_data = base64.b64decode(img_base64)
                                    img_buffer = BytesIO(img_data)
                                    
                                    # Agregar imagen al PDF
                                    img = RLImage(img_buffer, width=3*inch, height=2*inch)
                                    self.story.append(img)
                                    self.story.append(Spacer(1, 0.1*inch))
                                    
                                    print(f"      ✅ Imagen {idx+1} agregada")
                                    
                                except Exception as e:
                                    print(f"      ⚠️ Error procesando imagen {idx+1}: {e}")
                
                if not evidencias_encontradas:
                    evidencia_table = Table([[Paragraph('<b>REGISTRO DE EVIDENCIA</b>', self.styles['Normal'])],
                                            [Paragraph('Sin evidencias registradas para este producto.', self.styles['Normal'])]], 
                                           colWidths=[7*inch])
                    evidencia_table.setStyle(TableStyle([
                        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#003366')),
                        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
                        ('TOPPADDING', (0, 0), (-1, -1), 6),
                        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
                        ('LEFTPADDING', (0, 0), (-1, -1), 6),
                    ]))
                    self.story.append(evidencia_table)
            
            else:
                # Sin actividades
                sin_act_table = Table([[Paragraph('Sin actividades registradas para este producto en el año {}.'.format(self.anio), self.styles['Normal'])]], 
                                     colWidths=[7*inch])
                sin_act_table.setStyle(TableStyle([
                    ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                    ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
                    ('TOPPADDING', (0, 0), (-1, -1), 10),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
                ]))
                self.story.append(sin_act_table)
            
            # Separador entre productos
            self.story.append(Spacer(1, 0.3*inch))
            productos_procesados += 1
            
            # Page break cada 2 productos para no saturar
            if productos_procesados % 2 == 0:
                self.story.append(PageBreak())
        
        print(f"   ✅ Procesados {productos_procesados} productos con detalle completo")
    
    def generate(self) -> bytes:
        """Genera el PDF completo y retorna los bytes"""
        try:
            print("📄 Generando informe PDM en PDF...")
            
            # Configurar documento
            self.doc = SimpleDocTemplate(
                self.buffer,
                pagesize=letter,
                rightMargin=0.5*inch,
                leftMargin=0.5*inch,
                topMargin=0.8*inch,
                bottomMargin=0.8*inch
            )
            
            # Estilos
            self.styles = getSampleStyleSheet()
            
            # 1. Portada
            print("  ├─ Portada")
            self.generate_portada()
            
            # 2. Introducción
            print("  ├─ Introducción")
            self.generate_introduccion()
            
            # 3. Sección de líneas estratégicas
            print("  ├─ Líneas Estratégicas")
            self.generate_seccion_lineas()
            
            # 4. Sección de sectores MGA
            print("  ├─ Sectores MGA")
            self.generate_seccion_sectores()
            
            # 5. Sección de ODS
            print("  ├─ Objetivos de Desarrollo Sostenible")
            self.generate_seccion_ods()
            
            # 6. Tabla de productos (versión básica - resumen)
            print("  ├─ Tabla de Productos (Resumen)")
            self.generate_tabla_productos()
            
            # 7. Tabla detallada de productos con actividades y evidencias
            print("  ├─ Detalle de Productos con Actividades y Evidencias")
            self.generate_tabla_productos_detallada()
            
            # Build PDF
            print("  └─ Construyendo PDF...")
            self.doc.build(
                self.story,
                onFirstPage=self.add_header_footer,
                onLaterPages=self.add_header_footer
            )
            
            pdf_bytes = self.buffer.getvalue()
            self.buffer.close()
            
            print(f"✅ PDF generado exitosamente ({len(pdf_bytes)} bytes)")
            return pdf_bytes
            
        except Exception as e:
            print(f"❌ Error generando PDF: {e}")
            import traceback
            traceback.print_exc()
            raise
