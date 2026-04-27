"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { getAllRecords, saveRecord, deleteRecord } from "@/lib/adminDb";

type ExpenseCategory =
  | "Payroll"
  | "Software & Subscriptions"
  | "Marketing"
  | "Communications"
  | "Fuel"
  | "Supplies"
  | "Accommodation"
  | "Bank & Financing"
  | "Accounting & Legal"
  | "Insurance"
  | "Subcontractors"
  | "Owner Draw"
  | "Transfers"
  | "Revenue"
  | "Other";

const ALL_CATEGORIES: ExpenseCategory[] = [
  "Payroll",
  "Software & Subscriptions",
  "Marketing",
  "Communications",
  "Fuel",
  "Supplies",
  "Accommodation",
  "Bank & Financing",
  "Accounting & Legal",
  "Insurance",
  "Subcontractors",
  "Owner Draw",
  "Transfers",
  "Revenue",
  "Other",
];

interface Transaction {
  id: string;
  date: string;
  description: string;
  details: string;
  category: ExpenseCategory;
  account: string;
  amount: number;
  currency: "CAD" | "USD";
  project?: string;
  equipment?: string;
  employee?: string;
}

const ACCOUNTS = {
  CHQ_CAD: "Chequing · 1026699 (CAD)",
  CHQ_USD: "Chequing · 4001657 (USD)",
  VISA: "Visa · 5262",
};

const INITIAL_TRANSACTIONS: Transaction[] = [
  // ── Chequing CAD ────────────────────────────────────────────────────────────
  { id: "t001", date: "2026-02-02", description: "Bank transaction fee", details: "7 Drs @ $2.50", category: "Bank & Financing", account: ACCOUNTS.CHQ_CAD, amount: -17.50, currency: "CAD" },
  { id: "t002", date: "2026-02-02", description: "Monthly account fee", details: "", category: "Bank & Financing", account: ACCOUNTS.CHQ_CAD, amount: -6.00, currency: "CAD" },
  { id: "t003", date: "2026-02-02", description: "Bill Payment – PAY-FILE FEES", details: "", category: "Accounting & Legal", account: ACCOUNTS.CHQ_CAD, amount: -2.00, currency: "CAD" },
  { id: "t004", date: "2026-02-05", description: "Activity fee", details: "", category: "Bank & Financing", account: ACCOUNTS.CHQ_CAD, amount: -30.00, currency: "CAD" },
  { id: "t005", date: "2026-02-09", description: "Insurance – Gore Mutual", details: "", category: "Insurance", account: ACCOUNTS.CHQ_CAD, amount: -171.58, currency: "CAD" },
  { id: "t006", date: "2026-02-09", description: "Loan payment", details: "Other loan", category: "Bank & Financing", account: ACCOUNTS.CHQ_CAD, amount: -989.63, currency: "CAD" },
  { id: "t007", date: "2026-02-11", description: "Payroll run – PAYROLL-34NZ", details: "Feb payroll #1", category: "Payroll", account: ACCOUNTS.CHQ_CAD, amount: -18433.02, currency: "CAD" },
  { id: "t008", date: "2026-02-16", description: "e-Transfer – WEBDESK", details: "", category: "Subcontractors", account: ACCOUNTS.CHQ_CAD, amount: -1163.90, currency: "CAD" },
  { id: "t009", date: "2026-02-16", description: "e-Transfer – WEBDESK", details: "", category: "Subcontractors", account: ACCOUNTS.CHQ_CAD, amount: -4425.65, currency: "CAD" },
  { id: "t010", date: "2026-02-25", description: "Payroll run – PAYROLL-34NZ", details: "Feb payroll #2", category: "Payroll", account: ACCOUNTS.CHQ_CAD, amount: -37306.32, currency: "CAD" },
  { id: "t011", date: "2026-02-26", description: "e-Transfer received – First Resource Management Group", details: "Client payment", category: "Revenue", account: ACCOUNTS.CHQ_CAD, amount: 5000.00, currency: "CAD" },
  { id: "t012", date: "2026-02-27", description: "Investment redemption – RDRMT", details: "", category: "Bank & Financing", account: ACCOUNTS.CHQ_CAD, amount: 578.62, currency: "CAD" },
  { id: "t013", date: "2026-03-02", description: "Owner draw – Matt McKernan", details: "e-Transfer sent", category: "Owner Draw", account: ACCOUNTS.CHQ_CAD, amount: -10000.00, currency: "CAD" },
  { id: "t014", date: "2026-03-02", description: "Deposit – interest", details: "", category: "Bank & Financing", account: ACCOUNTS.CHQ_CAD, amount: 0.25, currency: "CAD" },

  // ── Chequing USD ─────────────────────────────────────────────────────────────
  { id: "t015", date: "2026-02-24", description: "Wire transfer fee – TT National ARB", details: "", category: "Bank & Financing", account: ACCOUNTS.CHQ_USD, amount: -17.00, currency: "USD" },
  { id: "t016", date: "2026-02-24", description: "Funds transfer credit – TT National ARB", details: "", category: "Transfers", account: ACCOUNTS.CHQ_USD, amount: 15908.75, currency: "USD" },
  { id: "t017", date: "2026-02-26", description: "Transfer to business account", details: "Client request – Matthew McKernan", category: "Transfers", account: ACCOUNTS.CHQ_USD, amount: -200000.00, currency: "USD" },

  // ── Visa ─────────────────────────────────────────────────────────────────────
  { id: "t018", date: "2026-01-01", description: "Amazon Web Services", details: "aws.amazon.ca", category: "Software & Subscriptions", account: ACCOUNTS.VISA, amount: -517.27, currency: "CAD" },
  { id: "t019", date: "2026-01-01", description: "Google Ads", details: "GOOGLE*ADS8688472372", category: "Marketing", account: ACCOUNTS.VISA, amount: -77.78, currency: "CAD" },
  { id: "t020", date: "2026-01-02", description: "Adobe Creative Cloud", details: "ADOBE *ADOBE", category: "Software & Subscriptions", account: ACCOUNTS.VISA, amount: -44.06, currency: "CAD" },
  { id: "t021", date: "2026-01-02", description: "MacEwen – Corbeil", details: "Fuel", category: "Fuel", account: ACCOUNTS.VISA, amount: -156.58, currency: "CAD" },
  { id: "t022", date: "2026-01-04", description: "Corporate Filings LLC", details: "19.00 USD @ 1.408947", category: "Accounting & Legal", account: ACCOUNTS.VISA, amount: -26.77, currency: "CAD" },
  { id: "t023", date: "2026-01-05", description: "Airbnb credit", details: "HMNZ3DJKAB – accommodation credit", category: "Accommodation", account: ACCOUNTS.VISA, amount: 9568.80, currency: "CAD" },
  { id: "t024", date: "2026-01-05", description: "Wix.com", details: "Website hosting", category: "Software & Subscriptions", account: ACCOUNTS.VISA, amount: -24.86, currency: "CAD" },
  { id: "t025", date: "2026-01-06", description: "Cash advance interest 22.99%", details: "", category: "Bank & Financing", account: ACCOUNTS.VISA, amount: -3.74, currency: "CAD" },
  { id: "t026", date: "2026-01-07", description: "Esso – Mattawa", details: "Fuel", category: "Fuel", account: ACCOUNTS.VISA, amount: -21.80, currency: "CAD" },
  { id: "t027", date: "2026-01-07", description: "Wilson's Builders Supply – Mattawa", details: "Supplies", category: "Supplies", account: ACCOUNTS.VISA, amount: -21.45, currency: "CAD" },
  { id: "t028", date: "2026-01-08", description: "X Corp. Paid Features", details: "about.x.com", category: "Marketing", account: ACCOUNTS.VISA, amount: -56.00, currency: "CAD" },
  { id: "t029", date: "2026-01-09", description: "Telus Mobility", details: "Preauth – Edmonton", category: "Communications", account: ACCOUNTS.VISA, amount: -437.93, currency: "CAD" },
  { id: "t030", date: "2026-01-10", description: "DocuSign", details: "E-signature platform", category: "Software & Subscriptions", account: ACCOUNTS.VISA, amount: -96.05, currency: "CAD" },
  { id: "t031", date: "2026-01-10", description: "Shell – Warren", details: "Fuel", category: "Fuel", account: ACCOUNTS.VISA, amount: -185.89, currency: "CAD" },
  { id: "t032", date: "2026-01-12", description: "Midjourney", details: "30.00 USD @ 1.427", category: "Software & Subscriptions", account: ACCOUNTS.VISA, amount: -42.81, currency: "CAD" },
  { id: "t033", date: "2026-01-12", description: "Intuit Mailchimp", details: "Email marketing", category: "Marketing", account: ACCOUNTS.VISA, amount: -41.90, currency: "CAD" },
  { id: "t034", date: "2026-01-13", description: "OpenAI ChatGPT", details: "22.60 USD @ 1.426548", category: "Software & Subscriptions", account: ACCOUNTS.VISA, amount: -32.24, currency: "CAD" },
  { id: "t035", date: "2026-01-17", description: "Scribbl.co", details: "156.00 USD @ 1.428012", category: "Software & Subscriptions", account: ACCOUNTS.VISA, amount: -222.77, currency: "CAD" },
  { id: "t036", date: "2026-01-19", description: "MacEwen – Mattawa", details: "Fuel", category: "Fuel", account: ACCOUNTS.VISA, amount: -198.84, currency: "CAD" },
  { id: "t037", date: "2026-01-20", description: "Bell Mobility", details: "Verdun", category: "Communications", account: ACCOUNTS.VISA, amount: -244.44, currency: "CAD" },
  { id: "t038", date: "2026-01-21", description: "Starlink Internet", details: "Halifax", category: "Communications", account: ACCOUNTS.VISA, amount: -158.20, currency: "CAD" },
  { id: "t039", date: "2026-01-22", description: "Home Depot – North Bay", details: "#7160", category: "Supplies", account: ACCOUNTS.VISA, amount: -808.16, currency: "CAD" },
  { id: "t040", date: "2026-01-24", description: "MacEwen – Mattawa", details: "Fuel", category: "Fuel", account: ACCOUNTS.VISA, amount: -204.43, currency: "CAD" },
  { id: "t041", date: "2026-01-24", description: "Shopify", details: "Online store", category: "Software & Subscriptions", account: ACCOUNTS.VISA, amount: -55.37, currency: "CAD" },
  { id: "t042", date: "2026-01-26", description: "Starlink Internet", details: "Halifax – hardware/setup", category: "Communications", account: ACCOUNTS.VISA, amount: -474.60, currency: "CAD" },
  { id: "t043", date: "2026-01-27", description: "Adobe Inc.", details: "San Jose", category: "Software & Subscriptions", account: ACCOUNTS.VISA, amount: -56.49, currency: "CAD" },
  { id: "t044", date: "2026-01-28", description: "Asad Dean, CPA", details: "Accounting & professional services", category: "Accounting & Legal", account: ACCOUNTS.VISA, amount: -960.50, currency: "CAD" },
  { id: "t045", date: "2026-01-28", description: "Apple.com / iCloud", details: "866-712-7753", category: "Software & Subscriptions", account: ACCOUNTS.VISA, amount: -14.68, currency: "CAD" },
  { id: "t046", date: "2026-01-28", description: "QuickBooks Online", details: "INTUIT *QBooks Online", category: "Software & Subscriptions", account: ACCOUNTS.VISA, amount: -107.35, currency: "CAD" },
  { id: "t047", date: "2026-01-30", description: "Microsoft Excel – Google", details: "GOOGLE*MICROSOFT EXCE", category: "Software & Subscriptions", account: ACCOUNTS.VISA, amount: -13.00, currency: "CAD" },
  { id: "t048", date: "2026-01-30", description: "Rolphton Esso", details: "Fuel", category: "Fuel", account: ACCOUNTS.VISA, amount: -83.62, currency: "CAD" },
  { id: "t049", date: "2026-01-31", description: "MacEwen – Seymour, North Bay", details: "Fuel", category: "Fuel", account: ACCOUNTS.VISA, amount: -189.31, currency: "CAD" },
  { id: "t050", date: "2026-02-01", description: "Google Ads", details: "GOOGLE*ADS8688472372", category: "Marketing", account: ACCOUNTS.VISA, amount: -78.44, currency: "CAD" },
  { id: "t051", date: "2026-02-02", description: "Adobe Inc.", details: "Monthly subscription", category: "Software & Subscriptions", account: ACCOUNTS.VISA, amount: -44.06, currency: "CAD" },
  { id: "t052", date: "2026-02-02", description: "Amazon Web Services", details: "aws.amazon.ca", category: "Software & Subscriptions", account: ACCOUNTS.VISA, amount: -515.80, currency: "CAD" },
  { id: "t053", date: "2026-02-03", description: "Printful – merchandise", details: "Order #1", category: "Marketing", account: ACCOUNTS.VISA, amount: -170.81, currency: "CAD" },
  { id: "t054", date: "2026-02-03", description: "Printful – merchandise", details: "Order #2", category: "Marketing", account: ACCOUNTS.VISA, amount: -441.84, currency: "CAD" },
  { id: "t055", date: "2026-02-04", description: "Corporate Filings LLC", details: "19.00 USD @ 1.403157", category: "Accounting & Legal", account: ACCOUNTS.VISA, amount: -26.66, currency: "CAD" },
  { id: "t056", date: "2026-02-05", description: "Corporate Filings LLC", details: "767.00 USD @ 1.402907", category: "Accounting & Legal", account: ACCOUNTS.VISA, amount: -1076.03, currency: "CAD" },
  { id: "t057", date: "2026-02-06", description: "Purchase interest 19.99%", details: "", category: "Bank & Financing", account: ACCOUNTS.VISA, amount: -162.94, currency: "CAD" },
  { id: "t058", date: "2026-02-06", description: "Cash advance interest 22.99%", details: "", category: "Bank & Financing", account: ACCOUNTS.VISA, amount: -5.79, currency: "CAD" },
  { id: "t059", date: "2026-02-07", description: "Telus Mobility", details: "Preauth – Edmonton", category: "Communications", account: ACCOUNTS.VISA, amount: -69.37, currency: "CAD" },
  { id: "t060", date: "2026-02-08", description: "X Corp. Paid Features", details: "about.x.com", category: "Marketing", account: ACCOUNTS.VISA, amount: -56.00, currency: "CAD" },
  { id: "t061", date: "2026-02-09", description: "Shopify", details: "Online store", category: "Software & Subscriptions", account: ACCOUNTS.VISA, amount: -76.76, currency: "CAD" },
  { id: "t062", date: "2026-02-10", description: "DocuSign", details: "E-signature platform", category: "Software & Subscriptions", account: ACCOUNTS.VISA, amount: -96.05, currency: "CAD" },
  { id: "t063", date: "2026-02-11", description: "MacEwen – Mattawa", details: "Fuel", category: "Fuel", account: ACCOUNTS.VISA, amount: -208.06, currency: "CAD" },
  { id: "t064", date: "2026-02-12", description: "Intuit Mailchimp", details: "Email marketing", category: "Marketing", account: ACCOUNTS.VISA, amount: -40.99, currency: "CAD" },
  { id: "t065", date: "2026-02-12", description: "Midjourney", details: "30.00 USD @ 1.396", category: "Software & Subscriptions", account: ACCOUNTS.VISA, amount: -41.88, currency: "CAD" },
  { id: "t066", date: "2026-02-13", description: "OpenAI ChatGPT", details: "22.60 USD @ 1.397787", category: "Software & Subscriptions", account: ACCOUNTS.VISA, amount: -31.59, currency: "CAD" },
  { id: "t067", date: "2026-02-19", description: "Bell Mobility", details: "Verdun", category: "Communications", account: ACCOUNTS.VISA, amount: -102.83, currency: "CAD" },
  { id: "t068", date: "2026-02-21", description: "Airbnb – crew accommodation", details: "HMHH4T59JA", category: "Accommodation", account: ACCOUNTS.VISA, amount: -394.24, currency: "CAD" },
  { id: "t069", date: "2026-02-21", description: "Starlink Internet", details: "Halifax", category: "Communications", account: ACCOUNTS.VISA, amount: -158.20, currency: "CAD" },
  { id: "t070", date: "2026-02-23", description: "Shopify", details: "Online store", category: "Software & Subscriptions", account: ACCOUNTS.VISA, amount: -55.37, currency: "CAD" },
  { id: "t071", date: "2026-02-25", description: "MacEwen – Mattawa", details: "Fuel", category: "Fuel", account: ACCOUNTS.VISA, amount: -205.11, currency: "CAD" },
  { id: "t072", date: "2026-02-26", description: "MacEwen – Mattawa", details: "Fuel", category: "Fuel", account: ACCOUNTS.VISA, amount: -23.54, currency: "CAD" },
  { id: "t073", date: "2026-02-26", description: "Starlink Internet", details: "Halifax – hardware/setup", category: "Communications", account: ACCOUNTS.VISA, amount: -474.60, currency: "CAD" },
];

