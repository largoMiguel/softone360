# Informes PDM con Filtros y Control de Permisos

## 📋 Resumen de Cambios

Se ha actualizado el sistema de generación de informes PDM con las siguientes mejoras:

### ✅ Cambios Implementados

1. **Estructura General**
   - ❌ Removida personalización por entidad (logo_url, footer_text, report_code, plan_name)
   - ✅ Portada estándar con información de filtros aplicados
   - ✅ Encabezado/pie de página genérico

2. **Sistema de Filtros**
   - ✅ Filtrar por secretarías (múltiples)
   - ✅ Filtrar por rango de fechas (fecha_inicio, fecha_fin)
   - ✅ Filtrar por estados de actividades
   - ✅ Filtros aplicables a productos y actividades

3. **Control de Permisos por Rol**
   - ✅ **Admin/Super Admin**: Acceso completo, puede filtrar por cualquier secretaría
   - ✅ **Secretario**: Solo puede generar informes de su propia secretaría

---

## 🚀 Endpoints Disponibles

### 1. Obtener Filtros Disponibles

**GET** `/pdm/informes/{slug}/filtros`

Retorna los filtros disponibles según el rol del usuario.

**Respuesta:**
```json
{
  "secretarias": [
    {
      "id": 1,
      "nombre": "Secretaría de Educación",
      "email": "educacion@entidad.gov.co"
    }
  ],
  "estados": ["PENDIENTE", "EN_PROGRESO", "COMPLETADA", "CANCELADA"],
  "anios": [2024, 2025, 2026, 2027],
  "es_admin": true
}
```

**Permisos:**
- **Admin**: Ve todas las secretarías de la entidad
- **Secretario**: Solo ve su propia secretaría

---

### 2. Generar Informe PDF (Descarga)

**GET** `/pdm/informes/{slug}/generar/{anio}`

**Query Parameters:**
| Parámetro | Tipo | Requerido | Descripción |
|-----------|------|-----------|-------------|
| `secretaria_ids` | `List[int]` | No | IDs de secretarías a incluir |
| `fecha_inicio` | `string` | No | Fecha inicio (YYYY-MM-DD) |
| `fecha_fin` | `string` | No | Fecha fin (YYYY-MM-DD) |
| `estados` | `List[string]` | No | Estados de actividades |

**Ejemplos:**

```bash
# Informe completo (admin)
GET /pdm/informes/tulua/generar/2025

# Filtrar por secretaría específica
GET /pdm/informes/tulua/generar/2025?secretaria_ids=1

# Filtrar por múltiples secretarías
GET /pdm/informes/tulua/generar/2025?secretaria_ids=1&secretaria_ids=3

# Filtrar por rango de fechas
GET /pdm/informes/tulua/generar/2025?fecha_inicio=2025-01-01&fecha_fin=2025-06-30

# Filtrar por estados
GET /pdm/informes/tulua/generar/2025?estados=COMPLETADA&estados=EN_PROGRESO

# Combinación de filtros
GET /pdm/informes/tulua/generar/2025?secretaria_ids=1&fecha_inicio=2025-01-01&estados=COMPLETADA
```

**Respuesta:**
- Archivo PDF para descarga
- Nombre: `informe-pdm-{slug}-{anio}-{secretaria}-{fecha}.pdf`

**Permisos:**
- **Admin**: Puede usar todos los filtros libremente
- **Secretario**: Los filtros se aplican automáticamente a su secretaría (ignora parámetro `secretaria_ids`)

---

### 3. Vista Previa del Informe (Inline)

**GET** `/pdm/informes/{slug}/preview/{anio}`

Mismos parámetros que `/generar/` pero muestra el PDF inline en el navegador.

---

## 🔐 Lógica de Permisos

### Admin/Super Admin
```python
# Puede acceder a:
- Todas las secretarías
- Cualquier combinación de filtros
- Informes consolidados o específicos
```

### Secretario
```python
# Automáticamente filtrado por:
- Su secretaría asignada (secretaria_id en User)
- O secretaría encontrada por email/nombre
- No puede ver otras secretarías
```

### Validaciones
1. Si usuario no es admin y no tiene secretaría → **403 Forbidden**
2. Si no hay productos para los filtros → **404 Not Found**
3. Si entidad no existe → **404 Not Found**

---

## 📊 Estructura del Informe Generado

### Portada
- Título: "INFORME DE GESTIÓN {año}"
- Subtítulo: "PLAN DE DESARROLLO MUNICIPAL"
- Entidad: Nombre de la entidad
- **Información de filtros aplicados:**
  - Secretarías incluidas
  - Período (si aplica)
  - Estados (si aplica)

### Secciones
1. **Introducción** (texto genérico)
2. **Avance por Líneas Estratégicas** (gráfico + datos)
3. **Avance por Sectores MGA** (gráfico + datos)
4. **Avance por ODS** (gráfico + datos)
5. **Resumen de Productos** (tabla por línea)
6. **Detalle por Producto** (máx. 10 productos)
   - Actividades
   - Evidencias
   - Imágenes

### Encabezado/Pie
- **Encabezado:** Código estándar "FM-PDM-001", versión, página
- **Pie:** "Plan de Desarrollo Municipal - {Nombre Entidad}"

---

## 💡 Casos de Uso

### Caso 1: Admin - Informe Completo Anual
```bash
GET /pdm/informes/tulua/generar/2025
```
→ Genera informe con TODOS los productos y actividades del 2025

---

### Caso 2: Admin - Informe de Secretaría Específica
```bash
GET /pdm/informes/tulua/generar/2025?secretaria_ids=5
```
→ Solo productos/actividades de la Secretaría ID 5

