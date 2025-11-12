# ⚡ Despliegue Rápido - 5 Minutos

**Usa esta guía si YA tienes todo configurado en tu equipo**

---

## 🚀 Despliegue en 5 Pasos

### Paso 1: Actualizar Código

```bash
cd ~/Documents/SOLUCTIONS
git pull origin main
```

### Paso 2: Compilar Frontend

```bash
cd ~/Documents/SOLUCTIONS/frontend
npm run build
```

### Paso 3: Desplegar Frontend a S3

```bash
sh deploy-to-s3.sh

# Output esperado:
# ✅ Despliegue completado!
# 🌐 URL: http://softone360-frontend-useast1.s3-website-us-east-1.amazonaws.com
```

### Paso 4: Desplegar Backend a EB

```bash
cd ~/Documents/SOLUCTIONS/backend
eb deploy

# O si tienes problema con EB:
zip -r backend-deployment.zip . -x "venv/*" ".git/*" "*.pyc"
# Luego subir a AWS Console manualmente
```

### Paso 5: Verificar

```bash
# Frontend
curl http://softone360-frontend-useast1.s3-website-us-east-1.amazonaws.com/

# Backend
curl https://softone360-backend-xxxxx.us-east-1.elasticbeanstalk.com/health
```

---

## ✅ Verificación Rápida

```bash
# Verificar que todo funciona
echo "✅ Verificando..."

# Frontend en S3
aws s3 ls s3://softone360-frontend-useast1/ | wc -l
echo "Frontend archivos en S3: ^^ (debe ser > 10)"

# Backend status
eb status
```

---

## 🔧 One-Liner para Despliegue Completo

```bash
cd ~/Documents/SOLUCTIONS/frontend && npm run build && sh deploy-to-s3.sh && cd ../backend && eb deploy
```

---

## 📊 Monitoreo Post-Deploy

```bash
# Ver logs del backend
eb logs

# Ver eventos recientes
eb status --verbose

# SSH al servidor EB
eb ssh
```

---

**Tiempo estimado:** 3-5 minutos (depende de tamaño de cambios)
