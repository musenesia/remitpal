// RemitPal AI Agent — a role-aware Gemini agent that orchestrates the remittance
// lifecycle through natural language + receipt photos.
//
// Two roles, two flows:
//   • Siti (remitter, Hong Kong): "send 15M for November: 5M renovation, 3.5M
//     tuition, 4M allowance, 2.5M savings" → the agent structures it into a
//     remittance draft and asks for approval (human-in-the-loop). Money is
//     only moved when Siti approves in the UI, which starts the PayPal
//     Personal Payments v2 flow (token → PayPal UI → return → lookup).
//   • Slamet (manager, Indramayu): attaches a receipt photo + describes the
//     purchase → the agent (multimodal) reads the photo, classifies /
//     categorizes the expense, adds it to the ledger, and triages the receipt:
//     pending (Siti reviews — the AI never marks a receipt verified), or
//     needs_clarification (blurry, edited, or unreadable → Slamet must
//     re-upload). The AI's receipt assessment is an assessment only;
//     "verified" in the ledger means Siti confirmed it.
//
// Implementation notes:
//   - Uses the @google/genai SDK (v2) with function calling.
//   - Per-turn, stateless: the frontend passes conversation history as plain
//     text turns; tools are re-evaluated each turn. The approval card is a
//     special tool (request_remittance_approval) the orchestrator intercepts
//     instead of executing, so the AI never sends money on its own.
//   - Falls back to a lightweight rule-based mock agent when GEMINI_API_KEY is
//     absent or AGENT_MOCK=true, so the full chat flow is demoable offline.

import { GoogleGenAI, FunctionDeclaration, FunctionCall } from '@google/genai';
import {
  getAppData,
  upsertExpense,
  upsertBudget,
  updateExpenseReceipt,
  addNotification,
} from './db.ts';
import { broadcastEventNotification } from './whatsapp.ts';
import { idrToUsd } from './paypal.ts';
import type { UserProfile, CategoryId } from '../src/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AgentImage {
  data: string; // base64 (no data: prefix)
  mimeType: string;
}

export interface AgentHistoryTurn {
  role: 'user' | 'assistant';
  text: string;
  hasImage?: boolean;
}

export interface AgentRequest {
  user: UserProfile;
  message: string;
  image?: AgentImage;
  history: AgentHistoryTurn[];
}

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

export interface AgentResponse {
  reply: AgentReply;
  sideEffects: string[]; // e.g. ['expense_added'], used by the UI to refresh
}

const MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';

const CATEGORIES: CategoryId[] = ['renovation', 'tuition', 'allowance', 'savings', 'miscellaneous'];

let aiClient: GoogleGenAI | null = null;
function getClient(): GoogleGenAI | null {
  if (!process.env.GEMINI_API_KEY) return null;
  if (!aiClient) aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return aiClient;
}

export function isAgentEnabled(): boolean {
  return !!process.env.GEMINI_API_KEY || !!process.env.OPENROUTER_API_KEY || process.env.AGENT_MOCK === 'true';
}

// ---------------------------------------------------------------------------
// Tool declarations
// ---------------------------------------------------------------------------

