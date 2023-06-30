class MovingAverage {
    constructor(windowSize) {
      this.windowSize = windowSize;
      this.values = [];
    }
  
    push(value) {
      if (this.values.length >= this.windowSize) {
        this.values.shift();
      }
      this.values.push(value);
    }
  
    getAverage() {
      if (this.values.length === 0) {
        return null;
      }
      const sum = this.values.reduce((acc, curr) => acc + curr, 0);
      return sum / this.values.length;
    }
}
  
const movingAverageFilter = new MovingAverage(5);

const Pitchfinder = require('pitchfinder');
const detectPitch = Pitchfinder.AMDF();
const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function frequencyToNoteName(frequency) {
  const noteNumber = 12 * Math.log2(frequency / 440) + 69;
  const noteIndex = Math.round(noteNumber) % 12;
  const octave = Math.floor(noteNumber / 12) - 1;
  return `${noteNames[noteIndex]}${octave}`;
}

navigator.mediaDevices.getUserMedia({ audio: true })
  .then((stream) => {
    const audioContext = new AudioContext();
    const sampleRate = audioContext.sampleRate;
    const source = audioContext.createMediaStreamSource(stream);
    const processor = audioContext.createScriptProcessor(1024, 1, 1);
    const frequencyElement = document.getElementById('frequency');
    const noteElement = document.getElementById('note');
    const live_feedback = document.querySelector("#live_feedback")

    processor.onaudioprocess = (event) => {
        if (live_feedback.checked){

          const audioBuffer = event.inputBuffer.getChannelData(0);
          const result = detectPitch(audioBuffer, sampleRate);
        
          if (result) {
            movingAverageFilter.push(result);
            const frequency = movingAverageFilter.getAverage();
            frequencyElement.textContent = frequency.toFixed(2).padEnd(7, '\u00A0');
            noteElement.textContent = frequencyToNoteName(frequency).padEnd(3, '\u00A0');
            frequency_hearing = frequency;
            accuracy_in_cents = 1200 * Math.log2(frequency_target/frequency_hearing);
    
            let noteCursor = document.querySelector('.at-cursor-note');
            let deviation = (accuracy_in_cents/100);
            let multiplier = 1-Math.abs(deviation)/12
            let channel_red = 255 * (1-multiplier);
            let channel_green = 200 * multiplier;
            noteCursor.style.opacity = multiplier*0.9;
            noteCursor.style.backgroundColor = "rgb(" + channel_red + ", " + channel_green + ", 150)";
            noteCursor.style.transform = "translate(" + at_cursor_note_x + "px, " + (at_cursor_note_y+deviation*staff_lines_distance/4) + "px)";  
            
            if(Math.abs(deviation)<accuracy && !has_started_playing && !current_note_is_silence){
              // started playing the note
              startTimer();
            }
            if(Math.abs(deviation) > accuracy && !current_note_is_silence){
              // false note is played or got deviated
              resetTimer();
            }
            if(playing_timer_timeElapsed >= playing_duration && has_started_playing && !current_note_is_silence){
              // played the right note for correct duration
              resetTimer();
              console.log("played");
              api.onBeatMouseDown(null, next_beat_to_play);
              api.onBeatMouseUp(null, next_beat_to_play);
            }
            
            if(current_note_is_silence){
              // a note is played but should be silenced
              resetTimer();
            }

          } else {
            // no note is played
            if(!current_note_is_silence){
              // note should not be cut
              resetTimer();
            }
            if(current_note_is_silence && !has_started_playing){
              // start being silenced
              startTimer();
            }
            if(playing_timer_timeElapsed >= playing_duration && current_note_is_silence){
              // have been silenced for duration
              resetTimer();
              console.log("played");
              api.onBeatMouseDown(null, next_beat_to_play);
              api.onBeatMouseUp(null, next_beat_to_play);
            }
          }
        }
      };      

    source.connect(processor);
    processor.connect(audioContext.destination);
  })
  .catch((error) => {
    console.error('Error accessing the microphone:', error);
  });
