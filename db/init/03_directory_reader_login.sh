#!/bin/sh
set -eu

: "${POSTGRES_DIRECTORY_PASSWORD:?Set POSTGRES_DIRECTORY_PASSWORD for the local directory API}"
: "${POSTGRES_MANAGEMENT_PASSWORD:?Set POSTGRES_MANAGEMENT_PASSWORD for the identity management API}"

psql \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  --set ON_ERROR_STOP=1 \
  --file /opt/drixel/002_directory_reader.sql

psql \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  --set ON_ERROR_STOP=1 \
  --file /opt/drixel/003_identity_management.sql

psql \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  --set ON_ERROR_STOP=1 \
  --set "directory_password=$POSTGRES_DIRECTORY_PASSWORD" <<'SQL'
SELECT format('ALTER ROLE drixel_directory_reader LOGIN PASSWORD %L', :'directory_password') \gexec
SQL

psql \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  --set ON_ERROR_STOP=1 \
  --set "management_password=$POSTGRES_MANAGEMENT_PASSWORD" <<'SQL'
SELECT format('ALTER ROLE drixel_management_api LOGIN PASSWORD %L', :'management_password') \gexec
SQL

if [ -n "${OIDC_BOOTSTRAP_ADMIN_EMAIL:-}" ] || [ -n "${OIDC_BOOTSTRAP_ADMIN_NAME:-}" ] \
  || [ -n "${OIDC_BOOTSTRAP_ADMIN_SUBJECT:-}" ]; then
  : "${OIDC_ISSUER:?Set OIDC_ISSUER before bootstrapping an administrator}"
  : "${OIDC_BOOTSTRAP_ADMIN_EMAIL:?Set OIDC_BOOTSTRAP_ADMIN_EMAIL}"
  : "${OIDC_BOOTSTRAP_ADMIN_NAME:?Set OIDC_BOOTSTRAP_ADMIN_NAME}"
  : "${OIDC_BOOTSTRAP_ADMIN_SUBJECT:?Set OIDC_BOOTSTRAP_ADMIN_SUBJECT}"
  psql \
    --username "$POSTGRES_USER" \
    --dbname "$POSTGRES_DB" \
    --set ON_ERROR_STOP=1 \
    --set "bootstrap_email=$OIDC_BOOTSTRAP_ADMIN_EMAIL" \
    --set "bootstrap_name=$OIDC_BOOTSTRAP_ADMIN_NAME" \
    --set "bootstrap_issuer=$OIDC_ISSUER" \
    --set "bootstrap_subject=$OIDC_BOOTSTRAP_ADMIN_SUBJECT" <<'SQL'
SELECT set_config('drixel.bootstrap_email', :'bootstrap_email', false);
SELECT set_config('drixel.bootstrap_name', :'bootstrap_name', false);
SELECT set_config('drixel.bootstrap_issuer', :'bootstrap_issuer', false);
SELECT set_config('drixel.bootstrap_subject', :'bootstrap_subject', false);
\i /opt/drixel/004_bootstrap_owner.sql
SQL
fi
