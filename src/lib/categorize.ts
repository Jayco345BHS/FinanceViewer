import type { Category, CategoryRule } from '../types';

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'groceries', name: 'Groceries', color: '#4ade80' },
  { id: 'dining', name: 'Dining & Coffee', color: '#f59e0b' },
  { id: 'transit', name: 'Transit', color: '#38bdf8' },
  { id: 'auto', name: 'Gas & Auto', color: '#fb7185' },
  { id: 'shopping', name: 'Shopping', color: '#a78bfa' },
  { id: 'home', name: 'Home & Utilities', color: '#f472b6' },
  { id: 'pets', name: 'Pets', color: '#34d399' },
  { id: 'health', name: 'Health & Pharmacy', color: '#f87171' },
  { id: 'subscriptions', name: 'Subscriptions & Software', color: '#60a5fa' },
  { id: 'insurance', name: 'Insurance', color: '#fbbf24' },
  { id: 'travel', name: 'Travel', color: '#2dd4bf' },
  { id: 'entertainment', name: 'Entertainment', color: '#c084fc' },
  { id: 'fees', name: 'Fees & Interest', color: '#94a3b8' },
  { id: 'income', name: 'Income', color: '#22c55e' },
  { id: 'transfers', name: 'Payments & Transfers', color: '#64748b', isTransfer: true },
  { id: 'other', name: 'Other', color: '#9ca3af' },
];

/**
 * First match wins — keep specific rules above generic ones
 * (e.g. UBER EATS before UBER).
 */
