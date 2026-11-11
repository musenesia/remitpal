// PayPal Personal Payments v2 integration — SANDBOX ONLY.
//
// Siti (the sender) approves a remittance in the UI; the server creates a
// Personal Payments token, the frontend redirects Siti to PayPal's UI
// (initiate_payment link + return_url), PayPal returns her to the app with
// only `status` + `transactionId`, and the app looks the token up before
// creating any ledger record. Money never moves server-side, and no record
// is created until the token lookup says COMPLETED.
//
// Docs: https://developer.paypal.com/docs/api/personal-payments/v2/
//   - Create token: POST /v2/personal-payments/tokens
//   - Get token:    GET  /v2/personal-payments/tokens/{token_id}
// Auth: OAuth 2.0 client-credentials grant (Basic auth with client_id:secret).
//
// LIVE IS NEVER USED: the base URL is always the sandbox host. If
// PAYPAL_ENV is set to "live" it is ignored with a console warning —
// this app must never move real money.
//
// Configuration (see .env.example):
//   PAYPAL_CLIENT_ID         — required for real sandbox tokens
//   PAYPAL_CLIENT_SECRET     — required for real sandbox tokens
//   PAYPAL_ENV               — "sandbox" only; "live" is ignored (see above)
//   PAYPAL_RECIPIENT_EMAIL   — Slamet's sandbox personal account email
//   PAYPAL_MOCK              — "true" for DEMO MODE: tokens are fake
//                              (MOCK-<timestamp>, no PayPal URL), never a
//                              real payment, and records are labelled MOCK.
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

/** Whether the app can attempt a Personal Payments token (real credentials OR mock mode). */
export function isPayPalConfigured(): boolean {
  const cfg = getConfig();
  return cfg.mock || (!!cfg.clientId && !!cfg.clientSecret && !!cfg.recipientEmail);
}

/** Human-readable reason when Personal Payments tokens are unavailable. */
export function payPalConfigError(): string | null {
  const cfg = getConfig();
  if (cfg.mock) return null;
  if (!cfg.clientId || !cfg.clientSecret) return 'PayPal credentials not set (PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET).';
  if (!cfg.recipientEmail) return 'PayPal recipient not set (PAYPAL_RECIPIENT_EMAIL).';
  return null;
}

