const { SMTCMonitor } = require('@coooookies/windows-smtc-monitor');
const WebSocket = require('ws');
const { Bonjour } = require('bonjour-service');
const ip = require('ip');

const port = 8080;
const wss = new WebSocket.Server({ port });
const bonjour = new Bonjour();
const monitor = new SMTCMonitor();

let currentState = {
    title: '',
    artist: '',
    album: '',
    status: 'Stopped', // Playing, Paused, Stopped
    thumbnail: '', // Base64
    appId: ''
};

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
monitor.on('sessionChanged', (session) => {
    console.log('Active session changed:', session.sourceAppId);
    updateMediaState(session);
});

monitor.on('mediaPropertiesChanged', (properties) => {
    console.log('Media properties updated:', properties.title);
    currentState.title = properties.title || 'Unknown Title';
    currentState.artist = properties.artist || 'Unknown Artist';
    currentState.album = properties.albumTitle || '';
    if (properties.thumbnail) {
        currentState.thumbnail = properties.thumbnail.toString('base64');
    } else {
        currentState.thumbnail = '';
    }
    broadcast({ type: 'UPDATE', data: currentState });
});

monitor.on('playbackStatusChanged', (status) => {
    console.log('Playback status changed:', status);
    currentState.status = status;
    broadcast({ type: 'UPDATE', data: currentState });
});

function updateMediaState(session) {
    if (!session) {
        currentState = { title: 'Nothing Playing', artist: '', album: '', status: 'Stopped', thumbnail: '', appId: '' };
    } else {
        currentState.appId = session.sourceAppId;
        // The monitor usually provides initial properties
    }
    broadcast({ type: 'UPDATE', data: currentState });
}

// WebSocket Command Handling
wss.on('connection', (ws) => {
    console.log('Client connected');
    // Send initial state
    ws.send(JSON.stringify({ type: 'UPDATE', data: currentState }));

    ws.on('message', async (message) => {
        try {
            const { command } = JSON.parse(message);
            console.log('Received command:', command);

            switch (command) {
                case 'PLAY_PAUSE':
                    await monitor.togglePlayPause();
                    break;
                case 'PLAY':
                    await monitor.play();
                    break;
                case 'PAUSE':
                    await monitor.pause();
                    break;
                case 'NEXT':
                    await monitor.next();
                    break;
                case 'PREVIOUS':
                    await monitor.previous();
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
bonjour.publish({ 
    name: `WindowsMediaController-${require('os').hostname()}`, 
    type: 'winmedia', 
    port: port 
});

console.log(`Server running at ws://${ip.address()}:${port}`);
console.log('mDNS service started as WindowsMediaController');
monitor.start();
