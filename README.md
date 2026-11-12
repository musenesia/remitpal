# RemitPal

> **PayPal Hackathon entry** — an AI-powered remittance ledger for Indonesian migrant workers in Hong Kong, built on PayPal Payouts v1 (sandbox) + Gemini AI.
>
> **RemitPal is Siti's personal remittance app, not a multi-user service.** Payouts are sent from her own sandbox business account, only after she approves a plan in-app, to Slamet's verified email. Sandbox only — no real money moves. For a multi-user version, Personal Payments v2 would be the right method so each sender pays from their own personal account; that API is limited-release and not enabled on this sandbox app (token creation returns 403 NOT_AUTHORIZED, debug_id f13223105b617), so this submission uses Payouts, which is approved on the same app.

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/musenesia/remitpal)

## Deploy your own copy

Click the **Deploy to Render** button above to host your own copy of RemitPal on Render. Sign in to Render with GitHub, authorize the repo, and name the Blueprint — Render provisions the free PostgreSQL database and web service from `render.yaml` automatically. When prompted, fill in the env vars (`GEMINI_API_KEY` and/or `OPENROUTER_API_KEY`, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_RECIPIENT_EMAIL`); with no PayPal credentials the app runs in labelled DEMO MODE, and with no AI key it falls back to the labelled rule-based agent. Note: the free-tier web service sleeps after inactivity, so the first load is slow; set `APP_URL` to your Render service URL after the first deploy.

---

## What is RemitPal?

**RemitPal** is a family remittance ledger for Indonesian migrant workers, especially wives. She sends, he spends, and both see where every rupiah went, without her ever having to ask.

<img width="1920" height="1080" alt="Screenshot-76" src="https://github.com/user-attachments/assets/cfc841b4-f4f6-46ac-86a4-c07141b3d3e2" />

Siti Rahayu works as an elderly-care assistant in Causeway Bay. Every month she sends 15,000,000 IDR home to her husband Slamet Widodo so he can pay for the family's house renovation, the kids' school fees, and household expenses — while she is 3,000 km away and can only check receipts over WhatsApp.

RemitPal replaces the WhatsApp photos and mental accounting with a shared, verifiable ledger:

| Person | Role | What they do in the app |
|--------|------|-------------------------|
| **Siti** (HK) | Remitter | Plans the monthly budget, sends money via PayPal, verifies receipts Slamet uploads |
| **Slamet** (Indramayu) | Manager | Logs expenses, uploads purchase photos, confirms remittance receipt |

---

## Hackathon Requirements

| Requirement | How it's met |
|---|---|
| **PayPal API** | PayPal Payouts v1 (`POST /v1/payments/payouts`, sandbox only): after Siti approves a plan in-app, the server creates a single-item payout batch from her own sandbox business account to Slamet's verified email — a ledger record is created only when PayPal reports the payout item SUCCESS, with the real payout batch id as the reference number. |
| **AI** | Gemini 3.8 Flash drives a role-aware AI agent accessible via a WhatsApp-style chat bar always visible at the bottom of every screen. The agent uses Gemini function calling to orchestrate the full remittance lifecycle (see below). |
| **Working prototype** | Full-stack: Express + PostgreSQL backend, React/Vite frontend, PayPal sandbox, Gemini API, Fonnte WhatsApp notifications — all deployed and runnable locally or on Render. |
| **Documented** | This README. |

---

## AI Agent — the RemitPal Assistant

The chat bar at the bottom of every screen connects to a Gemini 3.8 Flash agent with function calling. The agent is **role-aware**: it behaves differently for Siti and Slamet.

<img width="1920" height="1080" alt="Screenshot-84" src="https://github.com/user-attachments/assets/6d017e91-a9c7-4e9b-8688-0666f470f490" />

### Siti's flow — plan → approve → send

1. Siti types: *"Send 15 million for this month: 5M renovation, 3.5M tuition, 4M allowance, 2.5M savings"*
2. The agent calls `get_current_state` (reads live ledger) then `set_monthly_budget` (saves the allocation plan).
3. The agent calls `request_remittance_approval` — this surfaces a structured approval card in the chat with the full allocation breakdown and the USD amount derived server-side from the IDR total at Rp 16,000/USD (display rate only, read-only on the card).
4. **Human-in-the-loop**: Siti reviews the card and clicks **Approve & Send via PayPal**. The PayPal flow is never triggered by the AI alone.
5. The frontend calls `POST /api/paypal/send` → the server creates a PayPal Payouts v1 batch (USD derived from the approved IDR total) from Siti's own sandbox business account to Slamet's verified email.
6. The app creates the remittance record (with the PayPal payout batch id as the reference number) ONLY when PayPal reports the payout item SUCCESS. An activity notification + WhatsApp message is sent.

### Slamet's flow — upload → classify → verify

<img width="1920" height="1080" alt="Screenshot-87" src="https://github.com/user-attachments/assets/a66f0f8c-374e-4167-8b3d-1de0764e2667" />

1. Slamet attaches a receipt photo and types: *"Bought granite tiles for 2.85M at TB Rejeki Abadi"*
2. The agent reads the image (multimodal/vision) and the text, extracts the vendor, amount, and what was bought, and chooses the best expense category (renovation / tuition / allowance / savings / miscellaneous).
3. The agent calls `add_expense` with an auto-assessed `receiptStatus` — an assessment only, never a verification:
   - `pending` — the default, used even when the photo looks clear; Siti reviews it in her pending receipts queue and only she can mark it `verified`.
   - `needs_clarification` — blurry, edited, or unreadable photo → Slamet gets a message asking him to re-upload a clearer photo.
4. The expense is added to the ledger immediately; Siti sees it in the Receipt Vault and confirms or flags it with one click.

### Agent tools (function declarations)

| Tool | Who uses it | What it does |
|---|---|---|
| `get_current_state` | both | Reads the live ledger snapshot (budget, remittances, expenses, pending receipts) |
| `set_monthly_budget` | Siti | Saves a monthly budget with per-category allocations |
| `request_remittance_approval` | Siti | Surfaces an approval card — money never moves until Siti approves in the UI |
| `add_expense` | Slamet | Classifies a receipt photo and adds an expense to the ledger |
| `update_receipt_status` | Siti | Verifies, flags, or requests clarification on a pending receipt |

## What the AI can and cannot do

The AI agent is server-side only — Gemini 3.8 Flash, with an OpenRouter fallback (`nvidia/nemotron-3.5-super-vl:free`, Nvidia) used automatically when Gemini is overloaded, and a labelled rule-based fallback when no AI key is configured. The agent is role-aware: it behaves differently for Siti (remitter) and Slamet (manager), and it is always scoped to the authenticated session's role.

### What it CAN do

**As Siti (remitter role)**

- Structure a remittance plan from natural language — *"send 15M for November: 5M renovation, 3.5M tuition, 4M allowance, 2.5M savings"* — into a structured draft with per-category allocations
- Present a remittance approval card to Siti in the UI (`request_remittance_approval`)
- Set or update the monthly budget plan with category allocations (`set_monthly_budget`)
- Review pending receipts and trigger a status update on them (`update_receipt_status`)
- Schedule calendar events and reminders (`add_calendar_event`)
- Read a snapshot of the full family ledger: current budget, recent remittances, recent expenses, pending receipts (`get_current_state`)

**As Slamet (manager role)**

- Read a receipt photo (multimodal) and extract vendor, amount, item description
- Auto-categorize the expense into one of: renovation, tuition, allowance, savings, miscellaneous
- Add the expense directly to the ledger with the receipt photo attached (`add_expense`)
- Assess receipt photo quality and set status to `pending` (looks clear, awaiting Siti) or `needs_clarification` (blurry/unreadable)
- Schedule calendar tasks and reminders

### Hard boundaries — what it CANNOT do

| Boundary | How it's enforced |
|---|---|
| Cannot send money | `request_remittance_approval` is intercepted server-side and surfaced as a UI card — it never executes a PayPal call. The payout only happens when Siti clicks Approve in the browser. |
| Cannot mark a receipt "verified" | Any verified status passed by the AI is silently downgraded to `pending` in `addExpense()`. Only Siti can set verified via the UI or `update_receipt_status` (remitter-only tool). |
| Cannot verify receipts as Slamet | `update_receipt_status` is role-gated — if Slamet's session calls it, the tool returns an error and nothing changes. |
| Cannot set budgets as Slamet | `set_monthly_budget` is similarly role-gated to remitter only. |
| Cannot delete expenses or remittances | No delete tools exist in the agent's tool set at all. |
| Cannot access the PayPal API directly | The agent has no PayPal tool. USD conversion is computed server-side (`idrToUsd`) and injected into the approval draft — the model's own `paypalAmount` value is overridden if it doesn't match. |
| Cannot edit existing expenses | `add_expense` only creates new records; there's no `edit_expense` or `delete_expense` tool. |
| Cannot modify calendar events | Only `add_calendar_event` exists — no edit or delete. |
| Cannot act on behalf of the other user | The agent is always scoped to the authenticated session's role. Slamet cannot trigger Siti's tools and vice versa. |

---

## Stack

- **Frontend**: React 19, Vite 8, Tailwind CSS 4, Lucide icons
- **Backend**: Express 4, TypeScript (tsx dev / esbuild prod)
- **Database**: PostgreSQL (Render-managed, `pg` pool)
- **AI**: Google Gemini 3.8 Flash via `@google/genai` SDK v2 (function calling + multimodal vision)
- **Payments**: PayPal Payouts v1 (sandbox only — live is never used)
- **Notifications**: Fonnte WhatsApp gateway (optional)
- **Deploy**: Render (free tier, `render.yaml` blueprint)

---

## Local Setup

### Prerequisites

- Node.js ≥ 18
- PostgreSQL (local or remote)

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:

```env
# Required
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/remitpal"
NODE_ENV="development"

# AI Agent (get from https://aistudio.google.com/app/apikey)
GEMINI_API_KEY="your_gemini_api_key"

# PayPal Payouts v1, sandbox only (get from https://developer.paypal.com/dashboard)
PAYPAL_CLIENT_ID="your_sandbox_client_id"
PAYPAL_CLIENT_SECRET="your_sandbox_client_secret"
PAYPAL_ENV="sandbox"  # sandbox only — live is not supported and is ignored
PAYPAL_RECIPIENT_EMAIL="slamet_sandbox@example.com"  # a sandbox personal account

# Optional: demo without real credentials
PAYPAL_MOCK="false"   # set "true" for DEMO MODE (mock payout batches, labelled MOCK, no real payment)
AGENT_MOCK="false"    # set "true" to run a rule-based mock agent (no Gemini key needed)

# Optional: WhatsApp notifications via Fonnte
FONNTE_TOKEN=""
```

### 3. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Default demo accounts (DEMO — seeded automatically; passwords are set via `SEED_SITI_PASSWORD` / `SEED_SLAMET_PASSWORD` and are in the Devpost testing instructions, never in this repo):

| Username | Role |
|----------|------|
| `siti` | Remitter (Hong Kong) |
| `slamet` | Manager (Indramayu) |

---

## Demo without real credentials (mock mode)

Set both mock flags to test the full UI flow with no external dependencies:

```env
PAYPAL_MOCK="true"
AGENT_MOCK="true"
```

- As **Siti**: type *"Send 15M for this month: 5M renovation, 3.5M tuition, 4M allowance, 2.5M savings"* → the agent produces a structured approval card → click **Approve & Send via PayPal** → a mock payout batch (`MOCK-<timestamp>`) is created and the remittance is recorded immediately, labelled MOCK (DEMO MODE — no PayPal payment moved).
- As **Slamet**: attach any image and type *"Bought tiles for 2.85M at TB Rejeki Abadi"* → the agent classifies it, sets status to pending (Siti reviews it), and adds it to the ledger.

---

## PayPal Sandbox Setup (Payouts v1)

1. Go to [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/applications/sandbox).
2. Create a **REST app** on a sandbox **Business** account with **Payouts approved** → copy the **Client ID** and **Secret** into `.env`. (This business account is Siti's own sender account — RemitPal is her personal app, not a multi-user service; she funds it herself and the app holds no one else's money.)
3. Under **Sandbox Accounts**, create a **Personal** account for Slamet — copy its email into `PAYPAL_RECIPIENT_EMAIL`. Slamet is the receiver; the payout is sent to his email.
4. Set `PAYPAL_ENV=sandbox`. Live PayPal is never used.

### Why Payouts v1 (and not Personal Payments v2)

For a multi-user remittance service, Personal Payments v2 would be the right method — each sender would pay from their own personal account in PayPal's UI. But that API is limited-release and is **not enabled on this sandbox app**: token creation returns `403 NOT_AUTHORIZED / PERMISSION_DENIED` (debug_id `f13223105b617`), and approval must be requested via p2papiapproval@paypal.com. Payouts v1 **is** approved on the same app, and it is the right method for RemitPal's actual scope: a personal app for one sender (Siti), whose own business account sends the payout only after she approves a plan in-app.

### How the payment flow works

1. Siti approves a remittance in the chat (or the Remittance Tracker). The server derives the USD amount from the approved IDR total at Rp 16,000/USD — e.g. Rp 15,000,000 → **USD 937.50** (display rate only; the client never supplies the USD amount).
2. `POST /api/paypal/send` creates a single-item Payouts v1 batch for Slamet's sandbox personal account (currency `USD`, recipient by email), sent from Siti's own sandbox business account.
3. The app creates the ledger record ONLY when PayPal reports the payout item `SUCCESS`. The payout batch id becomes the reference number. Any other outcome creates no record.
4. **DEMO MODE** (`PAYPAL_MOCK=true`): no PayPal call is made. The batch id is `MOCK-<timestamp>` and the record is created immediately, labelled `MOCK — DEMO MODE, no PayPal payment moved`.

Before filming or judging, check the sandbox business account balance is at least **USD 937.50** — a payout fails if the sender balance is insufficient.

Never claim a sandbox transfer is a live international remittance.

---

## Production Deploy (Render)

The `render.yaml` blueprint provisions a free PostgreSQL database and a Node web service:

```bash
# From the Render Dashboard → New → Blueprint → point to this repo
```

Set environment variables in the Render dashboard (marked `sync: false` in `render.yaml`):
- `GEMINI_API_KEY` (and/or `OPENROUTER_API_KEY` — the OpenRouter fallback, model `OPENROUTER_MODEL`, defaults to `nvidia/nemotron-3.5-super-vl:free`)
- `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_RECIPIENT_EMAIL`
- `FONNTE_TOKEN` (optional)

---

## Project Structure

```
remitpal/
├── server.ts              # Express API server entry point
├── server/
│   ├── db.ts              # PostgreSQL schema, seed data, all DB helpers
│   ├── agent.ts           # Gemini AI agent (function calling, tools, mock fallback)
│   ├── paypal.ts          # PayPal Payouts v1 helper, sandbox only (OAuth, payout create/status, mock)
│   └── whatsapp.ts        # Fonnte WhatsApp notification broadcast
├── src/
│   ├── App.tsx            # Root component, global state, all handlers
│   ├── components/
│   │   ├── ChatBar.tsx        # Always-visible AI agent chat bar (WhatsApp-style)
│   │   ├── RemittanceTracker.tsx  # Remittance ledger + PayPal send modal
│   │   ├── ExpenseList.tsx        # Expense ledger
│   │   ├── ReceiptVault.tsx       # Receipt gallery + verification
│   │   ├── BudgetPlanner.tsx      # Monthly budget allocations
│   │   ├── CalendarScheduler.tsx  # Family task calendar
│   │   ├── BentoOverview.tsx      # Dashboard overview
│   │   ├── AuditReport.tsx        # Printable family audit report
│   │   ├── AuthModal.tsx          # Login (Siti / Slamet)
│   │   └── NotificationFeed.tsx   # Activity feed
│   ├── utils/
│   │   ├── api.ts         # All fetch helpers (auth, data, PayPal, agent)
│   │   ├── formatters.ts  # Currency & date formatters
│   │   └── storage.ts     # Local storage fallback
│   ├── types.ts           # Shared TypeScript types
│   └── i18n/translations.ts
├── .env.example           # All environment variables documented
└── render.yaml            # One-click Render deploy blueprint
```

---

## License

[MIT](./LICENSE) — built for the PayPal Hackathon 2026.
