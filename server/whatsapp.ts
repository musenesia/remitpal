// Fonnte WhatsApp notification service.
//
// Sends WhatsApp messages to both family members (Siti & Slamet) whenever a
// tracked event happens in the app — a remittance sent, an expense logged, a
// receipt uploaded, or a receipt verified/flagged.
//
// Provider: Fonnte (https://fonnte.com) — an unofficial WhatsApp API gateway.
// API docs: https://docs.fonnte.com/
// Send endpoint: POST https://api.fonnte.com/send
//   Headers: { Authorization: <FONNTE_TOKEN> }
//   Body (form): { target: "<phone>", message: "<text>", countryCode: "62" }
//
// Configuration (see .env.example):
//   FONNTE_TOKEN     — required; your Fonnte API token from the dashboard.
//   WA_ENABLED        — optional; set to "false" to disable broadcasts entirely.
//   WA_SITI_PHONE     — optional; overrides Siti's phone number from the DB.
//   WA_SLAMET_PHONE   — optional; overrides Slamet's phone number from the DB.

import { getUsers } from './db';

const FONNTE_API_URL = 'https://api.fonnte.com/send';

/** Whether WhatsApp broadcasting is enabled (requires a Fonnte token). */
export function isWhatsAppEnabled(): boolean {
  if (process.env.WA_ENABLED === 'false') return false;
  return !!process.env.FONNTE_TOKEN;
}

/** Normalize a phone number to Fonnte's expected international format (no "+", no spaces). */
function normalizePhone(phone: string): string {
  let p = phone.replace(/\D/g, '');
  // Convert Indonesian local numbers starting with 0 to 62…
  if (p.startsWith('0')) p = '62' + p.slice(1);
  // Default to Indonesian country code if none present.
  if (!p.startsWith('62') && !p.startsWith('+')) p = '62' + p;
  return p.replace(/^\+/, '');
}

/** Send a single WhatsApp message to one target number via Fonnte. */
export async function sendWhatsAppMessage(target: string, message: string): Promise<boolean> {
  const token = process.env.FONNTE_TOKEN;
  if (!token) {
    console.warn('[WhatsApp] FONNTE_TOKEN not set — skipping message to', target);
    return false;
  }

  const normalizedTarget = normalizePhone(target);
  try {
    const res = await fetch(FONNTE_API_URL, {
      method: 'POST',
      headers: {
        Authorization: token,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        target: normalizedTarget,
        message,
        countryCode: '62',
      }).toString(),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.warn(`[WhatsApp] Fonnte API error ${res.status} for ${normalizedTarget}:`, text);
      return false;
    }

    const data = await res.json().catch(() => null);
    console.log(`[WhatsApp] Message sent to ${normalizedTarget}:`, data?.reason || data?.status || 'ok');
    return true;
  } catch (err) {
    console.warn(`[WhatsApp] Failed to send to ${normalizedTarget}:`, err);
    return false;
  }
}

interface WaRecipient {
  username: string;
  firstName: string;
  phone: string;
}

/** Resolve the phone numbers for both family members, applying env overrides. */
async function getRecipients(): Promise<WaRecipient[]> {
  const envSiti = process.env.WA_SITI_PHONE;
  const envSlamet = process.env.WA_SLAMET_PHONE;
  const users = await getUsers();

  const recipients: WaRecipient[] = [];
  for (const u of users) {
    let phone = u.phone || '';
    if (u.username === 'siti' && envSiti) phone = envSiti;
    if (u.username === 'slamet' && envSlamet) phone = envSlamet;
    if (phone) {
      recipients.push({
        username: u.username,
        firstName: u.name.split(' ')[0] || u.name,
        phone,
      });
    }
  }
  return recipients;
}

/** Format a Jakarta-timezone timestamp for the message footer. */
function formatTimestamp(): string {
  return new Date().toLocaleString('en-GB', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }) + ' WIB';
}

/**
 * Broadcast a WhatsApp notification about an app event to BOTH family members
 * (Siti and Slamet). Each recipient gets a personalized greeting.
 *
 * This is safe to call from request handlers: it never throws and silently
 * skips when WhatsApp is disabled or no recipients/phone numbers are set up.
 */
export async function broadcastEventNotification(
  title: string,
  description: string,
  actorName: string
): Promise<void> {
  if (!isWhatsAppEnabled()) {
    console.log('[WhatsApp] Disabled or FONNTE_TOKEN missing — skipping broadcast for:', title);
    return;
  }

  const recipients = await getRecipients();
  if (recipients.length === 0) {
    console.warn('[WhatsApp] No recipients with phone numbers configured — skipping broadcast.');
    return;
  }

  const timestamp = formatTimestamp();

  await Promise.all(
    recipients.map((r) => {
      const message =
        `Hi ${r.firstName} 👋\n\n` +
        `📢 *RemitPal — Activity Update*\n\n` +
        `*${title}*\n` +
        `${description}\n\n` +
        `— By ${actorName}\n` +
        `🕒 ${timestamp}`;
      return sendWhatsAppMessage(r.phone, message);
    })
  );
}
