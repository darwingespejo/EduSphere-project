import { useCallback, useEffect, useRef, useState } from 'react';
import { runCommand, smallTalk, parseMood } from './offlineBrain.js';

const MAX_LEN = 300;
const MAX_HISTORY = 12;

/**
 * Chat state for Pico: the speech bubble, the request to your backend, and the offline fallback.
 *
 * Backend contract (see backend/app/controllers/PicoChat.php):
 *   POST {endpoint}  body: { messages: [{role, content}], context?: {...} }
 *   200  { ok: true, reply: "text", mood: "happy" }
 *   4xx/5xx { ok: false, error: { code, message } }
 *
 * `engineRef.current` is the object returned by createPicoEngine().
 */
export function usePicoChat({ engineRef, endpoint, fetchOptions, context, onMessage, timeoutMs = 25000 }) {
  const [bubble, setBubble] = useState({ text: '', visible: false, thinking: false });
  const [busy, setBusy] = useState(false);
  const [online, setOnline] = useState(Boolean(endpoint));

  const history = useRef([]);
  const reqId = useRef(0);
  const abortRef = useRef(null);
  const hideTimer = useRef(0);
  const typeTimer = useRef(0);
  const voiceRef = useRef(false);
  const touched = useRef(false);
  const optsRef = useRef({});
  optsRef.current = { endpoint, fetchOptions, context, onMessage, timeoutMs };

  const reduceMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  const clearTimers = useCallback(() => {
    clearTimeout(hideTimer.current);
    clearInterval(typeTimer.current);
  }, []);

  useEffect(
    () => () => {
      clearTimers();
      abortRef.current?.abort();
      try {
        window.speechSynthesis?.cancel();
      } catch (e) {
        /* ignore */
      }
    },
    [clearTimers]
  );

  const scheduleHide = useCallback((ms) => {
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setBubble((b) => ({ ...b, visible: false })), ms);
  }, []);

  const speak = useCallback((text) => {
    if (!voiceRef.current || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.pitch = 1.7;
      u.rate = 1.05;
      window.speechSynthesis.speak(u);
    } catch (e) {
      /* ignore */
    }
  }, []);

  const setVoice = useCallback((on) => {
    voiceRef.current = on;
    if (on) speak('Voice on.');
    else {
      try {
        window.speechSynthesis?.cancel();
      } catch (e) {
        /* ignore */
      }
    }
  }, [speak]);

  /** Show text in the bubble and make Pico talk. */
  const say = useCallback(
    (text, mood, opt = {}) => {
      const eng = engineRef.current;
      clearInterval(typeTimer.current);
      const dur = 500 + text.length * 42;
      if (eng && !opt.quiet) {
        if (mood) eng.setExpression(mood, 2600 + text.length * 40);
        eng.talkFor(dur);
      }
      if (opt.instant || reduceMotion) {
        setBubble({ text, visible: true, thinking: false });
      } else {
        let i = 0;
        setBubble({ text: '', visible: true, thinking: false });
        typeTimer.current = setInterval(() => {
          i += 2;
          setBubble({ text: text.slice(0, i), visible: true, thinking: false });
          if (i >= text.length) clearInterval(typeTimer.current);
        }, 28);
      }
      scheduleHide(opt.hideAfter ?? Math.max(6500, dur + 4500));
      if (!opt.quiet) speak(text);
    },
    [engineRef, reduceMotion, scheduleHide, speak]
  );

  const startThinking = useCallback(() => {
    clearInterval(typeTimer.current);
    clearTimeout(hideTimer.current);
    engineRef.current?.setThinking(true);
    setBubble({ text: '', visible: true, thinking: true });
  }, [engineRef]);

  const stopThinking = useCallback(() => {
    engineRef.current?.setThinking(false);
  }, [engineRef]);

  const ask = useCallback(
    async (raw) => {
      const text = String(raw || '').trim().slice(0, MAX_LEN);
      const eng = engineRef.current;
      if (!text || !eng) return;
      touched.current = true;

      // 1) scene commands never leave the browser
      const cmd = runCommand(text, eng);
      if (cmd) {
        say(cmd.text, cmd.mood, cmd);
        return;
      }
      eng.wake();

      const { endpoint: url, fetchOptions: fo, context: ctx, onMessage: cb, timeoutMs: tmo } = optsRef.current;

      // 2) no backend configured, or it failed earlier: offline small talk
      if (!url) {
        const r = smallTalk(text);
        say(r.text, r.mood);
        return;
      }

      // 3) ask the backend
      const my = ++reqId.current;
      abortRef.current?.abort();
      const ctl = new AbortController();
      abortRef.current = ctl;
      const timer = setTimeout(() => ctl.abort('timeout'), tmo);
      history.current.push({ role: 'user', content: text });
      while (history.current.length > MAX_HISTORY) history.current.shift();
      setBusy(true);
      startThinking();

      try {
        const baseHeaders = { 'Content-Type': 'application/json', Accept: 'application/json' };
        const res = await fetch(url, {
          method: 'POST',
          ...fo,
          headers: { ...baseHeaders, ...(fo && fo.headers) },
          body: JSON.stringify({ messages: history.current, context: ctx || undefined }),
          signal: ctl.signal,
        });
        let data = null;
        try {
          data = await res.json();
        } catch (e) {
          /* non-JSON error page */
        }
        if (my !== reqId.current) return;
        if (!res.ok || !data || data.ok === false) {
          const err = new Error((data && data.error && data.error.message) || `HTTP ${res.status}`);
          err.code = (data && data.error && data.error.code) || `http_${res.status}`;
          err.status = res.status;
          throw err;
        }
        // The server already strips the mood tag, but cope with a raw tag too.
        const raw = String(data.reply || '').trim();
        const parsed = parseMood(raw);
        const body = parsed.body || raw;
        const mood = data.mood && data.mood !== 'calm' ? data.mood : parsed.mood || (data.mood === 'calm' ? 'neutral' : 'happy');
        if (!body) throw Object.assign(new Error('Empty reply'), { code: 'empty_reply' });
        // keep the mood tag in the history so the model keeps following the reply format
        history.current.push({ role: 'assistant', content: `[${mood === 'neutral' ? 'calm' : mood}] ${body}` });
        while (history.current.length > MAX_HISTORY) history.current.shift();
        setOnline(true);
        stopThinking();
        say(body, mood, { instant: false, hideAfter: Math.max(7000, 3000 + body.length * 60) });
        cb?.({ role: 'assistant', text: body, mood });
      } catch (e) {
        if (my !== reqId.current) return;
        stopThinking();
        history.current.pop(); // drop the unanswered user turn
        if (e && e.name === 'AbortError' && ctl.signal.reason !== 'timeout') return;
        const code = (e && e.code) || (ctl.signal.reason === 'timeout' ? 'timeout' : 'network');
        const status = e && e.status;
        if (code === 'rate_limited' || status === 429) {
          say('I need a short breather. Ask me again in a bit?', 'think');
        } else if (code === 'unauthorized' || status === 401 || status === 403) {
          setOnline(false);
          const r = smallTalk(text, 'My brain link needs you to sign in first. Commands still work: wave, dance, sleep, or a glow color.');
          say(r.text, r.mood);
        } else if (code === 'not_configured' || status === 503) {
          setOnline(false);
          const r = smallTalk(text, 'My brain link is not set up on the server yet. Commands still work: wave, dance, sleep, or a glow color.');
          say(r.text, r.mood);
        } else if (code === 'refused') {
          say('I would rather not answer that one. Ask me something else?', 'neutral');
        } else {
          console.warn('[Pico] chat request failed:', e);
          const r = smallTalk(text, 'My signal dropped for a second. Ask me again?');
          say(r.text, r.mood);
        }
      } finally {
        clearTimeout(timer);
        if (my === reqId.current) {
          setBusy(false);
          stopThinking();
        }
      }
    },
    [engineRef, say, startThinking, stopThinking]
  );

  return { bubble, busy, online, ask, say, setVoice, touched, history };
}
