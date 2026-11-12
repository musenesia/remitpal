import { AppData, CalendarEvent, ExpenseItem, MonthlyBudget, ReceiptStatus, RemittanceRecord, UserProfile, AppNotification } from '../types';
import { loadAppData, saveAppData } from './storage';

const TOKEN_KEY = 'remitpal_auth_token';
const USER_KEY = 'remitpal_auth_user';

/** Display FX rate for the whole project: Rp 16,000/USD, display-only. */
export const IDR_PER_USD = 16000;

/** Derive the USD amount string (2 decimals) from an IDR total. Display rate only. */
export function idrToUsdDisplay(amountIdr: number): string {
  return (Number(amountIdr) / IDR_PER_USD).toFixed(2);
}

/**
 * Safely parse a Response as JSON. Reads the body as text first so a non-JSON
 * response (HTML error page from a proxy/CDN) surfaces a readable error
 * instead of the cryptic "Unexpected token '<'" parse failure.
 */
async function safeJson(res: Response): Promise<any> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(
      `Server returned non-JSON (HTTP ${res.status}): ${text.slice(0, 200)}`
    );
  }
}

export function getStoredAuth(): { user: UserProfile | null; token: string | null } {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const userRaw = localStorage.getItem(USER_KEY);
    const user = userRaw ? JSON.parse(userRaw) : null;
    return { user, token };
  } catch {
    return { user: null, token: null };
  }
}

export function saveStoredAuth(user: UserProfile | null, token: string | null): void {
  if (user && token) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }
}

// -------------------------------------------------------------
// Authenticated fetch — every data/sync/notification/paypal/agent
// call goes through this so the stored Bearer token is attached.
// On 401 it clears the stored auth and throws an error whose
// message contains 'Unauthorized'.
// -------------------------------------------------------------

export async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const { token } = getStoredAuth();
  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string> | undefined),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(input, { ...init, headers });
  if (res.status === 401) {
    // A genuine 401 means OUR session token was rejected (expired/invalid).
    // Mark the error so callers can distinguish a real session failure from
    // other errors (e.g. a Gemini API failure whose message happens to
    // contain the word "token") — do NOT use free-text pattern matching.
    saveStoredAuth(null, null);
    const err = new Error('Unauthorized: session expired or invalid — please log in again.');
    (err as any).isUnauthorized = true;
    throw err;
  }
  return res;
}

export async function fetchAppData(): Promise<{ data: AppData; fromServer: boolean; unauthorized?: boolean }> {
  try {
    const res = await apiFetch('/api/data');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (json.data && Array.isArray(json.data.expenses)) {
      saveAppData(json.data);
      return { data: json.data, fromServer: true };
    }
  } catch (err: any) {
    // A genuine 401 must NOT fall back silently to local seed data: report it
    // so the UI can prompt login instead. Use the typed flag set by apiFetch,
    // not free-text matching, so other errors don't trigger a false logout.
    if (err?.isUnauthorized) {
      return { data: loadAppData(), fromServer: false, unauthorized: true };
    }
    console.warn('[RemitPal] Server offline or unreachable, using local storage:', err);
  }
  return { data: loadAppData(), fromServer: false };
}

export async function syncAllData(data: AppData): Promise<boolean> {
  saveAppData(data);
  try {
    const res = await apiFetch('/api/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.ok;
  } catch (err) {
    console.warn('[RemitPal Sync] Server offline, kept in local storage:', err);
    return false;
  }
}

export async function syncExpense(expense: ExpenseItem): Promise<void> {
  try {
    await apiFetch('/api/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(expense)
    });
  } catch (err) {
    console.warn('[RemitPal Sync Expense]: Offline', err);
  }
}

export async function syncExpenseReceiptStatus(id: string, receiptStatus: ReceiptStatus, verificationNotes?: string, verifiedAt?: string): Promise<void> {
  try {
    await apiFetch(`/api/expenses/${id}/receipt`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ receiptStatus, verificationNotes, verifiedAt })
    });
  } catch (err) {
    console.warn('[RemitPal Sync Receipt]: Offline', err);
  }
}

export async function deleteExpenseApi(id: string): Promise<void> {
  try {
    await apiFetch(`/api/expenses/${id}`, { method: 'DELETE' });
  } catch (err) {
    console.warn('[RemitPal Delete Expense]: Offline', err);
  }
}

