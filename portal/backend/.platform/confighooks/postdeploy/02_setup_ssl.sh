#!/bin/bash
# Setup HTTPS with Let's Encrypt using DNS-01 challenge (Route 53)
# Runs after each EB deployment on Amazon Linux 2023
# Does NOT use set -e so SSL failures don't block the deployment
#
# IMPORTANTE: certbot corre en BACKGROUND para no retrasar el health check de EB.
# - Si el cert ya es válido por >30 días: solo recarga nginx con la config HTTPS existente.
# - Si el cert falta o está por vencer: lanza certbot en background y termina inmediatamente.

DOMAIN="api.softone360.com"
CERT_DIR="/etc/letsencrypt/live/${DOMAIN}"
NGINX_HTTPS_CONF="/etc/nginx/conf.d/https_api.conf"
EMAIL="admin@softone360.com"
RENEW_THRESHOLD_DAYS=30
LOG_FILE="/var/log/ssl-setup.log"

echo "=== SSL Setup: Starting ==="

# Función: escribir y aplicar config nginx HTTPS
apply_nginx_https_conf() {
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
    nginx -t 2>&1 && nginx -s reload 2>&1 && echo "✅ nginx recargado con HTTPS"
}

# Función: configurar cron de renovación
setup_renewal_cron() {
    cat > /etc/cron.d/certbot-renew << 'CRONEOF'
30 2 * * * root certbot renew --quiet --dns-route53 && nginx -s reload
CRONEOF
    chmod 644 /etc/cron.d/certbot-renew
}

# Verificar si el cert ya es válido por más de RENEW_THRESHOLD_DAYS días
cert_valid() {
    [ -f "${CERT_DIR}/fullchain.pem" ] && \
    openssl x509 -checkend $(( RENEW_THRESHOLD_DAYS * 86400 )) -noout -in "${CERT_DIR}/fullchain.pem" 2>/dev/null
}

if cert_valid; then
    echo "=== SSL Setup: Certificado válido por >${RENEW_THRESHOLD_DAYS} días. Aplicando config HTTPS... ==="
    apply_nginx_https_conf
    setup_renewal_cron
    echo "=== SSL Setup: Complete (certbot omitido) ==="
    exit 0
fi

# Cert ausente o por vencer: lanzar certbot en BACKGROUND para no bloquear el health check
echo "=== SSL Setup: Lanzando certbot en background (no bloquea el deploy) ==="
(
    exec >> "${LOG_FILE}" 2>&1
    echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Iniciando certbot en background..."

    # Detectar pip
    PIP_CMD=""
    for candidate in pip3 /usr/local/bin/pip3 /usr/bin/pip3; do
        if command -v "$candidate" > /dev/null 2>&1; then
            PIP_CMD="$candidate"
            break
        fi
    done

    # Instalar certbot si no está presente
    if ! command -v certbot > /dev/null 2>&1; then
        if [ -n "$PIP_CMD" ]; then
            $PIP_CMD install --quiet certbot certbot-dns-route53
        else
            echo "ERROR: pip no encontrado. SSL omitido."
            exit 1
        fi
    fi

    if ! command -v certbot > /dev/null 2>&1; then
        echo "ERROR: certbot no disponible tras instalación. SSL omitido."
        exit 1
    fi

    if [ ! -f "${CERT_DIR}/fullchain.pem" ]; then
        echo "Solicitando nuevo certificado para ${DOMAIN}..."
        certbot certonly \
            --dns-route53 \
            -d "${DOMAIN}" \
            --non-interactive \
            --agree-tos \
            --email "${EMAIL}"
        CERTBOT_EXIT=$?
    else
        echo "Renovando certificado existente..."
        certbot renew --quiet --dns-route53
        CERTBOT_EXIT=$?
    fi

    if [ $CERTBOT_EXIT -ne 0 ]; then
        echo "ERROR: certbot falló (código $CERTBOT_EXIT). HTTP sigue funcionando."
        exit 1
    fi

    echo "Certificado obtenido/renovado. Aplicando config nginx HTTPS..."
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
    nginx -t && nginx -s reload && echo "✅ nginx recargado con HTTPS"

    # Cron de renovación
    cat > /etc/cron.d/certbot-renew << 'CRONEOF'
30 2 * * * root certbot renew --quiet --dns-route53 && nginx -s reload
CRONEOF
    chmod 644 /etc/cron.d/certbot-renew
    echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] SSL setup completado en background."
) &

echo "=== SSL Setup: certbot lanzado en background (PID $!). Deploy continúa. ==="
echo "=== Ver progreso en: ${LOG_FILE} ==="
exit 0

