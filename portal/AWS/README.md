# 📚 Documentación AWS - SOLUCTIONS

**Guías completas para configurar, desplegar y mantener el proyecto**

---

## 📋 Índice de Guías

### 🚀 **Para Empezar**

1. **[SETUP_GUIA_COMPLETA.md](./SETUP_GUIA_COMPLETA.md)** ⭐ **COMIENZA AQUÍ**
   - Configuración desde cero después de formatear el equipo
   - Paso a paso: clonar repo, instalar dependencias, configurar AWS
   - Requisitos previos, variables de entorno, bases de datos
   - Despliegue manual a S3 y Elastic Beanstalk
   - **Duración:** 30-60 minutos

### ⚡ **Despliegues Rápidos**

2. **[DEPLOYMENT_RAPIDO.md](./DEPLOYMENT_RAPIDO.md)**
   - Para cuando ya está todo configurado
   - Despliegue en 5 pasos
   - One-liners para despliegue automático
   - **Duración:** 3-5 minutos

### 📖 **Referencias Rápidas**

3. **[COMANDOS_UTILES.md](./COMANDOS_UTILES.md)**
   - Referencia de comandos por sección
   - Git, Frontend, Backend, AWS, PostgreSQL, Docker
   - One-liners útiles
   - Perfecta para tener abierta mientras trabajas

### 🔧 **Solución de Problemas**

4. **[TROUBLESHOOTING_COMPLETO.md](./TROUBLESHOOTING_COMPLETO.md)**
   - Problemas comunes y soluciones
   - Frontend, Backend, Git, AWS
   - Performance, Debugging
   - Checklist de resolución

---

## 🎯 Guías por Escenario

### Scenario 1: Tu equipo fue formateado

```
1. Lee: SETUP_GUIA_COMPLETA.md (30-60 min)
2. Sigue paso a paso todas las secciones
3. Al final: npm start (frontend) + flask run (backend)
4. Desplegar: DEPLOYMENT_RAPIDO.md
```

### Scenario 2: Ya está configurado, necesito desplegar

```
1. Lee: DEPLOYMENT_RAPIDO.md (5 min)
2. O usa el one-liner:
   cd ~/Documents/SOLUCTIONS/frontend && npm run build && sh deploy-to-s3.sh && cd ../backend && eb deploy
```

### Scenario 3: Algo no funciona

```
1. Lee: TROUBLESHOOTING_COMPLETO.md
2. Busca tu problema específico
3. Sigue la solución paso a paso
4. Si persiste, revisa: COMANDOS_UTILES.md para diagnosticar
```

### Scenario 4: Necesito un comando rápido

```
1. Abre: COMANDOS_UTILES.md
2. Ctrl+F para buscar el comando
3. Copia y ejecuta
```

---

## 📊 Archivos de Configuración

Además de estas guías, hay otros archivos de referencia:

- **DEPLOYMENT_GUIDE.md** - Guía general de despliegue (antigua)
- **CONFIGURACION_RDS_ACCESO_DIRECTO.md** - Configurar RDS
- **GUIA_MIGRACIONES_RDS.md** - Migrar bases de datos
- **MIGRATION_USEAST1_COMPLETE.md** - Migración us-east-1 completa

---

## 🔑 Credenciales Necesarias

Antes de comenzar, asegúrate de tener:

### AWS
- [ ] AWS Access Key ID
- [ ] AWS Secret Access Key
- [ ] Bucket S3: `softone360-frontend-useast1`
- [ ] Elastic Beanstalk environment configurado

### GitHub
- [ ] SSH Key configurada
- [ ] Acceso al repo: `largoMiguel/softone360`

### PostgreSQL
- [ ] Usuario y contraseña de BD (local o RDS)
- [ ] Host y puerto (localhost:5432 o RDS endpoint)

### Node/Python
- [ ] Node.js v18+
- [ ] Python 3.9+

---

## 📱 URLs del Proyecto

Una vez desplegado:

- **Frontend:** http://softone360-frontend-useast1.s3-website-us-east-1.amazonaws.com
- **Backend:** https://softone360-backend-xxxxx.us-east-1.elasticbeanstalk.com
- **GitHub:** https://github.com/largoMiguel/softone360

---

## 📞 Estructura del Proyecto

```
SOLUCTIONS/
├── AWS/                           ← Documentación (ESTA CARPETA)
│   ├── SETUP_GUIA_COMPLETA.md    ← ⭐ COMIENZA AQUÍ
│   ├── DEPLOYMENT_RAPIDO.md
│   ├── COMANDOS_UTILES.md
│   ├── TROUBLESHOOTING_COMPLETO.md
│   └── ... (otras guías)
│
├── backend/                       ← API Flask
│   ├── app/
│   ├── venv/
│   ├── requirements.txt
│   ├── .env                       ← NO commitear
│   └── Procfile
│
├── frontend/                      ← Angular App
│   ├── src/
│   ├── dist/
│   ├── node_modules/
│   ├── package.json
│   └── deploy-to-s3.sh
│
└── .git/                          ← Repositorio Git
```

---

## ✅ Checklist Rápido

Antes de desplegar:

- [ ] Git clonado: `~/Documents/SOLUCTIONS`
- [ ] `.env` creado en `backend/`
- [ ] Variables de entorno configuradas
- [ ] `npm install` ejecutado (frontend)
- [ ] `pip install -r requirements.txt` ejecutado (backend)
- [ ] PostgreSQL accesible
- [ ] AWS CLI configurado
- [ ] `npm run build` sin errores
- [ ] S3 bucket accesible
- [ ] EB environment accesible

---

## 🔄 Workflow Diario

```bash
# Iniciar desarrollo
cd ~/Documents/SOLUCTIONS/backend && source venv/bin/activate
cd ~/Documents/SOLUCTIONS/frontend && npm start

# Hacer cambios
# ... editar archivos ...

# Commitear
git add .
git commit -m "Descripción del cambio"

# Desplegar (cuando listo)
cd ~/Documents/SOLUCTIONS/frontend && npm run build && sh deploy-to-s3.sh
cd ../backend && eb deploy
```

---

## 🆘 Ayuda Rápida

| Problema | Solución Rápida |
|----------|-----------------|
| No sé por dónde empezar | Lee: **SETUP_GUIA_COMPLETA.md** |
| Necesito desplegar ya | Lee: **DEPLOYMENT_RAPIDO.md** |
| Algo no funciona | Lee: **TROUBLESHOOTING_COMPLETO.md** |
| ¿Qué comando necesito? | Lee: **COMANDOS_UTILES.md** |
| Olvido la estructura | Mira: Este archivo (README.md) |

---

## 📅 Última Actualización

- **Fecha:** 12 de Noviembre de 2025
- **Versión:** 1.0
- **Autor:** Equipo SOLUCTIONS
- **Estado:** ✅ Completo y probado

---

## 🎓 Aprende Más

- [Angular Docs](https://angular.io/docs)
- [Flask Docs](https://flask.palletsprojects.com/)
- [AWS Docs](https://docs.aws.amazon.com/)
- [PostgreSQL Docs](https://www.postgresql.org/docs/)

---

## 💡 Tips

1. **Guarda esta carpeta en favoritos** - La consultarás frecuentemente
2. **Imprime COMANDOS_UTILES.md** - Útil para referencia rápida
3. **Haz backup de .env** - Aunque no lo commitees a git
4. **Lee TROUBLESHOOTING_COMPLETO.md** - Antes de reportar un bug

---

¡Bienvenido a SOLUCTIONS! 🚀
