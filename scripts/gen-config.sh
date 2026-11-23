#!/usr/bin/env sh
# Erzeugt config.js aus .env oder aus Umgebungsvariablen (z. B. GitHub-Secrets). Der anon-Key ist öffentlich gedacht – die Sicherheit liefert RLS.
set -e
[ -f .env ] && . ./.env
cat > config.js <<EOF
window.AW_CONFIG={SUPABASE_URL:"${SUPABASE_URL:-}",SUPABASE_ANON_KEY:"${SUPABASE_ANON_KEY:-}",SERVER_URL:"${SERVER_URL:-}"};
EOF
echo "config.js geschrieben"
