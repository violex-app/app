
let socket;
const connectBtn = document.getElementById('connectBtn');
const disconnectBtn = document.getElementById('disconnectBtn');
const log = document.getElementById('log');

const toneToColor = {
    0: "#520000",  // F
    1: "#740000",  // F#
    2: "#B30000",  // G
    3: "#EE0000",  // G#
    4: "#FF6300",  // A
    5: "#FFEC00",  // A#
    6: "#99FF00",  // B
    7: "#28FF00",  // C
    8: "#00FFE8",  // C#
    9: "#007CFF",  // D
    10: "#0500FF", // D#
    11: "#4500EA", // E
  };

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