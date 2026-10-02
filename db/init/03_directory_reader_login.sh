#!/bin/sh
set -eu

: "${POSTGRES_DIRECTORY_PASSWORD:?Set POSTGRES_DIRECTORY_PASSWORD for the local directory API}"

psql \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  --set ON_ERROR_STOP=1 \
  --file /opt/drixel/002_directory_reader.sql

psql \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  --set ON_ERROR_STOP=1 \
  --set "directory_password=$POSTGRES_DIRECTORY_PASSWORD" <<'SQL'
SELECT format('ALTER ROLE drixel_directory_reader LOGIN PASSWORD %L', :'directory_password') \gexec
SQL
