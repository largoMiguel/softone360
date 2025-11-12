# 🚀 Guía Completa de Configuración - Setup Inicial del Equipo

**Fecha:** 12 de Noviembre de 2025  
**Proyecto:** SOLUCTIONS (PDM - Plan de Desarrollo Municipal)  
**Repositorio:** https://github.com/largoMiguel/softone360

---

## 📋 Tabla de Contenidos

1. [Requisitos Previos](#requisitos-previos)
2. [Paso 1: Clonar el Repositorio](#paso-1-clonar-el-repositorio)
3. [Paso 2: Configurar Variables de Entorno](#paso-2-configurar-variables-de-entorno)
4. [Paso 3: Instalar Dependencias - Backend](#paso-3-instalar-dependencias---backend)
5. [Paso 4: Instalar Dependencias - Frontend](#paso-4-instalar-dependencias---frontend)
6. [Paso 5: Configurar AWS](#paso-5-configurar-aws)
7. [Paso 6: Configurar Bases de Datos](#paso-6-configurar-bases-de-datos)
8. [Paso 7: Desplegar Frontend a S3](#paso-7-desplegar-frontend-a-s3)
9. [Paso 8: Desplegar Backend a Elastic Beanstalk](#paso-8-desplegar-backend-a-elastic-beanstalk)
10. [Troubleshooting](#troubleshooting)

---

## ⚠️ Requisitos Previos

### Software Requerido

- **Node.js** v18+ (para Angular)
- **Python** 3.9+ (para Flask backend)
- **Git** (para versión control)
- **AWS CLI v2** (para deployments)
- **EB CLI** (Elastic Beanstalk Command Line)
- **pip** (gestor de paquetes Python)
- **PostgreSQL** (base de datos)
- **macOS/Linux** (se asume zsh como shell)

### Cuentas Requeridas

- Cuenta AWS (con permisos administrativos)
- GitHub (para acceso al repositorio)
- PostgreSQL local o RDS (remota)

---

## Paso 1: Clonar el Repositorio

### Desde Cero (Primera vez)

```bash
# Crear directorio de trabajo
mkdir -p ~/Documents
cd ~/Documents

# Clonar el repositorio
git clone https://github.com/largoMiguel/softone360.git SOLUCTIONS
cd SOLUCTIONS

# Verificar que estamos en la rama correcta
git branch -a
git checkout main
```

### Si Ya Tienes Clonado

```bash
cd ~/Documents/SOLUCTIONS

# Actualizar desde GitHub
git pull origin main

# Crear rama de trabajo local
git checkout -b desarrollo
```

---

## Paso 2: Configurar Variables de Entorno

### 2.1 Backend - Variables de Entorno

```bash
# Navegar a la carpeta backend
cd ~/Documents/SOLUCTIONS/backend

# Crear archivo .env
cat > .env << 'EOF'
# ========== DATABASE ==========
DATABASE_URL=postgresql://usuario:contraseña@localhost:5432/pdm_db
SQLALCHEMY_DATABASE_URI=postgresql://usuario:contraseña@localhost:5432/pdm_db

# ========== FLASK ==========
FLASK_ENV=development
FLASK_DEBUG=True
SECRET_KEY=tu-clave-secreta-super-larga-aqui

# ========== AWS ==========
AWS_ACCESS_KEY_ID=TU_ACCESS_KEY
AWS_SECRET_ACCESS_KEY=TU_SECRET_KEY
AWS_REGION=us-east-1
AWS_S3_BUCKET=softone360-frontend-useast1

# ========== CORS ==========
CORS_ALLOWED_ORIGINS=http://localhost:4200,http://localhost:3000,http://softone360-frontend-useast1.s3-website-us-east-1.amazonaws.com

# ========== EMAIL (Opcional para notificaciones) ==========
MAIL_SERVER=smtp.gmail.com
MAIL_PORT=587
MAIL_USE_TLS=True
MAIL_USERNAME=tu-email@gmail.com
MAIL_PASSWORD=tu-app-password
EOF

echo "✅ Archivo .env creado para backend"
```

**⚠️ IMPORTANTE:** 
- Reemplaza `usuario` y `contraseña` con credenciales reales
- Reemplaza AWS keys con tus claves reales
- Mantén `.env` en `.gitignore` (no debe estar en repositorio)

### 2.2 Frontend - Variables de Entorno

```bash
# Navegar a carpeta frontend
cd ~/Documents/SOLUCTIONS/frontend

# Crear ambiente de producción
cat > src/environments/environment.prod.ts << 'EOF'
export const environment = {
  production: true,
  apiUrl: 'https://api.tu-dominio.com'  // Cambiar a tu API
};
EOF

# Verificar ambiente de desarrollo
cat src/environments/environment.ts
# Debería tener: apiUrl: 'http://localhost:5000'
```

---

## Paso 3: Instalar Dependencias - Backend

### 3.1 Crear Virtual Environment (Python)

```bash
cd ~/Documents/SOLUCTIONS/backend

# Crear virtual environment
python3.9 -m venv venv

# Activar virtual environment
source venv/bin/activate

# Verificar que está activado (debería ver (venv) en el prompt)
which python
```

### 3.2 Instalar Dependencias Python

```bash
# Asegurar que pip está actualizado
pip install --upgrade pip

# Instalar dependencias desde requirements.txt
pip install -r requirements.txt

# Verificar instalación
pip list | grep -E "Flask|SQLAlchemy|psycopg2"
```

### 3.3 Configurar Base de Datos Backend

```bash
# Crear archivo de configuración de BD
cat > config/database_config.py << 'EOF'
import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    SQLALCHEMY_DATABASE_URI = os.getenv('DATABASE_URL', 'postgresql://localhost/pdm_db')
    SQLALCHEMY_ECHO = False
    SQLALCHEMY_TRACK_MODIFICATIONS = False

class DevelopmentConfig(Config):
    DEBUG = True
    TESTING = False

class ProductionConfig(Config):
    DEBUG = False
    TESTING = False

class TestingConfig(Config):
    TESTING = True
    SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'
EOF

echo "✅ Configuración de base de datos creada"
```

---

## Paso 4: Instalar Dependencias - Frontend

### 4.1 Instalar Node.js (si no lo tienes)

```bash
# Con Homebrew (macOS)
brew install node@18
brew link node@18

# O con nvm (recomendado)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 18
nvm use 18
nvm alias default 18
```

### 4.2 Instalar Dependencias Angular

```bash
cd ~/Documents/SOLUCTIONS/frontend

# Instalar Angular CLI global (si no lo tienes)
npm install -g @angular/cli@17

# Instalar dependencias del proyecto
npm install

# Verificar que se instaló correctamente
ng version
```

### 4.3 Compilar Frontend (Test)

```bash
# Build de desarrollo (rápido, para test)
npm run build

# Debería generar carpeta dist/pqrs-frontend
# Si ves errores, ejecuta:
npm audit fix
```

---

## Paso 5: Configurar AWS

### 5.1 Configurar AWS CLI

```bash
# Si no lo tienes, instálalo
brew install awscli

# Verificar versión
aws --version

# Configurar credenciales
aws configure

# Te pedirá:
# AWS Access Key ID: [TU_ACCESS_KEY]
# AWS Secret Access Key: [TU_SECRET_KEY]
# Default region: us-east-1
# Default output format: json
```

### 5.2 Verificar Configuración AWS

```bash
# Listar buckets S3
aws s3 ls

# Verificar que ves el bucket: softone360-frontend-useast1
# Si no lo ves, significa que no tienes permisos

# Listar ambientes de Elastic Beanstalk
aws elasticbeanstalk describe-environments --region us-east-1
```

### 5.3 Configurar EB CLI

```bash
# Instalar EB CLI
pip install awsebcli --upgrade --user

# Ir a carpeta backend
cd ~/Documents/SOLUCTIONS/backend

# Inicializar EB
eb init -p python-3.9 softone360-backend --region us-east-1 -i

# Te pedirá:
# Select a platform: Python 3.9
# Select an environment: [default]
# Continue with CodeCommit: n (selecciona No)

# Verificar configuración
eb status
```

---

## Paso 6: Configurar Bases de Datos

### 6.1 PostgreSQL Local

```bash
# Instalar PostgreSQL (macOS con Homebrew)
brew install postgresql@15

# Iniciar servicio
brew services start postgresql@15

# Crear base de datos
createdb pdm_db

# Crear usuario
psql -d pdm_db -c "CREATE USER pdm_user WITH PASSWORD 'tu-contraseña-aqui';"

# Dar permisos
psql -d pdm_db -c "ALTER ROLE pdm_user SET client_encoding TO 'utf8';"
psql -d pdm_db -c "ALTER ROLE pdm_user SET default_transaction_isolation TO 'read committed';"
psql -d pdm_db -c "ALTER ROLE pdm_user SET default_transaction_deferrable TO on;"
psql -d pdm_db -c "ALTER ROLE pdm_user SET default_transaction_deferrable TO on;"
psql -d pdm_db -c "GRANT ALL PRIVILEGES ON DATABASE pdm_db TO pdm_user;"

# Verificar conexión
psql -U pdm_user -d pdm_db -c "SELECT version();"
```

### 6.2 RDS (Base de Datos Remota en AWS)

```bash
# Si usas RDS en AWS:
# 1. Ve a AWS Console → RDS → Crear instancia
# 2. Selecciona PostgreSQL 15
# 3. Almacenamiento: db.t3.micro (free tier)
# 4. Nombre de BD: pdm_db
# 5. Usuario master: pdm_admin
# 6. Contraseña: [genera una fuerte]
# 7. Conectividad pública: SÍ
# 8. Security group: Permite inbound en puerto 5432

# Una vez creada, obtén el endpoint:
aws rds describe-db-instances --db-instance-identifier pdm-db --query 'DBInstances[0].Endpoint.Address'

# Actualiza .env con:
# DATABASE_URL=postgresql://pdm_admin:contraseña@pdm-db-endpoint.rds.amazonaws.com:5432/pdm_db
```

### 6.3 Ejecutar Migraciones

```bash
cd ~/Documents/SOLUCTIONS/backend

# Activar venv si no lo está
source venv/bin/activate

# Crear tablas (si usas Flask-Migrate)
flask db upgrade

# O si usas scripts personalizados:
python manage.py db upgrade
```

---

## Paso 7: Desplegar Frontend a S3

### 7.1 Compilar Frontend para Producción

```bash
cd ~/Documents/SOLUCTIONS/frontend

# Build de producción (optimizado)
npm run build

# Verificar que se creó dist/pqrs-frontend
ls -la dist/pqrs-frontend/
```

### 7.2 Script de Despliegue S3

```bash
# El proyecto ya tiene el script: deploy-to-s3.sh

# Dale permisos de ejecución
chmod +x ~/Documents/SOLUCTIONS/frontend/deploy-to-s3.sh

# Ejecutar despliegue
cd ~/Documents/SOLUCTIONS/frontend
sh deploy-to-s3.sh

# Debería ver:
# ✅ Despliegue completado!
# 🌐 URL: http://softone360-frontend-useast1.s3-website-us-east-1.amazonaws.com
```

### 7.3 Verificar Despliegue S3

```bash
# Listar archivos en S3
aws s3 ls s3://softone360-frontend-useast1/

# Verificar acceso desde navegador:
# http://softone360-frontend-useast1.s3-website-us-east-1.amazonaws.com

# Si no funciona, verifica CORS:
aws s3api get-bucket-cors --bucket softone360-frontend-useast1
```

---

## Paso 8: Desplegar Backend a Elastic Beanstalk

### 8.1 Compilar Backend

```bash
cd ~/Documents/SOLUCTIONS/backend

# El backend ya está listo (es Python/Flask)
# Solo asegúrate de que todos los cambios están en git

git status
git add .
git commit -m "Preparar para despliegue"
```

### 8.2 Desplegar con EB CLI

```bash
cd ~/Documents/SOLUCTIONS/backend

# Ver ambientes disponibles
eb list

# Desplegar (opción recomendada - sin EB CLI)
# Ver siguiente sección

# O si tienes EB CLI configurado:
eb deploy

# Monitorear el despliegue
eb status
eb logs
```

### 8.3 Despliegue Manual (Recomendado)

```bash
# Para evitar problemas con EB CLI, despliegue manual:

# 1. Empaquetar backend
cd ~/Documents/SOLUCTIONS/backend
zip -r backend-deployment.zip . -x "venv/*" ".git/*" "*.pyc" "__pycache__/*"

# 2. Crear versión en Elastic Beanstalk desde AWS Console:
# - Ir a: AWS Console → Elastic Beanstalk → Aplicación
# - Clic en "Upload and Deploy"
# - Seleccionar archivo backend-deployment.zip
# - Descripción: v1.0-$(date +%Y%m%d)
# - Clic en Deploy

# 3. Monitorear desde AWS Console
```

### 8.4 Verificar Backend

```bash
# Una vez desplegado, obtener URL:
aws elasticbeanstalk describe-environments \
  --application-name softone360 \
  --query 'Environments[0].CNAME'

# Resultado será algo como: softone360-backend-xxxxx.us-east-1.elasticbeanstalk.com

# Probar endpoint:
curl https://softone360-backend-xxxxx.us-east-1.elasticbeanstalk.com/health

# Debería retornar:
# {"status": "ok"}
```

---

## 📝 Checklist de Configuración

- [ ] Git clonado correctamente
- [ ] Variables de entorno configuradas (.env)
- [ ] Python venv activado
- [ ] Dependencias backend instaladas (pip install -r requirements.txt)
- [ ] Base de datos PostgreSQL creada y accesible
- [ ] Migraciones ejecutadas (flask db upgrade)
- [ ] AWS CLI configurado (aws configure)
- [ ] Node.js v18+ instalado
- [ ] Dependencias frontend instaladas (npm install)
- [ ] Frontend compila sin errores (npm run build)
- [ ] EB CLI configurado (eb init)
- [ ] Bucket S3 accesible (aws s3 ls)
- [ ] Frontend desplegado a S3
- [ ] Backend desplegado a Elastic Beanstalk
- [ ] URLs accesibles y funcionando

---

## 🔄 Workflow de Desarrollo Diario

### Iniciar Sesión de Desarrollo

```bash
# 1. Ir a la carpeta del proyecto
cd ~/Documents/SOLUCTIONS

# 2. Activar ambiente Python (backend)
cd backend
source venv/bin/activate

# 3. En otra terminal - Frontend
cd ~/Documents/SOLUCTIONS/frontend
npm start  # Inicia servidor de desarrollo en http://localhost:4200
```

### Hacer Cambios y Desplegar

```bash
# Backend:
cd ~/Documents/SOLUCTIONS/backend
# ... hacer cambios ...
git add .
git commit -m "Descripción del cambio"
git push origin main
# Luego hacer deploy manual a EB

# Frontend:
cd ~/Documents/SOLUCTIONS/frontend
# ... hacer cambios ...
git add .
git commit -m "Descripción del cambio"
git push origin main
npm run build
sh deploy-to-s3.sh
```

---

## 🐛 Troubleshooting

### Error: "No module named 'flask'"

```bash
cd ~/Documents/SOLUCTIONS/backend

# Verificar venv está activado
which python  # Debe mostrar ruta con venv

# Si no:
source venv/bin/activate

# Reinstalar dependencias
pip install -r requirements.txt
```

### Error: "Cannot find database"

```bash
# Verificar PostgreSQL está corriendo
brew services list | grep postgresql

# Si no está corriendo:
brew services start postgresql@15

# Verificar credenciales en .env
# Asegúrate que DATABASE_URL es correcto
```

### Error: "S3 upload fails"

```bash
# Verificar AWS CLI está configurado
aws s3 ls

# Si falla, volver a configurar:
aws configure

# Verificar permisos S3
aws s3api get-bucket-acl --bucket softone360-frontend-useast1
```

### Error: "ng: command not found"

```bash
# Instalar Angular CLI globalmente
npm install -g @angular/cli@17

# Verificar instalación
ng version
```

### Error: "Port 5000 is already in use"

```bash
# Encontrar proceso usando puerto 5000
lsof -i :5000

# Matar proceso
kill -9 <PID>

# O usar puerto diferente:
FLASK_ENV=development FLASK_DEBUG=True flask run --port 5001
```

### Error: "Node version mismatch"

```bash
# Instalar versión correcta con nvm
nvm install 18
nvm use 18

# Verificar
node --version  # Debe ser v18.x.x
```

---

## 📊 Estructura de Proyecto

```
SOLUCTIONS/
├── backend/                    # Flask API
│   ├── venv/                  # Virtual environment
│   ├── app/                   # Aplicación Flask
│   ├── requirements.txt       # Dependencias Python
│   ├── .env                   # Variables de entorno
│   ├── .ebextensions/        # Configuración EB
│   └── Procfile              # Instrucciones para EB
│
├── frontend/                   # Angular App
│   ├── node_modules/         # Dependencias npm
│   ├── src/                  # Código fuente
│   ├── dist/                 # Build compilado
│   ├── package.json          # Dependencias npm
│   ├── angular.json          # Config Angular
│   ├── deploy-to-s3.sh      # Script despliegue S3
│   └── src/environments/    # Variables de ambiente
│
├── AWS/                       # Documentación AWS
│   ├── DEPLOYMENT_GUIDE.md
│   ├── SETUP_GUIA_COMPLETA.md (este archivo)
│   └── ...
│
└── .git/                      # Git repository
```

---

## 🚀 Despliegue Rápido (Un Comando)

Una vez configurado todo, usa este script para desplegar todo:

```bash
cat > ~/Documents/SOLUCTIONS/deploy-all.sh << 'EOF'
#!/bin/bash

echo "🚀 Iniciando despliegue completo..."

# 1. Desplegar Frontend
echo "📱 Desplegando Frontend..."
cd ~/Documents/SOLUCTIONS/frontend
npm run build
sh deploy-to-s3.sh

# 2. Desplegar Backend
echo "🔧 Desplegando Backend..."
cd ~/Documents/SOLUCTIONS/backend
eb deploy

echo "✅ Despliegue completado!"
echo "🌐 Frontend: http://softone360-frontend-useast1.s3-website-us-east-1.amazonaws.com"
echo "🔌 Backend: $(eb status | grep CNAME)"
EOF

chmod +x ~/Documents/SOLUCTIONS/deploy-all.sh

# Usar:
~/Documents/SOLUCTIONS/deploy-all.sh
```

---

## 📞 Soporte y Recursos

- **Documentación Angular:** https://angular.io/docs
- **Documentación Flask:** https://flask.palletsprojects.com/
- **AWS Documentation:** https://docs.aws.amazon.com/
- **PostgreSQL Docs:** https://www.postgresql.org/docs/

---

## ✅ Notas Finales

1. **Seguridad:** Nunca hagas commit de archivos `.env`
2. **Backups:** Realiza backups regulares de la base de datos
3. **Logs:** Revisa logs en AWS CloudWatch para problemas
4. **Actualizaciones:** Actualiza dependencias regularmente con `npm update` y `pip install --upgrade`
5. **Testing:** Ejecuta pruebas antes de desplegar

---

**Última actualización:** 12 de Noviembre de 2025  
**Versión:** 1.0  
**Autor:** Equipo de Desarrollo SOLUCTIONS
