# EduSphere

Adaptive learning and skills evaluation platform: placement-tested learning paths, a code playground with real test cases, anonymous peer review, XP/badges/certificates with public verification, and live-session links.

The project is organized into `frontend/` for the standalone React/Vite browser app and `backend/` for the PHP/LavaLust API. The frontend calls the PHP API through Vite's local `/api` proxy.

For the project concept, sitemap, interface wireframes, database ERD/field inventory, route overview, and checking readiness, see [SYSTEM-DESIGN.md](./SYSTEM-DESIGN.md).

> Payment (PayMongo), email (SMTP), execution (Judge0), and storage (S3/R2) integrations are env-driven in the PHP backend. Course authoring/enrollment, course materials and final assessments, and coding-assignment authoring/submissions are served by the PHP API.

## Stack

- React 19 + Vite + React Router + TypeScript, Tailwind CSS 4
- LavaLust 4.7.0 PHP MVC API in `backend/`
- Aiven MySQL with prepared queries and schema managed in `backend/database/`
- JWT access/refresh tokens
- PHP password hashing and request validation
- `@monaco-editor/react`, `framer-motion`, `lucide-react`, `canvas-confetti`, `zustand`

## Run it

Set the database, JWT, and optional integration values in `backend/.env` (see `backend/.env.example`). For a new, empty database, import `backend/database/schema.sql` and then `backend/database/seed.sql`. Do not import the schema or seed into the shared database again; it is already initialized.

```bash
cd backend
copy .env.example .env
cd ..\frontend
npm install
npm run dev                      # React at http://localhost:5173, PHP API at http://localhost:8080
```

The dev command starts Vite and PHP's built-in development server together. The Vite proxy forwards `/api/*` to `http://127.0.0.1:8080`. `npm run build` builds the static React app, and `npm run start` previews it. For production, deploy the static `frontend/dist/` files and the PHP service separately.

Do not import the schema or seed into the shared Aiven database; they are not intended for an existing database.

For an existing database, apply the additive migration `backend/database/migrations/004_profile_email_verification.sql` before using profile persistence and password-email verification. It adds profile fields, preserves existing accounts as verified, and creates the one-time verification-code table. Profile photos up to 10 MB are accepted, resized to at most 512 pixels, and compressed to WebP in the browser before storage in the user's `avatar` database field. After choosing a photo, click **Save profile** before logging out or leaving. Saved photos load again after signing in.

Configure email delivery in `backend/.env` with `RESEND_API_KEY` and a verified `MAIL_FROM` sender, or configure SMTP with `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, and `SMTP_SECURE`. Resend is preferred when both providers are configured. All in-app notifications, including certificate awards, are emailed to the user's verified account address. Keep real environment files private and out of source control.

`SMTP_SECURE` accepts `tls` for STARTTLS (commonly port 587), `ssl` for implicit TLS (commonly port 465), or `none` for an unencrypted SMTP connection; when omitted, TLS is selected for ports 465 and 587. SMTP authentication is optional, but configure both username and password together when required by your provider. Password registration requires a working email provider for verification; Google sign-in uses a verified Google email.

### Courses and coding classroom

Students can enroll in published courses, complete lessons, download course materials, take final assessments, and submit coding assignments. Instructors can create draft courses, add modules and lessons, upload materials, configure assessments, and author/publish assignments with visible and private tests. Course publication requires at least one lesson, one published assignment, and one final-assessment question.

The playground includes JavaScript, Python, C, C++, C#, and HTML exercises. JavaScript free runs and visible exercise tests execute in an isolated browser frame without a runner account; these local results are practice-only, do not award XP or save scores, and do not include hidden tests. HTML runs in a browser preview. Python/C/C++/C# use the configured Judge0 service (`JUDGE0_URL`; `JUDGE0_API_KEY` only if required by that instance). Judge0 language IDs are Python 71, C 50, C# 51, and C++ 54. Python and compiled-language exercises receive each test input on standard input and compare the final output line with the expected result.

When a student completes a learning path, the certificate is emailed to the address on their account. The email includes the certificate details and a public verification link; use the **Email to me** action on the certificates page to resend it. Set `APP_URL` to the public frontend origin in deployed environments so emailed verification links resolve outside the local machine.

The classroom adds two tables. For an existing database, review and apply the additive migration `backend/database/migrations/002_coding_classroom.sql` once with the MySQL client before opening these pages. It creates new tables only and does not alter or delete existing records.

For local practice, the public Judge0 CE endpoint can be configured in `backend/.env` with `JUDGE0_URL=https://ce.judge0.com`; it works without an API key but may have availability and rate limits. Submitted code and input are sent to this third-party service, so do not send secrets or sensitive code. If PHP cURL cannot verify its TLS certificate, set `JUDGE0_CA_BUNDLE` to a trusted CA bundle path. For production or student submissions, use a private Judge0 instance instead.

