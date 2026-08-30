# BSE RSS Reader & Instant Alert System

A lightweight, real-time corporate announcement tracking application. It fetches RSS feeds from BSE India, classifies announcements, filters them against a custom watchlist, and dispatches instant push notifications via Telegram and ntfy—all hosted on Cloudflare's free serverless infrastructure and managed through GitHub.

---

## 🛠️ Application Architecture & Functioning

```
[ BSE India RSS Feeds ]
           │
           ▼
┌─────────────────────────┐
│ Cloudflare Cron Trigger │ (Runs every minute)
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│   Cloudflare Worker     │
│  (Parser & Matcher)     │ ──► [ Reads/Writes ] ──► [ Cloudflare KV (BSE_DATA) ]
└──────────┬──────────────┘                          - Watchlist
           │                                         - Seen Items
           ▼                                         - Special Alerts
┌─────────────────────────┐
│ Push Notification Bus   │
│ ├─ Telegram Bot API     │
│ └─ ntfy.sh Topic        │
└─────────────────────────┘
           ▲
           │ (API Requests via JSON)
┌─────────────────────────┐
│ Cloudflare Pages Web UI │ (Frontend Web App)
└─────────────────────────┘

```

### Key Capabilities

* **Automated Cron Ingestion:** Cloudflare Workers pull live XML feeds for both Corporate Announcements and Financial Results directly from BSE India every minute.
* **Smart Classification Engine:** Analyzes titles and descriptions to auto-categorize disclosures into Board Meetings, Dividends, Bonus Issues, Fund Raising, Acquisitions, Credit Ratings, and Order Wins.
* **Hybrid Watchlist Matching:** Evaluates new disclosures against your personal stock watchlist using both 6-digit Scrip Codes (e.g., `542651`) and partial Company Name matching.
* **Dual Push Alerts (Telegram + ntfy):** Dispatches rich HTML alerts with direct BSE stock links via a Telegram Bot, alongside lightweight topic-based push notifications using ntfy.sh.
* **Dynamic Frontend Dashboard:** A responsive web application deployed via Cloudflare Pages providing horizontal watchlist management, category filtering, title searching, and dual top/bottom pagination.

---

## 🚀 How to Build This App From Beginning to End

### Phase 1: Set Up Cloudflare KV Storage

1. Log into your **Cloudflare Dashboard**.
2. Navigate to **Workers & Pages** > **KV**.
3. Click **Create a Namespace**, name it `BSE_DATA`, and save.

---

### Phase 2: Set Up Backend GitHub Repository (`bse-rss-reader`)

1. Go to **GitHub** and create a new repository named `bse-rss-reader`.
2. Inside this repository, create two files:
* `worker.js`: Contains your backend worker script with the RSS parser, matching engine, and alert dispatchers for Telegram and ntfy.
* `wrangler.json` (or `wrangler.toml`): Configures your Worker name, KV namespace binding (`BSE_DATA`), and Cron trigger schedule (`* * * * *`).


3. Commit and push the code to GitHub.

---

### Phase 3: Configure Notification Channels

#### A. Telegram Setup

1. Open Telegram and search for `@BotFather`.
2. Send `/newbot`, follow the instructions, and save the generated **HTTP API Bot Token**.
3. Search for `@userinfobot` in Telegram and send a message to receive your numeric **Chat ID**.

#### B. ntfy Setup

1. Choose a unique, hard-to-guess topic name on ntfy (e.g., `bse-alerts-mysecretkey-99`).
2. Install the **ntfy app** on your phone (iOS / Android).
3. Open the app, tap **Add subscription**, and enter your chosen topic name.

---

### Phase 4: Deploy Backend Worker via Cloudflare & Connect Secrets

1. In Cloudflare, go to **Workers & Pages** > **Overview** > **Create Application** > **Pages/Workers** > **Connect to Git**.
2. Select your `bse-rss-reader` GitHub repository and deploy it.
3. Go to your Worker's **Settings** > **Variables and Secrets**:
* **KV Namespace Binding:** Bind variable `BSE_DATA` to your `BSE_DATA` KV namespace.
* **Environment Secrets:**
* `TELEGRAM_BOT_TOKEN`: Your token from BotFather.
* `TELEGRAM_CHAT_ID`: Your numeric chat ID.
* `NTFY_TOPIC`: Your unique ntfy topic name (e.g., `bse-alerts-mysecretkey-99`).




4. Click **Save and Deploy**.

---

### Phase 5: Add Cron Trigger (Automated Schedule)

1. In your Worker dashboard, go to **Settings** > **Triggers**.
2. Under **Cron Triggers**, click **Add Trigger**.
3. Set the schedule to `* * * * *` (Every minute) so it monitors feeds continuously in the background.

---

### Phase 6: Deploy Frontend Web UI (`bse-rss-reader-app`)

1. Create a second GitHub repository named `bse-rss-reader-app`.
2. Add your three frontend files to the root directory:
* `index.html` (UI Structure with dual top/bottom pagination)
* `style.css` (Styles containing the horizontal scrollable watchlist row)
* `app.js` (Client logic targeting your Worker URL)


3. In `app.js`, set `WORKER_URL` to your deployed Worker endpoint (e.g., `[https://bse-rss-reader.your-subdomain.workers.dev](https://bse-rss-reader.your-subdomain.workers.dev)`).
4. Commit and push your changes.
5. In Cloudflare, go to **Workers & Pages** > **Create Application** > **Pages** > **Connect to Git**, select `bse-rss-reader-app`, and click **Save and Deploy**.

---

## 📡 API Endpoint Reference

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/` | Operational status check |
| `GET` | `/bse-announcements` | Fetches parsed live BSE corporate announcements |
| `GET` | `/categories` | Returns calculated category breakdowns with item counts |
| `GET` | `/watchlist` | Retrieves stored watchlist items from KV |
| `POST` | `/watchlist` | Updates stored watchlist array in KV |
| `GET` | `/alerts` | Fetches historical triggered watchlist alerts |
| `GET` | `/monitor` | Manually triggers RSS fetch, matching, and alert dispatch to Telegram & ntfy |

---

