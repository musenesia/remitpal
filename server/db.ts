import { Pool } from 'pg';
import crypto from 'node:crypto';
import { INITIAL_DATA } from '../src/data/initialData';
import { AppData, CalendarEvent, ExpenseItem, MonthlyBudget, ReceiptStatus, RemittanceRecord, UserProfile, AppNotification } from '../src/types';

// PostgreSQL connection pool.
// DATABASE_URL is injected by Render (or set locally via .env).
// e.g. postgresql://user:password@host:5432/dbname
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Log connection errors for debugging on Render
pool.on('error', (err) => {
  console.error('[PostgreSQL] Unexpected pool error:', err);
});

// Password hashing helpers using built-in node:crypto
export function hashPassword(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

export function generateSalt(): string {
  return crypto.randomBytes(16).toString('hex');
}

export async function initDatabase() {
  // 1. Users Table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      location TEXT NOT NULL,
      avatar_url TEXT,
      phone TEXT,
      created_at TEXT NOT NULL
    );
  `);

  // 2. Remittances Table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS remittances (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      month_year TEXT NOT NULL,
      amount_idr DOUBLE PRECISION NOT NULL,
      amount_hkd DOUBLE PRECISION,
      transfer_service TEXT NOT NULL,
      sender TEXT NOT NULL,
      receiver TEXT NOT NULL,
      reference_no TEXT NOT NULL,
      notes TEXT,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  // 3. Expenses Table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      month_year TEXT NOT NULL,
      category_id TEXT NOT NULL,
      title TEXT NOT NULL,
      amount_idr DOUBLE PRECISION NOT NULL,
      vendor TEXT NOT NULL,
      paid_by TEXT NOT NULL,
      receipt_url TEXT,
      receipt_status TEXT NOT NULL,
      verification_notes TEXT,
      verified_at TEXT,
      created_at TEXT NOT NULL
    );
  `);

  // 4. Budgets Table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS budgets (
      id TEXT PRIMARY KEY,
      month_year TEXT UNIQUE NOT NULL,
      total_remittance_planned DOUBLE PRECISION NOT NULL,
      allocations_json TEXT NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL
    );
  `);

  // 5. Calendar Events Table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS calendar_events (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      date TEXT NOT NULL,
      time TEXT,
      type TEXT NOT NULL,
      priority TEXT NOT NULL,
      is_completed BOOLEAN NOT NULL DEFAULT FALSE,
      assigned_to TEXT,
      estimated_amount_idr DOUBLE PRECISION,
      notes TEXT,
      created_at TEXT NOT NULL
    );
  `);

  // 6. Active Sessions Table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );
  `);

  // 7. Activity & Family Notifications Table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      actor TEXT NOT NULL,
      actor_name TEXT NOT NULL,
      actor_role TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      is_read BOOLEAN NOT NULL DEFAULT FALSE,
      related_id TEXT,
      category TEXT,
      amount_idr DOUBLE PRECISION,
      created_at TEXT NOT NULL
    );
  `);

  // Migration: add phone column for databases created before it existed.
  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;
  `);
  // Backfill phone numbers for seeded users when missing.
  await pool.query(`UPDATE users SET phone = '628123456789' WHERE username = 'siti' AND (phone IS NULL OR phone = '');`);
  await pool.query(`UPDATE users SET phone = '628573456789' WHERE username = 'slamet' AND (phone IS NULL OR phone = '');`);

  // Seed default users if table is empty
  await seedUsersIfEmpty();
  // Seed remittances, expenses, budgets, calendar events, notifications if empty
  await seedDataIfEmpty();
}

async function seedUsersIfEmpty() {
  const result = await pool.query('SELECT COUNT(*) as count FROM users');
  const userCount = parseInt(result.rows[0].count, 10);

  if (userCount === 0) {
    // Demo seed passwords come from env when set; the defaults below are
    // DEMO-ONLY and must be overridden via env on any shared deploy.
    // NOTE: seeding only runs when the users table is empty, so changing
    // these env vars later does NOT change existing passwords.
    const sitiPassword = process.env.SEED_SITI_PASSWORD || 'siti123';
    const slametPassword = process.env.SEED_SLAMET_PASSWORD || 'slamet123';

    const sitiSalt = generateSalt();
    const sitiHash = hashPassword(sitiPassword, sitiSalt);

    const slametSalt = generateSalt();
    const slametHash = hashPassword(slametPassword, slametSalt);

    const insertUser = `
      INSERT INTO users (id, username, email, password_hash, salt, name, role, location, avatar_url, phone, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    `;

    await pool.query(insertUser, [
      'usr-siti',
      'siti',
      'siti@remitpal.com',
      sitiHash,
      sitiSalt,
      'Siti Rahayu',
      'remitter',
      'Causeway Bay, Hong Kong',
      '/src/assets/images/worker_profile_avatar_1794285313427.jpg',
      '628123456789',
      new Date().toISOString()
    ]);

    await pool.query(insertUser, [
      'usr-slamet',
      'slamet',
      'slamet@remitpal.com',
      slametHash,
      slametSalt,
      'Slamet Widodo',
      'manager',
      'Desa Karangampel, Indramayu',
      '',
      '628573456789',
      new Date().toISOString()
    ]);

    console.log('[PostgreSQL] Seeded demo users: siti and slamet (demo-only default passwords — override via SEED_SITI_PASSWORD / SEED_SLAMET_PASSWORD on any shared deploy)');
  }
}

async function seedDataIfEmpty() {
  // Remittances
  const remResult = await pool.query('SELECT COUNT(*) as count FROM remittances');
  if (parseInt(remResult.rows[0].count, 10) === 0) {
    const insertRem = `
      INSERT INTO remittances (id, date, month_year, amount_idr, amount_hkd, transfer_service, sender, receiver, reference_no, notes, status, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    `;
    for (const r of INITIAL_DATA.remittances) {
      await pool.query(insertRem, [
        r.id,
        r.date,
        r.monthYear,
        r.amountIdr,
        r.amountHkd || null,
        r.transferService,
        r.sender,
        r.receiver,
        r.referenceNo,
        r.notes,
        r.status,
        new Date().toISOString()
      ]);
    }
  }

  // Expenses
  const expResult = await pool.query('SELECT COUNT(*) as count FROM expenses');
  if (parseInt(expResult.rows[0].count, 10) === 0) {
    const insertExp = `
      INSERT INTO expenses (id, date, month_year, category_id, title, amount_idr, vendor, paid_by, receipt_url, receipt_status, verification_notes, verified_at, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    `;
    for (const e of INITIAL_DATA.expenses) {
      await pool.query(insertExp, [
        e.id,
        e.date,
        e.monthYear,
        e.categoryId,
        e.title,
        e.amountIdr,
        e.vendor,
        e.paidBy,
        e.receiptUrl || null,
        e.receiptStatus,
        e.verificationNotes || null,
        e.verifiedAt || null,
        new Date().toISOString()
      ]);
    }
  }

  // Budgets
  const bgtResult = await pool.query('SELECT COUNT(*) as count FROM budgets');
  if (parseInt(bgtResult.rows[0].count, 10) === 0) {
    const insertBgt = `
      INSERT INTO budgets (id, month_year, total_remittance_planned, allocations_json, notes, created_at)
      VALUES ($1, $2, $3, $4, $5, $6)
    `;
    for (const b of INITIAL_DATA.budgets) {
      await pool.query(insertBgt, [
        `bgt-${b.monthYear}`,
        b.monthYear,
        b.totalRemittancePlanned,
        JSON.stringify(b.allocations),
        b.notes || '',
        new Date().toISOString()
      ]);
    }
  }

  // Calendar Events
  const calResult = await pool.query('SELECT COUNT(*) as count FROM calendar_events');
  if (parseInt(calResult.rows[0].count, 10) === 0) {
    const insertCal = `
      INSERT INTO calendar_events (id, title, date, time, type, priority, is_completed, assigned_to, estimated_amount_idr, notes, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    `;
    for (const c of (INITIAL_DATA.calendarEvents || [])) {
      await pool.query(insertCal, [
        c.id,
        c.title,
        c.date,
        c.time || null,
        c.type,
        c.priority,
        c.isCompleted,
        c.assignedTo || null,
        c.estimatedAmountIdr || null,
        c.notes || null,
        new Date().toISOString()
      ]);
    }
  }

  // Activity & Family Notifications
  const notifResult = await pool.query('SELECT COUNT(*) as count FROM notifications');
  if (parseInt(notifResult.rows[0].count, 10) === 0) {
    const insertNotif = `
      INSERT INTO notifications (id, type, actor, actor_name, actor_role, title, description, timestamp, is_read, related_id, category, amount_idr, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    `;

    const DEFAULT_NOTIFICATIONS: AppNotification[] = [
      {
        id: 'notif-01',
        type: 'remittance_sent',
        actor: 'siti',
        actorName: 'Siti Rahayu',
        actorRole: 'Remitter (Hong Kong)',
        title: 'Monthly Salary Remittance Sent',
        description: 'Siti transferred Rp 15,000,000 via BRI Remittance Causeway Bay (Ref: HKBR2611029841).',
        timestamp: '2026-11-02T10:35:00Z',
        isRead: true,
        relatedId: 'rem-2026-11',
        category: 'remittance',
        amountIdr: 15000000
      },
      {
        id: 'notif-02',
        type: 'remittance_received',
        actor: 'slamet',
        actorName: 'Slamet Widodo',
        actorRole: 'Manager (Indramayu)',
        title: 'Remittance Deposited & Received',
        description: 'Slamet confirmed receipt of Rp 15,000,000 at Bank BRI Karangampel.',
        timestamp: '2026-11-02T14:15:00Z',
        isRead: true,
        relatedId: 'rem-2026-11',
        category: 'remittance',
        amountIdr: 15000000
      },
      {
        id: 'notif-03',
        type: 'expense_logged',
        actor: 'slamet',
        actorName: 'Slamet Widodo',
        actorRole: 'Manager (Indramayu)',
        title: 'Tuition Paid: SMP SPP & Exam Fee',
        description: 'Slamet paid Rp 1,650,000 to SMP Negeri 1 Karangampel for Rizky.',
        timestamp: '2026-11-03T09:45:00Z',
        isRead: true,
        relatedId: 'exp-nov-03',
        category: 'tuition',
        amountIdr: 1650000
      },
      {
        id: 'notif-04',
        type: 'receipt_verified',
        actor: 'siti',
        actorName: 'Siti Rahayu',
        actorRole: 'Remitter (Hong Kong)',
        title: "Receipt Verified: Rizky's SMP Tuition",
        description: 'Siti reviewed and approved the bank receipt and school seal stamp.',
        timestamp: '2026-11-03T12:00:00Z',
        isRead: true,
        relatedId: 'exp-nov-03',
        category: 'tuition',
        amountIdr: 1650000
      },
      {
        id: 'notif-05',
        type: 'receipt_uploaded',
        actor: 'slamet',
        actorName: 'Slamet Widodo',
        actorRole: 'Manager (Indramayu)',
        title: 'Receipt Uploaded: Granite Floor Tiles',
        description: 'Slamet uploaded receipt for 30 boxes granite tiles (Rp 2,850,000) from TB Rejeki Abadi.',
        timestamp: '2026-11-04T15:20:00Z',
        isRead: true,
        relatedId: 'exp-nov-01',
        category: 'renovation',
        amountIdr: 2850000
      },
      {
        id: 'notif-06',
        type: 'receipt_verified',
        actor: 'siti',
        actorName: 'Siti Rahayu',
        actorRole: 'Remitter (Hong Kong)',
        title: 'Receipt Approved: Porch Granite Tiles',
        description: 'Siti approved tile patterns and price invoice after video call review.',
        timestamp: '2026-11-04T20:30:00Z',
        isRead: true,
        relatedId: 'exp-nov-01',
        category: 'renovation',
        amountIdr: 2850000
      },
      {
        id: 'notif-07',
        type: 'task_completed',
        actor: 'slamet',
        actorName: 'Slamet Widodo',
        actorRole: 'Manager (Indramayu)',
        title: 'Weekly Mason Wages Disbursed',
        description: 'Slamet paid Pak Karyo & helper weekly wages of Rp 1,400,000 with work log.',
        timestamp: '2026-11-05T17:00:00Z',
        isRead: false,
        relatedId: 'exp-nov-02',
        category: 'renovation',
        amountIdr: 1400000
      },
      {
        id: 'notif-08',
        type: 'expense_logged',
        actor: 'slamet',
        actorName: 'Slamet Widodo',
        actorRole: 'Manager (Indramayu)',
        title: 'Emergency Savings Deposit Recorded',
        description: 'Slamet deposited Rp 2,500,000 to family emergency fund at BRI Karangampel.',
        timestamp: '2026-11-07T11:30:00Z',
        isRead: false,
        relatedId: 'exp-nov-07',
        category: 'savings',
        amountIdr: 2500000
      },
      {
        id: 'notif-09',
        type: 'receipt_flagged',
        actor: 'siti',
        actorName: 'Siti Rahayu',
        actorRole: 'Remitter (Hong Kong)',
        title: 'Receipt Pending: Wood Sealant & Paint',
        description: 'Siti flagged Rp 650,000 purchase. Slamet to upload store receipt tomorrow morning.',
        timestamp: '2026-11-08T19:00:00Z',
        isRead: false,
        relatedId: 'exp-nov-08',
        category: 'renovation',
        amountIdr: 650000
      },
      {
        id: 'notif-10',
        type: 'budget_updated',
        actor: 'siti',
        actorName: 'Siti Rahayu',
        actorRole: 'Remitter (Hong Kong)',
        title: 'November Budget Plan Confirmed',
        description: 'Siti finalized 15M target: 5M Renovation, 3.5M Tuition, 4M Living Allowance, 2.5M Savings.',
        timestamp: '2026-11-01T08:00:00Z',
        isRead: true,
        relatedId: 'bgt-2026-11',
        category: 'remittance',
        amountIdr: 15000000
      }
    ];

    for (const n of DEFAULT_NOTIFICATIONS) {
      await pool.query(insertNotif, [
        n.id,
        n.type,
        n.actor,
        n.actorName,
        n.actorRole,
        n.title,
        n.description,
        n.timestamp,
        n.isRead,
        n.relatedId || null,
        n.category || null,
        n.amountIdr || null,
        new Date().toISOString()
      ]);
    }
  }
}

// -------------------------------------------------------------
// Authentication Helpers
// -------------------------------------------------------------

export async function getUsers(): Promise<UserProfile[]> {
  const result = await pool.query(`
    SELECT id, username, email, name, role, location, avatar_url as "avatarUrl", phone
    FROM users
    ORDER BY role ASC
  `);
  return result.rows as UserProfile[];
}

export async function authenticateUser(username: string, password: string): Promise<{ user: UserProfile; token: string } | null> {
  const result = await pool.query(`
    SELECT id, username, email, password_hash, salt, name, role, location, avatar_url, phone
    FROM users
    WHERE LOWER(username) = LOWER($1)
  `, [username]);
  const row = result.rows[0];
  if (!row) return null;

  const calculatedHash = hashPassword(password, row.salt);
  if (calculatedHash !== row.password_hash) {
    return null;
  }

  const token = crypto.randomBytes(32).toString('hex');
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

  await pool.query(`
    INSERT INTO sessions (token, user_id, created_at, expires_at)
    VALUES ($1, $2, $3, $4)
  `, [token, row.id, now.toISOString(), expiresAt]);

  const user: UserProfile = {
    id: row.id,
    username: row.username,
    email: row.email,
    name: row.name,
    role: row.role,
    location: row.location,
    avatarUrl: row.avatar_url || '',
    phone: row.phone || ''
  };

  return { user, token };
}

export async function verifySession(token: string): Promise<UserProfile | null> {
  if (!token) return null;
  const result = await pool.query(`
    SELECT u.id, u.username, u.email, u.name, u.role, u.location, u.avatar_url, u.phone, s.expires_at
    FROM sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.token = $1
  `, [token]);
  const row = result.rows[0];
  if (!row) return null;

  // Check expiry
  if (new Date(row.expires_at).getTime() < Date.now()) {
    await pool.query('DELETE FROM sessions WHERE token = $1', [token]);
    return null;
  }

  return {
    id: row.id,
    username: row.username,
    email: row.email,
    name: row.name,
    role: row.role,
    location: row.location,
    avatarUrl: row.avatar_url || '',
    phone: row.phone || ''
  };
}

export async function destroySession(token: string): Promise<void> {
  await pool.query('DELETE FROM sessions WHERE token = $1', [token]);
}

// -------------------------------------------------------------
// App Data Accessors (PostgreSQL DB)
// -------------------------------------------------------------

export async function getAppData(): Promise<AppData> {
  // Remittances
  const remResult = await pool.query(`
    SELECT id, date, month_year as "monthYear", amount_idr as "amountIdr", amount_hkd as "amountHkd",
           transfer_service as "transferService", sender, receiver, reference_no as "referenceNo",
           notes, status
    FROM remittances
    ORDER BY date DESC
  `);
  const remittances = remResult.rows as unknown as RemittanceRecord[];

  // Expenses
  const expResult = await pool.query(`
    SELECT id, date, month_year as "monthYear", category_id as "categoryId", title,
           amount_idr as "amountIdr", vendor, paid_by as "paidBy", receipt_url as "receiptUrl",
           receipt_status as "receiptStatus", verification_notes as "verificationNotes",
           verified_at as "verifiedAt"
    FROM expenses
    ORDER BY date DESC
  `);
  const expenses = expResult.rows as unknown as ExpenseItem[];

  // Budgets
  const bgtResult = await pool.query(`
    SELECT id, month_year as "monthYear", total_remittance_planned as "totalRemittancePlanned",
           allocations_json as "allocationsJson", notes
    FROM budgets
    ORDER BY month_year DESC
  `);
  const budgets: MonthlyBudget[] = bgtResult.rows.map((b: any) => ({
    monthYear: b.monthYear,
    totalRemittancePlanned: b.totalRemittancePlanned,
    allocations: JSON.parse(b.allocationsJson || '{}'),
    notes: b.notes || ''
  }));

  // Calendar Events
  const calResult = await pool.query(`
    SELECT id, title, date, time, type, priority, is_completed as "isCompleted",
           assigned_to as "assignedTo", estimated_amount_idr as "estimatedAmountIdr", notes
    FROM calendar_events
    ORDER BY date ASC, time ASC
  `);
  const calendarEvents: CalendarEvent[] = calResult.rows.map((c: any) => ({
    id: c.id,
    title: c.title,
    date: c.date,
    time: c.time || undefined,
    type: c.type,
    priority: c.priority,
    isCompleted: c.isCompleted === true || c.isCompleted === 1,
    assignedTo: c.assignedTo || undefined,
    estimatedAmountIdr: c.estimatedAmountIdr || undefined,
    notes: c.notes || undefined
  }));

  return {
    version: 1,
    workerProfile: INITIAL_DATA.workerProfile,
    budgets,
    remittances,
    expenses,
    calendarEvents
  };
}

export async function upsertExpense(item: ExpenseItem): Promise<void> {
  const stmt = `
    INSERT INTO expenses (id, date, month_year, category_id, title, amount_idr, vendor, paid_by, receipt_url, receipt_status, verification_notes, verified_at, created_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    ON CONFLICT (id) DO UPDATE SET
      date = EXCLUDED.date,
      month_year = EXCLUDED.month_year,
      category_id = EXCLUDED.category_id,
      title = EXCLUDED.title,
      amount_idr = EXCLUDED.amount_idr,
      vendor = EXCLUDED.vendor,
      paid_by = EXCLUDED.paid_by,
      receipt_url = EXCLUDED.receipt_url,
      receipt_status = EXCLUDED.receipt_status,
      verification_notes = EXCLUDED.verification_notes,
      verified_at = EXCLUDED.verified_at
  `;
  await pool.query(stmt, [
    item.id,
    item.date,
    item.monthYear,
    item.categoryId,
    item.title,
    item.amountIdr,
    item.vendor,
    item.paidBy,
    item.receiptUrl || null,
    item.receiptStatus,
    item.verificationNotes || null,
    item.verifiedAt || null,
    new Date().toISOString()
  ]);
}

export async function updateExpenseReceipt(id: string, receiptStatus: ReceiptStatus, verificationNotes?: string, verifiedAt?: string): Promise<void> {
  await pool.query(`
    UPDATE expenses
    SET receipt_status = $1, verification_notes = $2, verified_at = $3
    WHERE id = $4
  `, [receiptStatus, verificationNotes || null, verifiedAt || null, id]);
}

export async function deleteExpense(id: string): Promise<void> {
  await pool.query('DELETE FROM expenses WHERE id = $1', [id]);
}

export async function upsertRemittance(record: RemittanceRecord): Promise<void> {
  const stmt = `
    INSERT INTO remittances (id, date, month_year, amount_idr, amount_hkd, transfer_service, sender, receiver, reference_no, notes, status, created_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    ON CONFLICT (id) DO UPDATE SET
      date = EXCLUDED.date,
      month_year = EXCLUDED.month_year,
      amount_idr = EXCLUDED.amount_idr,
      amount_hkd = EXCLUDED.amount_hkd,
      transfer_service = EXCLUDED.transfer_service,
      sender = EXCLUDED.sender,
      receiver = EXCLUDED.receiver,
      reference_no = EXCLUDED.reference_no,
      notes = EXCLUDED.notes,
      status = EXCLUDED.status
  `;
  await pool.query(stmt, [
    record.id,
    record.date,
    record.monthYear,
    record.amountIdr,
    record.amountHkd || null,
    record.transferService,
    record.sender,
    record.receiver,
    record.referenceNo,
    record.notes,
    record.status,
    new Date().toISOString()
  ]);
}

export async function deleteRemittance(id: string): Promise<void> {
  await pool.query('DELETE FROM remittances WHERE id = $1', [id]);
}

export async function upsertBudget(budget: MonthlyBudget): Promise<void> {
  const stmt = `
    INSERT INTO budgets (id, month_year, total_remittance_planned, allocations_json, notes, created_at)
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (month_year) DO UPDATE SET
      total_remittance_planned = EXCLUDED.total_remittance_planned,
      allocations_json = EXCLUDED.allocations_json,
      notes = EXCLUDED.notes
  `;
  await pool.query(stmt, [
    `bgt-${budget.monthYear}`,
    budget.monthYear,
    budget.totalRemittancePlanned,
    JSON.stringify(budget.allocations),
    budget.notes || '',
    new Date().toISOString()
  ]);
}

export async function upsertCalendarEvent(event: CalendarEvent): Promise<void> {
  const stmt = `
    INSERT INTO calendar_events (id, title, date, time, type, priority, is_completed, assigned_to, estimated_amount_idr, notes, created_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    ON CONFLICT (id) DO UPDATE SET
      title = EXCLUDED.title,
      date = EXCLUDED.date,
      time = EXCLUDED.time,
      type = EXCLUDED.type,
      priority = EXCLUDED.priority,
      is_completed = EXCLUDED.is_completed,
      assigned_to = EXCLUDED.assigned_to,
      estimated_amount_idr = EXCLUDED.estimated_amount_idr,
      notes = EXCLUDED.notes
  `;
  await pool.query(stmt, [
    event.id,
    event.title,
    event.date,
    event.time || null,
    event.type,
    event.priority,
    event.isCompleted,
    event.assignedTo || null,
    event.estimatedAmountIdr || null,
    event.notes || null,
    new Date().toISOString()
  ]);
}

export async function toggleCalendarEvent(id: string): Promise<void> {
  await pool.query(`
    UPDATE calendar_events
    SET is_completed = NOT is_completed
    WHERE id = $1
  `, [id]);
}

export async function deleteCalendarEvent(id: string): Promise<void> {
  await pool.query('DELETE FROM calendar_events WHERE id = $1', [id]);
}

export async function getNotifications(): Promise<AppNotification[]> {
  const result = await pool.query(`
    SELECT id, type, actor, actor_name as "actorName", actor_role as "actorRole",
           title, description, timestamp, is_read as "isRead", related_id as "relatedId",
           category, amount_idr as "amountIdr"
    FROM notifications
    ORDER BY timestamp DESC
  `);
  return result.rows.map((n: any) => ({
    id: n.id,
    type: n.type,
    actor: n.actor,
    actorName: n.actorName,
    actorRole: n.actorRole,
    title: n.title,
    description: n.description,
    timestamp: n.timestamp,
    isRead: n.isRead === true || n.isRead === 1,
    relatedId: n.relatedId || undefined,
    category: n.category || undefined,
    amountIdr: n.amountIdr || undefined
  }));
}

export async function addNotification(notif: Partial<AppNotification>): Promise<AppNotification> {
  const id = notif.id || `notif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const now = notif.timestamp || new Date().toISOString();
  const actor = notif.actor || 'system';
  const actorName = notif.actorName || (actor === 'siti' ? 'Siti Rahayu' : actor === 'slamet' ? 'Slamet Widodo' : 'RemitPal Ledger');
  const actorRole = notif.actorRole || (actor === 'siti' ? 'Remitter (Hong Kong)' : actor === 'slamet' ? 'Manager (Indramayu)' : 'System');

  const fullNotif: AppNotification = {
    id,
    type: notif.type || 'expense_logged',
    actor: actor as AppNotification['actor'],
    actorName,
    actorRole,
    title: notif.title || 'Notification',
    description: notif.description || '',
    timestamp: now,
    isRead: notif.isRead || false,
    relatedId: notif.relatedId,
    category: notif.category,
    amountIdr: notif.amountIdr
  };

  const stmt = `
    INSERT INTO notifications (id, type, actor, actor_name, actor_role, title, description, timestamp, is_read, related_id, category, amount_idr, created_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
  `;

  await pool.query(stmt, [
    fullNotif.id,
    fullNotif.type,
    fullNotif.actor,
    fullNotif.actorName,
    fullNotif.actorRole,
    fullNotif.title,
    fullNotif.description,
    fullNotif.timestamp,
    fullNotif.isRead,
    fullNotif.relatedId || null,
    fullNotif.category || null,
    fullNotif.amountIdr || null,
    new Date().toISOString()
  ]);

  return fullNotif;
}

export async function markNotificationRead(id: string): Promise<void> {
  await pool.query('UPDATE notifications SET is_read = TRUE WHERE id = $1', [id]);
}

export async function markAllNotificationsRead(): Promise<void> {
  await pool.query('UPDATE notifications SET is_read = TRUE');
}

export async function deleteNotification(id: string): Promise<void> {
  await pool.query('DELETE FROM notifications WHERE id = $1', [id]);
}

export async function replaceAllData(data: AppData): Promise<void> {
  await pool.query('DELETE FROM remittances');
  await pool.query('DELETE FROM expenses');
  await pool.query('DELETE FROM budgets');
  await pool.query('DELETE FROM calendar_events');

  for (const r of data.remittances) {
    await upsertRemittance(r);
  }
  for (const e of data.expenses) {
    await upsertExpense(e);
  }
  for (const b of data.budgets) {
    await upsertBudget(b);
  }
  for (const c of (data.calendarEvents || [])) {
    await upsertCalendarEvent(c);
  }
}

// Reset the ledger to seed data. The caller's own session token is preserved
// so they are NOT logged out by their own reset — otherwise the next
// authenticated call (e.g. the AI agent) would 401 and bounce them to login.
// All other (stale) sessions are cleared.
export async function resetDatabase(callerToken?: string): Promise<void> {
  await pool.query('DELETE FROM remittances');
  await pool.query('DELETE FROM expenses');
  await pool.query('DELETE FROM budgets');
  await pool.query('DELETE FROM calendar_events');
  if (callerToken) {
    await pool.query('DELETE FROM sessions WHERE token <> $1', [callerToken]);
  } else {
    await pool.query('DELETE FROM sessions');
  }
  await pool.query('DELETE FROM notifications');
  await seedUsersIfEmpty();
  await seedDataIfEmpty();
}

// Gracefully close the pool on shutdown
export async function closePool(): Promise<void> {
  await pool.end();
}