### Certified courses

A certificate is issued once per course only after the student completes every course lesson, passes every published coding assignment (100% on at least one attempt per assignment), and passes the final assessment (80% by default; the instructor can set 50–100%). Verification is available at `/verify/[code]`. Instructors can review the exact source saved with each coding-assignment attempt; the platform does not try to determine whether code was pasted or typed.

For an existing database, review and apply `backend/database/migrations/003_course_certificates.sql` before using the course enrollment, material, and final-assessment features. It creates the new tables and adds a unique user/course certificate constraint.

Course files are stored privately on the application host under `backend/.data/course-materials`, outside the public web root. The local `npm run dev` command starts PHP with 25 MB upload and 26 MB request limits; other PHP hosts must set `upload_max_filesize=25M` and `post_max_size=26M`. This local-disk storage is appropriate for a persistent single-host deployment; ephemeral/serverless instances may discard files or fail to share them across instances. Use a persistent volume or migrate storage to S3/R2 before deploying in those environments.

### Demo accounts (seeded placeholder data)

| Role | Login | Notes |
|---|---|---|
| Student | `aria@edusphere.dev` | mid-path, streak 3, review queue waiting |
| Instructor | `instructor@edusphere.dev` | class analytics + assignment pipeline |
| Admin | `admin@edusphere.dev` | user management |

Password for all: `password123`. Public credential demo: `/verify/EDU-7Q4M-92XT`.

## Environment variables

| Var | Purpose |
|---|---|
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | Aiven MySQL connection (required) |
| `DB_SSL_CA` | Path to the Aiven CA certificate; required in production to verify the server certificate |
| `VITE_API_BASE_URL` | Optional API origin for a separately deployed PHP API; leave blank to use the local Vite proxy |
| `VITE_API_PROXY_TARGET` | Local PHP API origin used by Vite's `/api` proxy (default `http://127.0.0.1:8080`) |
| `JWT_SECRET` | HS256 secret for access/refresh tokens |
| `GOOGLE_CLIENT_ID` | Google Identity Services audience checked by the PHP API |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Public Google client ID used by the frontend sign-in button |
| `ALLOWED_ORIGINS` | Comma-separated CORS allow-list for `/api/*` (include `http://localhost:5173`) |
| `APP_URL` | Frontend origin used for billing return URLs and email links |
| `PAYMONGO_SECRET_KEY`, `PAYMONGO_WEBHOOK_SECRET` | PayMongo hosted checkout and signed webhook; use test credentials locally |
| `RESEND_API_KEY`, `MAIL_FROM` | Transactional email through Resend; `MAIL_FROM` must use a verified sender domain |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_SECURE`, `MAIL_FROM_ADDRESS`, `MAIL_FROM_NAME` | SMTP fallback when Resend is not configured |
| `CURL_CA_BUNDLE` | Optional trusted CA bundle for PHP cURL HTTPS requests |
| `GEMINI_API_KEY` | Optional server-side Gemini key for the learning-path study assistant |
| `GEMINI_MODEL` | Optional Gemini model (default `gemini-3.6-flash`) |
| `JUDGE0_URL`, `JUDGE0_API_KEY` | Remote code execution instead of the local sandbox |

The learning-path page offers a Gemini chat assistant only to accounts with an active Pro or Team subscription. This is checked by the PHP API against the verified subscription record, including its expiry, as well as by the UI. Add `GEMINI_API_KEY` to `backend/.env` and restart the PHP API to enable Gemini. The API key remains on the backend. A chat request includes the course title, path progress, up to 8 upcoming lesson contents, up to 20 database quiz questions/options, and a short recent chat history; it excludes account details and quiz answer keys. Gemini is instructed not to invent quiz questions or course facts.

### Google sign-in setup

Set the same Google OAuth web client ID as `GOOGLE_CLIENT_ID` in `backend/.env` and `NEXT_PUBLIC_GOOGLE_CLIENT_ID` in `frontend/.env.local`. Add the frontend origin (for local development, `http://localhost:5173`) to the OAuth client's authorized JavaScript origins. The API verifies the Google credential and creates or signs in a student account using its verified email.

