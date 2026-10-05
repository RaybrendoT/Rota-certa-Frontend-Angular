#!/bin/sh
# Gera assets/config/config.json a partir de API_BASE_URL (padrão: /api, mesma origem).
set -e
mkdir -p /usr/share/nginx/html/assets/config
printf '{"apiBaseUrl": "%s"}\n' "${API_BASE_URL:-/api}" > /usr/share/nginx/html/assets/config/config.json
