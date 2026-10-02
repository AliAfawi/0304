#!/usr/bin/env bash
# Runs the security tests on a throwaway local PostgreSQL (port 5499).
set -euo pipefail
cd "$(dirname "$0")/.."
PSQL="psql -h /tmp -p 5499 -U postgres -v ON_ERROR_STOP=1 -q"
$PSQL -c "drop database if exists clinic_test" -c "create database clinic_test"
$PSQL -d clinic_test -f test/supabase_stub.sql
$PSQL -d clinic_test -f supabase/schema.sql
$PSQL -d clinic_test -f test/test_security.sql 2>&1 | sed 's/^psql:[^ ]* NOTICE:  //'