---

### Caso 3: Admin - Informe Trimestral
```bash
GET /pdm/informes/tulua/generar/2025?fecha_inicio=2025-01-01&fecha_fin=2025-03-31
```
→ Solo actividades en el primer trimestre

---

### Caso 4: Secretario - Informe de su Secretaría
```bash
GET /pdm/informes/tulua/generar/2025
# Usuario: secretario@educacion.gov.co (Secretaría de Educación)
```
→ Automáticamente filtrado por Secretaría de Educación
→ No puede cambiar el filtro de secretaría

---

### Caso 5: Admin - Informe de Actividades Completadas
```bash
GET /pdm/informes/tulua/generar/2025?estados=COMPLETADA
```
→ Solo actividades en estado COMPLETADA

---

## 🔧 Integración Frontend

### Ejemplo: Obtener filtros disponibles
```typescript
async function obtenerFiltros(slug: string) {
  const response = await fetch(`/api/pdm/informes/${slug}/filtros`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await response.json();
  
  // data.es_admin → true/false
  // data.secretarias → Array de secretarías disponibles
  // data.estados → Array de estados
  // data.anios → Array de años
  
  return data;
}
```

### Ejemplo: Generar informe con filtros
```typescript
async function generarInforme(
  slug: string,
  anio: number,
  filtros: {
    secretariaIds?: number[],
    fechaInicio?: string,
    fechaFin?: string,
    estados?: string[]
  }
) {
  const params = new URLSearchParams();
  
  filtros.secretariaIds?.forEach(id => params.append('secretaria_ids', id.toString()));
  if (filtros.fechaInicio) params.append('fecha_inicio', filtros.fechaInicio);
  if (filtros.fechaFin) params.append('fecha_fin', filtros.fechaFin);
  filtros.estados?.forEach(e => params.append('estados', e));
  
  const url = `/api/pdm/informes/${slug}/generar/${anio}?${params}`;
  window.open(url, '_blank');
}
```

### Ejemplo: UI condicional por rol
```typescript
const { secretarias, es_admin } = await obtenerFiltros(slug);

if (es_admin) {
  // Mostrar selector de múltiples secretarías
  return <MultiSelect options={secretarias} />;
} else {
  // Mostrar solo la secretaría del usuario (readonly)
  return <Select options={secretarias} disabled />;
}
```

---

## 📝 Notas Técnicas

### Cambios en Entity Model
**Campos que YA NO se usan en informes:**
- `logo_url`
- `footer_text`
- `report_code`
- `report_version`
- `plan_name`

Estos campos pueden permanecer en la base de datos para otros usos, pero no afectan la generación de informes.

### Consultas Optimizadas
```python
# Eager loading para evitar N+1
productos = db.query(PdmProducto).options(
    joinedload(PdmProducto.responsable_secretaria)
).filter(...)

actividades = db.query(PdmActividad).options(
    joinedload(PdmActividad.evidencia),
    joinedload(PdmActividad.responsable_secretaria)
).filter(...)
```

### Nombre de Archivos
```
Formato: informe-pdm-{slug}-{anio}-{secretaria}-{fecha}.pdf

Ejemplos:
- informe-pdm-tulua-2025-2025-12-16.pdf
- informe-pdm-tulua-2025-Secretaría-de-Educa-2025-12-16.pdf
```

---

## ✅ Testing

### Test 1: Admin genera informe completo
```bash
curl -X GET "http://localhost:8000/api/pdm/informes/tulua/generar/2025" \
  -H "Authorization: Bearer {admin_token}" \
  --output informe-completo.pdf
```

### Test 2: Admin filtra por secretaría
```bash
curl -X GET "http://localhost:8000/api/pdm/informes/tulua/generar/2025?secretaria_ids=1" \
  -H "Authorization: Bearer {admin_token}" \
  --output informe-educacion.pdf
```

### Test 3: Secretario genera su informe
```bash
curl -X GET "http://localhost:8000/api/pdm/informes/tulua/generar/2025" \
  -H "Authorization: Bearer {secretario_token}" \
  --output informe-mi-secretaria.pdf
```

### Test 4: Secretario intenta acceder a otra secretaría (debe fallar)
```bash
curl -X GET "http://localhost:8000/api/pdm/informes/tulua/generar/2025?secretaria_ids=999" \
  -H "Authorization: Bearer {secretario_token}"
# Respuesta: Filtro ignorado, solo muestra su secretaría
```

---

## 🐛 Troubleshooting

### Error: "No tiene permisos para generar informes"
**Causa:** Usuario no es admin y no tiene secretaría asignada
**Solución:**
1. Asignar `secretaria_id` en el modelo User
2. O asegurar que `Secretaria.email` coincida con `User.email`

### Error: "No hay productos para los filtros especificados"
**Causa:** Filtros muy restrictivos o secretaría sin productos
**Solución:** Revisar que la secretaría tenga productos asignados en `PdmProducto.responsable_secretaria_id`

### Gráficos no se generan
**Causa:** Matplotlib sin configurar correctamente
**Solución:** Verificar que matplotlib use backend 'Agg' (ya implementado)

---

## 🔮 Futuras Mejoras

- [ ] Exportar a Excel además de PDF
- [ ] Informe comparativo entre secretarías
- [ ] Dashboard interactivo previo al PDF
- [ ] Programación de informes automáticos
- [ ] Envío por email
- [ ] Plantillas personalizables por entidad (opcional)

---

**Fecha de actualización:** 16 de diciembre de 2025
**Versión:** 2.0
