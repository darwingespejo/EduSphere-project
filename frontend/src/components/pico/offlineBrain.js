import { VIEWS, GLOWS } from './engine/views.js';

/**
 * Pico's local brain. It handles scene commands ("dance", "show your back", "glow pink")
 * without touching the network, plus a few canned small-talk replies that are used
 * when the backend is unreachable.
 *
 * runCommand() performs the action on the engine and returns what Pico should say,
 * or null when the text is not a command.
 */

const COLOR_WORDS = [
  [/\b(cyan|teal|blue|aqua)\b/, 0],
  [/\b(violet|purple|lilac)\b/, 1],
  [/\b(lime|green)\b/, 2],
  [/\b(amber|orange|yellow|gold)\b/, 3],
  [/\b(rose|pink|red|magenta)\b/, 4],
];

const JOKES = [
  'Why did the robot go on vacation? It needed to recharge its batteries.',
  'I would tell you a UDP joke, but you might not get it.',
  'Why do robots never panic? They have nerves of steel.',
  "What is a robot's favorite snack? Micro-chips.",
];

const pickView = (id) => VIEWS.find((v) => v.id === id);

export function runCommand(raw, engine) {
  const t = String(raw || '').toLowerCase();
  if (!engine) return null;

  if (/\b(dance|boogie|groove)\b/.test(t)) {
    engine.dance();
    return { text: 'Ooh, music in my servos! Watch this.', mood: 'sparkle', instant: true };
  }
  if (/\b(wave|say hello with your arm)\b/.test(t)) {
    engine.wave();
    return { text: 'Hi there!', mood: 'happy' };
  }
  if (/\b(wake up|wake|good morning)\b/.test(t)) {
    if (engine.isSleeping()) {
      engine.wake();
      return { text: 'Good morning! Systems at full glow.', mood: 'happy' };
    }
    return { text: 'I am already awake and glowing.', mood: 'happy' };
  }
  if (/\b(sleep|nap|good ?night|go to bed)\b/.test(t)) {
    engine.sleep();
    return { text: 'Zzz... (tap me or say wake up)', mood: null, quiet: true, hideAfter: 5000 };
  }
  if (/\b(stop spinning|stop spin)\b/.test(t)) {
    engine.setAutoSpin(false);
    return { text: 'Stopped.', mood: 'happy' };
  }
  if (/(show|view|turn|look|angle|camera|side|spin|rotate)/.test(t)) {
    let v = null;
    if (/back|behind|rear/.test(t)) v = pickView('back');
    else if (/\bleft\b/.test(t)) v = pickView('left');
    else if (/\bright\b/.test(t)) v = pickView('right');
    else if (/top|above|overhead|bird/.test(t)) v = pickView('top');
    else if (/close|face|zoom|screen/.test(t)) v = pickView('face');
    else if (/low|below|hero/.test(t)) v = pickView('low');
    else if (/front/.test(t)) v = pickView('front');
    else if (/3\/4|three.?quarter|¾/.test(t)) v = pickView('l34');
    if (v) {
      engine.setAutoSpin(false);
      engine.flyTo(v.id);
      return { text: `Here is my ${v.n.toLowerCase()} view.`, mood: 'happy' };
    }
    if (/spin|rotate|turntable|all around|every angle/.test(t)) {
      engine.setAutoSpin(true);
      return { text: 'Spinning the turntable. Tap Auto-spin to stop.', mood: 'sparkle' };
    }
  }
  if (/(glow|colou?r|light|\bturn\b|\bgo\b)/.test(t)) {
    for (const [re, i] of COLOR_WORDS) {
      if (re.test(t)) {
        engine.setGlow(GLOWS[i].c);
        return { text: `Glowing ${GLOWS[i].n.toLowerCase()} now.`, mood: 'sparkle' };
      }
    }
  }
  return null;
}

const SMALL_TALK = [
  [/\b(hi|hello|hey|yo)\b/, () => ['happy', 'Hi! I am Pico. Spin me around, poke my antenna, or ask me something.']],
  [/(your name|who are you)/, () => ['happy', 'I am Pico, a small robot who lives on this turntable.']],
  [/joke/, () => ['wink', JOKES[Math.floor(Math.random() * JOKES.length)]]],
  [/(what can you do|help)/, () => ['sparkle', 'Orbit me to any angle, tap my ears, belly or antenna, or say wave, dance, sleep or a glow color.']],
  [/thank/, () => ['love', 'Any time! Beep boop.']],
  [/how are you/, () => ['happy', 'Fully charged and glowing. How are you?']],
  [/\b(time|date|day)\b/, () => ['think', `It is ${new Date().toLocaleString([], { weekday: 'long', hour: 'numeric', minute: '2-digit' })} on your clock.`]],
  [/(love|cute|adorable)/, () => ['love', 'My ear rings are blushing.']],
];

/** Offline fallback reply. `why` overrides the default "I can only do commands" line. */
export function smallTalk(text, why) {
  const t = String(text || '').toLowerCase();
  for (const [re, fn] of SMALL_TALK) {
    if (re.test(t)) {
      const [mood, line] = fn();
      return { text: line, mood };
    }
  }
  return {
    text: why || 'I can only do commands and small talk offline: try wave, dance, sleep, or tell me a glow color.',
    mood: 'think',
  };
}

/** Pulls a leading "[mood]" tag off a reply. Also copes with a half-arrived tag. */
const MOODS = { happy: 'happy', wow: 'wow', love: 'love', think: 'think', wink: 'wink', calm: 'neutral', sparkle: 'sparkle', neutral: 'neutral' };
export function parseMood(t) {
  const s = String(t || '');
  const m = /^\s*\[(\w+)\]\s*/.exec(s);
  if (m) return { mood: MOODS[m[1].toLowerCase()] || 'happy', body: s.slice(m[0].length) };
  if (/^\s*\[[^\]]*$/.test(s)) return { mood: null, body: '' };
  return { mood: null, body: s };
}
