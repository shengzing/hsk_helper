#!/usr/bin/env bash
#
# T048 — Backup HSK Helper database and assets.
#
# Usage:
#   ./scripts/backup.sh [backup_dir]
#
# Default backup dir: ./backups/YYYY-MM-DD_HHMMSS
#
# Cron example (daily at 02:00):
#   0 2 * * * cd /path/to/hsk_helper && ./scripts/backup.sh >> backups/cron.log 2>&1
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DB_PATH="${DB_PATH:-$ROOT/data/app.db}"
ASSET_ROOT="${ASSET_ROOT:-$ROOT/data/assets}"
BACKUP_DIR="${1:-$ROOT/backups/$(date +%Y-%m-%d_%H%M%S)}"

echo "[$(date)] Starting backup to $BACKUP_DIR"
mkdir -p "$BACKUP_DIR"

# --- Database backup ---
# Use SQLite backup API for a consistent snapshot (handles WAL mode).
if [ -f "$DB_PATH" ]; then
    echo "  Backing up database..."
    # Vacuum into a new file to get a clean, compacted copy
    sqlite3 "$DB_PATH" ".backup '$BACKUP_DIR/app.db'"
    # Also copy WAL/SHM if present (for point-in-time consistency)
    if [ -f "$DB_PATH-wal" ]; then
        cp "$DB_PATH-wal" "$BACKUP_DIR/app.db-wal" 2>/dev/null || true
    fi
    echo "  Database: $(du -h "$BACKUP_DIR/app.db" | cut -f1)"
else
    echo "  WARNING: Database file not found at $DB_PATH"
fi

# --- Assets backup ---
if [ -d "$ASSET_ROOT" ]; then
    echo "  Backing up assets..."
    # Use rsync for efficient incremental copies; creates the dir if needed
    rsync -a --delete "$ASSET_ROOT/" "$BACKUP_DIR/assets/"
    echo "  Assets: $(du -sh "$BACKUP_DIR/assets" | cut -f1)"
else
    echo "  Assets directory not found at $ASSET_ROOT (skipping)"
fi

# --- Schema version marker ---
echo "$(date -Iseconds)" > "$BACKUP_DIR/.timestamp"
sqlite3 "$DB_PATH" "SELECT MAX(name) FROM sqlite_master WHERE type='table';" > "$BACKUP_DIR/.tables" 2>/dev/null || true

# --- Compress ---
echo "  Compressing backup..."
tar -czf "$BACKUP_DIR.tar.gz" -C "$(dirname "$BACKUP_DIR")" "$(basename "$BACKUP_DIR")"
rm -rf "$BACKUP_DIR"

echo "[$(date)] Backup complete: $BACKUP_DIR.tar.gz ($(du -h "$BACKUP_DIR.tar.gz" | cut -f1))"

# --- Retention: keep last 30 backups ---
BACKUP_PARENT="$(dirname "$BACKUP_DIR")"
cd "$BACKUP_PARENT"
ls -t *.tar.gz 2>/dev/null | tail -n +31 | while read -r old; do
    rm -f "$old"
    echo "  Pruned old backup: $old"
done

echo "[$(date)] Done."
