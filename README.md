# Fynd Order Form Platform

Internal sales ops platform for creating, approving, and managing commercial Order Forms across Fynd's product portfolio.

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite + Tailwind CSS |
| Auth | Google OAuth 2.0 (Google Identity Services) |
| State | React Context + localStorage |
| Routing | React Router v6 |
| Notifications | Slack Incoming Webhooks |
| Sheets sync | Google Sheets API v4 |
| Deployment | Firebase Hosting or GitHub Pages |

---

## Project structure

```
fynd-of-platform/
├── .github/workflows/
│   ├── deploy.yml           # Firebase auto-deploy on push to main
│   └── deploy-pages.yml     # GitHub Pages auto-deploy on push to main
├── public/
│   └── index.html           # Shell HTML — loads Google Identity Services
├── src/
│   ├── constants/
│   │   ├── users.js         # All authenticated users (Sales / RevOps / Finance)
│   │   ├── formOptions.js   # All dropdown options, fee rules, currencies
│   │   └── status.js        # OF status definitions and form steps
│   ├── context/
│   │   ├── AuthContext.jsx  # Google OAuth state + handleCredential
│   │   └── FormsContext.jsx # Forms CRUD, workflow actions, Slack + Sheets
│   ├── hooks/
│   │   ├── useFormWizard.js # Multi-step form state management
│   │   └── useToast.js      # Toast notification hook
│   ├── utils/
│   │   ├── storage.js       # localStorage read/write
│   │   ├── dates.js         # date-fns helpers (fmtDate, addMonthsMinus1, etc.)
│   │   ├── formatting.js    # Currency symbols, money formatting
│   │   ├── calculations.js  # OF value, ARR, committed revenue calculations
│   │   ├── slack.js         # Slack Incoming Webhook notifications
│   │   ├── sheets.js        # Google Sheets API sync
│   │   ├── pdf.js           # Branded PDF generation (browser print)
│   │   └── csv.js           # CSV export (OF index + service index)
│   ├── components/
│   │   ├── ui/index.jsx     # All atomic UI components (Inp, Sel, Btn, Card…)
│   │   ├── auth/
│   │   │   └── LoginPage.jsx
│   │   ├── layout/
│   │   │   └── AppShell.jsx
│   │   ├── form/
│   │   │   ├── FormWizard.jsx
│   │   │   └── steps/
│   │   │       ├── StepClient.jsx       # Step 1: client info + SoW upload
│   │   │       ├── StepCommercial.jsx   # Step 2: dates, terms, billing
│   │   │       ├── StepFees.jsx         # Step 3: services + fee builder
│   │   │       └── StepTermsSignatory.jsx # Steps 4 + 5
│   │   ├── approval/
│   │   │   └── FormDetail.jsx          # View + RevOps/Finance actions
│   │   └── views/
│   │       ├── Dashboard.jsx
│   │       ├── Repository.jsx
│   │       └── SignedChurnVoid.jsx      # Signed OFs page + Churn/Void request
│   ├── App.jsx              # Router setup
│   ├── main.jsx             # Entry point
│   └── index.css            # Global styles + Tailwind
├── .env.example             # Environment variable template
├── .firebaserc              # Firebase project config
├── firebase.json            # Firebase Hosting config
├── vite.config.js
├── tailwind.config.js
└── package.json
```

---

## One-time setup

### 1. Clone or copy this repo

```bash
git clone https://github.com/muskankatta/Order_Form.git
cd Order_Form
npm install
```

### 2. Set up Google OAuth

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a project (or use an existing one)
3. Enable **Google Identity / OAuth 2.0 API**
4. Go to **APIs & Services → Credentials → Create credentials → OAuth 2.0 Client ID**
5. Application type: **Web application**
6. Add **Authorised JavaScript Origins**:
   - `http://localhost:3000` (for local dev)
   - `https://muskankatta.github.io` (for GitHub Pages)
   - `https://your-project.web.app` (for Firebase — add after creating Firebase project)
   - `https://of.gofynd.com` (for custom domain — add when ready)
7. Copy the **Client ID** (looks like `123456789.apps.googleusercontent.com`)

### 3. Create .env file

```bash
cp .env.example .env
```

Edit `.env`:
```env
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
VITE_SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
VITE_SHEETS_ID=your-google-sheet-id
VITE_BASE_PATH=/Order_Form/    # for GitHub Pages; use / for Firebase
```

### 4. Set up Slack Webhook (for notifications)

