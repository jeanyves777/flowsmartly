#!/bin/bash
# Setup script for FlowShop V2 Store Builder on production server
# Run this once after deploying the V2 code.
#
# Usage: ssh flowsmartly < scripts/setup-store-builder-server.sh

set -e

echo "=== FlowShop V2 Server Setup ==="

# 1. Create directories for generated stores
echo "[1/4] Creating store directories..."
mkdir -p /var/www/flowsmartly/generated-stores
mkdir -p /var/www/flowsmartly/stores-output
chown -R root:root /var/www/flowsmartly/generated-stores
chown -R root:root /var/www/flowsmartly/stores-output
echo "  Done: /var/www/flowsmartly/generated-stores/ and stores-output/"

# 2. Copy reference store to /opt/reference-store
echo "[2/4] Setting up reference store..."
if [ -d /opt/flowsmartly/reference-store/src ]; then
  rm -rf /opt/reference-store
  cp -r /opt/flowsmartly/reference-store /opt/reference-store
  echo "  Done: /opt/reference-store/"
else
  echo "  WARNING: reference-store not found in /opt/flowsmartly/ — skipping"
  echo "  Make sure reference-store/ is committed and pulled"
fi

# 3. Add nginx config for /stores/ static serving
echo "[3/4] Updating nginx config..."

# Check if stores location already exists
if grep -q '/stores/' /etc/nginx/sites-enabled/flowsmartly 2>/dev/null || grep -q '/stores/' /etc/nginx/sites-available/flowsmartly 2>/dev/null; then
  echo "  /stores/ location already configured in nginx — skipping"
else
  # Find the nginx config file
  NGINX_CONF=""
  if [ -f /etc/nginx/sites-enabled/flowsmartly ]; then
    NGINX_CONF="/etc/nginx/sites-enabled/flowsmartly"
  elif [ -f /etc/nginx/sites-available/flowsmartly ]; then
    NGINX_CONF="/etc/nginx/sites-available/flowsmartly"
  elif [ -f /etc/nginx/conf.d/flowsmartly.conf ]; then
    NGINX_CONF="/etc/nginx/conf.d/flowsmartly.conf"
  fi

  if [ -n "$NGINX_CONF" ]; then
    echo "  Found nginx config at: $NGINX_CONF"

    # Add stores location block before the last closing brace
    # This serves static store files at /stores/{slug}/
    STORES_CONFIG='
    # FlowShop V2 — static store files
    location ~ ^/stores/([^/]+)(/.*)?$ {
        alias /var/www/flowsmartly/stores-output/$1$2;
        try_files $uri $uri/index.html @store_fallback;
    }

    location @store_fallback {
        rewrite ^/stores/([^/]+)(/.*)?$ /stores/$1/404.html break;
        root /var/www/flowsmartly/stores-output;
    }
'
    # Insert before the last } in the server block
    # Use a temp file to avoid sed issues
    cp "$NGINX_CONF" "${NGINX_CONF}.bak"

    # Find the line number of the last closing brace
    LAST_BRACE=$(grep -n '}' "$NGINX_CONF" | tail -1 | cut -d: -f1)

    if [ -n "$LAST_BRACE" ]; then
      head -n $((LAST_BRACE - 1)) "$NGINX_CONF" > "${NGINX_CONF}.tmp"
      echo "$STORES_CONFIG" >> "${NGINX_CONF}.tmp"
      tail -n +"$LAST_BRACE" "$NGINX_CONF" >> "${NGINX_CONF}.tmp"
      mv "${NGINX_CONF}.tmp" "$NGINX_CONF"
      echo "  Added /stores/ location block to nginx config"
    else
      echo "  WARNING: Could not find closing brace in nginx config"
    fi

    # Test and reload nginx
    nginx -t && systemctl reload nginx
    echo "  nginx reloaded successfully"
  else
    echo "  WARNING: Could not find nginx config file"
    echo "  Please manually add the /stores/ location block"
  fi
fi

# 4. Verify setup
echo "[4/4] Verifying setup..."
echo "  generated-stores: $(ls -d /var/www/flowsmartly/generated-stores 2>/dev/null && echo 'OK' || echo 'MISSING')"
echo "  stores-output:    $(ls -d /var/www/flowsmartly/stores-output 2>/dev/null && echo 'OK' || echo 'MISSING')"
echo "  reference-store:  $(ls -d /opt/reference-store/src 2>/dev/null && echo 'OK' || echo 'MISSING')"
echo "  nginx config:     $(grep -l '/stores/' /etc/nginx/sites-enabled/* /etc/nginx/sites-available/* /etc/nginx/conf.d/* 2>/dev/null | head -1 || echo 'NOT CONFIGURED')"

echo ""
echo "=== Setup Complete ==="
echo "FlowShop V2 is ready. V1 stores will see an upgrade banner on their dashboard."
