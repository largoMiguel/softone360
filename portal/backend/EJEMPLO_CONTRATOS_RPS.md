# Ejemplo de Estructura de Excel para Contratos RPS

## 📋 Columnas Requeridas

| PRODUCTO | NO CDP | CONCEPTO | VALOR | AÑO | CONTRATISTA (Opcional) |
|----------|--------|----------|-------|-----|------------------------|
| 4003018 | CDP-001 | Suministro de materiales | 50000000 | 2025 | Empresa ABC SAS |
| 4003018 | CDP-001 | Suministro de materiales | 25000000 | 2025 | Empresa ABC SAS |
| 4003018 | CDP-002 | Servicios de consultoría | 30000000 | 2025 | Consultor XYZ |
| 4003019 | CDP-003 | Obras civiles | 120000000 | 2025 | Constructora DEF |

## 🔍 Explicación

**El sistema agrupa automáticamente por NO CDP**, por lo que:

- CDP-001 tendrá un valor total de: **$75,000,000** (suma de las dos filas)
- CDP-002 tendrá un valor de: **$30,000,000**
- CDP-003 tendrá un valor de: **$120,000,000**

## ✅ Reglas Importantes

1. **PRODUCTO**: Debe coincidir exactamente con el código del producto en el PDM
2. **NO CDP**: Identificador único del contrato (se agrupan valores iguales)
3. **VALOR**: Valor numérico sin formato (sin puntos, comas ni símbolos de moneda)
4. **AÑO**: Año fiscal del contrato (2024-2027)
5. **CONCEPTO**: Descripción breve del contrato (se toma el primero si hay múltiples)

## 🎯 Ejemplo Real

```
PRODUCTO    | NO CDP        | CONCEPTO                                      | VALOR      | AÑO  | CONTRATISTA
------------|---------------|-----------------------------------------------|------------|------|-------------------
4003018     | CDP-2025-001  | SUMINISTRO DE ELEMENTOS DEPORTIVOS            | 35000000   | 2025 | DEPORTES SUR SAS
4003018     | CDP-2025-001  | SUMINISTRO DE ELEMENTOS DEPORTIVOS (ADICIONAL)| 15000000   | 2025 | DEPORTES SUR SAS
4003018     | CDP-2025-015  | MANTENIMIENTO ESCENARIOS DEPORTIVOS          | 80000000   | 2025 | CONSTRUCTORA XYZ
4003019     | CDP-2025-020  | DOTACIÓN INSTITUCIONES EDUCATIVAS            | 120000000  | 2025 | PAPELERIA ABC
```

**Resultado en el sistema:**
- CDP-2025-001: $50,000,000 (agrupado)
- CDP-2025-015: $80,000,000
- CDP-2025-020: $120,000,000

## 📤 Cómo Cargar

1. Ir al módulo PDM
2. Vista Dashboard → Abrir producto
3. En "Información Adicional" aparecerán los contratos RPS
4. Admin puede cargar archivo desde el menú superior

## ⚠️ Notas

- Solo usuarios **Admin** y **SuperAdmin** pueden cargar archivos
- La carga es por año (reemplaza datos existentes del mismo año)
- Los formatos aceptados son: `.xlsx`, `.xls`, `.csv`
