export interface Translations {
  appName: string;
  appSubtitle: string;
  tagline: string;
  nav: {
    overview: string;
    expenses: string;
    remittances: string;
    receipts: string;
    budget: string;
    calendar: string;
    notifications: string;
    report: string;
    settings: string;
  };
  actions: {
    addExpense: string;
    recordRemittance: string;
    addEvent: string;
    editEvent: string;
    deleteEvent: string;
    editExpense: string;
    deleteExpense: string;
    importExport: string;
    printPdf: string;
    resetDemo: string;
    filter: string;
    search: string;
    clearFilter: string;
    verifyReceipt: string;
    uploadReceipt: string;
    save: string;
    cancel: string;
    confirm: string;
    downloadJson: string;
    uploadJson: string;
    downloadCsv: string;
    uploadCsv: string;
  };
  overview: {
    heroTitle: string;
    heroDesc: string;
    totalRemitted: string;
    totalSpent: string;
    allocatedRemaining: string;
    accumulatedSavings: string;
    monthlyTarget: string;
    spendingEfficiency: string;
    receiptVerificationRate: string;
    renovationProgress: string;
    familyHeadline: string;
    recentTransactions: string;
    budgetVsActual: string;
    spendingByCategory: string;
    viewAll: string;
    allGood: string;
    overBudget: string;
  };
  categories: {
    renovation: string;
    tuition: string;
    allowance: string;
    savings: string;
    miscellaneous: string;
  };
  categoryDescriptions: {
    renovation: string;
    tuition: string;
    allowance: string;
    savings: string;
    miscellaneous: string;
  };
  receiptStatus: {
    verified: string;
    pending: string;
    needs_clarification: string;
    no_receipt: string;
  };
  remittanceStatus: {
    received: string;
    in_transit: string;
  };
  table: {
    date: string;
    category: string;
    description: string;
    vendor: string;
    amount: string;
    receipt: string;
    status: string;
    actions: string;
    paidBy: string;
    noData: string;
  };
  filters: {
    allMonths: string;
    allCategories: string;
    allStatuses: string;
    searchPlaceholder: string;
    dateRange: string;
    minAmount: string;
    maxAmount: string;
  };
  profile: {
    workerName: string;
    workerRole: string;
    workerLocation: string;
    familyLocation: string;
    recipientName: string;
    children: string;
    monthlyAllocation: string;
  };
  report: {
    statementTitle: string;
    monthlyAudit: string;
    generatedOn: string;
    statementFor: string;
    remittanceSummary: string;
    spendingSummary: string;
    netSavings: string;
    husbandSignature: string;
    workerSignature: string;
    auditStatus: string;
    notes: string;
  };
  messages: {
    dataSaved: string;
    dataReset: string;
    importSuccess: string;
    importFailed: string;
    confirmDelete: string;
    confirmReset: string;
    offlineReady: string;
  };
}

