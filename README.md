# 📅 Datebook

My passion project calendar app with Nepali (BS) + English (AD) dual calendar, event management, secure login, email notifications, and PWA install support.

I built this for myself so I do not forget important dates.
There is no public demo. If anyone wants to use it, they need to self-host their own copy.

## Features

- **Dual Calendar** — Every date shows both AD and BS (Bikram Sambat) dates
- **Private Login Portal** — App access is gated by credential check with hashed password verification (PBKDF2)
- **6 Event Categories** — Birthday 🎂, Event 🎉, Movie 🎬, Sports ⚽, Reminder 🔔, Holiday 🌟, Custom 📌
- **Yearly Birthdays** — Birthday reminders recur every year automatically (no manual re-add)
- **Bulk Import** — Paste a list of `date, name` pairs and import them all at once
- **Smart Bulk Parsing** — Understands inputs like `aug 1`, numeric formats, and common month typos; optional AI fallback for messy lines
- **Click-to-Edit** — Click any event in calendar or list to open a full edit modal
- **Email Notifications** — Get an email 1 day before each event (via Resend + Vercel Cron)
- **Turso DB** — Cloud SQLite that never goes inactive (free tier)
- **LocalStorage fallback** — Works offline without any DB config
- **Installable PWA** — Can be installed on Android/iOS/Desktop after deployment
- **Mobile-adaptive UI** — Layout and navigation adapt for phone screens

## Login Credentials

- The app is locked behind a login page and can be used only after successful authentication.
- Authentication uses PBKDF2 hashes for both username and password.
- For your own deployment, set login values through environment variables (no hardcoded credentials in app code).

Notes:
- Password is not stored as plain text in the app logic.
- A PBKDF2 hash verifier is used on login.

Required auth env vars:
- `VITE_AUTH_USERNAME_SALT`
- `VITE_AUTH_USERNAME_HASH` (PBKDF2-SHA256 hex)
- `VITE_AUTH_PASSWORD_SALT`
- `VITE_AUTH_PASSWORD_HASH` (PBKDF2-SHA256 hex)
- `VITE_AUTH_ITERATIONS` (default: `210000`)

Generate username and password hashes (Node):

```bash
node -e "const crypto=require('crypto'); const iter=210000; const h=(v,s)=>new Promise((r,j)=>crypto.pbkdf2(v,s,iter,32,'sha256',(e,d)=>e?j(e):r(d.toString('hex')))); (async()=>{ const username='YOUR_USERNAME'; const password='YOUR_PASSWORD'; const userSalt='YOUR_USER_SALT'; const passSalt='YOUR_PASS_SALT'; console.log('USERNAME_HASH=',await h(username,userSalt)); console.log('PASSWORD_HASH=',await h(password,passSalt)); })();"
```

## Quick Start

```bash
git clone <your-repo>
cd datebook
npm install
cp .env.example .env   # fill in your keys
npm run dev
```

## Deploy to Vercel

1. Push to GitHub
2. Import project at vercel.com
3. Add environment variables:
   - `VITE_TURSO_URL` = your Turso database URL
   - `VITE_TURSO_TOKEN` = your Turso token
   - `VITE_AUTH_USERNAME_SALT` = username salt
   - `VITE_AUTH_USERNAME_HASH` = PBKDF2 hash for login username
   - `VITE_AUTH_PASSWORD_SALT` = password salt
   - `VITE_AUTH_PASSWORD_HASH` = PBKDF2 hash for login password
   - `VITE_AUTH_ITERATIONS` = PBKDF2 iterations (recommended `210000`)
   - `RESEND_API_KEY` = your Resend key (see below)
   - `OPENROUTER_API_KEY` = optional AI bulk parser key
   - `OPENROUTER_MODEL` = optional AI model (example: `stepfun/step-3.5-flash:free`)
   - `CRON_SECRET` = optional but recommended for securing the reminder endpoint
4. Deploy!

## Install As Mobile App (PWA)

After deployment (for example on Vercel), open your Datebook URL on your phone.

1. Android (Chrome/Edge): tap **Install app** when prompted.
2. iPhone (Safari): tap **Share** → **Add to Home Screen**.
3. Desktop Chrome/Edge: click the install icon in the address bar.

The app includes:
- Web app manifest
- Service worker (auto-updated)
- Standalone display mode
- Install prompt support where browser allows it

## Email Notifications Setup (Free)

### Step 1: Get a Resend API key
1. Go to [resend.com](https://resend.com) → Sign up free
2. Create an API key
3. Add it as `RESEND_API_KEY` in Vercel env vars

### Step 2: Verify a sender domain (or use Resend's test domain)
- For testing, Resend lets you send to your own email from `onboarding@resend.dev`
- For production, verify your own domain in Resend dashboard
- Update the `from:` field in `api/notify.js`

### Step 3: The cron runs automatically
`vercel.json` is already configured to run `/api/notify` daily at 1 AM UTC (6:45 AM NPT).
It checks for events tomorrow and sends emails to any event with a `notify_email` set.

`CRON_SECRET` is optional. Reminders work without it, but adding it is recommended to prevent unauthorized manual calls to the cron endpoint.

### Step 4: Set your email in the app
Go to **Settings** → enter your email → Save. All future events will use this.

## Smart Bulk Import (Local + AI)

Bulk import now uses two parsing passes:
1. Local tolerant parser for common shorthand (`aug 1`, `8/1`, `1-8`) and spelling mistakes in month names.
2. Optional AI fallback for lines still not parsed.

Optional AI key:
- `OPENROUTER_API_KEY`
- `OPENROUTER_MODEL` (example: `stepfun/step-3.5-flash:free`)

Where to get it (free tier):
1. Go to [openrouter.ai](https://openrouter.ai)
2. Create an API key
3. Add `OPENROUTER_API_KEY` and `OPENROUTER_MODEL` in Vercel env vars (and local `.env` if needed)

Note: free tier is generous but not unlimited.

## File Structure

```
datebook/
├── src/
│   ├── App.jsx              # Main app, all views
│   ├── lib/
│   │   ├── db.js            # Turso client + CRUD helpers
│   │   ├── nepali.js        # BS <-> AD calendar converter
│   │   ├── constants.js     # Categories, date helpers
│   │   └── useEvents.js     # Central state hook
│   └── components/
│       ├── DualCalendar.jsx # Month calendar with BS dates
│       ├── EventModal.jsx   # Click-to-edit modal
│       └── Toast.jsx        # Notifications
├── api/
│   └── notify.js           # Vercel serverless cron for emails
├── vercel.json             # Cron schedule config
└── .env                    # Your secrets (never commit this)
```

## Bulk Import Format

One event per line: `date, name`

```
March 15, John Smith
April 22 2025, Sarah Connor
December 18, FIFA World Cup Final
2025-06-06, Ramayana Movie Release
June 7, Mom's Birthday
```

Supports most date formats. Select a category before importing.

## Before Pushing To GitHub

1. Ensure `.env` is not committed.
2. Keep only `.env.example` in the repository.
3. Rotate any keys that were accidentally exposed before push.
4. Verify Vercel Environment Variables are set in the dashboard.