export async function syncRemittance(record: RemittanceRecord): Promise<void> {
  try {
    await apiFetch('/api/remittances', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record)
    });
  } catch (err) {
    console.warn('[RemitPal Sync Remittance]: Offline', err);
  }
}

export async function syncBudget(budget: MonthlyBudget): Promise<void> {
  try {
    await apiFetch('/api/budgets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(budget)
    });
  } catch (err) {
    console.warn('[RemitPal Sync Budget]: Offline', err);
  }
}

export async function syncCalendarEvent(event: CalendarEvent): Promise<void> {
  try {
    await apiFetch('/api/calendar-events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event)
    });
  } catch (err) {
    console.warn('[RemitPal Sync Event]: Offline', err);
  }
}

export async function toggleCalendarEventApi(id: string): Promise<void> {
  try {
    await apiFetch(`/api/calendar-events/${id}/toggle`, { method: 'PATCH' });
  } catch (err) {
    console.warn('[RemitPal Toggle Event]: Offline', err);
  }
}

export async function deleteCalendarEventApi(id: string): Promise<void> {
  try {
    await apiFetch(`/api/calendar-events/${id}`, { method: 'DELETE' });
  } catch (err) {
    console.warn('[RemitPal Delete Event]: Offline', err);
  }
}

export async function resetDatabaseApi(): Promise<AppData | null> {
  try {
    const res = await apiFetch('/api/reset', { method: 'POST' });
    if (res.ok) {
      const json = await res.json();
      if (json.data) {
        saveAppData(json.data);
        return json.data;
      }
    }
  } catch (err) {
    console.warn('[RemitPal Reset DB]: Offline', err);
  }
  return null;
}

// -------------------------------------------------------------
// Authentication Client
// -------------------------------------------------------------

export async function loginApi(username: string, password: string): Promise<{ success: boolean; user?: UserProfile; token?: string; error?: string }> {
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await safeJson(res);
    if (!res.ok) {
      return { success: false, error: data.error || 'Login failed' };
    }
    saveStoredAuth(data.user, data.token);
    return { success: true, user: data.user, token: data.token };
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error during login' };
  }
}

export async function checkSessionApi(token: string): Promise<UserProfile | null> {
  try {
    const res = await fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.user || null;
  } catch {
    return null;
  }
}

export async function logoutApi(token: string | null): Promise<void> {
  if (token) {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch {
      // ignore
    }
  }
  saveStoredAuth(null, null);
}

// -------------------------------------------------------------
// Notifications Client
// -------------------------------------------------------------

export async function fetchNotifications(): Promise<AppNotification[]> {
  try {
    const res = await apiFetch('/api/notifications');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (json.notifications && Array.isArray(json.notifications)) {
      return json.notifications;
    }
  } catch (err) {
    console.warn('[RemitPal Notifications]: server unreachable', err);
  }
  return [];
}

export async function markNotificationReadApi(id: string): Promise<void> {
  try {
    await apiFetch(`/api/notifications/${id}/read`, { method: 'PATCH' });
  } catch (err) {
    console.warn('[RemitPal Mark Read]: Offline', err);
  }
}

export async function markAllNotificationsReadApi(): Promise<void> {
  try {
    await apiFetch('/api/notifications/read-all', { method: 'POST' });
  } catch (err) {
    console.warn('[RemitPal Mark All Read]: Offline', err);
  }
}

export async function deleteNotificationApi(id: string): Promise<void> {
  try {
    await apiFetch(`/api/notifications/${id}`, { method: 'DELETE' });
  } catch (err) {
    console.warn('[RemitPal Delete Notification]: Offline', err);
  }
}

// -------------------------------------------------------------
// Service Status (real vs mock) Client
// -------------------------------------------------------------

export interface ServiceStatus {
  agent: { enabled: boolean; mock: boolean; model: string };
  paypal: { configured: boolean; mock: boolean; env: 'sandbox' | 'live' };
}

/**
 * Fetch the real-vs-mock configuration of the Gemini agent and PayPal
 * Payouts. Used to render LIVE / MOCK badges so it's obvious the app
 * uses real services. Never exposes secrets — only booleans, the model
 * name, and the PayPal env.
 */
export async function fetchServiceStatus(): Promise<ServiceStatus | null> {
  try {
    const res = await fetch('/api/status');
    if (!res.ok) return null;
    return (await res.json()) as ServiceStatus;
  } catch (err) {
    console.warn('[RemitPal Service Status]: server unreachable', err);
    return null;
  }
}