export const translations = {
  en: {
    appName: "RemitPal",
    appSubtitle: "HK to Indramayu Family Ledger",
    tagline: "Transparent family remittance & expense tracker",
    nav: {
      overview: "Overview",
      expenses: "Expenses",
      remittances: "Remittances",
      receipts: "Receipt Vault",
      budget: "Budget Plan",
      calendar: "Transfer & Task Schedule",
      notifications: "Activity & Notifications",
      report: "Audit Statement",
      settings: "Data & Backup"
    },
    actions: {
      addExpense: "Log Expense",
      recordRemittance: "Record Remittance",
      addEvent: "Add Schedule / Task",
      editEvent: "Edit Item",
      deleteEvent: "Delete Item",
      editExpense: "Edit Expense",
      deleteExpense: "Delete",
      importExport: "Import / Export",
      printPdf: "Print Statement (PDF)",
      resetDemo: "Reset Sample Data",
      filter: "Filter",
      search: "Search description, vendor, note...",
      clearFilter: "Clear Filters",
      verifyReceipt: "Verify Receipt",
      uploadReceipt: "Upload Receipt Proof",
      save: "Save Changes",
      cancel: "Cancel",
      confirm: "Confirm",
      downloadJson: "Export JSON Backup",
      uploadJson: "Import JSON File",
      downloadCsv: "Export CSV Sheet",
      uploadCsv: "Import CSV Sheet"
    },
    overview: {
      heroTitle: "Monthly Remittance Cycle",
      heroDesc: "15,000,000 IDR sent from Hong Kong to Indramayu, West Java.",
      totalRemitted: "Total Remitted",
      totalSpent: "Total Spent",
      allocatedRemaining: "Remaining Balance",
      accumulatedSavings: "Total Saved",
      monthlyTarget: "Monthly Target: 15,000,000 IDR",
      spendingEfficiency: "Execution Rate",
      receiptVerificationRate: "Verified Receipts",
      renovationProgress: "Home Renovation Stage",
      familyHeadline: "Direct Family Accountability",
      recentTransactions: "Recent Family Expenses",
      budgetVsActual: "Planned Budget vs Actual Spend",
      spendingByCategory: "Spending by Allocation",
      viewAll: "View All",
      allGood: "Within Planned Budget",
      overBudget: "Exceeds Allocation"
    },
    categories: {
      renovation: "Home Renovation",
      tuition: "Kid's Tuition & School",
      allowance: "Monthly Living & Groceries",
      savings: "Savings & Emergency Fund",
      miscellaneous: "Other Expenses"
    },
    categoryDescriptions: {
      renovation: "Materials (cement, bricks, roof), labor wages, construction tools",
      tuition: "SMP/SMA school tuition, uniforms, books, after-school courses",
      allowance: "Rice, groceries, electricity token, water, monthly essentials",
      savings: "Bank deposit in Indramayu, reserve emergency cash fund",
      miscellaneous: "Healthcare, pharmacy medicines, family transport, urgent needs"
    },
    receiptStatus: {
      verified: "Receipt Verified",
      pending: "Pending Receipt",
      needs_clarification: "Clarification Needed",
      no_receipt: "No Receipt Provided"
    },
    remittanceStatus: {
      received: "Received in Indramayu",
      in_transit: "In Transit from HK"
    },
    table: {
      date: "Date",
      category: "Category",
      description: "Item / Description",
      vendor: "Vendor / Merchant",
      amount: "Amount (IDR)",
      receipt: "Receipt Proof",
      status: "Audit Status",
      actions: "Actions",
      paidBy: "Logged By",
      noData: "No expense records found matching criteria."
    },
    filters: {
      allMonths: "All Months",
      allCategories: "All Categories",
      allStatuses: "All Receipt Statuses",
      searchPlaceholder: "Search description, merchant, receipt...",
      dateRange: "Date Range",
      minAmount: "Min Amount",
      maxAmount: "Max Amount"
    },
    profile: {
      workerName: "Siti Rahayu",
      workerRole: "Domestic Caregiver & Provider",
      workerLocation: "Causeway Bay, Hong Kong",
      familyLocation: "Karangampel, Indramayu, Jawa Barat",
      recipientName: "Slamet Widodo (Husband)",
      children: "Rizky (14, SMP) & Alya (10, SD)",
      monthlyAllocation: "Fixed Remittance: 15,000,000 IDR / mo"
    },
    report: {
      statementTitle: "Remittance & Family Expense Statement",
      monthlyAudit: "Monthly Financial Accountability Report",
      generatedOn: "Generated Date",
      statementFor: "Statement Month",
      remittanceSummary: "Remittance Summary",
      spendingSummary: "Itemized Family Expenses",
      netSavings: "Net Preserved Savings",
      husbandSignature: "Slamet Widodo (Manager in Indramayu)",
      workerSignature: "Siti Rahayu (Remitter in Hong Kong)",
      auditStatus: "Statement Status",
      notes: "Audit Notes & Proofs Verified"
    },
    messages: {
      dataSaved: "Data updated successfully in offline storage.",
      dataReset: "Reset to default demo data completed.",
      importSuccess: "Data imported successfully.",
      importFailed: "Failed to parse import file. Please check format.",
      confirmDelete: "Are you sure you want to delete this expense record?",
      confirmReset: "Reset all current data back to initial sample state? Unsaved changes will be replaced.",
      offlineReady: "100% Offline Storage · Local Browser Database"
    }
  }
};
