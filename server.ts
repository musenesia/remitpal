import express, { Request, Response, NextFunction } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import 'dotenv/config';
import { 
  initDatabase, 
  authenticateUser, 
  verifySession, 
  destroySession, 
  getUsers, 
  getAppData, 
  upsertExpense, 
  updateExpenseReceipt, 
  deleteExpense, 
  upsertRemittance, 
  deleteRemittance, 
  upsertBudget, 
  upsertCalendarEvent, 
  toggleCalendarEvent, 
  deleteCalendarEvent, 
  replaceAllData, 
  resetDatabase,
  getNotifications,
  addNotification,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  closePool
} from './server/db.ts';
import type { UserProfile } from './src/types';
import { broadcastEventNotification } from './server/whatsapp.ts';
import { sendPayout, getPayoutStatus, isPayPalConfigured, payPalConfigError } from './server/paypal.ts';
import { runAgent, isAgentEnabled } from './server/agent.ts';
import type { AgentRequest } from './server/agent.ts';

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const isProduction = process.env.NODE_ENV === 'production';

// Support JSON bodies up to 25mb (for base64 receipts)
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Auth Token Middleware
function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
  }

  const token = authHeader.slice(7);
  verifySession(token).then((user) => {
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized: Session expired or invalid' });
    }
    (req as any).user = user;
    (req as any).token = token;
    next();
  }).catch((err) => {
    console.error('[Auth Middleware Error]:', err);
    res.status(500).json({ error: 'Internal server error' });
  });
}

// -------------------------------------------------------------
// Service Status (real vs mock) — no secrets exposed
// -------------------------------------------------------------

/**
 * Reports whether each integration is wired for REAL calls or running in mock
 * mode, plus the configured model/paypal environment. Used by the frontend to
 * show LIVE / MOCK badges so it's obvious the app uses real PayPal + Gemini.
 */
app.get('/api/status', (_req: Request, res: Response) => {
  const agentMock = process.env.AGENT_MOCK === 'true';
  const agentEnabled = !!process.env.GEMINI_API_KEY || agentMock;
  const paypalMock = process.env.PAYPAL_MOCK === 'true';
  const paypalConfigured =
    paypalMock ||
    (!!process.env.PAYPAL_CLIENT_ID &&
      !!process.env.PAYPAL_CLIENT_SECRET &&
      !!process.env.PAYPAL_RECIPIENT_EMAIL);
  res.json({
    agent: {
      enabled: agentEnabled,
      mock: agentMock,
      model: process.env.GEMINI_MODEL || 'gemini-3.8-flash',
    },
    paypal: {
      configured: paypalConfigured,
      mock: paypalMock,
      env: process.env.PAYPAL_ENV === 'live' ? 'live' : 'sandbox',
    },
  });
});

// -------------------------------------------------------------
// Auth Endpoints
// -------------------------------------------------------------

// List public users (for quick selection in UI)
app.get('/api/auth/users', async (_req: Request, res: Response) => {
  try {
    const users = await getUsers();
    res.json({ success: true, users });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Login with username & password
app.post('/api/auth/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const result = await authenticateUser(username, password);
    if (!result) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    res.json({ success: true, user: result.user, token: result.token });
  } catch (err: any) {
    console.error('[API Login Error]:', err);
    res.status(500).json({ error: err.message });
  }
});

// Verify current session
app.get('/api/auth/me', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ user: null });
  }

  try {
    const token = authHeader.slice(7);
    const user = await verifySession(token);
    if (!user) {
      return res.status(401).json({ user: null });
    }
    res.json({ success: true, user });
  } catch (err: any) {
    console.error('[API Auth Me Error]:', err);
    res.status(500).json({ error: err.message });
  }
});

// Logout
app.post('/api/auth/logout', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    await destroySession(token);
  }
  res.json({ success: true });
});

// -------------------------------------------------------------
// Data Endpoints (PostgreSQL DB)
// -------------------------------------------------------------

// Get all app data from PostgreSQL
app.get('/api/data', async (_req: Request, res: Response) => {
  try {
    const data = await getAppData();
    res.json({ success: true, data });
  } catch (err: any) {
    console.error('[API Data Fetch Error]:', err);
    res.status(500).json({ error: err.message });
  }
});