const CATEGORY_COLORS: Record<ExpenseCategory, React.CSSProperties> = {
  "Payroll":                  { background: "rgba(139,92,246,0.12)",  color: "#8b5cf6" },
  "Software & Subscriptions": { background: "rgba(59,130,246,0.12)",  color: "var(--color-info)" },
  "Marketing":                { background: "rgba(236,72,153,0.12)",  color: "#ec4899" },
  "Communications":           { background: "rgba(6,182,212,0.12)",   color: "#06b6d4" },
  "Fuel":                     { background: "rgba(249,115,22,0.12)",  color: "#f97316" },
  "Supplies":                 { background: "rgba(234,179,8,0.12)",   color: "#ca8a04" },
  "Accommodation":            { background: "rgba(20,184,166,0.12)",  color: "#14b8a6" },
  "Bank & Financing":         { background: "rgba(100,116,139,0.12)", color: "#64748b" },
  "Accounting & Legal":       { background: "rgba(99,102,241,0.12)",  color: "#6366f1" },
  "Insurance":                { background: "rgba(57,222,139,0.12)",  color: "var(--color-primary)" },
  "Subcontractors":           { background: "rgba(251,183,0,0.12)",   color: "var(--color-warning)" },
  "Owner Draw":               { background: "rgba(244,63,94,0.12)",   color: "#f43f5e" },
  "Transfers":                { background: "rgba(168,85,247,0.12)",  color: "#a855f7" },
  "Revenue":                  { background: "rgba(57,222,139,0.15)",  color: "var(--color-primary)" },
  "Other":                    { background: "rgba(0,0,0,0.05)",       color: "var(--color-text-tertiary)" },
};

function fmt(amount: number, currency: "CAD" | "USD" = "CAD") {
  const abs = Math.abs(amount).toFixed(2);
  const sign = amount >= 0 ? "+" : "-";
  return `${sign}$${Number(abs).toLocaleString("en-CA", { minimumFractionDigits: 2 })} ${currency}`;
}

function fmtAbs(amount: number) {
  return `$${Math.abs(amount).toLocaleString("en-CA", { minimumFractionDigits: 2 })}`;
}

type Tab = "ledger" | "by-category" | "by-account" | "budget";
type BudgetSubTab = "overview" | "income" | "camp" | "non-camp";

// ── 2026 Budget Data (from 2026 Budget.xlsx) ─────────────────────────────────

const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// Planned totals by month (from Overall View sheet)
const B_PLANNED_INCOME   = [312361.04, 29600, 403924.67, 56320, 39760, 42280, 1630507.64, 6220, 6670, 7120, 49570, 8020];
// Actuals (Jan & Feb confirmed; rest = null)
const B_ACTUAL_INCOME    = [311767.62, 27373.61, null, null, null, null, null, null, null, null, null, null];
const B_ACTUAL_CAMP      = [0, 0, null, null, null, null, null, null, null, null, null, null];
const B_ACTUAL_NONCAMP   = [204208.81, 67125, null, null, null, null, null, null, null, null, null, null];

// Income sources (Income sheet)
const BUDGET_INCOME: { name: string; total: number; monthly: (number|null)[] }[] = [
  { name: "Ogoki",                        total: 955015.37, monthly: [186813.49, 0,     284760,    0,     0,     0,      441441.88, 0,    0,    0,    42000, 0    ] },
  { name: "Kenora",                       total: 470395.76, monthly: [112200,    22100,  51000,     51000, 0,     0,      234095.76, 0,    0,    0,    0,     0    ] },
  { name: "AFA",                          total: 192500,    monthly: [0,         0,      0,         0,     0,     0,      0,         192500, 0,  0,    0,     0    ] },
  { name: "Hearst",                       total: 350000,    monthly: [0,         0,      0,         0,     0,     0,      0,         350000, 0,  0,    0,     0    ] },
  { name: "Nagagami",                     total: 386925,    monthly: [0,         0,      0,         0,     0,     0,      0,         386925, 0,  0,    0,     0    ] },
  { name: "Bancroft",                     total: 7175,      monthly: [0,         0,      0,         0,     0,     0,      0,         7175,   0,  0,    0,     0    ] },
  { name: "Seedlings sold to ADLP",       total: 62844.67,  monthly: [0,         0,      62844.67,  0,     0,     0,      0,         0,    0,    0,    0,     0    ] },
  { name: "FRMG – Nagagami 2025",         total: 10207.55,  monthly: [5207.55,   5000,   0,         0,     0,     0,      0,         0,    0,    0,    0,     0    ] },
  { name: "Camp Cost Revenue",            total: 84000,     monthly: [0,         0,      0,         0,     34440, 36960,  12600,     0,    0,    0,    0,     0    ] },
  { name: "Brand Partners – Chilly Moose",total: 30000,     monthly: [2500,      2500,   2500,      2500,  2500,  2500,   2500,      2500, 2500, 2500, 2500,  2500 ] },
  { name: "David Joseph Loan Repayment",  total: 33840,     monthly: [5640,      0,      2820,      2820,  2820,  2820,   2820,      2820, 2820, 2820, 2820,  2820 ] },
  { name: "Shopify App",                  total: 9450,      monthly: [0,         0,      0,         0,     0,     0,      450,       900,  1350, 1800, 2250,  2700 ] },
];

