// web audio stuff
var audioCtx
var analyser
var media_stream_source
var fft_array

var running = false
var ready = false
var first_time = true

// html elements
var note_el
var freq_el
var cent_el
var cents_threshold_input
var steady_factor_input
var fftsize_input
var transpose_octave_input

var prev_note = {
    letter: "",
    accidental: ""
}

// configurable stuff
var queue = []
var cents_threshold
var queue_length
var fftSize
var yin_buffer
var sharps_or_flats

// get_freq_via_yin constants
const yin_threshold = 0.1
const yin_probabilityThreshold = 0.1

// canvas context
var ctx

document.addEventListener('DOMContentLoaded', () => {

    note_el = document.getElementById("note")
    freq_el = document.getElementById("frequency")
    cent_el = document.getElementById("cent")
    cents_threshold_input = document.getElementById("cents_threshold_input")
    steady_factor_input = document.getElementById("steady_factor_input")
    fftsize_input = document.getElementById("fftsize_input")
    transpose_octave_input = document.getElementById("transpose_octave_input")

    set_sharps_or_flats("sharps")
});

function init_web_audio() {

    navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false
    })
        .then(function (stream) {
            media_stream_source = audioCtx.createMediaStreamSource(stream);
            media_stream_source.connect(analyser);
            ready = true
        })
        .catch(function (err) {
            console.log(err)
        })
}

function set_config() {
    // init the queue
    queue = []
    queue_length = steady_factor_input.value
    for (var i = 0; i < queue_length; i++) {
        queue.push(0)
    }

    cents_threshold = cents_threshold_input.value
}

var note_letters

function set_sharps_or_flats(val) {
    sharps_or_flats = val

    if (sharps_or_flats == "sharps") {
        note_letters = sharp_note_letters
    } else {
        note_letters = flat_note_letters
    }
}

var offset_to_middle_c

function restart() {
    if (running) {
        running = false
        start()
    }
}

function live_feedback_toggle() {
    if (running) {
        running = false
    } else {
        start()
    }
}

function start() {

    set_config()

    if (first_time) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioCtx.createAnalyser();
        first_time = false
        init_web_audio()
    }

    analyser.fftSize = fftsize_input.value
    fft_array = new Float32Array(analyser.fftSize)

    // Copied from yin algo function, to get mem allocation out of the loop
    // Set buffer size to the highest power of two below the provided buffer's length.
    let bufferSize;
    for (bufferSize = 1; bufferSize < fft_array.length; bufferSize *= 2);
    bufferSize /= 2;

    // Set up the yinBuffer as described in step one of the YIN paper.
    //yin_buffer = new Float32Array(bufferSize / 2);
    // end of copy

    // corey says... results of above are:
    // 2048 = 512
    // 4096 = 1024
    // 8192 = 2048
    // 16384 = 4096
    // 32768 = 8192

    // corey says.. i don't understand the power of 2 stuff, versus half buffer size
    // so let's try divided by 2
    yin_buffer = new Float32Array(fft_array.length / 2)

    note_el.innerText = ""
    freq_el.innerText = ""
    cent_el.innerText = ""
    running = true

    requestAnimationFrame(frame_callback)
}

function frame_callback() {

    if (!running) return;

    if (!ready) {
        requestAnimationFrame(frame_callback)
        return
    }

    // Get data representing the shape of the wave
    analyser.getFloatTimeDomainData(fft_array);

    let freq = (get_freq_via_yin(fft_array, yin_buffer, yin_threshold, yin_probabilityThreshold))

    if (freq) {

        // For steadier pitch detection, save the last N frequencies and then pick the most common of the last N
        queue.shift()
        queue.push(freq.toFixed(1))

        let most_common_recent_frequency = get_mode(queue)

        // convert the frequency to the note, 440 to A4
        let note = frequency_to_note(most_common_recent_frequency)
        if (note) {
            draw_note(note)
        }
        check_feedback(note)
    }

    // loop
    requestAnimationFrame(frame_callback)
}

const number_of_staffs = 4
const canvas_width = 700
const canvas_height = 420
const line_height = 8
const staff_spacing = 50
const note_spacing = 30
const sharp_line_length = 10
const ledger_line_half_length = 10
const letter_array = ["C", "D", "E", "F", "G", "A", "B"]
var staff_number = 1
var current_x

function draw_note(note) {
    if (!note) return

    if (note.freq == prev_note.freq) {
        return
    }

    // enhance/alter the note object
    note.just_letter = note.letter.charAt(0)

    if (note.letter.length == 2) {
        // like A4
        note.accidental = ""
        note.octave = parseInt(note.letter.charAt(1))
    } else {
        // like A#4
        note.accidental = note.letter.charAt(1)
        note.octave = parseInt(note.letter.charAt(2))
    }

    // Transpose the octave.
    // A4 can become A3 or A5, etc
    note.octave = note.octave += parseInt(transpose_octave_input.value)
    note.letter = note.just_letter + note.accidental + note.octave

    note_el.innerText = note.letter
    freq_el.innerText = parseFloat(note.freq).toFixed(2)
    cent_el.innerText = note.cents

    prev_note = note
}

