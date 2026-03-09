#!/bin/sh
set -eu

echo "Starting in environment: ${DJANGO_ENV:-dev}"

echo "Running migrations..."
python manage.py migrate --noinput

BOOTSTRAP_MARKER="/app/.visualization_data_bootstrapped"
USER_DATA_MARKER="/app/.user_data_populated"

if [ "${IMPORT_VISUALIZATION_DATA:-true}" = "true" ]; then
  if [ ! -f "$BOOTSTRAP_MARKER" ]; then
    echo "Bootstrapping visualization mesh/population data..."
    python scripts/bootstrap_visualization_data.py
    touch "$BOOTSTRAP_MARKER"
  else
    echo "Visualization data already bootstrapped (marker exists)"
  fi
else
  echo "Skipping visualization bootstrap (IMPORT_VISUALIZATION_DATA=${IMPORT_VISUALIZATION_DATA})"
fi

if [ "${IMPORT_USER_DATA:-true}" = "true" ]; then
  if [ ! -f "$USER_DATA_MARKER" ]; then
    echo "Populating user ACL initial data..."
    python manage.py populate_initial_data
    touch "$USER_DATA_MARKER"
  else
    echo "User data already populated (marker exists)"
  fi
else
  echo "Skipping user data population (IMPORT_USER_DATA=${IMPORT_USER_DATA})"
fi

if [ "${DJANGO_ENV:-dev}" = "prod" ]; then
  python manage.py collectstatic --noinput
  CPU_CORES=$(nproc)

  DEFAULT_WORKERS=$((2 * CPU_CORES + 1))

  WORKERS="${WEB_CONCURRENCY:-$DEFAULT_WORKERS}"

  if [ "$WORKERS" -gt 40 ]; then
    WORKERS=40
  fi

  echo "Detected CPU: $CPU_CORES"
  echo "Gunicorn workers: $WORKERS"

  exec gunicorn mobilys_BE.wsgi:application --bind 0.0.0.0:8000 --workers "$WORKERS" --timeout 900 --keep-alive 5
else
  echo "Starting development server..."
  exec python manage.py runserver 0.0.0.0:8000
fi
