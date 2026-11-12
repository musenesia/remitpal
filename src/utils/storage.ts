import { AppData, ExpenseItem, RemittanceRecord } from '../types';
import { INITIAL_DATA } from '../data/initialData';

const STORAGE_KEY = 'remitpal_expense_tracker_v1';

/**
 * Sanity-check the loaded data to catch corrupted / accumulated records.
 * - Rejects any single remittance with amountIdr > 500,000,000 (Rp 500M is an
 *   absurd single transfer; legitimate ones are ~15,000,000 IDR each).
 * - Rejects any single expense with amountIdr > 100,000,000 (Rp 100M).
 * - Caps the total number of remittances to 120 (10 years of monthly transfers).
 * Returns null if the data looks fundamentally broken and a reset is needed.
 */
export function sanitizeAppData(data: AppData): AppData | null {
  const MAX_SINGLE_REMITTANCE_IDR = 500_000_000;    // Rp 500M
  const MAX_SINGLE_EXPENSE_IDR   = 100_000_000;    // Rp 100M
  const MAX_REMITTANCE_RECORDS   = 120;

  const cleanRemittances = data.remittances
    .filter((r) => {
      const amt = Number(r.amountIdr);
      if (!isFinite(amt) || amt <= 0 || amt > MAX_SINGLE_REMITTANCE_IDR) {
        console.warn(
          `[RemitPal] Dropping corrupted remittance "${r.id}" with amountIdr=${r.amountIdr}`
        );
        return false;
      }
      return true;
    })
    .slice(0, MAX_REMITTANCE_RECORDS);

  const cleanExpenses = data.expenses.filter((e) => {
    const amt = Number(e.amountIdr);
    if (!isFinite(amt) || amt <= 0 || amt > MAX_SINGLE_EXPENSE_IDR) {
      console.warn(
        `[RemitPal] Dropping corrupted expense "${e.id}" with amountIdr=${e.amountIdr}`
      );
      return false;
    }
    return true;
  });

  return { ...data, remittances: cleanRemittances, expenses: cleanExpenses };
}

export function loadAppData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      saveAppData(INITIAL_DATA);
      return INITIAL_DATA;
    }
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.expenses || !parsed.remittances) {
      saveAppData(INITIAL_DATA);
      return INITIAL_DATA;
    }
    if (!parsed.calendarEvents) {
      parsed.calendarEvents = INITIAL_DATA.calendarEvents;
    }
    const sanitized = sanitizeAppData(parsed);
    if (!sanitized) {
      console.warn('[RemitPal] Corrupted app data detected — resetting to initial data.');
      saveAppData(INITIAL_DATA);
      return INITIAL_DATA;
    }
    // If sanitization removed records, persist the clean version immediately.
    if (
      sanitized.remittances.length !== parsed.remittances.length ||
      sanitized.expenses.length !== parsed.expenses.length
    ) {
      console.warn('[RemitPal] Corrupted records were removed from localStorage.');
      saveAppData(sanitized);
    }
    return sanitized;
  } catch (err) {
    console.error('Error loading app data from localStorage, falling back to initial data:', err);
    return INITIAL_DATA;
  }
}

export function saveAppData(data: AppData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.error('Error saving app data to localStorage:', err);
  }
}

export function resetAppData(): AppData {
  saveAppData(INITIAL_DATA);
  return INITIAL_DATA;
}

export function exportToJson(data: AppData): void {
  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `remitpal_backup_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function importFromJson(file: File): Promise<AppData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target?.result as string);
        if (!parsed.expenses || !Array.isArray(parsed.expenses)) {
          throw new Error('Invalid JSON structure: missing expenses array');
        }
        resolve(parsed as AppData);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('File read error'));
    reader.readAsText(file);
  });
}

export function exportExpensesToCsv(expenses: ExpenseItem[], remittances: RemittanceRecord[]): void {
  // CSV with UTF-8 BOM so Excel opens with proper accents and formatting
  let csvContent = '\uFEFF';
  
  // Section 1: Expenses
  csvContent += 'TYPE,DATE,MONTH_YEAR,CATEGORY,TITLE_DESCRIPTION,AMOUNT_IDR,VENDOR,PAID_BY,RECEIPT_STATUS,VERIFICATION_NOTES\n';
  expenses.forEach((item) => {
    const row = [
      'EXPENSE',
      item.date,
      item.monthYear,
      item.categoryId,
      `"${(item.title || '').replace(/"/g, '""')}"`,
      item.amountIdr,
      `"${(item.vendor || '').replace(/"/g, '""')}"`,
      `"${(item.paidBy || '').replace(/"/g, '""')}"`,
      item.receiptStatus,
      `"${(item.verificationNotes || '').replace(/"/g, '""')}"`
    ];
    csvContent += row.join(',') + '\n';
  });

  // Section 2: Remittances
  remittances.forEach((rem) => {
    const row = [
      'REMITTANCE',
      rem.date,
      rem.monthYear,
      'REMITTANCE_TRANSFER',
      `"Remittance from HK: ${rem.transferService}"`,
      rem.amountIdr,
      `"${rem.transferService}"`,
      `"${rem.sender}"`,
      rem.status,
      `"${(rem.notes || '').replace(/"/g, '""')} (Ref: ${rem.referenceNo})"`
    ];
    csvContent += row.join(',') + '\n';
  });

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `remitpal_expenses_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function importExpensesFromCsv(file: File, currentData: AppData): Promise<AppData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
        if (lines.length < 2) {
          throw new Error('CSV file is empty or missing headers');
        }

        const newExpenses: ExpenseItem[] = [];
        // Skip header
        for (let i = 1; i < lines.length; i++) {
          const row = lines[i];
          // simple CSV split considering quotes
          const regex = /(?:^|,)(\"(?:[^\"]+|\"\")*\"|[^,]*)/g;
          const matches: string[] = [];
          let match;
          while ((match = regex.exec(row)) !== null) {
            let val = match[1];
            if (val.startsWith('"') && val.endsWith('"')) {
              val = val.slice(1, -1).replace(/""/g, '"');
            }
            matches.push(val.trim());
          }

          if (matches.length >= 6) {
            const type = matches[0];
            if (type === 'EXPENSE' || !type) {
              const date = matches[1] || new Date().toISOString().slice(0, 10);
              const monthYear = matches[2] || date.slice(0, 7);
              const categoryId = (matches[3] as any) || 'miscellaneous';
              const title = matches[4] || 'Imported Expense';
              const amountIdr = parseInt(matches[5], 10) || 0;
              const vendor = matches[6] || 'Local Vendor';
              const paidBy = matches[7] || currentData.workerProfile.husbandName;
              const receiptStatus = (matches[8] as any) || 'pending';
              const verificationNotes = matches[9] || 'Imported from CSV';

              newExpenses.push({
                id: `exp-csv-${Date.now()}-${i}`,
                date,
                monthYear,
                categoryId,
                title,
                amountIdr,
                vendor,
                paidBy,
                receiptStatus,
                verificationNotes
              });
            }
          }
        }

        if (newExpenses.length === 0) {
          throw new Error('No valid expense rows found in CSV');
        }

        const merged: AppData = {
          ...currentData,
          expenses: [...newExpenses, ...currentData.expenses]
        };
        resolve(merged);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('CSV read failure'));
    reader.readAsText(file);
  });
}
