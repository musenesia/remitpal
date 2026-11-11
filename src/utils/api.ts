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
    saveStoredAuth(null, null);
    throw new Error('Unauthorized: session expired or invalid — please log in again.');
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
    // A 401 must NOT fall back silently to the local seed as if it were
    // server data: report it so the UI can prompt login instead.
    if (err?.message && String(err.message).includes('Unauthorized')) {
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
    const data = await res.json();
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
 * Personal Payments. Used to render LIVE / MOCK badges so it's obvious
 * the app uses real services. Never exposes secrets — only booleans,
 * the model name, and the PayPal env.
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
// PayPal Personal Payments v2 Client (sandbox only, Siti -> Slamet)
// -------------------------------------------------------------
// Flow: create token (server derives USD from the approved IDR total) ->
// store the pending transfer in sessionStorage -> redirect Siti to
// PayPal's UI -> PayPal returns with ?status=...&transactionId=... ->
// look the token up -> a ledger record is created ONLY when the token
// lookup says COMPLETED (or SUCCESS) AND a transactionId is present.

export interface PersonalPaymentTokenResult {
  tokenId: string;
  status: string;
  initiatePaymentUrl: string | null;
  amount: string;
  currency: string;
  receiverEmail: string;
  mock: boolean;
}

export interface PersonalPaymentTokenStatus {
  status: string | null;
  transactionId: string | null;
  amount: string | number | null;
  currency: string | null;
  tokenId?: string;
  mock?: boolean;
}

export interface CreatePersonalPaymentTokenResult {
  success: boolean;
  token?: PersonalPaymentTokenResult;
  error?: string;
}

/**
 * Create a Personal Payments v2 token on the server. The USD amount is
 * derived server-side from amountIdr at Rp 16,000/USD — the client never
 * supplies the amount PayPal sees. The caller must store the pending
 * transfer (savePendingPersonalPayment) BEFORE redirecting the user to
 * initiatePaymentUrl — PayPal's return carries no token id.
 * In mock mode the token is a MOCK token with no URL: do NOT redirect.
 */
export async function createPersonalPaymentToken(params: {
  amountIdr: number;
  externalReferenceId: string;
  note?: string;
  returnUrl: string;
}): Promise<CreatePersonalPaymentTokenResult> {
  try {
    const res = await apiFetch('/api/paypal/personal-payments/tokens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const data = await res.json();
    if (!res.ok) return { success: false, error: data.error || 'PayPal token creation failed.' };
    return { success: true, token: data.token as PersonalPaymentTokenResult };
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error creating PayPal token.' };
  }
}

export interface GetPersonalPaymentTokenResult {
  success: boolean;
  status?: PersonalPaymentTokenStatus;
  error?: string;
}

/** Look up a Personal Payments token after the PayPal return. Never invents a transaction id. */
export async function getPersonalPaymentToken(tokenId: string): Promise<GetPersonalPaymentTokenResult> {
  try {
    const res = await apiFetch(`/api/paypal/personal-payments/tokens/${encodeURIComponent(tokenId)}`);
    const data = await res.json();
    if (!res.ok) return { success: false, error: data.error || 'Token lookup failed.' };
    return {
      success: true,
      status: {
        status: data.status ?? null,
        transactionId: data.transactionId ?? null,
        amount: data.amount ?? null,
        currency: data.currency ?? null,
        tokenId: data.tokenId ?? tokenId,
        mock: data.mock ?? false,
      },
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error looking up PayPal token.' };
  }
}

export interface RecordManualPersonalPaymentResult {
  success: boolean;
  referenceNo?: string;
  mock?: boolean;
  error?: string;
}

/**
 * DEMO MODE manual record (mock only). Returns a MOCK reference number;
 * it does NOT create a remittance record — the caller builds the record
 * and labels it MOCK. Fails unless the server runs with PAYPAL_MOCK=true.
 */
export async function recordManualPersonalPayment(params: {
  amountIdr: number;
  monthYear: string;
  allocations: Record<string, number>;
  note?: string;
}): Promise<RecordManualPersonalPaymentResult> {
  try {
    const res = await apiFetch('/api/paypal/personal-payments/manual-record', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const data = await res.json();
    if (!res.ok) return { success: false, error: data.error || 'Manual record failed.' };
    return { success: true, referenceNo: data.referenceNo, mock: data.mock };
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error recording manual payment.' };
  }
}

// -------------------------------------------------------------
// Pending Personal Payment (sessionStorage)
// -------------------------------------------------------------
// PayPal's return carries only status + transactionId, NOT the token id,
// so the pending transfer must be stored BEFORE redirecting to PayPal.

export interface PendingPersonalPayment {
  tokenId: string;
  amountIdr: number;
  monthYear: string;
  allocations: Record<string, number>;
  note: string;
  amountUsd: string;
  currency: 'USD';
  source: 'chat' | 'tracker';
}

const PENDING_PERSONAL_PAYMENT_KEY = 'remitpal_pending_personal_payment';

export function savePendingPersonalPayment(pending: PendingPersonalPayment): void {
  try {
    sessionStorage.setItem(PENDING_PERSONAL_PAYMENT_KEY, JSON.stringify(pending));
  } catch {
    // sessionStorage unavailable: the redirect still proceeds, but the
    // return check will report no pending payment and create no record.
  }
}

export function loadPendingPersonalPayment(): PendingPersonalPayment | null {
  try {
    const raw = sessionStorage.getItem(PENDING_PERSONAL_PAYMENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.tokenId || !parsed.amountIdr) return null;
    return parsed as PendingPersonalPayment;
  } catch {
    return null;
  }
}

export function clearPendingPersonalPayment(): void {
  try {
    sessionStorage.removeItem(PENDING_PERSONAL_PAYMENT_KEY);
  } catch {
    // ignore
  }
}

// -------------------------------------------------------------
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
    const data = await res.json();
    if (!res.ok) return { success: false, error: data.error || 'Agent request failed.' };
    return data as AgentChatResponse;
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error contacting the agent.' };
  }
}
