#!/usr/bin/env bash
#
# T048 — Restore HSK Helper from a backup archive.
#
# Usage:
#   ./scripts/restore.sh <backup.tar.gz> [--confirm]
#
# WARNING: This overwrites the current database and assets.
# The --confirm flag is required to proceed.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DB_PATH="${DB_PATH:-$ROOT/data/app.db}"
ASSET_ROOT="${ASSET_ROOT:-$ROOT/data/assets}"
CONFIRM="${2:-}"

if [ $# -lt 1 ]; then
    echo "Usage: $0 <backup.tar.gz> [--confirm]"
    echo "  --confirm is required to overwrite current data"
    exit 1
fi

BACKUP_FILE="$1"
if [ ! -f "$BACKUP_FILE" ]; then
    echo "ERROR: Backup file not found: $BACKUP_FILE"
    exit 1
fi

if [ "$CONFIRM" != "--confirm" ]; then
    echo "WARNING: This will overwrite:"
    echo "  Database: $DB_PATH"
    echo "  Assets:   $ASSET_ROOT"
    echo ""
    echo "Add --confirm to proceed."
    exit 1
fi

TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

echo "[$(date)] Restoring from $BACKUP_FILE"

# Extract backup
tar -xzf "$BACKUP_FILE" -C "$TEMP_DIR"
BACKUP_DIR=$(ls -d "$TEMP_DIR"/*/ 2>/dev/null | head -1)
if [ -z "$BACKUP_DIR" ]; then
    # Single-level archive
    BACKUP_DIR="$TEMP_DIR"
fi

# Stop PM2 process if running
if command -v pm2 &>/dev/null; then
    pm2 stop hsk-helper 2>/dev/null || true
fi

# Restore database
if [ -f "$BACKUP_DIR/app.db" ]; then
    echo "  Restoring database..."
    mkdir -p "$(dirname "$DB_PATH")"
    # Save current DB as .pre-restore
    [ -f "$DB_PATH" ] && cp "$DB_PATH" "$DB_PATH.pre-restore"
    cp "$BACKUP_DIR/app.db" "$DB_PATH"
    # Clear WAL files
    rm -f "$DB_PATH-wal" "$DB_PATH-shm"
    echo "  Database restored."
else
    echo "  ERROR: No app.db found in backup"
    exit 1
fi

# Restore assets
if [ -d "$BACKUP_DIR/assets" ]; then
    echo "  Restoring assets..."
    mkdir -p "$ASSET_ROOT"
    rsync -a --delete "$BACKUP_DIR/assets/" "$ASSET_ROOT/"
    echo "  Assets restored."
else
    echo "  No assets in backup (skipping)"
fi

# Restart PM2 process
if command -v pm2 &>/dev/null; then
    pm2 restart hsk-helper 2>/dev/null || pm2 start ecosystem.config.cjs 2>/dev/null || true
fi

echo "[$(date)] Restore complete."
echo "  Verify with: curl http://localhost:${PORT:-3001}/health"
