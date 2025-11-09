"""
Logging especializado para monitoreo de costos de OpenAI API
"""
import logging
import json
from datetime import datetime
from typing import Dict, Any, Optional
from pythonjsonlogger import jsonlogger
import os

class OpenAIAPILogger:
    """Logger especializado para registrar uso de OpenAI API"""
    
    def __init__(self, log_file: str = "logs/openai_api.log"):
        """
        Inicializa el logger para OpenAI API
        
        Args:
            log_file: Ruta del archivo de log
        """
        # Crear directorio si no existe
        os.makedirs(os.path.dirname(log_file), exist_ok=True)
        
        # Configurar logger
        self.logger = logging.getLogger("openai_api")
        self.logger.setLevel(logging.INFO)
        
        # Handler con formato JSON
        handler = logging.FileHandler(log_file)
        formatter = jsonlogger.JsonFormatter()
        handler.setFormatter(formatter)
        self.logger.addHandler(handler)
        
        # También agregar console handler para desarrollo
        console_handler = logging.StreamHandler()
        console_formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        console_handler.setFormatter(console_formatter)
        self.logger.addHandler(console_handler)
    
    def log_api_call(
        self,
        user_id: str,
        entity_name: Optional[str],
        model: str,
        prompt_tokens: int,
        completion_tokens: int,
        total_tokens: int,
        cost_usd: float,
        status: str = "success"
    ) -> None:
        """
        Registra una llamada a OpenAI API
        
        Args:
            user_id: ID del usuario que realizó la llamada
            entity_name: Nombre de la entidad (opcional)
            model: Modelo usado (ej: gpt-4, gpt-3.5-turbo)
            prompt_tokens: Tokens en el prompt
            completion_tokens: Tokens en la respuesta
            total_tokens: Total de tokens
            cost_usd: Costo estimado en USD
            status: Estado de la llamada (success, error, etc)
        """
        log_data = {
            "timestamp": datetime.utcnow().isoformat(),
            "user_id": user_id,
            "entity_name": entity_name,
            "api_endpoint": "/contratacion/summary",
            "model": model,
            "tokens": {
                "prompt": prompt_tokens,
                "completion": completion_tokens,
                "total": total_tokens
            },
            "cost_usd": cost_usd,
            "status": status
        }
        
        self.logger.info(json.dumps(log_data))
    
    def log_error(
        self,
        user_id: str,
        error_message: str,
        error_type: str
    ) -> None:
        """Registra errores en llamadas a OpenAI"""
        log_data = {
            "timestamp": datetime.utcnow().isoformat(),
            "user_id": user_id,
            "api_endpoint": "/contratacion/summary",
            "error_type": error_type,
            "error_message": error_message,
            "status": "error"
        }
        
        self.logger.error(json.dumps(log_data))

class CostAnalyzer:
    """Analizador de costos de OpenAI API"""
    
    # Precios de OpenAI (actualizar según cambios)
    PRICING = {
        "gpt-4": {
            "input": 0.00003,      # $0.03 por 1K tokens
            "output": 0.00006      # $0.06 por 1K tokens
        },
        "gpt-4-turbo": {
            "input": 0.00001,      # $0.01 por 1K tokens
            "output": 0.00003      # $0.03 por 1K tokens
        },
        "gpt-3.5-turbo": {
            "input": 0.0000005,    # $0.50 por 1M tokens
            "output": 0.0000015    # $1.50 por 1M tokens
        }
    }
    
    @staticmethod
    def calculate_cost(
        model: str,
        prompt_tokens: int,
        completion_tokens: int
    ) -> Dict[str, float]:
        """
        Calcula el costo de una llamada a OpenAI
        
        Args:
            model: Modelo usado
            prompt_tokens: Tokens en el prompt
            completion_tokens: Tokens en la respuesta
        
        Returns:
            Dict con desglose de costos
        """
        pricing = CostAnalyzer.PRICING.get(model, CostAnalyzer.PRICING["gpt-3.5-turbo"])
        
        input_cost = (prompt_tokens / 1000) * pricing["input"]
        output_cost = (completion_tokens / 1000) * pricing["output"]
        total_cost = input_cost + output_cost
        
        return {
            "input_cost": round(input_cost, 6),
            "output_cost": round(output_cost, 6),
            "total_cost": round(total_cost, 6),
            "tokens": {
                "prompt": prompt_tokens,
                "completion": completion_tokens,
                "total": prompt_tokens + completion_tokens
            }
        }

# Instancia global
openai_logger = OpenAIAPILogger()
