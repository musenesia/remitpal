// PayPal Payouts v1 integration — SANDBOX ONLY.
//
// RemitPal is Siti's PERSONAL app, not a multi-user service. The payout
// sender is Siti's own PayPal business account (the account that owns
// PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET): she funds it herself, the app
// holds no one else's money, and a payout is created only after she
// approves a plan in the app. The server creates a single-item payout
// batch to Slamet's verified PayPal email and reports PayPal's real
// batch/item status back; a ledger record is created ONLY when PayPal
// says the payout item is SUCCESS.
//
// For a multi-user version, Personal Payments v2 would be the right
// method so each sender pays from their own personal account — but that
// API is limited-release and is NOT enabled on this sandbox app (token
// creation returns 403 NOT_AUTHORIZED, debug_id f13223105b617), so this
// submission uses Payouts v1, which is approved on the same app.
//
// Docs: https://developer.paypal.com/api/payments.payouts-batch/v1/
//   - Create batch: POST /v1/payments/payouts
//   - Batch status:  GET  /v1/payments/payouts/{payout_batch_id}
// Auth: OAuth 2.0 client-credentials grant (Basic auth with client_id:secret).
//
// LIVE IS NEVER USED: the base URL is always the sandbox host. If
// PAYPAL_ENV is set to "live" it is ignored with a console warning —
// this app must never move real money.
//
// Configuration (see .env.example):
//   PAYPAL_CLIENT_ID         — required for real sandbox payouts
//   PAYPAL_CLIENT_SECRET     — required for real sandbox payouts
//   PAYPAL_ENV               — "sandbox" only; "live" is ignored (see above)
//   PAYPAL_RECIPIENT_EMAIL   — Slamet's sandbox personal account email
//   PAYPAL_SENDER_EMAIL      — optional; Siti's business account email,
//                              for reference only (the sender is implicit
//                              in the OAuth token — whoever owns the
//                              client id — and is NOT sent in the API call)
//   PAYPAL_MOCK              — "true" for DEMO MODE: payouts are fake
//                              (MOCK-<timestamp>), never a real payment,
//                              and records are labelled MOCK.
//
// Display FX rate for the whole project: Rp 16,000/USD, display-only.
// The USD amount is always derived server-side from the approved IDR total
// (idrToUsd) — the client never supplies the USD amount that PayPal sees.

export const IDR_PER_USD = 16000;

/** Derive the USD amount string (2 decimals) from an IDR total. Display rate only. */
export function idrToUsd(amountIdr: number): string {
  return (Number(amountIdr) / IDR_PER_USD).toFixed(2);
}

const SANDBOX_BASE_URL = 'https://api-m.sandbox.paypal.com';

interface PaypalConfig {
  baseUrl: string;
  clientId?: string;
  clientSecret?: string;
  recipientEmail?: string;
  senderEmail?: string;
  mock: boolean;
}

let liveEnvWarned = false;

function getConfig(): PaypalConfig {
  if (process.env.PAYPAL_ENV === 'live' && !liveEnvWarned) {
    liveEnvWarned = true;
    console.warn(
      '[PayPal] PAYPAL_ENV="live" is not supported by RemitPal — ignoring it and using the sandbox API. Live PayPal is never called.'
    );
  }
  return {
    baseUrl: SANDBOX_BASE_URL,
    clientId: process.env.PAYPAL_CLIENT_ID,
    clientSecret: process.env.PAYPAL_CLIENT_SECRET,
    recipientEmail: process.env.PAYPAL_RECIPIENT_EMAIL,
    senderEmail: process.env.PAYPAL_SENDER_EMAIL,
    mock: process.env.PAYPAL_MOCK === 'true',
  };
}

/** Error carrying an HTTP status + machine-readable code for PayPal failures. */
export class PayPalError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'PayPalError';
    this.status = status;
    this.code = code;
  }
}

/** Whether the app can attempt a payout (real credentials OR mock mode). */
export function isPayPalConfigured(): boolean {
  const cfg = getConfig();
  return cfg.mock || (!!cfg.clientId && !!cfg.clientSecret && !!cfg.recipientEmail);
}

/** Human-readable reason when payouts are unavailable. */
export function payPalConfigError(): string | null {
  const cfg = getConfig();
  if (cfg.mock) return null;
  if (!cfg.clientId || !cfg.clientSecret) return 'PayPal credentials not set (PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET).';
  if (!cfg.recipientEmail) return 'PayPal recipient not set (PAYPAL_RECIPIENT_EMAIL).';
  return null;
}

// ---------------------------------------------------------------------------
// OAuth access token (cached in memory, refreshed before expiry)
// ---------------------------------------------------------------------------

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  const cfg = getConfig();
  // Reuse a still-valid token (with a 60s safety margin).
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.token;
  }

  const auth = Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString('base64');
  const res = await fetch(`${cfg.baseUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ grant_type: 'client_credentials' }).toString(),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new PayPalError(res.status, 'PAYPAL_ERROR', `PayPal auth failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return data.access_token;
}

// ---------------------------------------------------------------------------
// Payouts
// ---------------------------------------------------------------------------

