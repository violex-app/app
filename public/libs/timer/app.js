let playing_timer = undefined;
let playing_timer_timeElapsed = 0;
let playing_duration = undefined;
let has_started_playing = false;
let startTime = null;

function updateDisplay() {
    timerDisplay.textContent = Math.round(playing_timer_timeElapsed) + "ms";
}

function startTimer() {
    has_started_playing = true;
    startTime = performance.now() - playing_timer_timeElapsed;
    playing_timer = setInterval(() => {
        playing_timer_timeElapsed = performance.now() - startTime;
        updateDisplay();
    }, 10);
}

function resetTimer() {
    has_started_playing = false;
    clearInterval(playing_timer);
    playing_timer_timeElapsed = 0;
    startTime = null;
    updateDisplay();
}