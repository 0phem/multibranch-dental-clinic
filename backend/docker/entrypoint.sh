#!/usr/bin/env bash
set -e

# Render injects $PORT (defaults to 10000 on Render)
PORT="${PORT:-10000}"
echo "==> Configuring Nginx to listen on port ${PORT}..."
sed -i "s/LISTEN_PORT/${PORT}/g" /etc/nginx/sites-available/default

# Ensure storage and bootstrap/cache permissions are correct
chown -R www-data:www-data /var/www/html/storage /var/www/html/bootstrap/cache
chmod -R 775 /var/www/html/storage /var/www/html/bootstrap/cache

# Create storage symlink if not already created
if [ ! -L /var/www/html/public/storage ]; then
    echo "==> Creating storage symlink..."
    php /var/www/html/artisan storage:link || true
fi

# Clear build-time caches so runtime env vars are picked up immediately
echo "==> Clearing cached configurations..."
php /var/www/html/artisan config:clear || true
php /var/www/html/artisan route:clear || true
php /var/www/html/artisan view:clear || true

# Optional auto-migration if AUTO_MIGRATE=true in Render environment
if [ "${AUTO_MIGRATE:-false}" = "true" ]; then
    echo "==> Running database migrations..."
    php /var/www/html/artisan migrate --force || true
fi

# Allow running custom commands (e.g. docker run ... php artisan test)
if [ "$#" -gt 0 ] && [ "$1" != "/usr/bin/supervisord" ]; then
    exec "$@"
fi

echo "==> Starting Supervisord (Nginx + PHP-FPM + Worker + Scheduler + Reverb)..."
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf
