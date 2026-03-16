#!/bin/bash
# Setup HTTPS with Let's Encrypt using DNS-01 challenge (Route 53)
# Runs after each EB deployment on Amazon Linux 2023
# Does NOT use set -e so SSL failures don't block the deployment

DOMAIN="api.softone360.com"
CERT_DIR="/etc/letsencrypt/live/${DOMAIN}"
NGINX_HTTPS_CONF="/etc/nginx/conf.d/https_api.conf"
EMAIL="admin@softone360.com"

echo "=== SSL Setup: Starting ==="

# On AL2023 + EB Python 3.11, pip3 is at /usr/local/bin/pip3
PIP_CMD=""
for candidate in pip3 /usr/local/bin/pip3 /usr/bin/pip3; do
    if command -v "$candidate" > /dev/null 2>&1; then
        PIP_CMD="$candidate"
        break
    fi
done

# Install certbot with Route53 DNS plugin
if ! command -v certbot > /dev/null 2>&1; then
    echo "Installing certbot via pip..."
    if [ -n "$PIP_CMD" ]; then
        $PIP_CMD install --quiet certbot certbot-dns-route53 2>&1
    else
        echo "ERROR: pip not found. SSL setup skipped."
        exit 0
    fi
    if ! command -v certbot > /dev/null 2>&1; then
        echo "ERROR: certbot not in PATH after install. SSL setup skipped."
        exit 0
    fi
fi

# Request or renew the certificate (certbot 5.x: no --dns-route53-propagation-seconds flag)
if [ ! -f "${CERT_DIR}/fullchain.pem" ]; then
    echo "Requesting new Let's Encrypt certificate for ${DOMAIN}..."
    certbot certonly \
        --dns-route53 \
        -d "${DOMAIN}" \
        --non-interactive \
        --agree-tos \
        --email "${EMAIL}" 2>&1
    CERTBOT_EXIT=$?
    if [ $CERTBOT_EXIT -ne 0 ]; then
        echo "ERROR: certbot failed (exit code $CERTBOT_EXIT). HTTP will continue to work."
        exit 0
    fi
    echo "Certificate obtained successfully."
else
    echo "Certificate already exists. Checking renewal..."
    certbot renew --quiet --dns-route53 2>&1 || echo "Renewal check failed (non-fatal)"
fi

# Write the nginx HTTPS server block
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

echo "nginx HTTPS config written to ${NGINX_HTTPS_CONF}"

# Test and reload nginx
nginx -t 2>&1 && nginx -s reload 2>&1 && echo "✅ nginx reloaded with HTTPS config"

# Setup auto-renewal cron (daily at 02:30 UTC)
cat > /etc/cron.d/certbot-renew << 'CRONEOF'
30 2 * * * root certbot renew --quiet --dns-route53 && nginx -s reload
CRONEOF
chmod 644 /etc/cron.d/certbot-renew

echo "=== SSL Setup: Complete ==="
