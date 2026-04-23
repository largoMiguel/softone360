"""
Servicio de IA usando Amazon Bedrock con Claude 3
Genera análisis profesionales de PQRS sin costos de API externas
"""

import boto3
import json
from typing import Dict, List, Any
from botocore.exceptions import ClientError


class BedrockAIService:
    """Servicio IA nativo en AWS usando Bedrock + Claude 3 Sonnet"""

    def __init__(self, region_name: str = 'us-east-1'):
        """Inicializar cliente Bedrock con credenciales IAM"""
        self.client = boto3.client('bedrock-runtime', region_name=region_name)
        self.model_id = 'anthropic.claude-3-sonnet-20240229-v1:0'

    def analizar_pqrs(
        self,
        analytics: Dict[str, Any],
        entity_name: str,
        fecha_inicio: str,
        fecha_fin: str,
        pqrs_list: List[Dict] = None
    ) -> Dict[str, Any]:
        """
        Analizar PQRS con Claude 3 vía Bedrock
        
        Args:
            analytics: Diccionario con métricas (totalPqrs, pendientes, etc.)
            entity_name: Nombre de la entidad
            fecha_inicio: Fecha inicial del período
            fecha_fin: Fecha final del período
            pqrs_list: Lista de PQRS para contexto adicional
            
        Returns:
            Diccionario con: introduccion, analisisGeneral, analisisTendencias,
                           recomendaciones, conclusiones
        """
        try:
            print(f"🤖 Iniciando análisis IA con Bedrock (Claude 3)...")
            
            # Construir prompt detallado
            prompt = self._construir_prompt(
                analytics, entity_name, fecha_inicio, fecha_fin, pqrs_list
            )
            
            # Invocar modelo vía Bedrock
            response = self.client.invoke_model(
                modelId=self.model_id,
                contentType='application/json',
                accept='application/json',
                body=json.dumps({
                    'anthropic_version': 'bedrock-2023-06-01',
                    'max_tokens': 2000,
                    'messages': [{
                        'role': 'user',
                        'content': prompt
                    }]
                })
            )
            
            # Parsear respuesta
            result = json.loads(response['body'].read())
            content = result['content'][0]['text']
            
            print(f"✅ Análisis IA completado ({len(content)} caracteres)")
            
            # Estructurar respuesta
            return self._parse_response(content)
            
        except ClientError as e:
            if e.response['Error']['Code'] == 'AccessDenied':
                print(f"⚠️ Error de acceso a Bedrock - revisar permisos IAM")
            else:
                print(f"❌ Error en Bedrock: {e}")
            raise
        except Exception as e:
            print(f"❌ Error inesperado en análisis IA: {e}")
            raise

    def _construir_prompt(
        self,
        analytics: Dict,
        entity_name: str,
        fecha_inicio: str,
        fecha_fin: str,
        pqrs_list: List[Dict] = None
    ) -> str:
        """Construir prompt detallado para Claude"""
        
        tipos_str = "\n".join([
            f"  • {tipo.replace('_', ' ').title()}: {cant}"
            for tipo, cant in analytics.get('tiposPqrs', {}).items()
        ])
        
        prompt = f"""Eres un analista experto en gestión pública colombiana especializado en PQRS (Peticiones, Quejas, Reclamos, Solicitudes y Denuncias).

Analiza los siguientes datos de PQRS del {entity_name} para el período {fecha_inicio} a {fecha_fin}:

**INDICADORES CLAVE:**
• Total de PQRS: {analytics.get('totalPqrs', 0)}
• Pendientes: {analytics.get('pendientes', 0)}
• En proceso: {analytics.get('enProceso', 0)}
• Resueltas: {analytics.get('resueltas', 0)}
• Cerradas: {analytics.get('cerradas', 0)}
• Tasa de resolución: {analytics.get('tasaResolucion', 0)}%
• Tiempo promedio de respuesta: {analytics.get('tiempoPromedioRespuesta', 0)} días

**DISTRIBUCIÓN POR TIPO:**
{tipos_str}

Por favor genera un análisis profesional estructurado en las siguientes secciones:

1. **INTRODUCCIÓN EJECUTIVA** (2-3 párrafos)
   - Resumen del período y volumen
   - Contexto de la gestión

2. **ANÁLISIS GENERAL** (2-3 párrafos)
   - Análisis de las métricas principales
   - Fortalezas y debilidades identificadas
   - Comparación con estándares legales (Ley 1755/2015)

3. **ANÁLISIS DE TENDENCIAS** (2-3 párrafos)
   - Patrones identificados
   - Tipos de solicitud más frecuentes
   - Comportamiento temporal

4. **RECOMENDACIONES** (5 puntos numerados)
   - Acciones concretas para mejorar
   - Priorización según impacto
   - Orientadas a cumplimiento legal y mejora continua

5. **CONCLUSIONES** (1-2 párrafos)
   - Síntesis del estado actual
   - Perspectiva para próximos períodos

**IMPORTANTE:**
- Usa lenguaje técnico pero accesible
- Referencia normas colombianas aplicables (Ley 1474/2011, Ley 1755/2015)
- Enfoque en mejora continua y cumplimiento legal
- Datos concretos y numéricos en recomendaciones
- Tono profesional para presentación a directivos

Inicia directamente con el análisis, sin preámbulos."""

        return prompt

    def _parse_response(self, content: str) -> Dict[str, Any]:
        """Parsear respuesta de Claude en estructura esperada"""
        
        # Dividir por secciones
        sections = {
            'introduccion': '',
            'analisisGeneral': '',
            'analisisTendencias': '',
            'recomendaciones': [],
            'conclusiones': ''
        }
        
        # Buscar cada sección
        lines = content.split('\n')
        current_section = None
        current_text = []
        
        for line in lines:
            line_lower = line.lower()
            
            # Detectar encabezado de sección
            if 'introducción ejecutiva' in line_lower:
                if current_section and current_text:
                    self._save_section(sections, current_section, current_text)
                current_section = 'introduccion'
                current_text = []
            elif 'análisis general' in line_lower:
                if current_section and current_text:
                    self._save_section(sections, current_section, current_text)
                current_section = 'analisisGeneral'
                current_text = []
            elif 'análisis de tendencias' in line_lower:
                if current_section and current_text:
                    self._save_section(sections, current_section, current_text)
                current_section = 'analisisTendencias'
                current_text = []
            elif 'recomendaciones' in line_lower:
                if current_section and current_text:
                    self._save_section(sections, current_section, current_text)
                current_section = 'recomendaciones'
                current_text = []
            elif 'conclusiones' in line_lower:
                if current_section and current_text:
                    self._save_section(sections, current_section, current_text)
                current_section = 'conclusiones'
                current_text = []
            elif current_section and line.strip():
                # Agregar línea al texto actual
                if line.strip().startswith(('**', '1.', '2.', '3.', '4.', '5.', '-', '•')):
                    current_text.append(line.strip())
                elif current_text:  # Solo si ya hay contenido
                    current_text.append(line.strip())
        
        # Guardar última sección
        if current_section and current_text:
            self._save_section(sections, current_section, current_text)
        
        # Procesar recomendaciones como lista
        if isinstance(sections['recomendaciones'], str):
            sections['recomendaciones'] = [
                r.strip() for r in sections['recomendaciones'].split('\n')
                if r.strip() and len(r.strip()) > 5
            ]
        
        return sections

    def _save_section(self, sections: Dict, section_name: str, text_lines: List[str]) -> None:
        """Guardar sección procesada"""
        if section_name == 'recomendaciones':
            # Para recomendaciones, guardar como lista
            text = '\n'.join(text_lines)
            # Extraer items numerados
            items = []
            for line in text_lines:
                if any(line.startswith(f"{i}.") for i in range(1, 10)):
                    items.append(line)
            sections[section_name] = items if items else text_lines
        else:
            # Para otros, guardar como texto
            sections[section_name] = '\n'.join(text_lines)


def get_bedrock_service() -> BedrockAIService:
    """Factory para obtener instancia del servicio"""
    return BedrockAIService()
