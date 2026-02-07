# Backup and Restore Procedures

> **OBS-007 (#91)** -- Backup/restore procedure documentation for all Clawdbot data stores.

This document describes how to back up and restore every persistent data store
used by the Clawdbot runtime. Follow these procedures before upgrades, after
incidents, and on the regular schedule defined by your ops runbook.

---

## Overview

Clawdbot relies on the following data stores:

| Store              | Purpose                                | Backup method           |
| ------------------ | -------------------------------------- | ----------------------- |
| Postgres           | Run history, skill registry, audit log | `pg_dump`               |
| Redis              | Queue state, ephemeral caches          | `BGSAVE` / RDB snapshot |
| n8n data directory | Workflow definitions, credentials      | Filesystem copy         |
| Skill bundles      | Signed skill packages                  | Filesystem / S3 sync    |
| Artifacts          | Screenshots, transcripts, exports      | Filesystem / S3 sync    |

---

## Postgres

### Backup

```bash
# Full logical dump (recommended for small-to-medium databases).
pg_dump \
  --host=localhost \
  --port=5432 \
  --username=clawdbot \
  --format=custom \
  --file=/backups/postgres/clawdbot_$(date +%Y%m%d_%H%M%S).dump \
  clawdbot
```

For large databases, consider using `pg_basebackup` for physical backups or
WAL archiving for point-in-time recovery.

### Restore

```bash
pg_restore \
  --host=localhost \
  --port=5432 \
  --username=clawdbot \
  --dbname=clawdbot \
  --clean \
  --if-exists \
  /backups/postgres/clawdbot_20260101_120000.dump
```

### Verification

After restoring, run a quick sanity check:

```bash
psql -U clawdbot -d clawdbot -c "SELECT count(*) FROM runs;"
psql -U clawdbot -d clawdbot -c "SELECT count(*) FROM skill_registry;"
```

---

## Redis

### Backup

Redis persists data via RDB snapshots. Trigger an on-demand snapshot:

```bash
redis-cli BGSAVE
```

The snapshot is written to the path configured by `dir` and `dbfilename`
in `redis.conf` (typically `/var/lib/redis/dump.rdb`). Copy the file to
your backup location:

```bash
cp /var/lib/redis/dump.rdb /backups/redis/dump_$(date +%Y%m%d_%H%M%S).rdb
```

If AOF persistence is enabled, also back up the AOF file:

```bash
cp /var/lib/redis/appendonly.aof /backups/redis/appendonly_$(date +%Y%m%d_%H%M%S).aof
```

### Restore

1. Stop the Redis server.
2. Replace `dump.rdb` (and `appendonly.aof` if applicable) with the backup copy.
3. Start the Redis server.

```bash
systemctl stop redis
cp /backups/redis/dump_20260101_120000.rdb /var/lib/redis/dump.rdb
chown redis:redis /var/lib/redis/dump.rdb
systemctl start redis
```

### Verification

```bash
redis-cli DBSIZE
redis-cli INFO keyspace
```

---

## n8n Data Directory

n8n stores workflow definitions, credentials (encrypted), and execution logs
in its data directory (typically `~/.n8n` or a custom path set via
`N8N_USER_FOLDER`).

### Backup

```bash
tar czf /backups/n8n/n8n_data_$(date +%Y%m%d_%H%M%S).tar.gz \
  -C /home/clawdbot/.n8n .
```

**Important:** The backup contains encrypted credentials. Treat the archive
with the same security controls as the encryption key.

### Restore

```bash
systemctl stop n8n
rm -rf /home/clawdbot/.n8n/*
tar xzf /backups/n8n/n8n_data_20260101_120000.tar.gz \
  -C /home/clawdbot/.n8n
chown -R clawdbot:clawdbot /home/clawdbot/.n8n
systemctl start n8n
```

### Verification

Open the n8n UI and confirm workflows are visible and credentials resolve.

---

## Skill Bundles

Signed skill bundles are stored in the skill registry directory or an S3
bucket depending on deployment mode.

### Backup (filesystem)

```bash
rsync -a /var/lib/clawdbot/skills/ /backups/skills/$(date +%Y%m%d_%H%M%S)/
```

### Backup (S3)

```bash
aws s3 sync s3://clawdbot-skills/ /backups/skills/$(date +%Y%m%d_%H%M%S)/
```

### Restore

Copy the backup back to the skill registry path and restart the gateway:

```bash
rsync -a /backups/skills/20260101_120000/ /var/lib/clawdbot/skills/
```

---

## Artifacts

Artifacts (screenshots, transcripts, exported files) are stored under
the artifact store root (configured in `ClawdbotConfig.persistArtifacts`).

### Backup

```bash
rsync -a /var/lib/clawdbot/artifacts/ /backups/artifacts/$(date +%Y%m%d_%H%M%S)/
```

### Restore

```bash
rsync -a /backups/artifacts/20260101_120000/ /var/lib/clawdbot/artifacts/
```

---

## Backup Schedule

Recommended minimum schedule:

| Store         | Frequency                     | Retention  |
| ------------- | ----------------------------- | ---------- |
| Postgres      | Daily (full) + continuous WAL | 30 days    |
| Redis         | Every 6 hours                 | 7 days     |
| n8n data      | Daily                         | 30 days    |
| Skill bundles | On publish                    | Indefinite |
| Artifacts     | Daily                         | 90 days    |

---

## Disaster Recovery Checklist

1. **Stop all services** -- gateway, n8n, workers.
2. **Restore Postgres** from the most recent dump.
3. **Restore Redis** from the most recent RDB snapshot.
4. **Restore n8n data** from the most recent archive.
5. **Restore skill bundles** from backup.
6. **Restore artifacts** from backup.
7. **Start services** in order: Postgres, Redis, n8n, gateway.
8. **Run `openclaw doctor`** to validate connectivity and configuration.
9. **Verify** via `openclaw channels status --probe` and spot-check a skill run.
