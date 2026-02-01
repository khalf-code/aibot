# file-management

Organize, backup, and maintain files with cleanup, backup, and log rotation utilities.

## Usage

```bash
# Organize Downloads by file type
cleanup-downloads.sh [--dry-run] [--help]

# Backup important folders to external storage
backup.sh [--dry-run] [--help] [--target DIR]

# Compress and delete old log files
rotate-logs.sh [--dry-run] [--help] [--days N]
```

## Scripts

### cleanup-downloads.sh

Organizes files in `~/Downloads` into subdirectories based on file type.

**Options:**
- `--dry-run` - Preview changes without moving files
- `--help` - Show usage instructions

**Creates directories for:**
- `documents/` - PDF, Word, Excel, PowerPoint files
- `images/` - JPG, PNG, GIF, SVG, WebP files
- `videos/` - MP4, MOV, AVI, MKV files
- `audio/` - MP3, WAV, FLAC, AAC files
- `archives/` - ZIP, TAR, RAR, 7Z files
- `code/` - JS, Python, Java, C++ files
- `data/` - JSON, XML, CSV, SQL files
- `other/` - Unclassified files

**Example:**
```bash
# Preview what would be organized
cleanup-downloads.sh --dry-run

# Actually organize files
cleanup-downloads.sh
```

### backup.sh

Backs up important directories to external storage.

**Options:**
- `--dry-run` - Preview backup without copying files
- `--target DIR` - Override backup target from config
- `--help` - Show usage instructions

**Backs up:**
- `~/Documents`
- `~/Desktop`
- `~/.config`
- `~/.ssh` (if exists)
- `~/moltbot` (if exists)

**Example:**
```bash
# Preview backup
backup.sh --dry-run

# Backup to custom location
backup.sh --target /Volumes/MyDrive/backups

# Actually perform backup
backup.sh
```

### rotate-logs.sh

Compresses log files older than retention period and deletes very old compressed logs.

**Options:**
- `--dry-run` - Preview compression/deletion without modifying files
- `--days N` - Override retention days from config
- `--help` - Show usage instructions

**Actions:**
- Compresses `.log` files older than retention days to `.log.gz`
- Deletes `.log.gz` files older than 2x retention days
- Processes directories from `references/config.json`

**Example:**
```bash
# Preview log rotation
rotate-logs.sh --dry-run

# Keep logs for 60 days instead of default 30
rotate-logs.sh --days 60

# Actually perform rotation
rotate-logs.sh
```

## Configuration

Edit `references/config.json` to customize:

```json
{
  "download_dir": "~/Downloads",
  "backup_target": "/Volumes/External/backups",
  "log_dirs": [
    "~/.local/share/moltbot/logs",
    "~/Library/Logs",
    "/var/log"
  ],
  "retention_days": 30,
  "file_type_mappings": {
    "documents": [".pdf", ".doc", ".docx", ...],
    "images": [".jpg", ".png", ...],
    ...
  }
}
```

## Features

- **Dry-run mode** - All destructive operations support `--dry-run` to preview changes
- **Config-driven** - Paths and settings in `references/config.json`
- **Safe defaults** - Excludes hidden files and system directories
- **Error handling** - Graceful handling of missing directories
- **Atomic operations** - Each script is self-contained and revertable

## Dependencies

- `bash` - Shell scripting
- `jq` - JSON configuration parsing
- `rsync` - File synchronization (for backup.sh)
- `gzip` - Log compression (for rotate-logs.sh)
- `find` - File discovery

## Safety

All scripts follow these safety principles:

1. **No destructive operations without confirmation** - Use `--dry-run` first
2. **Config-based paths** - No hardcoded paths outside config
3. **Explicit exclusions** - Hidden files and system directories are skipped
4. **Error handling** - Scripts exit on errors with clear messages
5. **Atomic operations** - Each script can be safely interrupted