// Corey says...
// Implementation of the algorithm described way over my head here: http://audition.ens.fr/adc/pdf/2002_JASA_YIN.pdf
// The paper has charts that explain the settings of the variables "threshold and probabilityThreshold". 
// They seem to have figured out the best comprimise for their values, I guess.
//
// from https://github.com/peterkhayes/pitchfinder/blob/master/src/detectors/yin.ts
// and tweaked per https://github.com/ashokfernandez/Yin-Pitch-Tracking/blob/master/Yin.c
// One of them is copied from the other, but they differ in terms of the yinBuffer
// length. I moved the logic for creating the buffer out of the loop for efficiency.
function get_freq_via_yin(fft_array, yinBuffer, threshold, probabilityThreshold) {

    let probability = 0,
        tau;

    let yinBufferLength = yinBuffer.length

    yinBuffer.fill(0)

    // Corey says...The offset has the variable name "t" for tau
    // This is autocorrelation but using the square of the difference instead of the plain difference
    for (let t = 1; t < yinBufferLength; t++) {
        for (let i = 0; i < yinBufferLength; i++) {
            const delta = fft_array[i] - fft_array[i + t];
            yinBuffer[t] += delta * delta;
        }
    }

    // Compute the cumulative mean normalized difference as described in step 3 of the paper.
    yinBuffer[0] = 1;
    yinBuffer[1] = 1;
    let runningSum = 0;
    for (let t = 1; t < yinBufferLength; t++) {
        runningSum += yinBuffer[t];
        yinBuffer[t] *= t / runningSum;
    }

    // Compute the absolute threshold as described in step 4 of the paper.
    // Since the first two positions in the array are 1,
    // we can start at the third position.
    for (tau = 2; tau < yinBufferLength; tau++) {
        if (yinBuffer[tau] < threshold) {
            while (tau + 1 < yinBufferLength && yinBuffer[tau + 1] < yinBuffer[tau]) {
                tau++;
            }
            // found tau, exit loop and return
            // store the probability
            // From the YIN paper: The threshold determines the list of
            // candidates admitted to the set, and can be interpreted as the
            // proportion of aperiodic power tolerated
            // within a periodic signal.
            //
            // Since we want the periodicity and and not aperiodicity:
            // periodicity = 1 - aperiodicity
            probability = 1 - yinBuffer[tau];
            break;
        }
    }

    // if no pitch found, return null.
    if (tau === yinBufferLength || yinBuffer[tau] >= threshold) {
        return null;
    }

    // If probability too low, return -1.
    if (probability < probabilityThreshold) {
        return null;
    }

    /*
     * Implements step 5 of the AUBIO_YIN paper. It refines the estimated tau
     * value using parabolic interpolation. This is needed to detect higher
     * frequencies more precisely. See http://fizyka.umk.pl/nrbook/c10-2.pdf and
     * for more background
     * http://fedc.wiwi.hu-berlin.de/xplore/tutorials/xegbohtmlnode62.html
     */

    /* The 'best' shift value for autocorellation is most likely not an interger shift of the signal.
     * As we only autocorellated using integer shifts we should check that there isn't a better fractional 
     * shift value.
     */

    let betterTau, x0, x2;
    if (tau < 1) {
        x0 = tau;
    } else {
        x0 = tau - 1;
    }
    if (tau + 1 < yinBufferLength) {
        x2 = tau + 1;
    } else {
        x2 = tau;
    }
    if (x0 === tau) {
        if (yinBuffer[tau] <= yinBuffer[x2]) {
            betterTau = tau;
        } else {
            betterTau = x2;
        }
    } else if (x2 === tau) {
        if (yinBuffer[tau] <= yinBuffer[x0]) {
            betterTau = tau;
        } else {
            betterTau = x0;
        }
    } else {
        const s0 = yinBuffer[x0];
        const s1 = yinBuffer[tau];
        const s2 = yinBuffer[x2];
        // fixed AUBIO implementation, thanks to Karl Helgason:
        // (2.0f * s1 - s2 - s0) was incorrectly multiplied with -1
        betterTau = tau + (s2 - s0) / (2 * (2 * s1 - s2 - s0));
    }

    // return frequency
    return audioCtx.sampleRate / betterTau;
}

// frequency to note constants 
const A4 = 440.0;
const A4_INDEX = 57;

