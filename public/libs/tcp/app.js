
let socket;
const connectBtn = document.getElementById('connectBtn');
const disconnectBtn = document.getElementById('disconnectBtn');
const log = document.getElementById('log');

connectBtn.addEventListener('click', () => {
    const ipAddress = `ws://violex.local:80/ws`;

    socket = new WebSocket(ipAddress);

    socket.addEventListener('open', (event) => {
        logMessage('Connected to server');
        toggleConnectionState(true);
    });

    socket.addEventListener('message', (event) => {
        logMessage(`Server: ${event.data}`);
    });

    socket.addEventListener('close', (event) => {
        logMessage('Disconnected from server');
        toggleConnectionState(false);
    });

    socket.addEventListener('error', (event) => {
        logMessage('Error: Unable to connect');
        toggleConnectionState(false);
    });
});

disconnectBtn.addEventListener('click', () => {
    socket.close();
    toggleConnectionState(false);
});

function logMessage(message) {
    console.log(message);
}

function toggleConnectionState(connected) {
    connectBtn.disabled = connected;
    disconnectBtn.disabled = !connected;
}

function showColorPallet() {
    // TODO
    // const playing_notes = document.getElementById("playing-notes");
    // playing_notes.textContent = String();
}