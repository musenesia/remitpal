import { AppData, CalendarEvent, ExpenseItem, MonthlyBudget, ReceiptStatus, RemittanceRecord, UserProfile, AppNotification } from '../types';
import { loadAppData, saveAppData } from './storage';

const TOKEN_KEY = 'remitpal_auth_token';
const USER_KEY = 'remitpal_auth_user';

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

export async function fetchAppData(): Promise<{ data: AppData; fromServer: boolean }> {
  try {
    const res = await fetch('/api/data');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (json.data && Array.isArray(json.data.expenses)) {
      saveAppData(json.data);
      return { data: json.data, fromServer: true };
    }
  } catch (err) {
    console.warn('[RemitPal] Server offline or unreachable, using local storage:', err);
  }
  return { data: loadAppData(), fromServer: false };
}

export async function syncAllData(data: AppData): Promise<boolean> {
  saveAppData(data);
  try {
    const res = await fetch('/api/data', {
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
    await fetch('/api/expenses', {
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
    await fetch(`/api/expenses/${id}/receipt`, {
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
    await fetch(`/api/expenses/${id}`, { method: 'DELETE' });
  } catch (err) {
    console.warn('[RemitPal Delete Expense]: Offline', err);
  }
}

export async function syncRemittance(record: RemittanceRecord): Promise<void> {
  try {
    await fetch('/api/remittances', {
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
    await fetch('/api/budgets', {
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
    await fetch('/api/calendar-events', {
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
    await fetch(`/api/calendar-events/${id}/toggle`, { method: 'PATCH' });
  } catch (err) {
    console.warn('[RemitPal Toggle Event]: Offline', err);
  }
}

export async function deleteCalendarEventApi(id: string): Promise<void> {
  try {
    await fetch(`/api/calendar-events/${id}`, { method: 'DELETE' });
  } catch (err) {
    console.warn('[RemitPal Delete Event]: Offline', err);
  }
}

export async function resetDatabaseApi(): Promise<AppData | null> {
  try {
    const res = await fetch('/api/reset', { method: 'POST' });
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
    const res = await fetch('/api/notifications');
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
    await fetch(`/api/notifications/${id}/read`, { method: 'PATCH' });
  } catch (err) {
    console.warn('[RemitPal Mark Read]: Offline', err);
  }
}

export async function markAllNotificationsReadApi(): Promise<void> {
  try {
    await fetch('/api/notifications/read-all', { method: 'POST' });
  } catch (err) {
    console.warn('[RemitPal Mark All Read]: Offline', err);
  }
}

export async function deleteNotificationApi(id: string): Promise<void> {
  try {
    await fetch(`/api/notifications/${id}`, { method: 'DELETE' });
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
 * Fetch the real-vs-mock configuration of the Gemini agent and PayPal payouts.
 * Used to render LIVE / MOCK badges so it's obvious the app uses real services.
 * Never exposes secrets — only booleans, the model name, and the PayPal env.
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
// PayPal Payouts Client (Siti -> Slamet)
// -------------------------------------------------------------

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
 * Trigger a real PayPal payout to Slamet.
 * The amount is sent in `currency`. The remittance ledger record is built
 * client-side from the returned payout result and persisted via the normal
 * remittance flow. Requires the logged-in remitter's token (from local storage).
 */
export async function sendPayPalPayout(params: {
  amount: number;
  currency: string;
  note?: string;
}): Promise<PayPalPayoutResponse> {
  const { token } = getStoredAuth();
  try {
    const res = await fetch('/api/paypal/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(params),
    });
    const data = await res.json();
    if (!res.ok) return { success: false, error: data.error || 'PayPal payout failed.' };
    return data as PayPalPayoutResponse;
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error during PayPal payout.' };
  }
}

/** Refresh the status of a payout that may still have been PENDING/PROCESSING. */
export async function checkPayPalPayoutStatus(payoutBatchId: string): Promise<PayPalStatusResponse> {
  const { token } = getStoredAuth();
  try {
    const res = await fetch(`/api/paypal/status/${payoutBatchId}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const data = await res.json();
    if (!res.ok) return { success: false, error: data.error || 'Status check failed.' };
    return data as PayPalStatusResponse;
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error during status check.' };
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
 * Requires the logged-in user's token; a missing token returns a 401 the UI
 * uses to prompt login.
 */
export async function sendAgentMessage(params: {
  message: string;
  image?: { data: string; mimeType: string };
  history: AgentHistoryTurn[];
}): Promise<AgentChatResponse> {
  const { token } = getStoredAuth();
  try {
    const res = await fetch('/api/agent/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(params),
    });
    const data = await res.json();
    if (!res.ok) return { success: false, error: data.error || 'Agent request failed.' };
    return data as AgentChatResponse;
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error contacting the agent.' };
  }
}

