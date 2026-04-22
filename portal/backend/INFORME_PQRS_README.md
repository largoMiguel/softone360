# Sistema de Informes PQRS con Template PDF

## 📋 Resumen

Sistema completo de generación de informes PDF de PQRS en el **backend** con las siguientes características:

✅ **Generación en Backend** (Python/ReportLab)
✅ **Gráficos generados en Backend** (matplotlib)
✅ **Template PDF personalizado por entidad** (overlay)
✅ **Análisis con IA opcional** (OpenAI)
✅ **Almacenamiento en S3**
✅ **URLs pre-firmadas para descarga**

---

## 🚀 Componentes Implementados

### 1. **Modelo de Datos**
```python
# Entity model
pdf_template_url: str  # URL del template PDF en S3
```

### 2. **Servicio de Generación**
- `app/services/pqrs_report_generator.py`
- Genera gráficos con matplotlib
- Aplica overlay de template PDF institucional
- Estructura profesional con tablas e indicadores

### 3. **Endpoints API**

#### **Upload Template PDF (Superadmin)**
```http
POST /entities/{entity_id}/upload-pdf-template
Content-Type: multipart/form-data

file: [archivo.pdf]
```

**Validaciones:**
- Solo archivos PDF
- Tamaño máximo: 5 MB
- Se almacena en S3: `pdf-templates/{slug}/template_{timestamp}.pdf`

---

#### **Delete Template PDF (Superadmin)**
```http
DELETE /entities/{entity_id}/pdf-template
```

---

#### **Info Template PDF**
```http
GET /entities/{entity_id}/pdf-template-info
```

**Respuesta:**
```json
{
  "entity_id": 1,
  "entity_name": "Alcaldía de Chíquiza",
  "has_template": true,
  "template_url": "https://...",
  "file_size_mb": 0.85,
  "last_modified": "2026-04-18T10:30:00"
}
```

---

#### **Generar Informe PDF (Admin/Superadmin)**
```http
POST /pqrs/generar-informe-pdf
Content-Type: application/json

{
  "fecha_inicio": "2026-01-01",
  "fecha_fin": "2026-04-18",
  "estado": "resuelto",  // opcional
  "tipo": "peticion",    // opcional
  "usar_ia": true
}
```

**Respuesta:**
```json
{
  "success": true,
  "message": "Informe generado exitosamente",
  "file_url": "https://s3.../informe_2026-01-01_2026-04-18.pdf",
  "download_url": "https://s3.../presigned-url",
  "file_key": "informes-pqrs/chiquiza/informe_...",
  "file_size_mb": 2.5,
  "total_pqrs": 145,
  "tasa_resolucion": 87.5,
  "expires_in_days": 7,
  "used_template": true,
  "used_ai": true
}
```

---

## 📄 Estructura del Template PDF

### **Recomendaciones:**

1. **Tamaño:** Carta (8.5" x 11")
2. **Orientación:** Vertical (portrait)
3. **Contenido:**
   - Header con logo, nombre entidad, NIT, tabla informativa
   - Footer con contactos, dirección, website
4. **Formato:** PDF de 1 página (se repetirá en todas las páginas del informe)
5. **Márgenes:**
   - Superior: 1.2 pulgadas
   - Inferior: 1.0 pulgada
   - Laterales: 0.75 pulgadas

### **Ejemplo de Creación:**

1. Diseñar en Word/Photoshop/Canva
2. Exportar a PDF
3. Subir desde el panel de superadmin
4. Automáticamente se aplicará a todos los informes

---

## 📊 Contenido del Informe Generado

1. **Portada**
   - Título del informe
   - Nombre de la entidad
   - Fecha de generación

2. **Alcance**
   - Período del informe
   - Descripción del alcance

3. **Introducción**
   - Generada por IA o texto predeterminado

4. **Indicadores Generales** (Tabla)
   - Total PQRS
   - Pendientes, En Proceso, Resueltas, Cerradas
   - Tasa de Resolución
   - Tiempo Promedio de Respuesta

5. **Gráficos Estadísticos**
   - Distribución por Estado (pie chart)
   - Distribución por Tipo (bar chart)
   - Tendencia Mensual (line chart)

6. **Análisis General**
   - Texto generado por IA

7. **Análisis de Tendencias**
   - Con gráfico de tendencia mensual

8. **Recomendaciones**
   - Lista generada por IA

