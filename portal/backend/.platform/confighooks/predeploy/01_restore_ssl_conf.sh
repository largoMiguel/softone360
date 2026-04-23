#!/bin/bash
# Escribe el nginx HTTPS config ANTES de que nginx reinicie en config-updates (eb setenv).
# Sin set -e: no debe bloquear el deploy si SSL falla.

DOMAIN="api.softone360.com"
CERT_DIR="/etc/letsencrypt/live/${DOMAIN}"
NGINX_HTTPS_CONF="/etc/nginx/conf.d/https_api.conf"

echo "=== confighook predeploy: SSL conf restore ==="

if [ -f "${CERT_DIR}/fullchain.pem" ] && openssl x509 -checkend 0 -noout -in "${CERT_DIR}/fullchain.pem" 2>/dev/null; then
    cat > "${NGINX_HTTPS_CONF}" << NGINXCONF
server {
    listen 443 ssl;
    server_name ${DOMAIN};

    ssl_certificate     ${CERT_DIR}/fullchain.pem;
    ssl_certificate_key ${CERT_DIR}/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    client_max_body_size 50M;
    proxy_connect_timeout 300;
    proxy_send_timeout    300;
    proxy_read_timeout    300;

    location / {
        proxy_pass         http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header   Host \$host;
        proxy_set_header   X-Real-IP \$remote_addr;
        proxy_set_header   X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto https;
        proxy_buffer_size       128k;
        proxy_buffers       4   256k;
        proxy_busy_buffers_size 256k;
    }
}
NGINXCONF
    echo "✅ HTTPS nginx config restaurada antes del reinicio de nginx"
else
    rm -f "${NGINX_HTTPS_CONF}"
    echo "⚠️ Certificado no encontrado o expirado — config HTTPS omitida para evitar fallo de nginx"
fi

exit 0
