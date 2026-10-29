#!/usr/bin/env python3
"""
Automated Database Backup Script for Khata Management System.
Takes a compressed SQL dump of the MariaDB / MySQL database and manages rotation.
Can be executed as a daily cron job:
  0 2 * * * /usr/bin/python3 /app/scripts/backup_db.py
"""
import os
import sys
import subprocess
from datetime import datetime
from pathlib import Path

# Load settings from environment or fallback
DB_HOST = os.getenv("DB_HOST", "127.0.0.1")
DB_PORT = os.getenv("DB_PORT", "3306")
DB_USER = os.getenv("DB_USER", "root")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")
DB_NAME = os.getenv("DB_NAME", "khata_management")

BACKUP_DIR = Path(os.getenv("BACKUP_DIR", "./backups"))
BACKUP_DIR.mkdir(parents=True, exist_ok=True)
RETENTION_DAYS = int(os.getenv("BACKUP_RETENTION_DAYS", "30"))

def run_backup():
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_file = BACKUP_DIR / f"{DB_NAME}_backup_{timestamp}.sql.gz"
    
    print(f"[{datetime.now().isoformat()}] Starting backup of database '{DB_NAME}'...")
    
    cmd = [
        "mysqldump",
        f"-h{DB_HOST}",
        f"-P{DB_PORT}",
        f"-u{DB_USER}",
        "--single-transaction",
        "--quick",
        "--routines",
        "--triggers",
        DB_NAME,
    ]
    
    env = os.environ.copy()
    if DB_PASSWORD:
        env["MYSQL_PWD"] = DB_PASSWORD

    try:
        # Run mysqldump piped to gzip
        dump_proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=env)
        gzip_proc = subprocess.Popen(["gzip"], stdin=dump_proc.stdout, stdout=open(backup_file, "wb"))
        dump_proc.stdout.close()
        
        gzip_proc.communicate()
        stderr = dump_proc.stderr.read().decode()
        
        if dump_proc.wait() != 0:
            print(f"Backup failed: {stderr}", file=sys.stderr)
            if backup_file.exists():
                backup_file.unlink()
            sys.exit(1)
            
        size_kb = backup_file.stat().st_size / 1024
        print(f"[{datetime.now().isoformat()}] Backup successful! Saved to {backup_file} ({size_kb:.1f} KB)")
        
        # Cleanup old backups older than RETENTION_DAYS
        cleanup_old_backups()
        
    except FileNotFoundError as e:
        print(f"Error: mysqldump or gzip utility not found on system: {e}", file=sys.stderr)
        sys.exit(1)

def cleanup_old_backups():
    now = datetime.now().timestamp()
    cutoff = now - (RETENTION_DAYS * 86400)
    for f in BACKUP_DIR.glob(f"{DB_NAME}_backup_*.sql.gz"):
        if f.stat().st_mtime < cutoff:
            print(f"Removing old backup: {f.name}")
            f.unlink()

if __name__ == "__main__":
    run_backup()