const tools: FunctionDeclaration[] = [
  {
    name: 'get_current_state',
    description:
      'Get a snapshot of the current family ledger: the active user, the current month budget & allocations, recent remittances, recent expenses, and any receipts pending review. Call this first when context is needed.',
    parameters: { type: 'object', properties: {} } as any,
  },
  {
    name: 'set_monthly_budget',
    description:
      'Set or update the monthly budget plan with per-category allocations (in IDR). Only Siti (remitter) sets budgets.',
    parameters: {
      type: 'object',
      properties: {
        monthYear: { type: 'string', description: 'YYYY-MM' },
        totalRemittancePlanned: { type: 'number', description: 'Total planned remittance in IDR' },
        allocations: {
          type: 'object',
          description: 'IDR amount per category',
          properties: {
            renovation: { type: 'number' },
            tuition: { type: 'number' },
            allowance: { type: 'number' },
            savings: { type: 'number' },
            miscellaneous: { type: 'number' },
          },
        },
        notes: { type: 'string' },
      },
      required: ['monthYear', 'totalRemittancePlanned', 'allocations'],
    } as any,
  },
  {
    name: 'request_remittance_approval',
    description:
      'Present a structured remittance draft to Siti for human approval BEFORE any money moves. The UI shows an Approve/Reject card; the PayPal Personal Payments flow only starts if Siti approves. Always use this instead of sending money directly. paypalAmount must equal amountIdr/16000 in USD (display rate Rp 16,000/USD) and currency must be "USD".',
    parameters: {
      type: 'object',
      properties: {
        amountIdr: { type: 'number', description: 'Total remittance in IDR to record in the ledger' },
        monthYear: { type: 'string', description: 'YYYY-MM' },
        allocations: {
          type: 'object',
          description: 'How the IDR is allocated across categories',
          properties: {
            renovation: { type: 'number' },
            tuition: { type: 'number' },
            allowance: { type: 'number' },
            savings: { type: 'number' },
            miscellaneous: { type: 'number' },
          },
        },
        paypalAmount: { type: 'number', description: 'USD amount to send via PayPal Personal Payments — must equal amountIdr / 16000' },
        currency: { type: 'string', description: 'PayPal currency code — must be "USD"' },
        note: { type: 'string' },
      },
      required: ['amountIdr', 'monthYear', 'allocations', 'paypalAmount', 'currency'],
    } as any,
  },
  {
    name: 'add_expense',
    description:
      'Add a new expense to the family ledger from a receipt (usually called by/for Slamet). Include the receipt photo as receiptDataUrl so it is stored. Set receiptStatus based on your assessment of the photo: "pending" (default — Siti reviews and confirms; use this even when the photo looks clear, and say so in verificationNotes), or "needs_clarification" (blurry, edited, or unreadable → ask Slamet to re-upload a clearer photo). Never accuse anyone of fraud. Do NOT use "verified": only Siti can mark a receipt verified via update_receipt_status — "verified" in your vocabulary means "AI-assessed as clear", and the ledger only shows "verified" after Siti confirms; if you pass "verified" it is downgraded to "pending".',
    parameters: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'YYYY-MM-DD' },
        categoryId: { type: 'string', enum: CATEGORIES },
        title: { type: 'string' },
        amountIdr: { type: 'number' },
        vendor: { type: 'string' },
        paidBy: { type: 'string', description: 'Who paid, e.g. "Slamet Widodo"' },
        receiptStatus: { type: 'string', enum: ['verified', 'pending', 'needs_clarification', 'no_receipt'] },
        verificationNotes: { type: 'string', description: 'Your assessment of the receipt photo' },
        receiptDataUrl: { type: 'string', description: 'The receipt photo as a data URL (base64)' },
      },
      required: ['date', 'categoryId', 'title', 'amountIdr', 'vendor', 'paidBy', 'receiptStatus'],
    } as any,
  },
  {
    name: 'update_receipt_status',
    description:
      'Update the verification status of an existing expense receipt. Used by Siti to verify, flag, or request clarification on a pending receipt.',
    parameters: {
      type: 'object',
      properties: {
        expenseId: { type: 'string' },
        status: { type: 'string', enum: ['verified', 'pending', 'needs_clarification', 'no_receipt'] },
        verificationNotes: { type: 'string' },
      },
      required: ['expenseId', 'status'],
    } as any,
  },
  {
    name: 'add_calendar_event',
    description:
      'Add a new scheduled task or calendar event for the family — e.g. "schedule the December remittance transfer", "add a task to pay school fees on the 5th". Use this when the user asks to schedule, remind, or plan a future action.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Short event title' },
        date: { type: 'string', description: 'YYYY-MM-DD' },
        time: { type: 'string', description: 'HH:mm (optional)' },
        type: { type: 'string', enum: ['remittance', 'renovation', 'tuition', 'allowance', 'savings', 'task'] },
        priority: { type: 'string', enum: ['low', 'medium', 'high'] },
        assignedTo: { type: 'string', description: 'e.g. "Siti Rahayu (HK)" or "Slamet Widodo"' },
        estimatedAmountIdr: { type: 'number', description: 'Estimated cost in IDR if applicable' },
        notes: { type: 'string' },
      },
      required: ['title', 'date', 'type', 'priority'],
    } as any,
  },
];

// ---------------------------------------------------------------------------
// Tool execution (side-effecting)
// ---------------------------------------------------------------------------

async function getCurrentState(user: UserProfile) {
  const data = await getAppData();
  const now = new Date();
  const monthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const budget = data.budgets.find((b) => b.monthYear === monthYear) || data.budgets[0];
  const pending = data.expenses.filter(
    (e) => e.receiptStatus === 'pending' || e.receiptStatus === 'needs_clarification'
  );
  return {
    user: { name: user.name, role: user.role, location: user.location },
    currentMonth: monthYear,
    budget: budget
      ? { monthYear: budget.monthYear, totalRemittancePlanned: budget.totalRemittancePlanned, allocations: budget.allocations }
      : null,
    recentRemittances: data.remittances.slice(0, 3).map((r) => ({
      date: r.date,
      amountIdr: r.amountIdr,
      transferService: r.transferService,
      status: r.status,
    })),
    recentExpenses: data.expenses.slice(0, 5).map((e) => ({
      id: e.id,
      title: e.title,
      amountIdr: e.amountIdr,
      categoryId: e.categoryId,
      receiptStatus: e.receiptStatus,
    })),
    pendingReceipts: pending.map((e) => ({ id: e.id, title: e.title, amountIdr: e.amountIdr, status: e.receiptStatus })),
    categories: CATEGORIES,
  };
}

