# Pico: 3D robot assistant for React + Vite, powered by LavaLust

An interactive 3D robot (orbit, zoom, tap its ears and antenna, camera angles, glow colors, dance, sleep)
with a chat box. Replies come from the Claude API through **your LavaLust backend**, so the API key never
reaches the browser.

```
React (Vite)                         LavaLust (PHP)                      Anthropic
<PicoAssistant />  --POST JSON-->   PicoChat::send()  --POST-->         /v1/messages
  3D scene, chat UI  <--reply+mood--  validate, rate limit, key in .env  <--text--
```

Commands like "dance", "show your back" or "glow pink" are handled in the browser and never hit the server.
If the backend is down, Pico still works with commands and a few canned replies.

## What is in this folder

```
frontend/
  src/components/pico/          <- copy this folder into your project
    PicoAssistant.jsx           the component
    PicoAssistant.css           styles, all scoped under .pico
    usePicoChat.js              chat + backend call + offline fallback
    offlineBrain.js             local commands and small talk
    engine/                     the Three.js scene (no React inside)
    index.js
  src/examples/PicoExample.jsx  copy-paste usage examples
  vite.config.example.js        dev proxy to LavaLust
  .env.example
backend/
  app/controllers/PicoChat.php  <- copy into LavaLust's app/controllers/
  snippets/routes.pico.php      route line for app/config/routes.php
  snippets/config.pico.php      CORS setting (only for cross-origin setups)
  env.pico.example              lines for LavaLust's .env
```

## Install, 6 steps

### Frontend

1. Copy `frontend/src/components/pico/` to `src/components/pico/` in your React project.
2. Install Three.js **at exactly this version** (the scene is written against r147; later releases removed APIs it uses):
   ```bash
   npm i three@0.147.0
   ```
   React 17+ is fine (tested on React 18.3 with StrictMode, Vite 5).
3. Use it. The parent element **must have a height**, the component fills it:
   ```jsx
   import { PicoAssistant } from './components/pico';

   export default function Assistant() {
     return (
       <div style={{ height: '100vh' }}>
         <PicoAssistant />
       </div>
     );
   }
   ```
4. Add the dev proxy so `/api` reaches LavaLust (merge into your `vite.config.js`, see `vite.config.example.js`):
   ```js
   server: { proxy: { '/api': { target: 'http://localhost:8000', changeOrigin: true } } }
   ```

### Backend (LavaLust)

5. Copy `backend/app/controllers/PicoChat.php` to `app/controllers/PicoChat.php`, then add one line to
   `app/config/routes.php`:
   ```php
   $router->post('/api/pico/chat', 'PicoChat::send');
   ```
   No OPTIONS route is needed; LavaLust answers CORS preflights itself.
6. Add the lines from `backend/env.pico.example` to LavaLust's `.env` (the file in the project root, next to
   `app/` and `public/`), and set your key:
   ```
   PICO_ANTHROPIC_API_KEY=sk-ant-...
   ```
   Get a key at https://console.anthropic.com/.

### Run

```bash
# in the LavaLust folder
php -S localhost:8000 -t public
# in the React folder
npm run dev
```

Open the Vite URL, type "hello" to Pico.

## Component props

| Prop | Default | What it does |
|---|---|---|
| `endpoint` | `VITE_PICO_API_URL` or `/api/pico/chat` | Chat URL. Pass `null` for fully offline (commands and canned replies only). |
| `fetchOptions` | none | Extra `fetch()` options: `{ credentials: 'include' }` for cookie sessions, or `{ headers: { Authorization: 'Bearer ...' } }`. |
| `context` | none | Small JSON object sent with every message, e.g. `{ page: 'orders', userName: 'Ana' }`. Pico sees it as page context. |
| `glow` | `#35e6ff` | Glow color. Changing the prop updates the scene. |
| `greeting` | built-in line | What Pico says when the page loads and nobody has touched it. `false` keeps it quiet. |
| `chips` | 6 quick buttons | `[{ label, say }]`. Pass `[]` to hide. |
| `showAngles`, `showTools`, `showReadout`, `showChat` | `true` | Hide parts of the UI. |
| `placeholder` | auto | Chat input placeholder. |
| `onReady(engine)` | | First frame drawn. |
| `onMessage({role, text, mood})` | | Each reply that came from the backend. |
| `onError(message)` | | WebGL could not start. |
| `className`, `style` | | Applied to the root element. |

**Ref:** `ref.current.ask("text")` sends a message as if typed, `ref.current.say("text", "happy")` makes Pico say
something, `ref.current.engine` is the scene API (`flyTo('back')`, `dance()`, `wave()`, `sleep()`, `wake()`,
`setGlow('#a78bff')`, `setAutoSpin(true)`, `snapshot()` returns a PNG blob).
Moods: `happy wow love think wink calm sparkle`.

## Chat API contract

```
POST /api/pico/chat
Content-Type: application/json

{ "messages": [ {"role":"user","content":"hi"}, {"role":"assistant","content":"[happy] Hello!"}, {"role":"user","content":"..."} ],
  "context":  { "page": "orders" } }

200 { "ok": true,  "reply": "Hello there!", "mood": "happy" }
4xx 5xx { "ok": false, "error": { "code": "rate_limited", "message": "..." } }
```

