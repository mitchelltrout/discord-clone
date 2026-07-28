/**
 * Synthesized UI sounds using the Web Audio API.
 * No audio files needed — tones are generated programmatically.
 */

let ctx = null;

function getCtx() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  return ctx;
}

function playTone({ frequency, duration, type = 'sine', gain = 0.3, fadeOut = true }) {
  try {
    const ac = getCtx();
    const osc = ac.createOscillator();
    const gainNode = ac.createGain();

    osc.connect(gainNode);
    gainNode.connect(ac.destination);

    osc.type = type;
    osc.frequency.setValueAtTime(frequency, ac.currentTime);
    gainNode.gain.setValueAtTime(gain, ac.currentTime);

    if (fadeOut) {
      gainNode.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration);
    }

    osc.start(ac.currentTime);
    osc.stop(ac.currentTime + duration);
  } catch (err) {
    // Silently fail — audio is non-critical
  }
}

function playSequence(notes) {
  let delay = 0;
  const ac = getCtx();
  for (const note of notes) {
    try {
      const osc = ac.createOscillator();
      const gainNode = ac.createGain();
      osc.connect(gainNode);
      gainNode.connect(ac.destination);

      osc.type = note.type || 'sine';
      osc.frequency.setValueAtTime(note.frequency, ac.currentTime + delay);
      gainNode.gain.setValueAtTime(note.gain || 0.3, ac.currentTime + delay);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + delay + note.duration);

      osc.start(ac.currentTime + delay);
      osc.stop(ac.currentTime + delay + note.duration);

      delay += note.gap || note.duration;
    } catch (err) {
      // Silently fail
    }
  }
}

// You joined a voice channel — ascending two-note chime
export function playJoinSelf() {
  playSequence([
    { frequency: 660, duration: 0.12, gap: 0.1, gain: 0.25 },
    { frequency: 880, duration: 0.18, gain: 0.25 },
  ]);
}

// You left a voice channel — descending two-note chime
export function playLeaveSelf() {
  playSequence([
    { frequency: 880, duration: 0.12, gap: 0.1, gain: 0.2 },
    { frequency: 660, duration: 0.18, gain: 0.2 },
  ]);
}

// Someone else joined your channel — soft single blip
export function playUserJoined() {
  playTone({ frequency: 800, duration: 0.15, type: 'sine', gain: 0.2 });
}

// Someone else left your channel — softer lower blip
export function playUserLeft() {
  playTone({ frequency: 600, duration: 0.15, type: 'sine', gain: 0.15 });
}

// Notification / alert sound
export function playNotification() {
  playSequence([
    { frequency: 880, duration: 0.1, gap: 0.08, gain: 0.2 },
    { frequency: 1100, duration: 0.1, gap: 0.08, gain: 0.2 },
    { frequency: 880, duration: 0.15, gain: 0.2 },
  ]);
}