1. Go to [api.slack.com/apps](https://api.slack.com/apps)
2. Create a new app → **Incoming Webhooks** → Enable
3. Add to workspace → choose a channel (e.g. `#of-notifications`)
4. Copy the webhook URL into `VITE_SLACK_WEBHOOK_URL`

### 5. Set up Google Sheets sync (optional)

1. Create a Google Sheet
2. Copy the Sheet ID from the URL: `https://docs.google.com/spreadsheets/d/**THIS_PART**/edit`
3. Share the sheet with edit access to the relevant Google account
4. Add the Sheet ID to `VITE_SHEETS_ID`

---

## Running locally

```bash
npm run dev
# Opens at http://localhost:3000
```

---

## Deployment

### Option A — GitHub Pages (existing setup, zero change)

Add these secrets to your GitHub repo (**Settings → Secrets → Actions**):

| Secret | Value |
|---|---|
| `VITE_GOOGLE_CLIENT_ID` | Your Google OAuth Client ID |
| `VITE_SLACK_WEBHOOK_URL` | Your Slack webhook URL |
| `VITE_SHEETS_ID` | Your Google Sheet ID |
| `VITE_BASE_PATH` | `/Order_Form/` |

The workflow `.github/workflows/deploy-pages.yml` runs automatically on every push to `main`. No manual step needed.

Make sure GitHub Pages is enabled: **Repo Settings → Pages → Source → GitHub Actions**.

### Option B — Firebase Hosting (recommended upgrade)

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login
firebase login

# Initialise (first time only)
firebase init hosting
# → Public directory: dist
# → Single-page app: Yes
# → Overwrite dist/index.html: No

# Connect to GitHub for auto-deploy
firebase init hosting:github
```

Add these secrets to GitHub repo:

| Secret | Value |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | JSON from Firebase Console → Project Settings → Service Accounts |
| `VITE_GOOGLE_CLIENT_ID` | Your Google OAuth Client ID |
| `VITE_SLACK_WEBHOOK_URL` | Your Slack webhook URL |
| `VITE_SHEETS_ID` | Your Google Sheet ID |

The workflow `.github/workflows/deploy.yml` then:
- Deploys a **preview URL** on every pull request
- Deploys to **live** on every push to `main`

To add a custom domain (`of.gofynd.com`):
1. Firebase Console → Hosting → Add custom domain
2. Follow the DNS verification steps
3. Add `https://of.gofynd.com` to Google Cloud Console → OAuth → Authorised origins

---

## Adding or removing users

The authenticated user list is hardcoded in `src/constants/users.js`.

To add a user:
```js
// In SALES_REPS, REVOPS_USERS, or FINANCE_USERS array:
{ id:'XXXX', name:'New Person', slack:'UXXXXXXXX', email:'newperson@gofynd.com' },
```

To remove a user: delete their entry from the array.

After any change: commit, push to `main` → auto-deploys.

---

## Environment variables reference

| Variable | Required | Description |
|---|---|---|
| `VITE_GOOGLE_CLIENT_ID` | ✅ | Google OAuth 2.0 Client ID |
| `VITE_SLACK_WEBHOOK_URL` | Recommended | Slack Incoming Webhook for notifications |
| `VITE_SHEETS_ID` | Optional | Google Sheet ID for repository sync |
| `VITE_BASE_PATH` | Deployment-specific | `/Order_Form/` for GitHub Pages, `/` for Firebase |

All variables are prefixed `VITE_` so Vite exposes them to the browser bundle.
**Never put secrets (private keys, tokens) in VITE_ variables** — they are visible in the built JS.
The Google OAuth Client ID is safe to expose (it is a public identifier by design).

---

## Key behaviours

- **Authentication**: Google OAuth 2.0. Only `@gofynd.com` and `@fynd.team` accounts can sign in. Role is self-selected; email is validated against the hardcoded list for that role.
- **Universal access**: `muskankatta2@gofynd.com` bypasses all role checks.
- **SoW upload**: Mandatory PDF upload before submission. PDF stored as base64 in localStorage.
- **Slack notifications**: Fired on submission, approval, rejection, and Churn/Void requests.
- **Google Sheets sync**: Fires on every state change if `VITE_SHEETS_ID` is set and the user has an OAuth access token with spreadsheets scope.
- **PDF generation**: Browser print dialog. No external library.
- **Data persistence**: localStorage only. Data lives in the user's browser. For shared/multi-device state, a backend (Firebase/Supabase) is required.