Error codes: `unauthorized` 401, `invalid_json` 400, `invalid_request` 422, `refused` 422, `rate_limited` 429,
`not_configured` 503, `timeout` 504, `upstream_unavailable` / `upstream_rejected` / `empty_reply` 502.
The frontend turns each of these into a friendly line from Pico and keeps working.

## Making it yours

**Restrict who can chat.** Open `PicoChat.php` and edit `authorize()`:
```php
protected function authorize() {
    return isset($_SESSION['user_id']);                 // session login
    // or: return my_jwt_ok($this->request->bearer_token());
}
```
Then on the React side send credentials: `fetchOptions={{ credentials: 'include' }}` or an `Authorization` header.

**Trusted facts about the user.** `context` from the browser can be edited by anyone, so Pico treats it as plain
data. For things you want to rely on, return them from `server_context()` in the controller.

**Teach Pico about your product.** Set `PICO_SYSTEM_EXTRA` in `.env`, for example
`You are the helper for Acme Orders. Keep answers about orders and shipping.`

**Model and cost.** Default is `claude-haiku-5-5` (fast, cheap, replies are two sentences). Change it with
`PICO_MODEL`. `PICO_MAX_TOKENS` caps reply length.

## Production notes

- **Same domain (recommended):** serve the built React app and LavaLust under one domain and route `/api/*` to
  LavaLust. No CORS needed.
- **Different domains:** set `PICO_ALLOWED_ORIGINS=https://app.example.com` in `.env` and add the block from
  `backend/snippets/config.pico.php` to `app/config/config.php` (below the `security_headers` array). Without it the
  browser's preflight gets a 403. If the frontend sends cookies, also set `credentials` to `true` there and list exact
  origins. Set `VITE_PICO_API_URL` at build time to the full endpoint URL.
- **CSRF:** the endpoint takes JSON, so LavaLust's form-token CSRF cannot apply. If you turn on
  `$config['csrf_protection']`, add the route to `csrf_exclude_uris`. In LavaLust 4.7.2 a request is validated whenever its URI fails to
  match **any one** entry, so with several exclusions use a single regex: `array('api/(pico/chat|other/route)')`.
- **Key safety:** the key lives only in `.env`. LavaLust's `.gitignore` already ignores it, and its `.htaccess` blocks
  `.env`. Make sure your web server's document root is `public/`.
- **Rate limit:** 20 requests per 60 seconds per IP by default (`PICO_RATE_LIMIT`, `PICO_RATE_WINDOW`), stored as tiny
  files in `runtime/pico_rate/`, so `runtime/` must be writable. Behind a proxy you control, set `PICO_TRUST_PROXY=1`
  so the real client IP is used. Override `rate_key()` to limit per logged-in user instead.
- **Bundle size:** in a test build, React + Pico + Three.js came to 182 kB gzipped in total, and Three.js is most of what Pico adds. Load Pico lazily so it does not slow the rest of your app:
  ```jsx
  const PicoAssistant = lazy(() => import('./components/pico/PicoAssistant.jsx'));
  // <Suspense fallback={null}><PicoAssistant /></Suspense>
  ```
- **Fonts (optional):** the intended look uses Unbounded, Figtree and IBM Plex Mono. Add to `index.html`:
  ```html
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Unbounded:wght@500;700&family=Figtree:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap">
  ```
  Without them it falls back to system fonts.
- The scene pauses itself when scrolled out of view, respects `prefers-reduced-motion`, and shows a message if the
  browser has no WebGL.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Blank area / tiny canvas | The parent has no height. Give it `height: 100vh` or a fixed height. |
| `404` on `/api/pico/chat` | Route line missing in `routes.php`, or your server does not rewrite to `public/index.php` (Apache needs `mod_rewrite`; LavaLust ships the `.htaccess`). |
| `403 Origin not allowed` | Cross-origin call without the CORS setup above. Use the Vite proxy in dev. |
| Pico says "brain link is not set up" | `not_configured` (503): key missing or rejected. Check `.env` and the PHP error log. |
| `429` quickly | You hit the rate limit. Raise `PICO_RATE_LIMIT`. |
| Washed-out colors, or errors mentioning `outputEncoding` / `sRGBEncoding` | Wrong Three.js version. Use `three@0.147.0`. |
| Nothing renders in a VM or remote desktop | The browser has no GPU/WebGL. Enable hardware acceleration. |

## What was tested

Run against a real LavaLust 4.7.2 install (PHP 8.3, built-in server) with a stand-in for the Anthropic API:
valid chat, history cleanup, context handling, CORS preflight allowed and denied, wrong content type, bad JSON,
empty and invalid messages, missing and wrong key, rate limiting, upstream 400/429/500/529, refusal, empty reply,
timeout, CSRF on and off. In a headless browser (Vite dev server proxying to LavaLust): StrictMode mount,
chat round trip, local commands, camera angles, glow colors, sleep/wake, auto-spin, error fallbacks, offline mode,
phone width, embedded height, unmount cleanup. Not tested here: a real Anthropic key (so the exact wording of live
replies), a physical GPU, and Safari.