const sharp_note_letters = [
    "C0", "C#0", "D0", "D#0", "E0", "F0", "F#0", "G0", "G#0", "A0", "A#0", "B0",
    "C1", "C#1", "D1", "D#1", "E1", "F1", "F#1", "G1", "G#1", "A1", "A#1", "B1",
    "C2", "C#2", "D2", "D#2", "E2", "F2", "F#2", "G2", "G#2", "A2", "A#2", "B2",
    "C3", "C#3", "D3", "D#3", "E3", "F3", "F#3", "G3", "G#3", "A3", "A#3", "B3",
    "C4", "C#4", "D4", "D#4", "E4", "F4", "F#4", "G4", "G#4", "A4", "A#4", "B4",
    "C5", "C#5", "D5", "D#5", "E5", "F5", "F#5", "G5", "G#5", "A5", "A#5", "B5",
    "C6", "C#6", "D6", "D#6", "E6", "F6", "F#6", "G6", "G#6", "A6", "A#6", "B6",
    "C7", "C#7", "D7", "D#7", "E7", "F7", "F#7", "G7", "G#7", "A7", "A#7", "B7",
    "C8", "C#8", "D8", "D#8", "E8", "F8", "F#8", "G8", "G#8", "A8", "A#8", "B8",
    "C9", "C#9", "D9", "D#9", "E9", "F9", "F#9", "G9", "G#9", "A9", "A#9", "B9"
];

const flat_note_letters = [
    "C0", "Df0", "D0", "Ef0", "E0", "F0", "Gf0", "G0", "Af0", "A0", "Bf0", "B0",
    "C1", "Df1", "D1", "Ef1", "E1", "F1", "Gf1", "G1", "Af1", "A1", "Bf1", "B1",
    "C2", "Df2", "D2", "Ef2", "E2", "F2", "Gf2", "G2", "Af2", "A2", "Bf2", "B2",
    "C3", "Df3", "D3", "Ef3", "E3", "F3", "Gf3", "G3", "Af3", "A3", "Bf3", "B3",
    "C4", "Df4", "D4", "Ef4", "E4", "F4", "Gf4", "G4", "Af4", "A4", "Bf4", "B4",
    "C5", "Df5", "D5", "Ef5", "E5", "F5", "Gf5", "G5", "Af5", "A5", "Bf5", "B5",
    "C6", "Df6", "D6", "Ef6", "E6", "F6", "Gf6", "G6", "Af6", "A6", "Bf6", "B6",
    "C7", "Df7", "D7", "Ef7", "E7", "F7", "Gf7", "G7", "Af7", "A7", "Bf7", "B7",
    "C8", "Df8", "D8", "Ef8", "E8", "F8", "Gf8", "G8", "Af8", "A8", "Bf8", "B8",
    "C9", "Df9", "D9", "Ef9", "E9", "F9", "Gf9", "G9", "Af9", "A9", "Bf9", "B9"
];


const MINUS = -1;
const PLUS = 1;
const r = Math.pow(2.0, 1.0 / 12.0);
const cent = Math.pow(2.0, 1.0 / 1200.0);

// Corey says...from https://newt.phys.unsw.edu.au/music/note/, then I tweaked it
function frequency_to_note(input) {
    //  if ((input < 27.5) || (input > 14080))

    // Corey says...low end, viola C string, high end violin high b on e string
    // We want to filter out more extreme notes which tend to be noise, harmonics
    if ((input < 124) || (input > 2000))
        return null

    var frequency;
    var r_index = 0;
    var cent_index = 0;
    var side;

    frequency = A4;

    if (input >= frequency) {
        while (input >= r * frequency) {
            frequency = r * frequency;
            r_index++;
        }
        while (input > cent * frequency) {
            frequency = cent * frequency;
            cent_index++;
        }
        if ((cent * frequency - input) < (input - frequency))
            cent_index++;
        if (cent_index > 50) {
            r_index++;
            cent_index = 100 - cent_index;
            if (cent_index != 0)
                side = MINUS;
            else
                side = PLUS;
        } else
            side = PLUS;
    } else {
        while (input <= frequency / r) {
            frequency = frequency / r;
            r_index--;
        }
        while (input < frequency / cent) {
            frequency = frequency / cent;
            cent_index++;
        }
        if ((input - frequency / cent) < (frequency - input))
            cent_index++;
        if (cent_index >= 50) {
            r_index--;
            cent_index = 100 - cent_index;
            side = PLUS;
        } else {
            if (cent_index != 0)
                side = MINUS;
            else
                side = PLUS;
        }
    }

    var letter = note_letters[A4_INDEX + r_index];

    return {
        letter: letter,
        cents: side * cent_index,
        freq: input,
    }
}

// get most frequencly occuring value in an array, aka, the mode. from stackoverflow 
function get_mode(array) {
    if (array.length == 0)
        return null;
    var modeMap = {};
    var maxEl = array[0],
        maxCount = 1;
    for (var i = 0; i < array.length; i++) {
        var el = array[i];
        if (modeMap[el] == null)
            modeMap[el] = 1;
        else
            modeMap[el]++;
        if (modeMap[el] > maxCount) {
            maxEl = el;
            maxCount = modeMap[el];
        }
    }
    return maxEl;
}