async function setMonthlyBudget(args: any) {
  await upsertBudget({
    monthYear: args.monthYear,
    totalRemittancePlanned: Number(args.totalRemittancePlanned),
    allocations: args.allocations,
    notes: args.notes || '',
  });
  return { success: true, monthYear: args.monthYear };
}

async function addExpense(args: any, user: UserProfile) {
  const now = new Date().toISOString();
  const id = `exp-${Date.now()}`;
  const monthYear = String(args.date).slice(0, 7);
  // Receipt-verification honesty: the AI's assessment is an assessment only.
  // "verified" in the AI's vocabulary means "AI-assessed as clear" — the
  // ledger only shows "verified" after Siti confirms via
  // update_receipt_status. Downgrade any AI-passed "verified" to "pending".
  let receiptStatus = args.receiptStatus;
  let verificationNotes = args.verificationNotes || '';
  if (receiptStatus === 'verified') {
    receiptStatus = 'pending';
    verificationNotes =
      (verificationNotes ? verificationNotes + ' ' : '') +
      "AI assessment: photo looks clear — awaiting Siti's confirmation.";
  }
  const expense = {
    id,
    date: args.date,
    monthYear,
    categoryId: args.categoryId as CategoryId,
    title: args.title,
    amountIdr: Number(args.amountIdr),
    vendor: args.vendor,
    paidBy: args.paidBy || user.name,
    receiptUrl: args.receiptDataUrl || '',
    receiptStatus,
    verificationNotes,
    verifiedAt: undefined,
  };
  await upsertExpense(expense);

  // Mirror the manual expense flow: create an activity notification + WhatsApp.
  try {
    const isReceipt = !!expense.receiptUrl;
    const formatted = `Rp ${expense.amountIdr.toLocaleString('id-ID')}`;
    const notifTitle = isReceipt ? `Receipt Uploaded: ${expense.title}` : `Expense Logged: ${expense.title}`;
    const notifDesc = `${expense.paidBy} recorded ${formatted} at ${expense.vendor} (${expense.categoryId}).`;
    await addNotification({
      type: isReceipt ? 'receipt_uploaded' : 'expense_logged',
      actor: user.username === 'siti' ? 'siti' : 'slamet',
      actorName: user.name,
      actorRole: user.role === 'remitter' ? 'Remitter (Hong Kong)' : 'Manager (Indramayu)',
      title: notifTitle,
      description: notifDesc,
      relatedId: id,
      category: expense.categoryId,
      amountIdr: expense.amountIdr,
    });
    await broadcastEventNotification(notifTitle, notifDesc, user.name);
  } catch (e) {
    console.warn('[Agent] notification/broadcast failed:', e);
  }

  return { success: true, expenseId: id, categoryId: expense.categoryId, amountIdr: expense.amountIdr, receiptStatus: expense.receiptStatus };
}

async function updateReceiptStatus(args: any, user: UserProfile) {  await updateExpenseReceipt(args.expenseId, args.status, args.verificationNotes, new Date().toISOString());
  try {
    const isVerified = args.status === 'verified';
    const notifTitle = isVerified ? 'Receipt Verified & Approved' : 'Receipt Clarification Requested';
    const notifDesc = args.verificationNotes || (isVerified ? 'Receipt proof verified.' : 'Clarification requested.');
    await addNotification({
      type: isVerified ? 'receipt_verified' : 'receipt_flagged',
      actor: user.username === 'siti' ? 'siti' : 'slamet',
      actorName: user.name,
      actorRole: user.role === 'remitter' ? 'Remitter (Hong Kong)' : 'Manager (Indramayu)',
      title: notifTitle,
      description: notifDesc,
      relatedId: args.expenseId,
    });
    await broadcastEventNotification(notifTitle, notifDesc, user.name);
  } catch (e) {
    console.warn('[Agent] notification/broadcast failed:', e);
  }
  return { success: true, expenseId: args.expenseId, status: args.status };
}

const MUTATING_TOOLS = new Set(['set_monthly_budget', 'add_expense', 'update_receipt_status', 'add_calendar_event']);

