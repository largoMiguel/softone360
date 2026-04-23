# 🤖 Integración Bedrock - AWS Claude 3 Sonnet

## Descripción
Implementación de análisis de IA para informes PQRS usando **Amazon Bedrock** con **Claude 3 Sonnet**. 

La solución genera análisis profesionales y contextualizados de las métricas de PQRS, sin costos de API externas, leverageando infraestructura AWS nativa.

## Componentes

### 1. Servicio Bedrock (`backend/app/services/bedrock_ai_service.py`)
**Clase:** `BedrockAIService`

#### Métodos principales:
- **`analizar_pqrs(analytics, entity_name, fecha_inicio, fecha_fin, pqrs_list)`**
  - Genera análisis completo invocando Claude 3 via Bedrock
  - Retorna: `{introduccion, analisisGeneral, analisisTendencias, recomendaciones[], conclusiones}`
  - Tiempo: ~5-8 segundos por análisis
  - Costo: ~$0.015-0.03 USD por reporte

- **`_construir_prompt(analytics, entity_name, ...)`**
  - Formatea datos en prompt contextualizado
  - Incluye: métricas, indicadores, normas colombianas (Ley 1755/2015)
  - Solicita 6 secciones: Introducción, Análisis General, Tendencias, **Tiempos**, Recomendaciones, Conclusiones
  - ~1800 caracteres de contexto

- **`_parse_response(content)`**
  - Extrae secciones de respuesta de Claude
  - Detecta automáticamente: introducción, análisis general, tendencias, recomendaciones, conclusiones

#### Características:
- ✅ Autenticación nativa IAM (sin API keys)
- ✅ Modelos fondos en Bedrock: Claude 3 Sonnet (opción por defecto, Haiku como fallback)
- ✅ Lenguaje especializado en gestión pública colombiana
- ✅ Referencias a normativa: Ley 1474/2011, Ley 1755/2015
- ✅ Recomendaciones accionables con priorización

### 2. Integración en Endpoint PQRS
**Archivo:** `backend/app/routes/pqrs.py`

```python
# Línea ~1243: POST /pqrs/generar-informe-pdf
if request.usar_ia and entity.enable_ai_reports:
    bedrock_service = get_bedrock_service()
    ai_analysis = bedrock_service.analizar_pqrs(
        analytics=analytics,
        entity_name=entity.name,
        fecha_inicio=request.fecha_inicio,
        fecha_fin=request.fecha_fin,
        pqrs_list=pqrs_list
    )
```

**Comportamiento:**
- Si `usar_ia=true` y `entity.enable_ai_reports=true` → invoca Bedrock
- Si Bedrock falla → fallback a análisis genérico por defecto
- Análisis se incluye en PDF bajo secciones personalizadas

### 3. Permisos IAM
**Política:** `bedrock-invoke-model`
**Rol:** `aws-elasticbeanstalk-ec2-role`

```json
{
  "Effect": "Allow",
  "Action": [
    "bedrock:InvokeModel",
    "bedrock:InvokeModelWithResponseStream"
  ],
  "Resource": [
    "arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-3-sonnet*",
    "arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-3-haiku*"
  ]
}
```

## Flujo de Operación

```
Usuario solicita informe con IA
         ↓
Frontend: usar_ia=true → API
         ↓
Backend: generar_informe_pdf()
         ↓
Calcular analytics (totalPqrs, tasa resolución, etc.)
         ↓
[Si usar_ia=true] ↓
Bedrock: Invocar Claude 3 Sonnet
         ↓
Claude analiza métricas + normas colombianas
         ↓
Genera: Introducción + Análisis General + Tendencias + Recomendaciones + Conclusiones
         ↓
Parser: Extrae secciones y estructura
         ↓
[Fallback a genérico si error] ← Error handling
         ↓
PDF Generator: Integra análisis en informe
         ↓
S3: Upload informe PDF
         ↓
Frontend: Descarga presigned URL (7 días)
```

## Datos de Entrada (Claude 3)

```python
{
  'totalPqrs': int,
  'pendientes': int,
  'enProceso': int,
  'resueltas': int,
  'cerradas': int,
  'tasaResolucion': float,    # %
  'tiempoPromedioRespuesta': float,  # días
  'tiposPqrs': {
    'peticion': int,
    'queja': int,
    'reclamo': int,
    'solicitud': int
  },
  'entity_name': str,
  'fecha_inicio': str,
  'fecha_fin': str
}
```

## Salida (Análisis IA)

