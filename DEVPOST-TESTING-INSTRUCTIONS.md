# RemitPal (Amanah) — Devpost testing instructions (paste-ready draft)

Prepared 2026-11-11 (WIB), for the `auth-personal-payments-v2` branch of
`musenesia/remitpal`. This file contains PLACEHOLDERS only — never real
credentials. Replace the placeholders with real values ONLY in the
Devpost testing-instructions field itself (visible to judges), never
in this file, never in the public repo, never on the demo page,
never in the video. Do not paste this draft into Devpost with the
placeholders still in it, and do not commit a filled-in copy.

## Before you paste (in this order)

1. **Merge `auth-personal-payments-v2` into `main` and make the repo
   public.** Devpost requires a public repo with a visible
   open-source license. The branch adds the MIT LICENSE
   (`Copyright (c) 2026 musenesia`); do not submit while the repo
   is still private or the branch is unmerged.
2. **Deploy to Render and verify the deployed demo on a real
   browser first.** Open the Render service URL, log in as `siti`,
   and click through the whole walkthrough below (chat → approval
   card → PayPal sandbox → return → receipt → Receipt Vault →
   Audit Report). If it is blank or the login fails, stop — do
   not share the URL. No real-browser render of this branch was
   verified in the build environment.
3. **Run the credentialed sandbox beat once yourself** (token →
   PayPal UI as the sandbox buyer → return → COMPLETED token
   lookup → record with the transaction ID). That beat is
   implemented but was never tested end-to-end in the build
   environment (no credentials exist there). Say which variant
   the judges are getting — credentialed sandbox or DEMO MODE —
   and delete the variant below that does not apply. Do not claim
   a live PayPal payment on a DEMO MODE URL.
4. **Record the under-3-minute, music-free video** showing the
   credentialed sandbox beat (or DEMO MODE, labelled as such if
   that is the variant submitted).

## Paste into Devpost — "Testing instructions" field

> Live demo (no install, no account creation needed):
> [DEPLOYED URL — FILL IN AFTER RENDER DEPLOY]
>
> Log in with a demo account (passwords are in this Devpost
> field only — see the credentials block at the end; they are
> never in the repo, the demo page, or the video):
>
> - `siti` — Remitter (Siti Rahayu, Hong Kong)
> - `slamet` — Manager (Slamet Widodo, Indramayu)
>
> Click-through for judges (about 3 minutes). All data is seeded
> demo data, labelled DEMO in the app.
>
> 1. Log in as `siti`. The chat bar at the bottom of every
>    screen is the AI agent (Gemini 3.8 Flash). Type:
>    "Send 15 million for this month: 5M renovation, 3.5M
>    tuition, 4M allowance, 2.5M savings"
>    The agent structures the plan (renovation Rp 5,000,000,
>    tuition Rp 3,500,000, allowance Rp 4,000,000, savings
>    Rp 2,500,000 — total Rp 15,000,000) and shows an approval
>    card. The card shows USD 937.50, derived server-side from
>    Rp 15,000,000 at Rp 16,000/USD — a display rate only,
>    never a live exchange rate, never sent to PayPal as an FX
>    rate. Nothing moves until Siti approves: the AI never
>    sends money on its own.
> 2. Click **Approve & Send via PayPal** on the approval card.
>    [CREDENTIALED SANDBOX VARIANT: The server creates a
>    PayPal Personal Payments v2 token and you are redirected
>    to PayPal's sandbox UI. Log in there with the sandbox
>    buyer credentials at the end of this field, approve the
>    payment, and PayPal returns you to the app. The app looks
>    the token up and creates the remittance record ONLY when
>    the return says success AND the token lookup says
>    COMPLETED AND a transaction ID is present. The record
>    shows that PayPal transaction ID as its reference number.
>    / DEMO MODE VARIANT: No PayPal call is made. A mock token
>    (MOCK-...) is created and the remittance is recorded
>    immediately, labelled MOCK — DEMO MODE, no PayPal payment
>    moved. The sidebar badges show MOCK/OFF, never LIVE.]
>    Delete the bracket that does not apply before pasting.
> 3. Still as `siti`, open the Remittances tab: the new transfer
>    is listed with its PayPal transaction ID (credentialed
>    variant) or its MOCK reference (DEMO MODE variant).
> 4. Log out, then log in as `slamet`. Attach a receipt photo
>    and type in the chat bar: "Bought granite tiles for 2.85M
>    at TB Rejeki Abadi" — the agent reads the photo (vision),
>    extracts vendor, amount and category, and adds the expense
>    with status **pending**. The AI's assessment is not a
>    verification: nothing is marked verified until Siti
>    confirms it.
> 5. Log out, log back in as `siti`, and open the Receipt Vault.
>    Confirm the granite-tiles receipt (or flag it / ask for
>    clarification). Only Siti can mark a receipt verified;
>    Slamet cannot verify his own receipts.
> 6. Explore, in any order: the Overview dashboard, Budget Plan
>    (the 5M / 3.5M / 4M / 2.5M allocations), the Calendar /
>    Transfer & Task Schedule, Notifications, and the Audit
>    Report (printable). The Audit Report summarises the plan,
>    the PayPal-confirmed transfer, and the receipt statuses.
>
> Credentials for judges (Devpost field only — never in the
> repo, video, or demo page):
>
> - Demo logins: siti / [DEMO PASSWORD FOR SITI — FILL IN HERE]
>   and slamet / [DEMO PASSWORD FOR SLAMET — FILL IN HERE]
> - Sandbox buyer (PayPal sandbox UI, credentialed variant
>   only): [SANDBOX BUYER EMAIL] / [SANDBOX BUYER PASSWORD]
>   Replace these placeholders with real sandbox buyer test
>   credentials in this Devpost field only. Slamet's sandbox
>   personal account email is the payment receiver and is set
>   server-side (PAYPAL_RECIPIENT_EMAIL); judges never need to
>   type it.
>
> What this demo is not: this is a PayPal sandbox Personal
> Payments transfer, not a live international remittance; no
> real money moves and no live PayPal account is used. Siti and
> Slamet are demo personas. Seeded remittances in the ledger are
> BRI/Mandiri bank transfers, not PayPal — only the transfer you
> make in step 2 is a PayPal transfer, and only in the
> credentialed variant. Seeded expenses share one sample receipt
> photo. Slamet's local spends are recipient-reported, never
> PayPal-confirmed. Cash-out is not claimed instant, and
> per-card Visa Direct eligibility is not claimed. The app never
> holds funds and never becomes a remittance provider. The AI
> (Gemini 3.8 Flash when configured, labelled rule-based mock
> when AGENT_MOCK=true) assesses receipts and drafts plans; it
> never moves money, never verifies a receipt on its own, and
> never makes fraud findings.