async function addCalendarEvent(args: any) {
  const { upsertCalendarEvent } = await import('./db.ts');
  const id = `evt-${Date.now()}`;
  const event = {
    id,
    title: String(args.title),
    date: String(args.date),
    time: args.time || undefined,
    type: String(args.type || 'task') as any,
    priority: String(args.priority || 'medium') as any,
    isCompleted: false,
    assignedTo: args.assignedTo || undefined,
    estimatedAmountIdr: args.estimatedAmountIdr ? Number(args.estimatedAmountIdr) : undefined,
    notes: args.notes || undefined,
  };
  await upsertCalendarEvent(event);
  return { success: true, eventId: id, title: event.title, date: event.date };
}

async function executeTool(name: string, args: any, user: UserProfile): Promise<any> {
  // Role enforcement — checked BEFORE executing, never execute-then-report.
  // set_monthly_budget and update_receipt_status are remitter-only (Siti);
  // add_expense, add_calendar_event and get_current_state are open to any
  // authenticated role. A violation returns an error result to the model.
  const isRemitter = user.role === 'remitter';
  if (name === 'set_monthly_budget' && !isRemitter) {
    return { error: 'Only Siti (remitter) can set the monthly budget.' };
  }
  if (name === 'update_receipt_status' && !isRemitter) {
    return { error: 'Only Siti (remitter) can verify receipts.' };
  }
  switch (name) {
    case 'get_current_state':
      return await getCurrentState(user);
    case 'set_monthly_budget':
      return await setMonthlyBudget(args);
    case 'add_expense':
      return await addExpense(args, user);
    case 'update_receipt_status':
      return await updateReceiptStatus(args, user);
    case 'add_calendar_event':
      return await addCalendarEvent(args);
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

function systemPrompt(user: UserProfile): string {
  const isSiti = user.role === 'remitter';
  return `You are the RemitPal AI assistant inside "RemitPal", a remittance ledger for an Indonesian migrant-worker family.
IMPORTANT: Always reply in English, even though the family is Indonesian, the ledger uses IDR, and the user may write to you in Bahasa Indonesia. The people reading your replies are English speakers, so every message you produce must be in English.
- Siti Rahayu is the remitter in Causeway Bay, Hong Kong. She sends money home and verifies receipts.
- Slamet Widodo is the manager in Desa Karangampel, Indramayu. He spends the money locally and uploads receipt proof.
- The ledger is in Indonesian Rupiah (IDR). The standard monthly remittance is 15,000,000 IDR.
- Expense categories: renovation, tuition, allowance, savings, miscellaneous.

The current user is ${user.name} (role: ${user.role}, in ${user.location}).
${isSiti
  ? `As Siti, you help her PLAN and SEND remittances. When she describes a remittance with allocations, structure it and ALWAYS call request_remittance_approval — never send money yourself. Siti must approve in the UI; only then does the PayPal Personal Payments flow start (token → PayPal UI → return → lookup). You may also set the monthly budget (set_monthly_budget), schedule calendar events (add_calendar_event), and review pending receipts (update_receipt_status).`
  : `As Slamet, you help him LOG spending and SCHEDULE tasks. When he attaches a receipt photo, READ it, extract the vendor, amount, and what was bought, choose the best category, and call add_expense. Assess the photo honestly: if it looks clear, call add_expense with "pending" and note that it looks clear — only Siti can mark a receipt "verified"; if unclear or you can't tell -> "pending" (Siti will review); if blurry, edited, or unreadable -> "needs_clarification" (ask Slamet to re-upload a clearer photo). Never accuse anyone of fraud. Put the photo data URL into receiptDataUrl so it's stored. Slamet can also schedule tasks and reminders via add_calendar_event.`}

Always reply in English. Be concise and warm. Amounts in IDR. Use the tools to act; don't describe actions you can perform via tools.`;
}

// ---------------------------------------------------------------------------
// Main agent loop
// ---------------------------------------------------------------------------

function buildContents(req: AgentRequest): any[] {
  const contents: any[] = [];
  for (const turn of req.history) {
    contents.push({ role: turn.role === 'user' ? 'user' : 'model', parts: [{ text: turn.text }] });
  }
  const parts: any[] = [];
  if (req.image) parts.push({ inlineData: { data: req.image.data, mimeType: req.image.mimeType } });
  parts.push({ text: req.message });
  contents.push({ role: 'user', parts });
  return contents;
}

// ---------------------------------------------------------------------------
// Retry helper — Gemini 503 / 429 are transient; back off and retry up to 3×.
// ---------------------------------------------------------------------------

async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 2): Promise<T> {
  const RETRYABLE = new Set([429, 503]);
  let lastErr: any;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastErr = err;
      // Extract HTTP status from Google GenAI error (varies by SDK version).
      const status: number =
        err?.status ??
        err?.code ??
        err?.response?.status ??
        (typeof err?.message === 'string'
          ? parseInt((err.message.match(/"code"\s*:\s*(\d+)/) || [])[1] ?? '', 10)
          : NaN);

      if (!RETRYABLE.has(status) || attempt === maxAttempts || err?.name === 'AbortError') throw err;

      const delayMs = 500; // single short pause before the one retry
      console.warn(`[Agent] Gemini ${status} on attempt ${attempt}/${maxAttempts}, retrying in ${delayMs}ms…`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw lastErr;
}

async function runGeminiAgent(req: AgentRequest): Promise<AgentResponse> {
  const ai = getClient();
  if (!ai) return runMockAgent(req);

  const contents = buildContents(req);
  const sideEffects: string[] = [];
  const toolConfig = [{ functionDeclarations: tools }];

  for (let i = 0; i < 6; i++) {
    const response = await withRetry(() => {
      // 20 s per Gemini call — fast-fail so the NIM fallback has time to run
      // within nginx's 60 s proxy window.
      const controller = new AbortController();
      const tid = setTimeout(() => controller.abort(), 20_000);
      return ai.models.generateContent({
        model: MODEL,
        contents,
        config: { tools: toolConfig, systemInstruction: systemPrompt(req.user), abortSignal: controller.signal as any },
      }).finally(() => clearTimeout(tid));
    });

    const fcs = response.functionCalls as FunctionCall[] | undefined;
    if (fcs && fcs.length > 0) {
      // Human-in-the-loop: intercept the approval request and surface it to the UI.
      const approval = fcs.find((fc) => fc.name === 'request_remittance_approval');
      if (approval) {
        // The USD amount is ALWAYS derived server-side from the approved IDR
        // total at Rp 16,000/USD (display rate only) — override the model.
        const amountIdr = Number(approval.args?.amountIdr) || 0;
        const derivedUsd = Number(idrToUsd(amountIdr));
        const modelAmount = Number(approval.args?.paypalAmount) || 0;
        if (modelAmount !== derivedUsd) {
          console.warn(
            `[Agent] paypalAmount from model (${modelAmount}) overridden with derived USD ${derivedUsd} for Rp ${amountIdr}.`
          );
        }
        return {
          reply: {
            text: response.text || 'I have prepared a remittance for your approval. Please review and approve to send via PayPal.',
            pendingAction: {
              type: 'remittance_approval',
              amountIdr,
              monthYear: String(approval.args?.monthYear || currentMonthYear()),
              allocations: (approval.args?.allocations || {}) as Record<string, number>,
              paypalAmount: derivedUsd,
              currency: 'USD',
              note: String(approval.args?.note || ''),
            },
          },
          sideEffects,
        };
      }

      // Echo the model's turn EXACTLY as returned. The 3.x flash models attach a
      // `thoughtSignature` to each function-call part that MUST be sent back
      // unchanged; rebuilding parts from `functionCalls` drops it and the next
      // turn is rejected (INVALID_ARGUMENT: missing thought_signature).
      const modelParts = (response.candidates?.[0]?.content?.parts ??
        fcs.map((fc) => ({ functionCall: fc }))) as any[];
      contents.push({ role: 'model', parts: modelParts });

      // Execute each call and return its result, matching by id when present
      // (the 3.x models use id-based function-response matching).
      const responseParts: any[] = [];
      for (const fc of fcs) {
        const name = fc.name ?? '';
        const result = await executeTool(name, fc.args || {}, req.user);
        if (MUTATING_TOOLS.has(name)) sideEffects.push(name);
        responseParts.push({ functionResponse: { name, id: fc.id, response: result } });
      }
      contents.push({ role: 'user', parts: responseParts });
      continue;
    }

    // No tool calls — final assistant text.
    return { reply: { text: response.text || '' }, sideEffects };
  }

  return { reply: { text: "I wasn't able to complete that. Could you rephrase?" }, sideEffects };
}

// ---------------------------------------------------------------------------
// OpenRouter fallback agent (OpenAI-compatible, nvidia/nemotron-3.5-super-vl)
// ---------------------------------------------------------------------------
// Used automatically when Gemini returns 503 / 429 (overloaded / rate-limited).
// OpenRouter exposes an OpenAI-wire-compatible endpoint — no extra SDK needed.
// Model: nvidia/nemotron-3.5-super-vl:free — free tier, multimodal, tool calling.

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'nvidia/nemotron-3.5-super-vl:free';

/** Convert Gemini-style FunctionDeclaration[] → OpenAI tool[] */
function geminiToolsToOpenAI(): any[] {
  return tools.map((t) => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters ?? { type: 'object', properties: {} },
    },
  }));
}

/** Build an OpenAI-style messages array from AgentRequest history + current turn. */
function buildNimMessages(req: AgentRequest): any[] {
  const msgs: any[] = [{ role: 'system', content: systemPrompt(req.user) }];

  for (const turn of req.history) {
    msgs.push({ role: turn.role === 'user' ? 'user' : 'assistant', content: turn.text });
  }

  // muse-glimmer-30b is natively multimodal — pass the real image when present
  // using the OpenAI vision content-parts format.
  if (req.image) {
    const imagePart = {
      type: 'image_url',
      image_url: { url: `data:${req.image.mimeType};base64,${req.image.data}` },
    };
    const textPart = { type: 'text', text: req.message };
    msgs.push({ role: 'user', content: [textPart, imagePart] });
  } else {
    msgs.push({ role: 'user', content: req.message });
  }

  return msgs;
}

async function callOpenRouter(messages: any[], toolChoice: 'auto' | 'none' = 'auto'): Promise<any> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not set.');

  const body = {
    model: OPENROUTER_MODEL,
    messages,
    tools: geminiToolsToOpenAI(),
    tool_choice: toolChoice,
    max_tokens: 1024,
  };

  // 25 s hard timeout — leaves room for nginx's 60 s proxy timeout even when
  // Gemini already spent a few seconds retrying before the fallback.
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25_000);

  let res: Response;
  try {
    res = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        // OpenRouter requires these headers for attribution on the free tier.
        'HTTP-Referer': process.env.APP_URL || 'http://localhost:3000',
        'X-Title': 'RemitPal',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err?.name === 'AbortError') {
      throw new Error(`OpenRouter request timed out after 25 s (model: ${OPENROUTER_MODEL}).`);
    }
    throw err;
  }
  clearTimeout(timeoutId);

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const err: any = new Error(`OpenRouter ${res.status}: ${text.slice(0, 400)}`);
    err.status = res.status;
    throw err;
  }

  // Read as text first so a non-JSON body surfaces a readable error.
  const rawText = await res.text();
  if (!rawText.trimStart().startsWith('{') && !rawText.trimStart().startsWith('[')) {
    const err: any = new Error(
      `OpenRouter returned non-JSON (status ${res.status}). Body: ${rawText.slice(0, 400)}`
    );
    err.status = res.status;
    throw err;
  }
  return JSON.parse(rawText);
}

async function runOpenRouterAgent(req: AgentRequest): Promise<AgentResponse> {
  if (!process.env.OPENROUTER_API_KEY) throw new Error('OPENROUTER_API_KEY is not set.');
  console.log(`[Agent] Falling back to OpenRouter (${OPENROUTER_MODEL})…`);

  const messages: any[] = buildNimMessages(req);
  const sideEffects: string[] = [];

  // Agentic loop — up to 6 turns (same cap as Gemini path).
  for (let i = 0; i < 6; i++) {
    const data = await callOpenRouter(messages);
    const choice = data.choices?.[0];
    const msg = choice?.message;

    if (!msg) throw new Error('NIM returned an empty response.');

    const toolCalls: any[] = msg.tool_calls ?? [];

    if (toolCalls.length > 0) {
      // Append the assistant's turn (with tool_calls) before the results.
      messages.push({ role: 'assistant', content: msg.content ?? null, tool_calls: toolCalls });

      // Human-in-the-loop: intercept request_remittance_approval.
      const approval = toolCalls.find((tc: any) => tc.function?.name === 'request_remittance_approval');
      if (approval) {
        const args = JSON.parse(approval.function.arguments || '{}');
        const amountIdr = Number(args.amountIdr) || 0;
        const derivedUsd = Number(idrToUsd(amountIdr));
        const modelAmount = Number(args.paypalAmount) || 0;
        if (modelAmount !== derivedUsd) {
          console.warn(`[NIM] paypalAmount from model (${modelAmount}) overridden with ${derivedUsd} for Rp ${amountIdr}.`);
        }
        return {
          reply: {
            text: msg.content || 'I have prepared a remittance for your approval. Please review and approve to send via PayPal.',
            pendingAction: {
              type: 'remittance_approval',
              amountIdr,
              monthYear: String(args.monthYear || currentMonthYear()),
              allocations: (args.allocations || {}) as Record<string, number>,
              paypalAmount: derivedUsd,
              currency: 'USD',
              note: String(args.note || ''),
            },
          },
          sideEffects,
        };
      }

      // Execute all other tool calls and feed results back.
      for (const tc of toolCalls) {
        const name: string = tc.function?.name ?? '';
        let args: any = {};
        try { args = JSON.parse(tc.function?.arguments || '{}'); } catch { /* ignore */ }
        const result = await executeTool(name, args, req.user);
        if (MUTATING_TOOLS.has(name)) sideEffects.push(name);
        messages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: JSON.stringify(result),
        });
      }
      continue;
    }

    // No tool calls — final text response.
    const text = msg.content ?? '';
    return { reply: { text }, sideEffects };
  }

  return { reply: { text: "I wasn't able to complete that. Could you rephrase?" }, sideEffects };
}

