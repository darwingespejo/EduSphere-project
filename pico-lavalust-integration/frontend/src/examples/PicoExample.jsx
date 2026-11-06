import { useRef } from 'react';
import { PicoAssistant } from '../components/pico';

/**
 * Drop-in examples. Pick the one that matches your layout.
 */

// 1) Full-page assistant
export function PicoPage() {
  return (
    <div style={{ height: '100vh' }}>
      <PicoAssistant />
    </div>
  );
}

// 2) A panel inside your dashboard, sending the current page to the backend as context
export function PicoPanel({ user, page }) {
  const pico = useRef(null);
  return (
    <section style={{ height: 560, borderRadius: 16, overflow: 'hidden' }}>
      <PicoAssistant
        ref={pico}
        context={{ page, userName: user?.name }}
        // send cookies (session auth) or a token along with each chat request:
        fetchOptions={{ credentials: 'include' /*, headers: { Authorization: `Bearer ${token}` } */ }}
        glow="#a78bff"
        chips={[
          { label: 'Help me here', say: 'What can I do on this page?' },
          { label: 'Dance', say: 'dance' },
        ]}
        onMessage={(m) => console.log('Pico said:', m.text)}
      />
      <button onClick={() => pico.current?.say('Triggered from my own button!', 'sparkle')}>Make Pico talk</button>
    </section>
  );
}

// 3) No backend at all: commands and canned small talk only
export function PicoOffline() {
  return (
    <div style={{ height: 480 }}>
      <PicoAssistant endpoint={null} />
    </div>
  );
}
