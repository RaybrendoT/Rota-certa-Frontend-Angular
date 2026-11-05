#!/bin/sh
# Gera assets/config/config.json a partir do ambiente do container:
# - API_BASE_URL (padrão: /api, mesma origem);
# - GOOGLE_MAPS_BROWSER_KEY: chave de navegador da Maps JavaScript API, restrita ao domínio
#   (não é a GOOGLE_MAPS_API_KEY de servidor do backend). Vazia = Mapa ao vivo sem mapa;
# - GOOGLE_MAPS_MAP_ID (padrão: DEMO_MAP_ID).
set -e
mkdir -p /usr/share/nginx/html/assets/config
printf '{"apiBaseUrl": "%s", "googleMapsApiKey": "%s", "googleMapsMapId": "%s"}\n' \
  "${API_BASE_URL:-/api}" "${GOOGLE_MAPS_BROWSER_KEY:-}" "${GOOGLE_MAPS_MAP_ID:-DEMO_MAP_ID}" \
  > /usr/share/nginx/html/assets/config/config.json