// ---------------------------------------------------------------------------
// Mock agent (no API key) — rule-based, demoable offline
// ---------------------------------------------------------------------------

function currentMonthYear(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// Parse allocation phrases like "5M renovation, 3.5M tuition, 4M allowance, 2.5M savings"
function parseAllocations(text: string): Record<string, number> {
  const out: Record<string, number> = {};
  const pattern = /(\d+(?:\.\d+)?)\s*(m|million|jt|juta)?\s*(renovation|tuition|allowance|savings|miscellaneous|renovasi|sekolah|kuliah|belanja|tabungan)/gi;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(text)) !== null) {
    let val = parseFloat(m[1]);
    const unit = (m[2] || '').toLowerCase();
    if (unit === 'm' || unit === 'million' || unit === 'jt' || unit === 'juta') val *= 1_000_000;
    const catRaw = m[3].toLowerCase();
    const cat =
      catRaw === 'renovation' || catRaw === 'renovasi' ? 'renovation' :
      catRaw === 'tuition' || catRaw === 'sekolah' || catRaw === 'kuliah' ? 'tuition' :
      catRaw === 'allowance' || catRaw === 'belanja' ? 'allowance' :
      catRaw === 'savings' || catRaw === 'tabungan' ? 'savings' : 'miscellaneous';
    out[cat] = val;
  }
  return out;
}

function parseTotalAmount(text: string): number {
  // "15 million", "15M", "15000000", "15 juta"
  const m = text.match(/(\d+(?:\.\d+)?)\s*(m|million|jt|juta)\b/i);
  if (m) return Math.round(parseFloat(m[1]) * 1_000_000);
  // "price 650,000" or "650.000" or "650000"
  const comma = text.match(/(?:price|harga|rp\.?|idr)?\s*(\d{1,3}(?:[.,]\d{3})+)/i);
  if (comma) return parseInt(comma[1].replace(/[.,]/g, ''), 10);
  const n = text.match(/\b(\d{4,})\b/);
  return n ? parseInt(n[1], 10) : 0;
}

// Keyword → category mapping for the mock agent
function inferCategory(text: string): CategoryId {
  const t = text.toLowerCase();
  if (/tile|granite|cement|brick|sand|paint|sealant|renovasi|renovate|mason|tukang|genteng|kayu|wood|cat|build|construct|plumb|electri/.test(t)) return 'renovation';
  if (/school|tuition|spp|fee|book|uniform|sekolah|kuliah|buku|seragam|les|tutor/.test(t)) return 'tuition';
  if (/grocery|groceries|rice|oil|gas|water|electric|token|pln|pdam|sembako|belanja|market|pasar|allowance/.test(t)) return 'allowance';
  if (/saving|deposit|tabungan|bank|bri|mandiri/.test(t)) return 'savings';
  return 'miscellaneous';
}

function runMockAgent(req: AgentRequest): Promise<AgentResponse> {
  return _runMockAgent(req);
}

