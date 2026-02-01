# Music Collection Skill

Apple Music playlist management via JXA (JavaScript for Automation) with safe parameter passing.

## Overview

This skill provides safe, JSON-based interaction with Apple Music playlists. It uses a bash wrapper to safely pass user input to JXA scripts, preventing injection attacks and ensuring reliable automation.

## Architecture

```
music-wrapper.sh (Bash)
    ↓ (safe parameter passing)
add-to-playlist.js (JXA)
    ↓ (osascript)
Music.app (Apple Music)
```

## Features

- **List Playlists**: Enumerate all available playlists with track counts
- **Add to Playlist**: Add tracks to playlists with dry-run support
- **Safe Parameter Passing**: No string interpolation, all args passed as separate parameters
- **JSON Output**: All responses are valid JSON for easy parsing
- **Dry-Run Mode**: Preview actions without modifying playlists
- **Auto-Launch**: Automatically activates Music app if not running

## Usage

### List Playlists

```bash
~/moltbot/skills/music-collection/scripts/music-wrapper.sh --list-playlists
```

Response:
```json
{
  "success": true,
  "playlists": [
    {"name": "Favorites", "trackCount": 42},
    {"name": "Workout", "trackCount": 28}
  ],
  "count": 2
}
```

### Add Track to Playlist (Dry Run)

```bash
~/moltbot/skills/music-collection/scripts/music-wrapper.sh \
  --add "Song Name" \
  --playlist "My Playlist" \
  --dry-run
```

Response:
```json
{
  "success": true,
  "dryRun": true,
  "action": "add",
  "track": "Song Name",
  "playlist": "My Playlist",
  "message": "Would add track to playlist (dry run)"
}
```

### Add Track to Playlist (Execute)

```bash
~/moltbot/skills/music-collection/scripts/music-wrapper.sh \
  --add "Song Name" \
  --playlist "My Playlist"
```

Response:
```json
{
  "success": true,
  "action": "add",
  "track": "Song Name",
  "playlist": "My Playlist",
  "message": "Track added to playlist"
}
```

### Show Help

```bash
~/moltbot/skills/music-collection/scripts/music-wrapper.sh --help
```

## Security

### Safe Parameter Passing

The bash wrapper uses positional arguments to pass data to osascript, avoiding string interpolation:

```bash
# SAFE: Arguments passed as separate parameters
osascript -l JavaScript script.js "action" "$track_name" "$playlist_name" "$dry_run"

# UNSAFE (not used): String interpolation
osascript -l JavaScript script.js "add '$track_name' to '$playlist_name'"
```

### Input Validation

- Track and playlist names are validated in JXA before use
- No destructive operations (delete, modify) are supported
- All user input is treated as data, not code

## Error Handling

All errors return JSON with an `error` field:

```json
{
  "error": "Track not found: Song Name",
  "searched": "Song Name"
}
```

Common errors:
- `Track not found`: Track doesn't exist in Music library
- `Playlist not found`: Playlist doesn't exist
- `Track name is required`: Missing --add argument
- `Playlist name is required`: Missing --playlist argument

## Requirements

- macOS with Apple Music app
- osascript (included with macOS)
- Bash 4.0+

## Implementation Details

### add-to-playlist.js

JXA script that handles all Music app interactions:

- `run(argv)`: Entry point, dispatches to action handlers
- `listPlaylists(app)`: Returns all playlists with track counts
- `addToPlaylist(app, trackName, playlistName, dryRun)`: Adds track to playlist
- `delay(seconds)`: Utility for app launch timing

### music-wrapper.sh

Bash wrapper that:

1. Parses command-line arguments safely
2. Validates required parameters
3. Calls JXA script with positional arguments
4. Returns JSON output from JXA

## Limitations

- Track search is substring-based (case-sensitive)
- Playlist names must match exactly
- Requires Music app to be accessible
- No support for smart playlists (read-only)

## Future Enhancements

- Remove tracks from playlists
- Create new playlists
- Search by artist/album
- Batch operations
- Playlist export/import
