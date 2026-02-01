#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
JXA_SCRIPT="${SCRIPT_DIR}/add-to-playlist.js"

show_help() {
    cat << 'EOF'
Music Collection Skill - Apple Music Playlist Manager

USAGE:
    music-wrapper.sh [OPTIONS]

OPTIONS:
    --help                          Show this help message
    --list-playlists                List all available playlists
    --add TRACK --playlist NAME     Add track to playlist
    --dry-run                       Show what would happen without making changes

EXAMPLES:
    # List all playlists
    music-wrapper.sh --list-playlists

    # Add a track to a playlist (dry run)
    music-wrapper.sh --add "Song Name" --playlist "My Playlist" --dry-run

    # Add a track to a playlist (execute)
    music-wrapper.sh --add "Song Name" --playlist "My Playlist"

EOF
}

list_playlists() {
    osascript -l JavaScript "$JXA_SCRIPT" "list-playlists" "" "" "false"
}

add_to_playlist() {
    local track_name="$1"
    local playlist_name="$2"
    local dry_run="${3:-false}"
    
    osascript -l JavaScript "$JXA_SCRIPT" "add" "$track_name" "$playlist_name" "$dry_run"
}

main() {
    local action=""
    local track_name=""
    local playlist_name=""
    local dry_run="false"
    
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --help)
                show_help
                exit 0
                ;;
            --list-playlists)
                list_playlists
                exit 0
                ;;
            --add)
                shift
                if [[ $# -eq 0 ]]; then
                    echo '{"error": "--add requires a track name"}' >&2
                    exit 1
                fi
                track_name="$1"
                ;;
            --playlist)
                shift
                if [[ $# -eq 0 ]]; then
                    echo '{"error": "--playlist requires a playlist name"}' >&2
                    exit 1
                fi
                playlist_name="$1"
                ;;
            --dry-run)
                dry_run="true"
                ;;
            *)
                echo "{\"error\": \"Unknown option: $1\"}" >&2
                exit 1
                ;;
        esac
        shift
    done
    
    if [[ -z "$track_name" ]]; then
        echo '{"error": "Track name is required (use --add)"}' >&2
        exit 1
    fi
    
    if [[ -z "$playlist_name" ]]; then
        echo '{"error": "Playlist name is required (use --playlist)"}' >&2
        exit 1
    fi
    
    add_to_playlist "$track_name" "$playlist_name" "$dry_run"
}

main "$@"