async function _runMockAgent(req: AgentRequest): Promise<AgentResponse> {
  const isSiti = req.user.role === 'remitter';
  const msg = req.message || '';

  if (isSiti) {
    const total = parseTotalAmount(msg);
    const allocations = parseAllocations(msg);
    const allocSum = Object.values(allocations).reduce((a, b) => a + b, 0);
    if (total > 0 || allocSum > 0) {
      const amountIdr = total || allocSum || 15_000_000;
      const finalAlloc =
        Object.keys(allocations).length > 0
          ? allocations
          : { renovation: 5_000_000, tuition: 3_500_000, allowance: 4_000_000, savings: 2_500_000, miscellaneous: 0 };
      return {
        reply: {
          text: `(mock mode) I structured your remittance of Rp ${amountIdr.toLocaleString('id-ID')} with the allocations below. Review and approve to send it to Slamet via PayPal.`,
          pendingAction: {
            type: 'remittance_approval',
            amountIdr,
            monthYear: currentMonthYear(),
            allocations: finalAlloc,
            paypalAmount: Number(idrToUsd(amountIdr)),
            currency: 'USD',
            note: 'Monthly remittance prepared by RemitPal AI (mock).',
          },
        },
        sideEffects: [],
      };
    }
    return {
      reply: { text: '(mock mode) Tell me the amount and allocations, e.g. "Send 15 million for this month: 5M renovation, 3.5M tuition, 4M allowance, 2.5M savings".' },
      sideEffects: [],
    };
  }

  // Slamet (manager) mock — has a receipt image.
  if (req.image) {
    const total = parseTotalAmount(msg) || 0;
    const categoryId = inferCategory(msg);

    // Extract vendor: "at <Vendor>" or "from <Vendor>" or "di <Vendor>"
    const vendorMatch = msg.match(/(?:at|from|di|dari)\s+([A-Za-z0-9 .'&-]+?)(?:[,.]|$)/i);
    const vendor = vendorMatch ? vendorMatch[1].trim() : 'Local Vendor';

    // Build a clean title: strip amount/vendor/preposition clutter
    const title = msg
      .replace(/(?:at|from|di|dari)\s+[A-Za-z0-9 .'&-]+/gi, '')
      .replace(/(?:price|harga|rp\.?|idr)?\s*\d{1,3}(?:[.,]\d{3})+/gi, '')
      .replace(/\d+(?:\.\d+)?\s*(?:m|million|jt|juta)\b/gi, '')
      .replace(/,/g, '')
      .trim() || 'Purchase';

    const today = new Date().toISOString().slice(0, 10);
    // Mock-mode receipt assessment is an assessment only: never "verified".
    // The receipt stays "pending" until Siti reviews it in the Receipt Vault.
    const receiptStatus: 'verified' | 'pending' | 'needs_clarification' = 'pending';

    // Actually persist the expense so it appears in the ledger immediately.
    let expenseId = '';
    try {
      const result = await addExpense({
        date: today,
        categoryId,
        title,
        amountIdr: total,
        vendor,
        paidBy: req.user.name,
        receiptStatus,
        verificationNotes: '(mock mode) AI assessment only — photo not verified; Siti must review it in the Receipt Vault.',
        receiptDataUrl: req.image ? `data:${req.image.mimeType};base64,${req.image.data}` : '',
      }, req.user);
      expenseId = result.expenseId || '';
    } catch (e) {
      console.warn('[Mock] addExpense failed:', e);
    }

    const idrFormatted = total > 0 ? `Rp ${total.toLocaleString('id-ID')}` : 'Rp 0 (please include the price next time)';
    return {
      reply: {
        text: `(mock mode) I read the receipt and logged ${idrFormatted} under **${categoryId}** from ${vendor}. The receipt is pending Siti's review — the AI assessment is not a verification. Siti can review it in the Receipt Vault.${expenseId ? '' : '\n\n⚠️ Could not save to DB — check server logs.'}`,
      },
      sideEffects: ['add_expense'],
    };
  }

  // Slamet without image — nudge to attach a photo
  return {
    reply: { text: '(mock mode) Attach a receipt photo and tell me what you bought and the amount, e.g. "Bought granite tiles for 2.85M at TB Rejeki Abadi".' },
    sideEffects: [],
  };
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export async function runAgent(req: AgentRequest): Promise<AgentResponse> {
  const useMock = process.env.AGENT_MOCK === 'true' || (!process.env.GEMINI_API_KEY && !process.env.OPENROUTER_API_KEY);
  if (useMock) {
    return runMockAgent(req);
  }

  // ── Primary: Gemini ──────────────────────────────────────────────────────
  if (process.env.GEMINI_API_KEY) {
    try {
      return await runGeminiAgent(req);
    } catch (err: any) {
      const raw: string = err?.message ?? '';
      // Treat our own 20 s AbortError as an overload: Gemini was too slow,
      // which is functionally the same as a 503 from our perspective.
      const isOverload =
        err?.name === 'AbortError' ||
        /503|429|UNAVAILABLE|quota|high demand|rate.?limit|aborted|timed? ?out/i.test(raw);

      if (isOverload && process.env.OPENROUTER_API_KEY) {
        console.warn('[Agent] Gemini overloaded, falling back to OpenRouter…');
      } else if (isOverload) {
        throw new Error('The Gemini model is temporarily overloaded. Please wait a moment and try again.');
      } else {
        console.error('[Agent] Gemini call failed:', err);
        const detail = raw ? ` ${raw}` : '';
        throw new Error(
          `Gemini AI call failed (model: ${MODEL}).${detail} Verify GEMINI_API_KEY is valid and the model is available for your key (https://aistudio.google.com/app/apikey).`
        );
      }
    }
  }

  // ── Fallback: OpenRouter ─────────────────────────────────────────────────
  if (process.env.OPENROUTER_API_KEY) {
    try {
      return await runOpenRouterAgent(req);
    } catch (err: any) {
      console.error('[Agent] OpenRouter call failed:', err);
      const raw: string = err?.message ?? '';
      const detail = raw ? ` ${raw}` : '';
      throw new Error(
        `AI request failed on both providers. Gemini was overloaded; OpenRouter (${OPENROUTER_MODEL}) also failed.${detail}`
      );
    }
  }

  // Should not reach here, but guard anyway.
  throw new Error('No AI provider is configured. Set GEMINI_API_KEY or OPENROUTER_API_KEY.');
}