export const DEFAULT_RULES: CategoryRule[] = [
  // Payments / transfers
  { keyword: 'PAYMENT FROM', categoryId: 'transfers' },
  { keyword: 'PAYMENT - THANK YOU', categoryId: 'transfers' },
  { keyword: 'PAYMENT THANK YOU', categoryId: 'transfers' },
  { keyword: 'PREAUTHORIZED PAYMENT', categoryId: 'transfers' },
  // Groceries
  { keyword: 'SOBEYS', categoryId: 'groceries' },
  { keyword: 'FOOD BASICS', categoryId: 'groceries' },
  { keyword: 'METRO', categoryId: 'groceries' },
  { keyword: 'LOBLAWS', categoryId: 'groceries' },
  { keyword: 'NO FRILLS', categoryId: 'groceries' },
  { keyword: 'FRESHCO', categoryId: 'groceries' },
  { keyword: 'FARM BOY', categoryId: 'groceries' },
  { keyword: 'COSTCO', categoryId: 'groceries' },
  { keyword: 'YOUR INDEPENDENT GROCER', categoryId: 'groceries' },
  // Dining & coffee
  { keyword: 'UBER EATS', categoryId: 'dining' },
  { keyword: 'DOORDASH', categoryId: 'dining' },
  { keyword: 'SKIP THE DISHES', categoryId: 'dining' },
  { keyword: 'TIM HORTONS', categoryId: 'dining' },
  { keyword: 'STARBUCKS', categoryId: 'dining' },
  { keyword: 'MCDONALD', categoryId: 'dining' },
  { keyword: 'SUBWAY', categoryId: 'dining' },
  { keyword: 'A&W', categoryId: 'dining' },
  { keyword: 'PIZZA', categoryId: 'dining' },
  { keyword: 'MONTANA', categoryId: 'dining' },
  { keyword: 'LONE STAR', categoryId: 'dining' },
  { keyword: 'SAIGON PHO', categoryId: 'dining' },
  { keyword: 'STACKED PANCAKE', categoryId: 'dining' },
  { keyword: 'CINNABON', categoryId: 'dining' },
  { keyword: "CHUCK'S ROADHOUSE", categoryId: 'dining' },
  { keyword: 'FIDDLEHEAD', categoryId: 'dining' },
  { keyword: "MICHAEL'S TABLE", categoryId: 'dining' },
  { keyword: 'CAFE HIDEAWAY', categoryId: 'dining' },
  { keyword: 'CORNER KITCHENS', categoryId: 'dining' },
  { keyword: 'MANHATTANS', categoryId: 'dining' },
  { keyword: 'KICK AND PUSH', categoryId: 'dining' },
  { keyword: 'BURGER', categoryId: 'dining' },
  { keyword: 'TACO', categoryId: 'dining' },
  { keyword: 'SUSHI', categoryId: 'dining' },
  { keyword: 'PHO ', categoryId: 'dining' },
  { keyword: 'RESTAURANT', categoryId: 'dining' },
  { keyword: 'BAR &', categoryId: 'dining' },
  { keyword: 'GRILL', categoryId: 'dining' },
  { keyword: 'COFFEE', categoryId: 'dining' },
  { keyword: 'BREWING', categoryId: 'dining' },
  // Transit (OCT* = OC Transpo, Ottawa)
  { keyword: 'OCT*', categoryId: 'transit' },
  { keyword: 'OC TRANSPO', categoryId: 'transit' },
  { keyword: 'PRESTO', categoryId: 'transit' },
  { keyword: 'UBER', categoryId: 'transit' },
  { keyword: 'LYFT', categoryId: 'transit' },
  // Gas & auto
  { keyword: 'ESSO', categoryId: 'auto' },
  { keyword: 'CIRCLE K', categoryId: 'auto' },
  { keyword: 'PETRO-CANADA', categoryId: 'auto' },
  { keyword: 'PETRO CANADA', categoryId: 'auto' },
  { keyword: 'SHELL', categoryId: 'auto' },
  { keyword: 'HUSKY', categoryId: 'auto' },
  { keyword: 'CAA*MEMBERSHIP', categoryId: 'auto' },
  // Shopping
  { keyword: 'AMAZON', categoryId: 'shopping' },
  { keyword: 'AMZN', categoryId: 'shopping' },
  { keyword: 'WALMART', categoryId: 'shopping' },
  { keyword: 'WAL-MART', categoryId: 'shopping' },
  { keyword: 'CANADIAN TIRE', categoryId: 'shopping' },
  { keyword: 'MICHAELS', categoryId: 'shopping' },
  { keyword: 'BEST BUY', categoryId: 'shopping' },
  { keyword: 'IKEA', categoryId: 'shopping' },
  { keyword: 'DOLLARAMA', categoryId: 'shopping' },
  // Home
  { keyword: 'HYDRO', categoryId: 'home' },
  { keyword: 'ENBRIDGE', categoryId: 'home' },
  { keyword: 'ROGERS', categoryId: 'home' },
  { keyword: 'BELL', categoryId: 'home' },
  { keyword: 'TELUS', categoryId: 'home' },
  // Pets
  { keyword: 'PET VALU', categoryId: 'pets' },
  { keyword: 'PETSMART', categoryId: 'pets' },
  { keyword: 'VETERINARY', categoryId: 'pets' },
  // Health
  { keyword: 'SHOPPERS DRUG MART', categoryId: 'health' },
  { keyword: 'PHARMA', categoryId: 'health' },
  { keyword: 'DENTAL', categoryId: 'health' },
  { keyword: 'DENTIST', categoryId: 'health' },
  { keyword: 'HOSP', categoryId: 'health' },
  { keyword: 'WDMH', categoryId: 'health' },
  { keyword: 'REXALL', categoryId: 'health' },
  // Subscriptions & software
  { keyword: 'OPENAI', categoryId: 'subscriptions' },
  { keyword: 'GITHUB', categoryId: 'subscriptions' },
  { keyword: 'GRAMMARLY', categoryId: 'subscriptions' },
  { keyword: 'NETFLIX', categoryId: 'subscriptions' },
  { keyword: 'SPOTIFY', categoryId: 'subscriptions' },
  { keyword: 'APPLE.COM/BILL', categoryId: 'subscriptions' },
  { keyword: 'GOOGLE *', categoryId: 'subscriptions' },
  { keyword: 'MICROSOFT*', categoryId: 'subscriptions' },
  { keyword: 'ADOBE', categoryId: 'subscriptions' },
  { keyword: 'DISNEY PLUS', categoryId: 'subscriptions' },
  { keyword: 'PRIME VIDEO', categoryId: 'subscriptions' },
  // Insurance
  { keyword: 'INSURANCE', categoryId: 'insurance' },
  // Travel
  { keyword: 'AIR CANADA', categoryId: 'travel' },
  { keyword: 'WESTJET', categoryId: 'travel' },
  { keyword: 'AIRBNB', categoryId: 'travel' },
  { keyword: 'HOTEL', categoryId: 'travel' },
  // Entertainment
  { keyword: 'CINEPLEX', categoryId: 'entertainment' },
  { keyword: 'STEAM', categoryId: 'entertainment' },
  // Fees
  { keyword: 'ANNUAL FEE', categoryId: 'fees' },
  { keyword: 'INTEREST CHARGE', categoryId: 'fees' },
  { keyword: 'OVERLIMIT FEE', categoryId: 'fees' },
];

/** Normalize a description for rule matching. */
export function normalizeDescription(desc: string): string {
  return desc.toUpperCase().replace(/\s+/g, ' ').trim();
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const ruleCache = new Map<string, RegExp>();

function ruleRegex(keyword: string): RegExp {
  const key = keyword.toUpperCase();
  let re = ruleCache.get(key);
  if (!re) {
    // Leading word boundary so "BELL" doesn't match "PORTOBELLO".
    re = new RegExp(`\\b${escapeRegex(key)}`);
    ruleCache.set(key, re);
  }
  return re;
}

export function categorize(description: string, rules: CategoryRule[]): string {
  const norm = normalizeDescription(description);
  for (const rule of rules) {
    if (ruleRegex(rule.keyword).test(norm)) return rule.categoryId;
  }
  return 'other';
}