## Local run (alternative to the deployed URL)

```bash
npm install
cp .env.example .env   # then fill in DATABASE_URL, GEMINI_API_KEY,
                       # PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET,
                       # PAYPAL_RECIPIENT_EMAIL (sandbox), APP_URL
npm run dev            # open http://localhost:3000
```

PostgreSQL is required (local or remote `DATABASE_URL`). With
no credentials set, the server answers 503 `MISSING_CREDENTIALS`
for PayPal tokens instead of faking one; with
`PAYPAL_MOCK=true` and `AGENT_MOCK=true` the full UI flow runs
in DEMO MODE with no external dependencies.

## Render deploy (for the developer, not the judges)

Blueprint: `render.yaml` (free web service + free PostgreSQL
database `amanah-db`). From the Render Dashboard → New →
Blueprint → point to this repo. Set these env vars in the
Render dashboard (all `sync: false` in `render.yaml`):
`GEMINI_API_KEY`, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`,
`PAYPAL_RECIPIENT_EMAIL`, `APP_URL` (the Render service URL —
it is the base of the PayPal return URL). `FONNTE_TOKEN` is
optional (WhatsApp notifications are silently skipped without
it). Health check is `GET /api/health` (returns `{ok:true}`).

Notes: a free Render web service sleeps after ~15 minutes idle
and takes about a minute to wake — that is expected, not a
broken demo. Free Render PostgreSQL expires 30 days after
creation; upgrade it before then or the demo data is lost.
Keep the Render service live until judging ends.

## How to tell which mode you are in

- `GET /api/status` (public, no secrets) reports the Gemini
  model and whether each integration is real or mock, and
  always reports PayPal env `sandbox`. The sidebar badges are
  wired to this endpoint: Gemini LIVE/MOCK/OFF, PayPal
  LIVE (sandbox)/MOCK/OFF.
- **Credentialed sandbox:** badges read LIVE (sandbox), the
  approval card redirects to PayPal's UI, and the record
  carries a real sandbox transaction ID.
- **DEMO MODE** (`PAYPAL_MOCK=true` / `AGENT_MOCK=true`):
  badges read MOCK, tokens are `MOCK-<timestamp>` with no
  approval URL, records are labelled
  "MOCK — DEMO MODE, no PayPal payment moved", and mock agent
  replies are prefixed "(mock mode)". A mock batch/token ID is
  never a real payment.

## Tools used — Devpost line (paste verbatim)

- PayPal Personal Payments v2 (sandbox)
- Gemini 3.8 Flash (`@google/genai`, function calling +
  multimodal vision)
- PostgreSQL
- Render — only once actually deployed (until the deploy is
  confirmed, say "Render (deployment planned, not yet live)")

Do NOT claim AG Grid, Bryntum, APIMatic, PayPal Orders,
Invoicing, Subscriptions, Webhooks, or the PayPal Agent
Toolkit — none of those are in this repo. Do NOT claim
PayPal Payouts — Payouts v1 was removed from this repo and
replaced by Personal Payments v2.

## Safety rules for this text

- Demo passwords and sandbox buyer credentials go in the
  Devpost testing-instructions field ONLY (visible to judges).
  Never in the public repo, never on the demo page, never in
  the video, never in this file with real values.
- The PayPal secret and the Gemini API key go only in the
  server environment / host secrets, never in Devpost, never
  in the repo. Judges never need a Gemini key and must never
  be asked for one.
- Never claim the demo includes live PayPal, a live remittance,
  a real person as recipient, a direct payment to a provider,
  instant cash-out, or per-card Visa Direct eligibility.
- Never claim Gemini is running while a "(mock mode)" label is
  showing, and never present a mock-agent answer as Gemini.
- Never claim a Payouts batch, an Orders payment, a capture,
  or an order ID: this flow has none. The PayPal record carries
  a Personal Payments transaction ID only.
- Seeded data is demo data: the seeded BRI/Mandiri remittances
  are bank transfers, not PayPal, and the seeded expenses share
  a sample receipt photo. Say so; do not let a judge mistake
  them for PayPal history.

## Submission sequencing

- Planning target: submit by **Nov 11, 2026** to be safe
  (Devpost lists Nov 12, 15:00 ET = Nov 13, ~03:00 WIB).
  Verify the exact deadline on the official Devpost page before
  submitting — do not rely on this file as the deadline source.
- Link the demo URL in three places once verified: the Devpost
  submission, the repo README, and the video end card.
- Still owed at time of writing (2026-11-11): merge
  `auth-personal-payments-v2` into `main`, make the repo public,
  Render deploy + real-browser check, credentialed sandbox
  Personal Payments run, credentialed Gemini run, under-3-minute
  video. None of these is confirmed done in any record seen by
  the docs worker.
