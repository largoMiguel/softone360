# Configuración DNS - softone360.com

## ✅ CONFIGURACIÓN FINAL

### Nameservers (Configurado en Squarespace)
```
ns-1333.awsdns-38.org
ns-821.awsdns-38.net
ns-1860.awsdns-40.co.uk
ns-259.awsdns-32.com
```

### Route 53
- **Zona hospedada:** Z05593881FHTGORGS0VRF
- **Registros DNS activos:**
  - softone360.com → A (ALIAS) → CloudFront ✅
  - www.softone360.com → A (ALIAS) → CloudFront ✅
  - softone360.com → AAAA (IPv6 ALIAS) → CloudFront ✅
  - www.softone360.com → AAAA (IPv6 ALIAS) → CloudFront ✅
  - api.softone360.com → CNAME → softone-backend-useast1.eba-epvnmbmk.us-east-1.elasticbeanstalk.com ✅

### CloudFront
- **Distribución ID:** E3OH65AY982GZ5
- **CloudFront URL:** d39d4iayhy9x2w.cloudfront.net
- **Certificado SSL:** e71bcd46-e3a6-4f40-8419-b9381dabf542
- **Dominios configurados:** softone360.com, www.softone360.com

### S3 Buckets
- **Bucket principal:** www.softone360.com (contenido del sitio)
- **Bucket redirect:** softone360.com (redirección HTTPS a www)

### Backend API
- **Elastic Beanstalk:** softone-backend-useast1.eba-epvnmbmk.us-east-1.elasticbeanstalk.com
- **Dominio:** https://api.softone360.com

---

## 🌐 URLs de Producción

- **Frontend:** https://www.softone360.com
- **Redirect:** https://softone360.com → https://www.softone360.com
- **API:** https://api.softone360.com/api

---

## ✅ Estado de Configuración

- ✅ Nameservers configurados en Squarespace
- ✅ Route 53 con registros DNS activos
- ✅ CloudFront con SSL configurado
- ✅ Certificados SSL activos y validados
- ✅ Frontend desplegado en S3
- ✅ Backend accesible vía api.softone360.com
- ✅ Redirección de apex domain a www configurada

---

## 📝 Comandos de Verificación

```bash
# Verificar nameservers (deben ser los de AWS Route 53)
nslookup -type=NS softone360.com

# Verificar resolución DNS
nslookup softone360.com
nslookup www.softone360.com

# Verificar HTTPS y SSL
curl -I https://www.softone360.com
curl -I https://api.softone360.com/api/health

# Limpiar caché DNS local (si es necesario)
sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder
```

3. Usa DNS públicos para probar:
   ```bash
   dig @8.8.8.8 softone360.com
   dig @1.1.1.1 softone360.com
   ```