// Camp expense lines (Camp Budget sheet — May/Jun/Jul driven)
const BUDGET_CAMP: { name: string; total: number; monthly: number[] }[] = [
  { name: "Tree Planter Wages",              total: 680034.03, monthly: [0, 0, 0, 0, 278813.95, 299214.97, 102005.10, 0, 0, 0, 0, 0] },
  { name: "Other Camp Wages (CBs/cooks)",    total: 150220.62, monthly: [0, 0, 0, 0, 61590.45, 66097.07, 22533.09, 0, 0, 0, 0, 0] },
  { name: "Employer Health Tax (2%)",        total: 16605.09,  monthly: [0, 0, 0, 0, 6808.09, 7306.24, 2490.76, 0, 0, 0, 0, 0] },
  { name: "WSIB (2.06%)",                    total: 17103.25,  monthly: [0, 0, 0, 0, 7012.33, 7525.43, 2565.49, 0, 0, 0, 0, 0] },
  { name: "CPP (5.95%)",                     total: 49400.15,  monthly: [0, 0, 0, 0, 20254.06, 21736.07, 7410.02, 0, 0, 0, 0, 0] },
  { name: "CPP2 (earners over $70K)",        total: 1188,      monthly: [0, 0, 0, 0, 487.08, 522.72, 178.20, 0, 0, 0, 0, 0] },
  { name: "EI (2.296%)",                     total: 24575.54,  monthly: [0, 0, 0, 0, 10075.97, 10813.24, 3686.33, 0, 0, 0, 0, 0] },
  { name: "Helicopter – Ogoki",              total: 50000,     monthly: [0, 0, 0, 0, 0, 0, 50000, 0, 0, 0, 0, 0] },
  { name: "Seedlings – Kenora Tamarack",     total: 27500,     monthly: [0, 5500, 0, 0, 22000, 0, 0, 0, 0, 0, 0, 0] },
  { name: "Seedlings – Kenora PRT",          total: 38023.93,  monthly: [0, 22814.36, 0, 0, 0, 15209.57, 0, 0, 0, 0, 0, 0] },
  { name: "Seedlings – Ogoki 2026 PRT",      total: 86620,     monthly: [0, 51972, 0, 0, 0, 34648, 0, 0, 0, 0, 0, 0] },
  { name: "Vehicle Rentals (6 trucks+2 vans)",total: 45000,    monthly: [0, 0, 0, 0, 18450, 19800, 6750, 0, 0, 0, 0, 0] },
  { name: "Generator Rental",                total: 7361,      monthly: [0, 0, 0, 0, 3018.01, 3238.84, 1104.15, 0, 0, 0, 0, 0] },
  { name: "Reefer Rental",                   total: 22500,     monthly: [0, 0, 0, 0, 9225, 9900, 3375, 0, 0, 0, 0, 0] },
  { name: "Trucking",                        total: 15000,     monthly: [0, 0, 0, 0, 6150, 6600, 2250, 0, 0, 0, 0, 0] },
  { name: "Fuel (camp vehicles)",            total: 27500,     monthly: [0, 0, 0, 0, 11275, 12100, 4125, 0, 0, 0, 0, 0] },
  { name: "Hotels",                          total: 2000,      monthly: [0, 0, 0, 0, 820, 880, 300, 0, 0, 0, 0, 0] },
  { name: "Vehicle Maintenance & Repair",    total: 8000,      monthly: [0, 0, 0, 0, 3280, 3520, 1200, 0, 0, 0, 0, 0] },
  { name: "First Aid Supplies",              total: 500,       monthly: [0, 0, 0, 500, 0, 0, 0, 0, 0, 0, 0, 0] },
  { name: "Camp Repairs",                    total: 4500,      monthly: [0, 1125, 1125, 1125, 1125, 0, 0, 0, 0, 0, 0, 0] },
  { name: "Merch for Staff",                 total: 3000,      monthly: [0, 0, 3000, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  { name: "Radio Rentals",                   total: 3800,      monthly: [0, 0, 0, 0, 1266.67, 1266.67, 1266.67, 0, 0, 0, 0, 0] },
  { name: "Starlink & Bell & Telus (camp)",  total: 4500,      monthly: [0, 0, 0, 0, 1500, 1500, 1500, 0, 0, 0, 0, 0] },
  { name: "General Liability Insurance",     total: 18000,     monthly: [0, 0, 0, 0, 6000, 6000, 6000, 0, 0, 0, 0, 0] },
  { name: "Camp Food",                       total: 39000,     monthly: [0, 0, 0, 0, 15990, 17160, 5850, 0, 0, 0, 0, 0] },
  { name: "Overclaim / Min Wage Topups",     total: 4000,      monthly: [0, 0, 0, 0, 1640, 1760, 600, 0, 0, 0, 0, 0] },
  { name: "ADP Fees",                        total: 2500,      monthly: [0, 0, 0, 0, 1025, 1100, 375, 0, 0, 0, 0, 0] },
  { name: "Trailer Safety",                  total: 6000,      monthly: [0, 0, 0, 0, 6000, 0, 0, 0, 0, 0, 0, 0] },
];

// Non-camp expense lines (Non-camp budget sheet)
const BUDGET_NONCAMP: { name: string; category: string; total: number; monthly: number[] }[] = [
  { name: "Monica – Commission",       category: "Payroll",     total: 109023.34, monthly: [21105.94, 17153.93, 15390.83, 3745, 175, 175, 47462.63, 175, 175, 175, 3115, 175] },
  { name: "Monica – Salary",           category: "Payroll",     total: 62925,     monthly: [5400, 5400, 3510, 5401, 5400, 5402, 5400, 5403, 5400, 5404, 5400, 5405] },
  { name: "Matt – Salary",             category: "Payroll",     total: 174750,    monthly: [15000, 15000, 9750, 15000, 15000, 15000, 15000, 15000, 15000, 15000, 15000, 15000] },
  { name: "Vanessa – Salary",          category: "Payroll",     total: 46615,     monthly: [4000, 4000, 2600, 4001, 4000, 4002, 4000, 4003, 4000, 4004, 4000, 4005] },
  { name: "Chuck – Salary",            category: "Payroll",     total: 74305,     monthly: [7700, 7700, 5005, 7700, 7700, 7700, 7700, 7700, 7700, 7700, 0, 0] },
  { name: "EHT on Salaries (2%)",      category: "Payroll",     total: 9352.37,   monthly: [1064.12, 985.08, 725.12, 716.94, 645.50, 645.58, 1591.25, 645.62, 645.50, 645.66, 550.30, 491.70] },
  { name: "WSIB on Salaries (2.06%)",  category: "Payroll",     total: 9632.94,   monthly: [1096.04, 1014.63, 746.87, 738.45, 664.87, 664.95, 1638.99, 664.99, 664.87, 665.03, 566.81, 506.45] },
  { name: "CPP on Salaries (5.95%)",   category: "Payroll",     total: 27823.29,  monthly: [3165.75, 2930.61, 2157.22, 2132.90, 1920.36, 1920.60, 4733.98, 1920.72, 1920.36, 1920.84, 1637.14, 1462.81] },
  { name: "EI on Salaries (2.296%)",   category: "Payroll",     total: 13841.50,  monthly: [1574.90, 1457.92, 1073.17, 1061.07, 955.34, 955.46, 2355.05, 955.52, 955.34, 955.58, 814.44, 727.72] },
  { name: "Matt – Dividends",          category: "Dividends",   total: 60000,     monthly: [5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000] },
  { name: "Google Ads",                category: "Marketing",   total: 936,       monthly: [78, 78, 78, 78, 78, 78, 78, 78, 78, 78, 78, 78] },
  { name: "Mailchimp",                 category: "Marketing",   total: 504,       monthly: [42, 42, 42, 42, 42, 42, 42, 42, 42, 42, 42, 42] },
  { name: "Banking Fees",              category: "Bank",        total: 960,       monthly: [80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80] },
  { name: "Matt's Truck – Fuel",       category: "Fuel",        total: 13200,     monthly: [1100, 1100, 1100, 1100, 1100, 1100, 1100, 1100, 1100, 1100, 1100, 1100] },
  { name: "Starlink (7+2 satellites)", category: "IT",          total: 10820.88,  monthly: [474.60, 474.60, 474.60, 474.60, 2183.16, 2183.16, 2183.16, 474.60, 474.60, 474.60, 474.60, 474.60] },
  { name: "Apple iCloud",              category: "IT",          total: 176.16,    monthly: [14.68, 14.68, 14.68, 14.68, 14.68, 14.68, 14.68, 14.68, 14.68, 14.68, 14.68, 14.68] },
  { name: "Wix Hosting",               category: "IT",          total: 300,       monthly: [25, 25, 25, 25, 25, 25, 25, 25, 25, 25, 25, 25] },
  { name: "Amazon Web Services",       category: "IT",          total: 6180,      monthly: [515, 515, 515, 515, 515, 515, 515, 515, 515, 515, 515, 515] },
  { name: "Shopify Store Fees",        category: "IT",          total: 892.34,    monthly: [55.37, 131.37, 55.37, 55.37, 55.37, 55.37, 55.37, 55.37, 55.37, 55.37, 55.37, 207.27] },
  { name: "Shopify App Hosting",       category: "IT",          total: 1950,      monthly: [0, 50, 50, 50, 50, 250, 250, 250, 250, 250, 250, 250] },
  { name: "Adobe Creative Cloud",      category: "Software",    total: 528.72,    monthly: [44.06, 44.06, 44.06, 44.06, 44.06, 44.06, 44.06, 44.06, 44.06, 44.06, 44.06, 44.06] },
  { name: "DocuSign",                  category: "Software",    total: 1152.60,   monthly: [96.05, 96.05, 96.05, 96.05, 96.05, 96.05, 96.05, 96.05, 96.05, 96.05, 96.05, 96.05] },
  { name: "Microsoft / Excel",         category: "Software",    total: 312,       monthly: [26, 26, 26, 26, 26, 26, 26, 26, 26, 26, 26, 26] },
  { name: "Midjourney AI",             category: "Software",    total: 528,       monthly: [44, 44, 44, 44, 44, 44, 44, 44, 44, 44, 44, 44] },
  { name: "OpenAI ChatGPT",            category: "Software",    total: 780,       monthly: [65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65] },
  { name: "Telus & Bell Phones",       category: "Phone",       total: 1985.04,   monthly: [165.42, 165.42, 165.42, 165.42, 165.42, 165.42, 165.42, 165.42, 165.42, 165.42, 165.42, 165.42] },
  { name: "Accounting (Asad + QBooks)",category: "Accounting",  total: 12625.80,  monthly: [1050.90, 1050.90, 1050.90, 1051.90, 1050.90, 1052.90, 1050.90, 1053.90, 1050.90, 1054.90, 1050.90, 1055.90] },
  { name: "Project Development Travel",category: "Travel",      total: 10000,     monthly: [0, 0, 0, 0, 0, 10000, 0, 0, 0, 0, 0, 0] },
  { name: "Insurance – Truck (Gore)",  category: "Insurance",   total: 2064,      monthly: [172, 172, 172, 172, 172, 172, 172, 172, 172, 172, 172, 172] },
  { name: "Truck Loan",                category: "Financing",   total: 11880,     monthly: [990, 990, 990, 990, 990, 990, 990, 990, 990, 990, 990, 990] },
  { name: "Corporate Tax – 2025 Bill", category: "Taxes",       total: 153000,    monthly: [0, 0, 153000, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  { name: "HST (13% quarterly)",       category: "Taxes",       total: 367005.94, monthly: [30000, 0, 84251.48, 0, 0, 84251.48, 0, 0, 84251.48, 0, 0, 84251.48] },
  { name: "Shopify App Development",   category: "Development", total: 14322.75,  monthly: [0, 4296.83, 7161.38, 2864.55, 0, 0, 0, 0, 0, 0, 0, 0] },
  { name: "Webdesk Tech Support",      category: "Development", total: 7910,      monthly: [0, 1130, 0, 0, 0, 1130, 1130, 1130, 1130, 1130, 1130, 0] },
];

// Computed from detail arrays — ensures Overview monthly totals match sub-tabs exactly
const B_PLANNED_CAMP    = Array.from({length:12},(_,i)=>BUDGET_CAMP.reduce((s,r)=>s+r.monthly[i],0));
const B_PLANNED_NONCAMP = Array.from({length:12},(_,i)=>BUDGET_NONCAMP.reduce((s,r)=>s+r.monthly[i],0));

interface EditState {
  id: string;
  date: string;
  description: string;
  details: string;
  category: ExpenseCategory;
  account: string;
  amount: string;
  currency: "CAD" | "USD";
  project: string;
  equipment: string;
  employee: string;
}

interface AddState {
  date: string;
  description: string;
  details: string;
  category: ExpenseCategory;
  account: string;
  amount: string;
  currency: "CAD" | "USD";
  type: "expense" | "income";
  project: string;
  equipment: string;
  employee: string;
}

export default function AccountingCenter() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  useEffect(() => {
    getAllRecords<Transaction>("transactions").then(saved => {
      if (saved.length === 0) {
        // First run: seed with real historical data
        Promise.all(INITIAL_TRANSACTIONS.map(t => saveRecord("transactions", t)));
        setTransactions(INITIAL_TRANSACTIONS);
      } else {
        setTransactions(saved);
      }
    });
  }, []);
  const [tab, setTab] = useState<Tab>("ledger");
  const [budgetSubTab, setBudgetSubTab] = useState<BudgetSubTab>("overview");
  const [accountFilter, setAccountFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [editState, setEditState] = useState<EditState | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [addState, setAddState] = useState<AddState>({
    date: "", description: "", details: "", category: "Other",
    account: ACCOUNTS.VISA, amount: "", currency: "CAD", type: "expense",
    project: "", equipment: "", employee: "",
  });

  const allAccounts = useMemo(() => Object.values(ACCOUNTS), []);

  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      if (accountFilter !== "all" && t.account !== accountFilter) return false;
      if (categoryFilter !== "all" && t.category !== categoryFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!t.description.toLowerCase().includes(q) && !t.details.toLowerCase().includes(q)) return false;
      }
      return true;
    }).sort((a, b) => b.date.localeCompare(a.date));
  }, [transactions, accountFilter, categoryFilter, search]);

  // KPI — CAD only for simplicity, USD flagged separately
  const cadTx = useMemo(() => filtered.filter(t => t.currency === "CAD"), [filtered]);
  const totalIncome = useMemo(() => cadTx.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0), [cadTx]);
  const totalExpenses = useMemo(() => cadTx.filter(t => t.amount < 0).reduce((s, t) => s + t.amount, 0), [cadTx]);
  const net = totalIncome + totalExpenses;

  // By-category aggregation
  const byCategory = useMemo(() => {
    const map: Record<string, { income: number; expenses: number; count: number }> = {};
    filtered.forEach((t) => {
      if (!map[t.category]) map[t.category] = { income: 0, expenses: 0, count: 0 };
      map[t.category].count++;
      if (t.amount > 0) map[t.category].income += t.amount;
      else map[t.category].expenses += t.amount;
    });
    return Object.entries(map).sort((a, b) => Math.abs(b[1].expenses) - Math.abs(a[1].expenses));
  }, [filtered]);

  // By-account aggregation
  const byAccount = useMemo(() => {
    const map: Record<string, { income: number; expenses: number; count: number; currencies: Set<string> }> = {};
    filtered.forEach((t) => {
      if (!map[t.account]) map[t.account] = { income: 0, expenses: 0, count: 0, currencies: new Set() };
      map[t.account].count++;
      map[t.account].currencies.add(t.currency);
      if (t.amount > 0) map[t.account].income += t.amount;
      else map[t.account].expenses += t.amount;
    });
    return Object.entries(map);
  }, [filtered]);

  const openEdit = useCallback((t: Transaction) => {
    setEditState({
      id: t.id,
      date: t.date,
      description: t.description,
      details: t.details,
      category: t.category,
      account: t.account,
      amount: String(Math.abs(t.amount)),
      currency: t.currency,
      project: t.project ?? "",
      equipment: t.equipment ?? "",
      employee: t.employee ?? "",
    });
  }, []);

  const saveEdit = useCallback(() => {
    if (!editState) return;
    const orig = transactions.find(t => t.id === editState.id);
    if (!orig) return;
    const sign = orig.amount < 0 ? -1 : 1;
    const newAmount = parseFloat(editState.amount) * sign;
    setTransactions(prev =>
      prev.map(t => {
        if (t.id !== editState.id) return t;
        const updated = { ...t, date: editState.date, description: editState.description, details: editState.details, category: editState.category, account: editState.account, amount: newAmount, currency: editState.currency, project: editState.project || undefined, equipment: editState.equipment || undefined, employee: editState.employee || undefined };
        saveRecord("transactions", updated);
        return updated;
      })
    );
    setEditState(null);
  }, [editState, transactions]);

  const deleteTransaction = useCallback((id: string) => {
    setTransactions(prev => prev.filter(t => t.id !== id));
    deleteRecord("transactions", id);
  }, []);

  const saveAdd = useCallback(() => {
    if (!addState.date || !addState.description || !addState.amount) return;
    const rawAmount = parseFloat(addState.amount);
    const amount = addState.type === "expense" ? -Math.abs(rawAmount) : Math.abs(rawAmount);
    const newTx: Transaction = {
      id: `t${Date.now()}`,
      date: addState.date,
      description: addState.description,
      details: addState.details,
      category: addState.category,
      account: addState.account,
      amount,
      currency: addState.currency,
      project: addState.project || undefined,
      equipment: addState.equipment || undefined,
      employee: addState.employee || undefined,
    };
    setTransactions(prev => [...prev, newTx]);
    saveRecord("transactions", newTx);
    setShowAdd(false);
    setAddState({ date: "", description: "", details: "", category: "Other", account: ACCOUNTS.VISA, amount: "", currency: "CAD", type: "expense", project: "", equipment: "", employee: "" });
  }, [addState]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">

      {/* KPI row */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Total Income (CAD)", value: fmtAbs(totalIncome), cssColor: "var(--color-primary)" },
          { label: "Total Expenses (CAD)", value: fmtAbs(Math.abs(totalExpenses)), cssColor: "var(--color-danger)" },
          { label: "Net (CAD)", value: fmtAbs(Math.abs(net)), cssColor: net >= 0 ? "var(--color-primary)" : "var(--color-danger)" },
          { label: "Transactions", value: String(filtered.length), cssColor: "var(--color-text-primary)" },
        ].map(kpi => (
          <div key={kpi.label} className="bg-surface rounded-xl border border-border p-4">
            <div className="text-[10px] uppercase tracking-widest text-text-tertiary font-semibold mb-1">{kpi.label}</div>
            <div className="text-xl font-bold tabular-nums" style={{ color: kpi.cssColor }}>{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Tabs */}
        <div className="flex bg-surface-secondary rounded-lg border border-border p-0.5 gap-0.5">
          {(["ledger", "by-category", "by-account", "budget"] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                tab === t ? "bg-surface text-text-primary shadow-sm border border-border" : "text-text-tertiary hover:text-text-secondary"
              }`}
            >
              {t === "ledger" ? "Ledger" : t === "by-category" ? "By Category" : t === "by-account" ? "By Account" : "2026 Budget"}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        {/* Search */}
        <input
          type="text"
          placeholder="Search…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="px-3 py-1.5 text-xs bg-surface border border-border rounded-lg w-40 text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
        />

        {/* Account filter */}
        <select
          value={accountFilter}
          onChange={e => setAccountFilter(e.target.value)}
          className="px-3 py-1.5 text-xs bg-surface border border-border rounded-lg text-text-primary focus:outline-none focus:border-primary/50"
        >
          <option value="all">All Accounts</option>
          {allAccounts.map(a => <option key={a} value={a}>{a}</option>)}
        </select>

        {/* Category filter */}
        <select
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
          className="px-3 py-1.5 text-xs bg-surface border border-border rounded-lg text-text-primary focus:outline-none focus:border-primary/50"
        >
          <option value="all">All Categories</option>
          {ALL_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        {/* Add */}
        <button
          onClick={() => setShowAdd(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg hover:opacity-90 transition-all" style={{ background: "var(--color-primary)", color: "var(--color-primary-deep)" }}
        >
          <span className="text-[10px]">+</span>
          Add Entry
        </button>
      </div>

      {/* Ledger tab */}
      {tab === "ledger" && (
        <div className="bg-surface rounded-xl border border-border overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-surface-secondary">
                <th className="text-left px-4 py-2.5 font-semibold text-text-tertiary">Date</th>
                <th className="text-left px-4 py-2.5 font-semibold text-text-tertiary">Description</th>
                <th className="text-left px-4 py-2.5 font-semibold text-text-tertiary">Category</th>
                <th className="text-left px-4 py-2.5 font-semibold text-text-tertiary">Employee</th>
                <th className="text-left px-4 py-2.5 font-semibold text-text-tertiary">Project</th>
                <th className="text-left px-4 py-2.5 font-semibold text-text-tertiary">Equipment</th>
                <th className="text-left px-4 py-2.5 font-semibold text-text-tertiary">Account</th>
                <th className="text-right px-4 py-2.5 font-semibold text-text-tertiary">Amount</th>
                <th className="px-4 py-2.5 w-16" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((t, i) => (
                <tr key={t.id} className={`border-b border-border/50 hover:bg-surface-secondary/50 transition-colors ${i % 2 === 0 ? "" : "bg-surface-secondary/20"}`}>
                  <td className="px-4 py-2.5 text-text-tertiary whitespace-nowrap">{t.date}</td>
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-text-primary">{t.description}</div>
                    {t.details && <div className="text-text-tertiary mt-0.5">{t.details}</div>}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium" style={CATEGORY_COLORS[t.category]}>
                      {t.category}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-text-tertiary">{t.employee || <span className="opacity-30">—</span>}</td>
                  <td className="px-4 py-2.5 text-text-tertiary">{t.project || <span className="opacity-30">—</span>}</td>
                  <td className="px-4 py-2.5 text-text-tertiary">{t.equipment || <span className="opacity-30">—</span>}</td>
                  <td className="px-4 py-2.5 text-text-tertiary whitespace-nowrap">{t.account}</td>
                  <td className="px-4 py-2.5 text-right font-mono font-semibold whitespace-nowrap" style={{ color: t.amount >= 0 ? "var(--color-primary)" : "var(--color-text-primary)" }}>
                    {fmt(t.amount, t.currency)}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openEdit(t)}
                        className="w-6 h-6 flex items-center justify-center rounded text-text-tertiary hover:text-text-primary hover:bg-surface-secondary transition-colors"
                        title="Edit"
                      >
                        ✎
                      </button>
                      <button
                        onClick={() => deleteTransaction(t.id)}
                        className="w-6 h-6 flex items-center justify-center rounded text-text-tertiary hover:text-danger hover:bg-danger/10 transition-colors"
                        title="Delete"
                      >
                        ×
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-text-tertiary">No transactions match your filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* By-category tab */}
      {tab === "by-category" && (
        <div className="bg-surface rounded-xl border border-border overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-surface-secondary">
                <th className="text-left px-4 py-2.5 font-semibold text-text-tertiary">Category</th>
                <th className="text-right px-4 py-2.5 font-semibold text-text-tertiary"># Transactions</th>
                <th className="text-right px-4 py-2.5 font-semibold text-text-tertiary">Income</th>
                <th className="text-right px-4 py-2.5 font-semibold text-text-tertiary">Expenses</th>
                <th className="text-right px-4 py-2.5 font-semibold text-text-tertiary">Net</th>
              </tr>
            </thead>
            <tbody>
              {byCategory.map(([cat, data]) => (
                <tr key={cat} className="border-b border-border/50 hover:bg-surface-secondary/50 transition-colors">
                  <td className="px-4 py-3">
                    <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium" style={CATEGORY_COLORS[cat as ExpenseCategory]}>
                      {cat}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-text-tertiary">{data.count}</td>
                  <td className="px-4 py-3 text-right font-mono" style={{ color: "var(--color-primary)" }}>
                    {data.income > 0 ? fmtAbs(data.income) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-text-primary">
                    {data.expenses < 0 ? fmtAbs(Math.abs(data.expenses)) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-semibold" style={{ color: (data.income + data.expenses) >= 0 ? "var(--color-primary)" : "var(--color-danger)" }}>
                    {fmtAbs(Math.abs(data.income + data.expenses))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* By-account tab */}
      {tab === "by-account" && (
        <div className="bg-surface rounded-xl border border-border overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-surface-secondary">
                <th className="text-left px-4 py-2.5 font-semibold text-text-tertiary">Account</th>
                <th className="text-right px-4 py-2.5 font-semibold text-text-tertiary"># Transactions</th>
                <th className="text-right px-4 py-2.5 font-semibold text-text-tertiary">Income</th>
                <th className="text-right px-4 py-2.5 font-semibold text-text-tertiary">Expenses</th>
                <th className="text-right px-4 py-2.5 font-semibold text-text-tertiary">Net</th>
              </tr>
            </thead>
            <tbody>
              {byAccount.map(([account, data]) => (
                <tr key={account} className="border-b border-border/50 hover:bg-surface-secondary/50 transition-colors">
                  <td className="px-4 py-3 font-medium text-text-primary">
                    {account}
                    {data.currencies.has("USD") && data.currencies.has("CAD") && (
                      <span className="ml-2 text-[10px] text-text-tertiary">mixed currency</span>
                    )}
                    {data.currencies.size === 1 && data.currencies.has("USD") && (
                      <span className="ml-2 text-[10px] bg-yellow-500/10 text-yellow-400 px-1.5 py-0.5 rounded-full">USD</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-text-tertiary">{data.count}</td>
                  <td className="px-4 py-3 text-right font-mono" style={{ color: "var(--color-primary)" }}>
                    {data.income > 0 ? fmtAbs(data.income) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-text-primary">
                    {data.expenses < 0 ? fmtAbs(Math.abs(data.expenses)) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-semibold" style={{ color: (data.income + data.expenses) >= 0 ? "var(--color-primary)" : "var(--color-danger)" }}>
                    {fmtAbs(Math.abs(data.income + data.expenses))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Budget tab */}
      {tab === "budget" && (
        <div className="space-y-4">
          {/* Budget sub-tabs */}
          <div className="flex gap-1 bg-surface-secondary border border-border rounded-lg p-0.5 w-fit">
            {(["overview","income","camp","non-camp"] as BudgetSubTab[]).map(st => (
              <button key={st} onClick={() => setBudgetSubTab(st)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  budgetSubTab === st ? "bg-surface text-text-primary shadow-sm border border-border" : "text-text-tertiary hover:text-text-secondary"
                }`}>
                {st === "overview" ? "Overview" : st === "income" ? "Income" : st === "camp" ? "Camp Expenses" : "Non-Camp Expenses"}
              </button>
            ))}
          </div>

          {/* ── Overview ── */}
          {budgetSubTab === "overview" && (() => {
            const rows = [
              { label: "Planned Income",    planned: B_PLANNED_INCOME, actual: B_ACTUAL_INCOME,   isIncome: true },
              { label: "Planned Camp Exp.", planned: B_PLANNED_CAMP,   actual: B_ACTUAL_CAMP,     isIncome: false },
              { label: "Planned Non-Camp",  planned: B_PLANNED_NONCAMP,actual: B_ACTUAL_NONCAMP,  isIncome: false },
            ];
            const planTotals = MONTHS_SHORT.map((_,i) => B_PLANNED_INCOME[i] - B_PLANNED_CAMP[i] - B_PLANNED_NONCAMP[i]);
            const actTotals  = MONTHS_SHORT.map((_,i) => {
              const ai = B_ACTUAL_INCOME[i]; const ac = B_ACTUAL_CAMP[i]; const an = B_ACTUAL_NONCAMP[i];
              if (ai === null && ac === null && an === null) return null;
              return (ai ?? 0) - (ac ?? 0) - (an ?? 0);
            });
            const annualPlanIncome = B_PLANNED_INCOME.reduce((s,v)=>s+v,0);
            const annualPlanCamp   = B_PLANNED_CAMP.reduce((s,v)=>s+v,0);
            const annualPlanNC     = B_PLANNED_NONCAMP.reduce((s,v)=>s+v,0);
            const annualBalance    = annualPlanIncome - annualPlanCamp - annualPlanNC;
            return (
              <div className="space-y-4">
                {/* Annual KPIs */}
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { label: "Annual Revenue Target", value: annualPlanIncome, color: "text-emerald-400" },
                    { label: "Camp Expenses Budget",   value: annualPlanCamp,   color: "text-rose-400" },
                    { label: "Non-Camp Expenses",      value: annualPlanNC,     color: "text-rose-400" },
                    { label: "Projected Net Balance",  value: annualBalance,    color: annualBalance >= 0 ? "text-emerald-400" : "text-rose-400" },
                  ].map(k => (
                    <div key={k.label} className="bg-surface border border-border rounded-xl p-4">
                      <div className="text-[10px] uppercase tracking-widest font-semibold text-text-tertiary">{k.label}</div>
                      <div className={`text-xl font-bold mt-1 ${k.color}`}>${Math.abs(k.value).toLocaleString("en-CA",{minimumFractionDigits:0,maximumFractionDigits:0})}</div>
                    </div>
                  ))}
                </div>

                {/* Jan notes */}
                <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl px-5 py-3 text-xs text-amber-300 space-y-0.5">
                  <div className="font-semibold text-amber-200">January Analysis — Over budget by $104,064</div>
                  <div className="text-text-tertiary">Key items: Ogoki 2025 seedlings $38K, Ogoki 2026 seedlings $43K, Storage fees $33.9K, Commercial taxes $30K, Brandon Wright payroll $1.8K</div>
                </div>
                <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl px-5 py-3 text-xs text-emerald-300 space-y-0.5">
                  <div className="font-semibold text-emerald-200">February Analysis — Under budget by $5,233</div>
                  <div className="text-text-tertiary">Accounting not billed ($1,051), Matt skipped dividends ($5,000), fuel under ($600), camp repairs deferred ($1,125). Over on Starlink ($148).</div>
                </div>

                {/* Monthly overview table */}
                <div className="bg-surface border border-border rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs min-w-[1100px]">
                      <thead>
                        <tr className="border-b border-border bg-surface-secondary">
                          <th className="text-left px-4 py-2.5 font-semibold text-text-tertiary sticky left-0 bg-surface-secondary z-10 min-w-[160px]">Line</th>
                          <th className="text-right px-3 py-2.5 font-semibold text-text-tertiary min-w-[90px]">Year Total</th>
                          {MONTHS_SHORT.map(m => <th key={m} className="text-right px-3 py-2.5 font-semibold text-text-tertiary whitespace-nowrap">{m}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map(row => {
                          const yearTotal = row.planned.reduce((s,v)=>s+v,0);
                          return (
                            <React.Fragment key={row.label}>
                              {/* Planned */}
                              <tr className="border-b border-border/40">
                                <td className="px-4 py-2 text-text-primary font-medium sticky left-0 bg-surface z-10 whitespace-nowrap">{row.label}</td>
                                <td className="px-3 py-2 text-right font-semibold text-text-primary whitespace-nowrap">${yearTotal.toLocaleString("en-CA",{maximumFractionDigits:0})}</td>
                                {row.planned.map((v,i) => (
                                  <td key={i} className="px-3 py-2 text-right text-text-secondary whitespace-nowrap">{v > 0 ? `$${v.toLocaleString("en-CA",{maximumFractionDigits:0})}` : <span className="opacity-20">—</span>}</td>
                                ))}
                              </tr>
                              {/* Actual (where available) */}
                              <tr className="border-b border-border/60 bg-surface-secondary/10">
                                <td className="px-4 py-1.5 text-[11px] text-text-tertiary sticky left-0 bg-surface-secondary/10 z-10 pl-8">↳ Actual</td>
                                <td className="px-3 py-1.5 text-right text-[11px] text-text-tertiary">
                                  {row.actual.some(v => v !== null) ? `$${(row.actual.reduce((s:number,v)=>s+(v??0),0)).toLocaleString("en-CA",{maximumFractionDigits:0})}` : "—"}
                                </td>
                                {row.actual.map((v,i) => {
                                  if (v === null) return <td key={i} className="px-3 py-1.5 text-right text-[11px] text-text-tertiary opacity-20">—</td>;
                                  const plan = row.planned[i];
                                  const variance = row.isIncome ? v - plan : plan - v;
                                  const varColor = variance >= 0 ? "text-emerald-400" : "text-rose-400";
                                  return (
                                    <td key={i} className="px-3 py-1.5 text-right text-[11px] whitespace-nowrap">
                                      <div className="text-text-secondary">${v.toLocaleString("en-CA",{maximumFractionDigits:0})}</div>
                                      <div className={`text-[10px] ${varColor}`}>{variance >= 0 ? "+" : ""}{variance.toLocaleString("en-CA",{maximumFractionDigits:0})}</div>
                                    </td>
                                  );
                                })}
                              </tr>
                            </React.Fragment>
                          );
                        })}
                        {/* Balance rows */}
                        <tr className="border-b border-border bg-surface-secondary/30 font-semibold">
                          <td className="px-4 py-2.5 text-text-primary sticky left-0 bg-surface-secondary/30 z-10">Planned Balance</td>
                          <td className="px-3 py-2.5 text-right whitespace-nowrap" style={{color: annualBalance >= 0 ? "#34d399" : "#f87171"}}>
                            ${annualBalance.toLocaleString("en-CA",{maximumFractionDigits:0})}
                          </td>
                          {planTotals.map((v,i) => (
                            <td key={i} className={`px-3 py-2.5 text-right whitespace-nowrap ${v >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                              {v !== 0 ? `$${v.toLocaleString("en-CA",{maximumFractionDigits:0})}` : <span className="opacity-20">—</span>}
                            </td>
                          ))}
                        </tr>
                        <tr className="border-b border-border/40 bg-surface-secondary/10">
                          <td className="px-4 py-2 text-[11px] text-text-tertiary sticky left-0 bg-surface-secondary/10 z-10 pl-8">↳ Actual Balance</td>
                          <td className="px-3 py-2 text-right text-[11px] text-text-tertiary">
                            {actTotals.some(v=>v!==null) ? `$${(actTotals.reduce((s:number,v)=>s+(v??0),0)).toLocaleString("en-CA",{maximumFractionDigits:0})}` : "—"}
                          </td>
                          {actTotals.map((v,i) => v === null
                            ? <td key={i} className="px-3 py-2 text-right text-[11px] opacity-20">—</td>
                            : <td key={i} className={`px-3 py-2 text-right text-[11px] font-semibold whitespace-nowrap ${v >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                                ${v.toLocaleString("en-CA",{maximumFractionDigits:0})}
                              </td>
                          )}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ── Income Sources ── */}
          {budgetSubTab === "income" && (
            <div className="bg-surface border border-border rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs min-w-[1100px]">
                  <thead>
                    <tr className="border-b border-border bg-surface-secondary">
                      <th className="text-left px-4 py-2.5 font-semibold text-text-tertiary sticky left-0 bg-surface-secondary z-10 min-w-[220px]">Revenue Source</th>
                      <th className="text-right px-3 py-2.5 font-semibold text-text-tertiary min-w-[90px]">Year Total</th>
                      {MONTHS_SHORT.map(m => <th key={m} className="text-right px-3 py-2.5 font-semibold text-text-tertiary whitespace-nowrap">{m}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {BUDGET_INCOME.map(row => (
                      <tr key={row.name} className="border-b border-border/40 hover:bg-surface-secondary/40">
                        <td className="px-4 py-2.5 font-medium text-text-primary sticky left-0 bg-surface z-10 whitespace-nowrap">{row.name}</td>
                        <td className="px-3 py-2.5 text-right font-semibold text-emerald-400 whitespace-nowrap">${row.total.toLocaleString("en-CA",{maximumFractionDigits:0})}</td>
                        {row.monthly.map((v,i) => (
                          <td key={i} className="px-3 py-2.5 text-right text-text-secondary whitespace-nowrap">
                            {v && v > 0 ? `$${v.toLocaleString("en-CA",{maximumFractionDigits:0})}` : <span className="opacity-20">—</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                    {/* Total row */}
                    <tr className="bg-surface-secondary/40 font-semibold border-t border-border">
                      <td className="px-4 py-2.5 text-text-primary sticky left-0 bg-surface-secondary/40 z-10">Total</td>
                      <td className="px-3 py-2.5 text-right text-emerald-400">${BUDGET_INCOME.reduce((s,r)=>s+r.total,0).toLocaleString("en-CA",{maximumFractionDigits:0})}</td>
                      {MONTHS_SHORT.map((_,i) => {
                        const tot = BUDGET_INCOME.reduce((s,r)=>s+(r.monthly[i] ?? 0),0);
                        return <td key={i} className="px-3 py-2.5 text-right text-emerald-400 whitespace-nowrap">{tot > 0 ? `$${tot.toLocaleString("en-CA",{maximumFractionDigits:0})}` : <span className="opacity-20">—</span>}</td>;
                      })}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Camp Expenses ── */}
          {budgetSubTab === "camp" && (
            <div className="bg-surface border border-border rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs min-w-[1100px]">
                  <thead>
                    <tr className="border-b border-border bg-surface-secondary">
                      <th className="text-left px-4 py-2.5 font-semibold text-text-tertiary sticky left-0 bg-surface-secondary z-10 min-w-[260px]">Expense Line</th>
                      <th className="text-right px-3 py-2.5 font-semibold text-text-tertiary min-w-[90px]">Year Total</th>
                      {MONTHS_SHORT.map(m => <th key={m} className="text-right px-3 py-2.5 font-semibold text-text-tertiary whitespace-nowrap">{m}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {BUDGET_CAMP.map(row => (
                      <tr key={row.name} className="border-b border-border/40 hover:bg-surface-secondary/40">
                        <td className="px-4 py-2.5 font-medium text-text-primary sticky left-0 bg-surface z-10 whitespace-nowrap">{row.name}</td>
                        <td className="px-3 py-2.5 text-right font-semibold text-rose-400 whitespace-nowrap">${row.total.toLocaleString("en-CA",{maximumFractionDigits:0})}</td>
                        {row.monthly.map((v,i) => (
                          <td key={i} className="px-3 py-2.5 text-right text-text-secondary whitespace-nowrap">
                            {v > 0 ? `$${v.toLocaleString("en-CA",{maximumFractionDigits:0})}` : <span className="opacity-20">—</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                    <tr className="bg-surface-secondary/40 font-semibold border-t border-border">
                      <td className="px-4 py-2.5 text-text-primary sticky left-0 bg-surface-secondary/40 z-10">Total</td>
                      <td className="px-3 py-2.5 text-right text-rose-400">${BUDGET_CAMP.reduce((s,r)=>s+r.total,0).toLocaleString("en-CA",{maximumFractionDigits:0})}</td>
                      {MONTHS_SHORT.map((_,i) => {
                        const tot = BUDGET_CAMP.reduce((s,r)=>s+r.monthly[i],0);
                        return <td key={i} className="px-3 py-2.5 text-right text-rose-400 whitespace-nowrap">{tot > 0 ? `$${tot.toLocaleString("en-CA",{maximumFractionDigits:0})}` : <span className="opacity-20">—</span>}</td>;
                      })}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Non-Camp Expenses ── */}
          {budgetSubTab === "non-camp" && (
            <div className="bg-surface border border-border rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs min-w-[1100px]">
                  <thead>
                    <tr className="border-b border-border bg-surface-secondary">
                      <th className="text-left px-4 py-2.5 font-semibold text-text-tertiary sticky left-0 bg-surface-secondary z-10 min-w-[240px]">Expense Line</th>
                      <th className="text-left px-3 py-2.5 font-semibold text-text-tertiary">Category</th>
                      <th className="text-right px-3 py-2.5 font-semibold text-text-tertiary min-w-[90px]">Year Total</th>
                      {MONTHS_SHORT.map(m => <th key={m} className="text-right px-3 py-2.5 font-semibold text-text-tertiary whitespace-nowrap">{m}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {BUDGET_NONCAMP.map(row => (
                      <tr key={row.name} className="border-b border-border/40 hover:bg-surface-secondary/40">
                        <td className="px-4 py-2.5 font-medium text-text-primary sticky left-0 bg-surface z-10 whitespace-nowrap">{row.name}</td>
                        <td className="px-3 py-2.5 text-text-tertiary whitespace-nowrap">{row.category}</td>
                        <td className="px-3 py-2.5 text-right font-semibold text-rose-400 whitespace-nowrap">${row.total.toLocaleString("en-CA",{maximumFractionDigits:0})}</td>
                        {row.monthly.map((v,i) => (
                          <td key={i} className="px-3 py-2.5 text-right text-text-secondary whitespace-nowrap">
                            {v > 0 ? `$${v.toLocaleString("en-CA",{maximumFractionDigits:0})}` : <span className="opacity-20">—</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                    <tr className="bg-surface-secondary/40 font-semibold border-t border-border">
                      <td className="px-4 py-2.5 text-text-primary sticky left-0 bg-surface-secondary/40 z-10" colSpan={2}>Total</td>
                      <td className="px-3 py-2.5 text-right text-rose-400">${BUDGET_NONCAMP.reduce((s,r)=>s+r.total,0).toLocaleString("en-CA",{maximumFractionDigits:0})}</td>
                      {MONTHS_SHORT.map((_,i) => {
                        const tot = BUDGET_NONCAMP.reduce((s,r)=>s+r.monthly[i],0);
                        return <td key={i} className="px-3 py-2.5 text-right text-rose-400 whitespace-nowrap">{tot > 0 ? `$${tot.toLocaleString("en-CA",{maximumFractionDigits:0})}` : <span className="opacity-20">—</span>}</td>;
                      })}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Edit modal */}
      {editState && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-sm font-semibold text-text-primary mb-5">Edit Transaction</h3>
            <div className="space-y-3">
              <Field label="Date">
                <input type="date" value={editState.date} onChange={e => setEditState(s => s && ({ ...s, date: e.target.value }))}
                  className={inputCls} />
              </Field>
              <Field label="Description">
                <input type="text" value={editState.description} onChange={e => setEditState(s => s && ({ ...s, description: e.target.value }))}
                  className={inputCls} />
              </Field>
              <Field label="Details">
                <input type="text" value={editState.details} onChange={e => setEditState(s => s && ({ ...s, details: e.target.value }))}
                  className={inputCls} placeholder="Optional" />
              </Field>
              <Field label="Category">
                <select value={editState.category} onChange={e => setEditState(s => s && ({ ...s, category: e.target.value as ExpenseCategory }))}
                  className={inputCls}>
                  {ALL_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Account">
                <select value={editState.account} onChange={e => setEditState(s => s && ({ ...s, account: e.target.value }))}
                  className={inputCls}>
                  {allAccounts.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </Field>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Employee">
                  <input type="text" value={editState.employee} onChange={e => setEditState(s => s && ({ ...s, employee: e.target.value }))}
                    className={inputCls} placeholder="Optional" />
                </Field>
                <Field label="Project">
                  <input type="text" value={editState.project} onChange={e => setEditState(s => s && ({ ...s, project: e.target.value }))}
                    className={inputCls} placeholder="Optional" />
                </Field>
                <Field label="Equipment">
                  <input type="text" value={editState.equipment} onChange={e => setEditState(s => s && ({ ...s, equipment: e.target.value }))}
                    className={inputCls} placeholder="Optional" />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Amount (absolute)">
                  <input type="number" step="0.01" min="0" value={editState.amount}
                    onChange={e => setEditState(s => s && ({ ...s, amount: e.target.value }))}
                    className={inputCls} />
                </Field>
                <Field label="Currency">
                  <select value={editState.currency} onChange={e => setEditState(s => s && ({ ...s, currency: e.target.value as "CAD" | "USD" }))}
                    className={inputCls}>
                    <option value="CAD">CAD</option>
                    <option value="USD">USD</option>
                  </select>
                </Field>
              </div>
            </div>
            <div className="flex gap-2 mt-5 justify-end">
              <button onClick={() => setEditState(null)}
                className="px-4 py-2 text-xs font-medium text-text-secondary hover:text-text-primary border border-border rounded-lg transition-colors">
                Cancel
              </button>
              <button onClick={saveEdit}
                className="px-4 py-2 text-xs font-semibold rounded-lg hover:opacity-90 transition-all" style={{ background: "var(--color-primary)", color: "var(--color-primary-deep)" }}>
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-sm font-semibold text-text-primary mb-5">Add Transaction</h3>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Type">
                  <select value={addState.type} onChange={e => setAddState(s => ({ ...s, type: e.target.value as "expense" | "income" }))}
                    className={inputCls}>
                    <option value="expense">Expense</option>
                    <option value="income">Income</option>
                  </select>
                </Field>
                <Field label="Date">
                  <input type="date" value={addState.date} onChange={e => setAddState(s => ({ ...s, date: e.target.value }))}
                    className={inputCls} />
                </Field>
              </div>
              <Field label="Description">
                <input type="text" value={addState.description} onChange={e => setAddState(s => ({ ...s, description: e.target.value }))}
                  className={inputCls} placeholder="Vendor / description" />
              </Field>
              <Field label="Details">
                <input type="text" value={addState.details} onChange={e => setAddState(s => ({ ...s, details: e.target.value }))}
                  className={inputCls} placeholder="Optional" />
              </Field>
              <Field label="Category">
                <select value={addState.category} onChange={e => setAddState(s => ({ ...s, category: e.target.value as ExpenseCategory }))}
                  className={inputCls}>
                  {ALL_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Account">
                <select value={addState.account} onChange={e => setAddState(s => ({ ...s, account: e.target.value }))}
                  className={inputCls}>
                  {allAccounts.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </Field>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Employee">
                  <input type="text" value={addState.employee} onChange={e => setAddState(s => ({ ...s, employee: e.target.value }))}
                    className={inputCls} placeholder="Optional" />
                </Field>
                <Field label="Project">
                  <input type="text" value={addState.project} onChange={e => setAddState(s => ({ ...s, project: e.target.value }))}
                    className={inputCls} placeholder="Optional" />
                </Field>
                <Field label="Equipment">
                  <input type="text" value={addState.equipment} onChange={e => setAddState(s => ({ ...s, equipment: e.target.value }))}
                    className={inputCls} placeholder="Optional" />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Amount">
                  <input type="number" step="0.01" min="0" value={addState.amount}
                    onChange={e => setAddState(s => ({ ...s, amount: e.target.value }))}
                    className={inputCls} placeholder="0.00" />
                </Field>
                <Field label="Currency">
                  <select value={addState.currency} onChange={e => setAddState(s => ({ ...s, currency: e.target.value as "CAD" | "USD" }))}
                    className={inputCls}>
                    <option value="CAD">CAD</option>
                    <option value="USD">USD</option>
                  </select>
                </Field>
              </div>
            </div>
            <div className="flex gap-2 mt-5 justify-end">
              <button onClick={() => setShowAdd(false)}
                className="px-4 py-2 text-xs font-medium text-text-secondary hover:text-text-primary border border-border rounded-lg transition-colors">
                Cancel
              </button>
              <button onClick={saveAdd}
                className="px-4 py-2 text-xs font-semibold rounded-lg hover:opacity-90 transition-all" style={{ background: "var(--color-primary)", color: "var(--color-primary-deep)" }}>
                Add Transaction
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const inputCls = "w-full px-3 py-2 text-xs bg-surface-secondary border border-border rounded-lg text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] font-semibold uppercase tracking-widest text-text-tertiary mb-1">{label}</label>
      {children}
    </div>
  );
}