## API shape

Every response is the same envelope:

```json
{ "success": true, "message": "…", "data": { }, "errors": null }
```

Groups: `auth` (register/login/Google sign-in/refresh/logout/me), `assessments/placement` (+ submit), `learning-path` (current/generate/progress), `courses` (catalog, detail, enrollment, authoring, modules, and final assessments), `course-progress`, `course-materials`, `lessons/[id]`, `coding-assignments` (student submissions and instructor authoring/review), `exercises`, `playground/run`, `submissions`, `peer-review/{queue,submit,feedback}`, `analytics/{student,instructor,leaderboard}`, `badges`, `certificates`, `verify/[code]` (public), `sessions`, `payments/{checkout,webhook}`, `uploads/presign`, `notifications`, and `admin/users`. Health: `/api/v1/health`.

### PHP backend

The PHP API is a partial implementation of `/api/v1/*`, integrated into a complete LavaLust 4.7.0 project under `backend/`. It covers existing-account authentication, lessons/catalog, placement and learning paths, playground/exercises, submissions/reviews, analytics, credentials, sessions, notifications, checkout, uploads, and admin users. Course authoring/enrollment/material downloads/final assessments and coding-assignment authoring/attempts are not yet implemented. See [backend/README.md](./backend/README.md) for backend setup and framework details.

## Canonical test flows

**1. Placement → learning path.** Sign in as a fresh student, complete `/assessment` (10 questions). The response grades MCQs exactly and short answers against an expected phrase, writes per-skill mastery rows, then re-sequences the course: each lesson's gap score is the average mastery deficit across its tagged skills, sorted weakest-first. Check `/path` — the constellation reflects the new order, and the rationale text cites your actual percentages.

**2. Code submission → results.** In `/playground`, run Two Sum with the O(n) hash-map solution: 4/4 pass including the hidden 100,000-item case (about 20ms). Run the O(n²) double loop: it passes the visible cases, then the whole run times out at 4s with a hint about why. XP only pays above your previous best, so re-running can't farm it.

**3. Assignment → anonymous peer review.** The PHP API can submit assignments for review — `PeerAssigner` selects up to three least-loaded classmates. Reviewer queue and feedback expose aliases rather than account IDs.

## Design

"Shoreline" system: warm sand beige + deep marine blue (light default), deep-ocean dark mode via the toggle. Bricolage Grotesque (display), Instrument Sans (body), JetBrains Mono (data). Orbit/sphere constellation motif throughout; glossy pure-CSS 3D spheres and layered sliding 2D waves on the landing. Motion: 150–600ms, `cubic-bezier(.22,1,.36,1)`, `prefers-reduced-motion` honored, custom sphere loader instead of default spinners.