// -------------------------------------------------------------
// -------------------------------------------------------------
// PayPal Payouts v1 Client (sandbox only, Siti -> Slamet)
// -------------------------------------------------------------
// Flow: Siti approves a plan in-app -> POST /api/paypal/send (server
// derives USD from the approved IDR total) -> PayPal creates a
// single-item payout batch from Siti's own business account to
// Slamet's verified email -> a ledger record is created ONLY when
// PayPal reports the payout item SUCCESS, with the real payout batch
// id as the reference number. In mock mode (DEMO MODE) the record is
// created immediately and labelled MOCK — no PayPal payment moves.

export interface PayPalPayoutResponse {
  success: boolean;
  payout?: {
    payoutBatchId: string;
    batchStatus: string;
    transactionStatus?: string;
    amount?: { value: string; currency: string };
    mock: boolean;
  };
  error?: string;
}

export interface PayPalStatusResponse {
  success: boolean;
  batchStatus?: string;
  transactionStatus?: string;
  error?: string;
}

/**
 * Trigger a PayPal payout to Slamet.
 * The USD amount is derived server-side from amountIdr at Rp 16,000/USD —
 * the client sends amountIdr (and the derived USD as a cross-check) and
 * never supplies the amount PayPal sees on its own. The remittance ledger
 * record is built client-side from the returned payout result and persisted
 * via the normal remittance flow. Requires the logged-in remitter's token
 * (from local storage).
 */
export async function sendPayPalPayout(params: {
  amountIdr: number;
  amountUsd?: string;
  note?: string;
}): Promise<PayPalPayoutResponse> {
  try {
    const res = await apiFetch('/api/paypal/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const data = await safeJson(res);
    if (!res.ok) return { success: false, error: data.error || 'PayPal payout failed.' };
    return data as PayPalPayoutResponse;
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error during PayPal payout.' };
  }
}

/** Refresh the status of a payout that may still have been PENDING/PROCESSING. */
export async function checkPayPalPayoutStatus(payoutBatchId: string): Promise<PayPalStatusResponse> {
  try {
    const res = await apiFetch(`/api/paypal/status/${encodeURIComponent(payoutBatchId)}`);
    const data = await safeJson(res);
    if (!res.ok) return { success: false, error: data.error || 'Status check failed.' };
    return data as PayPalStatusResponse;
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error during status check.' };
  }
}

// RemitPal AI Agent Client
// -------------------------------------------------------------

export interface RemittanceApprovalDraft {
  type: 'remittance_approval';
  amountIdr: number;
  monthYear: string;
  allocations: Record<string, number>;
  paypalAmount: number;
  currency: string;
  note: string;
}

export interface AgentReply {
  text?: string;
  pendingAction?: RemittanceApprovalDraft;
}

export interface AgentChatResponse {
  success: boolean;
  reply?: AgentReply;
  sideEffects?: string[];
  error?: string;
  /** True only when the failure was a genuine 401 — our session token was rejected. */
  unauthorized?: boolean;
}

export interface AgentHistoryTurn {
  role: 'user' | 'assistant';
  text: string;
  hasImage?: boolean;
}

/**
 * Send a message (and optional receipt image) to the role-aware AI agent.
 * Requires the logged-in user's token; a missing/expired token returns a
 * 401 the UI uses to prompt login.
 */
export async function sendAgentMessage(params: {
  message: string;
  image?: { data: string; mimeType: string };
  history: AgentHistoryTurn[];
}): Promise<AgentChatResponse> {
  try {
    const res = await apiFetch('/api/agent/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    // safeJson reads as text first so a non-JSON error page surfaces a readable
    // message instead of the cryptic "Unexpected token '<'" parse failure.
    const data = await safeJson(res);
    if (!res.ok) return { success: false, error: data.error || 'Agent request failed.' };
    return data as AgentChatResponse;
  } catch (err: any) {
    // Only a real 401 (our token rejected) is a session problem. Other thrown
    // errors (network, etc.) are surfaced as-is — never misreported as logout.
    if (err?.isUnauthorized) {
      return { success: false, unauthorized: true, error: err.message || 'Your session expired.' };
    }
    return { success: false, error: err.message || 'Network error contacting the agent.' };
  }
}
