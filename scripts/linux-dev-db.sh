#!/usr/bin/env bash
# Linux bulut/ajan ortamı için: sistem PostgreSQL'ini root olmayan "dev" kullanıcısıyla 5433'te başlatır.
# embedded-postgres root altında çalışmaz; Windows/macOS geliştiricilerinin buna ihtiyacı yok (npm run dev yeter).
set -euo pipefail
PGBIN=$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | tail -1)
[ -n "$PGBIN" ] || { echo "Sistem PostgreSQL bulunamadı (apt-get install postgresql)."; exit 1; }
id dev >/dev/null 2>&1 || useradd -m dev
DATA=/home/dev/pg/data
if [ ! -d "$DATA" ]; then
  mkdir -p /home/dev/pg && chown -R dev /home/dev/pg
  su dev -c "$PGBIN/initdb -D $DATA -U postgres --auth=trust" >/dev/null
fi
su dev -c "$PGBIN/pg_ctl -D $DATA status" >/dev/null 2>&1 || su dev -c "$PGBIN/pg_ctl -D $DATA -o '-p 5433 -k /tmp' -l /home/dev/pg/log start" >/dev/null
DB=${1:-kampus}
psql -h 127.0.0.1 -p 5433 -U postgres -tc "SELECT 1 FROM pg_database WHERE datname='$DB'" | grep -q 1 || psql -h 127.0.0.1 -p 5433 -U postgres -qc "CREATE DATABASE $DB"
echo "DATABASE_URL=postgres://postgres@127.0.0.1:5433/$DB"
