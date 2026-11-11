// PayPal Payouts API integration (sandbox / live).
//
// Sends a single-item payout batch from the app's PayPal business account to
// the recipient's (Slamet's) PayPal account. The app acts as the sender, which
// matches the remittance-corridor model: Siti authorises a payout and PayPal
// delivers the funds to Slamet's PayPal account.
//
// Docs: https://developer.paypal.com/api/payments.payouts-batch/v1/
//   - Create batch: POST /v1/payments/payouts
//   - Batch status:  GET  /v1/payments/payouts/{payout_batch_id}
// Auth: OAuth 2.0 client-credentials grant (Basic auth with client_id:secret).
//
// Configuration (see .env.example):
//   PAYPAL_CLIENT_ID         — required for live payouts
//   PAYPAL_CLIENT_SECRET     — required for live payouts
//   PAYPAL_ENV               — "sandbox" (default) | "live"
//   PAYPAL_RECIPIENT_EMAIL    — Slamet's PayPal account email (the payout receiver)
//   PAYPAL_SENDER_EMAIL      — optional; sender email shown in batch header
//   PAYPAL_MOCK              — "true" to simulate payouts without credentials

interface PaypalConfig {
  baseUrl: string;
  clientId?: string;
  clientSecret?: string;
  recipientEmail?: string;
  senderEmail?: string;
  mock: boolean;
}

function getConfig(): PaypalConfig {
  const isLive = process.env.PAYPAL_ENV === 'live';
  return {
    baseUrl: isLive ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com',
    clientId: process.env.PAYPAL_CLIENT_ID,
    clientSecret: process.env.PAYPAL_CLIENT_SECRET,
    recipientEmail: process.env.PAYPAL_RECIPIENT_EMAIL,
    senderEmail: process.env.PAYPAL_SENDER_EMAIL,
    mock: process.env.PAYPAL_MOCK === 'true',
  };
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
    throw new Error(`PayPal auth failed (${res.status}): ${text}`);
  }

  const data = await res.json() as { access_token: string; expires_in: number };
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
  amount: string; // e.g. "7500.00"
  currency: string; // e.g. "HKD"
  note?: string;
  senderItemId?: string; // idempotency hint for the single item
}

/**
 * Create a single-item payout batch to the configured recipient (Slamet).
 * After creating the batch, fetches its status once so we can report the final
 * (or near-final) state back to the caller.
 */
export async function sendPayout(params: SendPayoutParams): Promise<PayoutResult> {
  const cfg = getConfig();

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
  if (err) throw new Error(err);

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
    throw new Error(`PayPal payout failed (${res.status}): ${text}`);
  }

  const data = await res.json() as any;
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

  const token = await getAccessToken();
  const res = await fetch(`${cfg.baseUrl}/v1/payments/payouts/${payoutBatchId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`PayPal status check failed (${res.status}): ${text}`);
  }

  const data = await res.json() as any;
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


