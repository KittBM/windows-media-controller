const { SMTCMonitor } = require('@coooookies/windows-smtc-monitor');
const WebSocket = require('ws');
const { Bonjour } = require('bonjour-service');
const ip = require('ip');
const { exec } = require('child_process');

const port = 8080;
const wss = new WebSocket.Server({ port });
const bonjour = new Bonjour();
const monitor = new SMTCMonitor();

let nothingPlayingTimeout = null;

let currentState = {
    title: 'Nothing Playing',
    artist: '',
    album: '',
    status: 'Stopped', // Playing, Paused, Stopped
    thumbnail: '', // Base64
    appId: '',
    position: 0,
    duration: 0,
    playbackRate: 1.0,
    lastUpdatedTime: Date.now()
};

function getStatusString(status) {
    if (status === 4) return 'Playing';
    if (status === 5) return 'Paused';
    return 'Stopped';
}

function updateMediaStateFromSession(session) {
    // If session is null, try to fallback to the first available session
    if (!session) {
        session = monitor.sessions[0];
    }

    if (!session) {
        currentState = {
            title: 'Nothing Playing',
            artist: '',
            album: '',
            status: 'Stopped',
            thumbnail: '',
            appId: '',
            position: 0,
            duration: 0,
            playbackRate: 1.0,
            lastUpdatedTime: Date.now()
        };
        return;
    }

    currentState.appId = session.sourceAppId;

    if (session.media) {
        currentState.title = session.media.title || 'Unknown Title';
        currentState.artist = session.media.artist || 'Unknown Artist';
        currentState.album = session.media.albumTitle || '';
        if (session.media.thumbnail) {
            currentState.thumbnail = session.media.thumbnail.toString('base64');
        } else {
            currentState.thumbnail = '';
        }
    }

    if (session.playback) {
        currentState.status = getStatusString(session.playback.playbackStatus);
    }

    if (session.timeline) {
        let pos = session.timeline.position || 0;
        let dur = session.timeline.duration || 0;

        // Heuristic: If duration is much smaller than position, it might be in seconds while position is in ms.
        // Or both might be in seconds. Standardize to milliseconds.
        // UWP ticks are 10,000 per ms. If values are huge, they might be ticks.
        // If values are small (e.g. < 10000 for a long song), they might be seconds.

        if (dur > 0 && dur < 10000 && pos > dur * 2) {
            // Likely duration is seconds and position is ms? 
            // This is strange but matches the user's error report.
            dur *= 1000;
        } else if (dur > 0 && dur < 10000 && pos < 10000) {
            // Both likely seconds
            dur *= 1000;
            pos *= 1000;
        }

        currentState.position = pos;
        currentState.duration = dur;
    }
    currentState.lastUpdatedTime = session.lastUpdatedTime || Date.now();
}

// Broadcast state to all connected clients
function broadcast(data) {
    const payload = JSON.stringify(data);
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(payload);
        }
    });
}

// Media Monitor Listeners

monitor.on('current-session-changed', (sourceAppId) => {
    console.log('Active session changed:', sourceAppId);
    clearTimeout(nothingPlayingTimeout); // Cancel "Nothing Playing" fallback

    const session = SMTCMonitor.getMediaSessionByAppId?.(sourceAppId) || monitor.sessions.find(s => s.sourceAppId === sourceAppId);
    if (session) {
        updateMediaStateFromSession(session);
        broadcast({ type: 'UPDATE', data: currentState });
    }
});

monitor.on('session-media-changed', (sourceAppId, mediaProps) => {
    clearTimeout(nothingPlayingTimeout);
    if (sourceAppId === currentState.appId) {
        console.log('Media properties updated:', mediaProps.title);
        currentState.title = mediaProps.title || 'Unknown Title';
        currentState.artist = mediaProps.artist || 'Unknown Artist';
        currentState.album = mediaProps.albumTitle || '';
        if (mediaProps.thumbnail) {
            currentState.thumbnail = mediaProps.thumbnail.toString('base64');
        } else {
            currentState.thumbnail = '';
        }
        broadcast({ type: 'UPDATE', data: currentState });
    }
});

monitor.on('session-playback-changed', (sourceAppId, playbackInfo) => {
    clearTimeout(nothingPlayingTimeout);
    if (sourceAppId === currentState.appId) {
        console.log('Playback status changed:', playbackInfo.playbackStatus);
        currentState.status = getStatusString(playbackInfo.playbackStatus);

        // When playback status changes, position might have jumped or started/stopped.
        // Get the latest session to update timeline too.
        const session = SMTCMonitor.getMediaSessionByAppId?.(sourceAppId) || monitor.sessions.find(s => s.sourceAppId === sourceAppId);
        if (session && session.timeline) {
            console.log('Playback changed timeline (raw):', session.timeline);
            let pos = session.timeline.position;
            let dur = session.timeline.duration;

            if (dur > 0 && dur < 10000 && pos > dur * 2) {
                dur *= 1000;
            } else if (dur > 0 && dur < 10000 && pos < 10000) {
                dur *= 1000;
                pos *= 1000;
            }

            currentState.position = pos;
            currentState.duration = dur;
            currentState.lastUpdatedTime = session.lastUpdatedTime || Date.now();
        }

        broadcast({ type: 'UPDATE', data: currentState });
    }
});