```python
{
  'introduccion': str,                    # 2-3 párrafos ejecutivos
  'analisisGeneral': str,                 # Análisis de métricas clave
  'analisisTendencias': str,              # Patrones identificados
  'analisisTiempos': str,                 # Análisis tiempos vs Ley 1755/2015 (15 días)
  'recomendaciones': List[str],           # 5 puntos accionables priorizados
  'conclusiones': str                     # Síntesis y perspectiva
}
```

## Estructura del PDF Generado

El informe PDF se organiza en las siguientes secciones:

1. **PORTADA** - Con trimestre automático y mes de generación
2. **INTRODUCCIÓN** - Marco legal y contexto
3. **OBJETIVO** - Propósito del informe
4. **ALCANCE** - Período y cobertura
5. **METODOLOGÍA** - Canales de recepción (4 canales)
6. **CANALES DE SERVICIO** - Información de contacto
7. **INFORME DE GESTIÓN INSTITUCIONAL** - Tabla de indicadores
8. **ANÁLISIS DE LA INFORMACIÓN** ⭐ (Sección principal con IA)
   - **Análisis General** (texto IA + contexto)
   - **Gráfica: Distribución por Estado** (pie chart)
   - **Gráfica: Distribución por Tipo** (bar chart)
   - **Análisis de Tendencias Temporales** (texto IA)
   - **Gráfica: Tendencias Mensuales** (line chart)
   - **Análisis de Tiempos de Respuesta** (texto IA comparando con Ley 1755/2015)
   - **RECOMENDACIONES** (5 puntos numerados generados por IA)
9. **DETALLE DE PQRS RECIENTES** - Tabla con últimas 20 PQRS
10. **CONCLUSIONES** - Síntesis final (IA)

## Costos

| Métrica | Valor |
|---------|-------|
| Tarifa Claude 3 Sonnet (Input) | $0.003 / 1K tokens |
| Tarifa Claude 3 Sonnet (Output) | $0.015 / 1K tokens |
| Tokens promedio por análisis | 1000 input + 300 output |
| **Costo por análisis** | **~$0.015-0.03 USD** |
| Mensual (50 informes/mes) | ~$0.75-1.50 USD |
| **Anual** | **~$9-18 USD** |

**Ventaja vs Alternativas:**
- OpenAI API: $0.05-0.15 por análisis (~$25-75/año)
- Google Vertex AI: ~$0.01-0.02 similar
- Bedrock: ✅ **Nativo en AWS, sin API keys, integración IAM, datos en AWS**

## Testing

```bash
cd portal
python3 test_bedrock.py
```

Salida esperada:
```
🧪 Test: Servicio Bedrock de IA

1️⃣ Verificando importación del servicio...
   ✅ Importación exitosa

2️⃣ Inicializando BedrockAIService...
   ✅ Servicio creado - Cliente: BedrockRuntime
   ✅ Modelo: anthropic.claude-3-sonnet-20240229-v1:0

...
✅ Todos los tests pasaron correctamente
```

## Deployment

```bash
cd portal
git add -A
git commit -m "feat(bedrock): Integrar AWS Bedrock con Claude 3"
git push origin main
bash deploy-production.sh
```

## Monitoreo

CloudWatch Logs:
```bash
# Ver logs de análisis de IA
aws logs tail /aws/elasticbeanstalk/softone-backend-useast1 --follow --grep "Bedrock\|🤖\|✅ Análisis"
```

## Configuración de Entidad

Para habilitar IA en una entidad:

```sql
UPDATE entities 
SET enable_ai_reports = true 
WHERE id = <entity_id>;
```

Frontend: Incluir checkbox "Usar análisis de IA" en modal de generación.

## Limitaciones y Futuros

✅ **Completado:**
- Integración Bedrock con Claude 3 Sonnet
- Análisis contextualizado a normativa colombiana
- Fallback a análisis genérico
- Política IAM configurada
- Test local funcional
- Deployment a producción

📅 **Próximas mejoras:**
- [ ] Dashboard de análisis históricos (tendencias de PQRS en el tiempo)
- [ ] Alertas basadas en IA (p.ej: aumento anómalo de quejas)
- [ ] Comparativas entre períodos (mes anterior vs actual)
- [ ] Export de análisis a formato Excel
- [ ] Integración con reporte de satisfacción ciudadana

## Soporte

Para debugging:

```python
# Habilitar logs verbosos en bedrock_ai_service.py
import logging
logging.basicConfig(level=logging.DEBUG)

# Ver respuesta raw de Bedrock
print(f"Raw response: {json.dumps(result, indent=2)}")
```

---
**Commit:** e49bebb  
**Fecha Implementación:** 2026-04-23  
**Estado:** ✅ **PRODUCCIÓN**
