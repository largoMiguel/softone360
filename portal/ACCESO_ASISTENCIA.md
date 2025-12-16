# Acceso al Sistema de Control de Asistencia

## 🎯 Cómo Acceder

### Opción 1: Desde el Menú Lateral (Sidebar)

1. Iniciar sesión en el portal con usuario **Admin** o **Secretario**
2. En el menú lateral izquierdo, buscar la sección **"CONTROL DE ASISTENCIA"**
3. Click en **"Ingresar"**

### Opción 2: URL Directa

```
https://tu-dominio.com/{slug-entidad}/ventanilla
```

Ejemplo:
```
https://tu-dominio.com/chiquiza-boyaca/ventanilla
```

## 📍 Rutas Disponibles

Una vez dentro del módulo, encontrarás 4 secciones:

### 1. Dashboard
**URL:** `/{slug}/ventanilla/dashboard`

Muestra:
- Total de funcionarios registrados
- Entradas y salidas del día
- Funcionarios presentes actualmente
- Promedio de asistencia semanal
- Últimos 20 registros

### 2. Funcionarios
**URL:** `/{slug}/ventanilla/funcionarios`

Permite:
- Ver listado de funcionarios
- Crear nuevo funcionario
- Editar información de funcionario
- Activar/desactivar funcionarios
- Buscar por cédula o nombre

### 3. Registros
**URL:** `/{slug}/ventanilla/registros`

Permite:
- Ver historial de registros
- Filtrar por fecha
- Filtrar por tipo (entrada/salida)
- Ver fotos de los registros
- Exportar datos (próximamente)

### 4. Equipos
**URL:** `/{slug}/ventanilla/equipos`

Permite:
- Ver equipos autorizados
- Registrar nuevos equipos
- Ver UUID de cada equipo
- Activar/desactivar equipos

## 🔐 Permisos

### ¿Quién puede acceder?
- ✅ **SUPERADMIN**: Acceso total a todas las entidades
- ✅ **ADMIN**: Acceso a su entidad
- ✅ **SECRETARIO**: Acceso a su entidad
- ❌ **CIUDADANO**: No tiene acceso

### Nota Importante
Por defecto, el módulo está visible para todos los usuarios con rol Admin o Secretario. Si quieres restringir más el acceso, puedes:

1. Agregar un flag en la tabla `entities`:
```sql
ALTER TABLE entities ADD COLUMN enable_asistencia BOOLEAN DEFAULT TRUE;
```

2. Actualizar el código en `sidebar.component.ts`:
```typescript
asistenciaEnabled(): boolean { 
    return (this.entityContext.currentEntity as any)?.enable_asistencia ?? true; 
}
canAccessAsistencia(): boolean { 
    return this.asistenciaEnabled() && this.isAdmin(); 
}
```

## 🚀 Primeros Pasos

### 1. Registrar Equipos
Antes de poder usar la app de escritorio, debes registrar los equipos:

1. Instalar la app de escritorio en el equipo que usarás
2. Ejecutarla una vez para obtener el UUID
3. Copiar el UUID que aparece en pantalla
4. En el portal web, ir a: **Ventanilla > Equipos > Nuevo Equipo**
5. Pegar el UUID y dar un nombre descriptivo

### 2. Registrar Funcionarios
1. Ir a: **Ventanilla > Funcionarios > Nuevo Funcionario**
2. Ingresar datos del funcionario:
   - Cédula
   - Nombres
   - Apellidos
   - Email (opcional)
   - Teléfono (opcional)
   - Cargo (opcional)

### 3. Usar la App de Escritorio
1. Reiniciar la app de escritorio
2. Ahora debe mostrar "Equipo autorizado"
3. Los funcionarios ya pueden registrar su asistencia

## 🎨 Capturas de Pantalla

### Dashboard
![Dashboard](ruta/a/screenshot1.png)

### Gestión de Funcionarios
![Funcionarios](ruta/a/screenshot2.png)

### Registros
![Registros](ruta/a/screenshot3.png)

## 🐛 Problemas Comunes

### "No veo el menú de Asistencia"
- Verifica que tu usuario sea Admin o Secretario
- Limpia el caché del navegador
- Cierra sesión y vuelve a iniciar

### "Error al cargar los datos"
- Verifica que el backend esté corriendo
- Revisa la consola del navegador (F12)
- Verifica que las rutas API estén registradas

### "No puedo crear funcionarios"
- Verifica que tengas permisos de Admin/Secretario
- Verifica que la cédula no esté duplicada
- Revisa que todos los campos obligatorios estén llenos

## 📞 Soporte

Para reportar problemas o solicitar nuevas funcionalidades, contacta al administrador del sistema.
