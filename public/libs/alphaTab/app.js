// load elements
const wrapper = document.querySelector(".at-wrap");
const main = wrapper.querySelector(".at-main");
var api;
var currentSpeed = 1.0;

// initialize alphatab
const settings = {
    file: "libs/alphaTab/Bach minuet 2AVLN.musicxml",
    player: {
        enableElementHighlighting: true,
        enableAnimatedBeatCursor: false,
        enablePlayer: true,
        soundFont: "libs/alphaTab/soundfonts/Quartz.sf2",
        scrollElement: wrapper.querySelector('.at-viewport'),
        playbackRate: currentSpeed
    }
};
api = new alphaTab.AlphaTabApi(main, settings);

// overlay logic
const overlay = wrapper.querySelector(".at-overlay");
api.renderStarted.on(() => {
    overlay.style.display = "flex";
});
api.renderFinished.on(() => {
    overlay.style.display = "none";
});
overlay.style.display = "none";

// track selector
function createTrackItem(trackList, track) {
    const trackItem = document
        .querySelector("#at-track-template")
        .content.cloneNode(true).firstElementChild;
    trackItem.querySelector(".at-track-name").innerText = track.name;
    trackItem.track = track;
    trackItem.onclick = (e) => {
        if(api._trackIndexes[0] != track.index){
            e.stopPropagation();
            api.renderTracks([track]);
        }
    };

    const muteButton = document.createElement('button');
    muteButton.textContent = track.isMute ? 'Unmute' : 'Mute';
    muteButton.classList = "button is-danger is-small";
    muteButton.style.width = "60px";
    muteButton.style.top = "15px";
    muteButton.addEventListener('click', () => {
        track.isMute = !track.isMute;
        api.changeTrackMute(track, track.isMute);
        muteButton.textContent = track.isMute ? 'Unmute' : 'Mute';
    });
    trackItem.appendChild(muteButton);

    const volumeSlider = document.createElement('input');
    volumeSlider.type = 'range';
    volumeSlider.classList = "cslider is-fullwidth is-small is-circle";
    volumeSlider.min = 0;
    volumeSlider.step = 0.2;
    volumeSlider.max = 16;
    volumeSlider.value = 12;
    volumeSlider.addEventListener('input', () => {
        track.playbackInfo.volume = parseInt(volumeSlider.value);
        api.changeTrackVolume(track, track.playbackInfo.volume);
    });
    trackItem.appendChild(volumeSlider);

    trackList.appendChild(trackItem);
}
const trackList = wrapper.querySelector(".at-track-list");
api.scoreLoaded.on((score) => {
    // clear items
    trackList.innerHTML = "";
    // generate a track item for all tracks of the score
    score.tracks.forEach((track) => {
        createTrackItem(trackList, track);
    });
    console.log("scoreLoaded")
});
api.renderStarted.on(() => {
    // collect tracks being rendered
    const tracks = new Map();
    api.tracks.forEach((t) => {
        tracks.set(t.index, t);
    });
    // mark the item as active or not
    const trackItems = trackList.querySelectorAll(".at-track");
    trackItems.forEach((trackItem) => {
        if (tracks.has(trackItem.track.index)) {
            trackItem.classList.add("active");
        } else {
            trackItem.classList.remove("active");
        }
    });
});

/** Controls **/
api.scoreLoaded.on((score) => {
    wrapper.querySelector(".at-song-title").innerText = ""; // score.title;
    wrapper.querySelector(".at-song-artist").innerText = score.artist;
});

const countIn = wrapper.querySelector('.at-controls .at-count-in');
countIn.onclick = () => {
    countIn.classList.toggle('active');
    if (countIn.classList.contains('active')) {
        api.countInVolume = 1;
    } else {
        api.countInVolume = 0;
    }
};

const metronome = wrapper.querySelector(".at-controls .at-metronome");
metronome.onclick = () => {
    metronome.classList.toggle("active");
    if (metronome.classList.contains("active")) {
        api.metronomeVolume = 1;
    } else {
        api.metronomeVolume = 0;
    }
};

const loop = wrapper.querySelector(".at-controls .at-loop");
loop.onclick = () => {
    loop.classList.toggle("active");
    api.isLooping = loop.classList.contains("active");
};

wrapper.querySelector(".at-controls .at-print").onclick = () => {
    api.print();
};

const zoom = wrapper.querySelector(".at-controls .at-zoom select");
zoom.onchange = () => {
    const zoomLevel = parseInt(zoom.value) / 100;
    api.settings.display.scale = zoomLevel;
    api.updateSettings();
    api.render();
};

const layout = wrapper.querySelector(".at-controls .at-layout select");
layout.onchange = () => {
    switch (layout.value) {
        case "horizontal":
            api.settings.display.layoutMode = alphaTab.LayoutMode.Horizontal;
            break;
        case "page":
            api.settings.display.layoutMode = alphaTab.LayoutMode.Page;
            break;
    }
    api.updateSettings();
    api.render();
};

// player loading indicator
const playerIndicator = wrapper.querySelector(
    ".at-controls .at-player-progress"
);
api.soundFontLoad.on((e) => {
    const percentage = Math.floor((e.loaded / e.total) * 100);
    playerIndicator.innerText = percentage + "%";
});
api.playerReady.on(() => {
    playerIndicator.style.display = "none";
});

