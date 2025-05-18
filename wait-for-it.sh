#!/usr/bin/env bash
# wait-for-it.sh - used to wait for a service to be available

set -e

host="$1"
shift
cmd="$@"

until nc -z "$host" 3306; do
  echo "Waiting for MySQL at $host:3306..."
  sleep 1
done

echo "MySQL is up - executing command"
exec $cmd
