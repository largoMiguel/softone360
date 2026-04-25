"""
Servicio de IA usando OpenAI API (GPT-4.1-nano)
Genera análisis profesionales de PQRS
"""

import os
import json
from typing import Dict, List, Any
from openai import OpenAI


class OpenAIService:
    """Servicio IA usando OpenAI GPT-4.1-nano"""

    def __init__(self):
        api_key = os.environ.get('OPENAI_API_KEY')
        if not api_key:
            raise ValueError("OPENAI_API_KEY no configurada en variables de entorno")
        self.client = OpenAI(api_key=api_key)
        # Configurable via OPENAI_MODEL env var. Opciones (de más barato a más caro):
        # gpt-4o-mini    → $0.15/$0.60 por 1M tokens  (recomendado, muy buena relación costo/calidad)
        # gpt-4o         → $5.0/$15.0 por 1M tokens   (más potente)
        # gpt-4-turbo    → $10.0/$30.0 por 1M tokens  (máxima calidad)
        self.model = os.environ.get('OPENAI_MODEL', 'gpt-4o-mini')

    def analizar_pqrs(
        self,
        analytics: Dict[str, Any],
        entity_name: str,
        fecha_inicio: str,
        fecha_fin: str,
        pqrs_list: List[Dict] = None
    ) -> Dict[str, Any]:
        """
        Analizar PQRS con GPT-4.1-nano

        Returns:
            Diccionario con: introduccion, analisisGeneral, analisisTendencias,
                           analisisTiempos, recomendaciones, conclusiones
        """
        try:
            print(f"🤖 Solicitando análisis de IA con OpenAI (GPT-4.1-nano)...")

            prompt = self._construir_prompt(
                analytics, entity_name, fecha_inicio, fecha_fin, pqrs_list
            )

            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "Eres un analista experto en gestión pública colombiana "
                            "especializado en PQRS. Generas informes profesionales, "
                            "concisos y bien estructurados en español formal. "
                            "Sé directo y específico con los datos; evita repeticiones y citas normativas extensas."
                        )
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                max_tokens=4096,
                temperature=0.7
            )

            content = response.choices[0].message.content
            print(f"✅ Análisis IA con OpenAI completado ({len(content)} caracteres)")

            return self._parse_response(content)

        except Exception as e:
            print(f"❌ Error en OpenAI: {e}")
            raise

    def _construir_prompt(
        self,
        analytics: Dict,
        entity_name: str,
        fecha_inicio: str,
        fecha_fin: str,
        pqrs_list: List[Dict] = None
    ) -> str:
        """Construir prompt detallado"""

        tipos_str = "\n".join([
            f"  • {tipo.replace('_', ' ').title()}: {cant}"
            for tipo, cant in analytics.get('tiposPqrs', {}).items()
        ])

        # Construir indicadores para prompt (omitir filas con valor 0)
        indicadores_lines = [
            f"• Total PQRS: {analytics.get('totalPqrs', 0)}",
            f"• Pendientes: {analytics.get('pendientes', 0)}",
        ]
        if analytics.get('enProceso', 0) > 0:
            indicadores_lines.append(f"• En proceso: {analytics.get('enProceso', 0)}")
        indicadores_lines.append(f"• Resueltas: {analytics.get('resueltas', 0)}")
        if analytics.get('cerradas', 0) > 0:
            indicadores_lines.append(f"• Cerradas: {analytics.get('cerradas', 0)}")
        indicadores_lines.append(f"• Tasa resolución: {analytics.get('tasaResolucion', 0)}%")
        tiempo = analytics.get('tiempoPromedioRespuesta', 0)
        if tiempo > 0:
            indicadores_lines.append(f"• Tiempo promedio respuesta: {tiempo} días")
        indicadores_str = '\n'.join(indicadores_lines)

        prompt = f"""Analiza los datos de PQRS del {entity_name} para el período {fecha_inicio} a {fecha_fin}:

**INDICADORES CLAVE:**
{indicadores_str}

**DISTRIBUCIÓN POR TIPO:**
{tipos_str}

Genera un análisis profesional CONCISO con las siguientes secciones. Sé directo y específico con los datos. NO repitas información entre secciones.

1. **INTRODUCCIÓN EJECUTIVA** (exactamente 200 palabras, 3 párrafos, mencionar brevemente Ley 1755/2015 y Decreto 1166/2016 solo si es relevante, centrado en los datos del período)
2. **ANÁLISIS GENERAL** (máximo 200 palabras, analiza estados, tipos y tasa de resolución con los datos exactos)
3. **ANÁLISIS DE TIEMPOS DE RESPUESTA** (máximo 100 palabras, si tiempo promedio no está disponible indica que no se registra sistemaáticamente)
4. **RECOMENDACIONES** (exactamente 4 recomendaciones concretas, 2-3 oraciones cada una, sin numeración, sin prefijo)
5. **CONCLUSIONES** (máximo 150 palabras, 2 párrafos con las conclusiones más importantes)

Inicia directamente con el contenido de cada sección."""

        return prompt

    def _parse_response(self, content: str) -> Dict[str, Any]:
        """Parsear respuesta en estructura esperada"""

        sections = {
            'introduccion': '',
            'analisisGeneral': '',
            'analisisTiempos': '',
            'recomendaciones': [],
            'conclusiones': ''
        }

        lines = content.split('\n')
        current_section = None
        current_text = []

        section_map = {
            'introducción ejecutiva': 'introduccion',
            'introduccion ejecutiva': 'introduccion',
            'análisis general': 'analisisGeneral',
            'analisis general': 'analisisGeneral',
            'análisis de tiempos': 'analisisTiempos',
            'analisis de tiempos': 'analisisTiempos',
            'tiempos de respuesta': 'analisisTiempos',
            'recomendaciones': 'recomendaciones',
            'conclusiones': 'conclusiones',
        }

        for line in lines:
            raw = line.strip()
            # Solo detectar sección en líneas que parecen headers:
            # empiezan con #, o empiezan con ** y tienen menos de 80 chars, o son todo mayúsculas
            is_header = (
                raw.startswith('#') or
                (raw.startswith('**') and len(raw) < 80) or
                (raw.isupper() and len(raw) > 3 and len(raw) < 80)
            )
            line_lower = raw.lower().lstrip('#*123456789. ')
            matched = None
            if is_header:
                for key, val in section_map.items():
                    if key in line_lower:
                        matched = val
                        break

            if matched:
                if current_section and current_text:
                    self._save_section(sections, current_section, current_text)
                current_section = matched
                current_text = []
            elif current_section and raw:
                current_text.append(raw)

        if current_section and current_text:
            self._save_section(sections, current_section, current_text)

        return sections

    def _save_section(self, sections: Dict, section_name: str, text_lines: List[str]) -> None:
        """Guardar sección procesada"""
        if section_name == 'recomendaciones':
            # Recomendaciones como lista de strings
            sections[section_name] = [line.strip() for line in text_lines if line.strip()]
        else:
            # Otras secciones como texto unido con saltos de línea
            sections[section_name] = '\n'.join(line.strip() for line in text_lines if line.strip())


def get_openai_service() -> OpenAIService:
    """Factory para obtener instancia del servicio"""
    return OpenAIService()