9. **Detalle de PQRS Recientes** (Tabla)
   - Primeras 20 PQRS
   - Radicado, Tipo, Estado, Fecha

10. **Conclusiones**
    - Generadas por IA

---

## 🔧 Instalación

### 1. **Instalar dependencias**
```bash
cd portal/backend
pip install -r requirements.txt
```

### 2. **Ejecutar migración**
```bash
python -m app.utils.migration_007_pdf_template
```

### 3. **Verificar S3**
- Bucket: `softone360-pqrs-archivos`
- Región: `us-east-1`
- Carpetas:
  - `pdf-templates/{slug}/` - Templates PDF
  - `informes-pqrs/{slug}/` - Informes generados

---

## 📝 Uso Paso a Paso

### **Para Superadmin:**

1. **Subir Template PDF**
   ```
   Panel Admin > Entidades > [Seleccionar Entidad] > "Subir Template PDF"
   ```

2. **Verificar Template**
   ```
   GET /entities/{id}/pdf-template-info
   ```

### **Para Admin de Entidad:**

1. **Generar Informe**
   ```
   Dashboard PQRS > Generar Informe > Seleccionar fechas > "Generar PDF"
   ```

2. **Descargar Informe**
   - El sistema retorna URL de descarga válida por 7 días
   - Click en el enlace para descargar

---

## 🎨 Personalización del Template

### **Opción A: Membrete Completo**
Subir PDF con encabezado y pie de página ya diseñados.

**Ventajas:**
- Diseño exacto como lo quieren
- Fácil de cambiar (solo subir nuevo PDF)
- Soporta elementos complejos (tablas, logos múltiples, etc.)

**Desventajas:**
- Cambiar un texto requiere nueva imagen/PDF

### **Opción B: Sin Template**
Si no se sube template, se genera con header/footer básicos.

---

## ⚙️ Configuración de IA

### **Habilitar/Deshabilitar IA**

```python
# Entity model
enable_ai_reports: bool  # True/False
```

Si `enable_ai_reports = False`, se usa análisis predeterminado sin costo de IA.

---

## 🧪 Testing

### **Test Manual:**

```bash
# 1. Subir template
curl -X POST "http://localhost:8000/entities/1/upload-pdf-template" \
  -H "Authorization: Bearer {token}" \
  -F "file=@membrete.pdf"

# 2. Generar informe
curl -X POST "http://localhost:8000/pqrs/generar-informe-pdf" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "fecha_inicio": "2026-01-01",
    "fecha_fin": "2026-04-18",
    "usar_ia": false
  }'
```

---

## 📦 Bibliotecas Usadas

- **reportlab** 4.0.7 - Generación de PDFs
- **matplotlib** 3.8.2 - Gráficos estadísticos
- **PyPDF2** 3.0.1 - Overlay de template
- **boto3** - Almacenamiento en S3
- **pillow** - Procesamiento de imágenes

---

## 🔒 Permisos

| Endpoint | Rol Requerido |
|----------|--------------|
| Upload Template | SUPERADMIN |
| Delete Template | SUPERADMIN |
| Info Template | ADMIN, SUPERADMIN |
| Generar Informe | ADMIN, SUPERADMIN |

---

## 🐛 Troubleshooting

### **Error: "Template no encontrado"**
- Verificar que `pdf_template_url` esté configurado en la entidad
- Verificar acceso a S3

### **Error: "No se encontraron PQRS"**
- Verificar rango de fechas
- Verificar filtros aplicados

### **PDF sin template (sin membrete)**
- Si falla el overlay, se genera PDF sin template
- Verificar logs del backend para ver el error exacto

### **Gráficos no aparecen**
- Verificar instalación de matplotlib
- Verificar logs: "Error generando gráficos"

---

## 🚧 Futuras Mejoras

- [ ] Generación async con notificación por email
- [ ] Historial de informes generados (tabla en BD)
- [ ] Exportación a Excel/DOCX además de PDF
- [ ] Programación de informes automáticos
- [ ] Preview del informe antes de generar
- [ ] Cache de informes generados recientemente

---

## 📞 Soporte

Para problemas o preguntas:
1. Revisar logs del backend
2. Verificar configuración de S3
3. Revisar permisos de usuario
4. Contactar al equipo de desarrollo

---

**Versión:** 1.0  
**Fecha:** 18 de abril de 2026  
**Autor:** Sistema SoftOne360