export interface PayoutItemResult {
  payoutItemId?: string;
  transactionStatus?: string; // SUCCESS | PENDING | UNCLAIMED | FAILED | RETURNED | BLOCKED
  receiver?: string;
  amount?: { value: string; currency: string };
}

export interface PayoutResult {
  payoutBatchId: string;
  batchStatus: string; // PENDING | PROCESSING | SUCCESS | DENIED
  items: PayoutItemResult[];
  mock: boolean;
}

export interface SendPayoutParams {
  amount: string; // e.g. "937.50" — always derived server-side via idrToUsd
  currency: string; // must be 'USD'
  note?: string;
  senderItemId?: string; // idempotency hint for the single item
}

/**
 * Create a single-item payout batch to the configured recipient (Slamet),
 * sent from Siti's own business account (the API caller account).
 * After creating the batch, fetches its status once so we can report the
 * final (or near-final) state back to the caller.
 *
 * Without credentials (and not in mock mode) throws a 503
 * MISSING_CREDENTIALS error — never a fake payout. In mock mode returns a
 * MOCK batch with no PayPal call; the caller must label it MOCK.
 */
export async function sendPayout(params: SendPayoutParams): Promise<PayoutResult> {
  const cfg = getConfig();

  if (params.currency !== 'USD') {
    throw new PayPalError(400, 'VALIDATION_ERROR', 'currency is required and must be "USD".');
  }
  if (!/^\d+(\.\d{1,2})?$/.test(params.amount) || Number(params.amount) <= 0) {
    throw new PayPalError(
      400,
      'VALIDATION_ERROR',
      'amount is required and must be a string decimal > 0 with at most 2 decimal places, e.g. "937.50".'
    );
  }

  // DEMO MODE: no credentials, no PayPal call, no fake payment.
  if (cfg.mock) {
    const id = `MOCK-${Date.now()}`;
    return {
      payoutBatchId: id,
      batchStatus: 'SUCCESS',
      items: [
        {
          payoutItemId: `${id}-ITEM`,
          transactionStatus: 'SUCCESS',
          receiver: cfg.recipientEmail || 'mock-recipient@example.com',
          amount: { value: params.amount, currency: params.currency },
        },
      ],
      mock: true,
    };
  }

  const err = payPalConfigError();
  if (err) {
    throw new PayPalError(503, 'MISSING_CREDENTIALS', `PayPal is not configured: ${err} No fake payout was created.`);
  }

  const token = await getAccessToken();
  const senderBatchId = `remitpal_${Date.now()}`;
  const senderItemId = params.senderItemId || `item_${Date.now()}`;

  const body = {
    sender_batch_header: {
      sender_batch_id: senderBatchId,
      email_subject: 'You received a remittance from RemitPal',
      email_message: 'Siti sent you a family remittance via PayPal.',
      recipient_type: 'EMAIL',
    },
    items: [
      {
        recipient_type: 'EMAIL',
        amount: {
          value: params.amount,
          currency: params.currency,
        },
        receiver: cfg.recipientEmail,
        note: params.note || 'Family remittance from Siti via RemitPal',
        sender_item_id: senderItemId,
      },
    ],
  };

  const res = await fetch(`${cfg.baseUrl}/v1/payments/payouts`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'PayPal-Request-Id': senderBatchId, // idempotency for the batch
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new PayPalError(res.status, 'PAYPAL_ERROR', `PayPal payout failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as any;
  const batchId: string = data.batch_header?.payout_batch_id;
  let items: PayoutItemResult[] = [];

  if (Array.isArray(data.items) && data.items.length > 0) {
    items = data.items.map((it: any) => ({
      payoutItemId: it.payout_item_id,
      transactionStatus: it.transaction_status,
      receiver: it.payout_item?.receiver,
      amount: it.amount,
    }));
  }

  // If the create response didn't include processed items, fetch the batch.
  if (items.length === 0 && batchId) {
    const status = await getPayoutStatus(batchId);
    items = status.items;
  }

  return {
    payoutBatchId: batchId,
    batchStatus: data.batch_header?.batch_status || 'PENDING',
    items,
    mock: false,
  };
}

/** Fetch the current status of a payout batch (and its items). */
export async function getPayoutStatus(payoutBatchId: string): Promise<{ batchStatus: string; items: PayoutItemResult[] }> {
  const cfg = getConfig();

  if (cfg.mock) {
    return { batchStatus: 'SUCCESS', items: [{ transactionStatus: 'SUCCESS' }] };
  }

  const cfgErr = payPalConfigError();
  if (cfgErr) {
    throw new PayPalError(503, 'MISSING_CREDENTIALS', `PayPal is not configured: ${cfgErr}`);
  }

  const token = await getAccessToken();
  const res = await fetch(`${cfg.baseUrl}/v1/payments/payouts/${encodeURIComponent(payoutBatchId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new PayPalError(res.status, 'PAYPAL_ERROR', `PayPal status check failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as any;
  const items: PayoutItemResult[] = (data.items || []).map((it: any) => ({
    payoutItemId: it.payout_item_id,
    transactionStatus: it.transaction_status,
    receiver: it.payout_item?.receiver,
    amount: it.amount,
  }));

  return {
    batchStatus: data.batch_header?.batch_status || 'UNKNOWN',
    items,
  };
}
