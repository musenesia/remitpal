export type CategoryId = 'renovation' | 'tuition' | 'allowance' | 'savings' | 'miscellaneous';

export type ReceiptStatus = 'verified' | 'pending' | 'needs_clarification' | 'no_receipt';

export interface MonthlyBudget {
  monthYear: string; // e.g. "2026-11"
  totalRemittancePlanned: number; // default 15,000,000 IDR
  allocations: Record<CategoryId, number>;
  notes?: string;
}

export interface RemittanceRecord {
  id: string;
  date: string; // YYYY-MM-DD
  monthYear: string; // YYYY-MM
  amountIdr: number; // e.g. 15000000
  amountHkd?: number; // e.g. 7500
  transferService: string; // e.g. "BRI Remittance HK", "Bank Mandiri HK", "Western Union HK"
  sender: string; // "Siti Rahayu (Hong Kong)"
  receiver: string; // "Slamet Widodo (Indramayu)"
  referenceNo: string;
  notes: string;
  status: 'received' | 'in_transit';
}

export interface ExpenseItem {
  id: string;
  date: string; // YYYY-MM-DD
  monthYear: string; // YYYY-MM
  categoryId: CategoryId;
  title: string;
  amountIdr: number;
  vendor: string;
  paidBy: string; // "Slamet Widodo (Husband)"
  receiptUrl?: string; // image URL or base64 data
  receiptStatus: ReceiptStatus;
  verificationNotes?: string;
  verifiedAt?: string;
}

export type EventType = 'remittance' | 'renovation' | 'tuition' | 'allowance' | 'savings' | 'task';

export interface CalendarEvent {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  time?: string; // HH:mm
  type: EventType;
  priority: 'low' | 'medium' | 'high';
  isCompleted: boolean;
  assignedTo?: string; // e.g. "Siti (Hong Kong)" or "Slamet (Indramayu)"
  estimatedAmountIdr?: number;
  notes?: string;
}

export interface AppData {
  version: number;
  workerProfile: {
    name: string;
    location: string;
    destination: string;
    jobTitle: string;
    monthlyTargetIdr: number;
    husbandName: string;
    childrenNames: string[];
    avatarUrl?: string;
  };
  budgets: MonthlyBudget[];
  remittances: RemittanceRecord[];
  expenses: ExpenseItem[];
  calendarEvents: CalendarEvent[];
}

export type ActiveTab = 'overview' | 'expenses' | 'remittances' | 'receipts' | 'budget' | 'calendar' | 'notifications' | 'report';

export type NotificationType = 
  | 'remittance_sent' 
  | 'remittance_received' 
  | 'receipt_uploaded' 
  | 'receipt_verified' 
  | 'receipt_flagged'
  | 'expense_logged' 
  | 'task_completed' 
  | 'budget_updated';

export interface AppNotification {
  id: string;
  type: NotificationType;
  actor: 'siti' | 'slamet' | 'system';
  actorName: string;
  actorRole: string;
  title: string;
  description: string;
  timestamp: string;
  isRead: boolean;
  relatedId?: string;
  category?: CategoryId | 'remittance' | 'task';
  amountIdr?: number;
}

export type UserRole = 'remitter' | 'manager';

export interface UserProfile {
  id: string;
  username: string;
  email: string;
  name: string;
  role: UserRole;
  location: string;
  avatarUrl?: string;
  phone?: string;
}