// main player controls
const playPause = wrapper.querySelector(
    ".at-controls .at-player-play-pause"
);
const stop = wrapper.querySelector(".at-controls .at-player-stop");
playPause.onclick = (e) => {
    if (e.target.classList.contains("disabled")) {
        return;
    }
    api.playPause();
};
stop.onclick = (e) => {
    if (e.target.classList.contains("disabled")) {
        return;
    }
    api.stop();
};
api.playerReady.on(() => {
    playPause.classList.remove("disabled");
    stop.classList.remove("disabled");
});
api.playerStateChanged.on((e) => {
    const icon = playPause.querySelector("i.fas");
    if (e.state === alphaTab.synth.PlayerState.Playing) {
        icon.classList.remove("fa-play");
        icon.classList.add("fa-pause");
    } else {
        icon.classList.remove("fa-pause");
        icon.classList.add("fa-play");
    }
});

// song position
function formatDuration(milliseconds) {
    let seconds = milliseconds / 1000;
    const minutes = (seconds / 60) | 0;
    seconds = (seconds - minutes * 60) | 0;
    return (
        String(minutes).padStart(2, "0") +
        ":" +
        String(seconds).padStart(2, "0")
    );
}

const songPosition = wrapper.querySelector(".at-song-position");
let previousTime = -1;
api.playerPositionChanged.on((e) => {
    // reduce number of UI updates to second changes.
    const currentSeconds = (e.currentTime / 1000) | 0;
    if (currentSeconds == previousTime) {
        return;
    }

    songPosition.innerText =
        formatDuration(e.currentTime) + " / " + formatDuration(e.endTime);
});

function changeSpeed() {
    var select = document.getElementById("speedSelect");
    var newSpeed = parseFloat(select.value);
    currentSpeed = newSpeed;
    api.player.playbackSpeed = currentSpeed;
    document.getElementById("speedDisplay").textContent = currentSpeed.toFixed(1);
}

document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.querySelector('#fileInput');
    const browseFileButton = document.querySelector('#browseFile');
    const openFileButton = document.querySelector('#open-file');
    const openSettingsButton = document.querySelector('#open-settings');
    const sampleFilesList = document.querySelector('#sampleFiles');
    const storage = firebase.storage();

    async function fetchFiles(path = 'scores/') {
        const listRef = storage.ref(path);
        const res = await listRef.listAll();
        const files = [];
        for (const itemRef of res.items) {
            files.push({ name: itemRef.name, type: 'file', path: itemRef.fullPath });
        }
        for (const folderRef of res.prefixes) {
            files.push({ name: folderRef.name, type: 'folder', path: folderRef.fullPath, children: await fetchFiles(folderRef.fullPath) });
        }
        return files;
    }

    function renderTree(nodes, element) {
        element.innerHTML = '';
        for (const node of nodes) {
            const listItem = document.createElement('li');
            listItem.className = 'list-group-item';
            listItem.dataset.path = node.path;
            listItem.dataset.type = node.type;

            if (node.type === 'folder') {
                listItem.innerHTML = `<i class="fas fa-folder"></i> ${node.name}`;
                const childrenList = document.createElement('ul');
                childrenList.className = 'list-group';
                childrenList.style.display = 'none';
                renderTree(node.children, childrenList);
                listItem.appendChild(childrenList);
            } else {
                listItem.innerHTML = `<i class="fas fa-file-alt"></i> ${node.name}`;
            }
            element.appendChild(listItem);
        }
    }

    sampleFilesList.addEventListener('click', async (e) => {
        const listItem = e.target.closest('.list-group-item');
        if (!listItem) return;

        const type = listItem.dataset.type;
        const path = listItem.dataset.path;

        if (type === 'folder') {
            const childrenList = listItem.querySelector('ul');
            if (childrenList) {
                childrenList.style.display = childrenList.style.display === 'none' ? 'block' : 'none';
            }
        } else if (type === 'file') {
            const loading = document.getElementById('file-tree-loading');
            loading.style.display = 'block';
            sampleFilesList.style.display = 'none';
            try {
                const url = await storage.ref(path).getDownloadURL();
                const response = await fetch(url);
                const fileContent = await response.arrayBuffer();
                api.load(fileContent);
                $('#fileModal').modal('hide');
            } catch (error) {
                console.error("Error loading file:", error);
            } finally {
                loading.style.display = 'none';
                sampleFilesList.style.display = 'block';
            }
        }
    });

    // Open the modal when the open file button is clicked
    openFileButton.addEventListener('click', async () => {
        const loading = document.getElementById('file-tree-loading');
        loading.style.display = 'block';
        sampleFilesList.style.display = 'none';
        try {
            const files = await fetchFiles();
            renderTree(files, sampleFilesList);
        } catch (error) {
            console.error("Error fetching files:", error);
        } finally {
            loading.style.display = 'none';
            sampleFilesList.style.display = 'block';
        }
        $('#fileModal').modal('show');
    });

    // Open the modal when the open file button is clicked
    openSettingsButton.addEventListener('click', () => {
        $('#settingsModal').modal('show');
    });

    // Open the file picker dialog when the browse file button is clicked
    browseFileButton.addEventListener('click', () => {
        fileInput.click();
    });

    // Load the selected file in AlphaTab and close the modal
    fileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const fileContent = e.target.result;
                api.load(fileContent);
                $('#fileModal').modal('hide');
            };
            reader.readAsArrayBuffer(file);
        }
    });
});