// Replace all app data (import JSON)
app.post('/api/data', async (req: Request, res: Response) => {
  try {
    const data = req.body;
    if (!data || !Array.isArray(data.expenses) || !Array.isArray(data.remittances)) {
      return res.status(400).json({ error: 'Invalid app data format' });
    }
    await replaceAllData(data);
    const updated = await getAppData();
    res.json({ success: true, data: updated });
  } catch (err: any) {
    console.error('[API Data Replace Error]:', err);
    res.status(500).json({ error: err.message });
  }
});

// Upsert Expense
app.post('/api/expenses', async (req: Request, res: Response) => {
  try {
    const expense = req.body;
    if (!expense || !expense.id || !expense.title) {
      return res.status(400).json({ error: 'Invalid expense payload' });
    }
    await upsertExpense(expense);

    // Auto-create notification for new or updated expense
    try {
      const isReceipt = !!expense.receiptUrl;
      const formattedAmount = `Rp ${(expense.amountIdr || 0).toLocaleString('id-ID')}`;
      const notifTitle = isReceipt ? `Receipt Uploaded: ${expense.title}` : `Expense Logged: ${expense.title}`;
      const notifDesc = `Slamet recorded ${formattedAmount} at ${expense.vendor || 'local vendor'} (${expense.categoryId}).`;
      await addNotification({
        type: isReceipt ? 'receipt_uploaded' : 'expense_logged',
        actor: 'slamet',
        actorName: 'Slamet Widodo',
        actorRole: 'Manager (Indramayu)',
        title: notifTitle,
        description: notifDesc,
        relatedId: expense.id,
        category: expense.categoryId,
        amountIdr: expense.amountIdr
      });
      // Broadcast a WhatsApp message to both family members via Fonnte
      await broadcastEventNotification(notifTitle, notifDesc, 'Slamet Widodo');
    } catch (notifErr) {
      console.warn('Could not create notification for expense:', notifErr);
    }

    res.json({ success: true, expense });
  } catch (err: any) {
    console.error('[API Expense Upsert Error]:', err);
    res.status(500).json({ error: err.message });
  }
});

// Update Expense Receipt Status (verification by Siti)
app.patch('/api/expenses/:id/receipt', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { receiptStatus, verificationNotes, verifiedAt } = req.body;
    await updateExpenseReceipt(id, receiptStatus, verificationNotes, verifiedAt);

    // Auto-create notification for verification event
    try {
      const isVerified = receiptStatus === 'verified';
      const notifTitle = isVerified ? 'Receipt Verified & Approved' : 'Receipt Clarification Requested';
      const notifDesc = verificationNotes || (isVerified ? 'Receipt proof verified by Siti in Hong Kong.' : 'Siti requested receipt clarification.');
      await addNotification({
        type: isVerified ? 'receipt_verified' : 'receipt_flagged',
        actor: 'siti',
        actorName: 'Siti Rahayu',
        actorRole: 'Remitter (Hong Kong)',
        title: notifTitle,
        description: notifDesc,
        relatedId: id
      });
      // Broadcast a WhatsApp message to both family members via Fonnte
      await broadcastEventNotification(notifTitle, notifDesc, 'Siti Rahayu');
    } catch (notifErr) {
      console.warn('Could not create notification for receipt status:', notifErr);
    }

    res.json({ success: true });
  } catch (err: any) {
    console.error('[API Expense Receipt Update Error]:', err);
    res.status(500).json({ error: err.message });
  }
});

// Delete Expense
app.delete('/api/expenses/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await deleteExpense(id);
    res.json({ success: true });
  } catch (err: any) {
    console.error('[API Expense Delete Error]:', err);
    res.status(500).json({ error: err.message });
  }
});

// Upsert Remittance
app.post('/api/remittances', async (req: Request, res: Response) => {
  try {
    const record = req.body;
    if (!record || !record.id || !record.amountIdr) {
      return res.status(400).json({ error: 'Invalid remittance payload' });
    }
    await upsertRemittance(record);

    // Auto-create notification for remittance sent
    try {
      const formattedAmount = `Rp ${(record.amountIdr || 0).toLocaleString('id-ID')}`;
      const notifTitle = `Remittance Sent: ${formattedAmount}`;
      const notifDesc = `Siti transferred ${formattedAmount} via ${record.transferService || 'Remittance Service'} to Slamet. Ref: ${record.referenceNo || 'N/A'}.`;
      await addNotification({
        type: 'remittance_sent',
        actor: 'siti',
        actorName: 'Siti Rahayu',
        actorRole: 'Remitter (Hong Kong)',
        title: notifTitle,
        description: notifDesc,
        relatedId: record.id,
        category: 'remittance',
        amountIdr: record.amountIdr
      });
      // Broadcast a WhatsApp message to both family members via Fonnte
      await broadcastEventNotification(notifTitle, notifDesc, 'Siti Rahayu');
    } catch (notifErr) {
      console.warn('Could not create notification for remittance:', notifErr);
    }

    res.json({ success: true, record });
  } catch (err: any) {
    console.error('[API Remittance Upsert Error]:', err);
    res.status(500).json({ error: err.message });
  }
});

