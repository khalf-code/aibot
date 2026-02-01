// add-to-playlist.js - JXA script for Apple Music playlist management
// Usage: osascript -l JavaScript add-to-playlist.js "action" "trackName" "playlistName" "dryRun"

function run(argv) {
    const action = argv[0] || "add";
    const trackName = argv[1] || "";
    const playlistName = argv[2] || "";
    const dryRun = argv[3] === "true";
    
    try {
        const app = Application("Music");
        
        // Ensure Music app is running
        if (!app.running()) {
            app.activate();
            busyWait(1); // Give app time to launch
        }
        
        switch(action) {
            case "list-playlists":
                return listPlaylists(app);
            
            case "add":
                return addToPlaylist(app, trackName, playlistName, dryRun);
            
            default:
                return JSON.stringify({
                    error: "Unknown action: " + action,
                    supported: ["list-playlists", "add"]
                });
        }
    } catch (error) {
        return JSON.stringify({
            error: "JXA Error: " + error.toString(),
            action: action
        });
    }
}

function listPlaylists(app) {
    try {
        const playlists = app.playlists();
        const playlistNames = playlists.map(function(p) {
            return {
                name: p.name(),
                trackCount: p.tracks.length
            };
        });
        
        return JSON.stringify({
            success: true,
            playlists: playlistNames,
            count: playlistNames.length
        });
    } catch (error) {
        return JSON.stringify({
            error: "Failed to list playlists: " + error.toString()
        });
    }
}

function addToPlaylist(app, trackName, playlistName, dryRun) {
    try {
        // Validate inputs
        if (!trackName || trackName.trim() === "") {
            return JSON.stringify({
                error: "Track name is required"
            });
        }
        
        if (!playlistName || playlistName.trim() === "") {
            return JSON.stringify({
                error: "Playlist name is required"
            });
        }
        
        // Search for track
        const tracks = app.tracks.whose({
            name: {_contains: trackName}
        });
        
        if (tracks.length === 0) {
            return JSON.stringify({
                error: "Track not found: " + trackName,
                searched: trackName
            });
        }
        
        // Get the first matching track
        const track = tracks[0];
        
        // Find playlist
        let playlist = null;
        const playlists = app.playlists();
        for (let i = 0; i < playlists.length; i++) {
            if (playlists[i].name() === playlistName) {
                playlist = playlists[i];
                break;
            }
        }
        
        if (!playlist) {
            return JSON.stringify({
                error: "Playlist not found: " + playlistName,
                searched: playlistName
            });
        }
        
        // Dry run - just return what would happen
        if (dryRun) {
            return JSON.stringify({
                success: true,
                dryRun: true,
                action: "add",
                track: track.name(),
                playlist: playlist.name(),
                message: "Would add track to playlist (dry run)"
            });
        }
        
        // Add track to playlist
        app.duplicate(track, {to: playlist});
        
        return JSON.stringify({
            success: true,
            action: "add",
            track: track.name(),
            playlist: playlist.name(),
            message: "Track added to playlist"
        });
        
    } catch (error) {
        return JSON.stringify({
            error: "Failed to add track: " + error.toString(),
            track: trackName,
            playlist: playlistName
        });
    }
}

function busyWait(seconds) {
    const endTime = new Date().getTime() + seconds * 1000;
    while (new Date().getTime() < endTime) {
        // Busy wait
    }
}