function isValidEmail(value: unknown): value is string {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isPositiveDecimalString(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  if (!/^\d+(\.\d{1,2})?$/.test(value)) return false;
  return Number(value) > 0;
}

function isHttpUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
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
// Personal Payments v2 tokens
// ---------------------------------------------------------------------------

export interface CreatePersonalPaymentTokenParams {
  receiverEmail: string;
  /** USD amount as a decimal string with at most 2dp, e.g. "937.50". Always derived server-side via idrToUsd. */
  amount: string;
  currency: string; // must be 'USD'
  noteToReceiver?: string;
  externalReferenceId: string; // 1-127 chars
  returnUrl: string; // http(s) URL the PayPal UI returns to
}

export interface PersonalPaymentTokenResult {
  tokenId: string;
  status: string;
  /** PayPal approval URL (with return_url appended), or null in mock mode. */
  initiatePaymentUrl: string | null;
  amount: string;
  currency: string;
  receiverEmail: string;
  mock: boolean;
}

export interface PersonalPaymentTokenStatus {
  status: string;
  /** PayPal's token id, or null — a transaction id is never invented. */
  transactionId: string | null;
  amount: string | null;
  currency: string | null;
  tokenId: string;
  mock: boolean;
}

/**
 * Create a Personal Payments v2 token for Siti to approve in PayPal's UI.
 * Validates every field; without credentials throws a 503 MISSING_CREDENTIALS
 * error — never a fake token. In mock mode returns a MOCK token with no URL.
 */
export async function createPersonalPaymentToken(
  params: CreatePersonalPaymentTokenParams
): Promise<PersonalPaymentTokenResult> {
  const cfg = getConfig();

  if (!isValidEmail(params.receiverEmail)) {
    throw new PayPalError(400, 'VALIDATION_ERROR', 'receiverEmail is required and must be a valid email address.');
  }
  if (!isPositiveDecimalString(params.amount)) {
    throw new PayPalError(
      400,
      'VALIDATION_ERROR',
      'amount is required and must be a string decimal > 0 with at most 2 decimal places, e.g. "937.50".'
    );
  }
  if (params.currency !== 'USD') {
    throw new PayPalError(400, 'VALIDATION_ERROR', 'currency is required and must be "USD".');
  }
  if (
    params.noteToReceiver !== undefined &&
    params.noteToReceiver !== null &&
    (typeof params.noteToReceiver !== 'string' || params.noteToReceiver.length > 255)
  ) {
    throw new PayPalError(400, 'VALIDATION_ERROR', 'noteToReceiver, when given, must be a string of at most 255 characters.');
  }
  if (
    typeof params.externalReferenceId !== 'string' ||
    params.externalReferenceId.length < 1 ||
    params.externalReferenceId.length > 127
  ) {
    throw new PayPalError(400, 'VALIDATION_ERROR', 'externalReferenceId is required, 1-127 characters.');
  }
  if (!isHttpUrl(params.returnUrl)) {
    throw new PayPalError(400, 'VALIDATION_ERROR', 'returnUrl is required and must be an http(s) URL.');
  }

  // DEMO MODE: no credentials, no PayPal call, no fake URL, no fake transaction id.
  if (cfg.mock) {
    return {
      tokenId: `MOCK-${Date.now()}`,
      status: 'CREATED',
      initiatePaymentUrl: null,
      amount: params.amount,
      currency: params.currency,
      receiverEmail: params.receiverEmail,
      mock: true,
    };
  }

  const cfgErr = payPalConfigError();
  if (cfgErr) {
    throw new PayPalError(503, 'MISSING_CREDENTIALS', `PayPal is not configured: ${cfgErr} No fake token was created.`);
  }

  const token = await getAccessToken();
  const payload: Record<string, unknown> = {
    receiver: { id: params.receiverEmail, type: 'EMAIL' },
    amount: { currency_code: params.currency, value: params.amount },
    payment_type: 'PERSONAL',
    intent: 'CAPTURE',
    external_reference_id: params.externalReferenceId,
  };
  if (typeof params.noteToReceiver === 'string' && params.noteToReceiver.trim() !== '') {
    payload.note_to_receiver = params.noteToReceiver;
  }

  const res = await fetch(`${cfg.baseUrl}/v2/personal-payments/tokens`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new PayPalError(res.status, 'PAYPAL_ERROR', `PayPal token creation failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as any;
  const link = Array.isArray(data.links) ? data.links.find((l: any) => l.rel === 'initiate_payment') : null;
  if (!data.id || !link || !link.href) {
    throw new PayPalError(502, 'PAYPAL_ERROR', 'PayPal token response had no id or initiate_payment link.');
  }

  const separator = link.href.includes('?') ? '&' : '?';
  const initiatePaymentUrl = `${link.href}${separator}return_url=${encodeURIComponent(params.returnUrl)}`;

  return {
    tokenId: data.id,
    status: data.status,
    initiatePaymentUrl,
    amount: params.amount,
    currency: params.currency,
    receiverEmail: params.receiverEmail,
    mock: false,
  };
}

/**
 * Look up a Personal Payments token after the PayPal return.
 * Mock mode reports COMPLETED for the mock token id (DEMO MODE only).
 * Real mode returns PayPal's status verbatim; the transaction id is
 * PayPal's id, or null — never invented.
 */
export async function getPersonalPaymentToken(tokenId: string): Promise<PersonalPaymentTokenStatus> {
  const cfg = getConfig();

  if (cfg.mock) {
    return { status: 'COMPLETED', transactionId: tokenId, amount: null, currency: null, tokenId, mock: true };
  }

  const cfgErr = payPalConfigError();
  if (cfgErr) {
    throw new PayPalError(503, 'MISSING_CREDENTIALS', `PayPal is not configured: ${cfgErr}`);
  }

  const token = await getAccessToken();
  const res = await fetch(`${cfg.baseUrl}/v2/personal-payments/tokens/${encodeURIComponent(tokenId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new PayPalError(res.status, 'PAYPAL_ERROR', `PayPal token lookup failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as any;
  return {
    status: data.status,
    transactionId: data.id ?? null,
    amount: data.amount?.value ?? null,
    currency: data.amount?.currency_code ?? null,
    tokenId,
    mock: false,
  };
}