monitor.on('session-timeline-changed', (sourceAppId, timelineProps) => {
    if (sourceAppId === currentState.appId) {
        console.log('Timeline updated (raw):', timelineProps);

        let pos = timelineProps.position;
        let dur = timelineProps.duration;

        if (dur > 0 && dur < 10000 && pos > dur * 2) {
            dur *= 1000;
        } else if (dur > 0 && dur < 10000 && pos < 10000) {
            dur *= 1000;
            pos *= 1000;
        }

        // Only broadcast if there's a significant jump (e.g. > 2 seconds)
        // or if it's the first time we get a duration.
        const timeDiff = Math.abs(currentState.position - pos);
        const isJump = timeDiff > 2000;

        currentState.position = pos;
        currentState.duration = dur;
        currentState.lastUpdatedTime = Date.now();

        if (isJump) {
            console.log('Timeline jump detected, broadcasting update');
            broadcast({ type: 'UPDATE', data: currentState });
        }
    }
});

monitor.on('session-added', (sourceAppId, media) => {
    console.log('Session added:', sourceAppId);
    clearTimeout(nothingPlayingTimeout);
    if (!currentState.appId || currentState.title === 'Nothing Playing') {
        updateMediaStateFromSession(media);
        broadcast({ type: 'UPDATE', data: currentState });
    }
});

monitor.on('session-removed', (sourceAppId) => {
    if (sourceAppId === currentState.appId) {
        // Fallback to another session or wait a bit for a new one
        const nextSession = monitor.sessions.find(s => s.sourceAppId !== sourceAppId);
        if (nextSession) {
            updateMediaStateFromSession(nextSession);
            broadcast({ type: 'UPDATE', data: currentState });
        } else {
            console.log('No sessions left, starting "Nothing Playing" timeout');
            clearTimeout(nothingPlayingTimeout);
            nothingPlayingTimeout = setTimeout(() => {
                if (monitor.sessions.length === 0) {
                    updateMediaStateFromSession(null);
                    broadcast({ type: 'UPDATE', data: currentState });
                }
            }, 1000);
        }
    }
});


// Initialization: get current session
setTimeout(() => {
    try {
        const currentSession = SMTCMonitor.getCurrentMediaSession ? SMTCMonitor.getCurrentMediaSession() : monitor.sessions[0];
        updateMediaStateFromSession(currentSession);
    } catch (e) {
        console.log("Could not get initial session");
    }
}, 500);

// Hardware Media Control mapping via compiled helper
function sendMediaKey(cmd) {
    exec(`MediaKeys.exe ${cmd}`, { cwd: __dirname }, (error) => {
        if (error) console.error('MediaKey error:', error);
    });
}

// WebSocket Command Handling
wss.on('connection', (ws) => {
    console.log('Client connected');
    // Send initial state
    ws.send(JSON.stringify({ type: 'UPDATE', data: currentState }));

    ws.on('message', async (message) => {
        try {
            const { command } = JSON.parse(message.toString());
            console.log('Received command:', command);

            switch (command) {
                case 'PLAY_PAUSE':
                case 'PLAY':
                case 'PAUSE':
                    sendMediaKey('PLAY_PAUSE');
                    break;
                case 'NEXT':
                    sendMediaKey('NEXT');
                    break;
                case 'PREVIOUS':
                    sendMediaKey('PREVIOUS');
                    break;
                default:
                    console.log('Unknown command:', command);
            }
        } catch (e) {
            console.error('Failed to parse command:', e);
        }
    });
});

// Advertise service via mDNS
function getLocalIp() {
    const os = require('os');
    const interfaces = os.networkInterfaces();
    let bestIp = '0.0.0.0';
    for (const name of Object.keys(interfaces)) {
        if (name.toLowerCase().includes('virtual') || name.toLowerCase().includes('vbox') || name.toLowerCase().includes('vmware') || name.toLowerCase().includes('loopback')) {
            continue;
        }
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                if (iface.address.startsWith('169.254')) continue;
                if (iface.address.startsWith('192.168.56')) continue;
                bestIp = iface.address;
                if (name.toLowerCase().includes('wi-fi')) {
                    return bestIp;
                }
            }
        }
    }
    return bestIp !== '0.0.0.0' ? bestIp : require('ip').address();
}
const hostIp = getLocalIp();

bonjour.publish({
    name: `${require('os').hostname()}`,
    type: 'winmedia',
    port: port,
    host: hostIp,
    txt: { ip: hostIp, port: port.toString() }
});

console.log(`Server running at ws://${hostIp}:${port}`);
console.log('mDNS service started as WindowsMediaController');
