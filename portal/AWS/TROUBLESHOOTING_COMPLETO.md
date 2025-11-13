# 🔧 Troubleshooting Completo

## Problemas Comunes y Soluciones

---

## 🔴 Frontend

### Problem: "Port 4200 already in use"

```bash
# Opción 1: Matar proceso
lsof -i :4200
kill -9 <PID>

# Opción 2: Usar puerto diferente
ng serve --port 4201
```

### Problem: "node-sass build error"

```bash
# Solución
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Problem: "npm ERR! code EACCES"

```bash
# Arreglar permisos npm
sudo chown -R $(whoami) ~/.npm
rm -rf node_modules package-lock.json
npm install
```

### Problem: "dist folder not created after npm run build"

```bash
# Verificar
ls -la dist/

# Si no existe:
rm -rf dist/
npm run build -- --configuration production

# Verify build
ls -la dist/pqrs-frontend/
```

### Problem: "S3 deployment fails"

```bash
# 1. Verificar credenciales AWS
aws s3 ls

# 2. Si falla, reconfigurar
aws configure

# 3. Verificar bucket existe
aws s3 ls | grep softone360-frontend

# 4. Verificar permisos
aws s3api get-bucket-acl --bucket softone360-frontend-useast1

# 5. Probar upload manual
aws s3 cp dist/pqrs-frontend/index.html s3://softone360-frontend-useast1/

# 6. Si sigue fallando, revisar CORS
aws s3api get-bucket-cors --bucket softone360-frontend-useast1
```

---

## 🔴 Backend

### Problem: "Python: No module named 'flask'"

```bash
cd ~/Documents/SOLUCTIONS/backend

# Verificar venv está activado
which python
# Debe mostrar: .../venv/bin/python

# Si no:
source venv/bin/activate

# Reinstalar dependencias
pip install -r requirements.txt
```

### Problem: "Database connection error"

```bash
# 1. Verificar PostgreSQL está corriendo
psql --version
psql -U postgres -c "SELECT 1;"

# 2. Si no está corriendo
brew services start postgresql@15

# 3. Verificar variables de entorno
cat .env | grep DATABASE_URL

# 4. Probar conexión directa
psql postgres://usuario:contraseña@localhost:5432/pdm_db

# 5. Si no funciona, recrear BD
dropdb pdm_db
createdb pdm_db
psql pdm_db < backup.sql  # Si tienes backup
```

### Problem: "Cannot import app.main"

```bash
cd ~/Documents/SOLUCTIONS/backend

# Verificar estructura
ls -la app/
# Debe tener: __init__.py, main.py

# Si falta __init__.py:
touch app/__init__.py

# Verificar import en app/__init__.py
cat app/__init__.py
```

### Problem: "ModuleNotFoundError: No module named 'psycopg2'"

```bash
cd ~/Documents/SOLUCTIONS/backend
source venv/bin/activate

# Reinstalar
pip install psycopg2-binary
pip install -r requirements.txt
```

### Problem: "EB Deploy fails"

```bash
cd ~/Documents/SOLUCTIONS/backend

# 1. Ver último error
eb logs

# 2. SSH al servidor
eb ssh

# 3. Ver logs de la app
cat /var/log/eb-engine.log

# 4. Si todo falla, recrear ambiente
eb terminate
eb create
```

---

## 🔴 Git

### Problem: "Your branch is ahead of 'origin/main'"

```bash
# Esto es normal, significa que tienes commits locales
# Para push:
git push origin main

# Si hay conflictos:
git pull origin main
# Resolver conflictos
git add .
git commit -m "Merge conflicts resolved"
git push origin main
```

### Problem: "Permission denied (publickey)"

```bash
# Problema con SSH key de GitHub

# 1. Generar nueva key
ssh-keygen -t ed25519 -C "tu-email@gmail.com"

# 2. Añadir a ssh-agent
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/id_ed25519

# 3. Copiar clave pública a GitHub
# GitHub → Settings → SSH and GPG keys → New SSH key
cat ~/.ssh/id_ed25519.pub

# 4. Probar conexión
ssh -T git@github.com
```

### Problem: "Large files rejected by git"

```bash
# Si intentas hacer push de archivos > 100MB

# Solución: Usar Git LFS
brew install git-lfs
git lfs install

# Añadir archivos grandes
git lfs track "*.zip"
git add .gitattributes
git commit -m "Add Git LFS tracking"
git push
```

---

## 🔴 AWS

### Problem: "AWS CLI not found"

```bash
# Instalar
brew install awscli

# Verificar
aws --version
```

### Problem: "Invalid AWS credentials"

```bash
# Reconfigurar
aws configure

# Verificar credenciales
cat ~/.aws/credentials

# Probar acceso
aws s3 ls
```

### Problem: "Access denied to S3 bucket"

```bash
# Verificar permisos
aws s3api get-bucket-policy --bucket softone360-frontend-useast1

# Ver ACL
aws s3api get-bucket-acl --bucket softone360-frontend-useast1

# Ver si el usuario tiene permisos
aws iam get-user
```

### Problem: "EB environment not responding"

```bash
# 1. Ver estado
aws elasticbeanstalk describe-environments --region us-east-1

# 2. Verificar security group
aws ec2 describe-security-groups

# 3. Si necesita reiniciar
eb restart

# 4. Si sigue fallando, reconstruir
eb rebuild
```

---

## 🟡 Performance

### Slow Frontend Build

```bash
cd ~/Documents/SOLUCTIONS/frontend

# Limpiar caché
rm -rf dist/ .angular/

# Rebuilding con stats
ng build --stats-json

# Analizar tamaño
webpack-bundle-analyzer dist/pqrs-frontend/stats.json
```

### Slow Backend

```bash
# 1. Ver CPU/Memoria en EB
eb health

# 2. Ver logs de aplicación
eb logs --all

# 3. Optimizar queries en BD
# Conectarse a la BD y ejecutar:
EXPLAIN ANALYZE SELECT * FROM tabla_lenta;
```

---

## 📊 Debugging

### Ver logs completos

```bash
# Frontend
ng build --verbose

# Backend
FLASK_DEBUG=True flask run

# EB
eb logs --stream
```

### Ambiente de test

```bash
# Frontend
ng test

# Backend
pytest
```

---

## ✅ Checklist de Resolución

Antes de contactar soporte:

- [ ] Verificaste que el código está actualizado (git pull)
- [ ] Borraste caché (.angular/, node_modules/)
- [ ] Verificaste credenciales AWS (aws configure)
- [ ] Verificaste que la BD está corriendo
- [ ] Verificaste los logs (eb logs, npm error logs)
- [ ] Probaste en local (npm start, flask run)
- [ ] Verificaste CORS si es problema de API
- [ ] Probaste en navegador incógnito (limpiar caché)

---

**Versión:** 1.0  
**Última actualización:** 12 de Noviembre de 2025