// Delete Remittance
app.delete('/api/remittances/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await deleteRemittance(id);
    res.json({ success: true });
  } catch (err: any) {
    console.error('[API Remittance Delete Error]:', err);
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// PayPal Payouts Endpoints (Siti -> Slamet)
// -------------------------------------------------------------

/**
 * Send a real PayPal payout to Slamet.
 *
 * Only the remitter (Siti) may call this — the requireAuth middleware
 * resolves the session and the role check enforces the sender constraint.
 * This endpoint is intentionally payout-only: it returns the PayPal batch id
 * and status so the frontend can build a RemittanceRecord and persist it
 * through the normal /api/remittances flow (which also fires the single
 * notification + WhatsApp broadcast). Keeping the payout separate avoids
 * double notifications.
 */
app.post('/api/paypal/send', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as { role: string };
    if (user.role !== 'remitter') {
      return res.status(403).json({ error: 'Only the remitter (Siti) can send remittances.' });
    }

    const { amount, currency, note } = req.body || {};
    if (!amount || !currency) {
      return res.status(400).json({ error: 'PayPal amount and currency are required.' });
    }

    if (!isPayPalConfigured()) {
      const cfgErr = payPalConfigError();
      return res.status(503).json({ error: `PayPal is not configured: ${cfgErr}` });
    }

    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({ error: 'PayPal amount must be a positive number.' });
    }

    // PayPal expects a string with two decimal places.
    const formattedAmount = numericAmount.toFixed(2);
    const payout = await sendPayout({
      amount: formattedAmount,
      currency: String(currency).toUpperCase(),
      note: note || 'Family remittance from Siti via RemitPal',
      senderItemId: `remitpal_${Date.now()}`,
    });

    res.json({
      success: true,
      payout: {
        payoutBatchId: payout.payoutBatchId,
        batchStatus: payout.batchStatus,
        transactionStatus: payout.items[0]?.transactionStatus,
        amount: { value: formattedAmount, currency: String(currency).toUpperCase() },
        mock: payout.mock,
      },
    });
  } catch (err: any) {
    console.error('[PayPal Send Error]:', err);
    res.status(500).json({ error: err.message || 'PayPal payout failed.' });
  }
});

/**
 * Check the status of a previously-created PayPal payout batch.
 * Lets the UI refresh a payout that was created in PENDING/PROCESSING state.
 */
app.get('/api/paypal/status/:batchId', requireAuth, async (req: Request, res: Response) => {
  try {
    const { batchId } = req.params;
    const status = await getPayoutStatus(batchId);
    res.json({
      success: true,
      batchStatus: status.batchStatus,
      transactionStatus: status.items[0]?.transactionStatus,
    });
  } catch (err: any) {
    console.error('[PayPal Status Error]:', err);
    res.status(500).json({ error: err.message || 'PayPal status check failed.' });
  }
});

// -------------------------------------------------------------
// RemitPal AI Agent Endpoint
// -------------------------------------------------------------

/**
 * Chat with the role-aware Gemini agent. The agent orchestrates the remittance
 * lifecycle: Siti drafts & approves a PayPal remittance; Slamet uploads receipt
 * photos that the agent classifies and adds to the ledger.
 *
 * Auth-protected so we know WHO is talking (Siti vs Slamet changes the flow and
 * the available tools). Accepts an optional receipt image (base64).
 */
app.post('/api/agent/chat', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as UserProfile;
    const { message, image, history } = req.body || {};

    if (!message && !image) {
      return res.status(400).json({ error: 'A message or image is required.' });
    }
    if (!isAgentEnabled()) {
      return res.status(503).json({
        error: 'AI agent is not configured. Set GEMINI_API_KEY (or AGENT_MOCK=true for a demo).',
      });
    }

    const agentReq: AgentRequest = {
      user,
      message: message || '',
      image: image ? { data: image.data, mimeType: image.mimeType } : undefined,
      history: Array.isArray(history) ? history : [],
    };

    const result = await runAgent(agentReq);
    res.json({ success: true, reply: result.reply, sideEffects: result.sideEffects });
  } catch (err: any) {
    console.error('[Agent Chat Error]:', err);
    res.status(500).json({ error: err.message || 'Agent failed.' });
  }
});

