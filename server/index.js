const { SMTCMonitor } = require('@coooookies/windows-smtc-monitor');
const WebSocket = require('ws');
const { Bonjour } = require('bonjour-service');
const ip = require('ip');
const { exec } = require('child_process');

const port = 8080;
const wss = new WebSocket.Server({ port });
const bonjour = new Bonjour();
const monitor = new SMTCMonitor();

let currentState = {
    title: 'Nothing Playing',
    artist: '',
    album: '',
    status: 'Stopped', // Playing, Paused, Stopped
    thumbnail: '', // Base64
    appId: ''
};

function getStatusString(status) {
    if (status === 4) return 'Playing';
    if (status === 5) return 'Paused';
    return 'Stopped';
}

function updateMediaStateFromSession(session) {
    if (!session) {
        currentState = { title: 'Nothing Playing', artist: '', album: '', status: 'Stopped', thumbnail: '', appId: '' };
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

    // We can get the full session info
    const session = SMTCMonitor.getMediaSessionByAppId?.(sourceAppId) || monitor.sessions.find(s => s.sourceAppId === sourceAppId);
    updateMediaStateFromSession(session);
    broadcast({ type: 'UPDATE', data: currentState });
});

monitor.on('session-media-changed', (sourceAppId, mediaProps) => {
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
    if (sourceAppId === currentState.appId) {
        console.log('Playback status changed:', playbackInfo.playbackStatus);
        currentState.status = getStatusString(playbackInfo.playbackStatus);
        broadcast({ type: 'UPDATE', data: currentState });
    }
});

monitor.on('session-removed', (sourceAppId) => {
    if (sourceAppId === currentState.appId) {
        // Fallback to another session or empty
        const nextSession = monitor.sessions[0];
        updateMediaStateFromSession(nextSession);
        broadcast({ type: 'UPDATE', data: currentState });
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
