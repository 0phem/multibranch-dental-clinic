# Production Dockerfile for Laravel 13 on Render.com (PHP 8.3 + Nginx + Supervisord)
FROM php:8.3-fpm-bookworm

ENV DEBIAN_FRONTEND=noninteractive

# Install system dependencies, Nginx and Supervisor
RUN apt-get update && apt-get install -y --no-install-recommends \
    nginx \
    supervisor \
    curl \
    git \
    unzip \
    libpq-dev \
    libzip-dev \
    libpng-dev \
    libjpeg-dev \
    libfreetype6-dev \
    libicu-dev \
    libonig-dev \
    libxml2-dev \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install official PHP extension installer
COPY --from=mlocati/php-extension-installer:latest /usr/bin/install-php-extensions /usr/local/bin/

# Install required PHP extensions:
# - pdo_pgsql, pgsql (Supabase PostgreSQL)
# - zip, gd, intl, bcmath
# - pcntl, posix (required for Reverb & Queue worker signals)
# - opcache (performance)
RUN install-php-extensions \
    pdo_pgsql \
    pgsql \
    zip \
    gd \
    intl \
    bcmath \
    pcntl \
    posix \
    opcache

# Install Composer
COPY --from=composer:2 /usr/bin/composer /usr/local/bin/composer

WORKDIR /var/www/html

# Copy composer definition files first to leverage Docker layer caching
COPY composer.json composer.lock ./

# Install composer production dependencies
RUN composer install --no-dev --no-interaction --prefer-dist --optimize-autoloader --no-scripts

# Copy the application code
COPY . .

# Run package discover and optimize autoloader
RUN composer dump-autoload --optimize --no-dev

# Copy configuration files
COPY docker/nginx.conf /etc/nginx/sites-available/default
COPY docker/supervisord.conf /etc/supervisor/conf.d/supervisord.conf
COPY docker/php.ini /usr/local/etc/php/conf.d/custom.ini
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh

RUN chmod +x /usr/local/bin/entrypoint.sh

# Ensure storage and bootstrap directories exist and are writable
RUN mkdir -p storage/framework/cache/data storage/framework/sessions storage/framework/views storage/logs bootstrap/cache \
    && chown -R www-data:www-data storage bootstrap/cache \
    && chmod -R 775 storage bootstrap/cache

EXPOSE 10000 8080

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