// Upsert Monthly Budget
app.post('/api/budgets', async (req: Request, res: Response) => {
  try {
    const budget = req.body;
    if (!budget || !budget.monthYear) {
      return res.status(400).json({ error: 'Invalid budget payload' });
    }
    await upsertBudget(budget);
    res.json({ success: true, budget });
  } catch (err: any) {
    console.error('[API Budget Upsert Error]:', err);
    res.status(500).json({ error: err.message });
  }
});

// Upsert Calendar Event
app.post('/api/calendar-events', async (req: Request, res: Response) => {
  try {
    const event = req.body;
    if (!event || !event.id || !event.title) {
      return res.status(400).json({ error: 'Invalid event payload' });
    }
    await upsertCalendarEvent(event);
    res.json({ success: true, event });
  } catch (err: any) {
    console.error('[API Event Upsert Error]:', err);
    res.status(500).json({ error: err.message });
  }
});

// Toggle Calendar Event
app.patch('/api/calendar-events/:id/toggle', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await toggleCalendarEvent(id);
    res.json({ success: true });
  } catch (err: any) {
    console.error('[API Event Toggle Error]:', err);
    res.status(500).json({ error: err.message });
  }
});

// Delete Calendar Event
app.delete('/api/calendar-events/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await deleteCalendarEvent(id);
    res.json({ success: true });
  } catch (err: any) {
    console.error('[API Event Delete Error]:', err);
    res.status(500).json({ error: err.message });
  }
});

// Reset Database to Seed Data
app.post('/api/reset', async (_req: Request, res: Response) => {
  try {
    await resetDatabase();
    const data = await getAppData();
    res.json({ success: true, data });
  } catch (err: any) {
    console.error('[API Reset Error]:', err);
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// Notifications Endpoints
// -------------------------------------------------------------

// Get all activity notifications
app.get('/api/notifications', async (_req: Request, res: Response) => {
  try {
    const notifications = await getNotifications();
    res.json({ success: true, notifications });
  } catch (err: any) {
    console.error('[API Notifications Get Error]:', err);
    res.status(500).json({ error: err.message });
  }
});

// Create custom notification
app.post('/api/notifications', async (req: Request, res: Response) => {
  try {
    const payload = req.body;
    if (!payload || !payload.title) {
      return res.status(400).json({ error: 'Notification title is required' });
    }
    const notification = await addNotification(payload);
    res.json({ success: true, notification });
  } catch (err: any) {
    console.error('[API Notification Create Error]:', err);
    res.status(500).json({ error: err.message });
  }
});

// Mark single notification as read
app.patch('/api/notifications/:id/read', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await markNotificationRead(id);
    res.json({ success: true });
  } catch (err: any) {
    console.error('[API Notification Mark Read Error]:', err);
    res.status(500).json({ error: err.message });
  }
});

// Mark all notifications as read
app.post('/api/notifications/read-all', async (_req: Request, res: Response) => {
  try {
    await markAllNotificationsRead();
    res.json({ success: true });
  } catch (err: any) {
    console.error('[API Notifications Mark All Read Error]:', err);
    res.status(500).json({ error: err.message });
  }
});

// Delete notification
app.delete('/api/notifications/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await deleteNotification(id);
    res.json({ success: true });
  } catch (err: any) {
    console.error('[API Notification Delete Error]:', err);
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// Vite Middleware / Static Serving
// -------------------------------------------------------------

async function startServer() {
  // Initialize PostgreSQL database and tables (must complete before serving)
  await initDatabase();

  if (!isProduction) {
    // Development mode with Vite dev middleware
    // Dynamic import so esbuild can bundle the server for production without pulling in Vite
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production mode with built assets
    const distPath = path.resolve(process.cwd(), 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (_req: Request, res: Response) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[RemitPal Server] Running on http://localhost:${PORT} with PostgreSQL database`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

// Graceful shutdown — close the database pool
process.on('SIGTERM', async () => {
  console.log('[RemitPal Server] SIGTERM received, shutting down...');
  await closePool();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[RemitPal Server] SIGINT received, shutting down...');
  await closePool();
  process.exit(0);
});
