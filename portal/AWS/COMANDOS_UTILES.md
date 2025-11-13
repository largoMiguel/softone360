# 📋 Comandos Útiles - Referencia Rápida

## 🔵 Git

```bash
# Ver estado
git status

# Actualizar código
git pull origin main

# Hacer cambios
git add .
git commit -m "Descripción del cambio"

# Enviar a GitHub
git push origin main

# Ver historial
git log --oneline -10

# Deshacer último commit (no pushado aún)
git reset --soft HEAD~1

# Ver diferencias
git diff
```

## 🟢 Frontend

```bash
cd ~/Documents/SOLUCTIONS/frontend

# Instalar dependencias
npm install

# Actualizar dependencias
npm update

# Servidor de desarrollo
npm start
# O: ng serve --open

# Compilar producción
npm run build

# Ver tamaño de bundle
ng build --stats-json

# Ejecutar tests
npm test

# Linting
ng lint

# Desplegar a S3
sh deploy-to-s3.sh
```

## 🟣 Backend

```bash
cd ~/Documents/SOLUCTIONS/backend

# Activar virtual environment
source venv/bin/activate

# Desactivar
deactivate

# Instalar dependencias
pip install -r requirements.txt

# Actualizar dependencias
pip install --upgrade -r requirements.txt

# Servidor de desarrollo
FLASK_ENV=development FLASK_DEBUG=True flask run
# Acceder: http://localhost:5000

# Ejecutar tests
pytest

# Migraciones BD
flask db init
flask db migrate -m "Descripción"
flask db upgrade

# Ver variables de entorno
cat .env
```

## 🟠 AWS S3

```bash
# Listar buckets
aws s3 ls

# Listar contenido del bucket
aws s3 ls s3://softone360-frontend-useast1/

# Subir archivo
aws s3 cp archivo.html s3://softone360-frontend-useast1/

# Subir carpeta
aws s3 sync dist/pqrs-frontend/ s3://softone360-frontend-useast1/ --delete

# Descargar archivo
aws s3 cp s3://softone360-frontend-useast1/index.html .

# Ver permisos
aws s3api get-bucket-acl --bucket softone360-frontend-useast1

# Ver CORS
aws s3api get-bucket-cors --bucket softone360-frontend-useast1

# Ver policy
aws s3api get-bucket-policy --bucket softone360-frontend-useast1
```

## 🟡 AWS Elastic Beanstalk

```bash
cd ~/Documents/SOLUCTIONS/backend

# Inicializar (primera vez)
eb init -p python-3.9 softone360-backend --region us-east-1

# Ver ambientes
eb list

# Estado del ambiente
eb status

# Desplegar
eb deploy

# SSH al servidor
eb ssh

# Ver logs
eb logs
eb logs --stream  # En tiempo real

# Abrir en navegador
eb open

# Escalar
eb scale 2  # 2 instancias

# Cambiar configuración
eb config

# Crear ambiente
eb create my-env

# Terminar ambiente
eb terminate

# Recrear
eb rebuild

# Reiniciar
eb restart
```

## 🔵 PostgreSQL

```bash
# Conectar a BD
psql -U usuario -d pdm_db

# Conectar desde .env
psql postgres://usuario:contraseña@localhost:5432/pdm_db

# Ver bases de datos
\l

# Ver tablas
\dt

# Ver esquema de tabla
\d nombre_tabla

# Ejecutar query
SELECT * FROM usuarios LIMIT 10;

# Backup
pg_dump pdm_db > backup.sql

# Restore
psql pdm_db < backup.sql

# Salir
\q

# Verificar conexión
psql -U postgres -c "SELECT version();"

# Crear BD nueva
createdb nueva_bd

# Eliminar BD
dropdb pdm_db
```

## 🟣 Docker (Opcional)

```bash
# Construir imagen
docker build -t softone360-backend .

# Ejecutar container
docker run -p 5000:5000 softone360-backend

# Ver containers corriendo
docker ps

# Detener container
docker stop <CONTAINER_ID>

# Ver logs
docker logs <CONTAINER_ID>

# Limpiar (remover containers)
docker system prune
```

## 🟠 Monitoreo

```bash
# Usar espacio en disco
du -sh ~/Documents/SOLUCTIONS/

# Procesos corriendo
ps aux | grep -E "node|python|postgres"

# Puertos en uso
lsof -i -P -n | grep LISTEN

# Top en tiempo real
top -l 1 | head -20

# Memory usage
vm_stat
```

## 🔧 Node Version Manager (NVM)

```bash
# Listar versiones disponibles
nvm list

# Instalar versión
nvm install 18

# Usar versión
nvm use 18

# Versión por defecto
nvm alias default 18

# Ver versión actual
node --version
```

## 🟡 npm

```bash
# Ver versión
npm --version

# Listar paquetes globales
npm list -g --depth=0

# Limpiar caché
npm cache clean --force

# Audit de seguridad
npm audit

# Arreglar vulnerabilidades
npm audit fix

# Ver tabla de dependencias
npm ls
```

## 📊 Útiles

```bash
# Abrir carpeta en VS Code
code ~/Documents/SOLUCTIONS

# Abrir carpeta en Finder
open ~/Documents/SOLUCTIONS

# Terminal en carpeta actual
cd ~/Documents/SOLUCTIONS && zsh

# Crear archivo .gitignore
echo "node_modules/\nvenv/\n.env\n.angular/\ndist/" > .gitignore

# Ver tamaño de carpeta
du -sh ~/Documents/SOLUCTIONS/node_modules
```

## 🚀 One-Liners Útiles

```bash
# Despliegue completo
cd ~/Documents/SOLUCTIONS/frontend && npm run build && sh deploy-to-s3.sh && cd ../backend && eb deploy

# Backup de BD
pg_dump pdm_db | gzip > pdm_db_$(date +%Y%m%d_%H%M%S).sql.gz

# Borrar caché de compilación
rm -rf ~/Documents/SOLUCTIONS/frontend/{dist,.angular} ~/Documents/SOLUCTIONS/backend/{venv,__pycache__}

# Ver último commit
git log -1 --oneline

# Contar líneas de código
find ~/Documents/SOLUCTIONS -name "*.ts" -o -name "*.py" | xargs wc -l
```

---

**Versión:** 1.0  
**Última actualización:** 12 de Noviembre de 2025
