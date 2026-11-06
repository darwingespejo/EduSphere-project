import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import './PicoAssistant.css';
import { createPicoEngine } from './engine/createPicoEngine.js';
import { VIEWS, GLOWS, viewLabel } from './engine/views.js';
import { usePicoChat } from './usePicoChat.js';

const DEFAULT_ENDPOINT =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_PICO_API_URL) || '/api/pico/chat';

const DEFAULT_GREETING = 'Hi, I am Pico. Drag to spin me to any angle, tap my ears or antenna, or type something.';

const DEFAULT_CHIPS = [
  { label: 'Say hi', say: 'Say hi to me' },
  { label: 'Joke', say: 'Tell me a joke' },
  { label: 'What can you do?', say: 'What can you do?' },
  { label: 'Dance', say: 'dance' },
  { label: 'Wave', say: 'wave' },
  { label: 'Show your back', say: 'show me your back' },
];

const softOf = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},.2)`;
};

/**
 * <PicoAssistant /> - the interactive 3D robot with a chat dock.
 *
 * The parent element must have a height (the component fills 100% of it).
 *
 * Props
 *   endpoint      URL of the chat route. Default: VITE_PICO_API_URL or "/api/pico/chat".
 *                 Pass null to run fully offline (commands and canned small talk only).
 *   fetchOptions  Extra fetch() options, e.g. { credentials: 'include', headers: { Authorization: 'Bearer ...' } }
 *   context       Any JSON object. Sent to the backend with every message so Pico can know where the user is.
 *   glow          Glow color "#rrggbb" (default cyan).
 *   greeting      Text Pico says on first load. Pass false to stay quiet.
 *   chips         Quick-reply buttons: [{ label, say }]. Pass [] to hide them.
 *   showAngles / showTools / showReadout / showChat   toggle parts of the UI
 *   placeholder   Chat input placeholder
 *   onReady(engine)           first frame drawn
 *   onMessage({role,text,mood})  Pico's replies from the backend
 *   onError(message)          WebGL could not start
 *   className, style          applied to the root element
 *
 * Ref: { ask(text), say(text, mood), engine }
 */
const PicoAssistant = forwardRef(function PicoAssistant(
  {
    endpoint = DEFAULT_ENDPOINT,
    fetchOptions,
    context,
    glow = GLOWS[0].c,
    greeting = DEFAULT_GREETING,
    chips = DEFAULT_CHIPS,
    showAngles = true,
    showTools = true,
    showReadout = true,
    showChat = true,
    placeholder,
    onReady,
    onMessage,
    onError,
    className = '',
    style,
  },
  ref
) {
  const stageRef = useRef(null);
  const engineRef = useRef(null);
  const readoutRef = useRef(null);
  const lastRead = useRef({ az: 0, el: 6, zoom: 1 });
  const inputRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState('');
  const [activeView, setActiveView] = useState(null);
  const [spin, setSpin] = useState(false);
  const [sleeping, setSleeping] = useState(false);
  const [glowHex, setGlowHex] = useState(/^#[0-9a-f]{6}$/i.test(glow) ? glow : GLOWS[0].c);
  const [voice, setVoice] = useState(false);
  const [hintGone, setHintGone] = useState(false);
  const [text, setText] = useState('');

  const url = endpoint || null;
  const chat = usePicoChat({ engineRef, endpoint: url, fetchOptions, context, onMessage });
  const chatRef = useRef(chat);
  chatRef.current = chat;
  const cb = useRef({});
  cb.current = { onReady, onError, greeting };

  /* ---- create and destroy the 3D scene ---- */
  useEffect(() => {
    const host = stageRef.current;
    if (!host) return undefined;
    // The canvas is created here (not in JSX) so React StrictMode's mount, unmount, mount
    // cycle always gets a fresh WebGL context.
    const canvas = document.createElement('canvas');
    canvas.tabIndex = 0;
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', 'Interactive 3D robot named Pico. Drag to rotate, scroll or pinch to zoom, arrow keys to turn.');
    host.appendChild(canvas);

    let engine;
    let greetTimer = 0;
    try {
      engine = createPicoEngine(canvas, {
        glow: glowHex,
        onReady: () => {
          setLoading(false);
          cb.current.onReady?.(engine);
        },
        onReadout: (r) => {
          lastRead.current = r;
          const el = readoutRef.current;
          if (el) {
            el.textContent = `AZ ${String(r.az).padStart(3, '0')}°  EL ${String(r.el).padStart(2, '0')}°  ZOOM ${r.zoom.toFixed(2)}×`;
          }
        },
        onViewChange: setActiveView,
        onSleepChange: setSleeping,
        onSpinChange: setSpin,
        onGlowChange: setGlowHex,
        onSpeak: (line, mood) => chatRef.current.say(line, mood),
        onInteract: () => {
          chatRef.current.touched.current = true;
          setHintGone(true);
        },
      });
    } catch (e) {
      canvas.remove();
      setLoading(false);
      setFailed(e && e.message ? e.message : 'WebGL is not available.');
      cb.current.onError?.(e && e.message);
      return undefined;
    }
    engineRef.current = engine;

    greetTimer = setTimeout(() => {
      const g = cb.current.greeting;
      if (g && !chatRef.current.touched.current && !engine.isSleeping() && !engine.state.thinking) {
        engine.wave();
        chatRef.current.say(g, 'happy');
      }
    }, 1400);

    return () => {
      clearTimeout(greetTimer);
      engine.dispose();
      engineRef.current = null;
      canvas.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // keep the scene in sync when the parent changes the glow prop
  useEffect(() => {
    if (/^#[0-9a-f]{6}$/i.test(glow)) engineRef.current?.setGlow(glow);
  }, [glow]);

  useImperativeHandle(
    ref,
    () => ({
      ask: (t) => chatRef.current.ask(t),
      say: (t, mood) => chatRef.current.say(t, mood),
      get engine() {
        return engineRef.current;
      },
    }),
    []
  );

  /* ---- UI handlers ---- */
  const submit = (e) => {
    e.preventDefault();
    const v = text;
    setText('');
    chat.ask(v);
  };
  const flyTo = (id) => {
    engineRef.current?.flyTo(id);
    setHintGone(true);
  };
  const toggleSleep = () => {
    const eng = engineRef.current;
    if (!eng) return;
    if (eng.isSleeping()) {
      eng.wake();
      chat.say('Good morning!', 'happy');
    } else eng.sleep();
  };
  const toggleVoice = () => {
    const next = !voice;
    setVoice(next);
    chat.setVoice(next);
  };
  const save = async () => {
    const eng = engineRef.current;
    if (!eng) return;
    const blob = await eng.snapshot();
    if (!blob) return;
    const r = lastRead.current;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `pico-az${String(r.az).padStart(3, '0')}-el${r.el}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    chat.say('Saved. That is my good side.', 'wink');
  };

  const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const ph = placeholder ?? (url ? 'Ask Pico anything' : 'Try: wave, dance, sleep, glow pink, show your back');

  return (
    <div
      className={`pico ${className}`.trim()}
      style={{ '--glow': glowHex, '--glow-soft': softOf(glowHex), ...style }}
    >
      <div className="pico-stage" ref={stageRef} />

      {!failed && (
        <div className="pico-ui">
          <header className="pico-bar">
            <div className="pico-brand">
              <div className="pico-brand-row">
                <span className="pico-mark" aria-hidden="true" />
                <span className="pico-name">PICO</span>
                <span className="pico-tag">3D assistant</span>
              </div>
              {showReadout && (
                <div className="pico-readout" ref={readoutRef} aria-hidden="true">
                  AZ 000°  EL 06°  ZOOM 1.00×
                </div>
              )}
              {showReadout && (
                <div className={`pico-hint${hintGone ? ' gone' : ''}`}>Drag to orbit, scroll to zoom, tap Pico.</div>
              )}
            </div>

            {showTools && (
              <div className="pico-tools">
                <button
                  className="pico-btn"
                  type="button"
                  aria-pressed={spin}
                  onClick={() => engineRef.current?.setAutoSpin(!spin)}
                >
                  Auto-spin
                </button>
                {canSpeak && (
                  <button className="pico-btn" type="button" aria-pressed={voice} onClick={toggleVoice}>
                    Voice
                  </button>
                )}
                <button className="pico-btn" type="button" aria-pressed={sleeping} onClick={toggleSleep}>
                  {sleeping ? 'Wake' : 'Sleep'}
                </button>
                <button className="pico-btn" type="button" onClick={save}>
                  Save picture
                </button>
                <div className="pico-swatches" role="group" aria-label="Glow color">
                  {GLOWS.map((g) => (
                    <button
                      key={g.c}
                      type="button"
                      className="pico-sw"
                      style={{ '--c': g.c }}
                      title={`${g.n} glow`}
                      aria-label={`${g.n} glow`}
                      aria-pressed={g.c === glowHex}
                      onClick={() => engineRef.current?.setGlow(g.c)}
                    />
                  ))}
                </div>
              </div>
            )}
          </header>

          <div className="pico-mid">
            {showAngles && (
              <nav className="pico-rail" aria-label="Camera angles">
                <span className="pico-rail-cap">Angles</span>
                {VIEWS.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    className={`pico-view${activeView === v.id ? ' on' : ''}`}
                    aria-pressed={activeView === v.id}
                    onClick={() => flyTo(v.id)}
                  >
                    <b>{v.n}</b>
                    <i>{viewLabel(v)}</i>
                  </button>
                ))}
              </nav>
            )}
          </div>

          {showChat && (
            <footer className="pico-dock">
              <div className="pico-bubble" hidden={!chat.bubble.visible}>
                <div className="pico-card">
                  <span className="pico-who">PICO</span>
                  <p aria-live="polite">
                    {chat.bubble.thinking ? (
                      <span className="pico-dots" role="status" aria-label="Pico is thinking">
                        <span />
                        <span />
                        <span />
                      </span>
                    ) : (
                      chat.bubble.text
                    )}
                  </p>
                </div>
              </div>
              <form className="pico-chat" onSubmit={submit} autoComplete="off">
                <input
                  ref={inputRef}
                  type="text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  maxLength={300}
                  placeholder={ph}
                  aria-label="Message to Pico"
                />
                <button className="pico-send" type="submit">
                  Send
                </button>
              </form>
              {chips && chips.length > 0 && (
                <div className="pico-chips">
                  {chips.map((c) => (
                    <button key={c.label} className="pico-btn" type="button" onClick={() => chat.ask(c.say)}>
                      {c.label}
                    </button>
                  ))}
                </div>
              )}
            </footer>
          )}
        </div>
      )}

      <div
        className={`pico-loading${loading || failed ? '' : ' done'}`}
        role={failed ? 'alert' : 'status'}
        aria-hidden={!loading && !failed}
      >
        {failed ? (
          <div className="pico-fail">
            Pico needs WebGL to show up, and this browser could not start it. Check that hardware acceleration is on, then reload.
          </div>
        ) : (
          <div>
            <div className="pico-pulse" />
            Waking Pico
          </div>
        )}
      </div>
    </div>
  );
});

export default PicoAssistant;
